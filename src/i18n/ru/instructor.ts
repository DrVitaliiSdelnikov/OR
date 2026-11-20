import { decimal, plural, PluralForms } from '../format';

export type DialDirection = 'up' | 'down' | 'right' | 'left';

const DIAL_DIRECTIONS: Record<DialDirection, string> = { up: 'вверх', down: 'вниз', right: 'вправо', left: 'влево' };

const ERROR_FORMS: PluralForms = ['ошибка', 'ошибки', 'ошибок'];
const DAY_FORMS: PluralForms = ['день', 'дня', 'дней'];

export const instructor = {
  coach: {
    title: (p: { skill: string }) => `Тренер: ${p.skill}`,
    drill: (p: { title: string; level: string }) => `${p.title} · ${p.level}`,
    levels: { learn: 'обучение', timed: 'на время' },
    errors: (p: { count: number }) => `${p.count} ${plural(p.count, ERROR_FORMS)} за неделю`,
    errorsWithType: (p: { count: number; type: string }) => `${p.count} ${plural(p.count, ERROR_FORMS)} за неделю, чаще ${p.type}`,
    never: 'ещё не тренировали',
    stale: (p: { days: number }) => `не тренировали ${p.days} ${plural(p.days, DAY_FORMS)}`,
    weak: (p: { rating: number }) => `рейтинг ${p.rating} из 100`,
  },
  dial: (p: { direction: DialDirection; clicks: number }) => `Крути ${DIAL_DIRECTIONS[p.direction]}: ещё ${p.clicks} кл.`,
  enter: 'Внеси итог на барабаны',
  firstClicks: {
    scope: (p: { distance: string }) => `Это прицел. Цель — гонг на ${p.distance}`,
    notebook: 'Открой блокнот: там поправка',
    dope: (p: { dopeMil: number }) => `ДОПЕ — падение пули: ↑ ${decimal(p.dopeMil, 1)} MIL`,
    sideDrum: (p: { windageClicks: number }) => `Боковой — ветер. Сегодня штиль, ${p.windageClicks}`,
    aim: 'Наведи перекрестие на гонг: тяни картинку',
    fire: 'Огонь',
    review: 'Разбор — после каждого выстрела. Прочитай и жми ДАЛЬШЕ',
  },
  zeroing: {
    zero: (p: { distance: string }) => `Прицел сбит. Пристреляем на ${p.distance}`,
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
    clock: (p: { speed: string }) => `Стрелка — откуда дует, по флажку у бруствера. Скорость — ${p.speed}, со станции`,
  },
  zoneFlags: {
    flags: (p: { distances: string }) => `Ветер по трассе разный. Флажки на ${p.distances} — левее цели, веди прицел к ним`,
    flagTap: 'Тапни флажок — угол и скорость запишутся в блокнот',
    weights: 'Вес зоны — её доля в среднем ветре. Веса — из строки ДОПЕ на твоей дистанции',
    zonesStep: 'Средний ветер — сумма: вес × V⊥ зоны. Станция — с вкладки «Ветер», флажки — из стекла',
  },
  slope: {
    slope: 'Цель выше или ниже — угол места здесь. Под углом пуля падает меньше, чем в ДОПЕ',
    angleStep: 'Посчитай шаг «Угол места» в блокноте',
    angleFormula: '(E + Z) × cos − Z: E — строка ДОПЕ, Z — угол нуля из шапки карточки, cos — у фишки прибора',
  },
  longRange: {
    earth: (p: { distance: string }) => `Широта и азимут — здесь. Дальше ${p.distance} в расчёт входят деривация и вращение Земли`,
    steps: 'Посчитай «Деривацию» и «Кориолис» в блокноте',
    spinFormula: 'Деривация — колонка ДЕР строки ДОПЕ. Поправка — против ухода пули',
    coriolisFormula: 'Кориолис: 0,0729 × t × sin φ. В северном полушарии пуля уходит вправо — поправка влево',
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
    milling: (p: { size: string }) => `Гонг ${p.size}. Коснись верхнего и нижнего края, затем «Посчитать»`,
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
