import { Builder } from '@joelbenway/lob';

const METERS_PER_YARD = 0.9144;
const FEET_PER_METER = 1 / 0.3048;
const MIL_PER_MOA = 0.29088821;
const HPA_PER_INHG = 33.8639;
const MPH_PER_MPS = 1 / 0.44704;

const CLOCK_HOURS = 12;
const HALF_TURN_HOURS = 6;

// lob 0.14.0 читает часы как направление, куда дует ветер: на «12» падение меньше, чем на «6» (попутный), на «3» пуля уходит вправо.
// Документация lob говорит обратное («12 — встречный, 3 — справа налево»). Наши часы — откуда дует.
function lobClockBlowingToward(fromClock) {
  return ((fromClock + HALF_TURN_HOURS - 1) % CLOCK_HOURS) + 1;
}

const { cartridge, rifle, atmosphere, wind, geometry, distancesM } = JSON.parse(process.argv[2]);

const ZERO_RANGE_ATMOSPHERE = { temperatureC: 15, pressureHpa: 1013.25, relativeHumidity: 0, altitudeM: 0 };
const ZERO_SEARCH_MAX_MOA = 120;
const ZERO_SEARCH_STEPS = 60;

function builderFor(air) {
  const airAltitudeFt = air.altitudeM * FEET_PER_METER;
  return new Builder()
    .ballisticCoefficientPsi(cartridge.ballisticCoefficient)
    .bcDragFunction('G7')
    .bcAtmosphere('ICAO')
    .diameterInch(cartridge.bulletDiameterIn)
    .lengthInch(cartridge.bulletLengthIn)
    .massGrains(cartridge.grains)
    .initialVelocityFps(cartridge.fps)
    .opticHeightInches(rifle.sightHeightCm / 2.54)
    .altitudeOfFiringSiteFt(airAltitudeFt)
    .altitudeOfBarometerFt(airAltitudeFt)
    .altitudeOfThermometerFt(airAltitudeFt)
    .airPressureInHg(air.pressureHpa / HPA_PER_INHG)
    .temperatureDegF(air.temperatureC * 1.8 + 32)
    .relativeHumidityPercent(air.relativeHumidity * 100);
}

// Ноль — на ровном стрельбище в стандартной атмосфере, как в нашем движке. Сама lob пристреливает под углом выстрела
// и в атмосфере выстрела, поэтому угол ровного нуля ищем её же прямым решением: высота пули на дистанции нуля = 0.
function flatZeroAngleMoa() {
  const zeroRangeYd = rifle.zeroM / METERS_PER_YARD;
  const heightAtZeroInch = zeroAngleMoa => {
    const zeroBuilder = builderFor(ZERO_RANGE_ATMOSPHERE).zeroAngleMoa(zeroAngleMoa);
    const zeroContext = zeroBuilder.build();
    const [row] = zeroContext.solveYds([zeroRangeYd]);
    zeroContext.dispose();
    zeroBuilder.dispose();
    return row.elevationInch;
  };
  let low = 0;
  let high = ZERO_SEARCH_MAX_MOA;
  for (let step = 0; step < ZERO_SEARCH_STEPS; step++) {
    const middle = (low + high) / 2;
    if (heightAtZeroInch(middle) < 0) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

const zeroAngleMoa = flatZeroAngleMoa();
let builder = builderFor(atmosphere).zeroAngleMoa(zeroAngleMoa).rangeAngleDeg(geometry.lookAngleDeg);
if (geometry.isSpinDriftOn) {
  builder = builder.twistInchesPerTurn(rifle.twistDirection === 'left' ? -cartridge.twistInchesPerTurn : cartridge.twistInchesPerTurn);
}
if (wind) {
  builder = builder.windSpeedMph(wind.speedMps * MPH_PER_MPS).windHeading(lobClockBlowingToward(wind.clock));
}
if (geometry.coriolis) {
  builder = builder.latitudeDeg(geometry.coriolis.latitudeDeg).azimuthDeg(geometry.coriolis.azimuthDeg);
}

const context = builder.build();
const rangesYd = distancesM.map(distanceM => distanceM / METERS_PER_YARD);
const sightAdjustments = context.solveInverseELRYds(rangesYd);
const rows = sightAdjustments.map((row, index) => ({
  distanceM: distancesM[index],
  upMil: row.elevationMoa * MIL_PER_MOA,
  impactRightMil: -row.deflectionMoa * MIL_PER_MOA,
  timeS: row.timeOfFlightSec,
}));
context.dispose();
builder.dispose();
process.stdout.write(JSON.stringify(rows));
