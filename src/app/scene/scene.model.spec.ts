import { describe, expect, it } from 'vitest';
import { ptPerMil } from '../../sim/scope-model';
import { FLAG_DEG_PER_MPS } from '../../core/content';
import { aimLimitsMil, bermLayout, trolleyFrame, FLAG_PHOTOS, flagFootY, flagHitBox, flagIndexAt, flagPole, flagReading, flagSprite, gongFrame, grassFrame, isFlagBeforeBerm, grassSwayPt, groundFrame, groundLineY, hitMarkFrame, horizonY, PHOTO, skyFrame } from './scene.model';

const GLASS_PT = 276;
const AT_8X = ptPerMil(8);
const target = { x: 138, y: 138 };
const halfMetreAt300 = (0.25 / 300) * 1000;

describe('scene layout — the gong', () => {
  it('0.5 m at 300 m on 8×: the plate is 1.67 MIL wide and centred on the target', () => {
    const frame = gongFrame(target, halfMetreAt300, AT_8X);
    const platePt = frame.width * (PHOTO.gong.plateDiameterPx / PHOTO.gong.width);
    expect(platePt).toBeCloseTo(1.667 * AT_8X, 1);
    expect(frame.x + PHOTO.gong.plateCentrePx.x * (frame.width / PHOTO.gong.width)).toBeCloseTo(target.x, 6);
    expect(frame.y + PHOTO.gong.plateCentrePx.y * (frame.height / PHOTO.gong.height)).toBeCloseTo(target.y, 6);
  });

  it('the ground under the stand lies 1.48 plate diameters below the centre', () => {
    expect(groundLineY(target, halfMetreAt300, AT_8X)).toBeCloseTo(target.y + 1.48 * 1.667 * AT_8X, 0);
  });
});

describe('scene layout — the berm', () => {
  it('2 m high: 6.67 MIL at 300 m, 3.33 at 600 m; its foot on the ground line', () => {
    const groundY = 200;
    const near = bermLayout(target.x, groundY, 300, AT_8X, GLASS_PT);
    const far = bermLayout(target.x, groundY, 600, AT_8X, GLASS_PT);
    const bermPt = (layout: typeof near) => (PHOTO.berm.basePx - PHOTO.berm.topPx) * (layout.tileHeight / PHOTO.berm.height);
    expect(bermPt(near)).toBeCloseTo(6.667 * AT_8X, 1);
    expect(bermPt(far)).toBeCloseTo(3.333 * AT_8X, 1);
    expect(near.y + PHOTO.berm.basePx * (near.tileHeight / PHOTO.berm.height)).toBeCloseTo(groundY, 6);
    expect(near.y + PHOTO.berm.topPx * (near.tileHeight / PHOTO.berm.height)).toBeCloseTo(near.topY, 6);
  });

  it('tiles cover the whole glass whatever the aim offset', () => {
    for (const targetX of [-400, 0, 138, 700]) {
      const layout = bermLayout(targetX, 200, 300, ptPerMil(3), GLASS_PT);
      expect(layout.tileXs[0]).toBeLessThanOrEqual(0);
      expect(layout.tileXs[layout.tileXs.length - 1] + layout.tileWidth).toBeGreaterThanOrEqual(GLASS_PT);
      for (const x of layout.tileXs) {
        const tilesFromCentred = (x - (targetX - layout.tileWidth / 2)) / layout.tileWidth;
        expect(Math.abs(tilesFromCentred - Math.round(tilesFromCentred))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('scene layout — the ground and the sky', () => {
  it('the ground photo starts at the berm foot; its berm scale is 2 m, so 600 m is half the size of 300 m', () => {
    const near = groundFrame(target.x, 200, 300, AT_8X);
    const far = groundFrame(target.x, 200, 600, AT_8X);
    expect(near.y).toBe(200);
    expect(near.height / PHOTO.ground.height * PHOTO.ground.bermPx).toBeCloseTo(6.667 * AT_8X, 1);
    expect(far.width).toBeCloseTo(near.width / 2, 6);
    expect(near.x + near.width / 2).toBeCloseTo(target.x, 6);
  });

  it('the sky reaches down to the berm top and drifts at a quarter of the aim', () => {
    const centred = skyFrame(138, 40, GLASS_PT);
    const shifted = skyFrame(138 + 100, 40, GLASS_PT);
    expect(centred.y + centred.height).toBeCloseTo(40, 6);
    expect(centred.y).toBeLessThanOrEqual(0);
    expect(shifted.x - centred.x).toBeCloseTo(25, 6);
    expect(centred.x).toBeLessThanOrEqual(0);
    expect(centred.x + centred.width).toBeGreaterThanOrEqual(GLASS_PT);
  });
});

describe('scene layout — hit marks and near grass', () => {
  it('a hit inside the plate gets an 8 cm lead mark; a miss does not', () => {
    const hit = hitMarkFrame(target, { upMrad: 0.3, rightMrad: -0.2 }, halfMetreAt300, 300, AT_8X)!;
    expect(hit.width).toBeCloseTo((80 / 300) * AT_8X, 6);
    expect(hit.x + hit.width / 2).toBeCloseTo(target.x - 0.2 * AT_8X, 6);
    expect(hit.y + hit.height / 2).toBeCloseTo(target.y - 0.3 * AT_8X, 6);
    expect(hitMarkFrame(target, { upMrad: 0.9, rightMrad: 0 }, halfMetreAt300, 300, AT_8X)).toBeNull();
    expect(hitMarkFrame(target, { upMrad: 0, rightMrad: 0 }, halfMetreAt300, 600, AT_8X)!.width).toBeCloseTo((80 / 600) * AT_8X, 6);
  });

  it('the horizon is 500 / D MIL above the ground under the target (eye 0.5 m over the ground)', () => {
    expect(horizonY(200, 300, AT_8X)).toBeCloseTo(200 - (500 / 300) * AT_8X, 6);
    expect(horizonY(200, 100, AT_8X)).toBeCloseTo(200 - 5 * AT_8X, 6);
  });

  it('a flag stands on its own ground: 200 m — 2.5 MIL below the horizon; behind the berm it is not drawn', () => {
    expect(flagFootY(100, 200, AT_8X)).toBeCloseTo(100 + 2.5 * AT_8X, 6);
    expect(isFlagBeforeBerm(200, 300)).toBe(true);
    expect(isFlagBeforeBerm(400, 300)).toBe(false);
    expect(isFlagBeforeBerm(300, 300)).toBe(false);
  });

  it('near grass stands in the world: tied to the target, tops 6 MIL below the horizon, centred on the target plus the sway', () => {
    const grass = grassFrame(138, 200, 300, AT_8X, 0);
    expect(grass.y).toBeCloseTo(horizonY(200, 300, AT_8X) + 6 * AT_8X, 6);
    expect(grass.x + grass.width / 2).toBeCloseTo(138, 6);
    const aimedAway = grassFrame(138 + 50, 200 - 30, 300, AT_8X, 0);
    expect(aimedAway.x - grass.x).toBeCloseTo(50, 6);
    expect(aimedAway.y - grass.y).toBeCloseTo(-30, 6);
    expect(grassFrame(138, 200, 300, AT_8X, 4).x - grass.x).toBeCloseTo(4, 6);
  });

  it('at 3× the grass reaches into the glass; at 12× it is out of the field of view below', () => {
    const glassHalf = 138;
    const at3 = grassFrame(138, 138 + 0.75 * ptPerMil(3), 300, ptPerMil(3), 0);
    const at12 = grassFrame(138, 138 + 0.75 * ptPerMil(12), 300, ptPerMil(12), 0);
    expect(at3.y).toBeLessThan(138 + glassHalf);
    expect(at12.y).toBeGreaterThan(138 + glassHalf);
  });

  it('near grass leans with the wind: the sign follows the wind, calm is still', () => {
    expect(grassSwayPt(0, 1.2)).toBe(0);
    expect(Math.sign(grassSwayPt(3, 0.4))).toBe(1);
    expect(Math.sign(grassSwayPt(-3, 0.4))).toBe(-1);
  });
});

describe('scene layout — how far the aim may go', () => {
  const fovHalf = (magnification: number) => 138 / ptPerMil(magnification);
  const groundUnderTarget = 1.48 * 1.667;

  it('300 m, 8×: the bottom of the view stops at the end of the ground photo, the top 6 MIL above the berm', () => {
    const limits = aimLimitsMil(300, halfMetreAt300, 8);
    const groundBottom = -groundUnderTarget - (PHOTO.ground.height / PHOTO.ground.bermPx) * (2000 / 300);
    expect(limits.minY).toBeCloseTo(groundBottom + fovHalf(8), 2);
    const bermTop = -groundUnderTarget + 2000 / 300;
    expect(limits.maxY).toBeCloseTo(Math.max(bermTop + 6 - fovHalf(8), 6), 2);
    expect([limits.minX, limits.maxX]).toEqual([-20, 20]);
  });

  it('the target and a 6 MIL hold stay reachable even when the scene is smaller than the view (3×, 1000 m)', () => {
    const limits = aimLimitsMil(1000, (0.25 / 1000) * 1000, 3);
    expect(limits.minY).toBeLessThanOrEqual(-6);
    expect(limits.maxY).toBeGreaterThanOrEqual(6);
  });

  it('100 m, 8× (zeroing): the berm is tall, so the top limit is the sky band above it, not the hold reserve', () => {
    const plateRadiusMil = (0.25 / 100) * 1000;
    const groundRatio = (PHOTO.gong.standBottomPx - PHOTO.gong.plateCentrePx.y) / PHOTO.gong.plateDiameterPx;
    const bermTop = -groundRatio * 2 * plateRadiusMil + 2000 / 100;
    expect(aimLimitsMil(100, plateRadiusMil, 8).maxY).toBeCloseTo(bermTop + 6 - fovHalf(8), 2);
  });

  it('more magnification — a narrower view — lets the aim go further down', () => {
    expect(aimLimitsMil(300, halfMetreAt300, 12).minY).toBeLessThan(aimLimitsMil(300, halfMetreAt300, 6).minY);
  });
});


describe('scene layout — the flag photo', () => {
  const at200 = (metres: number) => (metres / 200) * 1000 * AT_8X;

  it('picks the nearest photographed state and lifts the cloth by the rest', () => {
    const cases: [number, number, number][] = [
      [0, 25, -25],
      [30, 25, 5],
      [50, 45, 5],
      [58, 65, -7],
      [80, 80, 0],
    ];
    for (const [angleDeg, stateDeg, liftDeg] of cases) {
      const sprite = flagSprite(angleDeg / FLAG_DEG_PER_MPS, 200, AT_8X, 0);
      expect(FLAG_PHOTOS[sprite.photoIndex].stateDeg, `${angleDeg}°`).toBe(stateDeg);
      expect(sprite.liftDeg, `${angleDeg}°`).toBeCloseTo(liftDeg, 6);
    }
  });

  it('the attached edge is 0.6 m at the flag distance, whatever the photo', () => {
    for (const windMps of [1, 5, 9]) {
      const sprite = flagSprite(windMps, 200, AT_8X, 0);
      expect(sprite.ptPerPx * FLAG_PHOTOS[sprite.photoIndex].attachedEdgePx).toBeCloseTo(at200(0.6), 6);
    }
  });

  it('wind from the right mirrors the cloth to the left', () => {
    expect(flagSprite(4, 200, AT_8X, 0).side).toBe(1);
    expect(flagSprite(-4, 200, AT_8X, 0).side).toBe(-1);
  });

  it('calm air hangs still; wind flutters the cloth by no more than 3°', () => {
    for (const timeS of [0, 0.4, 1.3, 2.9]) {
      expect(flagSprite(0, 200, AT_8X, timeS).liftDeg).toBe(-25);
      const windy = flagSprite(5, 200, AT_8X, timeS);
      expect(Math.abs(windy.liftDeg - (45 - 45))).toBeLessThanOrEqual(3);
    }
    const lifts = [0.2, 0.6, 1.0].map(timeS => flagSprite(5, 200, AT_8X, timeS).liftDeg);
    expect(new Set(lifts.map(lift => lift.toFixed(3))).size).toBeGreaterThan(1);
  });
});

describe('flags along the range (A9.3a)', () => {
  const halfMetreAt600 = (0.25 / 600) * 1000;
  const MIN_TOUCH_PT = 44;

  it('U1: the reading is the cloth angle to 5° and that angle over 9° a m/s, signed by the side', () => {
    expect(flagReading(3.9)).toEqual({ angleDeg: 35, crosswindMps: 3.9, isAtLimit: false });
    expect(flagReading(-2)).toEqual({ angleDeg: 20, crosswindMps: -2.2, isAtLimit: false });
    expect(flagReading(12)).toEqual({ angleDeg: 80, crosswindMps: 8.9, isAtLimit: true });
    expect(flagReading(0)).toEqual({ angleDeg: 0, crosswindMps: 0, isAtLimit: false });
  });

  it('U2: on 8× the 200 m flag stands 12.5 MIL left of the target on its own ground, the pole 2.5 m tall', () => {
    const pole = flagPole(target, halfMetreAt600, 600, 200, AT_8X)!;
    const horizon = horizonY(groundLineY(target, halfMetreAt600, AT_8X), 600, AT_8X);
    expect(pole.x).toBeCloseTo(target.x - 12.5 * AT_8X, 6);
    expect(pole.bottomY).toBeCloseTo(flagFootY(horizon, 200, AT_8X), 6);
    expect(pole.bottomY - pole.topY).toBeCloseTo(12.5 * AT_8X, 6);
  });

  it('U2: a flag beyond the target is behind the berm — no pole, nothing to tap', () => {
    expect(flagPole(target, halfMetreAt600, 500, 600, AT_8X)).toBeNull();
  });

  it('U2: the touch box covers pole and cloth and is never smaller than 44 pt', () => {
    const far = flagHitBox(flagPole(target, halfMetreAt600, 700, 600, ptPerMil(3))!);
    expect(far.width).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
    expect(far.height).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
    const pole = flagPole(target, halfMetreAt600, 600, 200, AT_8X)!;
    const near = flagHitBox(pole);
    expect(near.x).toBeLessThanOrEqual(pole.x - 5 * AT_8X);
    expect(near.x + near.width).toBeGreaterThanOrEqual(pole.x + 5 * AT_8X);
    expect(near.y).toBeLessThanOrEqual(pole.topY);
    expect(near.y + near.height).toBeGreaterThanOrEqual(pole.bottomY);
  });

  it('U2: a tap finds the flag under it, the nearest pole when boxes overlap, nothing elsewhere', () => {
    const poles = [200, 400, 600].map(flagDistanceM => flagPole(target, halfMetreAt600, 700, flagDistanceM, ptPerMil(3)));
    expect(flagIndexAt({ x: poles[1]!.x + 1, y: (poles[1]!.topY + poles[1]!.bottomY) / 2 }, poles)).toBe(1);
    expect(flagIndexAt({ x: poles[0]!.x, y: poles[0]!.bottomY - 1 }, poles)).toBe(0);
    expect(flagIndexAt({ x: target.x + 60, y: target.y }, poles)).toBeNull();
    expect(flagIndexAt({ x: poles[2]!.x, y: poles[2]!.topY }, [poles[0], poles[1], null])).not.toBe(2);
    const overlapping = [
      { x: 100, topY: 100, bottomY: 160, clothPt: 30 },
      { x: 112, topY: 100, bottomY: 160, clothPt: 30 },
    ];
    expect(flagIndexAt({ x: 109, y: 130 }, overlapping)).toBe(1);
    expect(flagIndexAt({ x: 103, y: 130 }, overlapping)).toBe(0);
  });
});

describe('the patrol trolley (A9.3b)', () => {
  const AT_12X = ptPerMil(12);

  it('U6: at 300 m on 12× the body is 1.2 m = 4 MIL wide, centred under the gong, standing on its ground line', () => {
    const trolley = trolleyFrame(target, halfMetreAt300, 300, AT_12X);
    expect(trolley.body.width).toBeCloseTo(4 * AT_12X, 6);
    expect(trolley.body.x + trolley.body.width / 2).toBeCloseTo(target.x, 6);
    expect(trolley.body.y + trolley.body.height).toBeCloseTo(groundLineY(target, halfMetreAt300, AT_12X), 6);
    expect(trolley.body.height).toBeCloseTo((0.4 / 300) * 1000 * AT_12X, 6);
    expect(trolley.railY).toBeCloseTo(groundLineY(target, halfMetreAt300, AT_12X), 6);
  });

  it('two wheels under the body, inside its width', () => {
    const trolley = trolleyFrame(target, halfMetreAt300, 300, AT_12X);
    expect(trolley.wheels).toHaveLength(2);
    for (const wheel of trolley.wheels) {
      expect(wheel.x).toBeGreaterThanOrEqual(trolley.body.x);
      expect(wheel.x + wheel.width).toBeLessThanOrEqual(trolley.body.x + trolley.body.width);
    }
  });

  it('the aim may follow a patrol beyond the usual 20 MIL to the side', () => {
    const halfWidthM = 13.6;
    const limits = aimLimitsMil(300, halfMetreAt300, 8, halfWidthM);
    expect(limits.maxX).toBeGreaterThanOrEqual((halfWidthM / 300) * 1000);
    expect(limits.minX).toBe(-limits.maxX);
    expect(aimLimitsMil(300, halfMetreAt300, 8, 0).maxX).toBe(20);
  });
});
