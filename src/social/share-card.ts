import { FONT_FAMILY } from '@/app/constants';
import type { RunState } from '@/core/run-state';

const CARD_W = 640;
const CARD_H = 360;
const BG = '#000000';
const GREEN = '#00ff41';
const CYAN = '#00e5ff';
const AMBER = '#ffaa00';
const RED = '#ff3333';
const DARK_GREEN = '#001a00';
const GRID_COLOR = '#002200';

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  const spacing = 20;
  for (let x = 0; x < CARD_W; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_H);
    ctx.stroke();
  }
  for (let y = 0; y < CARD_H; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawScanlines(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000000';
  for (let y = 0; y < CARD_H; y += 3) {
    ctx.globalAlpha = 0.08;
    ctx.fillRect(0, y, CARD_W, 1);
  }
  ctx.globalAlpha = 1;
}

function drawBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.strokeRect(8, 8, CARD_W - 16, CARD_H - 16);
  ctx.globalAlpha = 0.3;
  ctx.strokeRect(12, 12, CARD_W - 24, CARD_H - 24);
  ctx.globalAlpha = 1;
}

function setFont(ctx: CanvasRenderingContext2D, size: number, bold: boolean = false): void {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`;
}

export function getShareCardTitle(isDaily: boolean, dailyNumber?: number): string {
  if (isDaily && dailyNumber != null) return `GULF GUARDIAN — DAILY #${dailyNumber}`;
  return 'GULF GUARDIAN — MISSION REPORT';
}

export function generateShareCard(run: RunState, isDaily: boolean, dailyNumber?: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle vignette
  const grad = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 100, CARD_W / 2, CARD_H / 2, CARD_W * 0.7);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Grid
  drawGrid(ctx);

  // Panel background
  ctx.fillStyle = DARK_GREEN;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(20, 20, CARD_W - 40, CARD_H - 40);
  ctx.globalAlpha = 1;

  // Border
  drawBorder(ctx);

  // Title
  ctx.textAlign = 'center';
  setFont(ctx, 18, true);
  ctx.fillStyle = GREEN;
  ctx.fillText(getShareCardTitle(isDaily, dailyNumber), CARD_W / 2, 52);

  // Separator
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(40, 64);
  ctx.lineTo(CARD_W - 40, 64);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Outcome
  const isVictory = run.missionOutcome === 'victory';
  const outcomeText = isVictory ? 'CONVOY DELIVERED ✓' : 'MISSION FAILED ✗';
  setFont(ctx, 22, true);
  ctx.fillStyle = isVictory ? GREEN : RED;
  ctx.fillText(outcomeText, CARD_W / 2, 100);

  // Score
  setFont(ctx, 28, true);
  ctx.fillStyle = CYAN;
  ctx.fillText(String(run.score).padStart(8, '0'), CARD_W / 2, 140);

  // Stats grid — two columns
  ctx.textAlign = 'left';
  setFont(ctx, 14, false);
  const leftX = 50;
  const rightX = CARD_W / 2 + 20;
  let y = 175;
  const lineH = 28;

  // Left column
  ctx.fillStyle = AMBER;
  ctx.fillText('CONVOY', leftX, y);
  ctx.fillStyle = GREEN;
  ctx.fillText(`${run.tankersSaved}/${run.totalConvoyTankers} delivered`, leftX + 100, y);

  ctx.fillStyle = AMBER;
  ctx.fillText('KILLS', leftX, y + lineH);
  ctx.fillStyle = GREEN;
  ctx.fillText(`${run.enemiesDestroyed}`, leftX + 100, y + lineH);

  ctx.fillStyle = AMBER;
  ctx.fillText('TIME', leftX, y + lineH * 2);
  ctx.fillStyle = GREEN;
  ctx.fillText(`${Math.floor(run.missionTime)}s`, leftX + 100, y + lineH * 2);

  // Right column
  ctx.fillStyle = AMBER;
  ctx.fillText('BEST COMBO', rightX, y);
  ctx.fillStyle = GREEN;
  ctx.fillText(`${run.bestCombo}x`, rightX + 130, y);

  ctx.fillStyle = AMBER;
  ctx.fillText('SECTORS', rightX, y + lineH);
  ctx.fillStyle = GREEN;
  ctx.fillText(`${run.wave}/5`, rightX + 130, y + lineH);

  const oilColor = run.oilPrice <= 72 ? GREEN : run.oilPrice <= 90 ? AMBER : RED;
  ctx.fillStyle = AMBER;
  ctx.fillText('OIL PRICE', rightX, y + lineH * 2);
  ctx.fillStyle = oilColor;
  ctx.fillText(`$${Math.round(run.oilPrice)}/bbl`, rightX + 130, y + lineH * 2);

  // Bottom separator
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(40, CARD_H - 70);
  ctx.lineTo(CARD_W - 40, CARD_H - 70);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Footer
  ctx.textAlign = 'center';
  setFont(ctx, 12, false);
  ctx.fillStyle = GREEN;
  ctx.globalAlpha = 0.6;
  ctx.fillText('gulfguardian.io  |  #GulfGuardian', CARD_W / 2, CARD_H - 45);
  ctx.globalAlpha = 1;

  // Challenge prompt
  setFont(ctx, 13, true);
  ctx.fillStyle = CYAN;
  ctx.fillText('CAN YOU BEAT MY SCORE?', CARD_W / 2, CARD_H - 25);

  // Scanlines (last, on top)
  drawScanlines(ctx);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate share card'));
    }, 'image/png');
  });
}
