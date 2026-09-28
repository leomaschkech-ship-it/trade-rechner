import { describe, expect, it } from 'vitest';
import type { IndexDatei, Kursreihe } from './daten';
import { STANDARD_EINSTELLUNGEN } from './regeln';
import { scanneIndex } from './scan';

function verlauf(wegpunkte: [number, number][]): Kursreihe {
  const reihe: Kursreihe = { d: [], c: [], h: [], l: [], v: [] };
  for (let w = 0; w < wegpunkte.length - 1; w++) {
    const [t0, k0] = wegpunkte[w];
    const [t1, k1] = wegpunkte[w + 1];
    for (let t = t0; t < t1 || (w === wegpunkte.length - 2 && t === t1); t++) {
      const c = k0 + ((k1 - k0) * (t - t0)) / (t1 - t0);
      reihe.d.push(20000 + Math.floor((t * 7) / 5));
      reihe.c.push(c);
      reihe.h.push(c * 1.005);
      reihe.l.push(c * 0.995);
      reihe.v.push(1000);
    }
  }
  return reihe;
}

const stark = verlauf([
  [0, 50], [60, 80], [80, 70], [140, 100], [160, 90], [200, 120], [215, 112], [240, 130],
]);
const schwach = verlauf([
  [0, 130], [60, 100], [80, 110], [140, 80], [160, 90], [200, 60], [215, 68], [240, 50],
]);
const index = verlauf([[0, 100], [120, 106], [240, 110]]);

const datei: IndexDatei = {
  id: 'test',
  name: 'Test-Index',
  aktualisiert: '2026-09-28T00:00:00Z',
  index,
  aktien: [
    { symbol: 'SCHW', name: 'Schwach AG', branche: 'Industrie', reihe: schwach },
    { symbol: 'STARK', name: 'Stark AG', branche: 'Technologie', reihe: stark },
    { symbol: 'KURZ', name: 'Neu AG', branche: 'Technologie', reihe: verlauf([[0, 10], [50, 12]]) },
  ],
};

describe('scanneIndex', () => {
  const { ergebnisse, zuWenigDaten } = scanneIndex(datei, null, STANDARD_EINSTELLUNGEN);

  it('lässt Aktien mit zu kurzer Historie aus', () => {
    expect(zuWenigDaten).toEqual(['Neu AG']);
    expect(ergebnisse).toHaveLength(2);
  });

  it('bewertet Aufwärtstrends als Long und Abwärtstrends als Short', () => {
    const starkeAktie = ergebnisse.find((e) => e.symbol === 'STARK')!;
    const schwacheAktie = ergebnisse.find((e) => e.symbol === 'SCHW')!;
    expect(starkeAktie.richtung).toBe('long');
    expect(starkeAktie.marktphaseBestaetigt).toBe(true);
    expect(starkeAktie.relativeStaerkeErfuellt).toBe(true);
    expect(starkeAktie.naeheAn52WochenExtrem).toBe(true);
    expect(schwacheAktie.richtung).toBe('short');
    expect(schwacheAktie.marktphaseBestaetigt).toBe(true);
    expect(schwacheAktie.relativeStaerkeErfuellt).toBe(true);
  });

  it('liefert Setup-Kriterien passend zum gewählten Setup', () => {
    const schwacheAktie = ergebnisse.find((e) => e.symbol === 'SCHW')!;
    expect(schwacheAktie.setupTyp).toBe('short-unter-p2');
    expect(Object.keys(schwacheAktie.setupKriterien)).toContain('aktie-phase6');
    expect(schwacheAktie.score.setupGesamt).toBe(5);
  });
});
