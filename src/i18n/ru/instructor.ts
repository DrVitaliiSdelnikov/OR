import { decimal } from '../format';

export type DialDirection = 'up' | 'down' | 'right' | 'left';

const DIAL_DIRECTIONS: Record<DialDirection, string> = { up: 'вверх', down: 'вниз', right: 'вправо', left: 'влево' };

const listText = (values: readonly number[]): string => values.join(', ');

export const instructor = {
  dial: (p: { direction: DialDirection; clicks: number }) => `Крути ${DIAL_DIRECTIONS[p.direction]}: ещё ${p.clicks} кл.`,
  enter: 'Внеси итог на барабаны',
  firstClicks: {
    scope: (p: { distanceM: number }) => `Это прицел. Цель — гонг на ${p.distanceM} м`,
    notebook: 'Открой блокнот: там поправка',
    dope: (p: { dopeMil: number }) => `ДОПЕ — падение пули: ↑ ${p.dopeMil.toFixed(1)} MIL`,
    sideDrum: (p: { windageClicks: number }) => `Боковой — ветер. Сегодня штиль, ${p.windageClicks}`,
    aim: 'Наведи перекрестие на гонг: тяни картинку',
    fire: 'Огонь',
    review: 'Разбор — после каждого выстрела. Прочитай и жми ДАЛЬШЕ',
  },
  zeroing: {
    zero: (p: { distanceM: number }) => `Прицел сбит. Пристреляем на ${p.distanceM} м`,
    aim: 'Наведи перекрестие в центр мишени',
    cold: 'Первый — холодный. Огонь',
    group: 'Ещё три в одну точку — группа',
    correction: 'Поправка в кликах — перенеси барабанами',
    reaim: 'Барабан сдвинул картинку — наведи снова в центр',
  },
  breathAndTrigger: {
    breath: (p: { calmS: number }) => `Задержи дыхание — метка дрожит меньше. Окно ${p.calmS} с`,
    notebook: (p: { exerciseId: string }) => `Поправка — как в ${p.exerciseId}: открой блокнот`,
    aim: 'Наведи перекрестие на гонг: тяни картинку',
    press: 'Держи ДЕРЖАТЬ, дави ОГОНЬ плавно',
    bolt: 'Затвор: вверх, назад, вперёд, вниз',
    pulse: 'Пульс сбивает. Дыши между выстрелами',
  },
  windAndStation: {
    wind: 'Ветер. Сначала замерь его станцией',
    stationTab: 'Станция — во вкладке «Условия»',
    measure: (p: { seconds: number }) => `Держи «Замер» ${p.seconds} с`,
    windTab: 'Скорость есть. Теперь «Ветер»',
    clock: (p: { speedMps: number }) => `Стрелка — откуда дует, по флажку у бруствера. Скорость — ${p.speedMps.toFixed(1)}, со станции`,
  },
  zoneFlags: {
    flags: (p: { distancesM: readonly number[] }) => `Ветер по трассе разный. Флажки на ${listText(p.distancesM)} м — левее цели, веди прицел к ним`,
    flagTap: 'Тапни флажок — угол и скорость запишутся в блокнот',
    weights: 'Вес зоны — её доля в среднем ветре. Веса — из строки ДОПЕ на твоей дистанции',
    zonesStep: 'Средний ветер — сумма: вес × V⊥ зоны. Станция — с вкладки «Ветер», флажки — из стекла',
  },
  patrol: {
    patrol: 'Скорость и направление цели — здесь. Стрелка меняется на развороте',
    leadStep: 'Посчитай упреждение: шаг «Упреждение» в блокноте',
    holdLead: 'Упреждение держи сеткой впереди цели, барабан не трогай. Веди сетку за целью и стреляй',
    ambush: 'Засада: поставь сетку впереди на упреждение и жди, пока цель дойдёт',
  },
  milling: {
    notebook: 'Открой блокнот: дистанция неизвестна',
    distanceTab: 'Меряй гонг сеткой — вкладка «Дистанция»',
    milling: (p: { sizeM: number }) => `Гонг ${decimal(p.sizeM)} м. Коснись верхнего и нижнего края, затем «Посчитать»`,
    result: (p: { sizeM: number; reticleMil: number; distanceM: number }) =>
      `Д = ${decimal(p.sizeM)} × 1000 / ${p.reticleMil.toFixed(2)} = ${Math.round(p.distanceM)} м`,
  },
  manualEasy: {
    notebook: 'Теперь считаешь сам. Открой блокнот',
    windFirst: (p: { exerciseId: string }) => `Сначала ветер — как в ${p.exerciseId}: станция и часы`,
    sam: 'Ветер записан. Теперь посчитай его сам',
    chips: 'Тапни слот формулы и положи чип: V⊥, потом D',
    tape: 'Набери по формуле V⊥ × D ÷ K и запиши шаг',
  },
  cartridgeChange: {
    magazine: (p: { cartridgeLetter: string }) => `Магазин пуст. Дальше — патрон ${p.cartridgeLetter}`,
    card: (p: { cartridgeLetter: string }) => `У патрона ${p.cartridgeLetter} своя карточка ДОПЕ — пересчитай`,
  },
  manualHard: {
    traps: 'Сложный: среди чипов — ловушки, константа — в слоте',
    call: 'Где была сетка при выстреле? Отметь сам',
    dopeNote: 'Поправка по второму — запиши карандашом в ДОПЕ',
  },
  forgottenFactor: (p: { factorName: string; contribution: string }) => `Учти ${p.factorName.toUpperCase()}: ${p.contribution}`,
};
