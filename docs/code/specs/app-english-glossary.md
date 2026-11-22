# Английский: словарь и правила перевода (T6.3, этап 2)

Общий для всех модулей каталога `src/i18n/en`. Термины учебника — это идентификаторы: по точной строке `term` на карточку ссылаются `related`, `termLinks`, `content.exerciseTerms` и подсказки тренера. Поэтому термин везде пишется ровно так, как в таблице.

## Термины учебника (ru → en)

| ru | en |
| --- | --- |
| винтовка | rifle |
| холодный выстрел | cold bore |
| затвор | bolt |
| прицел | scope |
| кратность | magnification |
| фокальная плоскость | focal plane |
| клик | click |
| барабан | turret |
| ZERO STOP | ZERO STOP |
| сетка | reticle |
| миллинг | milling |
| MIL | MIL |
| MOA | MOA |
| карточка патрона | cartridge card |
| баллистический коэффициент | ballistic coefficient |
| энергия | energy |
| разброс скорости | velocity spread |
| ДОПЕ | DOPE |
| строка ДОПЕ | DOPE row |
| ноль | zero |
| САМ | MANUAL |
| время полёта | time of flight |
| ветер | wind |
| правило часов | clock method |
| флажок | wind flag |
| метеостанция | weather station |
| боковая составляющая | crosswind component |
| доля по часам | clock value |
| константа ветра | wind constant |
| зоны ветра | wind zones |
| средний ветер | average wind |
| мираж | mirage |
| формула тысячной | mil formula |
| плотность воздуха | air density |
| эталон условий | standard conditions |
| поправка условий | conditions correction |
| дыхание | breathing |
| спуск | trigger |
| пульс | pulse |
| вызов | call |
| упреждение | lead |
| сопровождение | tracking |
| засада | ambush |
| группа | group |
| СТП | MPI |
| поправка по второму выстрелу | second-shot correction |
| своя карточка | own card |
| угол места | shot angle |
| угол нуля | zero angle |
| правило косинуса | cosine rule |
| высота стрельбища | range altitude |
| деривация | spin drift |
| твист | twist |
| Кориолис | Coriolis |
| Этвёш | Eötvös |

`forms` у термина — английские формы, которые встречаются в текстах: множественное число, притяжательная форма («scopes», «turrets», «clicks»). Термин в верхнем регистре (MIL, MOA, DOPE, MPI, ZERO STOP, MANUAL) ищется с учётом регистра.

## Прочие слова

| ru | en |
| --- | --- |
| САМ / АВТО | MANUAL / AUTO |
| САМ лёгкий / сложный | MANUAL easy / hard |
| ВЕРТ | ELEV |
| ГОР / ВБОК | WIND (поправка вбок) |
| ДЕР | SPIN |
| кл. | cl. |
| блокнот стрелка | shooter’s notebook |
| тренер | coach |
| упражнение | exercise |
| допуск / зачтено | passed |
| зачёт | standards |
| полевой зачёт (12) | field test |
| курс «Снайперская подготовка» | Sniper course |
| позиция / рубеж | firing line / line |
| гонг | gong |
| бумажная мишень | paper target |
| патрон А, Б, В | cartridge A, B, C |
| разбор | breakdown |
| причина | cause |
| упрощение формулы | formula simplification |
| красный карандаш | red pencil |
| эталон | reference |
| часы (направление) | o’clock: «from 3 o’clock» |
| ДЕРЖАТЬ / ОГОНЬ | HOLD / FIRE |

## Правила

- Структура файла та же, что у русского: те же импорты (пути не меняются — каталоги соседние), те же имена экспортов, те же ключи, функции с теми же параметрами, списки той же длины и в том же порядке.
- Числа — только через `decimal`, `signed`, `percent`, `plural` из `../format`: они сами ставят точку в английском. Никаких `toFixed(n)` в строках и `replace('.', ',')`.
- Единицы приходят параметрами уже отформатированными (`distance`, `speed` и т. п.). Сразу после `${...}` не писать «m», «m/s», «°C», «hPa», «cm», «yd», «mph», «°F». Буквальные числа с единицами в обычном тексте допустимы («0.36″ per 100 yards»).
- Множественное: тройка форм `['shot', 'shots', 'shots']` — для английского берутся формы 0 и 2.
- Кириллицы в английских файлах нет.
- Тон: коротко, по-спортивному, как в русском; без военной лексики (sniper — только в названиях «Sniping Simulator» и «Sniper course»).
- Русские сокращения и обозначения в формулах переводить: Д → D, ВЕРТ → ELEV, V⊥ остаётся.
