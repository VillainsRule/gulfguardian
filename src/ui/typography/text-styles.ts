import { TextStyle } from 'pixi.js';
import { FONT_FAMILY, TEXT_COLORS } from '@/app/constants';

/** Resolution multiplier for text that may be zoomed — keeps text crisp at higher zoom levels */
export const TEXT_RESOLUTION = typeof window !== 'undefined'
  ? Math.max(2, window.devicePixelRatio || 1)
  : 2;

export const titleStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 48,
  fontWeight: 'bold',
  fontStyle: 'italic',
  fill: TEXT_COLORS.phosphorGreen,
  letterSpacing: 4,
});

export const headingStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 24,
  fontWeight: 'bold',
  fill: TEXT_COLORS.phosphorGreen,
});

export const bodyStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 15,
  fill: TEXT_COLORS.phosphorGreen,
});

export const blinkingStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 18,
  fontWeight: 'bold',
  fill: TEXT_COLORS.cyan,
  letterSpacing: 2,
});

export const hudStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: 14,
  fill: TEXT_COLORS.phosphorGreen,
});
