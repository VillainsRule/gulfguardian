import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { getRun } from '@/core/run-state';
import { generateShareCard } from '@/social/share-card';
import { encodeChallengeUrl } from '@/social/challenge-url';
import { buildShareText, buildShareTextShort } from '@/social/share-text';

// ─── Clipboard utilities ───

/** Copy text to clipboard with fallback for older browsers. Returns promise resolving to success. */
export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
  }
  return Promise.resolve(legacyCopy(text));
}

export function legacyCopy(text: string): boolean {
  let ta: HTMLTextAreaElement | null = null;
  try {
    ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (ta?.parentNode) {
      ta.parentNode.removeChild(ta);
    }
  }
}

// ─── Share panel ───

export interface SharePanelState {
  container: Container;
  btnRects: Array<{ x: number; y: number; w: number; h: number; action: string }>;
  btnTexts: Text[];
  btnBgs: Graphics[];
  confirmTimers: Map<string, number>;
  isOpen: boolean;
}

export function createSharePanel(): SharePanelState {
  const panelW = 360;
  const panelH = 280;
  const panelX = (GAME_WIDTH - panelW) / 2;
  const panelY = (GAME_HEIGHT - panelH) / 2;
  const btnW = 280;
  const btnH = 40;
  const btnGap = 12;
  const btnStartY = panelY + 60;
  const btnX = panelX + (panelW - btnW) / 2;

  const panel = new Container();

  // Dimmed overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.6 });
  panel.addChild(overlay);

  // Panel background
  const bg = new Graphics();
  bg.rect(panelX, panelY, panelW, panelH).fill({ color: COLORS.panelBg, alpha: 0.95 });
  bg.rect(panelX, panelY, panelW, panelH).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.8 });
  panel.addChild(bg);

  // Title
  const title = new Text({
    text: '— SHARE RESULTS —',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
  });
  title.anchor.set(0.5);
  title.position.set(GAME_WIDTH / 2, panelY + 30);
  panel.addChild(title);

  // Button definitions
  const buttons: Array<{ label: string; color: number; textColor: string; action: string }> = [
    { label: '[ TWITTER / X ]', color: COLORS.cyan, textColor: TEXT_COLORS.cyan, action: 'twitter' },
    { label: '[ COPY TEXT ]', color: COLORS.phosphorGreen, textColor: TEXT_COLORS.phosphorGreen, action: 'copy' },
    { label: '[ SAVE IMAGE ]', color: COLORS.amber, textColor: TEXT_COLORS.amber, action: 'save' },
    { label: '[ CLOSE ]', color: COLORS.phosphorGreen, textColor: TEXT_COLORS.phosphorGreen, action: 'close' },
  ];

  const btnRects: SharePanelState['btnRects'] = [];
  const btnTexts: Text[] = [];
  const btnBgs: Graphics[] = [];

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const by = btnStartY + i * (btnH + btnGap);

    const btnBg = new Graphics();
    panel.addChild(btnBg);
    btnBgs.push(btnBg);

    const btnText = new Text({
      text: btn.label,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: btn.textColor }),
    });
    btnText.anchor.set(0.5);
    btnText.position.set(btnX + btnW / 2, by + btnH / 2);
    panel.addChild(btnText);
    btnTexts.push(btnText);

    btnRects.push({ x: btnX, y: by, w: btnW, h: btnH, action: btn.action });
  }

  return {
    container: panel,
    btnRects,
    btnTexts,
    btnBgs,
    confirmTimers: new Map(),
    isOpen: true,
  };
}

export function dismissSharePanel(state: SharePanelState, stage: Container): void {
  state.isOpen = false;
  stage.removeChild(state.container);
  state.container.destroy({ children: true });
}

export function setSharePanelBtnFeedback(state: SharePanelState, action: string, label: string): void {
  if (state.isOpen === false || state.container?.destroyed) return;
  const idx = state.btnRects.findIndex(b => b.action === action);
  if (idx >= 0 && state.btnTexts[idx]) {
    state.btnTexts[idx].text = label;
    state.confirmTimers.set(action, 1.5);
  }
}

export function handleSharePanelAction(
  action: string,
  state: SharePanelState,
  stage: Container,
  isDaily: boolean,
  dailyNumber: number | null,
  isVictory: boolean,
): boolean {
  const run = getRun();

  if (action === 'twitter') {
    const shortText = buildShareTextShort(run, isDaily, dailyNumber, isVictory);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}`;
    const popup = window.open(tweetUrl, '_blank', 'noopener');
    setSharePanelBtnFeedback(state, 'twitter', popup ? '[ OPENED! ]' : '[ POPUP BLOCKED ]');
  } else if (action === 'copy') {
    const text = buildShareText(run, isDaily, dailyNumber, isVictory);
    copyToClipboard(text).then((ok) => {
      if (state.isOpen === false) return;
      setSharePanelBtnFeedback(state, 'copy', ok ? '[ COPIED! ]' : '[ FAILED ]');
    });
  } else if (action === 'save') {
    setSharePanelBtnFeedback(state, 'save', '[ SAVING... ]');
    generateShareCard(run, isDaily, dailyNumber ?? undefined)
      .then((blob) => {
        if (state.isOpen === false) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gulf-guardian.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setSharePanelBtnFeedback(state, 'save', '[ SAVED! ]');
      })
      .catch(() => {
        if (state.isOpen === false) return;
        setSharePanelBtnFeedback(state, 'save', '[ FAILED ]');
      });
  } else if (action === 'close') {
    dismissSharePanel(state, stage);
    return true; // signals panel was closed
  }
  return false;
}

// ─── Challenge sharing ───

export interface ChallengeShareResult {
  label: string;
  confirmTimer: number;
}

export function shareChallenge(): Promise<ChallengeShareResult> {
  const run = getRun();
  const url = encodeChallengeUrl(run.seed, run.score);
  const text = `Can you beat my score of ${String(run.score).padStart(8, '0')} in Gulf Guardian?\n${url}\n#GulfGuardian`;

  if (navigator.share) {
    return navigator.share({
      title: 'Gulf Guardian Challenge',
      text: `Can you beat my score of ${String(run.score).padStart(8, '0')} in Gulf Guardian?`,
      url: url,
    }).then(() => {
      return { label: '[ SENT! ]', confirmTimer: 1.5 };
    }).catch((err: unknown) => {
      if (isUserCanceledShare(err)) {
        return { label: '[ CANCELLED ]', confirmTimer: 1.5 };
      }
      return copyChallenge(text);
    });
  }
  return copyChallenge(text);
}

function isUserCanceledShare(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'AbortError';
}

function copyChallenge(text: string): Promise<ChallengeShareResult> {
  return copyToClipboard(text).then((ok) => ({
    label: ok ? '[ COPIED! ]' : '[ FAILED ]',
    confirmTimer: 1.5,
  }));
}
