import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { WORLD_WIDTH } from '@/core/run-state';
import { getQuality } from '@/app/quality';
import {
  type MapCoord,
  ISLANDS,
  getIranCoast,
  getOmanCoast,
  getCoastY,
  COAST_STEP,
} from './map-data';

// Re-export all public symbols from map-data for backward compatibility
export {
  type IslandDef,
  type MapCoord,
  ISLANDS,
  getIslandCollision,
  pushOutOfIsland,
  pushOffCoast,
  isInChannel,
  clampToChannel,
  getIranCoastY,
} from './map-data';

/**
 * Draw the extended geographic context visible during the opening zoom.
 * These elements are drawn outside the 0–720 gameplay area and only appear
 * when the camera is zoomed out (scale < 1).
 */
function drawExtendedGeography(g: Graphics, mapLayer: Container): void {
  const EXT_TOP = -1900;   // north extent (Iran interior)
  const EXT_BOTTOM = 2500;  // south extent (Arabian Peninsula)
  const EXT_LEFT = -200;
  const EXT_RIGHT = WORLD_WIDTH + 200;

  // ─── Extended background (ocean) ───
  g.rect(EXT_LEFT, EXT_TOP, EXT_RIGHT - EXT_LEFT, EXT_BOTTOM - EXT_TOP)
    .fill({ color: COLORS.bgBlack });

  // ─── Iran landmass (extends north from existing coastline) ───
  // Large filled area representing Iran's interior
  const iranCoast = getIranCoast();
  const iranExtPts: number[] = [];
  // Start at top-left corner
  iranExtPts.push(EXT_LEFT, EXT_TOP);
  iranExtPts.push(EXT_RIGHT, EXT_TOP);
  // Follow right edge down to Iran coast
  iranExtPts.push(EXT_RIGHT, iranCoast[iranCoast.length - 1].y);
  // Follow Iran coastline right to left (reversed)
  for (let i = iranCoast.length - 1; i >= 0; i--) {
    iranExtPts.push(iranCoast[i].x, iranCoast[i].y);
  }
  // Close back to top-left
  iranExtPts.push(EXT_LEFT, iranCoast[0].y);
  g.poly(iranExtPts).fill({ color: COLORS.panelBg, alpha: 0.25 });

  // ─── Arabian Peninsula / UAE / Oman (extends south from existing coastline) ───
  const omanCoast = getOmanCoast();

  // More detailed Arabian Peninsula polygon with Qatar peninsula and Saudi coast
  const arabExtPts: number[] = [];
  // Follow Oman coastline left to right
  arabExtPts.push(EXT_LEFT, omanCoast[0].y);
  for (const p of omanCoast) {
    arabExtPts.push(p.x, p.y);
  }
  arabExtPts.push(EXT_RIGHT, omanCoast[omanCoast.length - 1].y);
  // Oman coast curves south-southeast toward Muscat
  arabExtPts.push(EXT_RIGHT, 900);
  arabExtPts.push(7600, 1000);
  arabExtPts.push(7200, 1200);
  arabExtPts.push(7000, 1500);
  // Bottom edge
  arabExtPts.push(7000, EXT_BOTTOM);
  arabExtPts.push(EXT_LEFT, EXT_BOTTOM);
  g.poly(arabExtPts).fill({ color: COLORS.panelBg, alpha: 0.25 });

  // ─── Qatar peninsula (small bump on southern coast, far west) ───
  const qatarPts = [
    -200, 1600,
    -300, 1400,
    -350, 1200,
    -300, 1050,
    -200, 950,
    -100, 1050,
    -50, 1200,
    -100, 1400,
    -200, 1600,
  ];
  g.poly(qatarPts).fill({ color: COLORS.panelBg, alpha: 0.22 });
  g.poly(qatarPts).stroke({ width: 0.8, color: COLORS.phosphorGreen, alpha: 0.2 });

  // ─── Saudi Arabia coast outline (far west, very faint) ───
  const saudiCoast = [
    { x: EXT_LEFT, y: 1800 },
    { x: -200, y: 1700 },
    { x: -200, y: 1600 },  // connects to Qatar
  ];
  g.poly(saudiCoast.flatMap(p => [p.x, p.y]))
    .stroke({ width: 0.8, color: COLORS.phosphorGreen, alpha: 0.15 });

  // ─── Extended coastline strokes (subtle outlines for the broader coast) ───
  // Oman eastern coast toward Muscat
  const omanExtCoast = [
    { x: omanCoast[omanCoast.length - 1].x, y: omanCoast[omanCoast.length - 1].y },
    { x: EXT_RIGHT, y: 780 },
    { x: 7600, y: 1000 },
    { x: 7200, y: 1200 },
    { x: 7000, y: 1500 },
  ];
  g.poly(omanExtCoast.flatMap(p => [p.x, p.y]))
    .stroke({ width: 1.2, color: COLORS.phosphorGreen, alpha: 0.35 });

  // ─── Overview labels (large, visible at 0.16 scale → need ~6x normal size) ───
  const addOverviewLabel = (text: string, lx: number, ly: number, size: number, alpha: number, bold = false) => {
    const lt = new Text({
      text,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: size,
        fontWeight: bold ? 'bold' : 'normal',
        fill: TEXT_COLORS.phosphorGreen,
      }),
      resolution: TEXT_RESOLUTION,
    });
    lt.alpha = alpha;
    lt.anchor.set(0.5);
    lt.position.set(lx, ly);
    mapLayer.addChild(lt);
  };

  // ═══════════════════════════════════════════════════════════════════
  // Country labels (very large for zoom-out readability)
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('I R A N', 4000, -800, 120, 0.2, true);
  addOverviewLabel('ایران', 4000, -600, 70, 0.1);

  addOverviewLabel('U.A.E.', 400, 1200, 80, 0.18, true);
  addOverviewLabel('الإمارات', 400, 1310, 40, 0.07);

  addOverviewLabel('O M A N', 5500, 1400, 90, 0.18, true);
  addOverviewLabel('عُمان', 5500, 1550, 55, 0.1);

  // Saudi Arabia (far southwest, faint)
  addOverviewLabel('S A U D I  A R A B I A', -100, 2100, 60, 0.08, true);
  addOverviewLabel('المملكة العربية السعودية', -100, 2200, 30, 0.04);

  // Qatar
  addOverviewLabel('QATAR', -250, 1100, 35, 0.12, true);
  addOverviewLabel('قطر', -250, 1145, 22, 0.06);
  addOverviewLabel('DOHA', -300, 1200, 28, 0.1);
  addOverviewLabel('الدوحة', -300, 1235, 18, 0.05);

  // Bahrain
  addOverviewLabel('BAHRAIN', -200, 1700, 28, 0.1, true);
  addOverviewLabel('البحرين', -200, 1735, 18, 0.05);

  // Kuwait (very far northwest, very faint)
  addOverviewLabel('KUWAIT', -200, EXT_TOP + 400, 30, 0.06, true);

  // Iraq border indication (faint dashed label)
  addOverviewLabel('IRAQ', -100, EXT_TOP + 200, 35, 0.05, true);

  // ═══════════════════════════════════════════════════════════════════
  // UAE cities
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('DUBAI', 200, 1000, 45, 0.15);
  addOverviewLabel('دبي', 200, 1060, 30, 0.08);
  addOverviewLabel('ABU DHABI', 100, 1400, 40, 0.12);
  addOverviewLabel('أبو ظبي', 100, 1450, 25, 0.06);
  addOverviewLabel('SHARJAH', 350, 940, 28, 0.1);
  addOverviewLabel('AJMAN', 420, 900, 24, 0.08);
  addOverviewLabel('AL AIN', 600, 1500, 28, 0.08);
  addOverviewLabel('العين', 600, 1535, 18, 0.04);
  addOverviewLabel('RAS AL KHAIMAH', 700, 850, 24, 0.09);

  // ═══════════════════════════════════════════════════════════════════
  // Oman cities
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('MUSCAT', 7300, 1300, 40, 0.12);
  addOverviewLabel('مسقط', 7300, 1360, 28, 0.08);
  addOverviewLabel('SOHAR', 5600, 1000, 28, 0.1);
  addOverviewLabel('صحار', 5600, 1035, 18, 0.05);
  addOverviewLabel('NIZWA', 6200, 1600, 25, 0.07);
  addOverviewLabel('SUR', 7800, 1500, 25, 0.07);
  addOverviewLabel('KHASAB', 3800, 800, 28, 0.1);
  addOverviewLabel('خصب', 3800, 835, 18, 0.05);

  // ═══════════════════════════════════════════════════════════════════
  // Iran cities and ports
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('BANDAR ABBAS', 1300, -100, 35, 0.15);
  addOverviewLabel('بندر عباس', 1300, -50, 22, 0.08);
  addOverviewLabel('BUSHEHR', -100, -200, 30, 0.12);
  addOverviewLabel('بوشهر', -100, -160, 20, 0.06);
  addOverviewLabel('ASALUYEH', 200, -150, 25, 0.1);
  addOverviewLabel('عسلویه', 200, -118, 16, 0.05);
  addOverviewLabel('BANDAR-E LENGEH', 500, -50, 25, 0.1);
  addOverviewLabel('بندر لنگه', 500, -18, 16, 0.05);
  addOverviewLabel('JASK', 6800, -100, 28, 0.1);
  addOverviewLabel('جاسک', 6800, -65, 18, 0.05);
  addOverviewLabel('CHABAHAR', 7800, -150, 28, 0.1);
  addOverviewLabel('چابهار', 7800, -115, 18, 0.05);
  addOverviewLabel('KERMAN', 4500, -1400, 30, 0.08);
  addOverviewLabel('کرمان', 4500, -1360, 20, 0.04);
  addOverviewLabel('SHIRAZ', 1200, -1200, 30, 0.08);
  addOverviewLabel('شیراز', 1200, -1160, 20, 0.04);
  addOverviewLabel('MINAB', 2500, -200, 22, 0.08);
  addOverviewLabel('میناب', 2500, -172, 14, 0.04);
  addOverviewLabel('BANDAR-E KONG', 800, -80, 22, 0.08);
  addOverviewLabel('SIRIK', 1000, -60, 20, 0.07);
  addOverviewLabel('GENAVEH', -50, -350, 22, 0.07);

  // ═══════════════════════════════════════════════════════════════════
  // Persian Gulf islands
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('KISH IS.', 100, 400, 22, 0.1);
  addOverviewLabel('جزیره کیش', 100, 425, 14, 0.05);
  g.circle(100, 380, 12).stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.12 });

  addOverviewLabel('LAVAN IS.', 300, 300, 20, 0.08);
  g.circle(300, 280, 8).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });

  addOverviewLabel('KHARG IS.', -50, 100, 20, 0.08);
  addOverviewLabel('جزیره خارک', -50, 125, 14, 0.04);
  g.circle(-50, 80, 8).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });

  addOverviewLabel('FARSI IS.', -100, 600, 18, 0.07);

  // ═══════════════════════════════════════════════════════════════════
  // Water body labels
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('P E R S I A N   G U L F', 1500, 900, 70, 0.12, true);
  addOverviewLabel('الخلیج الفارسی', 1500, 990, 35, 0.05);
  addOverviewLabel('G U L F  O F  O M A N', 7000, 600, 55, 0.12, true);
  addOverviewLabel('خلیج عمان', 7000, 660, 28, 0.05);

  // Strait label at overview scale
  addOverviewLabel('STRAIT OF HORMUZ', 2800, 500, 40, 0.1, true);
  addOverviewLabel('تنگه هرمز', 2800, 550, 25, 0.05);

  // ═══════════════════════════════════════════════════════════════════
  // Mountain ranges and terrain
  // ═══════════════════════════════════════════════════════════════════
  addOverviewLabel('Z A G R O S   M O U N T A I N S', 2500, -400, 40, 0.1);
  addOverviewLabel('رشته‌کوه زاگرس', 2500, -350, 22, 0.04);
  addOverviewLabel('MAKRAN COAST RANGE', 6500, -400, 35, 0.08);

  // Iran interior features
  addOverviewLabel('DASHT-E LUT', 5500, -1300, 35, 0.06);
  addOverviewLabel('دشت لوت', 5500, -1260, 22, 0.03);
  addOverviewLabel('FARS PROVINCE', 1500, -1000, 28, 0.05);
  addOverviewLabel('HORMOZGAN PROVINCE', 2500, -500, 25, 0.05);
  addOverviewLabel('استان هرمزگان', 2500, -468, 16, 0.03);

  // Mountain symbols in Iran interior (more peaks)
  const mtns = [
    { x: 800, y: -600, label: '▲ 3340m', name: 'Kuh-e Dinar' },
    { x: 1500, y: -500, label: '▲ 3000m', name: '' },
    { x: 2200, y: -800, label: '▲ 3250m', name: '' },
    { x: 3000, y: -700, label: '▲ 2800m', name: '' },
    { x: 3800, y: -900, label: '▲ 3050m', name: '' },
    { x: 4500, y: -800, label: '▲ 2700m', name: 'Hazaran' },
    { x: 5000, y: -500, label: '▲ 2400m', name: '' },
    { x: 5800, y: -600, label: '▲ 2100m', name: '' },
    { x: 6500, y: -300, label: '▲ 1800m', name: '' },
    { x: 7500, y: -400, label: '▲ 1600m', name: '' },
  ];
  for (const m of mtns) {
    addOverviewLabel(m.label, m.x, m.y, 25, 0.08);
    if (m.name) {
      addOverviewLabel(m.name, m.x, m.y + 30, 18, 0.05);
    }
  }

  // Hajar mountains in Oman
  addOverviewLabel('HAJAR MOUNTAINS', 5000, 1100, 35, 0.1);
  addOverviewLabel('جبال الحجر', 5000, 1140, 20, 0.04);
  addOverviewLabel('▲ 3009m', 5200, 1200, 22, 0.08);
  addOverviewLabel('Jebel Akhdar', 5200, 1230, 18, 0.05);
  addOverviewLabel('▲ 2087m', 3800, 900, 20, 0.06);
  addOverviewLabel('Jebel Harim', 3800, 925, 16, 0.04);

  // ═══════════════════════════════════════════════════════════════════
  // Border indications (faint dashed lines)
  // ═══════════════════════════════════════════════════════════════════
  // Iran-Pakistan border (far east)
  for (let y = EXT_TOP; y < 0; y += 60) {
    g.moveTo(EXT_RIGHT - 50, y).lineTo(EXT_RIGHT - 50, y + 30)
      .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.06 });
  }
  addOverviewLabel('PAKISTAN', EXT_RIGHT + 50, -800, 40, 0.05, true);
  addOverviewLabel('پاکستان', EXT_RIGHT + 50, -750, 25, 0.03);

  // Iran-Iraq border (far west, faint)
  for (let y = EXT_TOP; y < -200; y += 60) {
    g.moveTo(EXT_LEFT + 50, y).lineTo(EXT_LEFT + 50, y + 30)
      .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.06 });
  }

  // UAE-Oman border (subtle)
  for (let y = 800; y < 1600; y += 50) {
    g.moveTo(1200 + (y - 800) * 0.3, y).lineTo(1200 + (y - 800) * 0.3, y + 25)
      .stroke({ width: 0.4, color: COLORS.phosphorGreen, alpha: 0.04 });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Major roads/routes (very faint)
  // ═══════════════════════════════════════════════════════════════════
  // Trans-Iran highway (Shiraz to Bandar Abbas)
  const roadPts = [
    1200, -1200,  // Shiraz
    1300, -800,
    1300, -400,
    1300, -80,    // Bandar Abbas
  ];
  for (let i = 0; i < roadPts.length - 2; i += 2) {
    for (let t = 0; t < 1; t += 0.15) {
      const x1 = roadPts[i] + (roadPts[i + 2] - roadPts[i]) * t;
      const y1 = roadPts[i + 1] + (roadPts[i + 3] - roadPts[i + 1]) * t;
      const x2 = roadPts[i] + (roadPts[i + 2] - roadPts[i]) * (t + 0.08);
      const y2 = roadPts[i + 1] + (roadPts[i + 3] - roadPts[i + 1]) * (t + 0.08);
      g.moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 0.4, color: COLORS.amber, alpha: 0.04 });
    }
  }

  // Coastal highway (Bandar Abbas to Chabahar)
  const coastRoadPts = [
    1300, -80,    // Bandar Abbas
    2500, -100,
    4000, -60,
    6800, -80,    // Jask
    7800, -120,   // Chabahar
  ];
  for (let i = 0; i < coastRoadPts.length - 2; i += 2) {
    for (let t = 0; t < 1; t += 0.12) {
      const x1 = coastRoadPts[i] + (coastRoadPts[i + 2] - coastRoadPts[i]) * t;
      const y1 = coastRoadPts[i + 1] + (coastRoadPts[i + 3] - coastRoadPts[i + 1]) * t;
      const x2 = coastRoadPts[i] + (coastRoadPts[i + 2] - coastRoadPts[i]) * (t + 0.06);
      const y2 = coastRoadPts[i + 1] + (coastRoadPts[i + 3] - coastRoadPts[i + 1]) * (t + 0.06);
      g.moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 0.3, color: COLORS.amber, alpha: 0.03 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Port/city dots at overview scale (expanded)
  // ═══════════════════════════════════════════════════════════════════
  const overviewPorts = [
    // UAE
    { x: 200, y: 1000, r: 6 },    // Dubai
    { x: 100, y: 1400, r: 6 },    // Abu Dhabi
    { x: 350, y: 940, r: 4 },     // Sharjah
    { x: 420, y: 900, r: 3 },     // Ajman
    { x: 700, y: 850, r: 4 },     // RAK
    { x: 600, y: 1500, r: 4 },    // Al Ain
    // Oman
    { x: 7300, y: 1300, r: 6 },   // Muscat
    { x: 5600, y: 1000, r: 4 },   // Sohar
    { x: 3800, y: 800, r: 4 },    // Khasab
    { x: 6200, y: 1600, r: 3 },   // Nizwa
    { x: 7800, y: 1500, r: 3 },   // Sur
    // Iran
    { x: 1300, y: -80, r: 6 },    // Bandar Abbas
    { x: -100, y: -200, r: 5 },   // Bushehr
    { x: 200, y: -150, r: 4 },    // Asaluyeh
    { x: 500, y: -50, r: 3 },     // Bandar-e Lengeh
    { x: 800, y: -80, r: 3 },     // Bandar-e Kong
    { x: 6800, y: -100, r: 4 },   // Jask
    { x: 7800, y: -150, r: 4 },   // Chabahar
    { x: 4500, y: -1400, r: 4 },  // Kerman
    { x: 1200, y: -1200, r: 5 },  // Shiraz
    { x: 2500, y: -200, r: 3 },   // Minab
    // Qatar
    { x: -300, y: 1200, r: 5 },   // Doha
  ];
  for (const port of overviewPorts) {
    g.circle(port.x, port.y, port.r).fill({ color: COLORS.phosphorGreen, alpha: 0.15 });
    g.circle(port.x, port.y, port.r * 0.5).fill({ color: COLORS.phosphorGreen, alpha: 0.25 });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Oil infrastructure indicators (small diamond symbols)
  // ═══════════════════════════════════════════════════════════════════
  const oilFields = [
    { x: -50, y: 100, label: 'KHARG OIL TERMINAL' },
    { x: 200, y: -150, label: 'SOUTH PARS GAS' },
    { x: -200, y: 1500, label: 'GHAWAR FIELD' },
  ];
  for (const oil of oilFields) {
    // Small diamond marker
    g.moveTo(oil.x, oil.y - 5).lineTo(oil.x + 4, oil.y).lineTo(oil.x, oil.y + 5).lineTo(oil.x - 4, oil.y).lineTo(oil.x, oil.y - 5)
      .stroke({ width: 0.5, color: COLORS.amber, alpha: 0.1 });
    addOverviewLabel(oil.label, oil.x, oil.y + 15, 14, 0.05);
  }
}

/**
 * Attempt to replicate the real Strait of Hormuz geography.
 *
 * The 8000 px world maps roughly west→east:
 *   0‑1600    Persian Gulf approach (wide, open water)
 *   1600‑3200 Qeshm Island / Bandar Abbas area — strait begins to narrow
 *   3200‑5600 The narrows — Musandam Peninsula (Oman) pushes up from the south
 *   5600‑8000 Gulf of Oman opening — waters widen again
 *
 * Iran coast is always along the top. Oman/UAE coast along the bottom.
 */
export function drawMap(mapLayer: Container): void {
  const quality = getQuality();
  const g = new Graphics();
  mapLayer.addChild(g);

  // Extended geography visible during opening zoom (drawn first, behind everything)
  drawExtendedGeography(g, mapLayer);

  // Background spans full world (gameplay area)
  g.rect(0, 0, WORLD_WIDTH, GAME_HEIGHT).fill({ color: COLORS.bgBlack });

  // Grid — skip on low quality, sparser on medium
  const gridAlpha = quality.gridAlpha;
  if (gridAlpha > 0) {
    const gridSpacing = quality.level === 'medium' ? 100 : 50;
    for (let x = 0; x < WORLD_WIDTH; x += gridSpacing) {
      g.moveTo(x, 0).lineTo(x, GAME_HEIGHT).stroke({ width: 0.25, color: COLORS.gridLine, alpha: gridAlpha });
    }
    for (let y = 0; y < GAME_HEIGHT; y += gridSpacing) {
      g.moveTo(0, y).lineTo(WORLD_WIDTH, y).stroke({ width: 0.25, color: COLORS.gridLine, alpha: gridAlpha });
    }
  }

  // ─── Iran coastline (north) ───
  const iranCoast = getIranCoast();
  const OFF = 500; // margin to push straight connecting lines well off-screen
  const iranFirst = iranCoast[0];
  const iranLast = iranCoast[iranCoast.length - 1];
  const iranFill = [
    { x: -OFF, y: iranFirst.y },
    ...iranCoast,
    { x: WORLD_WIDTH + OFF, y: iranLast.y },
    { x: WORLD_WIDTH + OFF, y: -OFF },
    { x: -OFF, y: -OFF },
  ];
  g.poly(iranFill.flatMap(p => [p.x, p.y])).fill({ color: COLORS.panelBg, alpha: 0.45 });
  // Draw as open polyline (not closed polygon) to avoid a straight line from last→first point
  g.moveTo(iranCoast[0].x, iranCoast[0].y);
  for (let i = 1; i < iranCoast.length; i++) {
    g.lineTo(iranCoast[i].x, iranCoast[i].y);
  }
  g.stroke({ width: 1.5, color: COLORS.phosphorGreen, alpha: 0.8 });

  // ─── Oman / UAE coastline (south) ───
  const omanCoast = getOmanCoast();

  // Only draw visible portions of Oman coast
  const omanVisible = omanCoast.filter(p => p.y < GAME_HEIGHT + 20);
  if (omanVisible.length > 1) {
    const omanFirst = omanVisible[0];
    const omanLast = omanVisible[omanVisible.length - 1];
    const omanFill = [
      { x: -OFF, y: omanFirst.y },
      ...omanVisible,
      { x: WORLD_WIDTH + OFF, y: omanLast.y },
      { x: WORLD_WIDTH + OFF, y: GAME_HEIGHT + OFF },
      { x: -OFF, y: GAME_HEIGHT + OFF },
    ];
    g.poly(omanFill.flatMap(p => [p.x, p.y])).fill({ color: COLORS.panelBg, alpha: 0.45 });
    // Draw as open polyline (not closed polygon) to avoid a straight line from last→first point
    g.moveTo(omanVisible[0].x, omanVisible[0].y);
    for (let i = 1; i < omanVisible.length; i++) {
      g.lineTo(omanVisible[i].x, omanVisible[i].y);
    }
    g.stroke({ width: 1.5, color: COLORS.phosphorGreen, alpha: 0.8 });
  }

  // ─── Islands ───

  // Qeshm Island — large, elongated, close to Iran coast near Bandar Abbas
  drawIsland(g, 1400, 195, 320, 40, 'QESHM IS.');

  // Hormuz Island — smaller, south of Qeshm
  drawIsland(g, 1900, 250, 80, 25, 'HORMUZ IS.');

  // Larak Island — east of Hormuz
  drawIsland(g, 2800, 210, 100, 22, 'LARAK IS.');

  // Hengam Island — small, south of Qeshm
  drawIsland(g, 1650, 240, 50, 18);

  // Abu Musa — disputed island in western gulf
  drawIsland(g, 600, 310, 45, 16, 'ABU MUSA');

  // Small rocky islets in the narrows
  drawIsland(g, 3600, 280, 30, 12);
  drawIsland(g, 4200, 300, 25, 10);

  // ─── Shipping lanes (TSS — Traffic Separation Scheme) ───
  // In reality: inbound lane (south, toward Persian Gulf) and outbound lane (north, toward Gulf of Oman)
  // Draw from roughly x=1600 through the strait
  const laneStartX = 1200;
  const laneEndX = 6800;
  for (let x = laneStartX; x < laneEndX; x += 24) {
    // Inbound lane (upper / north)
    const laneProgress = (x - laneStartX) / (laneEndX - laneStartX);
    // Lanes shift based on strait geometry — higher in narrows
    const laneShift = Math.sin(laneProgress * Math.PI) * -30;
    const upperLane = 300 + laneShift;
    const lowerLane = 380 + laneShift;
    g.moveTo(x, upperLane).lineTo(x + 12, upperLane).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.15 });
    g.moveTo(x, lowerLane).lineTo(x + 12, lowerLane).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.15 });
  }

  // ─── Labels helper (hoisted for use by contours and later sections) ───
  const addLabel = (text: string, lx: number, ly: number, size = 10, alpha = 0.5, bold = false) => {
    const lt = new Text({
      text,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: size,
        fontWeight: bold ? 'bold' : 'normal',
        fill: TEXT_COLORS.phosphorGreen,
      }),
      resolution: TEXT_RESOLUTION,
    });
    lt.alpha = alpha;
    lt.anchor.set(0.5);
    lt.position.set(lx, ly);
    mapLayer.addChild(lt);
  };

  // ─── Bathymetric depth contour lines (skip on low quality) ───
  if (!quality.enableBathymetricContours) {
    // Skip contours entirely on low quality — huge draw call savings
  } else {
  const depthLabels = ['10m', '20m', '40m', '60m', '80m', '100m', '120m'];
  const numContours = quality.level === 'medium' ? 4 : 7;
  for (let level = 0; level < numContours; level++) {
    const depthFraction = (level + 1) / (numContours + 1);
    const contourAlpha = 0.07 - level * 0.006;
    if (contourAlpha < 0.015) continue;

    // Draw contour from both Iran (north) and Oman (south) sides
    for (const side of ['north', 'south'] as const) {
      let drawing = true;
      let segLen = 0;
      const dashLen = 10;
      const gapLen = 8;

      for (let x = 200; x < WORLD_WIDTH - 200; x += COAST_STEP) {
        const iranY = getCoastY(getIranCoast(), x);
        const omanY = getCoastY(getOmanCoast(), x);
        const channelCenter = (iranY + omanY) / 2;

        // Calculate contour Y position
        let contourY: number;
        if (side === 'north') {
          contourY = iranY + (channelCenter - iranY) * (0.12 + depthFraction * 0.38);
        } else {
          contourY = omanY - (omanY - channelCenter) * (0.12 + depthFraction * 0.38);
        }

        // Deflect around islands
        for (const island of ISLANDS) {
          const dx = x - island.cx;
          const dy = contourY - island.cy;
          const rx = island.width * 0.8;
          const ry = island.height * 1.5;
          const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (dist < 1.5) {
            const push = (1.5 - dist) * 20;
            contourY += side === 'north' ? -push : push;
          }
        }

        // Add organic noise
        const noise = Math.sin(x * 0.006 + level * 1.7) * 8
          + Math.sin(x * 0.017 + level * 3.1) * 4
          + Math.cos(x * 0.002 + level) * 6;
        contourY += noise;

        // Clamp to stay in water
        contourY = Math.max(iranY + 15, Math.min(omanY - 15, contourY));

        // Get next point for line segment
        const nextX = x + COAST_STEP;
        const nextIranY = getCoastY(getIranCoast(), nextX);
        const nextOmanY = getCoastY(getOmanCoast(), nextX);
        const nextCenter = (nextIranY + nextOmanY) / 2;
        let nextContourY = side === 'north'
          ? nextIranY + (nextCenter - nextIranY) * (0.12 + depthFraction * 0.38)
          : nextOmanY - (nextOmanY - nextCenter) * (0.12 + depthFraction * 0.38);
        const nextNoise = Math.sin(nextX * 0.006 + level * 1.7) * 8
          + Math.sin(nextX * 0.017 + level * 3.1) * 4
          + Math.cos(nextX * 0.002 + level) * 6;
        nextContourY += nextNoise;
        nextContourY = Math.max(nextIranY + 15, Math.min(nextOmanY - 15, nextContourY));

        // Dashed line rendering
        if (drawing) {
          g.moveTo(x, contourY).lineTo(nextX, nextContourY)
            .stroke({ width: 0.4, color: COLORS.cyan, alpha: contourAlpha });
        }
        segLen += COAST_STEP;
        const threshold = drawing ? dashLen : gapLen;
        if (segLen >= threshold) {
          segLen = 0;
          drawing = !drawing;
        }
      }
    }

    // Depth labels along center contour (only for select levels)
    if (level === 1 || level === 3 || level === 5) {
      for (let lx = 1500; lx < WORLD_WIDTH - 1000; lx += 1400) {
        const iranY = getCoastY(getIranCoast(), lx);
        const omanY = getCoastY(getOmanCoast(), lx);
        const labelY = (iranY + omanY) / 2;
        addLabel(depthLabels[level], lx, labelY, 7, 0.15);
      }
    }
  }
  } // end bathymetric contours quality gate

  // ─── Center-channel current flow lines (skip on low/medium) ───
  if (quality.enableFlowLines) {
  // Subtle dashed lines suggesting current flow direction through the strait
  for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
    const offsets = [-15, 0, 15]; // three parallel lines
    const yOffset = offsets[lineIdx];
    const flowAlpha = lineIdx === 1 ? 0.04 : 0.025; // center line slightly brighter
    let drawing = true;
    let segLen = 0;
    const dashLen = 18;
    const gapLen = 24;

    for (let x = 400; x < WORLD_WIDTH - 400; x += COAST_STEP) {
      const iranY = getCoastY(getIranCoast(), x);
      const omanY = getCoastY(getOmanCoast(), x);
      const centerY = (iranY + omanY) / 2 + yOffset;
      // Gentle sinusoidal wobble
      const wobble = Math.sin(x * 0.003 + lineIdx * 2.1) * 6
        + Math.sin(x * 0.009 + lineIdx * 0.7) * 3;
      const flowY = centerY + wobble;

      const nextX = x + COAST_STEP;
      const nextIranY = getCoastY(getIranCoast(), nextX);
      const nextOmanY = getCoastY(getOmanCoast(), nextX);
      const nextCenterY = (nextIranY + nextOmanY) / 2 + yOffset;
      const nextWobble = Math.sin(nextX * 0.003 + lineIdx * 2.1) * 6
        + Math.sin(nextX * 0.009 + lineIdx * 0.7) * 3;
      const nextFlowY = nextCenterY + nextWobble;

      if (drawing) {
        g.moveTo(x, flowY).lineTo(nextX, nextFlowY)
          .stroke({ width: 0.3, color: COLORS.cyan, alpha: flowAlpha });
      }
      segLen += COAST_STEP;
      const threshold = drawing ? dashLen : gapLen;
      if (segLen >= threshold) {
        segLen = 0;
        drawing = !drawing;
      }
    }
  }

  // Current direction chevrons (small > shapes pointing east)
  for (let cx = 800; cx < WORLD_WIDTH - 800; cx += 500) {
    const iranY = getCoastY(getIranCoast(), cx);
    const omanY = getCoastY(getOmanCoast(), cx);
    const cy = (iranY + omanY) / 2;
    const chevronSize = 4;
    g.moveTo(cx - chevronSize, cy - chevronSize)
      .lineTo(cx + chevronSize, cy)
      .lineTo(cx - chevronSize, cy + chevronSize)
      .stroke({ width: 0.4, color: COLORS.cyan, alpha: 0.04 });
  }
  } // end flow lines + chevrons quality gate

  // ─── Geographic Labels ───

  // Iran — country labels
  addLabel('IRAN', 400, 40, 16, 0.6, true);
  addLabel('IRAN', 3000, 50, 14, 0.4, true);
  addLabel('IRAN', 5500, 40, 14, 0.4, true);

  // Iran — cities and ports
  addLabel('BANDAR ABBAS', 1300, 110, 10, 0.55);
  addLabel('بندر عباس', 1300, 124, 7, 0.25);
  addLabel('BANDAR-E LENGEH', 300, 68, 8, 0.4);
  addLabel('BANDAR-E KONG', 700, 82, 8, 0.35);
  addLabel('SIRIK', 900, 95, 7, 0.3);
  addLabel('MINAB', 2200, 55, 8, 0.35);
  addLabel('JASK', 6800, 60, 9, 0.4);
  addLabel('جاسک', 6800, 74, 7, 0.2);
  addLabel('CHAHBAHAR', 7600, 48, 8, 0.3);

  // Iran — military/port indicators (small dots)
  const iranPorts = [
    { x: 1300, y: 135 }, // Bandar Abbas
    { x: 300, y: 78 },   // Bandar-e Lengeh
    { x: 700, y: 92 },   // Bandar-e Kong
    { x: 6800, y: 70 },  // Jask
  ];
  for (const port of iranPorts) {
    g.circle(port.x, port.y, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.3 });
  }

  // Island labels
  addLabel('QESHM IS.', 1400, 175, 10, 0.5);
  addLabel('جزیره قشم', 1400, 218, 7, 0.2);
  addLabel('HORMUZ IS.', 1900, 230, 8, 0.45);
  addLabel('LARAK IS.', 2800, 190, 8, 0.45);
  addLabel('ABU MUSA', 600, 330, 8, 0.4);
  addLabel('GREATER TUNB', 450, 270, 7, 0.35);
  addLabel('LESSER TUNB', 350, 310, 7, 0.3);
  addLabel('SIRRI IS.', 150, 360, 7, 0.3);
  addLabel('FORUR IS.', 200, 180, 7, 0.25);
  addLabel('HENGAM IS.', 1650, 260, 7, 0.35);

  // UAE labels
  addLabel('U.A.E.', 500, GAME_HEIGHT - 30, 12, 0.35, true);
  addLabel('RAS AL-KHAIMAH', 650, GAME_HEIGHT - 60, 8, 0.3);
  addLabel('UMM AL QUWAIN', 350, GAME_HEIGHT - 55, 7, 0.2);
  addLabel('SHARJAH', 180, GAME_HEIGHT - 60, 8, 0.25);
  addLabel('FUJAIRAH', 1200, GAME_HEIGHT - 40, 8, 0.3);

  // UAE port dots
  const uaePorts = [
    { x: 650, y: GAME_HEIGHT - 50 },
    { x: 1200, y: GAME_HEIGHT - 30 },
  ];
  for (const port of uaePorts) {
    g.circle(port.x, port.y, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.25 });
  }

  // Oman labels
  addLabel('OMAN', 3800, 490, 14, 0.5, true);
  addLabel('MUSANDAM', 3600, 460, 10, 0.45);
  addLabel('MUSANDAM PEN.', 3400, 420, 7, 0.25);
  addLabel('KHASAB', 3900, 440, 9, 0.4);
  addLabel('خصب', 3900, 453, 7, 0.2);
  addLabel('BUKHA', 3500, 500, 7, 0.3);
  addLabel('DIBBA', 2800, 520, 8, 0.3);
  addLabel('LIMA', 3200, 480, 7, 0.25);
  addLabel('OMAN', 6000, 580, 14, 0.4, true);
  addLabel('SOHAR', 5400, 600, 8, 0.3);
  addLabel('AL KHABURAH', 5800, 620, 7, 0.2);

  // Oman port dots
  const omanPorts = [
    { x: 3900, y: 448 },
    { x: 3500, y: 508 },
    { x: 5400, y: 610 },
  ];
  for (const port of omanPorts) {
    g.circle(port.x, port.y, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.25 });
  }

  // Water body labels
  addLabel('PERSIAN GULF', 300, GAME_HEIGHT / 2, 12, 0.3, true);
  addLabel('STRAIT OF HORMUZ', 2800, GAME_HEIGHT / 2 + 60, 13, 0.4, true);
  addLabel('GULF OF OMAN', 7000, GAME_HEIGHT / 2 + 40, 12, 0.3, true);

  // Shipping/navigation labels
  addLabel('INBOUND TSS', 4000, 265, 8, 0.2);
  addLabel('OUTBOUND TSS', 4000, 395, 8, 0.2);
  addLabel('ANCHORAGE', 800, 440, 7, 0.15);
  addLabel('ANCHORAGE', 6200, 480, 7, 0.15);
  addLabel('PILOT STATION', 2400, 350, 7, 0.15);
  addLabel('DWT LIMIT 500K', 1800, 365, 6, 0.12);

  // Terrain elevation markers on Iran coast (mountain symbols as ^ text)
  addLabel('▲ 1800m', 400, 22, 6, 0.2);
  addLabel('▲ 2100m', 1600, 58, 6, 0.2);
  addLabel('▲ 1400m', 3200, 30, 6, 0.2);
  addLabel('ZAGROS MTS.', 900, 18, 7, 0.2);
  addLabel('MAKRAN COAST', 6400, 30, 7, 0.2);

  // Musandam mountain terrain
  addLabel('▲ 2087m', 3700, 520, 6, 0.2);
  addLabel('JEBEL HARIM', 3700, 530, 6, 0.18);
  addLabel('HAJAR MTS.', 4800, 560, 7, 0.2);
  addLabel('▲ 1527m', 5000, 570, 6, 0.15);

  // Lat/long coordinate markers along edges
  const latLongLabels = [
    { text: '56°00\'E', x: 200, y: GAME_HEIGHT - 6 },
    { text: '56°30\'E', x: 1200, y: GAME_HEIGHT - 6 },
    { text: '57°00\'E', x: 2400, y: GAME_HEIGHT - 6 },
    { text: '57°30\'E', x: 3600, y: GAME_HEIGHT - 6 },
    { text: '58°00\'E', x: 4800, y: GAME_HEIGHT - 6 },
    { text: '58°30\'E', x: 6000, y: GAME_HEIGHT - 6 },
    { text: '59°00\'E', x: 7200, y: GAME_HEIGHT - 6 },
    { text: '26°30\'N', x: 30, y: 80 },
    { text: '26°00\'N', x: 30, y: 250 },
    { text: '25°30\'N', x: 30, y: 420 },
    { text: '25°00\'N', x: 30, y: 590 },
  ];
  for (const ll of latLongLabels) {
    addLabel(ll.text, ll.x, ll.y, 6, 0.18);
  }

  // Compass rose indicator (small cross)
  const compassX = 7600, compassY = 150;
  g.moveTo(compassX, compassY - 18).lineTo(compassX, compassY + 18)
    .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.25 });
  g.moveTo(compassX - 18, compassY).lineTo(compassX + 18, compassY)
    .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.25 });
  addLabel('N', compassX, compassY - 24, 7, 0.3);
  addLabel('S', compassX, compassY + 24, 6, 0.15);
  addLabel('E', compassX + 24, compassY, 6, 0.15);
  addLabel('W', compassX - 24, compassY, 6, 0.15);

  // Scale bar
  const scaleX = 7200, scaleY = 230;
  g.moveTo(scaleX, scaleY).lineTo(scaleX + 160, scaleY)
    .stroke({ width: 0.8, color: COLORS.phosphorGreen, alpha: 0.25 });
  g.moveTo(scaleX, scaleY - 4).lineTo(scaleX, scaleY + 4)
    .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.25 });
  g.moveTo(scaleX + 160, scaleY - 4).lineTo(scaleX + 160, scaleY + 4)
    .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.25 });
  addLabel('10 NM', scaleX + 80, scaleY - 8, 6, 0.2);

  // Additional small islands (Greater Tunb, Lesser Tunb, Sirri)
  drawIsland(g, 450, 285, 35, 14);
  drawIsland(g, 350, 320, 22, 10);
  drawIsland(g, 150, 370, 40, 15);
  drawIsland(g, 200, 170, 20, 8);

  // Small reef/shoal markers (dashed circles)
  const shoals = [
    { x: 1100, y: 300, label: 'SHOAL' },
    { x: 5200, y: 340, label: 'REEF' },
    { x: 3000, y: 360, label: 'SHOAL' },
  ];
  for (const shoal of shoals) {
    // Draw dashed circle for shoal
    const radius = 15;
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const x1 = shoal.x + Math.cos(a) * radius;
      const y1 = shoal.y + Math.sin(a) * radius;
      const x2 = shoal.x + Math.cos(a + 0.15) * radius;
      const y2 = shoal.y + Math.sin(a + 0.15) * radius;
      g.moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 0.4, color: COLORS.amber, alpha: 0.12 });
    }
    addLabel(shoal.label, shoal.x, shoal.y - 20, 6, 0.12);
  }

  // Sector markers
  const sectors = [
    { x: 0, label: 'SECTOR 1' },
    { x: 1600, label: 'SECTOR 2' },
    { x: 3200, label: 'SECTOR 3' },
    { x: 4800, label: 'SECTOR 4' },
    { x: 6400, label: 'SECTOR 5' },
  ];
  for (const sector of sectors) {
    g.moveTo(sector.x, 0).lineTo(sector.x, GAME_HEIGHT)
      .stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.15 });
    addLabel(sector.label, sector.x + 60, GAME_HEIGHT - 15, 9, 0.25);
  }
}

/** Draw an island with realistic irregular coastline */
function drawIsland(
  g: Graphics,
  cx: number,
  cy: number,
  width: number,
  height: number,
  label?: string,
): void {
  const pts: MapCoord[] = [];
  const steps = Math.max(16, Math.floor(width / 8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // Vary radius with multiple frequencies for realism
    const r1 = 0.85 + Math.sin(a * 3 + cx * 0.01) * 0.12;
    const r2 = 1.0 + Math.cos(a * 5 + cy * 0.02) * 0.08;
    const r3 = 1.0 + Math.sin(a * 7) * 0.05;
    const rx = (width / 2) * r1 * r2 * r3;
    const ry = (height / 2) * r1 * r2 * r3;
    pts.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
    });
  }
  g.poly(pts.flatMap(p => [p.x, p.y])).fill({ color: COLORS.panelBg, alpha: 0.35 });
  g.poly(pts.flatMap(p => [p.x, p.y])).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.6 });

  if (label) {
    // Label is drawn as part of the Graphics — we'll use the label system in the main function
    // For simplicity, draw a small filled label indicator
    // The actual text label is added via addLabel in the main function for islands that need it
  }
}
