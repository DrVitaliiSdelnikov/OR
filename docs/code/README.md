# Код: порядок работы и проверка на устройствах

## Порядок работы над модулем (правило 7.11)

Каждый модуль проходит четыре шага, строго по порядку. Следующий шаг начинается, только когда предыдущий готов. Спека начинается после одобрения автора.

1. **Спека модуля** — `docs/code/specs/<слой>-<модуль>.md` по шаблону ниже. Что делает модуль, вход и выход, правила со ссылками на `logic/` и `design/`, граничные случаи, план тестов, проверка на устройствах. Код по спеке пишется только после того, как автор её одобрил.
2. **Юнит-тесты важной логики** — рядом с файлом (`*.spec.ts`). Пишутся до кода и падают, пока кода нет. Важная логика — всё, что считает числа, принимает решение (оценка, диагноз, проверка) или хранит состояние. Каждый тест проверяется мутацией (правило 22 CLAUDE.md): ломаем поведение → тест красный → возвращаем → зелёный. Таблица «мутация → упавшие тесты» записывается в спеку.
3. **Код и шаблон** — по спеке, без комментариев сверх критичных, говорящие имена (CLAUDE.md, правила 17–18).
4. **Пользовательские тесты** — Playwright в `e2e/`, сценарии из спеки, на всех проектах матрицы устройств ниже. Новые сценарии тоже проходят мутацию.

**Когда что гонять:**
- после правки — юнит-тесты изменённого модуля;
- после экрана — его e2e-спека на `mobile-chromium` (dev-сервер);
- перед слиянием — один полный прогон на обоих телефонах на собранном приложении: `npm run test:e2e:build` (сборка и статический сервер на порту 4320, без пересборок dev-сервера);
- мутации логики — юнит, e2e-мутации — только для разметки (элемент не виден, кнопка не работает);
- долгий ввод в e2e — помощником (`setWindSpeed` — с клавиатуры), а не десятками нажатий.

**Перед слиянием (с 8.11):**
- визуальная проверка экрана — в Chrome или снимками Playwright (`e2e/*-shots.mts` → `docs/design/screens/`, новые снимки — в DESIGN-CURRENT);
- спека дополняется разделами «Как сделано», «Отступления от черновика», «Мутации»; статус в шапке спеки, ✓ в [BACKLOG.md](BACKLOG.md), строка в таблице «Спеки» ниже;
- ветка `feat/<задача>`, коммит по явным путям, затем `git merge --ff-only` в `master`.

Спека — источник правды для модуля. Если в коде решили иначе, сначала правим спеку.

**Кандидаты на удаление (7.11).** Всё, что заменяется новым кодом, сразу помечается `@deprecated` и вносится в [REMOVAL-CANDIDATES.md](REMOVAL-CANDIDATES.md) с задачей, в которой удаляется. Новый код не импортирует помеченное.

## Матрица устройств

Всё, что делаем, должно корректно работать и проверяться в трёх средах.

| Среда | Как запускать | Что проверяем | Ограничения |
| --- | --- | --- | --- |
| Симуляция телефона в Playwright | `npm run test:e2e` — проекты `mobile-chromium` (Pixel 7, Android Chrome) и `mobile-webkit` (iPhone, Safari) | все пользовательские сценарии, касания (`hasTouch`), портрет 390 × 844, безопасные зоны | вибрации и звука нет — проверяем вызовы через подмену сервиса |
| Мобильный браузер на настоящем телефоне | `npm run start:lan` → открыть `http://<IP компьютера>:4200` в Chrome на Android или Safari на iPhone (одна Wi-Fi сеть) | ощущение: жесты барабанов, щипок, удержание, вибрация, звук, 60 кадров | вибрация в вебе — только Android Chrome (`navigator.vibrate`); на iPhone в Safari её нет; звук включается после первого касания |
| Нативная сборка Capacitor (позже) | Android Studio / Xcode | настоящая тактильная отдача (`selectionChanged`), производительность на среднем Android | появится, когда добавим платформы Capacitor |

Требования к коду, чтобы всё это работало:
- **Касания.** Только Pointer Events (`pointerdown` / `pointermove` / `pointerup`) и `touch-action: none` на жестовых зонах. Без событий мыши и без hover-логики.
- **Обратная связь.** Вибрация и звук — только через `FeedbackService`. Каждый вызов безопасен там, где возможности нет: никаких исключений, только отсутствие эффекта. В e2e сервис подменяется, и тест проверяет, что вызов был.
- **Звук.** `AudioContext` создаётся после первого касания: требование Safari и Chrome.
- **Экран.** Портрет, `viewport-fit=cover`, отступы от безопасных зон (`env(safe-area-inset-*)`), без горизонтальной прокрутки.
- **Тестовые якоря.** У всех интерактивных элементов есть `data-test`.

## Шаблон спеки модуля

```markdown
# <слой>/<модуль>

Статус: черновик / одобрено <дата> / реализовано
Решения: <номера из QUESTIONS> · Правила: <ссылки на logic/, design/>

## Зачем
## Публичный интерфейс
## Правила (со ссылками, без копий чисел)
## Граничные случаи
## Юнит-тесты (важная логика)
| # | Что проверяем | Пример |
## Пользовательские тесты (если модуль виден игроку)
| # | Сценарий | Устройства |
## Проверка на устройствах
## Мутации (заполняется после тестов)
| Мутация | Упавшие тесты |
```

## Спеки

| Модуль | Файл | Статус |
| --- | --- | --- |
| core/game-formulas + правило часов + дальность 1000 м | [specs/core-game-formulas.md](specs/core-game-formulas.md) | реализовано, слито в `master` 7.11 |
| core/dope-card + калибровка формул по ядру (C4, C5) | [specs/core-calibration.md](specs/core-calibration.md) | реализовано, слито в `master` 7.11 |
| core/exercise-scoring + core/calc-check (C6, C7) | [specs/core-scoring-and-check.md](specs/core-scoring-and-check.md) | реализовано, слито в `master` 7.11 |
| sim/turret-target + sim/shot-review (S1–S5) | [specs/sim-shot-review.md](specs/sim-shot-review.md) | реализовано, слито в `master` 7.11 |
| sim/firing-line + холодный выстрел (S6–S7) | [specs/sim-series.md](specs/sim-series.md) | реализовано, слито в `master` 7.11 |
| sim/course — курс 00–12 (S8) | [specs/sim-course.md](specs/sim-course.md) | реализовано, слито в `master` 7.11 |
| core/moving-target (C8) | [specs/core-moving-target.md](specs/core-moving-target.md) | реализовано, слито в `master` 7.11 |
| core · зоны ветра (C9) | [specs/core-wind-zones.md](specs/core-wind-zones.md) | реализовано, слито в `master` 7.11 |
| sim/notebook (S9) | [specs/sim-notebook.md](specs/sim-notebook.md) | реализовано, слито в `master` 7.11 |
| sim/patrol (S10) | [specs/sim-patrol.md](specs/sim-patrol.md) | реализовано, слито в `master` 7.11 |
| sim/scope-model — каталог прицелов (S11) | [specs/sim-scope-catalog.md](specs/sim-scope-catalog.md) | реализовано, слито в `master` 7.11 |
| app · токены и одна тема (A1) | [specs/app-tokens.md](specs/app-tokens.md) | реализовано, слито в `master` 7.11 |
| app · главный экран и курс-тропа (A2) | [specs/app-main-course.md](specs/app-main-course.md) | реализовано, слито в `master` 7.11 |
| app · позиция, часть 1: каркас и упр. 01–02 (A3.1) | [specs/app-position.md](specs/app-position.md) | реализовано, слито в `master` 8.11 |
| app · позиция, часть 2: спуск, затвор, дыхание (A3.2) | [specs/app-position-trigger.md](specs/app-position-trigger.md) | реализовано, слито в `master` 8.11 |
| app · шторка блокнота и вкладки, АВТО (A5.1) | [specs/app-notebook-sheet.md](specs/app-notebook-sheet.md) | реализовано, слито в `master` 8.11 |
| app · лист расчёта САМ (A5.2) | [specs/app-calc-sheet.md](specs/app-calc-sheet.md) | реализовано, слито в `master` 9.11 |
| app · разбор выстрела и проверка (A6.1) | [specs/app-debrief.md](specs/app-debrief.md) | реализовано, слито в `master` 9.11 |
| app · разбор: почему ушла пуля, траектории и группа (A6.2) | [specs/app-debrief-causes.md](specs/app-debrief-causes.md) | реализовано, слито в `master` 9.11 |
| app · итог упражнения и карточка брифинга (A6.3) | [specs/app-result-briefing.md](specs/app-result-briefing.md) | реализовано, слито в `master` 9.11 |
| app · подсказки инструктора: рация, обучение 01–03, забытый фактор (A6.4) | [specs/app-instructor.md](specs/app-instructor.md) | реализовано, слито в `master` 9.11 |
| app · сцена в стекле из фото, пределы наведения (A9.1) | [specs/app-scene-photos.md](specs/app-scene-photos.md) | реализовано, слито в `master` 9.11 |
| app · звук и вибрация по TOKENS (A4) | [specs/app-feedback.md](specs/app-feedback.md) | реализовано, слито в `master` 9.11 |
| app · учебник: ссылки, схемы, песочница (A7.3b) | [specs/app-textbook-extras.md](specs/app-textbook-extras.md) | b1 ссылки — слито в `master` 9.11; b2, b3 — впереди |
| app · учебник курсанта (A7.3) | [specs/app-textbook.md](specs/app-textbook.md) | реализовано, слито в `master` 9.11 |
| app · журнал стрелка (A7.2) | [specs/app-journal.md](specs/app-journal.md) | реализовано, слито в `master` 9.11 |
| app · свободная игра (A7.1) | [specs/app-free-play.md](specs/app-free-play.md) | реализовано, слито в `master` 9.11 |
| app · обучающие подсказки для новинок 04–10 (A6.5) | [specs/app-instructor-novelties.md](specs/app-instructor-novelties.md) | реализовано, слито в `master` 9.11; 09 и 11 — вместе с их механиками |
