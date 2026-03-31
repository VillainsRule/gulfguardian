import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import {
  TunableVar, getCategories, getVarsByCategory, exportJSON,
  importJSON, resetAll, getAllVars,
} from './tuning-registry';
import { downloadStatsJSON, getStatsForDisplay, clearStats } from './StatsRecorder';
import { InputManager } from '@/core/input';

const PANEL_X = 40;
const PANEL_Y = 30;
const PANEL_W = GAME_WIDTH - 80;
const PANEL_H = GAME_HEIGHT - 60;
const SIDEBAR_W = 180;
const SLIDER_H = 22;
const SLIDER_GAP = 28;
const SLIDER_AREA_X = PANEL_X + SIDEBAR_W + 20;
const SLIDER_AREA_Y = PANEL_Y + 50;
const SLIDER_W = PANEL_W - SIDEBAR_W - 60;
const TRACK_W = SLIDER_W - 200;
const TRACK_X_OFFSET = 180; // label takes 180px, then track starts
const MAX_VISIBLE_SLIDERS = Math.floor((PANEL_H - 120) / SLIDER_GAP);

interface SliderState {
  tunableVar: TunableVar;
  trackX: number;
  trackY: number;
  labelText: Text;
  valueText: Text;
}

/** Helper to add a non-interactive text that gets cleaned up with sliders */
function dummyTunable(): TunableVar {
  return { key: '_dummy', label: '', category: '', min: 0, max: 0, step: 0, get: () => 0, set: () => {}, default: 0 };
}

export class ControlPanel extends Container {
  private bg: Graphics;
  private panel: Graphics;
  private sliderGraphics: Graphics;
  private categoryTexts: Text[] = [];
  private sliders: SliderState[] = [];
  private activeCategory: string = '';
  private scrollOffset = 0;
  private draggingSlider: SliderState | null = null;

  // Auto-play controls
  public autoPlayEnabled = false;
  public smartness = 0.5;
  public batchCount = 5;
  public gameSpeed = 1;
  private autoPlayToggleText: Text | null = null;
  private smartnessSlider: SliderState | null = null;

  // Input-based interaction regions
  private categoryRegions: { name: string; x: number; y: number; w: number; h: number }[] = [];
  private buttonRegions: { x: number; y: number; w: number; h: number; action: () => void }[] = [];
  private bottomButtonRegions: { x: number; y: number; w: number; h: number; action: () => void }[] = [];
  private selectedIndex = 0; // keyboard navigation index (categories)
  private allCategoryNames: string[] = [];
  private inputDragging = false;
  private focusedSlider: SliderState | null = null;

  // Status feedback
  private statusText: Text | null = null;
  private statusTimer = 0;

  // Callbacks
  public onAutoPlayToggle: (() => void) | null = null;
  public onBatchRun: ((count: number) => void) | null = null;
  public onViewStats: (() => void) | null = null;
  public onGameSpeedChange: ((speed: number) => void) | null = null;
  public onClose: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'static';

    // Dark overlay background
    this.bg = new Graphics();
    this.bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.88 });
    this.bg.eventMode = 'static';
    this.bg.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.handlePointerDown(e.globalX, e.globalY);
    });
    this.addChild(this.bg);

    // Panel border
    this.panel = new Graphics();
    this.addChild(this.panel);

    // Slider area
    this.sliderGraphics = new Graphics();
    this.addChild(this.sliderGraphics);

    // Title
    const title = new Text({
      text: 'TESTING CONTROL PANEL',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
    });
    title.position.set(PANEL_X + 15, PANEL_Y + 10);
    this.addChild(title);

    // Build bottom buttons
    this.buildBottomButtons();

    // Pointer events for slider dragging — must be on bg since it stops propagation
    this.bg.on('pointermove', this.onPointerMove, this);
    this.bg.on('pointerup', this.onPointerUp, this);
    this.bg.on('pointerupoutside', this.onPointerUp, this);

    // Scroll wheel
    this.bg.on('wheel', (e: WheelEvent) => {
      this.scrollOffset = Math.max(0, this.scrollOffset + (e.deltaY > 0 ? 1 : -1));
      this.refreshSliders();
    });
  }

  show(): void {
    this.visible = true;
    this.buildCategories();
    const cats = getCategories();
    if (cats.length > 0 && !this.activeCategory) {
      this.activeCategory = cats[0];
    }
    // Sync keyboard selection index
    const idx = this.allCategoryNames.indexOf(this.activeCategory);
    if (idx >= 0) this.selectedIndex = idx;
    this.refreshSliders();
    this.drawPanel();
  }

  hide(): void {
    this.visible = false;
    this.inputDragging = false;
    this.draggingSlider = null;
  }

  private buildCategories(): void {
    // Remove old
    for (const t of this.categoryTexts) {
      this.removeChild(t);
      t.destroy();
    }
    this.categoryTexts = [];
    this.categoryRegions = [];

    const cats = getCategories();
    // Add virtual categories
    const allCats = [...cats, 'Auto-Play', 'Stats'];
    this.allCategoryNames = allCats;

    let y = PANEL_Y + 50;
    for (const cat of allCats) {
      const isActive = cat === this.activeCategory;
      const t = new Text({
        text: (isActive ? '> ' : '  ') + cat,
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          fill: isActive ? TEXT_COLORS.phosphorGreen : TEXT_COLORS.amber,
        }),
      });
      t.position.set(PANEL_X + 10, y);
      t.eventMode = 'static';
      t.cursor = 'pointer';
      t.on('pointerdown', () => {
        this.selectCategory(cat);
      });
      this.addChild(t);
      this.categoryTexts.push(t);
      this.categoryRegions.push({ name: cat, x: PANEL_X, y, w: SIDEBAR_W, h: 20 });
      y += 20;
    }
  }

  private selectCategory(cat: string): void {
    this.activeCategory = cat;
    this.scrollOffset = 0;
    const idx = this.allCategoryNames.indexOf(cat);
    if (idx >= 0) this.selectedIndex = idx;
    this.buildCategories();
    this.refreshSliders();
  }

  private refreshSliders(): void {
    // Clean up old slider texts
    for (const s of this.sliders) {
      this.removeChild(s.labelText);
      this.removeChild(s.valueText);
      s.labelText.destroy();
      s.valueText.destroy();
    }
    this.sliders = [];
    this.buttonRegions = [...this.bottomButtonRegions];
    this.focusedSlider = null;

    if (this.activeCategory === 'Auto-Play') {
      this.buildAutoPlayControls();
      this.drawSliders();
      return;
    }

    if (this.activeCategory === 'Stats') {
      this.buildStatsView();
      this.drawSliders();
      return;
    }

    const vars = getVarsByCategory(this.activeCategory);
    const startIdx = this.scrollOffset;
    const visible = vars.slice(startIdx, startIdx + MAX_VISIBLE_SLIDERS);

    let y = SLIDER_AREA_Y;
    for (const v of visible) {
      const labelText = new Text({
        text: v.label,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.cyan }),
      });
      labelText.position.set(SLIDER_AREA_X, y + 3);
      this.addChild(labelText);

      const valueText = new Text({
        text: this.formatValue(v.get(), v.step),
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.phosphorGreen }),
      });
      valueText.position.set(SLIDER_AREA_X + TRACK_X_OFFSET + TRACK_W + 10, y + 3);
      this.addChild(valueText);

      this.sliders.push({
        tunableVar: v,
        trackX: SLIDER_AREA_X + TRACK_X_OFFSET,
        trackY: y,
        labelText,
        valueText,
      });
      y += SLIDER_GAP;
    }

    // Scroll indicator
    if (vars.length > MAX_VISIBLE_SLIDERS) {
      const scrollText = new Text({
        text: `[${startIdx + 1}-${Math.min(startIdx + MAX_VISIBLE_SLIDERS, vars.length)} of ${vars.length}] Scroll to see more`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.amber }),
      });
      scrollText.position.set(SLIDER_AREA_X, y + 5);
      this.addChild(scrollText);
      this.sliders.push({
        tunableVar: dummyTunable(),
        trackX: -1000, trackY: -1000,
        labelText: scrollText,
        valueText: new Text({ text: '' }),
      });
    }

    this.drawSliders();
    this.focusedSlider = this.sliders.find(s => s.trackX >= 0) ?? null;
  }

  private addTextElement(text: string, x: number, y: number, color: string, fontSize = 11): Text {
    const t = new Text({
      text,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize, fill: color }),
    });
    t.position.set(x, y);
    this.addChild(t);
    this.sliders.push({ tunableVar: dummyTunable(), trackX: -1000, trackY: -1000, labelText: t, valueText: new Text({ text: '' }) });
    return t;
  }

  private addButton(text: string, x: number, y: number, color: string, action: () => void, fontSize = 14): Text {
    const btn = new Text({
      text: `[ ${text} ]`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize, fontWeight: 'bold', fill: color }),
    });
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    // Click handled by handleInput() via buttonRegions — no Pixi pointerdown
    // to avoid double-firing toggle actions (e.g. auto-play button)
    this.addChild(btn);
    this.sliders.push({ tunableVar: dummyTunable(), trackX: -1000, trackY: -1000, labelText: btn, valueText: new Text({ text: '' }) });
    // Track region for InputManager-based click detection
    const estW = text.length * fontSize * 0.65 + 20;
    this.buttonRegions.push({ x, y, w: estW, h: fontSize + 6, action });
    return btn;
  }

  private addSlider(tunableVar: TunableVar, x: number, y: number): SliderState {
    const labelText = new Text({
      text: tunableVar.label,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.cyan }),
    });
    labelText.position.set(x, y + 3);
    this.addChild(labelText);

    const valueText = new Text({
      text: this.formatValue(tunableVar.get(), tunableVar.step),
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.phosphorGreen }),
    });
    valueText.position.set(x + TRACK_X_OFFSET + TRACK_W + 10, y + 3);
    this.addChild(valueText);

    const slider: SliderState = {
      tunableVar,
      trackX: x + TRACK_X_OFFSET,
      trackY: y,
      labelText,
      valueText,
    };
    this.sliders.push(slider);
    return slider;
  }

  private buildAutoPlayControls(): void {
    let y = SLIDER_AREA_Y;

    // ── Sliders ──

    // AI Smartness
    this.smartnessSlider = this.addSlider({
      key: '_autoplay.smartness', label: 'AI Smartness', category: 'Auto-Play',
      min: 0, max: 1, step: 0.05,
      get: () => this.smartness, set: (v) => { this.smartness = v; },
      default: 0.5,
    }, SLIDER_AREA_X, y);
    y += SLIDER_GAP;

    // Batch count
    this.addSlider({
      key: '_autoplay.batchCount', label: 'Batch Run Count', category: 'Auto-Play',
      min: 1, max: 100, step: 1,
      get: () => this.batchCount, set: (v) => { this.batchCount = v; },
      default: 5,
    }, SLIDER_AREA_X, y);
    y += SLIDER_GAP;

    // Game speed multiplier
    this.addSlider({
      key: '_autoplay.gameSpeed', label: 'Game Speed', category: 'Auto-Play',
      min: 1, max: 5, step: 1,
      get: () => this.gameSpeed, set: (v) => { this.gameSpeed = v; if (this.onGameSpeedChange) this.onGameSpeedChange(v); },
      default: 1,
    }, SLIDER_AREA_X, y);
    y += SLIDER_GAP * 1.5;

    // ── Buttons ──

    // Toggle auto-play
    const toggleText = this.autoPlayEnabled ? 'STOP AUTO-PLAY' : 'START AUTO-PLAY';
    const toggleColor = this.autoPlayEnabled ? TEXT_COLORS.red : TEXT_COLORS.phosphorGreen;
    this.autoPlayToggleText = this.addButton(toggleText, SLIDER_AREA_X, y, toggleColor, () => {
      if (this.onAutoPlayToggle) this.onAutoPlayToggle();
      this.refreshSliders();
    });
    y += SLIDER_GAP * 1.3;

    // Batch run
    this.addButton(`RUN ${this.batchCount} AUTO GAMES`, SLIDER_AREA_X, y, TEXT_COLORS.amber, () => {
      if (this.onBatchRun) this.onBatchRun(this.batchCount);
    });
    y += SLIDER_GAP * 1.6;

    // ── Quick stats summary ──
    const statsData = getStatsForDisplay();
    this.addTextElement('--- RECENT STATS ---', SLIDER_AREA_X, y, TEXT_COLORS.cyan, 12);
    y += 18;
    for (const line of statsData.summary) {
      this.addTextElement(line, SLIDER_AREA_X, y, TEXT_COLORS.phosphorGreen, 10);
      y += 14;
    }

    if (statsData.runs.length > 0) {
      y += 6;
      const maxRuns = Math.min(statsData.runs.length, 6);
      const recentRuns = statsData.runs.slice(-maxRuns);
      for (const line of recentRuns) {
        const color = line.includes('WIN') ? TEXT_COLORS.phosphorGreen : TEXT_COLORS.red;
        this.addTextElement(line, SLIDER_AREA_X, y, color, 9);
        y += 13;
      }
    }
  }

  private buildStatsView(): void {
    let y = SLIDER_AREA_Y;

    this.addTextElement('AUTO-PLAY STATISTICS', SLIDER_AREA_X, y, TEXT_COLORS.cyan, 14);
    y += 24;

    const statsData = getStatsForDisplay();

    // Summary section
    for (const line of statsData.summary) {
      this.addTextElement(line, SLIDER_AREA_X, y, TEXT_COLORS.phosphorGreen, 11);
      y += 16;
    }
    y += 10;

    // Run history (scrollable)
    if (statsData.runs.length > 0) {
      this.addTextElement('--- RUN HISTORY ---', SLIDER_AREA_X, y, TEXT_COLORS.cyan, 11);
      y += 16;

      const startIdx = this.scrollOffset;
      const maxVisible = Math.floor((PANEL_H - 120 - (y - SLIDER_AREA_Y)) / 14);
      const visible = statsData.runs.slice(startIdx, startIdx + maxVisible);

      for (const line of visible) {
        const color = line.includes('WIN') ? TEXT_COLORS.phosphorGreen : TEXT_COLORS.red;
        this.addTextElement(line, SLIDER_AREA_X, y, color, 10);
        y += 14;
      }

      if (statsData.runs.length > maxVisible) {
        this.addTextElement(
          `[${startIdx + 1}-${Math.min(startIdx + maxVisible, statsData.runs.length)} of ${statsData.runs.length}] Scroll to see more`,
          SLIDER_AREA_X, y + 5, TEXT_COLORS.amber, 10,
        );
      }
    }

    // Buttons at the bottom of stats area
    y = PANEL_Y + PANEL_H - 80;
    this.addButton('DOWNLOAD STATS JSON', SLIDER_AREA_X, y, TEXT_COLORS.amber, () => downloadStatsJSON(), 12);
    this.addButton('CLEAR ALL STATS', SLIDER_AREA_X + 280, y, TEXT_COLORS.red, () => {
      clearStats();
      this.refreshSliders();
    }, 12);
  }

  private drawPanel(): void {
    this.panel.clear();
    // Panel bg
    this.panel.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H)
      .fill({ color: COLORS.panelBg, alpha: 0.95 })
      .stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.8 });
    // Sidebar divider
    this.panel.moveTo(PANEL_X + SIDEBAR_W, PANEL_Y + 45)
      .lineTo(PANEL_X + SIDEBAR_W, PANEL_Y + PANEL_H - 40)
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
    // Bottom divider
    this.panel.moveTo(PANEL_X, PANEL_Y + PANEL_H - 40)
      .lineTo(PANEL_X + PANEL_W, PANEL_Y + PANEL_H - 40)
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
  }

  private drawSliders(): void {
    this.sliderGraphics.clear();

    for (const s of this.sliders) {
      if (s.trackX < 0) continue; // Not a real slider
      const v = s.tunableVar;
      const ratio = (v.get() - v.min) / (v.max - v.min);

      // Track background
      this.sliderGraphics.rect(s.trackX, s.trackY + 4, TRACK_W, SLIDER_H - 8)
        .fill({ color: 0x002200, alpha: 0.8 })
        .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });

      // Filled portion
      this.sliderGraphics.rect(s.trackX + 1, s.trackY + 5, (TRACK_W - 2) * ratio, SLIDER_H - 10)
        .fill({ color: COLORS.phosphorGreen, alpha: 0.35 });

      // Handle
      const handleX = s.trackX + TRACK_W * ratio;
      this.sliderGraphics.rect(handleX - 3, s.trackY + 2, 6, SLIDER_H - 4)
        .fill({ color: COLORS.phosphorGreen, alpha: 0.9 });
    }
  }

  private buildBottomButtons(): void {
    const btnY = PANEL_Y + PANEL_H - 30;
    const btnStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.amber });
    const buttons = [
      { text: '[ EXPORT JSON ]', x: PANEL_X + 20, action: () => this.doExport() },
      { text: '[ IMPORT JSON ]', x: PANEL_X + 180, action: () => this.doImport() },
      { text: '[ RESET VARS ]', x: PANEL_X + 340, action: () => { resetAll(); this.refreshSliders(); } },
      { text: '[ CLOSE ]', x: PANEL_X + 490, action: () => { if (this.onClose) this.onClose(); else this.hide(); } },
    ];

    for (const btn of buttons) {
      const t = new Text({ text: btn.text, style: btnStyle });
      t.position.set(btn.x, btnY);
      this.addChild(t);
      const estW = btn.text.length * 12 * 0.65 + 20;
      const region = { x: btn.x, y: btnY, w: estW, h: 18, action: btn.action };
      this.buttonRegions.push(region);
      this.bottomButtonRegions.push(region);
    }

    // Hint text
    const hint = new Text({
      text: '` close | ! export',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.phosphorGreen }),
    });
    hint.position.set(PANEL_X + PANEL_W - 155, btnY + 2);
    this.addChild(hint);
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.draggingSlider) return;
    const local = this.toLocal(e.global);
    this.updateSliderFromPointer(this.draggingSlider, local.x);
  }

  private onPointerUp(): void {
    this.draggingSlider = null;
  }

  /** Called from external pointerdown event — check if hitting a slider track */
  handlePointerDown(globalX: number, globalY: number): void {
    const local = this.toLocal({ x: globalX, y: globalY });
    for (const s of this.sliders) {
      if (s.trackX < 0) continue;
      if (local.x >= s.trackX && local.x <= s.trackX + TRACK_W &&
          local.y >= s.trackY && local.y <= s.trackY + SLIDER_H) {
        this.draggingSlider = s;
        this.focusedSlider = s;
        this.updateSliderFromPointer(s, local.x);
        return;
      }
    }
  }

  private updateSliderFromPointer(s: SliderState, localX: number): void {
    const v = s.tunableVar;
    let ratio = (localX - s.trackX) / TRACK_W;
    ratio = Math.max(0, Math.min(1, ratio));
    let val = v.min + ratio * (v.max - v.min);
    // Snap to step
    val = Math.round(val / v.step) * v.step;
    val = Math.max(v.min, Math.min(v.max, val));
    v.set(val);
    s.valueText.text = this.formatValue(val, v.step);
    this.drawSliders();
  }

  private formatValue(val: number, step: number): string {
    if (step >= 1) return String(Math.round(val));
    if (step >= 0.1) return val.toFixed(1);
    if (step >= 0.01) return val.toFixed(2);
    return val.toFixed(3);
  }

  private doExport(): void {
    const json = exportJSON();
    console.log('=== TUNING CONFIG ===');
    console.log(json);

    // Download as JSON file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuning-config-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also copy to clipboard
    let clipboardOk = false;
    try {
      navigator.clipboard.writeText(json);
      clipboardOk = true;
    } catch {
      // Clipboard may not be available
    }

    this.showStatus(clipboardOk ? 'EXPORTED & COPIED TO CLIPBOARD' : 'EXPORTED JSON FILE');
  }

  private doImport(): void {
    const json = prompt('Paste tuning JSON:');
    if (json) {
      try {
        importJSON(json);
        this.refreshSliders();
        console.log('Tuning config imported successfully');
      } catch (e) {
        console.error('Failed to import tuning config:', e);
      }
    }
  }

  private showStatus(message: string): void {
    const btnY = PANEL_Y + PANEL_H - 30;
    if (!this.statusText) {
      this.statusText = new Text({
        text: message,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
      });
      this.statusText.position.set(PANEL_X + PANEL_W - 300, btnY - 16);
      this.addChild(this.statusText);
    } else {
      this.statusText.text = message;
      this.statusText.visible = true;
    }
    this.statusTimer = 120; // ~2 seconds at 60fps
  }

  showStatsOverlay(): void {
    if (this.onViewStats) this.onViewStats();
  }

  /** Handle input via InputManager — keyboard navigation + mouse click fallback */
  handleInput(input: InputManager): void {
    if (!this.visible) return;

    // Status feedback countdown
    if (this.statusTimer > 0) {
      this.statusTimer--;
      if (this.statusTimer <= 0 && this.statusText) {
        this.statusText.visible = false;
      }
    }

    // Shift+1 = '!' — export JSON
    if (input.wasJustPressed('Digit1') && (input.isDown('ShiftLeft') || input.isDown('ShiftRight'))) {
      this.doExport();
      return;
    }

    // ── Keyboard navigation ──
    if (input.wasJustPressed('ArrowUp')) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.selectCategory(this.allCategoryNames[this.selectedIndex]);
      return;
    }
    if (input.wasJustPressed('ArrowDown')) {
      this.selectedIndex = Math.min(this.allCategoryNames.length - 1, this.selectedIndex + 1);
      this.selectCategory(this.allCategoryNames[this.selectedIndex]);
      return;
    }

    // Left/Right arrows adjust active slider values
    if (input.wasJustPressed('ArrowLeft') || input.wasJustPressed('ArrowRight')) {
      if (!this.focusedSlider || this.focusedSlider.trackX < 0) return;
      const dir = input.wasJustPressed('ArrowRight') ? 1 : -1;
      const s = this.focusedSlider;
      const v = s.tunableVar;
      let val = v.get() + v.step * dir;
      val = Math.max(v.min, Math.min(v.max, val));
      v.set(val);
      s.valueText.text = this.formatValue(val, v.step);
      this.drawSliders();
      return;
    }

    // Scroll wheel via keyboard (Page Up/Down)
    if (input.wasJustPressed('PageUp')) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 5);
      this.refreshSliders();
      return;
    }
    if (input.wasJustPressed('PageDown')) {
      this.scrollOffset += 5;
      this.refreshSliders();
      return;
    }

    // ── Mouse click fallback via InputManager ──
    const mousePos = input.getGameMousePos();
    const mx = mousePos.x;
    const my = mousePos.y;

    if (input.consumeClick()) {
      // Check category regions
      for (const r of this.categoryRegions) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          this.selectCategory(r.name);
          return;
        }
      }
      // Check button regions
      for (const r of this.buttonRegions) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          r.action();
          return;
        }
      }
      // Check slider tracks
      for (const s of this.sliders) {
        if (s.trackX < 0) continue;
        if (mx >= s.trackX && mx <= s.trackX + TRACK_W &&
            my >= s.trackY && my <= s.trackY + SLIDER_H) {
          this.draggingSlider = s;
          this.focusedSlider = s;
          this.inputDragging = true;
          this.updateSliderFromPointer(s, mx);
          return;
        }
      }
    }

    // Handle drag via InputManager
    if (this.inputDragging && this.draggingSlider) {
      if (input.isMouseDown()) {
        this.updateSliderFromPointer(this.draggingSlider, mx);
      } else {
        this.draggingSlider = null;
        this.inputDragging = false;
      }
    }
  }
}
