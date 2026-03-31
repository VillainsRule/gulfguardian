export interface Vec3 { x: number; y: number; z: number; }
export function createDestroyerModel(): { vertices: Vec3[]; edges: [number, number][]; depthHints: number[] } {
  const v: Vec3[] = [];
  const e: [number, number][] = [];

  const addV = (x: number, y: number, z: number): number => {
    v.push({ x, y, z });
    return v.length - 1;
  };

  const addEdge = (a: number, b: number): void => {
    e.push([a, b]);
  };

  const connectChain = (points: number[]): void => {
    for (let i = 0; i < points.length - 1; i++) addEdge(points[i], points[i + 1]);
  };

  const connectLoop = (loop: number[]): void => {
    connectChain(loop);
    if (loop.length > 2) addEdge(loop[loop.length - 1], loop[0]);
  };

  const connectStruts = (a: number[], b: number[]): void => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) addEdge(a[i], b[i]);
  };

  // V-shaped destroyer hull. Bow at +x (~68), stern at -x (~-62).
  // Narrower beam and sharper bilge than a tanker; rising sheerline toward bow.
  const hullSections = [
    { x: -62, keelY: -7.5, bottomY: -6.0, chineY: -2.5, deckY: 2.8,  sheerY: 3.5,  halfBeam: 1.0, chineBeam: 4.2, sheerBeam: 3.8 },
    { x: -50, keelY: -8.0, bottomY: -6.5, chineY: -2.8, deckY: 3.0,  sheerY: 3.8,  halfBeam: 1.8, chineBeam: 6.0, sheerBeam: 5.5 },
    { x: -38, keelY: -8.5, bottomY: -7.0, chineY: -3.0, deckY: 3.2,  sheerY: 4.0,  halfBeam: 2.5, chineBeam: 7.0, sheerBeam: 6.5 },
    { x: -24, keelY: -8.8, bottomY: -7.2, chineY: -3.0, deckY: 3.5,  sheerY: 4.2,  halfBeam: 3.0, chineBeam: 7.5, sheerBeam: 7.0 },
    { x: -10, keelY: -9.0, bottomY: -7.4, chineY: -3.0, deckY: 3.6,  sheerY: 4.3,  halfBeam: 3.2, chineBeam: 7.8, sheerBeam: 7.2 },
    { x:   5, keelY: -8.8, bottomY: -7.3, chineY: -3.0, deckY: 3.8,  sheerY: 4.5,  halfBeam: 3.2, chineBeam: 7.6, sheerBeam: 7.0 },
    { x:  20, keelY: -8.5, bottomY: -7.0, chineY: -2.8, deckY: 4.0,  sheerY: 4.7,  halfBeam: 3.0, chineBeam: 7.2, sheerBeam: 6.6 },
    { x:  35, keelY: -8.0, bottomY: -6.5, chineY: -2.5, deckY: 4.5,  sheerY: 5.2,  halfBeam: 2.5, chineBeam: 6.2, sheerBeam: 5.6 },
    { x:  48, keelY: -7.0, bottomY: -5.5, chineY: -2.0, deckY: 5.5,  sheerY: 6.2,  halfBeam: 1.8, chineBeam: 4.8, sheerBeam: 4.2 },
    { x:  60, keelY: -5.5, bottomY: -4.0, chineY: -1.5, deckY: 6.5,  sheerY: 7.2,  halfBeam: 1.0, chineBeam: 3.0, sheerBeam: 2.5 },
    { x:  68, keelY: -3.5, bottomY: -2.5, chineY: -0.8, deckY: 7.2,  sheerY: 7.8,  halfBeam: 0.4, chineBeam: 1.4, sheerBeam: 1.2 },
  ];

  const hullRings: number[][] = [];
  const keelLine: number[] = [];
  const bottomPort: number[] = [];
  const bottomStarboard: number[] = [];
  const chinePort: number[] = [];
  const chineStarboard: number[] = [];
  const deckPort: number[] = [];
  const deckStarboard: number[] = [];
  const sheerPort: number[] = [];
  const sheerStarboard: number[] = [];
  const centerDeck: number[] = [];

  for (const section of hullSections) {
    const ring = [
      addV(section.x, section.keelY, 0),
      addV(section.x, section.bottomY, -section.halfBeam),
      addV(section.x, section.chineY, -section.chineBeam),
      addV(section.x, section.deckY, -section.halfBeam * 0.96),
      addV(section.x, section.sheerY, -section.sheerBeam),
      addV(section.x, section.sheerY, section.sheerBeam),
      addV(section.x, section.deckY, section.halfBeam * 0.96),
      addV(section.x, section.chineY, section.chineBeam),
      addV(section.x, section.bottomY, section.halfBeam),
    ];
    hullRings.push(ring);
    keelLine.push(ring[0]);
    bottomPort.push(ring[1]);
    chinePort.push(ring[2]);
    deckPort.push(ring[3]);
    sheerPort.push(ring[4]);
    sheerStarboard.push(ring[5]);
    deckStarboard.push(ring[6]);
    chineStarboard.push(ring[7]);
    bottomStarboard.push(ring[8]);
    centerDeck.push(addV(section.x, section.deckY + 0.55, 0));

    connectChain([ring[0], ring[1], ring[2], ring[3], ring[4]]);
    connectChain([ring[0], ring[8], ring[7], ring[6], ring[5]]);
    addEdge(ring[4], ring[5]);
    addEdge(ring[3], ring[6]);
    addEdge(ring[2], ring[7]);
    addEdge(ring[1], ring[8]);
  }

  for (let i = 0; i < hullRings.length - 1; i++) {
    connectStruts(hullRings[i], hullRings[i + 1]);
    addEdge(centerDeck[i], centerDeck[i + 1]);
    addEdge(deckPort[i], centerDeck[i]);
    addEdge(deckStarboard[i], centerDeck[i]);
    addEdge(deckPort[i + 1], centerDeck[i + 1]);
    addEdge(deckStarboard[i + 1], centerDeck[i + 1]);
  }

  // ── Stern transom ────────────────────────────────────────────────────────
  const transomTop = addV(-65, 3.5, 0);
  const transomPort = addV(-64, 0.5, -3.5);
  const transomStar = addV(-64, 0.5, 3.5);
  const transomKeel = addV(-64, -7.5, 0);
  addEdge(sheerPort[0], transomTop);
  addEdge(sheerStarboard[0], transomTop);
  addEdge(chinePort[0], transomPort);
  addEdge(chineStarboard[0], transomStar);
  addEdge(transomPort, transomTop);
  addEdge(transomStar, transomTop);
  addEdge(transomPort, transomKeel);
  addEdge(transomStar, transomKeel);
  addEdge(keelLine[0], transomKeel);
  addEdge(transomPort, transomStar);

  // ── Twin propeller shafts and propellers ──────────────────────────────────
  for (const sz of [-2.5, 2.5]) {
    const shaftRoot = addV(-60, -5.5, sz);
    const shaftHub = addV(-67, -6.2, sz < 0 ? sz - 0.3 : sz + 0.3);
    addEdge(keelLine[0], shaftRoot);
    addEdge(shaftRoot, shaftHub);
    const pTop = addV(-69, -4.0, sz);
    const pBot = addV(-69, -8.4, sz);
    const pOut = addV(-69, -6.2, sz < 0 ? sz - 2.2 : sz + 2.2);
    addEdge(shaftHub, pTop); addEdge(shaftHub, pBot); addEdge(shaftHub, pOut);
    addEdge(pTop, pOut); addEdge(pBot, pOut);
  }

  // Twin rudders
  for (const rz of [-2.0, 2.0]) {
    const rt = addV(-62, -4.0, rz);
    const rb = addV(-66, -10.0, rz);
    const rtr = addV(-68, -7.5, rz);
    addEdge(rt, rb); addEdge(rb, rtr); addEdge(rtr, rt);
  }

  // ── Stem bow ──────────────────────────────────────────────────────────────
  const bowStemBottom = addV(74, -3.5, 0);
  const bowStemMid = addV(72, 2.0, 0);
  const bowStemTop = addV(71, 7.8, 0);
  addEdge(keelLine[keelLine.length - 1], bowStemBottom);
  addEdge(bowStemBottom, bowStemMid);
  addEdge(bowStemMid, bowStemTop);
  addEdge(deckPort[deckPort.length - 1], bowStemTop);
  addEdge(deckStarboard[deckStarboard.length - 1], bowStemTop);
  addEdge(sheerPort[sheerPort.length - 1], bowStemTop);
  addEdge(sheerStarboard[sheerStarboard.length - 1], bowStemTop);
  addEdge(chinePort[chinePort.length - 1], bowStemMid);
  addEdge(chineStarboard[chineStarboard.length - 1], bowStemMid);

  // ── Helicopter flight deck ─────────────────────────────────────────────────
  const hdFwdPort = addV(-40, 4.2, -5.8);
  const hdFwdStar = addV(-40, 4.2, 5.8);
  const hdAftPort = addV(-60, 3.6, -5.2);
  const hdAftStar = addV(-60, 3.6, 5.2);
  connectLoop([hdFwdPort, hdFwdStar, hdAftStar, hdAftPort]);
  addEdge(hdFwdPort, sheerPort[1]);
  addEdge(hdFwdStar, sheerStarboard[1]);
  addEdge(hdAftPort, sheerPort[0]);
  addEdge(hdAftStar, sheerStarboard[0]);
  // Landing pad H marking
  const hx = -51;
  const lhFL = addV(hx + 4, 4.1, -3.2), lhFR = addV(hx + 4, 4.1, 3.2);
  const lhAL = addV(hx - 4, 4.1, -3.2), lhAR = addV(hx - 4, 4.1, 3.2);
  const lhML = addV(hx, 4.1, -3.2),     lhMR = addV(hx, 4.1, 3.2);
  addEdge(lhFL, lhAL); addEdge(lhFR, lhAR); addEdge(lhML, lhMR);

  // ── Helicopter hangar ──────────────────────────────────────────────────────
  // [aft-port, aft-star, fwd-star, fwd-port]
  const hgBase = [addV(-40, 4.2, -5.2), addV(-40, 4.2, 5.2), addV(-22, 4.5, 5.2), addV(-22, 4.5, -5.2)];
  const hgTop  = [addV(-40, 11.0, -4.5), addV(-40, 11.0, 4.5), addV(-22, 11.5, 4.5), addV(-22, 11.5, -4.5)];
  connectLoop(hgBase);
  connectLoop(hgTop);
  connectStruts(hgBase, hgTop);
  // Hangar door frame lines
  addEdge(addV(-40, 6.5, -4.5), addV(-40, 6.5, 4.5));
  addEdge(addV(-40, 9.0, -4.5), addV(-40, 9.0, 4.5));

  // ── Aft deckhouse ──────────────────────────────────────────────────────────
  // [aft-port, aft-star, fwd-star, fwd-port]
  const adBase = [addV(-20, 4.5, -4.2), addV(-20, 4.5, 4.2), addV(-8, 4.8, 4.2), addV(-8, 4.8, -4.2)];
  const adTop  = [addV(-20, 9.8, -3.8), addV(-20, 9.8, 3.8), addV(-8, 10.2, 3.8), addV(-8, 10.2, -3.8)];
  connectLoop(adBase);
  connectLoop(adTop);
  connectStruts(adBase, adTop);
  addEdge(hgBase[3], adBase[0]);
  addEdge(hgBase[2], adBase[1]);

  // ── Bridge / main superstructure ───────────────────────────────────────────
  // Level 1: main deckhouse [aft-port, aft-star, fwd-star, fwd-port]
  const b1Base = [addV(-6, 4.8, -5.8), addV(-6, 4.8, 5.8), addV(26, 5.2, 5.8), addV(26, 5.2, -5.8)];
  const b1Top  = [addV(-5, 10.5, -5.4), addV(-5, 10.5, 5.4), addV(25, 11.0, 5.4), addV(25, 11.0, -5.4)];
  connectLoop(b1Base);
  connectLoop(b1Top);
  connectStruts(b1Base, b1Top);
  addEdge(adBase[3], b1Base[0]);
  addEdge(adBase[2], b1Base[1]);

  // Level 2: bridge house
  const b2Base = [addV(-4, 10.5, -5.0), addV(-4, 10.5, 5.0), addV(23, 11.0, 5.0), addV(23, 11.0, -5.0)];
  const b2Top  = [addV(-3, 16.0, -4.5), addV(-3, 16.0, 4.5), addV(21, 16.5, 4.5), addV(21, 16.5, -4.5)];
  connectLoop(b2Base);
  connectLoop(b2Top);
  connectStruts(b2Base, b2Top);
  connectStruts(b1Top, b2Base);

  // Level 3: signal bridge
  const b3Base = [addV(-2, 16.0, -4.0), addV(-2, 16.0, 4.0), addV(19, 16.5, 4.0), addV(19, 16.5, -4.0)];
  const b3Top  = [addV(-1, 20.5, -3.5), addV(-1, 20.5, 3.5), addV(18, 21.0, 3.5), addV(18, 21.0, -3.5)];
  connectLoop(b3Base);
  connectLoop(b3Top);
  connectStruts(b3Base, b3Top);
  connectStruts(b2Top, b3Base);

  // Bridge wings at level-2 height
  const bwPortFwd = addV(14, 16.0, -7.0);
  const bwPortAft = addV(4,  16.0, -7.0);
  const bwStarFwd = addV(14, 16.0,  7.0);
  const bwStarAft = addV(4,  16.0,  7.0);
  addEdge(b2Top[3], bwPortFwd); addEdge(b2Top[0], bwPortAft); addEdge(bwPortAft, bwPortFwd);
  addEdge(b2Top[2], bwStarFwd); addEdge(b2Top[1], bwStarAft); addEdge(bwStarAft, bwStarFwd);

  // ── Combat mast and radar platform ─────────────────────────────────────────
  const mastBase = addV(9, 21.0, 0);
  const mastMid  = addV(9, 27.0, 0);
  const mastTop  = addV(9, 35.0, 0);
  addEdge(b3Top[0], mastBase); addEdge(b3Top[1], mastBase);
  addEdge(b3Top[2], mastBase); addEdge(b3Top[3], mastBase);
  addEdge(mastBase, mastMid); addEdge(mastMid, mastTop);

  // Yardarms
  const yadUpperPort = addV(8,   30.5, -5.5);
  const yadUpperStar = addV(8,   30.5,  5.5);
  const yadLowerPort = addV(8.5, 25.5, -4.2);
  const yadLowerStar = addV(8.5, 25.5,  4.2);
  addEdge(yadUpperPort, yadUpperStar);
  addEdge(yadLowerPort, yadLowerStar);
  addEdge(mastMid, yadLowerPort); addEdge(mastMid, yadLowerStar);
  addEdge(mastTop, yadUpperPort); addEdge(mastTop, yadUpperStar);

  // Radar platform (SPY-style flat array)
  const radBase = [addV(7, 29.0, -2.8), addV(7, 29.0, 2.8), addV(11, 29.2, 2.8), addV(11, 29.2, -2.8)];
  const radTop  = [addV(7, 31.5, -2.5), addV(7, 31.5, 2.5), addV(11, 31.7, 2.5), addV(11, 31.7, -2.5)];
  connectLoop(radBase);
  connectLoop(radTop);
  connectStruts(radBase, radTop);
  addEdge(radBase[0], radBase[2]); addEdge(radBase[1], radBase[3]);
  addEdge(mastMid, radBase[0]); addEdge(mastMid, radBase[1]);
  addEdge(mastMid, radBase[2]); addEdge(mastMid, radBase[3]);

  // ── Twin exhaust stacks ────────────────────────────────────────────────────
  for (const sz of [-3.0, 3.0]) {
    const skBase = [addV(-16, 4.8, sz - 1.8), addV(-16, 4.8, sz + 1.8), addV(-4, 5.0, sz + 1.8), addV(-4, 5.0, sz - 1.8)];
    const skTop  = [addV(-17, 17.0, sz - 1.5), addV(-17, 17.0, sz + 1.5), addV(-5, 17.2, sz + 1.5), addV(-5, 17.2, sz - 1.5)];
    connectLoop(skBase);
    connectLoop(skTop);
    connectStruts(skBase, skTop);
  }

  // ── VLS forward (vertical launch system) ──────────────────────────────────
  // [aft-port, aft-star, fwd-star, fwd-port]
  const vlsBase = [addV(28, 5.2, -4.8), addV(28, 5.2, 4.8), addV(50, 6.0, 4.8), addV(50, 6.0, -4.8)];
  const vlsTop  = [addV(28, 7.0, -4.8), addV(28, 7.0, 4.8), addV(50, 7.5, 4.8), addV(50, 7.5, -4.8)];
  connectLoop(vlsBase);
  connectLoop(vlsTop);
  connectStruts(vlsBase, vlsTop);
  // VLS cell grid lines (visible from above when rotating)
  for (let xi = 0; xi <= 3; xi++) {
    const bx = 28 + xi * 5.5;
    addEdge(addV(bx, 7.0, -4.8), addV(bx, 7.0, 4.8));
  }
  for (const gz of [-1.6, 0, 1.6]) {
    addEdge(addV(28, 7.0, gz), addV(50, 7.5, gz));
  }
  addEdge(b1Base[3], vlsBase[0]);
  addEdge(b1Base[2], vlsBase[1]);

  // ── Bow 5-inch gun mount ───────────────────────────────────────────────────
  // [aft-port, aft-star, fwd-star, fwd-port]
  const gunBase   = [addV(52, 6.0, -3.0), addV(52, 6.0, 3.0), addV(63, 7.2, 3.0), addV(63, 7.2, -3.0)];
  const gunTurret = [addV(53, 9.0, -2.5), addV(53, 9.0, 2.5), addV(62, 10.0, 2.5), addV(62, 10.0, -2.5)];
  connectLoop(gunBase);
  connectLoop(gunTurret);
  connectStruts(gunBase, gunTurret);
  // Gun barrel
  const barrelBase = addV(63, 9.8, 0);
  const barrelTip  = addV(78, 8.8, 0);
  addEdge(barrelBase, barrelTip);
  addEdge(gunTurret[2], barrelBase);
  addEdge(gunTurret[3], barrelBase);
  addEdge(vlsBase[3], gunBase[0]);
  addEdge(vlsBase[2], gunBase[1]);

  const depthHints = v.map(vertex => vertex.y * 0.1 + vertex.x * 0.02);
  return { vertices: v, edges: e, depthHints };
}

export function projectVertex(v: Vec3, rotY: number, screenX: number, screenY: number, scale: number, rotX: number = 0): { x: number; y: number; depth: number } {
  // Rotate around Y axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const rx = v.x * cosY - v.z * sinY;
  const rz = v.x * sinY + v.z * cosY;
  let ry = v.y;

  // Apply pitch (X-axis rotation) for bob wobble
  if (rotX !== 0) {
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const ry2 = ry * cosX - rz * sinX;
    const rz2 = ry * sinX + rz * cosX;
    ry = ry2;
    // Use rz2 for the tilt step below
    const tiltAngle = -0.35;
    const cosT = Math.cos(tiltAngle);
    const sinT = Math.sin(tiltAngle);
    const fy = ry * cosT - rz2 * sinT;
    const fz = ry * sinT + rz2 * cosT;

    const fov = 300;
    const depth = fz + fov;
    const projScale = fov / depth;

    return {
      x: screenX + rx * projScale * scale,
      y: screenY - fy * projScale * scale,
      depth: fz,
    };
  }

  // Slight downward tilt so we see the deck
  const tiltAngle = -0.35;
  const cosT = Math.cos(tiltAngle);
  const sinT = Math.sin(tiltAngle);
  const fy = ry * cosT - rz * sinT;
  const fz = ry * sinT + rz * cosT;

  const fov = 300;
  const depth = fz + fov;
  const projScale = fov / depth;

  return {
    x: screenX + rx * projScale * scale,
    y: screenY - fy * projScale * scale,
    depth: fz,
  };
}

// ─── 3D wireframe models for title screen enemies ───
export interface WireModel { vertices: Vec3[]; edges: [number, number][]; }

function createDroneModel(): WireModel {
  // Delta-wing UAV shape
  const vertices: Vec3[] = [
    { x: 6, y: 0, z: 0 },       // 0: nose
    { x: -2, y: 0, z: -5 },     // 1: left wing tip
    { x: -1, y: 0, z: -2 },     // 2: left wing root
    { x: -5, y: 0, z: 0 },      // 3: tail
    { x: -1, y: 0, z: 2 },      // 4: right wing root
    { x: -2, y: 0, z: 5 },      // 5: right wing tip
    { x: 0, y: -1.5, z: 0 },    // 6: dorsal fin top
    { x: -3, y: -1, z: 0 },     // 7: tail fin top
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // outline
    [0, 3],         // centerline
    [2, 4],         // wing spar
    [0, 6], [6, 3], // dorsal ridge
    [3, 7],         // tail fin
  ];
  return { vertices, edges };
}

function createMissileModel(): WireModel {
  // Pointed missile with body and 4 fins
  const r = 1.2; // body radius
  const vertices: Vec3[] = [
    { x: 7, y: 0, z: 0 },       // 0: nose tip
    { x: 4, y: -r, z: -r },     // 1: front body TL
    { x: 4, y: -r, z: r },      // 2: front body TR
    { x: 4, y: r, z: r },       // 3: front body BR
    { x: 4, y: r, z: -r },      // 4: front body BL
    { x: -5, y: -r, z: -r },    // 5: rear body TL
    { x: -5, y: -r, z: r },     // 6: rear body TR
    { x: -5, y: r, z: r },      // 7: rear body BR
    { x: -5, y: r, z: -r },     // 8: rear body BL
    { x: -7, y: -3, z: 0 },     // 9: top fin
    { x: -7, y: 3, z: 0 },      // 10: bottom fin
    { x: -7, y: 0, z: -3 },     // 11: left fin
    { x: -7, y: 0, z: 3 },      // 12: right fin
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4],         // nose to body
    [1, 2], [2, 3], [3, 4], [4, 1],         // front ring
    [5, 6], [6, 7], [7, 8], [8, 5],         // rear ring
    [1, 5], [2, 6], [3, 7], [4, 8],         // body edges
    [5, 9], [6, 9],                          // top fin
    [7, 10], [8, 10],                        // bottom fin
    [5, 11], [8, 11],                        // left fin
    [6, 12], [7, 12],                        // right fin
  ];
  return { vertices, edges };
}

function createFABModel(): WireModel {
  // Small fast attack boat hull
  const vertices: Vec3[] = [
    { x: 6, y: 0, z: 0 },       // 0: bow point
    { x: 2, y: 1, z: -3 },      // 1: port bow
    { x: -5, y: 1, z: -3 },     // 2: port stern
    { x: -6, y: 0.5, z: -2 },   // 3: stern port
    { x: -6, y: 0.5, z: 2 },    // 4: stern starboard
    { x: -5, y: 1, z: 3 },      // 5: starboard stern
    { x: 2, y: 1, z: 3 },       // 6: starboard bow
    { x: 0, y: -1.5, z: -1.5 }, // 7: cabin port
    { x: 0, y: -1.5, z: 1.5 },  // 8: cabin starboard
    { x: -2, y: -1.5, z: -1.5 },// 9: cabin rear port
    { x: -2, y: -1.5, z: 1.5 }, // 10: cabin rear starboard
    { x: 2, y: -0.5, z: 0 },    // 11: bow deck
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], // hull outline
    [0, 11], [11, 7], [11, 8],      // bow to cabin
    [7, 8], [7, 9], [9, 10], [10, 8], // cabin box
    [1, 7], [6, 8],                   // hull to cabin
  ];
  return { vertices, edges };
}

export const TITLE_DRONE_MODEL = createDroneModel();
export const TITLE_MISSILE_MODEL = createMissileModel();
export const TITLE_FAB_MODEL = createFABModel();

// ─── Dust particle type ───
export interface DustParticle {
  x: number; y: number;
  vx: number; vy: number;
  phase: number; // for sine offset
}

// ─── Ocean sparkle point ───
export interface OceanSparkle {
  wx: number; wz: number;
  phase: number;
  speed: number;
  driftX: number;
  driftZ: number;
  size: number;
}

// ─── Title screen action elements ───
export interface TitleDrone {
  wx: number; wy: number; wz: number;
  vwx: number; vwy: number; vwz: number;
  age: number;
  maxAge: number;
  trail: Vec3[];
  destroyed: boolean;
  spinY: number;
}

export interface TitleMissile {
  wx: number; wy: number; wz: number;
  vwx: number; vwy: number; vwz: number;
  age: number;
  maxAge: number;
  trail: Vec3[];
  intercepted: boolean;
  interceptTime: number;
  missileType: 'skimmer' | 'cruise' | 'topattack';
  terminalPhase: boolean;
}

export interface TitleFAB {
  worldAngle: number;
  distance: number;
  speed: number;
  age: number;
  maxAge: number;
  sinePhase: number;
  headingY: number;
}

export interface AegisIntercept {
  wx: number; wy: number; wz: number;
  targetWx: number; targetWy: number; targetWz: number;
  age: number;
  maxAge: number;
  trail: Vec3[];
}

export interface Explosion {
  wx: number; wy: number; wz: number;
  age: number;
  maxAge: number;
}

export interface DistantFlash {
  screenAngle: number;
  heightOffset: number;
  age: number;
  maxAge: number;
  intensity: number;
}

export interface TitleBullet {
  wx: number; wy: number; wz: number;
  vwx: number; vwy: number; vwz: number;
  age: number;
  maxAge: number;
  trail: Vec3[];
  color: number;
  size: number;
}

export interface TitleDebris {
  wx: number; wy: number; wz: number;
  vwx: number; vwy: number; vwz: number;
  rotation: number;
  rotSpeed: number;
  size: number;
  color: number;
  age: number;
  maxAge: number;
  sinking: boolean;
  sinkSpeed: number;
}

export interface WaterSplash {
  wx: number; wz: number;
  age: number;
  maxAge: number;
}

export interface FlakBurst {
  wx: number; wy: number; wz: number;
  age: number;
  maxAge: number;
}
