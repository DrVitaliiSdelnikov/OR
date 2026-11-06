# Огневой рубеж — мобильная версия

Симулятор подготовки к стрельбе на 300, 500 и 700 м. Отдельный проект, к Carebox не относится.

- Техническая реализация (источник решений): https://claude.ai/artifact/M7u2xxQNDfYdEnNFM2JvHt
- Дизайн-система «Хаб расчёта» (источник вида и поведения): https://claude.ai/artifact/3bVMwcYNSDQEVPVER1VbEE
- Веб-альфа 3 и мобильная пре-альфа — источник ядра, перенесено в `src/core` и `src/sim`.

## Стек

Angular 21 (zoneless, standalone) + Ionic 8 + Capacitor 8, js-ballistics 3.1.0, PixiJS 8 (сцена — этап 3, сейчас временный Canvas 2D).

## Слои

```
src/core   чистый TS: баллистика, сценарий и ветер, выстрел и разбор, очки, полевые формулы
src/sim    без DOM: пульс, покачивание и дыхание, спуск, затвор, прицелы и барабаны, задачи, сессия прицела
src/app    Angular/Ionic: экраны, хранилище (Preferences), звук и вибрация, рендер прицела
e2e        пользовательские сценарии Playwright, портрет 390×844
```

## Команды

```
npm start            dev-сервер
npm run test:unit    юнит-тесты core и sim (Node, vitest)
npm run test:e2e     пользовательские сценарии (Playwright, Chromium)
npm run build        сборка
```

Node 22.22+; установка зависимостей — с `legacy-peer-deps` (прописано в `.npmrc`, обход ошибки npm в разборе peer-зависимостей).
