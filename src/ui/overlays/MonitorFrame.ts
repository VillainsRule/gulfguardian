import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { RunState, WORLD_WIDTH } from '@/core/run-state';

// Map world coordinates to approximate real-world lat/lon
const LON_MIN = 54.0;
const LON_MAX = 58.5;
const LAT_MIN = 25.2;
const LAT_MAX = 27.0;

const SYSTEM_LABELS = [
  'SYS: NOMINAL',
  'NAV: ACTIVE',
  'ECM: STANDBY',
  'SONAR: PASSIVE',
  'COMMS: ENCRYPTED',
  'GPS: LOCKED',
  'IFF: ONLINE',
  'CIWS: ARMED',
];

const TICKER_TEXT = '  STRAIT OF HORMUZ PATROL  //  TASK FORCE 37  //  COMMS ENCRYPTED  //  ALL STATIONS ALERT  //  OPCON ALPHA  //  EMCON CHARLIE  ';

export class MonitorFrame extends Container {
  private scanlineGraphics: Graphics;
  private vignetteGraphics: Graphics;
  private timer: number = 0;

  // Decorative readouts
  private coordText: Text;
  private dateTimeText: Text;
  private systemText: Text;
  private signalText: Text;
  private threatText: Text;
  private freqText: Text;
  private tickerText: Text;
  private signalBarGraphics: Graphics;

  constructor() {
    super();
    const g = new Graphics();

    const border = 8;
    const cornerSize = 20;

    // Border edges
    g.rect(0, 0, GAME_WIDTH, border).fill({ color: COLORS.phosphorGreen, alpha: 0.15 });
    g.rect(0, GAME_HEIGHT - border, GAME_WIDTH, border).fill({ color: COLORS.phosphorGreen, alpha: 0.15 });
    g.rect(0, 0, border, GAME_HEIGHT).fill({ color: COLORS.phosphorGreen, alpha: 0.15 });
    g.rect(GAME_WIDTH - border, 0, border, GAME_HEIGHT).fill({ color: COLORS.phosphorGreen, alpha: 0.15 });

    // Corner brackets
    g.rect(border, border, cornerSize, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(border, border, 2, cornerSize).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(GAME_WIDTH - border - cornerSize, border, cornerSize, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(GAME_WIDTH - border - 2, border, 2, cornerSize).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(border, GAME_HEIGHT - border - 2, cornerSize, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(border, GAME_HEIGHT - border - cornerSize, 2, cornerSize).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(GAME_WIDTH - border - cornerSize, GAME_HEIGHT - border - 2, cornerSize, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
    g.rect(GAME_WIDTH - border - 2, GAME_HEIGHT - border - cornerSize, 2, cornerSize).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });

    // Cross-hair tick marks on edges (military HUD style)
    const midX = GAME_WIDTH / 2;
    const midY = GAME_HEIGHT / 2;
    // Top center tick
    g.rect(midX - 1, border, 2, 12).fill({ color: COLORS.phosphorGreen, alpha: 0.3 });
    // Bottom center tick
    g.rect(midX - 1, GAME_HEIGHT - border - 12, 2, 12).fill({ color: COLORS.phosphorGreen, alpha: 0.3 });
    // Left center tick
    g.rect(border, midY - 1, 12, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.3 });
    // Right center tick
    g.rect(GAME_WIDTH - border - 12, midY - 1, 12, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.3 });

    this.addChild(g);

    // CRT scanline effect (subtle)
    this.scanlineGraphics = new Graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 3) {
      this.scanlineGraphics.rect(0, y, GAME_WIDTH, 1).fill({ color: 0x000000, alpha: 0.06 });
    }
    this.addChild(this.scanlineGraphics);

    // Vignette corners (darkened edges for CRT look)
    this.vignetteGraphics = new Graphics();
    const vigSize = 120;
    this.vignetteGraphics.rect(0, 0, vigSize, vigSize).fill({ color: 0x000000, alpha: 0.15 });
    this.vignetteGraphics.rect(GAME_WIDTH - vigSize, 0, vigSize, vigSize).fill({ color: 0x000000, alpha: 0.15 });
    this.vignetteGraphics.rect(0, GAME_HEIGHT - vigSize, vigSize, vigSize).fill({ color: 0x000000, alpha: 0.15 });
    this.vignetteGraphics.rect(GAME_WIDTH - vigSize, GAME_HEIGHT - vigSize, vigSize, vigSize).fill({ color: 0x000000, alpha: 0.15 });
    this.addChild(this.vignetteGraphics);

    // ─── Decorative readouts ───
    const smallStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 8, fill: TEXT_COLORS.phosphorGreen });
    const smallCyanStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 8, fill: TEXT_COLORS.cyan });
    const tinyStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 7, fill: TEXT_COLORS.phosphorGreen });

    // Coordinate readout (top-right, left of radar area)
    this.coordText = new Text({ text: 'LAT 26.5831N  LON 056.2847E', style: smallCyanStyle });
    this.coordText.position.set(GAME_WIDTH - 380, 12);
    this.coordText.alpha = 0.35;
    this.addChild(this.coordText);

    // Date/time (top-right, below coords)
    this.dateTimeText = new Text({ text: '1988-07-03 14:32:07 UTC', style: smallStyle });
    this.dateTimeText.position.set(GAME_WIDTH - 380, 24);
    this.dateTimeText.alpha = 0.3;
    this.addChild(this.dateTimeText);

    // System status (left side, below HUD)
    this.systemText = new Text({ text: 'SYS: NOMINAL', style: smallStyle });
    this.systemText.position.set(20, 130);
    this.systemText.alpha = 0.3;
    this.addChild(this.systemText);

    // Signal strength (left side, below system)
    this.signalText = new Text({ text: 'SIG:', style: smallStyle });
    this.signalText.position.set(20, 145);
    this.signalText.alpha = 0.3;
    this.addChild(this.signalText);

    this.signalBarGraphics = new Graphics();
    this.signalBarGraphics.position.set(48, 146);
    this.addChild(this.signalBarGraphics);

    // Threat level (left side, below signal)
    this.threatText = new Text({ text: 'THREAT: LOW', style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 8, fill: TEXT_COLORS.amber }) });
    this.threatText.position.set(20, 160);
    this.threatText.alpha = 0.35;
    this.addChild(this.threatText);

    // Frequency readout (right side, below datetime)
    this.freqText = new Text({ text: 'FREQ 243.000 MHz  CH 16', style: tinyStyle });
    this.freqText.position.set(GAME_WIDTH - 380, 36);
    this.freqText.alpha = 0.25;
    this.addChild(this.freqText);

    // Scrolling ticker (bottom, inside border)
    this.tickerText = new Text({ text: TICKER_TEXT, style: tinyStyle });
    this.tickerText.position.set(200, GAME_HEIGHT - 8);
    this.tickerText.alpha = 0.2;
    this.addChild(this.tickerText);
  }

  update(dt: number, run: RunState): void {
    this.timer += dt;

    // Coordinate readout — map player position to lat/lon
    const lon = LON_MIN + (run.playerX / WORLD_WIDTH) * (LON_MAX - LON_MIN);
    const lat = LAT_MAX - (run.playerY / GAME_HEIGHT) * (LAT_MAX - LAT_MIN);
    const lonDeg = Math.floor(lon);
    const lonMin = ((lon - lonDeg) * 60).toFixed(2);
    const latDeg = Math.floor(lat);
    const latMin = ((lat - latDeg) * 60).toFixed(2);
    this.coordText.text = `LAT ${latDeg}\u00B0${String(latMin).padStart(5, '0')}'N  LON 0${lonDeg}\u00B0${String(lonMin).padStart(5, '0')}'E`;

    // Date/time — 1988 era, ticking seconds
    const baseSeconds = 14 * 3600 + 32 * 60 + 7; // 14:32:07
    const totalSec = baseSeconds + Math.floor(this.timer);
    const hh = Math.floor(totalSec / 3600) % 24;
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    this.dateTimeText.text = `1988-07-03 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} UTC`;

    // System status — cycle through labels
    const sysIdx = Math.floor(this.timer / 3) % SYSTEM_LABELS.length;
    this.systemText.text = SYSTEM_LABELS[sysIdx];

    // Signal strength — fluctuating bar
    const sigPct = 0.55 + Math.sin(this.timer * 1.2) * 0.15 + Math.sin(this.timer * 3.7) * 0.08 + Math.sin(this.timer * 7.1) * 0.04;
    const sigClamped = Math.max(0, Math.min(1, sigPct));
    const filledBars = Math.round(sigClamped * 8);
    this.signalText.text = `SIG: ${'█'.repeat(filledBars)}${'░'.repeat(8 - filledBars)} ${Math.round(sigClamped * 100)}%`;

    // Threat level
    const tl = run.threatLevel;
    const threatFilled = Math.min(5, tl);
    const threatLabels = ['NONE', 'LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL'];
    this.threatText.text = `THREAT: ${'█'.repeat(threatFilled)}${'░'.repeat(5 - threatFilled)} ${threatLabels[Math.min(tl, 5)]}`;
    this.threatText.alpha = tl >= 4 ? 0.35 + Math.sin(this.timer * 4) * 0.15 : 0.35;

    // Frequency readout — slowly drift
    const freqBase = 243.0 + Math.sin(this.timer * 0.3) * 0.5;
    const ch = 16 + Math.floor(Math.sin(this.timer * 0.1) * 2);
    this.freqText.text = `FREQ ${freqBase.toFixed(3)} MHz  CH ${ch}`;

    // Scrolling ticker
    const tickerSpeed = 30; // px/sec
    const totalWidth = TICKER_TEXT.length * 4.2; // approx char width at 7px
    const offset = (this.timer * tickerSpeed) % totalWidth;
    this.tickerText.x = 200 - offset;
  }
}
