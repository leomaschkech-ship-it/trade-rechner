import { describe, expect, it } from 'vitest';
import { calculateAbschluss } from './journal';
import { ValidationError } from './positionSize';

describe('calculateAbschluss — Long', () => {
  it('berechnet Gewinn, P/L% und CRV korrekt bei einem Gewinn-Trade', () => {
    const result = calculateAbschluss({
      richtung: 'long',
      einstiegGepuffert: 100.1,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 10000,
      ausstiegPreis: 110,
      gebuehren: 5,
    });

    expect(result.plEuro).toBeCloseTo(183.1, 3);
    expect(result.plProzent).toBeCloseTo(1.831, 3);
    expect(result.crv).toBeCloseTo(1.855, 3);
  });

  it('berechnet einen negativen P/L und ein negatives CRV bei einem Verlust-Trade', () => {
    const result = calculateAbschluss({
      richtung: 'long',
      einstiegGepuffert: 100.1,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 10000,
      ausstiegPreis: 97,
      gebuehren: 5,
    });

    expect(result.plEuro).toBeCloseTo(-63.9, 3);
    expect(result.plProzent).toBeCloseTo(-0.639, 3);
    expect(result.crv).toBeCloseTo(-0.6474, 3);
  });

  it('ändert bei abweichendem tatsächlichem Einstieg nur den P/L — der CRV-Nenner bleibt das geplante Risiko', () => {
    const result = calculateAbschluss({
      richtung: 'long',
      einstiegGepuffert: 101, // tatsächlicher Fill, weicht vom geplanten 100.1 ab
      positionsgroesse: 19, // wie geplant, NICHT neu berechnet
      tatsaechlichesRisiko: 98.705, // wie geplant, NICHT neu berechnet
      depotgroesse: 10000,
      ausstiegPreis: 110,
      gebuehren: 5,
    });

    expect(result.plEuro).toBeCloseTo(166, 3); // (110-101)*19 - 5, statt 183.1 bei 100.1
    expect(result.crv).toBeCloseTo(1.6817, 3); // 166 / 98.705 — Nenner unverändert
  });
});

describe('calculateAbschluss — Short', () => {
  it('spiegelt die Rohgewinn-Berechnung (Einstieg − Ausstieg statt Ausstieg − Einstieg)', () => {
    const result = calculateAbschluss({
      richtung: 'short',
      einstiegGepuffert: 99.9,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 10000,
      ausstiegPreis: 90,
      gebuehren: 5,
    });

    expect(result.plEuro).toBeCloseTo(183.1, 3);
  });
});

describe('calculateAbschluss — Validierung', () => {
  it('lehnt einen nicht-positiven Ausstiegspreis ab', () => {
    const baseInput = {
      richtung: 'long' as const,
      einstiegGepuffert: 100.1,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 10000,
      gebuehren: 5,
    };
    expect(() => calculateAbschluss({ ...baseInput, ausstiegPreis: 0 })).toThrow(ValidationError);
    expect(() => calculateAbschluss({ ...baseInput, ausstiegPreis: -10 })).toThrow(ValidationError);
  });

  it('lehnt einen nicht-positiven tatsächlichen Einstieg ab', () => {
    const baseInput = {
      richtung: 'long' as const,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 10000,
      ausstiegPreis: 110,
      gebuehren: 5,
    };
    expect(() => calculateAbschluss({ ...baseInput, einstiegGepuffert: 0 })).toThrow(ValidationError);
    expect(() => calculateAbschluss({ ...baseInput, einstiegGepuffert: -10 })).toThrow(ValidationError);
  });

  it('lehnt negative Gebühren ab', () => {
    expect(() =>
      calculateAbschluss({
        richtung: 'long',
        einstiegGepuffert: 100.1,
        positionsgroesse: 19,
        tatsaechlichesRisiko: 98.705,
        depotgroesse: 10000,
        ausstiegPreis: 110,
        gebuehren: -1,
      }),
    ).toThrow(ValidationError);
  });

  it('akzeptiert Gebühren von genau 0 (kein Validierungsfehler)', () => {
    const result = calculateAbschluss({
      richtung: 'long',
      einstiegGepuffert: 100.1,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 10000,
      ausstiegPreis: 110,
      gebuehren: 0,
    });
    expect(result.plEuro).toBeCloseTo(188.1, 3);
  });

  it('gibt plProzent 0 zurück statt einer Division durch 0, wenn depotgroesse 0 ist', () => {
    const result = calculateAbschluss({
      richtung: 'long',
      einstiegGepuffert: 100.1,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      depotgroesse: 0,
      ausstiegPreis: 110,
      gebuehren: 5,
    });
    expect(result.plProzent).toBe(0);
    expect(Number.isFinite(result.plEuro)).toBe(true);
  });

  it('gibt crv 0 zurück statt einer Division durch 0 bei einer Positionsgröße von 0 (z.B. "keine Position möglich")', () => {
    const result = calculateAbschluss({
      richtung: 'long',
      einstiegGepuffert: 100.1,
      positionsgroesse: 0,
      tatsaechlichesRisiko: 0,
      depotgroesse: 10000,
      ausstiegPreis: 110,
      gebuehren: 5,
    });
    expect(result.crv).toBe(0);
    expect(result.plEuro).toBeCloseTo(-5, 3);
    expect(result.plProzent).toBeCloseTo(-0.05, 3);
  });
});
