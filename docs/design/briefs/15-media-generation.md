# 15 · Картинки для генерации: что ещё нужно

**Зачем.** Одно задание на все картинки, которых не хватает после сцены A9.1 и учебника A7.3b. Каждое задание — с геометрией в MIL и пикселях, размером, форматом, промптом и приёмкой, чтобы картинку можно было подключить без перегенерации.

**Кто что делает.** Генерируешь ты (Gemini, Midjourney, Flux, GPT-image — где разрешено коммерческое использование). Я режу, выравниваю, масштабирую в MIL, сжимаю в WebP и подключаю. Правила вида в прицеле, свет и палитра — из [брифа 14](14-scene-photos.md) («Главное: мы смотрим в прицел», «Общие правила»). Здесь они не повторяются, кроме важного для каждого задания.

**Куда класть.** `ognevoy-rubezh/assets-inbox/<группа>/<код>-<имя>-<вариант>.png`, например `assets-inbox/flags/F1-flag-45-a.png`. Код задания — в заголовке.

## Что уже есть и что не генерируем

| Есть (`public/scene/`) | Откуда |
| --- | --- |
| небо `sky.webp` | S1, первый набор: только небо, дальний план мелкий (R3) |
| вал `berm.webp` | R2a, второй набор — принят |
| земля у цели `ground.webp` | S2-300, первый набор — **временно**, мало пикселей → G1 |
| ближняя трава `grass.webp` | S3, первый набор — **временно** → G2 |
| гонг `gong.webp` | T1 — принят |
| отметины `mark-0…4.webp` | R5 — приняты |

**Не генерируем:**
- бумажную мишень 02 — рисую SVG (A9.2);
- сетки, круг прицела, мираж, дымку, колыхание травы — код;
- штампы, иконки интерфейса, текстуру бумаги — SVG и CSS: генератор не держит одну толщину линии в наборе;
- ростовые и грудные фигуры — позже (В22).

## Плотность пикселей: сколько нужно

Стекло — 276 pt, 1 MIL = 3,4 pt × кратность, на телефоне 1 pt = 2–3 px.

| Кратность | pt на 1 MIL | px на 1 MIL при ×3 |
| --- | --- | --- |
| 8× (по умолчанию) | 27 | 82 |
| 12× (курсовой прицел, максимум) | 41 | 122 |

**Цель — 100–120 px на 1 MIL у предмета на его дистанции.** Тогда предмет резкий до 12×. Предмет размером `S` м на дистанции `D` м занимает `S × 1000 / D` MIL. В каждом задании ниже — нужный размер в px, уже посчитанный.

Генератор отдаёт ~2000 px по длинной стороне. Если в задании больше — **генерируй кусками или апскейль ×2–×4** (Topaz, Real-ESRGAN, встроенный upscale). Апскейл — после генерации, до отправки.

**Фон для вырезки** — ровный `#00FF00` без градиента и теней на фоне. Альфа тоже годится, если генератор умеет.

---

## A9.2 · Сцена

### G1 · Земля у цели (замена `ground.webp`) — первым

**Что это.** Полоса земли под гонгом: всё, что видно в стекле между стрелком и валом. При 8× на 300 м это ~3 MIL по высоте — глубина от 300 до ~100 м, сжатая в узкую полосу.

**Геометрия.** Пучок травы 0,3 м на 300 м — 1 MIL, то есть **100–120 px**. Полоса — 4 : 1, **≥ 4096 × 1024 px** (кусками по 2048 и склейка — нормально). Стыкуется по краям: код повторяет её влево-вправо.

**Промпт:**
```
Seamless horizontal strip of short dry grass and packed earth seen from 40 cm above the ground,
extreme telephoto 1500mm view at about 300 metres, very strong compression, grazing angle,
the ground looks like a flat band, grass tufts about 100 pixels tall, uniform texture across the whole width,
no patches, no tracks, no paths, no berm, no sky, no objects,
dry straw and olive tones, late morning light from the left,
photorealistic, sharp, highly detailed, tileable left to right
--ar 4:1
```
**Избегать:** `path, track, road, bare patch, circle, berm, hill, sky, horizon, high angle, aerial view, perspective depth, people, objects`

**Приёмка:**
- полоса однородна по всей ширине: без дорожек, пятен, кругов;
- пучки травы 80–130 px в высоту;
- цвет и свет как у вала `berm.webp` (свет слева);
- левый и правый края стыкуются без заметного шва.

### G2 · Ближняя трава (замена `grass.webp`) — вторым

**Что это.** Колосья в 5–30 м перед стрелком: снизу кадра, поверх всего. Размытие делает код по кратности — нужны **резкие** силуэты.

**Геометрия.** Слой занимает 18 MIL по высоте, верхушки — на 6 MIL ниже горизонта. 4 : 1, **≥ 4096 × 1024 px**. Колосья — только в нижних 55 % кадра, верхние 45 % — пустой фон.

**Промпт:**
```
Dry grass stems and wheat seed heads rising from the bottom edge of the frame,
isolated cutout on a solid pure chroma green #00FF00 background,
nothing behind the grass, no hills, no trees, no field, no gradient,
upper half of the frame completely empty green,
straw colours, soft even light from the left, sharp clean silhouettes, studio cutout look
--ar 4:1
```
**Избегать:** `background vegetation, hill, trees, field, landscape, sky, dark green shapes, gradient, shadow on background, bokeh blobs, text, watermark`

**Приёмка:**
- за травой только ровный зелёный, никаких тёмных пятен (их не вырезать);
- верхние 45 % пустые;
- 2 варианта плотности: редкая и густая.

### G3 · Дальний план для полевого рубежа 12

**Что это.** В 12 нет вала: гонги стоят в открытой степи на 200–700 м, за ними — холмы у горизонта. Нынешнее небо S1 даёт холмы в ~1 MIL — в прицеле это ровная черта. Нужны крупные холмы.

**Геометрия.**
- Холмы в 3–6 км высотой 40–80 м → **8–25 MIL** над горизонтом.
- Горизонт — на **70 % высоты сверху**; ниже — ровная земля дальнего плана, её перекроет G4.
- 4 : 1, **≥ 6144 × 1536 px** (небо гладкое — апскейл ×3 допустим).
- Края стыкуются: стрелок водит прицелом на ±20 MIL.

**Промпт:**
```
Extreme telephoto view of distant steppe hills 3 to 6 km away, hills fill the band just above the horizon
and look large and close because of strong lens compression, 2000mm lens,
eye-level from a person lying on the ground, perfectly level horizon at 70 percent of the frame height,
gentle rounded hill silhouettes, light atmospheric haze on the hills, clear pale blue-grey sky above,
dry late-summer straw and olive tones, late morning sun from the left,
photorealistic, sharp, no foreground objects, tileable left to right
--ar 4:1
```
**Избегать:** `buildings, power lines, roads, trees in foreground, people, animals, sun, lens flare, fog, sunset, snow, sharp mountain peaks, text, watermark, vignette`

**Приёмка:**
- силуэт холмов спокойный, без острых пиков; перепад высоты холмов по кадру — до 2×;
- дымка мягче на дальних холмах, чем на ближних;
- 3 варианта: разные силуэты, тот же свет.

### G4 · Открытая степь до горизонта для 12

**Что это.** Земля между гонгами и горизонтом в 12: ровная степь, уходящая к холмам G3. Нижний край — трава на ~200 м, верхний — линия горизонта.

**Геометрия.**
- От 200 м до горизонта при лёжке — **2,5 MIL** по высоте (основание цели на 200 м ниже горизонта на 2,5 MIL).
- Пучок травы на 200 м: 0,3 м → 1,5 MIL → **150 px** внизу полосы, к горизонту мельчает до текстуры.
- 6 : 1, **≥ 6144 × 1024 px**; верхний край — горизонт, выше — `#00FF00`.

**Промпт:**
```
Seamless horizontal strip of open flat dry steppe receding to the horizon, seen from 40 cm above the ground,
extreme telephoto 1500mm compression, the whole depth from 200 metres to the horizon squeezed into a narrow band,
grass tufts at the bottom edge, fine texture toward the top, perfectly straight horizon line at the top edge,
solid pure chroma green #00FF00 above the horizon line, no sky, no hills,
dry straw and olive tones, late morning light from the left, no paths, no objects,
photorealistic, sharp, tileable left to right
--ar 6:1
```
**Избегать:** `hills, sky, clouds, trees, path, road, track, berm, people, animals, objects, high angle, aerial view`

**Приёмка:** горизонт — прямая линия по всей ширине; над ним только зелёный; по ширине однородно.

---

## A9.3 · Флажки и подвижная мишень

### F1 · Полотнище флажка — 5 состояний ветра × 2 кадра

**Что это.** Флажки на 200, 400 и 600 м по трассе (упр. 04, 09, 12, свободная игра): игрок читает по ним ветер. Сейчас код рисует красный треугольник. Шест рисует код, полотнище — картинка.

**Как флажок устроен в игре.**
- Шест 2,5 м, в 2,5 м сбоку от линии огня.
- Полотнище — прямоугольник **1,0 × 0,6 м**, ярко-красно-оранжевое (`#E0482F`), из плотной ткани, крепится к шесту короткой стороной у верхушки.
- Угол от вертикали = 9° на 1 м/с бокового ветра, не больше 80°.
- Ветер слева → полотнище вправо. Справа — код отражает картинку.

**Состояния** (угол полотнища от шеста вниз):

| Код | Угол | Ветер | Вид |
| --- | --- | --- | --- |
| F1-0 | 0° | штиль | висит вдоль шеста, складки вниз |
| F1-25 | 25° | ~3 м/с | чуть отходит, нижний край волнистый |
| F1-45 | 45° | ~5 м/с | наискось, волна по всей длине |
| F1-65 | 65° | ~7 м/с | почти горизонтально, конец полощется |
| F1-80 | 80° | 9 м/с и сильнее | горизонтально, натянуто, рябь по краю |

По **2 кадра** на состояние (`-a`, `-b`) с разной фазой волны: код меняет их для колыхания. Всего 10 картинок.

**Геометрия.** На 200 м при 12× полотнище — 5 MIL → **~600 px** по длине. Кадр **1024 × 1024 px**.

**Обязательно — точка крепления на одном месте во всех 10 кадрах.** Левый верхний угол полотнища (у шеста) — в точке **(160, 160) px** от левого верхнего угла кадра. Шест — тонкая тёмная вертикальная линия по x = 160 от верха до низа кадра: по ней я выровняю кадры и потом её сотру.

**Свет:** солнце слева-сзади; ткань чуть просвечивает, тени складок мягкие. Вид — строго сбоку, телеобъектив: перспективного сокращения у полотнища нет.

**Промпт** (меняется только состояние; пример для F1-45):
```
A single rectangular red-orange range wind flag of heavy fabric attached by its short side to the top of a thin dark vertical pole,
the pole runs from the top to the bottom of the frame at the left, the flag's top attached corner near the upper left,
the flag blows to the right and droops at 45 degrees below horizontal, one smooth wave along its length,
seen exactly side-on through a 1500mm telephoto lens, no perspective foreshortening,
isolated on a solid pure chroma green #00FF00 background, soft daylight from the left, fabric texture, realistic folds,
photorealistic, sharp, nothing else in the frame
--ar 1:1
```
Для других состояний замени `droops at 45 degrees below horizontal, one smooth wave` на:
- F1-0: `hangs straight down along the pole in still air, soft vertical folds`
- F1-25: `hangs down at 25 degrees away from the pole in a light breeze, gentle ripple at the free edge`
- F1-65: `flies almost horizontally at 65 degrees from the pole, the free end flapping`
- F1-80: `flies straight out horizontally, taut, small ripples along the free edge, strong wind`

**Избегать:** `multiple flags, triangle pennant, logo, emblem, text, stripes, pole top ornament, sky, landscape, shadow on background, perspective, motion blur`

**Приёмка:**
- одно прямоугольное полотнище, без рисунка и надписей;
- угол — как в таблице ±5°;
- крепление у (160, 160) ±20 px во всех кадрах;
- кадры `-a` и `-b` одного состояния отличаются только фазой волны.

### F2 · Тележка подвижной мишени и рельс для дозора 11

**Что это.** В 11 гонг едет поперёк или наискось со скоростью 0,4–1,7 м/с. Решение М1: мишень — подвижный гонг. Гонг уже есть (`gong.webp`), код ставит его на тележку. Нужна **тележка без гонга** и **рельс**.

**Тележка.**
- Низкая стальная тележка на 4 колёсах на узком рельсе, ширина ~1,2 м, высота корпуса ~0,4 м.
- Сверху по центру — вертикальная стойка-кронштейн высотой ~0,6 м: на неё код вешает гонг.
- Перед тележкой — наклонный стальной щиток (защищает колёса).
- Цвет — тёмно-оливковая краска, потёртости, свет слева.
- Вид строго спереди-сбоку под прямым углом к линии огня, телеобъектив.
- Геометрия: на 300 м при 12× тележка — 4 MIL → **~500 px** по ширине. Кадр **1536 × 1024 px**, тележка по центру, низ колёс — на 80 % высоты, верх стойки — на 25 %.

**Промпт:**
```
A low armoured moving-target trolley for a shooting range, side view at a right angle, seen through a 1500mm telephoto lens,
small steel cart on four wheels on a narrow rail, about 1.2 metres wide and 0.4 metres tall,
a slanted steel deflector plate covering the wheels at the front, a vertical mounting bracket about 0.6 metres tall in the centre on top,
no target on the bracket, dark olive paint with scuffs and bullet splash marks, late morning light from the left,
isolated on a solid pure chroma green #00FF00 background, photorealistic, sharp, no perspective
--ar 3:2
```
**Избегать:** `gong, target plate, mannequin, figure, person, vehicle, wheels showing rubber tyres, track on the ground, sky, landscape, text, logo`

**Рельс.**
- Бесшовная полоса: стальной рельс на шпалах в сухой траве, вид сбоку на уровне земли.
- 8 : 1, **≥ 4096 × 512 px**; рельс — горизонтальная линия на 60 % высоты; выше рельса — `#00FF00`.

**Промпт рельса:**
```
Seamless horizontal strip of a narrow steel rail on short sleepers lying in dry grass, side view at ground level,
extreme telephoto compression, the rail is a straight horizontal line across the whole frame at 60 percent height,
solid pure chroma green #00FF00 above the rail, dry straw grass below, late morning light from the left,
photorealistic, sharp, tileable left to right
--ar 8:1
```

**Приёмка:**
- на тележке нет мишени и людей; стойка видна и прямая;
- колёса стоят на рельсе;
- рельс прямой и горизонтальный, стыкуется по краям;
- 3 варианта тележки.

---

## A7.5 · Вводное 00: винтовка и прицел в разрезе (замена моих SVG)

**Что это.** Шаги 1 и 2 вводного: игрок тапает по частям, у каждой — бирка с подписью. Сейчас там мои схемы SVG.

**Стиль «прибор»** (TOKENS): тёмный металл на почти чёрном, латунные (`#C8A24A`) акценты, без глянца. **Техническая иллюстрация**, а не фото: чистые контуры, мягкая заливка, вид строго сбоку, без перспективы. Фон `#00FF00`. Без надписей и стрелок: подписи делает код.

### I1 · Винтовка сбоку

- Болтовая снайперская винтовка класса .308: деревянная или полимерная ложа, ствол, затвор с рукоятью справа (рукоять видна сверху ствольной коробки), отъёмный магазин снизу, спусковая скоба, прицел на кронштейнах.
- Дуло — **справа**, приклад — слева, горизонтально.
- Кадр **2400 × 1000 px**. Части не перекрывают друг друга — у каждой своё место (я размечу зоны тапа по готовой картинке):

| Часть | Где в кадре (x, y — доли ширины и высоты) |
| --- | --- |
| прицел | x 0,35–0,70, y 0,10–0,35 |
| ствол | x 0,70–0,98, y 0,40–0,50 |
| затвор (рукоять) | x 0,58–0,68, y 0,30–0,55 |
| спуск со скобой | x 0,42–0,52, y 0,55–0,75 |
| магазин | x 0,53–0,63, y 0,55–0,85 |

**Промпт:**
```
Clean technical side-view illustration of a bolt-action precision rifle, muzzle pointing right, stock on the left,
perfectly horizontal, no perspective, flat orthographic view,
dark gunmetal and matte black with subtle brass accents, soft shading, crisp outlines,
visible parts clearly separated: telescopic sight on rings on top, long barrel to the right, bolt handle on the right side of the action,
detachable box magazine below the action, trigger with trigger guard, synthetic stock,
isolated on a solid pure chroma green #00FF00 background, no text, no labels, no arrows, no brand marks
--ar 12:5
```
**Избегать:** `perspective, 3d angle, person, hands, ammunition scattered, bipod, suppressor, text, logo, brand, labels, callout lines, background scene`

### I2 · Прицел в разрезе

- Оптический прицел сбоку с продольным вырезом, внутри видны линзы. **Окуляр — слева**, объектив — справа и шире.
- Сверху — барабан ВЕРТ, сбоку, лицом к зрителю, — барабан ГОР (круг со шкалой), у окуляра — кольцо кратности с рифлением.
- Кадр **2400 × 1000 px**:

| Часть | Где в кадре |
| --- | --- |
| окуляр | x 0,02–0,18, y 0,30–0,70 |
| кольцо кратности | x 0,19–0,34, y 0,32–0,68 |
| барабан ВЕРТ | x 0,45–0,60, y 0,02–0,32 |
| барабан ГОР | x 0,45–0,60, y 0,36–0,68 |
| объектив | x 0,78–0,98, y 0,15–0,85 |

**Промпт:**
```
Clean technical cutaway illustration of a riflescope, side view, eyepiece on the left, wider objective bell on the right,
perfectly horizontal, flat orthographic view, a longitudinal cutaway showing the internal lens groups and erector tube,
elevation turret on top in the middle, windage turret on the side facing the viewer showing a round click scale,
ribbed magnification ring next to the eyepiece,
dark gunmetal and matte black with subtle brass accents, soft shading, crisp outlines,
isolated on a solid pure chroma green #00FF00 background, no text, no numbers, no labels, no arrows
--ar 12:5
```
**Избегать:** `perspective, rifle, mounts, hands, text, numbers, brand, labels, callout lines, reticle view, background scene`

**Приёмка I1–I2:**
- части в своих зонах ±0,05 доли кадра, не перекрываются;
- нет текста и цифр;
- фон ровный зелёный;
- 3 варианта каждой.

---

## Интерфейс

### U1 · Иконка приложения и заставка

- **Иконка:** латунная (`#C8A24A`) сетка-ёлка (перекрестие со шкалой вниз и точками) поверх тёмного стального круга, фон почти чёрный оливковый `#0C0E0A`. Простая форма: читается на 48 px.
- **Размер:** 1024 × 1024 PNG без прозрачности, без скруглений (скругляет система); значимое — в центральных 80 %.
- **Заставка:** та же эмблема по центру на `#0C0E0A`, 2732 × 2732, эмблема — 20 % ширины.

**Промпт иконки:**
```
Minimal app icon, a brass coloured riflescope reticle with a crosshair, a short drop scale below the centre and a few holdover dots,
on a dark steel circle, near-black olive background #0C0E0A, flat vector style with subtle metallic shading,
centred, bold simple shapes readable at small sizes, no text, no letters, no gun, no bullets
--ar 1:1
```
**Избегать:** `text, letters, rifle, bullets, blood, skull, military insignia, gradient background, glow, 3d perspective`

**Приёмка:** читается на 48 px; без текста и оружия.

### U2 · Знаки званий (по желанию)

- 5 званий: Курсант, Стрелок, Старший стрелок, Снайпер, Снайпер-инструктор.
- Нашивки в одном стиле: латунь и тёмная сталь, растёт сложность — 1 шеврон → 2 → 3 → перекрестие → перекрестие с венком.
- Каждая 1024 × 1024 на `#00FF00`, без текста.

Промпт — как у U1, с заменой предмета на `embroidered sleeve patch, brass thread on dark steel grey fabric` и описанием уровня.

---

## Порядок

1. **G1, G2** — сцена 01–11 становится резкой до 12× (A9.2).
2. **F1** — флажки (A9.3, и уже нужны в 04, 09 и свободной игре).
3. **F2** — дозор 11 (A9.3).
4. **G3, G4** — полевой рубеж 12 (A9.2).
5. **I1, I2** — вводное 00.
6. **U1**, затем по желанию **U2**.

## Что я сделаю с файлами

- **Приёмка.** `python tools/assets/check_inbox.py` проверяет всё в `assets-inbox/` по этому брифу: код задания в имени, размер и пропорции, стык краёв у полос, ровный зелёный фон, пустой верх G2, прямой горизонт G4 и рельс F2 на 60 %, место тележки, у флажка — шест, крепление (160, 160) и угол, пару кадров `-a`/`-b`, у иконки — без прозрачности. Отчёт — `assets-inbox/_report.md` (✓ / ✕ и числа по каждому пункту), вырезанные на прозрачный фон WebP и превью на сером — `assets-inbox/_ready/`. Угол флажка — оценка по нижнему свободному углу полотнища: для 0 / 25 / 45 / 65 / 80° он лежит на 0 / 16 / 28 / 42 / 52° от шеста.
- **Обработка.** Вырезаю зелёный фон, выравниваю горизонты и точку крепления флажка, меряю масштаб в px на MIL, сжимаю в WebP. Расширяю `tools/scene/prepare.py` и записываю промеры в `scene.model.ts`.
- **Флажки.** Код выбирает ближайшее состояние по углу, крутит полотнище на оставшиеся ±10° и меняет кадры `-a`/`-b` с частотой от ветра.
- **Тележка.** Код ставит гонг на стойку; колёса и рельс в одной плоскости.
- **Зоны тапа.** Для I1–I2 пересчитываю зоны тапа по готовой картинке.
- **Проверка.** Каждый слой проверяю снимками сцены на 3×, 8× и 12×.
