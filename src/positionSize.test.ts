import { describe, expect, it } from 'vitest';
import { calculateEinstiegslimit, calculatePositionSize, ValidationError } from './positionSize';

describe('calculatePositionSize — Long', () => {
  it('berechnet Risiko, gepufferte Werte und Positionsgröße korrekt', () => {
    const result = calculatePositionSize({
      richtung: 'long',
      depotgroesse: 10000,
      risikoProzent: 1,
      einstiegRoh: 100,
      stopRoh: 95,
    });

    expect(result.risikoEuro).toBeCloseTo(100, 5);
    expect(result.einstiegGepuffert).toBeCloseTo(100.1, 5);
    expect(result.stopGepuffert).toBeCloseTo(94.905, 5);
    expect(result.positionsgroesse).toBe(19);
    expect(result.tatsaechlichesRisiko).toBeCloseTo(98.705, 3);
  });

  it('lehnt einen Stop auf oder über dem Einstiegskurs ab', () => {
    expect(() =>
      calculatePositionSize({ richtung: 'long', depotgroesse: 10000, risikoProzent: 1, einstiegRoh: 100, stopRoh: 100 }),
    ).toThrow(ValidationError);
    expect(() =>
      calculatePositionSize({ richtung: 'long', depotgroesse: 10000, risikoProzent: 1, einstiegRoh: 100, stopRoh: 105 }),
    ).toThrow(ValidationError);
  });
});

describe('calculatePositionSize — Short', () => {
  it('spiegelt den Puffer (Einstieg ×0,999 / Stop ×1,001)', () => {
    const result = calculatePositionSize({
      richtung: 'short',
      depotgroesse: 10000,
      risikoProzent: 1,
      einstiegRoh: 100,
      stopRoh: 105,
    });

    expect(result.einstiegGepuffert).toBeCloseTo(99.9, 5);
    expect(result.stopGepuffert).toBeCloseTo(105.105, 5);
    expect(result.positionsgroesse).toBe(19);
  });

  it('lehnt einen Stop auf oder unter dem Einstiegskurs ab', () => {
    expect(() =>
      calculatePositionSize({ richtung: 'short', depotgroesse: 10000, risikoProzent: 1, einstiegRoh: 100, stopRoh: 100 }),
    ).toThrow(ValidationError);
    expect(() =>
      calculatePositionSize({ richtung: 'short', depotgroesse: 10000, risikoProzent: 1, einstiegRoh: 100, stopRoh: 95 }),
    ).toThrow(ValidationError);
  });
});

describe('calculatePositionSize — Rundung & Grenzfälle', () => {
  it('rundet die Positionsgröße immer ab, nie auf', () => {
    // risikoEuro = 100, abstand ≈ 5,195 → 19,25... → muss auf 19 abrunden
    const result = calculatePositionSize({
      richtung: 'long',
      depotgroesse: 10000,
      risikoProzent: 1,
      einstiegRoh: 100,
      stopRoh: 95,
    });
    expect(result.positionsgroesse).toBe(19);
    expect(result.tatsaechlichesRisiko).toBeLessThanOrEqual(result.risikoEuro);
  });

  it('liefert Positionsgröße 0 als gültiges Ergebnis, wenn das Risiko den Stop-Abstand nicht deckt', () => {
    const result = calculatePositionSize({
      richtung: 'long',
      depotgroesse: 100,
      risikoProzent: 1,
      einstiegRoh: 100,
      stopRoh: 50,
    });
    expect(result.positionsgroesse).toBe(0);
    expect(result.tatsaechlichesRisiko).toBe(0);
  });
});

describe('calculatePositionSize — Validierung der Basiswerte', () => {
  it.each([
    ['depotgroesse', { richtung: 'long' as const, depotgroesse: 0, risikoProzent: 1, einstiegRoh: 100, stopRoh: 95 }],
    ['risikoProzent', { richtung: 'long' as const, depotgroesse: 10000, risikoProzent: 0, einstiegRoh: 100, stopRoh: 95 }],
    ['einstiegRoh', { richtung: 'long' as const, depotgroesse: 10000, risikoProzent: 1, einstiegRoh: -10, stopRoh: 95 }],
    ['stopRoh', { richtung: 'long' as const, depotgroesse: 10000, risikoProzent: 1, einstiegRoh: 100, stopRoh: -5 }],
  ])('lehnt nicht-positives %s ab', (_label, input) => {
    expect(() => calculatePositionSize(input)).toThrow(ValidationError);
  });
});

describe('calculateEinstiegslimit', () => {
  it('rechnet bei Long einen zusätzlichen Aufschlag auf den gepufferten Einstieg', () => {
    const result = calculateEinstiegslimit(100.1, 'long', 0.3);
    expect(result).toBeCloseTo(100.4003, 4);
  });

  it('rechnet bei Short einen gespiegelten Abschlag auf den gepufferten Einstieg', () => {
    const result = calculateEinstiegslimit(99.9, 'short', 0.3);
    expect(result).toBeCloseTo(99.6003, 4);
  });

  it('lehnt einen nicht-positiven Limitpuffer ab', () => {
    expect(() => calculateEinstiegslimit(100.1, 'long', 0)).toThrow(ValidationError);
    expect(() => calculateEinstiegslimit(100.1, 'long', -0.1)).toThrow(ValidationError);
  });
});
