# Кандидаты на удаление

Правило (7.11): всё, что заменяется новым кодом, сразу помечается кандидатом на удаление. Новый и старый код могут жить рядом, но старый помечен, чтобы не смешивать живое с мёртвым и не строить новое на старом.

**Как помечаем:**
- в коде — JSDoc `@deprecated` на экспортах с указанием замены и задачи, после которой удаляем (IDE зачёркивает такие вызовы);
- здесь — строка в таблице.

**Правила:**
- новый код не импортирует помеченное;
- удаляем в той задаче, что указана в колонке «Удалить в»: вместе с тестами и e2e, которые проверяли только старое поведение;
- после удаления строка уходит в раздел «Удалено».

## Помечено

| Что | Почему уходит | Чем заменяется | Удалить в | Помечено в коде |
| --- | --- | --- | --- | --- |
| `IMPLEMENTED_FEATURES`, `playability` в `position.model` и причина «откроется позже» на брифинге | временная играбельность, с A9.3b играбельно всё | — | A10 | `@deprecated` на `playability` |
| рисованная сцена в `scope-renderer`: `drawScene`, `drawTarget`, `FLAG_DROP_MIL`, `drawnScenePole` | заглушка до фото (В22) | фото-слои A9.1; пока — запасная, если картинки не загрузились | A9.2, когда фото станут обязательными | `@deprecated` на методах |

## Будет помечено, когда появится замена

Здесь то, что по решениям уже обречено, но замены в коде ещё нет. Помечаем `@deprecated` в той задаче, где появляется замена.

| Что | Почему уходит | Чем заменится | Задача |
| --- | --- | --- | --- |

## Удалено

| Что | Когда | Задача |
| --- | --- | --- |
| `src/theme/_legacy-aliases.scss` (`--hub-*`, `--font-sans`, `--fire-gap`) и его `@use`; глобальные `.screen`, `.card`, `.spacer`, `.button`, `.chip`, `.top-bar`, `.ok-text`, `.error-text`, `.warn-text`, `.accent-text`; `--ion-tab-bar-*`; настройка `isSoundOn` (заменена громкостью, старое значение переводится при загрузке) | 10.11 | A7.4 |
| старый журнал `app/log` и формат выстрела `ShotRecord` / `shots` — остаток удалённой свободной игры, никто не писал (В31) | 9.11 | A7.2 |
| события `hit` и `gauge-read` в `FeedbackService` — объявлены, но не вызывались; вибрация по `switch` — заменена таблицей `FEEDBACK_PLAN` (В31) | 9.11 | A4 |
| строка над стеклом `shotLine` («Дошли патрон затвором») — заменена плашкой рации (В31) | 9.11 | A6.4 |
| временная карточка итога на позиции: `endCard`, `EndCard`, разметка `end-card`, кнопки «К тропе» и «Ещё раз»; `isSkillGoalMet` / `isTopSkillGoalMet` в `SkillGoals` (теперь `GoalCheck` с фактом) — В17, В31 | 9.11 | A6.3 |
| старый разбор `app/debrief` и маршрут `/journal/:shotId`; `explainMiss`, `MissExplanation`, `MissCause`, `RULE_CARDS`, `RuleCard`; `qualityLabel`, `TRIGGER_QUALITY_TEXT`; `recordShot`, `shotById`, `cause` и `verdict` в `ShotRecord`; строка «ПОПАДАНИЕ / ПРОМАХ» на стекле — В12, В31 | 9.11 | A6.1 |
| старая свободная игра целиком: `app/weather`, `app/calc`, `app/wind`, `app/dope`, `app/scope`, `GameSession` и маршруты к ним; e2e `calculation`, `shooting`; кнопка «В DOPE» старого разбора; ставшие ничьими `TARGETS`, `crosswindByClockRule`, `formatClock`, `densityAltitudeM`, `isTransonic`, `daySeed`, `clicksFor`, `DRUM_DRAG_PT_PER_CLICK`; значение по умолчанию `loadedRounds` в `ScopeSession`; снимки 03–14 и 16 — В31, ответ автора 8.11 | 8.11 | A5.1 |
| нижние вкладки `app/tabs`, хаб `app/hub` (9 задач), викторины `app/quiz`, `sim/tasks.ts`, `core/score.ts` и звёзды (`TaskResult`, `results`, `passedTaskIds`), уровни задач в старом потоке (давление до Lv3, `shotsLeft`, итог задачи на прицеле) — В1, В3, В31 | 7.11 | A2 |
| тема B «Дневное снаряжение»: `[data-theme='day']`, `ThemeName`, `settings.theme`, выбор темы в настройках, `isDayTheme` в сцене, снимки `*-day.png`; Caveat и `--font-hand` — В23, одна тема | 7.11 | A1 |
| прицел Fine 8–32× (`fine` в `SCOPES`) и ветка `case 'fine'` в `app/scope/scope-renderer` — В30, каталог из пяти прицелов; сохранённый `fine` читается как `course-dot` | 7.11 | S11 |
