import express from 'express';
import crypto from 'crypto';
import pg from 'pg';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5000', 10);
const isProd = process.env.NODE_ENV === 'production';

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
const CLAIM_RATE_WINDOW = 3_600_000;
const CLAIM_RATE_MAX = 10;
const JSON_BODY_LIMIT = '16kb';
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const MISSION_OUTCOME_ALLOWLIST = new Set(['victory', 'defeat', 'withdrawn', 'timeout']);
const NUMERIC_BOUNDS = {
  wave: { min: 1, max: 999 },
  tankersSaved: { min: 0, max: 999 },
  tankersLost: { min: 0, max: 999 },
  enemiesDestroyed: { min: 0, max: 99999 },
  missionTime: { min: 0, max: 86_400 },
} as const;

export interface QueryableDb {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

export function createDatabasePool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
}

export async function initDatabase(db: QueryableDb): Promise<void> {
  await db.query('SELECT 1');

  await db.query(`
    CREATE TABLE IF NOT EXISTS callsigns (
      callsign VARCHAR(64) PRIMARY KEY,
      claim_token VARCHAR(64) NOT NULL,
      ip_hash VARCHAR(32),
      claimed_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id BIGSERIAL PRIMARY KEY,
      callsign VARCHAR(64) NOT NULL,
      score INTEGER NOT NULL,
      wave INTEGER NOT NULL DEFAULT 1,
      tankers_saved INTEGER NOT NULL DEFAULT 0,
      tankers_lost INTEGER NOT NULL DEFAULT 0,
      enemies_destroyed INTEGER NOT NULL DEFAULT 0,
      mission_time INTEGER NOT NULL DEFAULT 0,
      mission_outcome VARCHAR(32),
      ip_hash VARCHAR(32),
      country CHAR(2),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      id BIGSERIAL PRIMARY KEY,
      bucket VARCHAR(64) NOT NULL,
      key VARCHAR(128) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.query('CREATE INDEX IF NOT EXISTS idx_leaderboard_score_desc ON leaderboard (score DESC)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at_desc ON leaderboard (created_at DESC)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_leaderboard_callsign ON leaderboard (callsign)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket_key_created_at ON api_rate_limits (bucket, key, created_at DESC)');
}

function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return ip.replace(/^::ffff:/, '');
}

export function getClientIp(req: express.Request): string {
  return normalizeIp(req.ip || req.socket.remoteAddress || undefined);
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.DATABASE_URL || '')).digest('hex').slice(0, 32);
}

function timingSafeTokenEquals(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function cleanupRateLimitMap(map: Map<string, number[]>, windowMs: number, now: number = Date.now()): void {
  for (const [key, timestamps] of map.entries()) {
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length === 0) {
      map.delete(key);
      continue;
    }
    map.set(key, recent);
  }
}

function isRateLimited(map: Map<string, number[]>, ip: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const timestamps = map.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    map.set(ip, recent);
    return true;
  }
  recent.push(now);
  map.set(ip, recent);
  return false;
}

async function isRateLimitedDb(
  db: QueryableDb,
  bucket: string,
  key: string,
  windowMs: number,
  max: number,
): Promise<boolean> {
  const windowSeconds = Math.max(1, Math.floor(windowMs / 1000));
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM api_rate_limits
     WHERE bucket = $1
       AND key = $2
       AND created_at >= NOW() - ($3::int * INTERVAL '1 second')`,
    [bucket, key, windowSeconds],
  );
  const recentCount = Number(countResult.rows[0]?.count ?? 0);
  if (recentCount >= max) return true;

  await db.query(
    'INSERT INTO api_rate_limits (bucket, key) VALUES ($1, $2)',
    [bucket, key],
  );
  await db.query(`DELETE FROM api_rate_limits WHERE created_at < NOW() - INTERVAL '24 hours'`);
  return false;
}

function toBoundedInt(
  val: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const n = Math.floor(val);
    if (n >= min && n <= max) return n;
  }
  return fallback;
}

export async function lookupCountry(ip: string, fetchImpl: typeof fetch): Promise<string | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const cleanIp = ip === '::1' || ip === '127.0.0.1' ? '' : ip;
    const url = `https://ipwho.is/${cleanIp}?fields=country_code`;
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string };
    if (typeof data.country_code !== 'string') return null;
    const normalized = data.country_code.toUpperCase();
    return COUNTRY_CODE_REGEX.test(normalized) ? normalized : null;
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function validateCallsignClaim(
  db: QueryableDb,
  callsign: string,
  claimToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await db.query('SELECT claim_token FROM callsigns WHERE callsign = $1', [callsign]);
  if (!result.rowCount) {
    return { ok: false, error: 'Callsign must be claimed before score submission' };
  }
  const expected = result.rows[0]?.claim_token;
  if (typeof expected !== 'string' || !timingSafeTokenEquals(expected, claimToken)) {
    return { ok: false, error: 'Callsign claim token mismatch' };
  }
  return { ok: true };
}

const PREFIXES = new Set([
  'GHOST', 'IRON', 'SHADOW', 'STORM', 'STEEL',
  'COBRA', 'VIPER', 'HAWK', 'WOLF', 'EAGLE',
  'THUNDER', 'SILENT', 'DARK', 'SWIFT', 'CRIMSON',
  'ALPHA', 'BRAVO', 'DELTA', 'OMEGA', 'TITAN',
  'ROGUE', 'REAPER', 'FROST', 'SAVAGE', 'NOBLE',
  'PHANTOM', 'STRIKE', 'RAPID', 'APEX', 'NIGHT',
  'ATOMIC', 'EMBER', 'POLAR', 'SIERRA', 'ECHO',
  'RAZOR', 'ONYX', 'SPECTRE', 'WARDOG', 'LANCE',
]);

const SUFFIXES = new Set([
  'AEGIS', 'BLADE', 'FALCON', 'SENTINEL', 'PHOENIX',
  'GUARDIAN', 'RAPTOR', 'HAMMER', 'SHIELD', 'ARROW',
  'SABRE', 'TALON', 'FURY', 'WARDEN', 'DAGGER',
  'HYDRA', 'CONDOR', 'PATRIOT', 'JAVELIN', 'TRIDENT',
  'BASTION', 'CORSAIR', 'NOMAD', 'VALKYRIE', 'TYPHOON',
  'ARSENAL', 'MANTIS', 'BULWARK', 'TEMPEST', 'PROWLER',
  'CENTURION', 'GARRISON', 'OUTPOST', 'RAMPART', 'CITADEL',
  'SPARTAN', 'HORNET', 'MUSKET', 'BRIGADE', 'VANGUARD',
]);

function isValidCallsignFormat(callsign: string): boolean {
  const match = callsign.match(/^([A-Z]+)-([A-Z]+)-(\d{2})$/);
  if (!match) return false;
  return PREFIXES.has(match[1]) && SUFFIXES.has(match[2]);
}

export function createApp(db: QueryableDb, fetchImpl: typeof fetch = fetch): express.Express {
  const app = express();
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const rateLimitMap = new Map<string, number[]>();
  const claimRateLimitMap = new Map<string, number[]>();

  const cleanupInterval = setInterval(() => {
    cleanupRateLimitMap(rateLimitMap, RATE_LIMIT_WINDOW);
    cleanupRateLimitMap(claimRateLimitMap, CLAIM_RATE_WINDOW);
  }, 60_000);
  cleanupInterval.unref();

  app.get('/api/leaderboard', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100);
    try {
      const result = await db.query(
        `SELECT callsign, score, wave, tankers_saved as "tankersSaved", country, rank
         FROM (
           SELECT
             callsign,
             score,
             wave,
             tankers_saved,
             country,
             RANK() OVER (ORDER BY score DESC) AS rank
           FROM leaderboard
         ) ranked
         ORDER BY score DESC, callsign ASC
         LIMIT $1`,
        [limit],
      );
      const entries = result.rows.map((row) => ({
        rank: Number(row.rank),
        callsign: row.callsign,
        score: row.score,
        wave: row.wave,
        tankersSaved: row.tankersSaved,
        country: row.country,
      }));
      res.json(entries);
    } catch (e: any) {
      console.error('Leaderboard fetch error:', e.message);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/leaderboard', async (req, res) => {
    const { callsign, claimToken, score, wave, tankersSaved, tankersLost, enemiesDestroyed, missionTime, missionOutcome } = req.body;

    if (!callsign || typeof callsign !== 'string' || callsign.length > 64) {
      return res.status(400).json({ error: 'Invalid callsign' });
    }
    if (!claimToken || typeof claimToken !== 'string' || claimToken.length > 64) {
      return res.status(401).json({ error: 'Missing or invalid claim token' });
    }
    if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0 || score > 99_999_999) {
      return res.status(400).json({ error: 'Invalid score' });
    }

    try {
      const claimCheck = await validateCallsignClaim(db, callsign, claimToken);
      if (!claimCheck.ok) {
        return res.status(403).json({ error: claimCheck.error });
      }
    } catch (e: any) {
      console.error('Callsign ownership verification failed:', e.message);
      return res.status(500).json({ error: 'Database error' });
    }

    const clientIp = getClientIp(req);
    try {
      const limited = await isRateLimitedDb(db, 'leaderboard_submit', clientIp, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX);
      if (limited) {
        return res.status(429).json({ error: 'Too many submissions. Try again later.' });
      }
    } catch {
      if (isRateLimited(rateLimitMap, clientIp, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX)) {
        return res.status(429).json({ error: 'Too many submissions. Try again later.' });
      }
    }

    const country = await lookupCountry(clientIp, fetchImpl);

    const safeWave = toBoundedInt(wave, 1, NUMERIC_BOUNDS.wave.min, NUMERIC_BOUNDS.wave.max);
    const safeTankersSaved = toBoundedInt(tankersSaved, 0, NUMERIC_BOUNDS.tankersSaved.min, NUMERIC_BOUNDS.tankersSaved.max);
    const safeTankersLost = toBoundedInt(tankersLost, 0, NUMERIC_BOUNDS.tankersLost.min, NUMERIC_BOUNDS.tankersLost.max);
    const safeEnemiesDestroyed = toBoundedInt(enemiesDestroyed, 0, NUMERIC_BOUNDS.enemiesDestroyed.min, NUMERIC_BOUNDS.enemiesDestroyed.max);
    const safeMissionTime = toBoundedInt(missionTime, 0, NUMERIC_BOUNDS.missionTime.min, NUMERIC_BOUNDS.missionTime.max);
    const safeOutcome = typeof missionOutcome === 'string' && MISSION_OUTCOME_ALLOWLIST.has(missionOutcome)
      ? missionOutcome
      : null;

    try {
      const rankResult = await db.query(
        `WITH inserted AS (
           INSERT INTO leaderboard (callsign, score, wave, tankers_saved, tankers_lost, enemies_destroyed, mission_time, mission_outcome, ip_hash, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING score
         )
         SELECT 1 + COUNT(*)::int AS rank
         FROM leaderboard l
         CROSS JOIN inserted i
         WHERE l.score > i.score`,
        [
          callsign.slice(0, 64),
          Math.floor(score),
          safeWave,
          safeTankersSaved,
          safeTankersLost,
          safeEnemiesDestroyed,
          safeMissionTime,
          safeOutcome,
          hashIp(clientIp),
          country,
        ],
      );
      const rank = parseInt(rankResult.rows[0].rank, 10);

      res.json({ rank, country });
    } catch (e: any) {
      console.error('Score submit error:', e.message);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/callsign/check', async (req, res) => {
    const { callsign } = req.body;
    if (!callsign || typeof callsign !== 'string') {
      return res.status(400).json({ available: false });
    }
    if (!isValidCallsignFormat(callsign)) {
      return res.json({ available: false });
    }
    try {
      const result = await db.query('SELECT 1 FROM callsigns WHERE callsign = $1', [callsign]);
      res.json({ available: result.rowCount === 0 });
    } catch (e: any) {
      console.error('Callsign check error:', e.message);
      res.status(500).json({ available: false });
    }
  });

  app.post('/api/callsign/claim', async (req, res) => {
    const { callsign, claimToken } = req.body;

    if (!callsign || typeof callsign !== 'string' || callsign.length > 64) {
      return res.status(400).json({ ok: false, error: 'Invalid callsign' });
    }
    if (!claimToken || typeof claimToken !== 'string' || claimToken.length > 64) {
      return res.status(400).json({ ok: false, error: 'Invalid claim token' });
    }
    if (!isValidCallsignFormat(callsign)) {
      return res.status(400).json({ ok: false, error: 'Invalid callsign format' });
    }

    const clientIp = getClientIp(req);
    try {
      const limited = await isRateLimitedDb(db, 'callsign_claim', clientIp, CLAIM_RATE_WINDOW, CLAIM_RATE_MAX);
      if (limited) {
        return res.status(429).json({ ok: false, error: 'Too many claims. Try again later.' });
      }
    } catch {
      if (isRateLimited(claimRateLimitMap, clientIp, CLAIM_RATE_WINDOW, CLAIM_RATE_MAX)) {
        return res.status(429).json({ ok: false, error: 'Too many claims. Try again later.' });
      }
    }

    try {
      const result = await db.query(
        `INSERT INTO callsigns (callsign, claim_token, ip_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (callsign) DO NOTHING`,
        [callsign, claimToken, hashIp(clientIp)],
      );
      if (result.rowCount === 0) {
        return res.json({ ok: false, error: 'CALLSIGN TAKEN' });
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('Callsign claim error:', e.message);
      res.status(500).json({ ok: false, error: 'Database error' });
    }
  });

  return app;
}

export async function bootstrapServer(
  initFn: () => Promise<void>,
  listenFn: () => Promise<void>,
): Promise<void> {
  await initFn();
  await listenFn();
}

export async function start(): Promise<void> {
  const pool = createDatabasePool();

  await bootstrapServer(
    async () => {
      try {
        await initDatabase(pool);
        console.log('Database initialized');
      } catch (error: any) {
        console.error('Database initialization failed. Refusing to start server.', error?.message || error);
        throw error;
      }
    },
    async () => {
      const app = createApp(pool);

      if (isProd) {
        app.use(express.static(path.join(__dirname, 'dist')));
        app.use((_req, res) => {
          res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });
      } else {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
      }

      await new Promise<void>((resolve) => {
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`Server running on port ${PORT}`);
          resolve();
        });
      });
    },
  );
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  start().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
