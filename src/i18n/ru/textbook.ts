import type { DragModel } from '../../core/types';
import type { CheckErrorType } from '../../core/calc-check';
import type { CauseKind, MainCause } from '../../sim/miss-breakdown';
import type { ReticleMarkKind } from '../../sim/reticle';
import type { ReticleKind } from '../../sim/scope-model';
import { decimal } from '../format';

const CHAPTERS: readonly string[] = [
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
  'Угол и вращение Земли',
];

export type TextbookChapter = string;

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

const terms = (p: { rifleName: string; zero: string; flags: string; flagsAnd: string }) =>
  ({
    rifle: {
      term: 'винтовка',
      forms: ['винтовки', 'винтовку', 'винтовкой', 'винтовке'],
      chapter: 'Винтовка',
      phrase: `Учебная винтовка ${p.rifleName}: ствол, затвор, магазин на 5 патронов и спуск. Пристреляна на ${p.zero}.`,
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
      phrase: `Дистанция, на которой при барабанах на нуле пуля приходит в центр. У винтовки курса — ${p.zero}: дальше пуля падает, и ВЕРТ берут по ДОПЕ.`,
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
      places: [`позиция · флажки ${p.flags}`],
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
      phrase: `Трасса делится на зоны: у стрелка, у флажков ${p.flagsAnd}. Ветер в каждой свой, а вес зоны зависит от дистанции.`,
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
      related: ['эталон условий', 'поправка условий'],
    },
    standardAtmosphere: {
      term: 'эталон условий',
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
      related: ['эталон условий', 'САМ'],
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
    lookAngle: {
      term: 'угол места',
      forms: ['угла места', 'углом места', 'углу места'],
      chapter: 'Угол и вращение Земли',
      phrase: 'Угол между линией прицела и горизонтом: цель выше — «+», ниже — «−». Вверх и вниз поправка одна: пуле важен только наклон.',
      formula: { line: 'θ', variables: [{ symbol: 'θ', meaning: 'угол места, градусы' }] },
      places: ['позиция · строка условий «∠ ±N°»', 'блокнот · шаг «Угол места»'],
      related: ['правило косинуса', 'угол нуля'],
    },
    zeroAngle: {
      term: 'угол нуля',
      forms: ['угла нуля', 'углом нуля'],
      chapter: 'Угол и вращение Земли',
      phrase: `При ноле на ${p.zero} ствол смотрит чуть выше линии прицела. Под углом наклоняется весь выстрел, поэтому угол нуля входит в расчёт.`,
      formula: { line: 'Z', variables: [{ symbol: 'Z', meaning: 'угол нуля из шапки карточки ДОПЕ, MIL' }] },
      places: ['карточка ДОПЕ · шапка', 'блокнот · шаг «Угол места»'],
      related: ['правило косинуса', 'ноль'],
    },
    cosineRule: {
      term: 'правило косинуса',
      forms: ['правила косинуса', 'правилом косинуса'],
      chapter: 'Угол и вращение Земли',
      phrase: 'Под углом сила тяжести тянет пулю поперёк линии прицела слабее, и пуля падает меньше. Возвышение по ДОПЕ вместе с углом нуля умножают на cos угла.',
      formula: {
        line: 'E∠ = (E + Z) × cos θ − Z',
        variables: [
          { symbol: 'E∠', meaning: 'возвышение под углом, MIL' },
          { symbol: 'E', meaning: 'возвышение из строки ДОПЕ, MIL' },
          { symbol: 'Z', meaning: 'угол нуля, MIL' },
          { symbol: 'θ', meaning: 'угол места' },
        ],
      },
      places: ['блокнот · шаг «Угол места»'],
      related: ['угол места', 'угол нуля', 'ДОПЕ'],
    },
    rangeAltitude: {
      term: 'высота стрельбища',
      forms: ['высоты стрельбища', 'высоте стрельбища'],
      chapter: 'Угол и вращение Земли',
      phrase: 'В горах давление ниже, воздух реже, пуля теряет меньше скорости и падает меньше. Станция показывает давление на месте, его и берут в расчёт условий.',
      places: ['упр. 13 · горный склон', 'блокнот · шаг «Условия»'],
      related: ['плотность воздуха', 'поправка условий'],
    },
    spinDrift: {
      term: 'деривация',
      forms: ['деривации', 'деривацию', 'деривацией'],
      chapter: 'Угол и вращение Земли',
      phrase: 'Пуля вращается от нарезов и на лету уходит в сторону вращения: при правых нарезах — вправо. Чем дальше, тем больше. Величина — в колонке ДЕР карточки ДОПЕ.',
      formula: { line: 'ДЕР', variables: [{ symbol: 'ДЕР', meaning: 'колонка карточки ДОПЕ, MIL' }] },
      places: ['карточка ДОПЕ · колонка ДЕР', 'блокнот · шаг «Деривация»'],
      related: ['твист', 'Кориолис'],
    },
    twist: {
      term: 'твист',
      forms: ['твиста', 'твистом'],
      chapter: 'Угол и вращение Земли',
      phrase: 'Шаг нарезов: на сколько дюймов ствола пуля делает один оборот. Направление нарезов задаёт сторону деривации.',
      places: ['винтовка · ствол'],
      related: ['деривация'],
    },
    coriolis: {
      term: 'Кориолис',
      forms: ['Кориолиса', 'Кориолисом'],
      chapter: 'Угол и вращение Земли',
      phrase: 'Пока пуля летит, Земля под ней поворачивается. В северном полушарии пуля уходит вправо, в южном — влево; сильнее у полюсов.',
      formula: {
        line: 'K = 0,0729 × t × sin φ',
        variables: [
          { symbol: 'K', meaning: 'поправка вбок, MIL' },
          { symbol: '0,0729', meaning: 'вращение Земли × 1000' },
          { symbol: 't', meaning: 'время полёта из строки ДОПЕ, с' },
          { symbol: 'φ', meaning: 'широта' },
        ],
      },
      places: ['позиция · строка условий «NN° с. ш.»', 'блокнот · шаг «Кориолис»'],
      related: ['Этвёш', 'время полёта', 'деривация'],
    },
    eotvos: {
      term: 'Этвёш',
      forms: ['Этвёша', 'Этвёшем'],
      chapter: 'Угол и вращение Земли',
      phrase: 'Вертикальная часть вращения Земли: выстрел на восток идёт чуть выше, на запад — ниже. Доли клика, но на 1000 м заметны.',
      formula: {
        line: 'Э = 0,0729 × t × cos φ × sin A',
        variables: [
          { symbol: 'Э', meaning: 'поправка по вертикали, MIL' },
          { symbol: 't', meaning: 'время полёта, с' },
          { symbol: 'φ', meaning: 'широта' },
          { symbol: 'A', meaning: 'азимут выстрела' },
        ],
      },
      places: ['позиция · строка условий «аз. N°»', 'блокнот · шаг «Этвёш»'],
      related: ['Кориолис', 'время полёта'],
    },
  }) satisfies Record<string, TermTexts>;

export type CatalogTermId = keyof ReturnType<typeof terms>;

const imperialTerms: Partial<Record<CatalogTermId, Partial<TermTexts>>> = {
  click: { phrase: 'Один щелчок барабана: 0,1 MIL. Это 0,36″ на 100 ярдов.' },
  mil: {
    phrase: 'Тысячная — угол, под которым 1 ярд виден с 1000 ярдов. 0,1 MIL — 0,36″ на 100 ярдов. Поправки, сетка и барабаны в курсе — в MIL.',
    formula: {
      line: 'дюймы = MIL × D / 27,78',
      variables: [
        { symbol: 'дюймы', meaning: 'размер на цели, дюймы' },
        { symbol: 'MIL', meaning: 'угол в тысячных' },
        { symbol: 'D', meaning: 'дистанция, ярды' },
      ],
    },
  },
  moa: { phrase: 'Угловая минута, 1/60 градуса: около 1,05″ на 100 ярдов. Прицел в MOA — в свободной игре, в курсе всё в MIL.' },
  energy: {
    formula: {
      line: 'E = m × v² / 450 240',
      variables: [
        { symbol: 'E', meaning: 'энергия у дула, фут-фунт' },
        { symbol: 'm', meaning: 'масса пули, гран' },
        { symbol: 'v', meaning: 'скорость у дула, фут/с' },
      ],
    },
  },
  wind: {
    formula: {
      line: 'W = V⊥ × D / K',
      variables: [
        { symbol: 'W', meaning: 'поправка на ветер, MIL' },
        { symbol: 'V⊥', meaning: 'боковая часть ветра, миль/ч (скорость × доля по часам)' },
        { symbol: 'D', meaning: 'дистанция до цели, ярды' },
        { symbol: 'K', meaning: 'константа ветра из строки ДОПЕ' },
      ],
    },
  },
  crosswind: {
    formula: {
      line: 'V⊥ = V × доля',
      variables: [
        { symbol: 'V⊥', meaning: 'боковой ветер, миль/ч' },
        { symbol: 'V', meaning: 'скорость ветра со станции, миль/ч' },
        { symbol: 'доля', meaning: 'доля по часам' },
      ],
    },
  },
  averageWind: {
    formula: {
      line: 'V⊥ср = Σ вес × V⊥',
      variables: [
        { symbol: 'V⊥ср', meaning: 'средний боковой ветер, миль/ч' },
        { symbol: 'вес', meaning: 'доля зоны из строки ДОПЕ' },
        { symbol: 'V⊥', meaning: 'боковой ветер зоны, миль/ч' },
      ],
    },
  },
  milFormula: {
    formula: {
      line: 'Д = размер × 27,78 / mil',
      variables: [
        { symbol: 'Д', meaning: 'дальность, ярды' },
        { symbol: 'размер', meaning: 'известный размер цели, дюймы' },
        { symbol: 'mil', meaning: 'сколько MIL цель заняла в сетке' },
      ],
    },
  },
  standardAtmosphere: {
    phrase: 'Условия, под которые посчитана карточка ДОПЕ: 59 °F и 29,92 дюйма рт. ст. Если погода такая же, поправка условий — ноль.',
  },
  atmosphereCorrection: {
    formula: {
      line: 'ΔВЕРТ = (59 − T) / 10 × Х + (P − 29,92) / 0,3 × Р',
      variables: [
        { symbol: 'ΔВЕРТ', meaning: 'добавка к ВЕРТ, MIL' },
        { symbol: 'T', meaning: 'температура, °F' },
        { symbol: 'Х', meaning: 'колонка «холоднее на 10 °F» строки ДОПЕ' },
        { symbol: 'P', meaning: 'давление, дюймы рт. ст.' },
        { symbol: 'Р', meaning: 'колонка «давление +0,3″» строки ДОПЕ' },
      ],
    },
  },
  lead: {
    formula: {
      line: 'L = 488,9 × V⊥ × t / D',
      variables: [
        { symbol: 'L', meaning: 'упреждение, MIL' },
        { symbol: 'V⊥', meaning: 'скорость цели поперёк, миль/ч' },
        { symbol: 't', meaning: 'время полёта из строки ДОПЕ, с' },
        { symbol: 'D', meaning: 'дистанция, ярды' },
      ],
    },
  },
  eotvos: { phrase: 'Вертикальная часть вращения Земли: выстрел на восток идёт чуть выше, на запад — ниже. Доли клика, но на 1000 ярдов заметны.' },
};

const termExamples = {
  coldBore: (p: { rifleName: string; distance: string; upMil: number; up: string; rightMil: number; right: string }) =>
    `${p.rifleName} на ${p.distance}: ↑ ${decimal(p.upMil, 2)} MIL = ${p.up}, → ${decimal(p.rightMil, 2)} MIL = ${p.right}`,
  magnification: (p: { magnificationMin: number; magnificationMax: number }) => `курсовой прицел: ${p.magnificationMin}–${p.magnificationMax}×`,
  click: (p: { correctionMil: number; clickMil: number; exactClicks: number; clicks: number; distance: string; click: string }) =>
    `П = ${decimal(p.correctionMil)} MIL: N = ${decimal(p.correctionMil)} / ${decimal(p.clickMil)} = ${decimal(p.exactClicks, 1)} → ${clickCount(p.clicks)}; на ${p.distance} один клик — ${p.click}`,
  turret: (p: { elevationTravelMil: number; windageTravelMil: number }) => `курсовой прицел: ВЕРТ до ${p.elevationTravelMil} MIL, ГОР ±${p.windageTravelMil} MIL`,
  milling: (p: { gongSize: string; milledMil: number; range: string }) => `гонг ${p.gongSize} занял в сетке ${decimal(p.milledMil)} MIL → ${p.range}`,
  mil: (p: { mil: number; distance: string; distanceNumber: string; divisor: string; size: string }) =>
    `${decimal(p.mil)} MIL на ${p.distance} = ${decimal(p.mil)} × ${p.distanceNumber} / ${p.divisor} = ${p.size}`,
  moa: (p: { mil: number; moa: number; moaClickMil: number }) => `${decimal(p.mil)} MIL = ${decimal(p.moa, 2)} MOA; клик MOA-прицела ¼ MOA = ${decimal(p.moaClickMil, 3)} MIL`,
  cartridgeCard: (p: { name: string; mass: string; velocity: string; dragModel: DragModel; ballisticCoefficient: number }) =>
    `${p.name}: ${p.mass}, ${p.velocity}, ${p.dragModel} ${decimal(p.ballisticCoefficient, 3)}`,
  ballisticCoefficient: (p: { cartridges: readonly { name: string; ballisticCoefficient: number }[] }) => p.cartridges.map(cartridge => `${cartridge.name} — ${decimal(cartridge.ballisticCoefficient, 3)}`).join(' · '),
  energy: {
    metric: (p: { name: string; mass: number; velocity: number; energy: number }) => `${p.name}: ${decimal(p.mass, 4)} × ${p.velocity}² / 2 ≈ ${p.energy} Дж`,
    imperial: (p: { name: string; mass: number; velocity: number; energy: number }) => `${p.name}: ${p.mass} × ${p.velocity}² / 450 240 ≈ ${p.energy} фут-фунт`,
  },
  velocitySpread: (p: { name: string; velocity: string }) => `${p.name}: ${p.velocity}`,
  dope: (p: { cartridgeName: string; distance: string; elevationMil: number; clicks: number }) => `${p.cartridgeName}, ${p.distance}: ВЕРТ ${decimal(p.elevationMil, 1)} MIL = ${p.clicks} кл.`,
  dopeRow: (p: { cartridgeName: string; distance: string; lower: string; lowerMil: number; upper: string; upperMil: number; elevationMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distance} — между ${decimal(p.lowerMil, 1)} (${p.lower}) и ${decimal(p.upperMil, 1)} (${p.upper}): ВЕРТ ${decimal(p.elevationMil, 2)} MIL = ${p.clicks} кл.`,
  timeOfFlight: (p: { cartridgeName: string; distance: string; timeOfFlightS: number; soundDelayS: number }) =>
    `${p.cartridgeName}, ${p.distance}: t = ${decimal(p.timeOfFlightS, 2)} с, звон — через ${decimal(p.soundDelayS, 1)} с после выстрела`,
  wind: (p: { speed: string; speedNumber: string; clockHours: number; distance: string; distanceNumber: string; windConstant: number; correctionMil: number; clicks: number }) =>
    `ветер ${p.speed} с ${p.clockHours} ч, ${p.distance}, патрон Б: W = ${p.speedNumber} × ${p.distanceNumber} / ${p.windConstant} = ${decimal(p.correctionMil, 2)} MIL → ${clickCount(p.clicks)} влево`,
  flag: (p: { angleDeg: number; degPerSpeed: string; speed: string }) => `флажок отклонён на ${p.angleDeg}°: ${p.angleDeg} / ${p.degPerSpeed} = ${p.speed}`,
  crosswind: (p: { speed: string; speedNumber: string; clockHours: number; share: number; crosswind: string }) =>
    `${p.speed} с ${p.clockHours} ч: V⊥ = ${p.speedNumber} × ${decimal(p.share, 2)} = ${p.crosswind}`,
  clockShare: (p: { shares: readonly { clockHours: number; share: number }[] }) => p.shares.map(item => `${item.clockHours} ч → ${decimal(item.share, 2)}`).join(' · '),
  windConstant: (p: { cartridgeName: string; near: string; nearConstant: number; far: string; farConstant: number }) =>
    `${p.cartridgeName}: K = ${p.nearConstant} на ${p.near}, ${p.farConstant} на ${p.far}`,
  windZones: (p: { cartridgeName: string; distance: string; weights: readonly number[] }) =>
    `${p.cartridgeName}, ${p.distance} — веса: ${p.weights.map(weight => decimal(weight, 2)).join(' · ')}`,
  averageWind: (p: { distance: string; crosswinds: readonly number[]; speedUnit: string; weights: readonly number[]; average: string }) => {
    const parts = p.weights.map((weight, index) => `${decimal(weight, 2)} × ${p.crosswinds[index]}`).join(' + ');
    return `${p.distance}, зоны ${p.crosswinds.join(' · ')} ${p.speedUnit}: ${parts} = ${p.average}`;
  },
  milFormula: (p: { gongSize: string; gongSizeNumber: string; factor: string; milledMil: number; range: string }) =>
    `гонг ${p.gongSize}, в сетке ${decimal(p.milledMil)} MIL: Д = ${p.gongSizeNumber} × ${p.factor} / ${decimal(p.milledMil)} = ${p.range}`,
  atmosphereCorrection: (p: {
    cartridgeName: string;
    distance: string;
    temperature: string;
    pressure: string;
    colderTens: number;
    colderMil: number;
    pressureTens: number;
    pressureMil: number;
    correctionMil: number;
    clicks: number;
  }) =>
    `${p.cartridgeName}, ${p.distance}, ${p.temperature}, ${p.pressure}: ${roundedDecimal(p.colderTens, 1)} × ${decimal(p.colderMil, 2)} + ${decimal(p.pressureTens, 1)} × ${decimal(p.pressureMil, 2)} = ${decimal(p.correctionMil, 2)} MIL → ${clickCount(p.clicks)} вверх`,
  lead: {
    metric: (p: { speed: string; speedNumber: string; distance: string; distanceNumber: string; timeOfFlightS: number; leadMil: number }) =>
      `шаг ${p.speed} поперёк, ${p.distance}: L = ${p.speedNumber} × ${decimal(p.timeOfFlightS, 2)} / ${p.distanceNumber} × 1000 = ${decimal(p.leadMil, 2)} MIL`,
    imperial: (p: { speed: string; speedNumber: string; distance: string; distanceNumber: string; timeOfFlightS: number; leadMil: number }) =>
      `шаг ${p.speed} поперёк, ${p.distance}: L = 488,9 × ${p.speedNumber} × ${decimal(p.timeOfFlightS, 2)} / ${p.distanceNumber} = ${decimal(p.leadMil, 2)} MIL`,
  },
  lookAngle: (p: { upDeg: number; downDeg: number; cos: number }) =>
    `«∠ +${p.upDeg}°» — цель выше на ${p.upDeg}°, «∠ −${p.downDeg}°» — ниже. cos +${p.upDeg}° = cos −${p.downDeg}° = ${decimal(p.cos, 2)}: поправка одна`,
  zeroAngle: (p: { cartridgeName: string; zero: string; zeroAngleMil: number }) => `${p.cartridgeName}, ноль на ${p.zero}: Z = ${decimal(p.zeroAngleMil, 2)} MIL`,
  cosineRule: (p: { cartridgeName: string; distance: string; angleDeg: number; elevationMil: number; zeroAngleMil: number; cos: number; inclinedMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distance}, ∠ ${p.angleDeg}°: (${decimal(p.elevationMil, 1)} + ${decimal(p.zeroAngleMil, 2)}) × ${decimal(p.cos, 2)} − ${decimal(p.zeroAngleMil, 2)} = ${decimal(p.inclinedMil, 2)} MIL — на ${clickCount(p.clicks)} меньше ДОПЕ`,
  rangeAltitude: (p: { low: string; lowPressure: string; high: string; highPressure: string }) => `обычное давление: ${p.low} — ${p.lowPressure}, ${p.high} — ${p.highPressure}`,
  spinDrift: (p: { cartridgeName: string; distance: string; spinDriftMil: number; clicks: number }) =>
    `${p.cartridgeName}, ${p.distance}: ДЕР ${decimal(p.spinDriftMil, 2)} MIL вправо → ГОР ${clickCount(p.clicks)} влево`,
  twist: (p: { rifleName: string; twistInches: number; isRight: boolean }) =>
    `${p.rifleName}: 1 оборот на ${p.twistInches}″, ${p.isRight ? 'правый' : 'левый'} — деривация ${p.isRight ? 'вправо' : 'влево'}`,
  coriolis: (p: { distance: string; timeOfFlightS: number; latitudeDeg: number; sinLatitude: number; coriolisMil: number }) =>
    `${p.distance}, t = ${decimal(p.timeOfFlightS, 2)} с, ${p.latitudeDeg}° с. ш.: 0,0729 × ${decimal(p.timeOfFlightS, 2)} × ${decimal(p.sinLatitude, 2)} = ${decimal(p.coriolisMil, 2)} MIL`,
  eotvos: (p: { distance: string; timeOfFlightS: number; latitudeDeg: number; cosLatitude: number; azimuthDeg: number; eotvosMil: number }) =>
    `${p.distance} на восток (аз. ${p.azimuthDeg}°), ${p.latitudeDeg}° с. ш.: 0,0729 × ${decimal(p.timeOfFlightS, 2)} × ${decimal(p.cosLatitude, 2)} × 1 = ${decimal(p.eotvosMil, 2)} MIL`,
  secondShotCorrection: (p: { rightMil: number; downMil: number; windageClicks: number; elevationClicks: number }) =>
    `ушёл на ${decimal(p.rightMil)} MIL вправо и ${decimal(p.downMil)} ниже: ГОР ${clickCount(p.windageClicks)} влево, ВЕРТ ${clickCount(p.elevationClicks)} вверх`,
};

export const textbook = {
  chapters: CHAPTERS,
  terms,
  imperialTerms,
  termExamples,
  model: {
    counter: (p: { opened: number; total: number }) => `${p.opened} / ${p.total} терминов`,
    lockIntro: (p: { exerciseId: string }) => `откроется во вводном ${p.exerciseId}`,
    lockExercise: (p: { exerciseId: string }) => `откроется в упр. ${p.exerciseId}`,
    whereLine: (p: { isFirst: boolean; exerciseId: string; title: string }) => `${p.isFirst ? 'впервые' : 'снова'} — упр. ${p.exerciseId} · ${p.title}`,
  },
  page: {
    back: 'Назад',
    title: 'Учебник стрелка',
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
      distance: 'миллинг',
      dope: 'строка ДОПЕ',
      conditions: 'поправка условий',
      angle: 'угол места',
      earth: 'деривация',
      'wind-speed': 'ветер',
      'wind-clock': 'правило часов',
      zones: 'флажок',
      'wind-calc': 'боковая составляющая',
      'lead-calc': 'упреждение',
      rounding: 'клик',
      turret: 'барабан',
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
      hint: (p: { flags: string }) => `Флажки на ${p.flags}. Чем сильнее ветер поперёк, тем круче полотнище`,
    },
    breathing: { terms: ['дыхание', 'пульс'], hint: 'Держи — дыхание задержано, сетка успокаивается. Держишь долго — снова качает' },
    trigger: { terms: ['спуск'], hint: 'Дави на спуск плавно, пока не выстрелит. Резкий рывок уводит пулю' },
    bolt: { terms: ['затвор'], hint: 'Выстрели — потом перезаряди затвором: вверх, назад, вперёд, вниз' },
    dope: {
      terms: ['ДОПЕ', 'строка ДОПЕ'],
      hint: (p: { distance: string; lower: number; upper: number }) => `Карточка ДОПЕ: для ${p.distance} строки нет — поправка берётся между ${p.lower} и ${p.upper}`,
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
    cartridgeFacts: (p: { mass: string; velocity: string; ballisticCoefficient: number; energy: string }) => [p.mass, p.velocity, `BC ${roundedDecimal(p.ballisticCoefficient, 3)}`, p.energy],
    energy: { metric: (p: { energy: number }) => `${p.energy} Дж`, imperial: (p: { energy: number }) => `${p.energy} фут-фунт` },
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
      driftTitle: (p: { speed: string }) => `снос на ${p.speed}, MIL`,
      axis: (p: { distance: string; maxMil: number }) => `${p.distance} · ${roundedDecimal(p.maxMil, 1)} MIL`,
    },
    trajectory: {
      label: 'Траектория патрона Б: поправка по дистанции',
      sightLine: 'линия прицеливания',
      zero: (p: { zero: string }) => `ноль ${p.zero}`,
      timeMark: (p: { timeOfFlightS: number }) => `${decimal(p.timeOfFlightS)} с`,
      maxElevation: (p: { distance: string; maxMil: number }) => `на ${p.distance}: ↑ ${decimal(p.maxMil)} MIL`,
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
      caption: (p: { distance: string; lastStretch: string }) =>
        `Строка ${p.distance}: средний ветер = Σ ветер зоны × вес. Ветер у стрелка сносит пулю раньше, и снос копится до самой цели: ближние зоны весят больше, последние ${p.lastStretch} — почти ничего.`,
      lastStretch: { metric: 'метры', imperial: 'ярды' },
    },
  },
};
