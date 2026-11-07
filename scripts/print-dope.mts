import { readFileSync } from 'node:fs';
import { CARTRIDGES } from '../src/core/content.ts';
import { buildDopeCard, DopeCard, dopeRowAt } from '../src/core/dope-card.ts';
import { BallisticsEngine } from '../src/core/engine.ts';
import { atmosphereCorrectionMil, averageCrosswindMps, crosswindMps, leadMil, roundToClicks, windCorrectionMil } from '../src/core/game-formulas.ts';

const CLICK_MIL = 0.1;
const ballisticsVersion = JSON.parse(readFileSync(new URL('../node_modules/js-ballistics/package.json', import.meta.url), 'utf-8')).version;
const engine = new BallisticsEngine();
const cards = new Map<string, DopeCard>();
for (const cartridge of CARTRIDGES) {
  cards.set(cartridge.id, await buildDopeCard(engine, cartridge, CLICK_MIL));
}

const fixed = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');
const signedMil = (value: number): string => `${value < 0 ? '← ' : '→ '}${fixed(Math.abs(value), 2)}`;

console.log(`Сгенерировано \`npm run docs:dope\`, js-ballistics ${ballisticsVersion}, ${new Date().toISOString().slice(0, 10)}. Руками не править.\n`);
for (const cartridge of CARTRIDGES) {
  console.log(`**Патрон ${cartridge.name.replace('Патрон ', '')}** — ноль 100 м, эталон +15 C / 1013 гПа / 50 %:\n`);
  console.log('| ДИСТ, м | ВЕРТ, MIL | Клики | t, с | K ветра | Холоднее на 10 °C, MIL | Давление +10 гПа, MIL |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of cards.get(cartridge.id)!.rows) {
    console.log(`| ${row.distanceM} | ${fixed(row.elevationMil, 1)} | ${row.clicks} | ${fixed(row.timeOfFlightS, 2)} | ${row.windConstant} | ${fixed(row.colderBy10CMil, 2)} | ${fixed(row.pressureUp10HpaMil, 2)} |`);
  }
  console.log('');
}

console.log('**Веса зон ветра** (C9, В29) — доля сноса от зоны, шаг 0,05, сумма 1; зоны: станция 0–150 м · флажок 200 (150–350) · флажок 400 (350–550) · флажок 600 (550+):\n');
console.log('| ДИСТ, м | ' + CARTRIDGES.map(cartridge => cartridge.name).join(' | ') + ' |');
console.log('| --- | ' + CARTRIDGES.map(() => '---').join(' | ') + ' |');
for (const distanceRow of cards.get('B')!.rows) {
  const cells = CARTRIDGES.map(cartridge => dopeRowAt(cards.get(cartridge.id)!, distanceRow.distanceM).zoneWeights.map(weight => fixed(weight, 2)).join(' · '));
  console.log(`| ${distanceRow.distanceM} | ${cells.join(' | ')} |`);
}
console.log('');

const cardB = cards.get('B')!;
const row = (distanceM: number) => dopeRowAt(cardB, distanceM);
const clicks = (mil: number) => roundToClicks(mil, CLICK_MIL);
const describeSet = (name: string, conditions: string, steps: string) => console.log(`| **${name}** | ${conditions} | ${steps} |`);

console.log('| Набор | Условия (патрон Б) | Шаги и итог |');
console.log('| --- | --- | --- |');
{
  const r = row(300); const atm = atmosphereCorrectionMil(r, 14, 1015); const wind = windCorrectionMil(3.2, 9, 300, r.windConstant);
  describeSet('А — базовый (иллюстрация, «свободная стрельба · 300 м»)', '300 м, ветер 3,2 м/с с 9 ч, +14 C, 1015 гПа',
    `ДОПЕ ↑ ${fixed(r.elevationMil, 1)} · атмосфера ${fixed(atm, 2)} → ${clicks(atm)} кл. · K = ${r.windConstant} · W = 3,2 × 300 / ${r.windConstant} = ${signedMil(wind)} → ${Math.abs(clicks(wind))} кл. влево · итог ↑ ${fixed(r.elevationMil + atm, 1)} ${signedMil(wind)}`);
}
{
  const r = row(300); let best = { speed: 0, mil: 0 };
  for (let speed = 1.5; speed <= 3.5; speed = Math.round((speed + 0.1) * 10) / 10) {
    const mil = Math.abs(windCorrectionMil(speed, 9, 300, r.windConstant));
    const fraction = Math.abs(mil * 10 - Math.floor(mil * 10) - 0.5);
    if (best.speed === 0 || fraction < Math.abs(best.mil * 10 - Math.floor(best.mil * 10) - 0.5)) best = { speed, mil };
  }
  describeSet('Б — округление', `как А, но ветер ${fixed(best.speed, 1)} м/с`,
    `W = ${fixed(best.speed, 1)} × 300 / ${r.windConstant} = ${fixed(best.mil, 3)} → до клика ${fixed(clicks(best.mil) / 10, 1)}; ответ на клик меньше = «почти · ОКРУГЛЕНИЕ»`);
}
{
  const r = row(600); const right = Math.abs(windCorrectionMil(3.2, 11, 600, r.windConstant)); const trap = (3.2 * 600) / r.windConstant;
  describeSet('В — подстановка', '600 м, ветер 3,2 м/с с 11 ч',
    `доля 0,5 → V⊥ = ${fixed(crosswindMps(3.2, 11), 1)} · W = 1,6 × 600 / ${r.windConstant} = ${fixed(right, 2)}; с V = 3,2 вместо V⊥ → ${fixed(trap, 2)}, разница ${Math.abs(clicks(trap) - clicks(right))} кл. = «ошибка · ПОДСТАНОВКА»`);
}
{
  const r = row(600); const atm = atmosphereCorrectionMil(r, -5, 1030); const wind = Math.abs(windCorrectionMil(3.2, 9, 600, r.windConstant)); const wrongWind = Math.abs(windCorrectionMil(2.4, 9, 600, r.windConstant));
  describeSet('Г — АВТО, условия (упр. 07)', '600 м, ветер 3,2 м/с с 9 ч, −5 C, 1030 гПа',
    `ДОПЕ ↑ ${fixed(r.elevationMil, 1)} · атмосфера 2 × ${fixed(r.colderBy10CMil, 2)} + 1,7 × ${fixed(r.pressureUp10HpaMil, 2)} = ↑ ${fixed(atm, 2)} (${clicks(atm)} кл.) · W = ${fixed(wind, 2)} · итог ↑ ${fixed(r.elevationMil + atm, 1)} ← ${fixed(wind, 1)}. Ошибки примера: условия не учтены (${clicks(atm)} кл.); введено 2,4 м/с → W ${fixed(wrongWind, 2)} (${clicks(wind) - clicks(wrongWind)} кл.)`);
}
{
  const r = row(400); const lead = leadMil(1.2, 3, r.timeOfFlightS, 400);
  describeSet('Д — упреждение (упр. 11)', '400 м, штиль, цель 1,2 м/с поперёк',
    `ДОПЕ ↑ ${fixed(r.elevationMil, 1)} · t = ${fixed(r.timeOfFlightS, 2)} с · L = 1,2 × ${fixed(r.timeOfFlightS, 2)} / 400 × 1000 = ${fixed(lead, 2)} MIL сеткой`);
}
{
  const r = row(300); const atm = atmosphereCorrectionMil(r, 35, 1000);
  describeSet('Е — жара', '300 м, +35 C, 1000 гПа', `атмосфера = −2 × ${fixed(r.colderBy10CMil, 2)} − 1,3 × ${fixed(r.pressureUp10HpaMil, 2)} = ${fixed(atm, 2)} → ${clicks(atm)} кл.; итог ↑ ${fixed(r.elevationMil + atm, 1)}`);
}
{
  const r = row(600); const zoneWinds = [3, 2, 4, 1]; const average = averageCrosswindMps(zoneWinds, r.zoneWeights); const wind = Math.abs(windCorrectionMil(average, 9, 600, r.windConstant));
  const terms = zoneWinds.map((windMps, index) => `${fixed(r.zoneWeights[index], 2)} × ${fixed(windMps, 1)}`).join(' + ');
  describeSet('К — зоны ветра (упр. 09)', '600 м, все ветры слева: станция 3,0 м/с с 9 ч, флажки 200 / 400 / 600 — 2,0 / 4,0 / 1,0 м/с поперёк',
    `веса строки 600: ${r.zoneWeights.map(weight => fixed(weight, 2)).join(' · ')} · V⊥ср = ${terms} = ${fixed(average, 2)} · W = ${fixed(average, 2)} × 600 / ${r.windConstant} = ← ${fixed(wind, 2)} → ${clicks(wind)} кл. влево`);
}
