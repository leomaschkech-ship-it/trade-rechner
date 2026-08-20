import { describe, expect, it } from 'vitest';
import { calculateScreeningScore } from './screening';
import type { ScreeningSetupTyp } from './types';

describe('calculateScreeningScore — Kernkriterien', () => {
  it('zählt alle 5 Kernkriterien, wenn alle erfüllt sind', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: true,
      relativeStaerkeErfuellt: true,
      naeheAn52WochenExtrem: true,
      brancheBestaetigtWoche: true,
      brancheBestaetigtMonat: true,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {},
    });
    expect(result.kernErfuellt).toBe(5);
    expect(result.kernGesamt).toBe(5);
  });

  it('zählt nur die tatsächlich erfüllten Kernkriterien', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: true,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: true,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {},
    });
    expect(result.kernErfuellt).toBe(2);
    expect(result.kernGesamt).toBe(5);
  });
});

describe('calculateScreeningScore — Exklusionskriterien', () => {
  it('markiert als ausgeschlossen, wenn wachsendeKorrekturen gesetzt ist, unabhängig von allen anderen Kriterien', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: true,
      relativeStaerkeErfuellt: true,
      naeheAn52WochenExtrem: true,
      brancheBestaetigtWoche: true,
      brancheBestaetigtMonat: true,
      wachsendeKorrekturen: true,
      volumenWarnsignal: false,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {},
    });
    expect(result.ausgeschlossen).toBe(true);
  });

  it('markiert als ausgeschlossen, wenn volumenWarnsignal gesetzt ist', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: false,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: false,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: true,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {},
    });
    expect(result.ausgeschlossen).toBe(true);
  });

  it('ist nicht ausgeschlossen, wenn beide Exklusionskriterien false sind', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: false,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: false,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {},
    });
    expect(result.ausgeschlossen).toBe(false);
  });
});

describe('calculateScreeningScore — Setup-Kriterien', () => {
  it('zählt setupGesamt als Anzahl der Kriterien des gewählten Setup-Typs ("long-ueber-p2" hat 6)', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: false,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: false,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {},
    });
    expect(result.setupGesamt).toBe(6);
  });

  it('zählt setupGesamt als Anzahl der Kriterien des gewählten Setup-Typs ("short-unter-p2" hat 5)', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: false,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: false,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'short-unter-p2',
      setupKriterien: {},
    });
    expect(result.setupGesamt).toBe(5);
  });

  it('zählt nur die tatsächlich erfüllten Setup-Kriterien des gewählten Typs', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: false,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: false,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'long-ueber-p2',
      setupKriterien: {
        'index-phase3': true,
        'aktie-phase3': true,
        'korrektur-50': false,
        'min-3-kerzen': true,
        'trendstaerke': false,
        'fib-25': false,
      },
    });
    expect(result.setupErfuellt).toBe(3);
  });

  it('wirft nicht bei unbekanntem setupTyp und liefert stattdessen 0/0', () => {
    const result = calculateScreeningScore({
      marktphaseBestaetigt: false,
      relativeStaerkeErfuellt: false,
      naeheAn52WochenExtrem: false,
      brancheBestaetigtWoche: false,
      brancheBestaetigtMonat: false,
      wachsendeKorrekturen: false,
      volumenWarnsignal: false,
      setupTyp: 'unbekannter-typ' as ScreeningSetupTyp,
      setupKriterien: {},
    });
    expect(result.setupGesamt).toBe(0);
    expect(result.setupErfuellt).toBe(0);
  });
});
