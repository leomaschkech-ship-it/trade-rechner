import { describe, expect, it } from 'vitest';
import type { Kursreihe } from './daten';
import {
  STANDARD_EINSTELLUNGEN,
  letzteKorrektur,
  marktphase,
  naeheAn52WochenExtrem,
  performance,
  relativeStaerke,
  retestQualitaet,
  swingPunkte,
  volumenWarnsignal,
  wachsendeKorrekturen,
} from './regeln';

/** Kursverlauf aus Wegpunkten [Tag, Kurs], linear verbunden; Hoch/Tief ±0,5 %. */
function verlauf(wegpunkte: [number, number][], volumen: (i: number) => number = () => 1000): Kursreihe {
  const reihe: Kursreihe = { d: [], c: [], h: [], l: [], v: [] };
  for (let w = 0; w < wegpunkte.length - 1; w++) {
    const [t0, k0] = wegpunkte[w];
    const [t1, k1] = wegpunkte[w + 1];
    for (let t = t0; t < t1 || (w === wegpunkte.length - 2 && t === t1); t++) {
      const c = k0 + ((k1 - k0) * (t - t0)) / (t1 - t0);
      reihe.d.push(20000 + Math.floor((t * 7) / 5)); // grob Handelstage auf Kalendertage
      reihe.c.push(c);
      reihe.h.push(c * 1.005);
      reihe.l.push(c * 0.995);
      reihe.v.push(volumen(t));
    }
  }
  return reihe;
}

// Aufwärtstrend mit steigenden Hochs/Tiefs, zuletzt Ausbruch über das Hoch bei 130
const AUFWAERTS: [number, number][] = [
  [0, 100], [20, 120], [35, 110], [55, 130], [70, 120], [100, 125], [110, 140],
];
const ABWAERTS: [number, number][] = AUFWAERTS.map(([t, k]) => [t, 240 - k]);

const k = STANDARD_EINSTELLUNGEN.swingKerzen;

describe('swingPunkte', () => {
  it('findet abwechselnde Hochs und Tiefs', () => {
    const punkte = swingPunkte(verlauf(AUFWAERTS), k);
    expect(punkte.map((p) => p.typ)).toEqual(['hoch', 'tief', 'hoch', 'tief']);
    expect(punkte.map((p) => p.i)).toEqual([20, 35, 55, 70]);
  });
});

describe('marktphase', () => {
  it('erkennt Phase 3 nach Ausbruch über P2 im Aufwärtstrend', () => {
    const phase = marktphase(verlauf(AUFWAERTS), k);
    expect(phase.trend).toBe('auf');
    expect(phase.phase).toBe(3);
    expect(phase.p2).toBeCloseTo(130 * 1.005);
  });

  it('meldet Aufwärtstrend ohne Phase 3 während der Korrektur', () => {
    const phase = marktphase(verlauf(AUFWAERTS.slice(0, 6)), k);
    expect(phase.trend).toBe('auf');
    expect(phase.phase).toBeNull();
  });

  it('erkennt Phase 6 im Abwärtstrend', () => {
    const phase = marktphase(verlauf(ABWAERTS), k);
    expect(phase.trend).toBe('ab');
    expect(phase.phase).toBe(6);
  });

  it('meldet seitwärts bei gleichen Hochs', () => {
    const phase = marktphase(verlauf([[0, 100], [20, 120], [40, 100], [60, 120], [80, 100], [90, 110]]), k);
    expect(phase.trend).toBe('seitwaerts');
  });
});

describe('performance und relative Stärke', () => {
  const reihe = verlauf([[0, 100], [200, 200]]);
  it('berechnet die Veränderung über Kalendertage', () => {
    expect(performance(reihe, 7)).toBeCloseTo(200 / reihe.c[reihe.c.length - 6] - 1, 2);
    expect(performance(reihe, 10_000)).toBeNull();
  });

  it('vergleicht Aktie und Index über 3 und 6 Monate', () => {
    const index = verlauf([[0, 100], [200, 120]]);
    expect(relativeStaerke(reihe, index, 'long')).toBe(true);
    expect(relativeStaerke(reihe, index, 'short')).toBe(false);
    expect(relativeStaerke(index, reihe, 'short')).toBe(true);
  });
});

describe('naeheAn52WochenExtrem', () => {
  it('prüft den Abstand zum Hoch bzw. Tief', () => {
    const reihe = verlauf([[0, 100], [100, 200], [120, 185]]);
    expect(naeheAn52WochenExtrem(reihe, 'long', 10)).toBe(true);
    expect(naeheAn52WochenExtrem(reihe, 'long', 5)).toBe(false);
    expect(naeheAn52WochenExtrem(reihe, 'short', 10)).toBe(false);
  });
});

describe('volumenWarnsignal', () => {
  const basis: [number, number][] = [[0, 100], [80, 100]];
  it('schlägt an bei zwei Abwärtstagen mit hohem Volumen', () => {
    const reihe = verlauf(basis);
    reihe.c[75] = 98;
    reihe.v[75] = 5000;
    reihe.c[78] = 97;
    reihe.v[78] = 5000;
    expect(volumenWarnsignal(reihe, 'long', 1.5)).toBe(true);
    expect(volumenWarnsignal(reihe, 'short', 1.5)).toBe(false);
  });

  it('bleibt ruhig bei normalem Volumen', () => {
    expect(volumenWarnsignal(verlauf(basis), 'long', 1.5)).toBe(false);
  });
});

describe('wachsendeKorrekturen', () => {
  it('erkennt drei immer tiefere Korrekturen', () => {
    const reihe = verlauf([
      [0, 100], [15, 120], [25, 116], [40, 130], [50, 120], [65, 140], [75, 120], [90, 150], [100, 148],
    ]);
    expect(wachsendeKorrekturen(reihe, 'long', k)).toBe(true);
  });

  it('bleibt aus bei gleich tiefen Korrekturen', () => {
    expect(wachsendeKorrekturen(verlauf(AUFWAERTS), 'long', k)).toBe(false);
  });
});

describe('letzteKorrektur', () => {
  it('misst die Korrektur vom letzten Hoch zum Tief danach', () => {
    const korrektur = letzteKorrektur(verlauf(AUFWAERTS), 'long', k);
    expect(korrektur).not.toBeNull();
    expect(korrektur!.korrekturKerzen).toBe(15);
    expect(korrektur!.bewegungsKerzen).toBe(20);
    expect(korrektur!.retracement).toBeCloseTo(0.5, 1);
  });
});

describe('retestQualitaet', () => {
  const einst = STANDARD_EINSTELLUNGEN;
  // Ausbruch über 130 bei Tag ~105, Anstieg auf 140, Rücksetzer auf ~131
  const mitRetest = (volumen: (i: number) => number) =>
    verlauf([...AUFWAERTS.slice(0, 6), [110, 140], [118, 131.5], [122, 134]], volumen);

  it('ist gesund bei Rücksetzer ans Ausbruchsniveau mit sinkendem Volumen', () => {
    expect(retestQualitaet(mitRetest((i) => (i > 110 ? 500 : 1000)), 'long', einst)).toBe('gesund');
  });

  it('ist unklar, wenn das Volumen im Rücksetzer steigt', () => {
    expect(retestQualitaet(mitRetest((i) => (i > 110 ? 2000 : 1000)), 'long', einst)).toBe('unklar');
  });

  it('ist schwach, wenn der Kurs unter das Ausbruchsniveau fällt', () => {
    const reihe = verlauf([...AUFWAERTS.slice(0, 6), [110, 140], [120, 122], [122, 124]]);
    expect(retestQualitaet(reihe, 'long', einst)).toBe('schwach');
  });

  it('ist unklar ohne Retest', () => {
    expect(retestQualitaet(verlauf(AUFWAERTS), 'long', einst)).toBe('unklar');
  });
});
