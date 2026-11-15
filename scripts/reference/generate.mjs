import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = new URL('../../src/core/reference/', import.meta.url);
const LOB_VERSION = JSON.parse(readFileSync(new URL('node_modules/@joelbenway/lob/package.json', import.meta.url), 'utf8')).version;
const CASE_SCRIPT = fileURLToPath(new URL('lob-case.mjs', import.meta.url));
const DISTANCES_M = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const METERS_PER_FOOT = 0.3048;
const GRAMS_PER_GRAIN = 0.06479891;

const RIFLE = { sightHeightCm: 5, zeroM: 100, twistDirection: 'right' };

const CARTRIDGES = [
  { id: '308-175', name: '.308 175 гр', grains: 175, fps: 2600, bulletDiameterIn: 0.308, bulletLengthIn: 1.24, ballisticCoefficient: 0.243, twistInchesPerTurn: 10 },
  { id: '65cm-140', name: '6,5 Creedmoor 140 гр', grains: 140, fps: 2710, bulletDiameterIn: 0.264, bulletLengthIn: 1.366, ballisticCoefficient: 0.326, twistInchesPerTurn: 8 },
  { id: '223-77', name: '.223 77 гр', grains: 77, fps: 2750, bulletDiameterIn: 0.224, bulletLengthIn: 0.995, ballisticCoefficient: 0.19, twistInchesPerTurn: 8 },
  { id: '338lm-300', name: '.338 Lapua Magnum 300 гр', grains: 300, fps: 2750, bulletDiameterIn: 0.338, bulletLengthIn: 1.7, ballisticCoefficient: 0.383, twistInchesPerTurn: 10 },
];

const SETS = [
  {
    id: 'sea-level-calm',
    atmosphere: { temperatureC: 15, pressureHpa: 1013, relativeHumidity: 0.5, altitudeM: 0 },
    wind: null,
    geometry: { lookAngleDeg: 0, coriolis: null, isSpinDriftOn: true },
  },
  {
    id: 'altitude-1500-wind-3',
    atmosphere: { temperatureC: 5, pressureHpa: 845.6, relativeHumidity: 0.5, altitudeM: 1500 },
    wind: { speedMps: 4, clock: 3, fromDeg: 270 },
    geometry: { lookAngleDeg: 0, coriolis: null, isSpinDriftOn: true },
  },
  {
    id: 'uphill-15-coriolis-55n-east',
    atmosphere: { temperatureC: 15, pressureHpa: 1013, relativeHumidity: 0.5, altitudeM: 0 },
    wind: null,
    geometry: { lookAngleDeg: 15, coriolis: { latitudeDeg: 55, azimuthDeg: 90 }, isSpinDriftOn: true },
  },
];

const CLOCK_HOURS = 12;

function mirroredWind(wind) {
  return { ...wind, clock: (CLOCK_HOURS - wind.clock) % CLOCK_HOURS || CLOCK_HOURS, fromDeg: (360 - wind.fromDeg) % 360 };
}

function lobRows(input) {
  return JSON.parse(execFileSync(process.execPath, [CASE_SCRIPT, JSON.stringify(input)], { encoding: 'utf8' }));
}

function lobInput(cartridge, set, { isSpinDriftOn, wind = set.wind }) {
  return {
    cartridge,
    rifle: RIFLE,
    atmosphere: set.atmosphere,
    wind,
    geometry: { ...set.geometry, isSpinDriftOn },
    distancesM: DISTANCES_M,
  };
}

const generatedAt = new Date().toISOString().slice(0, 10);
for (const cartridge of CARTRIDGES) {
  const sets = SETS.map(set => {
    const rows = lobRows(lobInput(cartridge, set, { isSpinDriftOn: set.geometry.isSpinDriftOn }));
    const withoutSpin = lobRows(lobInput(cartridge, set, { isSpinDriftOn: false }));
    const mirrored = set.wind ? lobRows(lobInput(cartridge, set, { isSpinDriftOn: set.geometry.isSpinDriftOn, wind: mirroredWind(set.wind) })) : rows;
    return {
      id: set.id,
      atmosphere: set.atmosphere,
      windZones: set.wind ? [{ speedMps: set.wind.speedMps, fromDeg: set.wind.fromDeg }] : [],
      geometry: set.geometry,
      rows: rows.map((row, index) => ({
        ...row,
        upMil: (row.upMil + mirrored[index].upMil) / 2,
        aerodynamicJumpUpMil: (row.upMil - mirrored[index].upMil) / 2,
        spinDriftRightMil: row.impactRightMil - withoutSpin[index].impactRightMil,
      })),
    };
  });
  const reference = {
    source: {
      library: '@joelbenway/lob',
      version: LOB_VERSION,
      generatedAt,
      generator: 'scripts/reference/generate.mjs',
      notes: [
        'BC отнесён к ICAO (bcAtmosphere), как в js-ballistics; по умолчанию lob берёт Army Standard Metro',
        'решатель ELR (solveInverseELRYds): плотность меняется с высотой по пути; на ровной линии совпадает с обычным',
        'ноль — ровный, в стандартной атмосфере ICAO (15 °C, 1013,25 гПа, 0 %), угол нуля найден прямым решением lob (zeroAngleMoa); сама lob пристреливает под углом и в атмосфере выстрела',
        'каждый набор — в отдельном процессе: lob 0.14.0 сохраняет шаг нарезов между запусками',
        'скорость в lob — целые fps; muzzleVelocityMps — точный перевод этих fps',
        'ветер с 3 ч (у нас fromDeg 270) — lob windHeading(9): lob 0.14.0 читает часы как «куда дует» (на 12 падение меньше, чем на 6), вопреки своей документации',
        'upMil — поправка вверх относительно нуля; impactRightMil — уход пули вправо относительно линии прицела',
        'lob добавляет аэродинамический прыжок: вертикальный сдвиг от бокового ветра, антисимметричный по ветру (с 3 ч −0,13, с 9 ч +0,13 MIL для .308 на 4 м/с). Наш движок его не моделирует: upMil — среднее прогонов с ветром и с зеркальным ветром, сам прыжок — aerodynamicJumpUpMil',
      ],
    },
    cartridge: {
      name: cartridge.name,
      massG: Number((cartridge.grains * GRAMS_PER_GRAIN).toFixed(6)),
      bulletDiameterIn: cartridge.bulletDiameterIn,
      bulletLengthMm: Number((cartridge.bulletLengthIn * 25.4).toFixed(4)),
      dragModel: 'G7',
      ballisticCoefficient: cartridge.ballisticCoefficient,
      muzzleVelocityMps: Number((cartridge.fps * METERS_PER_FOOT).toFixed(6)),
    },
    rifle: { ...RIFLE, twistInchesPerTurn: cartridge.twistInchesPerTurn },
    sets,
  };
  writeFileSync(new URL(`${cartridge.id}.json`, OUTPUT_DIR), JSON.stringify(reference, null, 2) + '\n');
  console.log(`${cartridge.id}: ${sets.map(set => `${set.id} ${set.rows.at(-1).upMil.toFixed(3)}↑ ${set.rows.at(-1).impactRightMil.toFixed(3)}→`).join(' · ')}`);
}
