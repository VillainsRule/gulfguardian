/**
 * Tiny pixel-art country flags drawn with Pixi.js Graphics.
 * Each flag is 16×11 pixels — suitable for inline leaderboard display.
 */

import { Graphics } from 'pixi.js';

const W = 16;
const H = 11;

type FlagDrawFn = (g: Graphics) => void;

/** Draw a horizontal tricolor (top, middle, bottom thirds). */
function hTricolor(g: Graphics, c1: number, c2: number, c3: number): void {
  const h1 = Math.floor(H / 3);
  const h2 = Math.floor(H * 2 / 3) - h1;
  const h3 = H - h1 - h2;
  g.rect(0, 0, W, h1).fill(c1);
  g.rect(0, h1, W, h2).fill(c2);
  g.rect(0, h1 + h2, W, h3).fill(c3);
}

/** Draw a vertical tricolor (left, center, right thirds). */
function vTricolor(g: Graphics, c1: number, c2: number, c3: number): void {
  const w1 = Math.floor(W / 3);
  const w2 = Math.floor(W * 2 / 3) - w1;
  const w3 = W - w1 - w2;
  g.rect(0, 0, w1, H).fill(c1);
  g.rect(w1, 0, w2, H).fill(c2);
  g.rect(w1 + w2, 0, w3, H).fill(c3);
}

/** Draw a horizontal bicolor (top half, bottom half). */
function hBicolor(g: Graphics, c1: number, c2: number): void {
  const h1 = Math.floor(H / 2);
  g.rect(0, 0, W, h1).fill(c1);
  g.rect(0, h1, W, H - h1).fill(c2);
}

const FLAG_DRAW: Record<string, FlagDrawFn> = {
  // --- Americas ---
  US(g) {
    // Simplified: red/white stripes + blue canton
    for (let i = 0; i < H; i++) {
      g.rect(0, i, W, 1).fill(i % 2 === 0 ? 0xb22234 : 0xffffff);
    }
    g.rect(0, 0, 7, 6).fill(0x3c3b6e);
    // Tiny stars (dots)
    const starColor = 0xffffff;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        g.rect(1 + col * 2, 1 + row * 2, 1, 1).fill(starColor);
      }
    }
  },

  GB(g) {
    // Union Jack simplified
    g.rect(0, 0, W, H).fill(0x003078);
    // White cross
    g.rect(6, 0, 4, H).fill(0xffffff);
    g.rect(0, 4, W, 3).fill(0xffffff);
    // Red cross
    g.rect(7, 0, 2, H).fill(0xc8102e);
    g.rect(0, 4.5, W, 2).fill(0xc8102e);
  },

  CA(g) {
    // Canada: red-white-red vertical
    const side = 4;
    g.rect(0, 0, side, H).fill(0xff0000);
    g.rect(side, 0, W - side * 2, H).fill(0xffffff);
    g.rect(W - side, 0, side, H).fill(0xff0000);
    // Red diamond for maple leaf
    g.rect(7, 3, 2, 2).fill(0xff0000);
    g.rect(6, 4, 4, 3).fill(0xff0000);
  },

  BR(g) {
    // Brazil: green bg, yellow diamond, blue circle
    g.rect(0, 0, W, H).fill(0x009739);
    g.rect(4, 2, 8, 7).fill(0xfedd00);
    g.circle(8, 5.5, 2.5).fill(0x002776);
  },

  MX(g) {
    vTricolor(g, 0x006341, 0xffffff, 0xce1126);
  },

  AR(g) {
    hTricolor(g, 0x75aadb, 0xffffff, 0x75aadb);
  },

  CL(g) {
    g.rect(0, 0, 5, 5).fill(0x0039a6);
    g.rect(5, 0, W - 5, 5).fill(0xffffff);
    g.rect(0, 5, W, H - 5).fill(0xd52b1e);
  },

  CO(g) {
    const h1 = Math.floor(H / 2);
    g.rect(0, 0, W, h1).fill(0xfcd116);
    g.rect(0, h1, W, Math.floor((H - h1) / 2)).fill(0x003893);
    g.rect(0, h1 + Math.floor((H - h1) / 2), W, H).fill(0xce1126);
  },

  // --- Europe ---
  FR(g) { vTricolor(g, 0x002395, 0xffffff, 0xed2939); },
  DE(g) { hTricolor(g, 0x000000, 0xdd0000, 0xffcc00); },
  IT(g) { vTricolor(g, 0x009246, 0xffffff, 0xce2b37); },
  ES(g) {
    const s = 3;
    g.rect(0, 0, W, s).fill(0xaa151b);
    g.rect(0, s, W, H - s * 2).fill(0xf1bf00);
    g.rect(0, H - s, W, s).fill(0xaa151b);
  },

  NL(g) { hTricolor(g, 0xae1c28, 0xffffff, 0x21468b); },
  BE(g) { vTricolor(g, 0x000000, 0xfad201, 0xef3340); },
  IE(g) { vTricolor(g, 0x169b62, 0xffffff, 0xff883e); },
  AT(g) { hTricolor(g, 0xed2939, 0xffffff, 0xed2939); },
  HU(g) { hTricolor(g, 0xce2939, 0xffffff, 0x477050); },
  BG(g) { hTricolor(g, 0xffffff, 0x00966e, 0xd62612); },
  RO(g) { vTricolor(g, 0x002b7f, 0xfcd116, 0xce1126); },
  LU(g) { hTricolor(g, 0xed2939, 0xffffff, 0x00a1de); },
  CH(g) {
    g.rect(0, 0, W, H).fill(0xd52b1e);
    g.rect(6, 2, 4, 7).fill(0xffffff);
    g.rect(3, 4, 10, 3).fill(0xffffff);
  },

  SE(g) {
    g.rect(0, 0, W, H).fill(0x006aa7);
    g.rect(4, 0, 3, H).fill(0xfecc00);
    g.rect(0, 4, W, 3).fill(0xfecc00);
  },

  NO(g) {
    g.rect(0, 0, W, H).fill(0xba0c2f);
    g.rect(4, 0, 4, H).fill(0xffffff);
    g.rect(0, 3.5, W, 4).fill(0xffffff);
    g.rect(5, 0, 2, H).fill(0x00205b);
    g.rect(0, 4, W, 3).fill(0x00205b);
  },

  DK(g) {
    g.rect(0, 0, W, H).fill(0xc8102e);
    g.rect(4, 0, 3, H).fill(0xffffff);
    g.rect(0, 4, W, 3).fill(0xffffff);
  },

  FI(g) {
    g.rect(0, 0, W, H).fill(0xffffff);
    g.rect(4, 0, 3, H).fill(0x003580);
    g.rect(0, 4, W, 3).fill(0x003580);
  },

  PL(g) { hBicolor(g, 0xffffff, 0xdc143c); },
  UA(g) { hBicolor(g, 0x005bbb, 0xffd500); },

  RU(g) { hTricolor(g, 0xffffff, 0x0039a6, 0xd52b1e); },

  PT(g) {
    const gw = 6;
    g.rect(0, 0, gw, H).fill(0x006600);
    g.rect(gw, 0, W - gw, H).fill(0xff0000);
  },

  GR(g) {
    for (let i = 0; i < 9; i++) {
      const rowH = H / 9;
      g.rect(0, i * rowH, W, rowH).fill(i % 2 === 0 ? 0x0d5eaf : 0xffffff);
    }
    g.rect(0, 0, 6, 6).fill(0x0d5eaf);
    g.rect(2, 0, 2, 6).fill(0xffffff);
    g.rect(0, 2, 6, 2).fill(0xffffff);
  },

  CZ(g) {
    g.rect(0, 0, W, Math.floor(H / 2)).fill(0xffffff);
    g.rect(0, Math.floor(H / 2), W, H - Math.floor(H / 2)).fill(0xd7141a);
    // Blue triangle
    g.moveTo(0, 0).lineTo(8, H / 2).lineTo(0, H).closePath().fill(0x11457e);
  },

  // --- Asia ---
  JP(g) {
    g.rect(0, 0, W, H).fill(0xffffff);
    g.circle(W / 2, H / 2, 3.5).fill(0xbc002d);
  },

  CN(g) {
    g.rect(0, 0, W, H).fill(0xde2910);
    g.rect(2, 1, 2, 2).fill(0xffde00);
    g.rect(5, 0, 1, 1).fill(0xffde00);
    g.rect(6, 1, 1, 1).fill(0xffde00);
    g.rect(6, 3, 1, 1).fill(0xffde00);
    g.rect(5, 4, 1, 1).fill(0xffde00);
  },

  KR(g) {
    g.rect(0, 0, W, H).fill(0xffffff);
    g.circle(W / 2, H / 2, 3).fill(0xcd2e3a);
    g.rect(W / 2 - 3, H / 2, 6, 3).fill(0x0047a0);
  },

  IN(g) {
    hTricolor(g, 0xff9933, 0xffffff, 0x138808);
    g.circle(W / 2, H / 2, 1.5).fill(0x000080);
  },

  PK(g) {
    g.rect(0, 0, 4, H).fill(0xffffff);
    g.rect(4, 0, W - 4, H).fill(0x01411c);
  },

  TW(g) {
    g.rect(0, 0, W, H).fill(0xfe0000);
    g.rect(0, 0, 7, 6).fill(0x000095);
    g.circle(3.5, 3, 2).fill(0xffffff);
  },

  TH(g) {
    const s = 2;
    g.rect(0, 0, W, H).fill(0xffffff);
    g.rect(0, 0, W, s).fill(0xa51931);
    g.rect(0, H - s, W, s).fill(0xa51931);
    g.rect(0, s + 1, W, H - (s + 1) * 2).fill(0x2d2a4a);
  },

  VN(g) {
    g.rect(0, 0, W, H).fill(0xda251d);
    g.rect(7, 3, 3, 3).fill(0xffff00);
  },

  PH(g) {
    g.rect(0, 0, W, Math.floor(H / 2)).fill(0x0038a8);
    g.rect(0, Math.floor(H / 2), W, H - Math.floor(H / 2)).fill(0xce1126);
    g.moveTo(0, 0).lineTo(7, H / 2).lineTo(0, H).closePath().fill(0xffffff);
  },

  SG(g) {
    hBicolor(g, 0xed2939, 0xffffff);
    g.circle(5, 2.5, 1.5).fill(0xffffff);
  },

  MY(g) {
    for (let i = 0; i < 7; i++) {
      const rowH = H / 7;
      g.rect(0, i * rowH, W, rowH).fill(i % 2 === 0 ? 0xcc0001 : 0xffffff);
    }
    g.rect(0, 0, 8, 5).fill(0x010066);
  },

  ID(g) { hBicolor(g, 0xff0000, 0xffffff); },

  // --- Middle East ---
  SA(g) {
    g.rect(0, 0, W, H).fill(0x006c35);
    g.rect(3, 4, 10, 1).fill(0xffffff);
  },

  AE(g) {
    hTricolor(g, 0x00732f, 0xffffff, 0x000000);
    g.rect(0, 0, 4, H).fill(0xff0000);
  },

  IR(g) {
    hTricolor(g, 0x239f40, 0xffffff, 0xda0000);
  },

  IQ(g) {
    hTricolor(g, 0xce1126, 0xffffff, 0x000000);
  },

  IL(g) {
    g.rect(0, 0, W, H).fill(0xffffff);
    g.rect(0, 1, W, 2).fill(0x0038b8);
    g.rect(0, H - 3, W, 2).fill(0x0038b8);
  },

  TR(g) {
    g.rect(0, 0, W, H).fill(0xe30a17);
    g.circle(6, H / 2, 3).fill(0xffffff);
    g.circle(7, H / 2, 2.5).fill(0xe30a17);
  },

  QA(g) {
    g.rect(0, 0, 5, H).fill(0xffffff);
    g.rect(5, 0, W - 5, H).fill(0x8a1538);
  },

  KW(g) {
    hTricolor(g, 0x007a3d, 0xffffff, 0xce1126);
    g.moveTo(0, 0).lineTo(5, H / 2).lineTo(0, H).closePath().fill(0x000000);
  },

  OM(g) {
    g.rect(0, 0, W, Math.floor(H / 3)).fill(0xffffff);
    g.rect(0, Math.floor(H / 3), W, Math.floor(H / 3)).fill(0xdb161b);
    g.rect(0, Math.floor(H * 2 / 3), W, H - Math.floor(H * 2 / 3)).fill(0x008000);
    g.rect(0, 0, 4, H).fill(0xdb161b);
  },

  BH(g) {
    g.rect(0, 0, W, H).fill(0xce1126);
    g.rect(0, 0, 5, H).fill(0xffffff);
  },

  // --- Africa ---
  ZA(g) {
    g.rect(0, 0, W, Math.floor(H / 3)).fill(0xde3831);
    g.rect(0, Math.floor(H / 3), W, Math.floor(H / 3)).fill(0xffffff);
    g.rect(0, Math.floor(H * 2 / 3), W, H - Math.floor(H * 2 / 3)).fill(0x002395);
    g.moveTo(0, 0).lineTo(6, H / 2).lineTo(0, H).closePath().fill(0x007a4d);
  },

  EG(g) { hTricolor(g, 0xce1126, 0xffffff, 0x000000); },
  NG(g) { vTricolor(g, 0x008751, 0xffffff, 0x008751); },

  // --- Oceania ---
  AU(g) {
    g.rect(0, 0, W, H).fill(0x00008b);
    g.rect(0, 0, 7, 6).fill(0x00008b);
    // Simplified union jack in canton
    g.rect(2, 0, 2, 6).fill(0xffffff);
    g.rect(0, 2, 7, 2).fill(0xffffff);
    g.rect(2.5, 0, 1, 6).fill(0xff0000);
    g.rect(0, 2.3, 7, 1.4).fill(0xff0000);
    // Southern cross dots
    g.rect(12, 3, 1, 1).fill(0xffffff);
    g.rect(10, 6, 1, 1).fill(0xffffff);
    g.rect(12, 8, 1, 1).fill(0xffffff);
  },

  NZ(g) {
    g.rect(0, 0, W, H).fill(0x00247d);
    g.rect(0, 0, 7, 6).fill(0x00247d);
    g.rect(2, 0, 2, 6).fill(0xffffff);
    g.rect(0, 2, 7, 2).fill(0xffffff);
    g.rect(2.5, 0, 1, 6).fill(0xcc142b);
    g.rect(0, 2.3, 7, 1.4).fill(0xcc142b);
    // Stars
    g.rect(12, 2, 1, 1).fill(0xcc142b);
    g.rect(12, 5, 1, 1).fill(0xcc142b);
    g.rect(11, 7, 1, 1).fill(0xcc142b);
    g.rect(13, 8, 1, 1).fill(0xcc142b);
  },
};

/**
 * Create a tiny Graphics flag for the given 2-letter country code.
 * Returns null if the country code is unknown (caller can fall back to text).
 */
export function createFlagGraphic(countryCode: string): Graphics | null {
  const code = countryCode.toUpperCase();
  const drawFn = FLAG_DRAW[code];
  if (!drawFn) return createFallbackFlag(code);

  const g = new Graphics();
  drawFn(g);
  // Thin border
  g.rect(0, 0, W, H).stroke({ width: 0.5, color: 0x888888, alpha: 0.5 });
  return g;
}

/** Fallback: neutral gray flag with 2-letter code. */
function createFallbackFlag(code: string): Graphics {
  const g = new Graphics();
  g.rect(0, 0, W, H).fill(0x333333);
  g.rect(0, 0, W, H).stroke({ width: 0.5, color: 0x888888, alpha: 0.5 });
  return g;
}

export const FLAG_WIDTH = W;
export const FLAG_HEIGHT = H;

/** Map 2-letter ISO codes to readable country names. */
export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', BR: 'Brazil',
  MX: 'Mexico', AR: 'Argentina', CL: 'Chile', CO: 'Colombia',
  FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain',
  NL: 'Netherlands', BE: 'Belgium', IE: 'Ireland', AT: 'Austria',
  HU: 'Hungary', BG: 'Bulgaria', RO: 'Romania', LU: 'Luxembourg',
  CH: 'Switzerland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', PL: 'Poland', UA: 'Ukraine', RU: 'Russia',
  PT: 'Portugal', GR: 'Greece', CZ: 'Czechia',
  JP: 'Japan', CN: 'China', KR: 'South Korea', IN: 'India',
  PK: 'Pakistan', TW: 'Taiwan', TH: 'Thailand', VN: 'Vietnam',
  PH: 'Philippines', SG: 'Singapore', MY: 'Malaysia', ID: 'Indonesia',
  SA: 'Saudi Arabia', AE: 'UAE', IR: 'Iran', IQ: 'Iraq',
  IL: 'Israel', TR: 'Turkey', QA: 'Qatar', KW: 'Kuwait',
  OM: 'Oman', BH: 'Bahrain',
  ZA: 'South Africa', EG: 'Egypt', NG: 'Nigeria',
  AU: 'Australia', NZ: 'New Zealand',
};
