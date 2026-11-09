# 14a · Доработка фото сцены — по первому набору

Первый набор (Gemini, 9.11, `docs/design/img/`) проверен по брифу [14](14-scene-photos.md). Здесь — что переделать и как. Требования брифа 14 остаются в силе; ниже только отличия и уточнения.

## Итог проверки

| Задание | Файл | Размер | Вердикт | Что делать |
| --- | --- | --- | --- | --- |
| T1 гонг | `…(1).jpg` | 848 × 1264 | годится | по желанию — без жёсткой тени на пластине (R1) |
| S2-300 вал | `…(3).jpg` | 1792 × 592 | годится по смыслу, мало пикселей | крупнее или кусками (R2) |
| S1 небо | `…(4).jpg` | 2064 × 512 | годится как небо | не срочно (R3) |
| S3 трава | `…(2).jpg` | 2064 × 512 | доработать | чистый фон; размытие — кодом (R4, см. второй набор) |
| T2 отметины | `….jpg` | 2064 × 512 | перегенерировать | без пробоин (R5) |

## Что выяснилось и меняет бриф 14

- **Вал выше горизонта.** Верх вала 2 м: на 300 м он на ~5 MIL выше горизонта, на 1000 м — на ~1,5 MIL. За валом дальний план почти не виден. Поэтому S1 нужен в основном как небо над валом, а холмы и лесополоса — только для сцен без вала (полевой рубеж 12, свободная игра).
- **Разрешение — главная проблема.** Генератор отдаёт ~2000 px по длинной стороне, а нужно ~100 px на 1 MIL. Вал на S2-300 вышел 16 px на MIL — резко только до 3–4×. Решение — генерировать кусками и апскейлить (R2).
- **Зелёный фон лучше всего вышел у гонга.** Где фон «почти зелёный» (S3), на размытых краях остаётся кайма.
- **Белый фон годится для отметин.** Белая краска на белом фоне ложится на белый гонг режимом «умножение» — вырезать не нужно.

---

## R1 · Гонг без жёсткой тени (по желанию)

**Проблема.** Справа на пластине жёсткая диагональная тень, будто от ножки стойки. В прицеле она читается как срезанный край круга. Её могу смягчить и сам — перегенерация по желанию.

**Что сохранить.** Всё остальное: белая матовая пластина, Λ-стойка, цепи, чистый зелёный фон, вид строго спереди.

**Добавить в промпт брифа 14 (T1):**
```
soft even shading across the plate, light from the left, no cast shadows on the plate,
the plate fully visible, nothing in front of it
```
**Добавить в negative:** `cast shadow on plate, diagonal shadow, shadow band`

**Приёмка:** пластина освещена ровно, левая сторона чуть светлее правой, без резких теней.

---

## R2 · Вал и земля S2 — то же, но крупнее

**Проблема.** Композиция верная: вал во всю ширину, ровная земля, пятак под гонг по центру, белое небо для вырезания. Но 16 px на MIL вместо 100 — на кратности по умолчанию 8× будет мыло.

**Как получить разрешение.** Два способа, лучше оба:

1. **Апскейл ×4–6** существующего файла (Topaz Gigapixel, Real-ESRGAN, Upscayl — бесплатный). Пришли результат как есть, сравню с исходником.
2. **Генерация кусками**, каждый — максимального размера генератора:
   - **R2a, вал крупно.** Только вал на всю ширину кадра, земля под ним — тонкой полосой.
   - **R2b, земля у цели.** Полоса земли перед валом с пятаком по центру, вид с земли.
   - **R2c, ближняя земля.** Трава ближе к стрелку, уже чуть размытая. Ниже R2b по кадру.

   Куски склею по линиям «низ вала» и «дальний край ближней травы». Свет и цвет у всех трёх должны совпадать: генерируй в одной сессии и ссылайся на первый кусок как на референс стиля.

**Промпт R2a (вал):**
```
Extreme telephoto close view of a long earthen rifle-range backstop berm about 2 metres high,
the berm fills the full width of the frame, seen straight on from ground level 300 metres away,
dry packed earth with patches of dry grass, hoof and bullet scuffs,
a thin strip of flat dry grass in front at the bottom of the frame,
plain white sky above the berm for cutting out,
late morning sun from the left, dry late-summer straw and olive tones,
photorealistic, very high detail, sharp, 1500mm lens compression
--ar 3:1
```
**Промпт R2b (земля у цели):**
```
Extreme telephoto view from 40 cm above the ground of a flat strip of packed earth and short dry grass
about 300 metres away, a small empty bare patch of ground in the exact centre where a target will stand,
the bottom edge of an earth berm visible as a thin band along the top of the frame,
late morning sun from the left, dry straw and olive tones,
photorealistic, very high detail, sharp focus, compressed perspective, 1500mm lens
--ar 3:1
```
**Промпт R2c (ближняя земля):**
```
Low ground-level telephoto view of dry short grass between 50 and 200 metres from the camera,
slightly out of focus, soft, compressed perspective, no objects,
late morning sun from the left, dry straw and olive tones, photorealistic
--ar 4:1
```
**Negative для всех:** из брифа 14 (S2) + `blurry berm, low resolution, painting, illustration`

**Приёмка:** вал R2a не меньше 400 px в высоту (тогда на 300 м выходит 60 px на MIL — резко до 8× на телефоне); в R2b пятак по центру; цвет и свет кусков совпадают.

**Для других дистанций** (S2-100, S2-600, S2-1000) — те же три куска, в промпте поменять «300 metres» и размер вала: на 100 м вал крупный, видна фактура комьев, на 600 и 1000 м вал — ровная полоса, трава — общий тон.

---

## R3 · Небо S1 — не срочно

**Что вышло.** Цвет, дымка и низкий спокойный горизонт хороши. Горизонт на 59 % высоты вместо 75 %. Вид как с обычного объектива: холмы и лесополоса мелкие, в прицеле станут ~1 MIL — читается как ровная степь, это допустимо.

**Решение.** Для упражнений с валом (01–11) беру из этого файла только небо — его разрешения хватает: небо гладкое. Дальний план понадобится для полевого рубежа 12 без вала. Тогда — перегенерация с крупными холмами.

**Промпт на потом (дальний план для 12):**
```
Extreme telephoto view of distant steppe hills 3 to 6 km away filling the lower third of the frame,
hills look large and close because of strong lens compression, 2000mm lens,
eye-level, perfectly level horizon, light haze, clear pale blue-grey sky,
dry late-summer straw and olive tones, late morning sun from the left,
photorealistic, sharp, no foreground
--ar 4:1
```

---

## R4 · Ближняя трава S3 — всё размыто, чистый фон

**Проблема.**
1. Справа колосья **резкие**. В прицеле, сфокусированном на цель в 300 м, трава в 10 м — сплошные мягкие пятна, ни одной резкой ости.
2. Фон «почти зелёный», а не чистый `#00ff00`. На размытых краях остаётся зелёная кайма.

**Промпт:**
```
Foreground dry grass stems and wheat seed heads seen from ground level,
entirely out of focus, every stem soft and blurred, no sharp stems anywhere,
heavy photographic bokeh, the camera is focused far away behind the grass,
stems rising from the bottom edge of the frame, the upper half completely empty,
isolated on a solid pure chroma green #00FF00 background, flat, uniform, no gradient,
straw and olive colours, soft late morning light from the left
--ar 4:1
```
**Negative:** `sharp focus, in focus, crisp details, awns in focus, gradient background, green tint on grass, flowers, insects, sky, landscape, text, watermark`

**Приёмка:** ни одного резкого колоса; фон одного цвета по всему кадру; верхняя половина пустая. 3 варианта густоты: редкая, средняя, густая.

---

## R5 · Отметины попаданий T2 — без пробоин

**Проблема.** Получились **пробоины насквозь** с чёрной дырой в центре. Гонг — бронесталь, пуля его не пробивает: она разбивается и оставляет серую свинцовую кляксу, вокруг облетает краска. Пробоины учат неправильному.

**Что сохранить.** Белый фон: отметина на белой краске ложится на белый гонг режимом «умножение» — белое исчезает само. Разные формы клякс в ряд — хорошо.

**Промпт:**
```
Six different lead bullet splash marks on white painted armoured steel, seen straight on,
no hole, no penetration, the steel is intact,
each mark is a flat grey smear of lead with a slightly darker centre and short radial streaks,
small flakes of white paint chipped off around the edges,
arranged in a row with even spacing, on a plain uniform white painted steel background,
macro photo, flat even lighting, sharp
--ar 4:1
```
**Negative:** `hole, bullet hole, puncture, black centre, crater, rust, blood, text, watermark, shadow`

**Приёмка:** в центре клякс нет чёрного; клякса серая, не чёрная; фон белый и ровный.

---

## Второй набор (9.11, `1iaghz…`)

| Задание | Файл | Размер | Вердикт |
| --- | --- | --- | --- |
| R2a вал | `….jpg` | 1792 × 592 | **принят.** Вал ~365 px в высоту ≈ 54 px на MIL на 300 м: резко до 6–8×, с апскейлом ×2 — до 12×. Небо белое, края по бокам почти стыкуются |
| R5 отметины | `…(1).jpg` | 2064 × 512 | **принят.** Пробоин нет, серые кляксы на белом. 5 штук — хватит. Тёмную точку в правом нижнем углу обрежу |
| R2b земля | `…(3).jpg` | 1792 × 592 | **не стыкуется.** Вал в 4 раза мельче, чем в R2a; вид с высоты человека (земля — 85 % кадра); пятак в 20–30 м от камеры и далеко от вала, поперёк дорожка |
| R4 трава | `…(2).jpg` | 2064 × 512 | **хуже первого.** Колосья резкие, за ними тёмно-зелёное пятно холма — хромакей его не уберёт |

### Что поменялось в заданиях

**R2b — полоса травы, а не «земля с пятаком».** Посчитал, что видно в стекле под гонгом: при 8× на 300 м — около 3 MIL земли, и это вся глубина от 300 до ~100 м, сжатая в узкую полосу. Пятак не нужен: гонг стоит у подножия вала, тень под стойкой рисует код. Нужна бесшовная полоса травы под скользящим углом в масштабе R2a: пучок травы 0,3 м на 300 м — 1 MIL, то есть ~54 px.

**Промпт R2b (новый):**
```
Seamless horizontal strip of short dry grass and packed earth seen from 40 cm above the ground,
extreme telephoto 1500mm view at about 300 metres, very strong compression, grazing angle,
the ground looks like a flat band, grass tufts about 50 pixels tall, uniform texture across the whole width,
no patches, no tracks, no paths, no berm, no sky, no objects,
same dry straw and olive tones and late morning light from the left as the reference berm image,
photorealistic, sharp, highly detailed, tileable left to right
--ar 4:1
```
**Negative:** `path, track, road, bare patch, circle, berm, hill, sky, horizon, high angle, aerial view, perspective depth, people, objects`

**Приёмка:** полоса однородна по ширине, без дорожек и пятен; пучки травы того же размера, что трава внизу R2a; при склейке с R2a по низу вала шов не бросается в глаза.

**R4 — резкие силуэты, размытие делаю кодом.** Генератор упорно оставляет колосья резкими. Это даже лучше: размытие кодом можно менять по кратности и дистанции (на 3× трава ближе к фокусу, на 24× — сплошные пятна). Нужны чистые силуэты колосьев на ровном зелёном, ничего за ними.

**Промпт R4 (новый):**
```
Dry grass stems and wheat seed heads rising from the bottom edge of the frame,
isolated cutout on a solid pure chroma green #00FF00 background,
nothing behind the grass, no hills, no trees, no field, no gradient,
upper half of the frame completely empty green,
straw colours, soft even light from the left, sharp clean silhouettes, studio cutout look
--ar 4:1
```
**Negative:** `background vegetation, hill, trees, field, landscape, sky, dark green shapes, gradient, shadow on background, bokeh blobs, text, watermark`

**Приёмка:** за травой только ровный зелёный; верхняя половина пустая. Если не выйдет — беру первый вариант S3 (`e87…(2).jpg`): у него за травой тоже только зелёный.

### Что уже можно собирать

R2a + T1 + R5 + небо из S1 — первая версия сцены для 300 м. Под гонгом до прихода R2b — полоса травы с низа R2a.

## Куда класть

Новые файлы — в `ognevoy-rubezh/assets-inbox/scene/`, с именем задания: `R2a-berm-300-1.png`, `R4-grass-sparse.png` и т. п. Первый набор из `docs/design/img/` перенесу туда же при подключении (A9).

## Порядок

1. **R2** (вал крупнее) и **R5** (отметины) — без них первая версия сцены не собирается.
2. **R4** (трава) — передний план.
3. **R1** — по желанию; тень смягчу и сам.
4. **R3** — вместе с полевым рубежом 12.
