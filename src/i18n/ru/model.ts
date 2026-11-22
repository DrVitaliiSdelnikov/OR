import { UnitSystem } from '../../core/units';

export interface FormulaTexts {
  title: string;
  formula: string;
  core: string;
  accuracy: string;
}

export interface FormulaRanges {
  windRange: string;
  windSpeed: string;
  atmosphereNear: string;
  atmosphereFar: string;
  angleNear: string;
  angleFar: string;
  leadRange: string;
}

const IMPERIAL_FORMULAS = {
  distance: 'Д (ярды) = размер (дюймы) × 27,78 / MIL',
  wind: 'W = V⊥ (миль/ч) × Д (ярды) / K, K — из строки ДОПЕ',
  atmosphere: 'ΔВЕРТ = (59 − T) / 10 × «холоднее» + (P − 29,92) / 0,3 × «давление»',
  lead: 'L = 488,9 × V⊥ (миль/ч) × t / Д (ярды)',
};

const METRIC_FORMULAS: typeof IMPERIAL_FORMULAS = {
  distance: 'Д = размер (м) × 1000 / MIL',
  wind: 'W = V⊥ (м/с) × Д (м) / K, K — из строки ДОПЕ',
  atmosphere: 'ΔВЕРТ = (15 − T) / 10 × «холоднее на 10» + (P − 1013) / 10 × «давление +10»',
  lead: 'L = V⊥ × t × 1000 / Д',
};

export const model = {
  title: 'Модель и сверка',
  back: 'Назад',
  link: 'Модель и сверка →',
  intro: 'Как считается полёт пули, где модель упрощает и чем это проверено.',
  loading: 'Считаю…',
  effectsTitle: 'Что учитывает ядро',
  effects: [
    { title: 'Модель точечной массы', text: 'js-ballistics с движком bclibc: траектория считается шагами, по ней летит каждая пуля.' },
    { title: 'Сопротивление', text: 'G7 или G1 с BC патрона; BC отнесён к атмосфере ICAO или ASM.' },
    { title: 'Атмосфера', text: 'Температура, давление на станции и влажность; высота над морем — через давление.' },
    { title: 'Ветер', text: 'По зонам дистанции, меняется во времени.' },
    { title: 'Угол места', text: 'Дальность по линии прицела, падение — по горизонтали.' },
    { title: 'Деривация', text: 'По шагу и направлению нарезов и длине пули.' },
    { title: 'Кориолис', text: 'По широте и азимуту стрельбы: вбок и по вертикали.' },
  ],
  assumptionsTitle: 'Допущения',
  assumptions: (p: { zeroTemperature: string; zeroPressure: string }) => [
    'Кривые сопротивления — стандартные G7 и G1, а не измеренная кривая конкретной пули',
    'Ветер только горизонтальный: восходящих и нисходящих потоков нет',
    'Аэродинамический прыжок (вертикаль от бокового ветра) не моделируется',
    `Ноль — на ровной линии в стандартной атмосфере ICAO: ${p.zeroTemperature}, ${p.zeroPressure}`,
    'Скорость у дула постоянная: длина ствола и температура пороха не учитываются',
    'Высота над морем влияет только через давление на станции',
  ],
  formulasTitle: 'Игровые формулы рядом с ядром',
  formulasIntro: 'По ним вы считаете в блокноте, по ним проверяется шаг в САМ. Пуля летит по ядру; разница — серый лепесток «упрощение формулы» в разборе.',
  playerLabel: 'Игрок',
  coreLabel: 'Ядро',
  accuracyLabel: 'Точность',
  formulas: (system: UnitSystem, p: FormulaRanges): FormulaTexts[] => {
    const formulas = system === 'imperial' ? IMPERIAL_FORMULAS : METRIC_FORMULAS;
    return [
      { title: 'Дальность', formula: formulas.distance, core: 'знает настоящую дальность; ошибка миллинга — шаг «дальность» в разборе', accuracy: 'допуск класса: ±5 % в 1 классе, ±10 % во 2' },
      { title: 'Ветер', formula: formulas.wind, core: 'ветер по зонам вдоль трассы, во времени', accuracy: `меньше клика на ${p.windRange} при V⊥ до ${p.windSpeed}` },
      { title: 'Атмосфера', formula: formulas.atmosphere, core: 'плотность воздуха по температуре, давлению и влажности', accuracy: `до клика до ${p.atmosphereNear}, до 2 кликов на ${p.atmosphereFar}` },
      { title: 'Угол места', formula: 'ВЕРТ = (ДОПЕ + Z) × cos α − Z, Z — угол нуля', core: 'траектория под углом', accuracy: `±30°: до клика до ${p.angleNear}, до 2 кликов на ${p.angleFar}` },
      { title: 'Деривация', formula: 'колонка ДЕР строки ДОПЕ', core: 'по шагу нарезов и длине пули', accuracy: 'погода и высота меняют её не больше чем на 0,03 MIL' },
      { title: 'Кориолис', formula: 'вбок 1000 × Ω × t × sin φ; по вертикали × cos φ × sin азимута', core: 'вращение Земли в уравнениях полёта', accuracy: 'до 0,03 MIL от ядра' },
      { title: 'Упреждение', formula: formulas.lead, core: 'цель смещается за время полёта этой пули', accuracy: `меньше полклика на ${p.leadRange}` },
    ];
  },
  comparisonTitle: 'Сверка с эталоном',
  source: (p: { library: string; version: string; date: string }) =>
    `Эталон — ${p.library} ${p.version}, решатель ELR, посчитан ${p.date}. Числа ядра считаются сейчас, на этом устройстве.`,
  tolerance: (p: { range: string; vertical: string; wind: string; time: string; timeOnIncline: string }) =>
    `Допуск на ${p.range}: возвышение ≤ ${p.vertical} MIL, вбок ≤ ${p.wind} MIL, время ≤ ${p.time} (под углом ≤ ${p.timeOnIncline})`,
  cartridges: {
    '308-175': '.308 175 гр',
    '65cm-140': '6,5 Creedmoor 140 гр',
    '223-77': '.223 77 гр',
    '338lm-300': '.338 LM 300 гр',
  } as Record<string, string>,
  sets: {
    'sea-level-calm': () => 'Уровень моря · штиль',
    'altitude-1500-wind-3': (p: { altitude: string; wind: string }) => `${p.altitude} · ветер ${p.wind} с 3 ч`,
    'uphill-15-coriolis-55n-east': (p: { angleDeg: number; latitudeDeg: number }) => `Подъём ${p.angleDeg}° · ${p.latitudeDeg}° с. ш. · на восток`,
  },
  distanceHeader: (p: { unit: string }) => `ДИСТ, ${p.unit}`,
  ourUpHeader: 'ВЕРТ ядро',
  referenceUpHeader: 'ВЕРТ эталон',
  upDifferenceHeader: 'Δ ВЕРТ',
  rightDifferenceHeader: 'Δ ВБОК',
  timeDifferenceHeader: 'Δ t',
  timeDifference: (p: { value: string }) => `${p.value} %`,
  summary: (p: { up: string; right: string; time: string; verdict: string }) => `Наибольшее |Δ|: ВЕРТ ${p.up} · ВБОК ${p.right} MIL · время ${p.time} % — ${p.verdict}`,
  within: 'в допуске',
  outside: 'вне допуска',
  alignment: 'Чтобы сравнивать одно и то же, эталону заданы ровный ноль и BC по ICAO, а аэродинамический прыжок вынесен отдельно: ядро его не моделирует.',
  inclineNote: 'Под углом ядро тормозит пулю на подъёме слабее, чем lob ELR: время полёта короче. Обе — модели; что ближе к реальной пуле, покажет только сверка с измерениями.',
};
