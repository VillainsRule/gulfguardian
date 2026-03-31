import type { DroneDirection } from '@/entities/enemies/Drone';

export type EnemyType = 'fab' | 'cmb' | 'mine' | 'gunboat' | 'drone' | 'helicopter';

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  y: number;
  /** For drones/helicopters: direction they attack from. Defaults to 'top'. */
  spawnDirection?: DroneDirection;
}

export interface Encounter {
  triggerX: number;
  label?: string;
  enemies: EnemySpawn[];
}

// World is 8000px wide. Camera scrolls at ~55px/sec = ~145 seconds total.
// Screen is 1280px wide. Encounters trigger when cameraX reaches triggerX.
// Enemy Y ranges: Iran coast ~80-170, shipping lane ~240-310 and ~390-460, Oman coast ~520-600

export const ENCOUNTERS: Encounter[] = [
  // === SECTOR 1: WARM-UP (0-1500) ===
  {
    triggerX: 330,
    label: 'CONTACT',
    enemies: [
      { type: 'fab', x: 1600, y: 250 },
      { type: 'fab', x: 1700, y: 300 },
      { type: 'fab', x: 1650, y: 200 },
      { type: 'fab', x: 1750, y: 350 },
    ],
  },
  {
    triggerX: 530,
    enemies: [
      { type: 'fab', x: 1850, y: 270 },
      { type: 'fab', x: 1900, y: 420 },
      { type: 'mine', x: 1950, y: 300 },
    ],
  },
  {
    triggerX: 630,
    enemies: [
      { type: 'mine', x: 2000, y: 280 },
      { type: 'mine', x: 2080, y: 300 },
      { type: 'mine', x: 2040, y: 250 },
      { type: 'fab', x: 2100, y: 200 },
      { type: 'fab', x: 2100, y: 400 },
      { type: 'fab', x: 2150, y: 350 },
    ],
  },
  {
    triggerX: 900,
    enemies: [
      { type: 'fab', x: 2200, y: 240 },
      { type: 'fab', x: 2250, y: 280 },
      { type: 'fab', x: 2300, y: 260 },
      { type: 'fab', x: 2200, y: 400 },
      { type: 'fab', x: 2250, y: 430 },
    ],
  },
  {
    triggerX: 1100,
    enemies: [
      { type: 'fab', x: 2500, y: 270 },
      { type: 'fab', x: 2550, y: 320 },
      { type: 'fab', x: 2600, y: 290 },
      { type: 'fab', x: 2500, y: 400 },
      { type: 'fab', x: 2550, y: 430 },
      { type: 'mine', x: 2650, y: 310 },
    ],
  },

  // === SECTOR 2: FIRST BATTERY (1500-3000) ===
  {
    triggerX: 1500,
    label: 'COASTAL THREAT',
    enemies: [
      { type: 'cmb', x: 2800, y: 130 },
      { type: 'fab', x: 2700, y: 240 },
      { type: 'fab', x: 2750, y: 280 },
      { type: 'fab', x: 2700, y: 400 },
      { type: 'fab', x: 2800, y: 350 },
      { type: 'fab', x: 2850, y: 420 },
    ],
  },
  {
    triggerX: 1600,
    label: 'DRONES INBOUND',
    enemies: [
      // First drone introduction — from Iran coast (top)
      { type: 'drone', x: 2900, y: -20, spawnDirection: 'top' },
      { type: 'drone', x: 2950, y: -30, spawnDirection: 'top' },
      { type: 'drone', x: 2880, y: -15, spawnDirection: 'top' },
    ],
  },
  {
    triggerX: 1700,
    enemies: [
      { type: 'fab', x: 3000, y: 220 },
      { type: 'fab', x: 3050, y: 260 },
      { type: 'fab', x: 3000, y: 380 },
      { type: 'fab', x: 3050, y: 420 },
      { type: 'mine', x: 3100, y: 300 },
      { type: 'mine', x: 3100, y: 340 },
    ],
  },
  {
    triggerX: 1900,
    enemies: [
      { type: 'mine', x: 3200, y: 270 },
      { type: 'mine', x: 3280, y: 290 },
      { type: 'mine', x: 3200, y: 420 },
      { type: 'mine', x: 3280, y: 400 },
      { type: 'fab', x: 3350, y: 350 },
      { type: 'fab', x: 3350, y: 240 },
      { type: 'fab', x: 3400, y: 300 },
    ],
  },
  {
    triggerX: 2100,
    label: 'SWARM INCOMING',
    enemies: [
      { type: 'fab', x: 3450, y: 220 },
      { type: 'fab', x: 3480, y: 260 },
      { type: 'fab', x: 3510, y: 240 },
      { type: 'fab', x: 3540, y: 280 },
      { type: 'fab', x: 3450, y: 380 },
      { type: 'fab', x: 3480, y: 410 },
      { type: 'fab', x: 3510, y: 390 },
      { type: 'fab', x: 3540, y: 430 },
    ],
  },
  {
    triggerX: 2300,
    enemies: [
      { type: 'fab', x: 3600, y: 200 },
      { type: 'fab', x: 3650, y: 250 },
      { type: 'fab', x: 3700, y: 220 },
      { type: 'fab', x: 3750, y: 280 },
      { type: 'fab', x: 3600, y: 400 },
      { type: 'fab', x: 3650, y: 430 },
      { type: 'cmb', x: 3800, y: 120 },
      { type: 'cmb', x: 3850, y: 140 },
    ],
  },
  {
    triggerX: 2500,
    enemies: [
      { type: 'fab', x: 3900, y: 250 },
      { type: 'fab', x: 3950, y: 290 },
      { type: 'fab', x: 3900, y: 400 },
      { type: 'mine', x: 3950, y: 340 },
      { type: 'mine', x: 4000, y: 320 },
      // Drones from Oman coast (bottom)
      { type: 'drone', x: 3950, y: 740, spawnDirection: 'bottom' },
      { type: 'drone', x: 4000, y: 750, spawnDirection: 'bottom' },
    ],
  },
  {
    triggerX: 2700,
    enemies: [
      { type: 'mine', x: 4000, y: 260 },
      { type: 'mine', x: 4060, y: 280 },
      { type: 'mine', x: 4000, y: 400 },
      { type: 'mine', x: 4060, y: 420 },
      { type: 'mine', x: 4030, y: 340 },
      { type: 'fab', x: 4100, y: 340 },
      { type: 'fab', x: 4150, y: 360 },
      { type: 'fab', x: 4100, y: 220 },
      { type: 'fab', x: 4150, y: 440 },
    ],
  },

  // === SECTOR 3: GUNBOAT PATROL (3000-4500) ===
  {
    triggerX: 3000,
    label: 'GUNBOAT AHEAD',
    enemies: [
      { type: 'gunboat', x: 4400, y: 330 },
      { type: 'fab', x: 4300, y: 250 },
      { type: 'fab', x: 4350, y: 400 },
      { type: 'fab', x: 4300, y: 200 },
      { type: 'fab', x: 4350, y: 440 },
      { type: 'fab', x: 4250, y: 300 },
    ],
  },
  {
    triggerX: 3100,
    label: 'DRONE AMBUSH',
    enemies: [
      // Drones from behind the convoy!
      { type: 'drone', x: 0, y: 280, spawnDirection: 'behind' },
      { type: 'drone', x: 0, y: 350, spawnDirection: 'behind' },
      { type: 'drone', x: 0, y: 420, spawnDirection: 'behind' },
    ],
  },
  {
    triggerX: 3200,
    label: 'SWARM ATTACK',
    enemies: [
      { type: 'fab', x: 4550, y: 220 },
      { type: 'fab', x: 4580, y: 250 },
      { type: 'fab', x: 4610, y: 230 },
      { type: 'fab', x: 4640, y: 260 },
      { type: 'fab', x: 4670, y: 240 },
      { type: 'fab', x: 4550, y: 390 },
      { type: 'fab', x: 4580, y: 420 },
      { type: 'fab', x: 4610, y: 400 },
      { type: 'fab', x: 4640, y: 430 },
      { type: 'fab', x: 4670, y: 410 },
    ],
  },
  {
    triggerX: 3400,
    enemies: [
      { type: 'cmb', x: 4700, y: 140 },
      { type: 'cmb', x: 4900, y: 130 },
      { type: 'fab', x: 4800, y: 260 },
      { type: 'fab', x: 4850, y: 300 },
      { type: 'fab', x: 4800, y: 400 },
      { type: 'fab', x: 4850, y: 430 },
      { type: 'mine', x: 4750, y: 340 },
    ],
  },
  {
    triggerX: 3500,
    label: 'HELO INBOUND',
    enemies: [
      { type: 'helicopter', x: 4800, y: -30, spawnDirection: 'top' },
      { type: 'helicopter', x: 4850, y: -40, spawnDirection: 'top' },
    ],
  },
  {
    triggerX: 3600,
    enemies: [
      { type: 'fab', x: 4950, y: 240 },
      { type: 'fab', x: 5000, y: 270 },
      { type: 'fab', x: 4950, y: 400 },
      { type: 'fab', x: 5000, y: 430 },
      { type: 'gunboat', x: 5050, y: 340 },
    ],
  },
  {
    triggerX: 3800,
    enemies: [
      { type: 'fab', x: 5100, y: 220 },
      { type: 'fab', x: 5150, y: 260 },
      { type: 'fab', x: 5200, y: 240 },
      { type: 'fab', x: 5100, y: 400 },
      { type: 'fab', x: 5150, y: 430 },
      { type: 'fab', x: 5200, y: 410 },
      { type: 'fab', x: 5250, y: 300 },
      { type: 'fab', x: 5250, y: 350 },
      { type: 'mine', x: 5250, y: 280 },
      { type: 'mine', x: 5250, y: 410 },
      { type: 'mine', x: 5300, y: 340 },
    ],
  },
  {
    triggerX: 4000,
    enemies: [
      { type: 'fab', x: 5350, y: 230 },
      { type: 'fab', x: 5400, y: 260 },
      { type: 'fab', x: 5350, y: 400 },
      { type: 'fab', x: 5400, y: 430 },
      { type: 'cmb', x: 5450, y: 130 },
    ],
  },
  {
    triggerX: 4200,
    enemies: [
      { type: 'cmb', x: 5500, y: 120 },
      { type: 'mine', x: 5450, y: 270 },
      { type: 'mine', x: 5520, y: 290 },
      { type: 'mine', x: 5450, y: 400 },
      { type: 'mine', x: 5520, y: 420 },
      { type: 'mine', x: 5480, y: 340 },
      { type: 'fab', x: 5600, y: 340 },
      { type: 'fab', x: 5600, y: 240 },
      { type: 'fab', x: 5600, y: 440 },
    ],
  },

  // === SECTOR 4: HEAVY ASSAULT (4500-6000) ===
  {
    triggerX: 4500,
    label: 'HEAVY RESISTANCE',
    enemies: [
      { type: 'gunboat', x: 5900, y: 300 },
      { type: 'cmb', x: 5800, y: 130 },
      { type: 'cmb', x: 5850, y: 150 },
      { type: 'fab', x: 5700, y: 250 },
      { type: 'fab', x: 5750, y: 400 },
      { type: 'fab', x: 5850, y: 440 },
      { type: 'fab', x: 5700, y: 200 },
      { type: 'fab', x: 5750, y: 350 },
      { type: 'fab', x: 5850, y: 280 },
      // Coordinated drone strike from both coasts
      { type: 'drone', x: 5800, y: -20, spawnDirection: 'top' },
      { type: 'drone', x: 5850, y: -30, spawnDirection: 'top' },
      { type: 'drone', x: 5800, y: 740, spawnDirection: 'bottom' },
      { type: 'drone', x: 5850, y: 750, spawnDirection: 'bottom' },
    ],
  },
  {
    triggerX: 4600,
    label: 'DRONE SWARM',
    enemies: [
      // Multi-direction drone swarm
      { type: 'drone', x: 5950, y: -20, spawnDirection: 'top' },
      { type: 'drone', x: 6000, y: -25, spawnDirection: 'top' },
      { type: 'drone', x: 6050, y: -15, spawnDirection: 'top' },
      { type: 'drone', x: 5950, y: 740, spawnDirection: 'bottom' },
      { type: 'drone', x: 6000, y: 745, spawnDirection: 'bottom' },
      { type: 'drone', x: 0, y: 300, spawnDirection: 'behind' },
      { type: 'drone', x: 0, y: 380, spawnDirection: 'behind' },
    ],
  },
  {
    triggerX: 4650,
    label: 'AIR ASSAULT',
    enemies: [
      { type: 'helicopter', x: 6000, y: -25, spawnDirection: 'top' },
      { type: 'helicopter', x: 0, y: 200, spawnDirection: 'behind' },
      { type: 'fab', x: 5950, y: 300 },
      { type: 'fab', x: 6000, y: 380 },
    ],
  },
  {
    triggerX: 4700,
    label: 'SWARM WAVE',
    enemies: [
      { type: 'fab', x: 6050, y: 210 },
      { type: 'fab', x: 6080, y: 240 },
      { type: 'fab', x: 6110, y: 220 },
      { type: 'fab', x: 6140, y: 250 },
      { type: 'fab', x: 6170, y: 230 },
      { type: 'fab', x: 6050, y: 380 },
      { type: 'fab', x: 6080, y: 410 },
      { type: 'fab', x: 6110, y: 390 },
      { type: 'fab', x: 6140, y: 420 },
      { type: 'fab', x: 6170, y: 400 },
    ],
  },
  {
    triggerX: 4900,
    enemies: [
      { type: 'fab', x: 6200, y: 200 },
      { type: 'fab', x: 6250, y: 230 },
      { type: 'fab', x: 6300, y: 210 },
      { type: 'fab', x: 6200, y: 380 },
      { type: 'fab', x: 6250, y: 410 },
      { type: 'fab', x: 6300, y: 390 },
      { type: 'fab', x: 6350, y: 300 },
      { type: 'fab', x: 6350, y: 340 },
      { type: 'cmb', x: 6350, y: 140 },
      { type: 'gunboat', x: 6400, y: 320 },
    ],
  },
  {
    triggerX: 5100,
    enemies: [
      { type: 'fab', x: 6450, y: 240 },
      { type: 'fab', x: 6500, y: 270 },
      { type: 'fab', x: 6450, y: 400 },
      { type: 'fab', x: 6500, y: 430 },
      { type: 'mine', x: 6550, y: 300 },
      { type: 'mine', x: 6550, y: 340 },
      { type: 'mine', x: 6550, y: 380 },
    ],
  },
  {
    triggerX: 5200,
    enemies: [
      { type: 'mine', x: 6500, y: 260 },
      { type: 'mine', x: 6560, y: 280 },
      { type: 'mine', x: 6620, y: 270 },
      { type: 'mine', x: 6500, y: 400 },
      { type: 'mine', x: 6560, y: 420 },
      { type: 'mine', x: 6620, y: 410 },
      { type: 'mine', x: 6580, y: 340 },
      { type: 'cmb', x: 6700, y: 125 },
      { type: 'fab', x: 6650, y: 340 },
      { type: 'fab', x: 6700, y: 350 },
      { type: 'fab', x: 6650, y: 230 },
      { type: 'fab', x: 6700, y: 440 },
    ],
  },

  // === SECTOR 5: THE GAUNTLET (6000-7200) ===
  {
    triggerX: 5600,
    label: 'THE GAUNTLET',
    enemies: [
      { type: 'cmb', x: 6900, y: 120 },
      { type: 'cmb', x: 7100, y: 135 },
      { type: 'cmb', x: 7000, y: 145 },
      { type: 'gunboat', x: 7000, y: 320 },
      { type: 'fab', x: 6950, y: 250 },
      { type: 'fab', x: 7000, y: 430 },
      { type: 'fab', x: 7050, y: 260 },
      { type: 'fab', x: 6950, y: 400 },
      { type: 'fab', x: 7050, y: 200 },
      { type: 'mine', x: 7000, y: 280 },
      { type: 'mine', x: 7000, y: 400 },
      { type: 'mine', x: 7050, y: 340 },
    ],
  },
  {
    triggerX: 5800,
    label: 'MEGA SWARM',
    enemies: [
      { type: 'fab', x: 7150, y: 210 },
      { type: 'fab', x: 7180, y: 240 },
      { type: 'fab', x: 7210, y: 220 },
      { type: 'fab', x: 7240, y: 250 },
      { type: 'fab', x: 7270, y: 230 },
      { type: 'fab', x: 7150, y: 380 },
      { type: 'fab', x: 7180, y: 410 },
      { type: 'fab', x: 7210, y: 390 },
      { type: 'fab', x: 7240, y: 420 },
      { type: 'fab', x: 7270, y: 400 },
      { type: 'gunboat', x: 7200, y: 310 },
      // Drones from all directions during the mega swarm
      { type: 'drone', x: 7200, y: -20, spawnDirection: 'top' },
      { type: 'drone', x: 7250, y: -30, spawnDirection: 'top' },
      { type: 'drone', x: 7200, y: 740, spawnDirection: 'bottom' },
      { type: 'drone', x: 0, y: 340, spawnDirection: 'behind' },
      { type: 'drone', x: 0, y: 260, spawnDirection: 'behind' },
    ],
  },
  {
    triggerX: 6000,
    enemies: [
      { type: 'fab', x: 7300, y: 220 },
      { type: 'fab', x: 7350, y: 250 },
      { type: 'fab', x: 7400, y: 230 },
      { type: 'fab', x: 7300, y: 400 },
      { type: 'fab', x: 7350, y: 430 },
      { type: 'fab', x: 7400, y: 410 },
      { type: 'fab', x: 7450, y: 300 },
      { type: 'fab', x: 7450, y: 350 },
      { type: 'cmb', x: 7500, y: 130 },
      { type: 'cmb', x: 7550, y: 120 },
      { type: 'mine', x: 7450, y: 280 },
      { type: 'mine', x: 7450, y: 410 },
    ],
  },
  {
    triggerX: 6200,
    label: 'HELO STRIKE',
    enemies: [
      { type: 'fab', x: 7550, y: 240 },
      { type: 'fab', x: 7600, y: 270 },
      { type: 'fab', x: 7550, y: 400 },
      { type: 'fab', x: 7600, y: 430 },
      { type: 'gunboat', x: 7650, y: 340 },
      { type: 'helicopter', x: 7500, y: -20, spawnDirection: 'top' },
      { type: 'helicopter', x: 7550, y: -35, spawnDirection: 'top' },
      { type: 'helicopter', x: 0, y: 350, spawnDirection: 'behind' },
      { type: 'mine', x: 7550, y: 340 },
      { type: 'mine', x: 7600, y: 340 },
    ],
  },
  {
    triggerX: 6400,
    label: 'FINAL APPROACH',
    enemies: [
      { type: 'gunboat', x: 7700, y: 280 },
      { type: 'gunboat', x: 7800, y: 400 },
      { type: 'gunboat', x: 7750, y: 340 },
      { type: 'cmb', x: 7700, y: 120 },
      { type: 'cmb', x: 7800, y: 130 },
      { type: 'fab', x: 7600, y: 240 },
      { type: 'fab', x: 7650, y: 260 },
      { type: 'fab', x: 7600, y: 420 },
      { type: 'fab', x: 7650, y: 440 },
      { type: 'fab', x: 7700, y: 200 },
      { type: 'fab', x: 7700, y: 460 },
      { type: 'mine', x: 7750, y: 340 },
      { type: 'mine', x: 7800, y: 340 },
      { type: 'mine', x: 7850, y: 340 },
      // Final drone barrage from all sides
      { type: 'drone', x: 7700, y: -20, spawnDirection: 'top' },
      { type: 'drone', x: 7750, y: -25, spawnDirection: 'top' },
      { type: 'drone', x: 7800, y: -15, spawnDirection: 'top' },
      { type: 'drone', x: 7700, y: 740, spawnDirection: 'bottom' },
      { type: 'drone', x: 7750, y: 745, spawnDirection: 'bottom' },
      { type: 'drone', x: 7800, y: 750, spawnDirection: 'bottom' },
      { type: 'drone', x: 0, y: 250, spawnDirection: 'behind' },
      { type: 'drone', x: 0, y: 350, spawnDirection: 'behind' },
      { type: 'drone', x: 0, y: 450, spawnDirection: 'behind' },
    ],
  },
];

export function getEncountersForCamera(cameraX: number, prevCameraX: number): Encounter[] {
  return ENCOUNTERS.filter(e => e.triggerX > prevCameraX && e.triggerX <= cameraX);
}
