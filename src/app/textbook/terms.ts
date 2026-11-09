import { cartridgeById, FLAG_DEG_PER_MPS, RIFLE, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from '../../core/content';
import { DopeCard, DopeRow, dopeRowAt } from '../../core/dope-card';
import { impactSoundDelayS, windClockShare } from '../../core/field';
import {
  atmosphereCorrectionMil,
  averageCrosswindMps,
  crosswindMps,
  leadMil,
  rangeByMilling,
  roundToClicks,
  windCorrectionMil,
} from '../../core/game-formulas';
import { CartridgeId } from '../../core/types';
import { MRAD_PER_MOA, scopeById } from '../../sim/scope-model';

export const TEXTBOOK_CHAPTERS = [
  'Винтовка',
  'Прицел',
  'Сетка',
  'Единицы',
  'Патрон',
  'Баллистика',
  'Ветер',
  'Дальность',
  'Атмосфера',
  'Стрелок',
  'Движущиеся цели',
  'Разбор',
] as const;

export type TextbookChapter = (typeof TEXTBOOK_CHAPTERS)[number];
export type CardsByCartridge = ReadonlyMap<CartridgeId, DopeCard>;

export interface TermFormula {
  line: string;
  variables: readonly { symbol: string; meaning: string }[];
}

export interface TermCard {
  term: string;
  chapter: TextbookChapter;
  phrase: string;
  formula?: TermFormula;
  example?: (cards: CardsByCartridge | null) => string | null;
  places: readonly string[];
  related: readonly string[];
}

const CLICK_MIL = 0.1;
const COURSE_SCOPE = scopeById('course-tree');
const CM_PER_MIL_PER_METRE = 0.1;
const GRAMS_PER_KG = 1000;
const ENERGY_ROUNDING_J = 10;
const ZONE_EXAMPLE_CROSSWINDS_MPS = [2, 3, 4, 0];
const ATMOSPHERE_COLUMN_STEP = 10;

function comma(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

function cmOnTarget(mil: number, distanceM: number): number {
  return mil * distanceM * CM_PER_MIL_PER_METRE;
}

function rowB(cards: CardsByCartridge | null, distanceM: number): DopeRow | null {
  const card = cards?.get('B');
  return card ? dopeRowAt(card, distanceM) : null;
}

function clicksText(mil: number): string {
  return `${Math.abs(roundToClicks(mil, CLICK_MIL))}\u00a0кл.`;
}

export const TERM_CARDS: readonly TermCard[] = [
  {
    term: 'винтовка',
    chapter: 'Винтовка',
    phrase: `Учебная винтовка ${RIFLE.name}: ствол, затвор, магазин на 5 патронов и спуск. Пристреляна на ${RIFLE.zeroM} м.`,
    places: ['позиция'],
    related: ['затвор', 'прицел', 'ноль'],
  },
  {
    term: 'холодный выстрел',
    chapter: 'Винтовка',
    phrase: 'Первый выстрел из холодного чистого ствола уходит чуть в сторону от остальных. Это свойство винтовки — его не поправляют барабаном, а помнят.',
    example: () => {
      const shift = RIFLE.coldBoreShiftMil;
      return `${RIFLE.name} на 300 м: ↑ ${comma(shift.upMrad, 2)} MIL = ${comma(cmOnTarget(shift.upMrad, 300), 1)} см, → ${comma(shift.rightMrad, 2)} MIL = ${comma(cmOnTarget(shift.rightMrad, 300), 1)} см`;
    },
    places: ['первый выстрел упражнения с упр. 02', 'разбор · серый лепесток «холодный ствол»'],
    related: ['группа', 'СТП', 'ноль'],
  },
  {
    term: 'затвор',
    chapter: 'Винтовка',
    phrase: 'После выстрела затвор открывают и закрывают: гильза выброшена, новый патрон в патроннике. Пока затвор открыт, спуск не работает.',
    places: ['позиция · дорожка затвора'],
    related: ['спуск', 'винтовка'],
  },
  {
    term: 'прицел',
    chapter: 'Прицел',
    phrase: 'Оптический прицел: объектив собирает свет, окуляр показывает картинку, внутри — сетка. Барабаны двигают сетку относительно ствола.',
    places: ['позиция'],
    related: ['сетка', 'кратность', 'барабан'],
  },
  {
    term: 'кратность',
    chapter: 'Прицел',
    phrase: 'Во сколько раз прицел приближает. На малой кратности шире поле зрения и легче найти цель, на большой — крупнее цель и заметнее качание.',
    example: () => `курсовой прицел: ${COURSE_SCOPE.magnificationMin}–${COURSE_SCOPE.magnificationMax}×`,
    places: ['позиция · колесо кратности'],
    related: ['прицел', 'фокальная плоскость'],
  },
  {
    term: 'фокальная плоскость',
    chapter: 'Прицел',
    phrase: 'Где внутри прицела стоит сетка. В первой сетка растёт вместе с целью, и метки верны на любой кратности. Во второй сетка всегда одного размера — метки верны только на одной кратности.',
    places: ['курсовой прицел — первая', 'свободная игра · прицел второй плоскости после упр. 12'],
    related: ['сетка', 'кратность', 'миллинг'],
  },
  {
    term: 'клик',
    chapter: 'Прицел',
    phrase: 'Один щелчок барабана: 0,1 MIL. Это 1 см на 100 м.',
    formula: {
      line: 'N = П / Ц',
      variables: [
        { symbol: 'N', meaning: 'сколько щелчков, до ближайшего целого' },
        { symbol: 'П', meaning: 'поправка, MIL' },
        { symbol: 'Ц', meaning: 'цена клика, 0,1 MIL' },
      ],
    },
    example: () => `П = 0,62 MIL: N = 0,62 / 0,1 = 6,2 → ${clicksText(0.62)}; на 300 м один клик — ${comma(cmOnTarget(CLICK_MIL, 300), 0)} см`,
    places: ['позиция · барабаны', 'блокнот · вкладка ИТОГ'],
    related: ['барабан', 'MIL', 'ZERO STOP'],
  },
  {
    term: 'барабан',
    chapter: 'Прицел',
    phrase: 'Ручки прицела: сверху ВЕРТ, сбоку ГОР. ВЕРТ поднимает попадание под дальность, ГОР уводит в сторону под ветер.',
    example: () => `курсовой прицел: ВЕРТ до ${COURSE_SCOPE.elevationTravelMrad} MIL, ГОР ±${COURSE_SCOPE.windageTravelMrad} MIL`,
    places: ['позиция · барабаны ВЕРТ и ГОР'],
    related: ['клик', 'ZERO STOP', 'ДОПЕ'],
  },
  {
    term: 'ZERO STOP',
    chapter: 'Прицел',
    phrase: 'Упор барабана ВЕРТ на отметке ноля: ниже не накрутить, и на ноль всегда можно вернуться на ощупь.',
    places: ['позиция · барабан ВЕРТ'],
    related: ['барабан', 'ноль'],
  },
  {
    term: 'сетка',
    chapter: 'Сетка',
    phrase: 'Метки в прицеле. У Ёлки — шкала вниз для удержания и в стороны для ветра, у MIL-dot — точки через 1 MIL. Сеткой меряют цель и держат поправку без барабана.',
    places: ['Ёлка — упр. 00–05', 'MIL-dot — с упр. 06'],
    related: ['миллинг', 'фокальная плоскость', 'MIL'],
  },
  {
    term: 'миллинг',
    chapter: 'Сетка',
    phrase: 'Измерить цель сеткой: сколько MIL занимает её известный размер. Дальше — дальность по формуле тысячной.',
    example: () => `гонг 0,5 м занял в сетке 1,25 MIL → ${comma(rangeByMilling(0.5, 1.25), 0)} м`,
    places: ['блокнот · вкладка ДИСТАНЦИЯ'],
    related: ['формула тысячной', 'сетка'],
  },
  {
    term: 'MIL',
    chapter: 'Единицы',
    phrase: 'Тысячная — угол, под которым 1 м виден с 1000 м. 0,1 MIL — 1 см на 100 м. Поправки, сетка и барабаны в курсе — в MIL.',
    formula: {
      line: 'см = MIL × D / 10',
      variables: [
        { symbol: 'см', meaning: 'размер на цели, сантиметры' },
        { symbol: 'MIL', meaning: 'угол в тысячных' },
        { symbol: 'D', meaning: 'дистанция, м' },
      ],
    },
    example: () => `0,62 MIL на 300 м = 0,62 × 300 / 10 = ${comma(cmOnTarget(0.62, 300), 1)} см`,
    places: ['весь курс'],
    related: ['MOA', 'клик'],
  },
  {
    term: 'MOA',
    chapter: 'Единицы',
    phrase: 'Угловая минута, 1/60 градуса: около 2,9 см на 100 м. Прицел в MOA — в свободной игре, в курсе всё в MIL.',
    formula: {
      line: 'MOA = MIL × 3,44',
      variables: [
        { symbol: 'MOA', meaning: 'угол в минутах' },
        { symbol: 'MIL', meaning: 'угол в тысячных' },
      ],
    },
    example: () => `1,4 MIL = ${comma(1.4 / MRAD_PER_MOA, 2)} MOA; клик MOA-прицела ¼ MOA = ${comma(0.25 * MRAD_PER_MOA, 3)} MIL`,
    places: ['свободная игра · прицел MOA после упр. 06'],
    related: ['MIL', 'клик'],
  },
  {
    term: 'карточка патрона',
    chapter: 'Патрон',
    phrase: 'Паспорт патрона: масса и скорость пули, баллистический коэффициент, разброс скорости.',
    example: () => {
      const cartridge = cartridgeById('B');
      return `${cartridge.name}: ${comma(cartridge.massG, 1)} г, ${cartridge.muzzleVelocityMps} ± ${cartridge.muzzleVelocitySdMps} м/с, G7 ${comma(cartridge.bcG7, 3)}`;
    },
    places: ['упр. 08 · смена магазина', 'свободная игра · выбор патрона'],
    related: ['баллистический коэффициент', 'энергия', 'разброс скорости'],
  },
  {
    term: 'баллистический коэффициент',
    chapter: 'Патрон',
    phrase: 'Насколько пуля обтекаемая (BC по модели G7). Чем выше, тем медленнее она теряет скорость: меньше падает и меньше сносится ветром.',
    example: () => (['A', 'B', 'C'] as const).map(id => `${cartridgeById(id).name} — ${comma(cartridgeById(id).bcG7, 3)}`).join(' · '),
    places: ['карточка патрона'],
    related: ['карточка патрона', 'константа ветра'],
  },
  {
    term: 'энергия',
    chapter: 'Патрон',
    phrase: 'Сила удара пули. У дула у трёх патронов почти одинаковая, а на дальности сохраняет больше та пуля, у которой выше BC.',
    formula: {
      line: 'E = m × v² / 2',
      variables: [
        { symbol: 'E', meaning: 'энергия у дула, Дж' },
        { symbol: 'm', meaning: 'масса пули, кг' },
        { symbol: 'v', meaning: 'скорость у дула, м/с' },
      ],
    },
    example: () => {
      const cartridge = cartridgeById('B');
      const massKg = cartridge.massG / GRAMS_PER_KG;
      const energyJ = (massKg * cartridge.muzzleVelocityMps ** 2) / 2;
      return `${cartridge.name}: ${comma(massKg, 4)} × ${cartridge.muzzleVelocityMps}² / 2 ≈ ${Math.round(energyJ / ENERGY_ROUNDING_J) * ENERGY_ROUNDING_J} Дж`;
    },
    places: ['карточка патрона'],
    related: ['баллистический коэффициент', 'карточка патрона'],
  },
  {
    term: 'разброс скорости',
    chapter: 'Патрон',
    phrase: 'Пули одной партии вылетают с чуть разной скоростью. Медленная падает ниже — на дальности группа вытягивается по вертикали.',
    example: () => {
      const cartridge = cartridgeById('B');
      return `${cartridge.name}: ${cartridge.muzzleVelocityMps} ± ${cartridge.muzzleVelocitySdMps} м/с`;
    },
    places: ['карточка патрона', 'разбор · лепесток «разброс патрона»'],
    related: ['группа', 'карточка патрона'],
  },
  {
    term: 'ДОПЕ',
    chapter: 'Баллистика',
    phrase: 'Таблица поправок своей винтовки и патрона: для каждой дистанции — ВЕРТ в MIL и кликах, время полёта, константа ветра, поправки на холод и давление.',
    example: cards => {
      const row = rowB(cards, 300);
      return row ? `Патрон Б, 300 м: ВЕРТ ${comma(row.elevationMil, 1)} MIL = ${row.clicks} кл.` : null;
    },
    places: ['блокнот · вкладка ДОПЕ', 'журнал · карточки'],
    related: ['строка ДОПЕ', 'ноль', 'барабан', 'своя карточка'],
  },
  {
    term: 'строка ДОПЕ',
    chapter: 'Баллистика',
    phrase: 'Одна строка карточки — для одной дистанции. Если дистанция между строками, значение берут пропорцией между соседними.',
    example: cards => {
      const lower = rowB(cards, 400);
      const upper = rowB(cards, 500);
      const between = rowB(cards, 450);
      return lower && upper && between
        ? `Патрон Б, 450 м — между ${comma(lower.elevationMil, 1)} (400 м) и ${comma(upper.elevationMil, 1)} (500 м): ВЕРТ ${comma(between.elevationMil, 2)} MIL = ${between.clicks} кл.`
        : null;
    },
    places: ['блокнот · вкладка ДОПЕ'],
    related: ['ДОПЕ', 'формула тысячной'],
  },
  {
    term: 'ноль',
    chapter: 'Баллистика',
    phrase: `Дистанция, на которой при барабанах на нуле пуля приходит в центр. У винтовки курса — ${RIFLE.zeroM} м: дальше пуля падает, и ВЕРТ берут по ДОПЕ.`,
    places: ['упр. 02 · пристрелка сбитого прицела'],
    related: ['ZERO STOP', 'ДОПЕ', 'СТП'],
  },
  {
    term: 'САМ',
    chapter: 'Баллистика',
    phrase: 'Режим блокнота, где поправку считаешь сам: дистанция → строка ДОПЕ → условия → ветер → итог на барабаны.',
    formula: {
      line: 'ВЕРТ = ДОПЕ + ΔВЕРТ;  ГОР = W',
      variables: [
        { symbol: 'ВЕРТ', meaning: 'барабан вверх, MIL' },
        { symbol: 'ДОПЕ', meaning: 'значение строки карточки' },
        { symbol: 'ΔВЕРТ', meaning: 'поправка условий' },
        { symbol: 'ГОР', meaning: 'барабан в сторону, MIL' },
        { symbol: 'W', meaning: 'поправка на ветер' },
      ],
    },
    places: ['блокнот · режим САМ'],
    related: ['ДОПЕ', 'поправка условий', 'ветер'],
  },
  {
    term: 'время полёта',
    chapter: 'Баллистика',
    phrase: 'Сколько летит пуля до цели — колонка t карточки. Нужно для упреждения; звон гонга приходит ещё позже — звуку тоже надо долететь.',
    example: cards => {
      const row = rowB(cards, 400);
      return row
        ? `Патрон Б, 400 м: t = ${comma(row.timeOfFlightS, 2)} с, звон — через ${comma(impactSoundDelayS(row.timeOfFlightS, 400, STANDARD_TEMPERATURE_C), 1)} с после выстрела`
        : null;
    },
    places: ['блокнот · вкладка ДОПЕ, колонка t'],
    related: ['упреждение', 'ДОПЕ'],
  },
  {
    term: 'ветер',
    chapter: 'Ветер',
    phrase: 'Боковой ветер сносит пулю. Поправку берут против сноса барабаном ГОР или сеткой.',
    formula: {
      line: 'W = V⊥ × D / K',
      variables: [
        { symbol: 'W', meaning: 'поправка на ветер, MIL' },
        { symbol: 'V⊥', meaning: 'боковая часть ветра, м/с (скорость × доля по часам)' },
        { symbol: 'D', meaning: 'дистанция до цели, м' },
        { symbol: 'K', meaning: 'константа ветра из строки ДОПЕ' },
      ],
    },
    example: cards => {
      const row = rowB(cards, 300);
      if (!row) {
        return null;
      }
      const correctionMil = Math.abs(windCorrectionMil(3, 9, 300, row.windConstant));
      return `ветер 3 м/с с 9 ч, 300 м, патрон Б: W = 3 × 300 / ${row.windConstant} = ${comma(correctionMil, 2)} MIL → ${clicksText(correctionMil)} влево`;
    },
    places: ['блокнот · вкладка ВЕТЕР'],
    related: ['боковая составляющая', 'константа ветра', 'правило часов'],
  },
  {
    term: 'правило часов',
    chapter: 'Ветер',
    phrase: 'Направление ветра называют по циферблату: 12 — от цели в лицо, 6 — в спину, 3 — справа, 9 — слева. Ветер слева сносит вправо — брать влево.',
    places: ['позиция · метеостанция', 'блокнот · часы ветра'],
    related: ['доля по часам', 'боковая составляющая'],
  },
  {
    term: 'флажок',
    chapter: 'Ветер',
    phrase: 'Флажки на трассе показывают ветер там, где летит пуля. Чем сильнее ветер, тем больше угол.',
    example: () => `флажок отклонён на 27°: 27 / ${FLAG_DEG_PER_MPS} = ${comma(27 / FLAG_DEG_PER_MPS, 0)} м/с`,
    places: ['позиция · флажки 200, 400, 600 м'],
    related: ['зоны ветра', 'метеостанция'],
  },
  {
    term: 'метеостанция',
    chapter: 'Ветер',
    phrase: 'Станция у стрелка меряет ветер на позиции: скорость и часы. Дальше по трассе ветер может быть другим.',
    places: ['позиция · метеостанция', 'блокнот · вкладка ВЕТЕР'],
    related: ['флажок', 'правило часов'],
  },
  {
    term: 'боковая составляющая',
    chapter: 'Ветер',
    phrase: 'Часть ветра, которая дует поперёк трассы. Сносит пулю только она.',
    formula: {
      line: 'V⊥ = V × доля',
      variables: [
        { symbol: 'V⊥', meaning: 'боковой ветер, м/с' },
        { symbol: 'V', meaning: 'скорость ветра со станции, м/с' },
        { symbol: 'доля', meaning: 'доля по часам' },
      ],
    },
    example: () => `4 м/с с 2 ч: V⊥ = 4 × ${comma(windClockShare(2), 2)} = ${comma(crosswindMps(4, 2), 2)} м/с`,
    places: ['блокнот · вкладка ВЕТЕР'],
    related: ['доля по часам', 'ветер'],
  },
  {
    term: 'доля по часам',
    chapter: 'Ветер',
    phrase: 'Какая часть ветра работает поперёк. Быстрая армейская оценка — «наискось половина», но в САМ считай по таблице.',
    example: () => [3, 2, 1, 12].map(hours => `${hours} ч → ${comma(windClockShare(hours), 2)}`).join(' · '),
    places: ['блокнот · часы ветра', 'справочник формул'],
    related: ['правило часов', 'боковая составляющая'],
  },
  {
    term: 'константа ветра',
    chapter: 'Ветер',
    phrase: 'Число K из строки ДОПЕ для формулы ветра. Падает с дистанцией: пуля замедляется и дольше летит в ветре.',
    example: cards => {
      const near = rowB(cards, 200);
      const far = rowB(cards, 600);
      return near && far ? `Патрон Б: K = ${near.windConstant} на 200 м, ${far.windConstant} на 600 м` : null;
    },
    places: ['блокнот · вкладка ДОПЕ, колонка K'],
    related: ['ветер', 'строка ДОПЕ', 'баллистический коэффициент'],
  },
  {
    term: 'зоны ветра',
    chapter: 'Ветер',
    phrase: 'Трасса делится на зоны: у стрелка, у флажков 200, 400 и 600 м. Ветер в каждой свой, а вес зоны зависит от дистанции.',
    example: cards => {
      const row = rowB(cards, 500);
      return row ? `Патрон Б, 500 м — веса: ${row.zoneWeights.map(weight => comma(weight, 2)).join(' · ')}` : null;
    },
    places: ['блокнот · вкладка ВЕТЕР, упр. с зонами'],
    related: ['средний ветер', 'флажок'],
  },
  {
    term: 'средний ветер',
    chapter: 'Ветер',
    phrase: 'Один боковой ветер вместо нескольких зон: каждая зона входит со своим весом.',
    formula: {
      line: 'V⊥ср = Σ вес × V⊥',
      variables: [
        { symbol: 'V⊥ср', meaning: 'средний боковой ветер, м/с' },
        { symbol: 'вес', meaning: 'доля зоны из строки ДОПЕ' },
        { symbol: 'V⊥', meaning: 'боковой ветер зоны, м/с' },
      ],
    },
    example: cards => {
      const row = rowB(cards, 500);
      if (!row) {
        return null;
      }
      const parts = row.zoneWeights.map((weight, index) => `${comma(weight, 2)} × ${ZONE_EXAMPLE_CROSSWINDS_MPS[index]}`).join(' + ');
      return `500 м, зоны ${ZONE_EXAMPLE_CROSSWINDS_MPS.join(' · ')} м/с: ${parts} = ${comma(averageCrosswindMps(ZONE_EXAMPLE_CROSSWINDS_MPS, row.zoneWeights), 2)} м/с`;
    },
    places: ['блокнот · вкладка ВЕТЕР, упр. с зонами'],
    related: ['зоны ветра', 'ветер'],
  },
  {
    term: 'мираж',
    chapter: 'Ветер',
    phrase: 'Дрожание нагретого воздуха в прицеле. Мираж течёт по ветру: по наклону видно направление и силу слабого ветра.',
    places: ['прицел · дальние цели'],
    related: ['зоны ветра', 'флажок'],
  },
  {
    term: 'формула тысячной',
    chapter: 'Дальность',
    phrase: 'Дальность по размеру цели в сетке. Ошибается вместе с глазом: на контрасте, ровной местности и склоне цель кажется ближе или дальше.',
    formula: {
      line: 'Д = размер × 1000 / mil',
      variables: [
        { symbol: 'Д', meaning: 'дальность, м' },
        { symbol: 'размер', meaning: 'известный размер цели, м' },
        { symbol: 'mil', meaning: 'сколько MIL цель заняла в сетке' },
      ],
    },
    example: () => `гонг 0,5 м, в сетке 1,25 MIL: Д = 0,5 × 1000 / 1,25 = ${comma(rangeByMilling(0.5, 1.25), 0)} м`,
    places: ['блокнот · вкладка ДИСТАНЦИЯ'],
    related: ['миллинг', 'строка ДОПЕ'],
  },
  {
    term: 'плотность воздуха',
    chapter: 'Атмосфера',
    phrase: 'Холодный и плотный воздух сильнее тормозит пулю — она падает ниже. Тёплый и разрежённый — наоборот.',
    places: ['блокнот · вкладка УСЛОВИЯ'],
    related: ['эталон +15 / 1013', 'поправка условий'],
  },
  {
    term: 'эталон +15 / 1013',
    chapter: 'Атмосфера',
    phrase: 'Условия, под которые посчитана карточка ДОПЕ: +15 °C и 1013 гПа. Если погода такая же, поправка условий — ноль.',
    places: ['карточка ДОПЕ', 'блокнот · вкладка УСЛОВИЯ'],
    related: ['поправка условий', 'плотность воздуха'],
  },
  {
    term: 'поправка условий',
    chapter: 'Атмосфера',
    phrase: 'Добавка к ВЕРТ, когда погода не как в эталоне. Холоднее или выше давление — брать выше.',
    formula: {
      line: 'ΔВЕРТ = (15 − T) / 10 × Х + (P − 1013) / 10 × Р',
      variables: [
        { symbol: 'ΔВЕРТ', meaning: 'добавка к ВЕРТ, MIL' },
        { symbol: 'T', meaning: 'температура, °C' },
        { symbol: 'Х', meaning: 'колонка «холоднее на 10 °C» строки ДОПЕ' },
        { symbol: 'P', meaning: 'давление, гПа' },
        { symbol: 'Р', meaning: 'колонка «давление +10 гПа» строки ДОПЕ' },
      ],
    },
    example: cards => {
      const row = rowB(cards, 600);
      if (!row) {
        return null;
      }
      const temperatureC = -5;
      const pressureHpa = 1030;
      const colderTens = (STANDARD_TEMPERATURE_C - temperatureC) / ATMOSPHERE_COLUMN_STEP;
      const pressureTens = (pressureHpa - STANDARD_PRESSURE_HPA) / ATMOSPHERE_COLUMN_STEP;
      const correctionMil = atmosphereCorrectionMil(row, temperatureC, pressureHpa);
      return `Патрон Б, 600 м, −5 °C, ${pressureHpa} гПа: ${comma(colderTens, 0)} × ${comma(row.colderBy10CMil, 2)} + ${comma(pressureTens, 1)} × ${comma(row.pressureUp10HpaMil, 2)} = ${comma(correctionMil, 2)} MIL → ${clicksText(correctionMil)} вверх`;
    },
    places: ['блокнот · вкладка УСЛОВИЯ'],
    related: ['эталон +15 / 1013', 'САМ'],
  },
  {
    term: 'дыхание',
    chapter: 'Стрелок',
    phrase: 'Стреляют на паузе после выдоха: грудь не двигается, сетка качается меньше.',
    places: ['позиция · кнопка дыхания'],
    related: ['пульс', 'спуск'],
  },
  {
    term: 'спуск',
    chapter: 'Стрелок',
    phrase: 'Плавно дожать до выстрела, не дёргая. Рывок уводит пулю.',
    places: ['позиция · кнопка спуска'],
    related: ['дыхание', 'вызов', 'затвор'],
  },
  {
    term: 'пульс',
    chapter: 'Стрелок',
    phrase: 'Сердце качает сетку толчками. Выстрел — между ударами; после бега и задержки дыхания пульс чаще.',
    places: ['позиция · пульс в прицеле'],
    related: ['дыхание', 'спуск'],
  },
  {
    term: 'вызов',
    chapter: 'Стрелок',
    phrase: 'Сразу после выстрела отметить, где была сетка в миг спуска. Вызов отделяет ошибку стрелка от ошибки поправки.',
    places: ['разбор · вызов рядом с пробоиной'],
    related: ['спуск', 'поправка по второму выстрелу', 'группа'],
  },
  {
    term: 'упреждение',
    chapter: 'Движущиеся цели',
    phrase: 'Пока пуля летит, цель уходит. Стреляют туда, где цель будет, — сеткой впереди неё.',
    formula: {
      line: 'L = V⊥ × t / D × 1000',
      variables: [
        { symbol: 'L', meaning: 'упреждение, MIL' },
        { symbol: 'V⊥', meaning: 'скорость цели поперёк, м/с' },
        { symbol: 't', meaning: 'время полёта из строки ДОПЕ, с' },
        { symbol: 'D', meaning: 'дистанция, м' },
      ],
    },
    example: cards => {
      const row = rowB(cards, 400);
      return row
        ? `шаг 1,1 м/с поперёк, 400 м: L = 1,1 × ${comma(row.timeOfFlightS, 2)} / 400 × 1000 = ${comma(leadMil(1.1, 3, row.timeOfFlightS, 400), 2)} MIL`
        : null;
    },
    places: ['блокнот · шаг «Упреждение»'],
    related: ['время полёта', 'сопровождение', 'засада'],
  },
  {
    term: 'сопровождение',
    chapter: 'Движущиеся цели',
    phrase: 'Вести сетку вместе с целью, держа упреждение, и стрелять, не останавливая движение.',
    places: ['упр. 11 · движущийся дозор'],
    related: ['упреждение', 'засада'],
  },
  {
    term: 'засада',
    chapter: 'Движущиеся цели',
    phrase: 'Держать сетку неподвижно на пути цели и стрелять, когда цель дойдёт до упреждения.',
    places: ['упр. 11 · движущийся дозор'],
    related: ['упреждение', 'сопровождение'],
  },
  {
    term: 'группа',
    chapter: 'Разбор',
    phrase: 'Несколько пробоин с одной поправкой. По форме видно причину: струна по вертикали — разброс скорости или удержание, сдвиг вбок — ветер.',
    places: ['разбор · схема мишени', 'итог упражнения'],
    related: ['СТП', 'разброс скорости', 'холодный выстрел'],
  },
  {
    term: 'СТП',
    chapter: 'Разбор',
    phrase: 'Средняя точка попадания — центр группы. Поправку переносят по СТП, а не по отдельной пробоине.',
    places: ['упр. 02 · пристрелка', 'разбор · схема мишени'],
    related: ['группа', 'ноль', 'поправка по второму выстрелу'],
  },
  {
    term: 'поправка по второму выстрелу',
    chapter: 'Разбор',
    phrase: 'Увидел, куда ушёл первый выстрел, — перенеси барабанами на столько же обратно.',
    example: () => `ушёл на 0,3 MIL вправо и 0,2 ниже: ГОР ${clicksText(0.3)} влево, ВЕРТ ${clicksText(0.2)} вверх`,
    places: ['разбор · «пересчитать и повторить»'],
    related: ['СТП', 'вызов', 'своя карточка'],
  },
  {
    term: 'своя карточка',
    chapter: 'Разбор',
    phrase: 'Карандашные записи в ДОПЕ по своим выстрелам: если на дистанции вышло не как в карточке, запиши, как вышло.',
    places: ['разбор · карандаш «в ДОПЕ»', 'журнал · карточки'],
    related: ['ДОПЕ', 'поправка по второму выстрелу'],
  },
];
