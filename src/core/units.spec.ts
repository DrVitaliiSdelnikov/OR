import { describe, expect, it } from 'vitest';
import { displayDigits, displayStep, fromInput, inSystem, QUANTITIES, toDisplay, UNIT_SYSTEMS } from './units';

describe('единицы: эталоны перевода (T1.1)', () => {
  it('имперский ввод → базовые единицы игры по точным коэффициентам', () => {
    expect(fromInput('distance', 100, 'imperial')).toBeCloseTo(91.44, 9);
    expect(fromInput('bulletMass', 1, 'imperial')).toBeCloseTo(0.06479891, 12);
    expect(fromInput('pressure', 29.92, 'imperial')).toBeCloseTo(1013.21, 2);
    expect(fromInput('windSpeed', 10, 'imperial')).toBeCloseTo(4.4704, 9);
    expect(fromInput('bulletLength', 1, 'imperial')).toBeCloseTo(25.4, 9);
    expect(fromInput('targetSize', 1, 'imperial')).toBeCloseTo(0.0254, 12);
    expect(fromInput('muzzleVelocity', 1, 'imperial')).toBeCloseTo(0.3048, 12);
    expect(fromInput('sightHeight', 1, 'imperial')).toBeCloseTo(25.4, 9);
  });

  it('°F со сдвигом: 15 °C → 59 °F, −40 °C → −40 °F, 32 °F → 0 °C', () => {
    expect(toDisplay('temperature', 15, 'imperial')).toBe(59);
    expect(toDisplay('temperature', -40, 'imperial')).toBe(-40);
    expect(fromInput('temperature', 32, 'imperial')).toBeCloseTo(0, 12);
  });
});

describe('единицы: показ и ввод', () => {
  it('показ округляет до шага системы', () => {
    expect(toDisplay('targetSize', 0.5, 'imperial')).toBe(20);
    expect(toDisplay('windSpeed', 2.54, 'imperial')).toBe(5.7);
    expect(toDisplay('targetSize', 0.52, 'metric')).toBe(0.5);
    expect(toDisplay('bulletLength', 31.2, 'imperial')).toBe(1.228);
  });

  it('ввод не округляет: 275 ярдов → 251,46 м', () => {
    expect(fromInput('distance', 275, 'imperial')).toBeCloseTo(251.46, 9);
  });

  it('ввод → базовое → показ возвращает введённое для каждой величины в обеих системах', () => {
    for (const system of UNIT_SYSTEMS) {
      for (const quantity of QUANTITIES) {
        const typed = 37 * displayStep(quantity, system);
        const shown = toDisplay(quantity, fromInput(quantity, typed, system), system);
        expect(shown, `${quantity} ${system}`).toBeCloseTo(typed, displayDigits(quantity, system));
      }
    }
  });

  it('metric — тождество в пределах шага', () => {
    expect(toDisplay('distance', 300, 'metric')).toBe(300);
    expect(fromInput('distance', 300, 'metric')).toBe(300);
    expect(fromInput('pressure', 1013.2, 'metric')).toBe(1013.2);
    expect(toDisplay('temperature', -5, 'metric')).toBe(-5);
  });

  it('шаг и число знаков по величине и системе', () => {
    expect(displayStep('targetSize', 'metric')).toBe(0.05);
    expect(displayDigits('targetSize', 'metric')).toBe(2);
    expect(displayStep('bulletLength', 'imperial')).toBe(0.001);
    expect(displayDigits('bulletLength', 'imperial')).toBe(3);
    expect(displayDigits('distance', 'imperial')).toBe(0);
    expect(displayDigits('windSpeed', 'metric')).toBe(1);
  });
});

describe('единицы на экранах (T1.8a)', () => {
  it('inSystem переводит без округления; в метрике — тождество', () => {
    expect(inSystem('temperature', -2.5, 'metric')).toBe(-2.5);
    expect(inSystem('temperature', -2.5, 'imperial')).toBeCloseTo(27.5, 9);
    expect(inSystem('distance', 600, 'imperial')).toBeCloseTo(656.168, 3);
    expect(inSystem('windSpeed', 2.5, 'imperial')).toBeCloseTo(5.5923, 4);
    expect(inSystem('pressure', 1030, 'imperial')).toBeCloseTo(30.416, 3);
  });

  it('высота: футы; смещение на цели: дюймы', () => {
    expect(QUANTITIES).toContain('altitude');
    expect(QUANTITIES).toContain('impactOffset');
    expect(toDisplay('altitude', 1500, 'imperial')).toBe(4920);
    expect(toDisplay('altitude', 1500, 'metric')).toBe(1500);
    expect(toDisplay('impactOffset', 30, 'imperial')).toBe(11.8);
    expect(toDisplay('impactOffset', 30, 'metric')).toBe(30);
  });
});
