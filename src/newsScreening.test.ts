import { describe, expect, it } from 'vitest';
import { analysiereGap, beurteileNewsTrade, type GapAnalyse, NEWS_ARTEN, verschiebeDatum } from './newsScreening';
import { ValidationError } from './positionSize';
import type { Tageskerze } from './twelveDataClient';

function kerze(datum: string, open: number, high: number, low: number, close: number): Tageskerze {
  return { datum, open, high, low, close };
}

describe('verschiebeDatum', () => {
  it('zieht Tage innerhalb eines Monats ab', () => {
    expect(verschiebeDatum('2026-09-11', -10)).toBe('2026-09-01');
  });

  it('geht über Monatsgrenzen hinweg', () => {
    expect(verschiebeDatum('2026-03-05', -10)).toBe('2026-02-23');
  });
});

describe('analysiereGap', () => {
  it('erkennt ein Gap-Up als Long und berechnet Gap und teilweise Schließung', () => {
    const kerzen = [
      kerze('2026-09-10', 100, 101, 99, 100),
      kerze('2026-09-11', 108, 110, 106, 109),
      kerze('2026-09-14', 109, 111, 105, 110),
    ];
    const gap = analysiereGap(kerzen, '2026-09-11');
    expect(gap.richtung).toBe('long');
    expect(gap.vortagDatum).toBe('2026-09-10');
    expect(gap.vortagSchluss).toBe(100);
    expect(gap.gapTagOpen).toBe(108);
    expect(gap.gapProzent).toBeCloseTo(8, 5);
    expect(gap.extremSeitGap).toBe(105);
    expect(gap.gapSchliessungProzent).toBeCloseTo(37.5, 5);
  });

  it('erkennt ein Gap-Down als Short und berechnet die Schließung über das höchste Hoch', () => {
    const kerzen = [
      kerze('2026-09-10', 101, 102, 99, 100),
      kerze('2026-09-11', 90, 93, 88, 91),
      kerze('2026-09-14', 91, 95, 90, 94),
    ];
    const gap = analysiereGap(kerzen, '2026-09-11');
    expect(gap.richtung).toBe('short');
    expect(gap.gapProzent).toBeCloseTo(10, 5);
    expect(gap.extremSeitGap).toBe(95);
    expect(gap.gapSchliessungProzent).toBeCloseTo(50, 5);
  });

  it('meldet 0 % Schließung, wenn der Kurs nie unter die Eröffnung gefallen ist', () => {
    const kerzen = [kerze('2026-09-10', 100, 101, 99, 100), kerze('2026-09-11', 108, 112, 108, 111)];
    expect(analysiereGap(kerzen, '2026-09-11').gapSchliessungProzent).toBe(0);
  });

  it('begrenzt die Schließung auf 100 %, wenn der Kurs unter den Vortagesschluss gefallen ist', () => {
    const kerzen = [
      kerze('2026-09-10', 100, 101, 99, 100),
      kerze('2026-09-11', 108, 109, 104, 105),
      kerze('2026-09-14', 105, 106, 95, 96),
    ];
    expect(analysiereGap(kerzen, '2026-09-11').gapSchliessungProzent).toBe(100);
  });

  it('nimmt als Vortag den letzten Handelstag vor einem Wochenende', () => {
    const kerzen = [kerze('2026-09-11', 99, 101, 98, 100), kerze('2026-09-14', 106, 107, 105, 106)];
    const gap = analysiereGap(kerzen, '2026-09-14');
    expect(gap.vortagDatum).toBe('2026-09-11');
    expect(gap.gapProzent).toBeCloseTo(6, 5);
  });

  it('wirft ValidationError, wenn es am Gap-Datum keinen Handelstag gibt', () => {
    const kerzen = [kerze('2026-09-11', 99, 101, 98, 100), kerze('2026-09-14', 106, 107, 105, 106)];
    expect(() => analysiereGap(kerzen, '2026-09-12')).toThrow(ValidationError);
  });

  it('meldet fehlende Kursdaten statt „kein Handelstag", wenn das Gap-Datum nach der letzten Kerze liegt', () => {
    const kerzen = [kerze('2026-09-11', 99, 101, 98, 100), kerze('2026-09-14', 106, 107, 105, 106)];
    expect(() => analysiereGap(kerzen, '2026-09-15')).toThrow(ValidationError);
    expect(() => analysiereGap(kerzen, '2026-09-15')).toThrow('Für den 2026-09-15 liegen noch keine Kursdaten vor');
  });

  it('wirft ValidationError, wenn keine Vortageskerze vorhanden ist', () => {
    const kerzen = [kerze('2026-09-11', 106, 107, 105, 106)];
    expect(() => analysiereGap(kerzen, '2026-09-11')).toThrow(ValidationError);
  });

  it('wirft ValidationError, wenn die Eröffnung genau dem Vortagesschluss entspricht', () => {
    const kerzen = [kerze('2026-09-10', 99, 101, 98, 100), kerze('2026-09-11', 100, 102, 99, 101)];
    expect(() => analysiereGap(kerzen, '2026-09-11')).toThrow(ValidationError);
  });
});

describe('NEWS_ARTEN', () => {
  it('enthält alle 13 Arten und „Keine relevante News" als letzten Eintrag', () => {
    expect(NEWS_ARTEN).toHaveLength(13);
    expect(NEWS_ARTEN[NEWS_ARTEN.length - 1]).toEqual({ id: 'keine-relevante-news', label: 'Keine relevante News' });
  });
});

describe('beurteileNewsTrade', () => {
  function gap(gapProzent: number, gapSchliessungProzent: number): GapAnalyse {
    return {
      richtung: 'long',
      vortagDatum: '2026-09-10',
      vortagSchluss: 100,
      gapTagOpen: 100 + gapProzent,
      gapProzent,
      gapSchliessungProzent,
      extremSeitGap: 100,
    };
  }

  it('ist handelbar, wenn alle Bedingungen erfüllt sind', () => {
    expect(beurteileNewsTrade(gap(8, 20), 'gewinnwarnung')).toEqual({ handelbar: true, gruende: [] });
  });

  it('ist bei genau 5 % Gap und genau 50 % Schließung noch handelbar', () => {
    expect(beurteileNewsTrade(gap(5, 50), 'quartalsbericht').handelbar).toBe(true);
  });

  it('lehnt ein zu kleines Gap ab', () => {
    expect(beurteileNewsTrade(gap(4.2, 10), 'quartalsbericht')).toEqual({
      handelbar: false,
      gruende: ['Gap zu klein (4.2 % < 5 %).'],
    });
  });

  it('lehnt ein zu mehr als 50 % geschlossenes Gap ab', () => {
    expect(beurteileNewsTrade(gap(8, 62.5), 'quartalsbericht')).toEqual({
      handelbar: false,
      gruende: ['Gap zu 62.5 % geschlossen (> 50 %) – kein Einstieg.'],
    });
  });

  it('lehnt ab, wenn keine News-Art ausgewählt ist', () => {
    expect(beurteileNewsTrade(gap(8, 20), null)).toEqual({
      handelbar: false,
      gruende: ['Keine News-Art ausgewählt.'],
    });
  });

  it('lehnt ab, wenn die News als nicht relevant eingestuft ist', () => {
    expect(beurteileNewsTrade(gap(8, 20), 'keine-relevante-news')).toEqual({
      handelbar: false,
      gruende: ['News als nicht handelsrelevant eingestuft.'],
    });
  });

  it('sammelt mehrere Gründe gleichzeitig', () => {
    expect(beurteileNewsTrade(gap(3, 80), null).gruende).toEqual([
      'Gap zu klein (3.0 % < 5 %).',
      'Gap zu 80.0 % geschlossen (> 50 %) – kein Einstieg.',
      'Keine News-Art ausgewählt.',
    ]);
  });
});
