import type { CheckErrorType } from '../../core/calc-check';
import type { CauseKind, MainCause } from '../../sim/miss-breakdown';
import type { ReticleMarkKind } from '../../sim/reticle';
import type { ReticleKind } from '../../sim/scope-model';
import { andList, decimal } from '../format';

const CHAPTERS = [
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

export type TextbookChapter = (typeof CHAPTERS)[number];

export interface TermTexts {
  term: string;
  forms?: readonly string[];
  chapter: TextbookChapter;
  phrase: string;
  formula?: { line: string; variables: readonly { symbol: string; meaning: string }[] };
  places: readonly string[];
  related: readonly string[];
}

const clickCount = (clicks: number): string => `${clicks} кл.`;
const roundedDecimal = (value: number, maxDigits: number): string => decimal(Number(value.toFixed(maxDigits)));
const arrow = (value: number, positive: string, negative: string): string => (value >= 0 ? positive : negative);

const terms = (p: { rifleName: string; zeroM: number; flagDistancesM: readonly number[] }) =>
  ({
    rifle: {
      term: 'винтовка',
      forms: ['винтовки', 'винтовку', 'винтовкой', 'винтовке'],
      chapter: 'Винтовка',
      phrase: `Учебная винтовка ${p.rifleName}: ствол, затвор, магазин на 5 патронов и спуск. Пристреляна на ${p.zeroM} м.`,
      places: ['позиция'],
      related: ['затвор', 'прицел', 'ноль'],
    },
    coldBore: {
      term: 'холодный выстрел',
      forms: ['холодного выстрела', 'холодным выстрелом'],
      chapter: 'Винтовка',
      phrase: 'Первый выстрел из холодного чистого ствола уходит чуть в сторону от остальных. Это свойство винтовки — его не поправляют барабаном, а помнят.',
      places: ['первый выстрел упражнения с упр. 02', 'разбор · серый лепесток «холодный ствол»'],
      related: ['группа', 'СТП', 'ноль'],
    },
    bolt: {
      term: 'затвор',
      forms: ['затвора', 'затвором', 'затвору'],
      chapter: 'Винтовка',
      phrase: 'После выстрела затвор открывают и закрывают: гильза выброшена, новый патрон в патроннике. Пока затвор открыт, спуск не работает.',
      places: ['позиция · дорожка затвора'],
      related: ['спуск', 'винтовка'],
    },
    scope: {
      term: 'прицел',
      forms: ['прицела', 'прицеле', 'прицелу', 'прицелом'],
      chapter: 'Прицел',
      phrase: 'Оптический прицел: объектив собирает свет, окуляр показывает картинку, внутри — сетка. Барабаны двигают сетку относительно ствола.',
      places: ['позиция'],
      related: ['сетка', 'кратность', 'барабан'],
    },
    magnification: {
      term: 'кратность',
      forms: ['кратности', 'кратностью'],
      chapter: 'Прицел',
      phrase: 'Во сколько раз прицел приближает. На малой кратности шире поле зрения и легче найти цель, на большой — крупнее цель и заметнее качание.',
      places: ['позиция · колесо кратности'],
      related: ['прицел', 'фокальная плоскость'],
    },
    focalPlane: {
      term: 'фокальная плоскость',
      forms: ['фокальной плоскости', 'фокальную плоскость'],
      chapter: 'Прицел',
      phrase: 'Где внутри прицела стоит сетка. В первой сетка растёт вместе с целью, и метки верны на любой кратности. Во второй сетка всегда одного размера — метки верны только на одной кратности.',
      places: ['курсовой прицел — первая', 'свободная игра · прицел второй плоскости после упр. 12'],
      related: ['сетка', 'кратность', 'миллинг'],
    },
    click: {
      term: 'клик',
      forms: ['клика', 'клики', 'кликов', 'кликах', 'кликами', 'кликом'],
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
      places: ['позиция · барабаны', 'блокнот · вкладка ИТОГ'],
      related: ['барабан', 'MIL', 'ZERO STOP'],
    },
    turret: {
      term: 'барабан',
      forms: ['барабана', 'барабаны', 'барабанов', 'барабанах', 'барабанами', 'барабаном', 'барабану'],
      chapter: 'Прицел',
      phrase: 'Ручки прицела: сверху ВЕРТ, сбоку ГОР. ВЕРТ поднимает попадание под дальность, ГОР уводит в сторону под ветер.',
      places: ['позиция · барабаны ВЕРТ и ГОР'],
      related: ['клик', 'ZERO STOP', 'ДОПЕ'],
    },
    zeroStop: {
      term: 'ZERO STOP',
      chapter: 'Прицел',
      phrase: 'Упор барабана ВЕРТ на отметке ноля: ниже не накрутить, и на ноль всегда можно вернуться на ощупь.',
      places: ['позиция · барабан ВЕРТ'],
      related: ['барабан', 'ноль'],
    },
    reticle: {
      term: 'сетка',
      forms: ['сетки', 'сетке', 'сетку', 'сеткой'],
      chapter: 'Сетка',
      phrase: 'Метки в прицеле. У Ёлки — шкала вниз для удержания и в стороны для ветра, у MIL-dot — точки через 1 MIL. Сеткой меряют цель и держат поправку без барабана.',
      places: ['Ёлка — упр. 00–05', 'MIL-dot — с упр. 06'],
      related: ['миллинг', 'фокальная плоскость', 'MIL'],
    },
    milling: {
      term: 'миллинг',
      forms: ['миллинга', 'миллингом'],
      chapter: 'Сетка',
      phrase: 'Измерить цель сеткой: сколько MIL занимает её известный размер. Дальше — дальность по формуле тысячной.',
      places: ['блокнот · вкладка ДИСТАНЦИЯ'],
      related: ['формула тысячной', 'сетка'],
    },
    mil: {
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
      places: ['весь курс'],
      related: ['MOA', 'клик'],
    },
    moa: {
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
      places: ['свободная игра · прицел MOA после упр. 06'],
      related: ['MIL', 'клик'],
    },
    cartridgeCard: {
      term: 'карточка патрона',
      forms: ['карточки патрона', 'карточку патрона', 'карточке патрона'],
      chapter: 'Патрон',
      phrase: 'Паспорт патрона: масса и скорость пули, баллистический коэффициент, разброс скорости.',
      places: ['упр. 08 · смена магазина', 'свободная игра · выбор патрона'],
      related: ['баллистический коэффициент', 'энергия', 'разброс скорости'],
    },
    ballisticCoefficient: {
      term: 'баллистический коэффициент',
      forms: ['баллистического коэффициента'],
      chapter: 'Патрон',
      phrase: 'Насколько пуля обтекаемая (BC по модели G7). Чем выше, тем медленнее она теряет скорость: меньше падает и меньше сносится ветром.',
      places: ['карточка патрона'],
      related: ['карточка патрона', 'константа ветра'],
    },
    energy: {
      term: 'энергия',
      forms: ['энергии', 'энергию'],
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
      places: ['карточка патрона'],
      related: ['баллистический коэффициент', 'карточка патрона'],
    },
    velocitySpread: {
      term: 'разброс скорости',
      forms: ['разброса скорости', 'разбросом скорости'],
      chapter: 'Патрон',
      phrase: 'Пули одной партии вылетают с чуть разной скоростью. Медленная падает ниже — на дальности группа вытягивается по вертикали.',
      places: ['карточка патрона', 'разбор · лепесток «разброс патрона»'],
      related: ['группа', 'карточка патрона'],
    },
    dope: {
      term: 'ДОПЕ',
      chapter: 'Баллистика',
      phrase: 'Таблица поправок своей винтовки и патрона: для каждой дистанции — ВЕРТ в MIL и кликах, время полёта, константа ветра, поправки на холод и давление.',
      places: ['блокнот · вкладка ДОПЕ', 'журнал · карточки'],
      related: ['строка ДОПЕ', 'ноль', 'барабан', 'своя карточка'],
    },
    dopeRow: {
      term: 'строка ДОПЕ',
      forms: ['строки ДОПЕ', 'строку ДОПЕ', 'строке ДОПЕ', 'строкой ДОПЕ'],
      chapter: 'Баллистика',
      phrase: 'Одна строка карточки — для одной дистанции. Если дистанция между строками, значение берут пропорцией между соседними.',
      places: ['блокнот · вкладка ДОПЕ'],
      related: ['ДОПЕ', 'формула тысячной'],
    },
    zero: {
      term: 'ноль',
      forms: ['ноля', 'нолю', 'нолём', 'нуля'],
      chapter: 'Баллистика',
      phrase: `Дистанция, на которой при барабанах на нуле пуля приходит в центр. У винтовки курса — ${p.zeroM} м: дальше пуля падает, и ВЕРТ берут по ДОПЕ.`,
      places: ['упр. 02 · пристрелка сбитого прицела'],
      related: ['ZERO STOP', 'ДОПЕ', 'СТП'],
    },
    manualMode: {
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
    timeOfFlight: {
      term: 'время полёта',
      forms: ['времени полёта', 'время полета'],
      chapter: 'Баллистика',
      phrase: 'Сколько летит пуля до цели — колонка t карточки. Нужно для упреждения; звон гонга приходит ещё позже — звуку тоже надо долететь.',
      places: ['блокнот · вкладка ДОПЕ, колонка t'],
      related: ['упреждение', 'ДОПЕ'],
    },
    wind: {
      term: 'ветер',
      forms: ['ветра', 'ветру', 'ветром', 'ветре'],
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
      places: ['блокнот · вкладка ВЕТЕР'],
      related: ['боковая составляющая', 'константа ветра', 'правило часов'],
    },
    clockRule: {
      term: 'правило часов',
      forms: ['правила часов', 'правилу часов'],
      chapter: 'Ветер',
      phrase: 'Направление ветра называют по циферблату: 12 — от цели в лицо, 6 — в спину, 3 — справа, 9 — слева. Ветер слева сносит вправо — брать влево.',
      places: ['позиция · метеостанция', 'блокнот · часы ветра'],
      related: ['доля по часам', 'боковая составляющая'],
    },
    flag: {
      term: 'флажок',
      forms: ['флажка', 'флажки', 'флажков', 'флажком', 'флажку', 'флажкам'],
      chapter: 'Ветер',
      phrase: 'Флажки на трассе показывают ветер там, где летит пуля. Чем сильнее ветер, тем больше угол.',
      places: [`позиция · флажки ${p.flagDistancesM.join(', ')} м`],
      related: ['зоны ветра', 'метеостанция'],
    },
    weatherStation: {
      term: 'метеостанция',
      forms: ['метеостанции', 'метеостанцию', 'станция', 'станции', 'станцию', 'станцией'],
      chapter: 'Ветер',
      phrase: 'Станция у стрелка меряет ветер на позиции: скорость и часы. Дальше по трассе ветер может быть другим.',
      places: ['позиция · метеостанция', 'блокнот · вкладка ВЕТЕР'],
      related: ['флажок', 'правило часов'],
    },
    crosswind: {
      term: 'боковая составляющая',
      forms: ['боковой составляющей', 'боковую составляющую'],
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
      places: ['блокнот · вкладка ВЕТЕР'],
      related: ['доля по часам', 'ветер'],
    },
    clockShare: {
      term: 'доля по часам',
      forms: ['доли по часам', 'долю по часам'],
      chapter: 'Ветер',
      phrase: 'Какая часть ветра работает поперёк. Быстрая армейская оценка — «наискось половина», но в САМ считай по таблице.',
      places: ['блокнот · часы ветра', 'справочник формул'],
      related: ['правило часов', 'боковая составляющая'],
    },
    windConstant: {
      term: 'константа ветра',
      forms: ['константы ветра', 'константу ветра', 'константой ветра'],
      chapter: 'Ветер',
      phrase: 'Число K из строки ДОПЕ для формулы ветра. Падает с дистанцией: пуля замедляется и дольше летит в ветре.',
      places: ['блокнот · вкладка ДОПЕ, колонка K'],
      related: ['ветер', 'строка ДОПЕ', 'баллистический коэффициент'],
    },
    windZones: {
      term: 'зоны ветра',
      forms: ['зон ветра', 'зонам ветра', 'зонах ветра'],
      chapter: 'Ветер',
      phrase: `Трасса делится на зоны: у стрелка, у флажков ${andList(p.flagDistancesM)} м. Ветер в каждой свой, а вес зоны зависит от дистанции.`,
      places: ['блокнот · вкладка ВЕТЕР, упр. с зонами'],
      related: ['средний ветер', 'флажок'],
    },
    averageWind: {
      term: 'средний ветер',
      forms: ['среднего ветра', 'средним ветром'],
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
      places: ['блокнот · вкладка ВЕТЕР, упр. с зонами'],
      related: ['зоны ветра', 'ветер'],
    },
    mirage: {
      term: 'мираж',
      forms: ['миража', 'миражом'],
      chapter: 'Ветер',
      phrase: 'Дрожание нагретого воздуха в прицеле. Мираж течёт по ветру: по наклону видно направление и силу слабого ветра.',
      places: ['прицел · дальние цели'],
      related: ['зоны ветра', 'флажок'],
    },
    milFormula: {
      term: 'формула тысячной',
      forms: ['формулы тысячной', 'формуле тысячной', 'формулу тысячной'],
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
      places: ['блокнот · вкладка ДИСТАНЦИЯ'],
      related: ['миллинг', 'строка ДОПЕ'],
    },
    airDensity: {
      term: 'плотность воздуха',
      forms: ['плотности воздуха'],
      chapter: 'Атмосфера',
      phrase: 'Холодный и плотный воздух сильнее тормозит пулю — она падает ниже. Тёплый и разрежённый — наоборот.',
      places: ['блокнот · вкладка УСЛОВИЯ'],
      related: ['эталон +15 / 1013', 'поправка условий'],
    },
    standardAtmosphere: {
      term: 'эталон +15 / 1013',
      forms: ['эталон', 'эталона'],
      chapter: 'Атмосфера',
      phrase: 'Условия, под которые посчитана карточка ДОПЕ: +15 °C и 1013 гПа. Если погода такая же, поправка условий — ноль.',
      places: ['карточка ДОПЕ', 'блокнот · вкладка УСЛОВИЯ'],
      related: ['поправка условий', 'плотность воздуха'],
    },
    atmosphereCorrection: {
      term: 'поправка условий',
      forms: ['поправки условий', 'поправку условий'],
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
      places: ['блокнот · вкладка УСЛОВИЯ'],
      related: ['эталон +15 / 1013', 'САМ'],
    },
    breathing: {
      term: 'дыхание',
      forms: ['дыхания', 'дыханием', 'дыхании'],
      chapter: 'Стрелок',
      phrase: 'Стреляют на паузе после выдоха: грудь не двигается, сетка качается меньше.',
      places: ['позиция · кнопка дыхания'],
      related: ['пульс', 'спуск'],
    },
    trigger: {
      term: 'спуск',
      forms: ['спуска', 'спуском'],
      chapter: 'Стрелок',
      phrase: 'Плавно дожать до выстрела, не дёргая. Рывок уводит пулю.',
      places: ['позиция · кнопка спуска'],
      related: ['дыхание', 'вызов', 'затвор'],
    },
    pulse: {
      term: 'пульс',
      forms: ['пульса', 'пульсом'],
      chapter: 'Стрелок',
      phrase: 'Сердце качает сетку толчками. Выстрел — между ударами; после бега и задержки дыхания пульс чаще.',
      places: ['позиция · пульс в прицеле'],
      related: ['дыхание', 'спуск'],
    },
    call: {
      term: 'вызов',
      forms: ['вызова', 'вызовом'],
      chapter: 'Стрелок',
      phrase: 'Сразу после выстрела отметить, где была сетка в миг спуска. Вызов отделяет ошибку стрелка от ошибки поправки.',
      places: ['разбор · вызов рядом с пробоиной'],
      related: ['спуск', 'поправка по второму выстрелу', 'группа'],
    },
    lead: {
      term: 'упреждение',
      forms: ['упреждения', 'упреждением', 'упреждении'],
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
      places: ['блокнот · шаг «Упреждение»'],
      related: ['время полёта', 'сопровождение', 'засада'],
    },
    tracking: {
      term: 'сопровождение',
      forms: ['сопровождения', 'сопровождением'],
      chapter: 'Движущиеся цели',
      phrase: 'Вести сетку вместе с целью, держа упреждение, и стрелять, не останавливая движение.',
      places: ['упр. 11 · движущийся дозор'],
      related: ['упреждение', 'засада'],
    },
    ambush: {
      term: 'засада',
      forms: ['засады', 'засадой', 'засаду'],
      chapter: 'Движущиеся цели',
      phrase: 'Держать сетку неподвижно на пути цели и стрелять, когда цель дойдёт до упреждения.',
      places: ['упр. 11 · движущийся дозор'],
      related: ['упреждение', 'сопровождение'],
    },
    group: {
      term: 'группа',
      forms: ['группы', 'группу', 'группой', 'группе'],
      chapter: 'Разбор',
      phrase: 'Несколько пробоин с одной поправкой. По форме видно причину: струна по вертикали — разброс скорости или удержание, сдвиг вбок — ветер.',
      places: ['разбор · схема мишени', 'итог упражнения'],
      related: ['СТП', 'разброс скорости', 'холодный выстрел'],
    },
    meanPointOfImpact: {
      term: 'СТП',
      chapter: 'Разбор',
      phrase: 'Средняя точка попадания — центр группы. Поправку переносят по СТП, а не по отдельной пробоине.',
      places: ['упр. 02 · пристрелка', 'разбор · схема мишени'],
      related: ['группа', 'ноль', 'поправка по второму выстрелу'],
    },
    secondShotCorrection: {
      term: 'поправка по второму выстрелу',
      forms: ['поправку по второму выстрелу'],
      chapter: 'Разбор',
      phrase: 'Увидел, куда ушёл первый выстрел, — перенеси барабанами на столько же обратно.',
      places: ['разбор · «пересчитать и повторить»'],
      related: ['СТП', 'вызов', 'своя карточка'],
    },
    ownCard: {
      term: 'своя карточка',
      forms: ['своей карточки', 'свою карточку', 'своей карточке'],
      chapter: 'Разбор',
      phrase: 'Карандашные записи в ДОПЕ по своим выстрелам: если на дистанции вышло не как в карточке, запиши, как вышло.',
      places: ['разбор · карандаш «в ДОПЕ»', 'журнал · карточки'],
      related: ['ДОПЕ', 'поправка по второму выстрелу'],
    },
  }) satisfies Record<string, TermTexts>;

const termExamples = {
  coldBore: (p: { rifleName: string; distanceM: number; upMil: number; upCm: number; rightMil: number; rightCm: number }) =>
    `${p.rifleName} на ${p.distanceM} м: ↑ ${decimal(p.upMil, 2)} MIL = ${decimal(p.upCm, 1)} см, → ${decimal(p.rightMil, 2)} MIL = ${decimal(p.rightCm, 1)} см`,
  magnification: (p: { magnificationMin: number; magnificationMax: number }) => `курсовой прицел: ${p.magnificationMin}–${p.magnificationMax}×`,
  click: (p: { correctionMil: number; clickMil: number; exactClicks: number; clicks: number; distanceM: number; clickCm: number }) =>
    `П = ${decimal(p.correctionMil)} MIL: N = ${decimal(p.correctionMil)} / ${decimal(p.clickMil)} = ${decimal(p.exactClicks, 1)} → ${clickCount(p.clicks)}; на ${p.distanceM} м один клик — ${decimal(p.clickCm, 0)} см`,
  turret: (p: { elevationTravelMil: number; windageTravelMil: number }) => `курсовой прицел: ВЕРТ до ${p.elevationTravelMil} MIL, ГОР ±${p.windageTravelMil} MIL`,
  milling: (p: { gongSizeM: number; milledMil: number; rangeM: number }) => `гонг ${decimal(p.gongSizeM)} м занял в сетке ${decimal(p.milledMil)} MIL → ${decimal(p.rangeM, 0)} м`,
  mil: (p: { mil: number; distanceM: number; sizeCm: number }) => `${decimal(p.mil)} MIL на ${p.distanceM} м = ${decimal(p.mil)} × ${p.distanceM} / 10 = ${decimal(p.sizeCm, 1)} см`,
  moa: (p: { mil: number; moa: number; moaClickMil: number }) => `${decimal(p.mil)} MIL = ${decimal(p.moa, 2)} MOA; клик MOA-прицела ¼ MOA = ${decimal(p.moaClickMil, 3)} MIL`,
  cartridgeCard: (p: { name: string; massG: number; muzzleVelocityMps: number; muzzleVelocitySdMps: number; bcG7: number }) =>
    `${p.name}: ${decimal(p.massG, 1)} г, ${p.muzzleVelocityMps} ± ${p.muzzleVelocitySdMps} м/с, G7 ${decimal(p.bcG7, 3)}`,
  ballisticCoefficient: (p: { cartridges: readonly { name: string; bcG7: number }[] }) => p.cartridges.map(cartridge => `${cartridge.name} — ${decimal(cartridge.bcG7, 3)}`).join(' · '),
  energy: (p: { name: string; massKg: number; muzzleVelocityMps: number; energyJ: number }) => `${p.name}: ${decimal(p.massKg, 4)} × ${p.muzzleVelocityMps}² / 2 ≈ ${p.energyJ} Дж`,
  velocitySpread: (p: { name: string; muzzleVelocityMps: number; muzzleVelocitySdMps: number }) => `${p.name}: ${p.muzzleVelocityMps} ± ${p.muzzleVelocitySdMps} м/с`,
  dope: (p: { cartridgeName: string; distanceM: number; elevationMil: number; clicks: number }) => `${p.cartridgeName}, ${p.distanceM} м: ВЕРТ ${decimal(p.elevationMil, 1)} MIL = ${p.clicks} кл.`,
  dopeRow: (p: { cartridgeName: string; distanceM: number; lowerM: number; lowerMil: number; upperM: number; upperMil: number; elevationMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distanceM} м — между ${decimal(p.lowerMil, 1)} (${p.lowerM} м) и ${decimal(p.upperMil, 1)} (${p.upperM} м): ВЕРТ ${decimal(p.elevationMil, 2)} MIL = ${p.clicks} кл.`,
  timeOfFlight: (p: { cartridgeName: string; distanceM: number; timeOfFlightS: number; soundDelayS: number }) =>
    `${p.cartridgeName}, ${p.distanceM} м: t = ${decimal(p.timeOfFlightS, 2)} с, звон — через ${decimal(p.soundDelayS, 1)} с после выстрела`,
  wind: (p: { speedMps: number; clockHours: number; distanceM: number; windConstant: number; correctionMil: number; clicks: number }) =>
    `ветер ${p.speedMps} м/с с ${p.clockHours} ч, ${p.distanceM} м, патрон Б: W = ${p.speedMps} × ${p.distanceM} / ${p.windConstant} = ${decimal(p.correctionMil, 2)} MIL → ${clickCount(p.clicks)} влево`,
  flag: (p: { angleDeg: number; degPerMps: number; speedMps: number }) => `флажок отклонён на ${p.angleDeg}°: ${p.angleDeg} / ${p.degPerMps} = ${decimal(p.speedMps, 0)} м/с`,
  crosswind: (p: { speedMps: number; clockHours: number; share: number; crosswindMps: number }) =>
    `${p.speedMps} м/с с ${p.clockHours} ч: V⊥ = ${p.speedMps} × ${decimal(p.share, 2)} = ${decimal(p.crosswindMps, 2)} м/с`,
  clockShare: (p: { shares: readonly { clockHours: number; share: number }[] }) => p.shares.map(item => `${item.clockHours} ч → ${decimal(item.share, 2)}`).join(' · '),
  windConstant: (p: { cartridgeName: string; nearM: number; nearConstant: number; farM: number; farConstant: number }) =>
    `${p.cartridgeName}: K = ${p.nearConstant} на ${p.nearM} м, ${p.farConstant} на ${p.farM} м`,
  windZones: (p: { cartridgeName: string; distanceM: number; weights: readonly number[] }) =>
    `${p.cartridgeName}, ${p.distanceM} м — веса: ${p.weights.map(weight => decimal(weight, 2)).join(' · ')}`,
  averageWind: (p: { distanceM: number; crosswindsMps: readonly number[]; weights: readonly number[]; averageMps: number }) => {
    const parts = p.weights.map((weight, index) => `${decimal(weight, 2)} × ${p.crosswindsMps[index]}`).join(' + ');
    return `${p.distanceM} м, зоны ${p.crosswindsMps.join(' · ')} м/с: ${parts} = ${decimal(p.averageMps, 2)} м/с`;
  },
  milFormula: (p: { gongSizeM: number; milledMil: number; rangeM: number }) =>
    `гонг ${decimal(p.gongSizeM)} м, в сетке ${decimal(p.milledMil)} MIL: Д = ${decimal(p.gongSizeM)} × 1000 / ${decimal(p.milledMil)} = ${decimal(p.rangeM, 0)} м`,
  atmosphereCorrection: (p: {
    cartridgeName: string;
    distanceM: number;
    temperatureC: number;
    pressureHpa: number;
    colderTens: number;
    colderMil: number;
    pressureTens: number;
    pressureMil: number;
    correctionMil: number;
    clicks: number;
  }) =>
    `${p.cartridgeName}, ${p.distanceM} м, ${decimal(p.temperatureC)} °C, ${p.pressureHpa} гПа: ${decimal(p.colderTens, 0)} × ${decimal(p.colderMil, 2)} + ${decimal(p.pressureTens, 1)} × ${decimal(p.pressureMil, 2)} = ${decimal(p.correctionMil, 2)} MIL → ${clickCount(p.clicks)} вверх`,
  lead: (p: { targetSpeedMps: number; distanceM: number; timeOfFlightS: number; leadMil: number }) =>
    `шаг ${decimal(p.targetSpeedMps)} м/с поперёк, ${p.distanceM} м: L = ${decimal(p.targetSpeedMps)} × ${decimal(p.timeOfFlightS, 2)} / ${p.distanceM} × 1000 = ${decimal(p.leadMil, 2)} MIL`,
  secondShotCorrection: (p: { rightMil: number; downMil: number; windageClicks: number; elevationClicks: number }) =>
    `ушёл на ${decimal(p.rightMil)} MIL вправо и ${decimal(p.downMil)} ниже: ГОР ${clickCount(p.windageClicks)} влево, ВЕРТ ${clickCount(p.elevationClicks)} вверх`,
};

export const textbook = {
  chapters: CHAPTERS,
  terms,
  termExamples,
  model: {
    counter: (p: { opened: number; total: number }) => `${p.opened} / ${p.total} терминов`,
    lockIntro: (p: { exerciseId: string }) => `откроется во вводном ${p.exerciseId}`,
    lockExercise: (p: { exerciseId: string }) => `откроется в упр. ${p.exerciseId}`,
    whereLine: (p: { isFirst: boolean; exerciseId: string; title: string }) => `${p.isFirst ? 'впервые' : 'снова'} — упр. ${p.exerciseId} · ${p.title}`,
  },
  page: {
    back: 'Назад',
    title: 'Учебник курсанта',
  },
  sheet: {
    example: 'пример',
    where: 'где встречается',
    related: 'рядом',
    tryOnScope: 'Попробовать на прицеле',
    close: 'Закрыть',
  },
  termLinks: {
    checkErrors: {
      side: 'правило часов',
      substitution: 'САМ',
      arithmetic: 'САМ',
      factor: 'САМ',
      reading: 'метеостанция',
      lead: 'упреждение',
      rounding: 'клик',
      units: 'MOA',
      turret: 'барабан',
    } satisfies Record<CheckErrorType, string>,
    causes: {
      calc: 'САМ',
      wind: 'ветер',
      hold: 'дыхание',
      lead: 'упреждение',
      trigger: 'спуск',
      zero: 'ноль',
      'cold-bore': 'холодный выстрел',
      formula: 'константа ветра',
      rifle: 'группа',
    } satisfies Record<CauseKind, string>,
    mainCauses: {
      calc: 'САМ',
      'wind-under': 'ветер',
      'wind-over': 'ветер',
      hold: 'дыхание',
      lead: 'упреждение',
      trigger: 'спуск',
      zero: 'ноль',
    } satisfies Record<MainCause, string>,
  },
  sandboxes: {
    clicks: { terms: ['клик', 'барабан'], hint: 'Один щелчок — 0,1 MIL. Покрути барабан ВЕРТ и смотри, как сдвигается сетка' },
    zeroStop: { terms: ['ZERO STOP'], hint: 'Ты на ноле. Покрути барабан ВЕРТ вниз — ниже ноля он не пойдёт: упор ZERO STOP' },
    focalPlane: {
      terms: ['кратность', 'фокальная плоскость'],
      hint: 'Крути кратность — метки сетки растут вместе с гонгом: первая фокальная плоскость, MIL верен на любой кратности',
    },
    milling: { terms: ['сетка', 'миллинг'], hint: 'Дистанция неизвестна. Измерь гонг сеткой в MIL, потом блокнот → ДИСТАНЦИЯ: внеси замер' },
    wind: {
      terms: ['метеостанция', 'ветер', 'правило часов', 'доля по часам'],
      hint: 'Ветер с метеостанции: скорость и час. Тапни — на часах ветра видна доля бокового ветра',
    },
    flags: {
      terms: ['флажок'],
      hint: (p: { flagDistancesM: readonly number[] }) => `Флажки на ${andList(p.flagDistancesM)} м. Чем сильнее ветер поперёк, тем круче полотнище`,
    },
    breathing: { terms: ['дыхание', 'пульс'], hint: 'Держи — дыхание задержано, сетка успокаивается. Держишь долго — снова качает' },
    trigger: { terms: ['спуск'], hint: 'Дави на спуск плавно, пока не выстрелит. Резкий рывок уводит пулю' },
    bolt: { terms: ['затвор'], hint: 'Выстрели — потом перезаряди затвором: вверх, назад, вперёд, вниз' },
    dope: {
      terms: ['ДОПЕ', 'строка ДОПЕ'],
      hint: (p: { distanceM: number; lowerM: number; upperM: number }) => `Карточка ДОПЕ: для ${p.distanceM} м строки нет — поправка берётся между ${p.lowerM} и ${p.upperM}`,
    },
  },
  schemeTerms: {
    reticle: ['сетка', 'MIL', 'MOA', 'миллинг'],
    'focal-plane': ['фокальная плоскость', 'кратность'],
    trajectory: ['ДОПЕ', 'строка ДОПЕ', 'ноль', 'время полёта'],
    'wind-clock': ['правило часов', 'доля по часам', 'боковая составляющая', 'ветер'],
    cartridges: ['карточка патрона', 'баллистический коэффициент', 'энергия', 'разброс скорости', 'константа ветра'],
    zones: ['зоны ветра', 'средний ветер', 'флажок'],
    group: ['группа', 'СТП', 'поправка по второму выстрелу'],
  },
  schemes: {
    reticleCaptions: {
      'mil-dot': 'точка = 1 MIL',
      'mil-tick': 'штрих = 1 MIL',
      'half-mil-tick': 'полуметка = 0,5 MIL',
      'moa-tick': 'штрих = 1 MOA = 0,29 MIL',
      'five-moa-tick': 'длинный штрих = 5 MOA',
      'holdover-dot': 'точки ёлки: ряды через 1 MIL вниз, шаг 0,5 MIL вбок',
    } satisfies Record<Exclude<ReticleMarkKind, 'label'>, string>,
    firstPlaneCaption: (p: { magnification: number }) => `на ${p.magnification}× точка = 1 MIL — верно на любой кратности`,
    secondPlaneCaption: (p: { magnification: number; dotMil: number; trueMagnification: number }) =>
      `на ${p.magnification}× точка = ${roundedDecimal(p.dotMil, 1)} MIL — ${p.magnification === p.trueMagnification ? 'верно' : `верно только на ${p.trueMagnification}×`}`,
    windClockCaption: (p: { clockHours: number; share: number }) => `${p.clockHours} ч — доля ${roundedDecimal(p.share, 2)}`,
    cartridgeFacts: (p: { massG: number; muzzleVelocityMps: number; bcG7: number; energyJ: number }) => [
      `${roundedDecimal(p.massG, 1)} г`,
      `${p.muzzleVelocityMps} м/с`,
      `BC ${roundedDecimal(p.bcG7, 3)}`,
      `${p.energyJ} Дж`,
    ],
    groupCaption: (p: { upMil: number; rightMil: number; upClicks: number; rightClicks: number }) => {
      const offset = `${arrow(p.upMil, '↑', '↓')} ${roundedDecimal(Math.abs(p.upMil), 1)} ${arrow(p.rightMil, '→', '←')} ${roundedDecimal(Math.abs(p.rightMil), 1)} MIL`;
      const transfer = `${arrow(p.upClicks, '↑', '↓')} ${Math.abs(p.upClicks)} ${arrow(p.rightClicks, '→', '←')} ${Math.abs(p.rightClicks)} кл.`;
      return `СТП ${offset} — перенеси ${transfer}`;
    },
    term: {
      pendingCard: 'считаю карточку…',
      pendingCartridges: 'считаю карточки патронов…',
    },
    reticle: {
      names: { tree: 'Ёлка', 'mil-dot': 'MIL-dot', 'moa-grid': 'MOA' } satisfies Record<ReticleKind, string>,
      label: (p: { name: string }) => `Сетка ${p.name}`,
      tapHint: 'Тапни по метке сетки',
    },
    focalPlane: {
      firstPlane: 'первая плоскость',
      secondPlane: 'вторая плоскость',
      magnification: 'кратность',
    },
    cartridges: {
      dropTitle: 'падение, MIL',
      driftTitle: 'снос на 1 м/с, MIL',
      axis: (p: { distanceM: number; maxMil: number }) => `${p.distanceM} м · ${roundedDecimal(p.maxMil, 1)} MIL`,
    },
    trajectory: {
      label: 'Траектория патрона Б: поправка по дистанции',
      sightLine: 'линия прицеливания',
      zero: (p: { zeroM: number }) => `ноль ${p.zeroM} м`,
      timeMark: (p: { timeOfFlightS: number }) => `${decimal(p.timeOfFlightS)} с`,
      distanceTick: (p: { distanceM: number }) => `${p.distanceM} м`,
      maxElevation: (p: { distanceM: number; maxMil: number }) => `на ${p.distanceM} м: ↑ ${decimal(p.maxMil)} MIL`,
      caption: 'Патрон Б: на сколько поднять прицел, чтобы попасть — та же кривая, что строки ДОПЕ. Точки — время полёта.',
    },
    windClock: {
      label: 'Часы ветра: тапни по часу',
      target: 'ЦЕЛЬ',
      hour: (p: { clockHours: number }) => `${p.clockHours} ч`,
      crosswindRule: '· боковой ветер = ветер × доля',
    },
    zones: {
      label: 'Зоны ветра по трассе и их веса',
      shooter: 'ты',
      caption: (p: { distanceM: number }) =>
        `Строка ${p.distanceM} м: средний ветер = Σ ветер зоны × вес. Ветер у стрелка сносит пулю раньше, и снос копится до самой цели: ближние зоны весят больше, последние метры — почти ничего.`,
    },
  },
};
