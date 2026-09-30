import { describe, expect, it } from 'vitest';
import {
  analysiereLiquiditaet,
  analysiereGap,
  beurteileNewsTrade,
  fuegeNewsScreeningEin,
  type GapAnalyse,
  istGueltigeGespeicherteSchlagzeile,
  istGueltigerNewsScreeningEintrag,
  LIQUIDITAET_TAGE,
  type LiquiditaetsAnalyse,
  NEWS_ARTEN,
  verschiebeDatum,
} from './newsScreening';
import { ValidationError } from './positionSize';
import type { Minutenkerze, Tageskerze } from './twelveDataClient';
import type { NewsScreeningEintrag } from './types';

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

  const LIQUIDE: LiquiditaetsAnalyse = { maxMinutenOhneVolumen: 0, laengsteLueckeStart: null, gepruefteTage: ['2026-09-24'] };

  it('ist handelbar, wenn alle Bedingungen erfüllt sind', () => {
    expect(beurteileNewsTrade(gap(8, 20), 'gewinnwarnung', LIQUIDE)).toEqual({ handelbar: true, gruende: [] });
  });

  it('ist bei genau 5 % Gap und genau 50 % Schließung noch handelbar', () => {
    expect(beurteileNewsTrade(gap(5, 50), 'quartalsbericht', LIQUIDE).handelbar).toBe(true);
  });

  it('lehnt ein zu kleines Gap ab', () => {
    expect(beurteileNewsTrade(gap(4.2, 10), 'quartalsbericht', LIQUIDE)).toEqual({
      handelbar: false,
      gruende: ['Gap zu klein (4.2 % < 5 %).'],
    });
  });

  it('lehnt ein zu mehr als 50 % geschlossenes Gap ab', () => {
    expect(beurteileNewsTrade(gap(8, 62.5), 'quartalsbericht', LIQUIDE)).toEqual({
      handelbar: false,
      gruende: ['Gap zu 62.5 % geschlossen (> 50 %) – kein Einstieg.'],
    });
  });

  it('lehnt ab, wenn keine News-Art ausgewählt ist', () => {
    expect(beurteileNewsTrade(gap(8, 20), null, LIQUIDE)).toEqual({
      handelbar: false,
      gruende: ['Keine News-Art ausgewählt.'],
    });
  });

  it('lehnt ab, wenn die News als nicht relevant eingestuft ist', () => {
    expect(beurteileNewsTrade(gap(8, 20), 'keine-relevante-news', LIQUIDE)).toEqual({
      handelbar: false,
      gruende: ['News als nicht handelsrelevant eingestuft.'],
    });
  });

  it('sammelt mehrere Gründe gleichzeitig', () => {
    expect(beurteileNewsTrade(gap(3, 80), null, LIQUIDE).gruende).toEqual([
      'Gap zu klein (3.0 % < 5 %).',
      'Gap zu 80.0 % geschlossen (> 50 %) – kein Einstieg.',
      'Keine News-Art ausgewählt.',
    ]);
  });

  it('lehnt ab, wenn die Liquidität nicht geprüft wurde', () => {
    expect(beurteileNewsTrade(gap(8, 20), 'gewinnwarnung', null)).toEqual({
      handelbar: false,
      gruende: ['Liquidität nicht geprüft.'],
    });
  });

  it('lehnt ab bei 4 Minuten ohne Volumen am Stück', () => {
    const illiquide: LiquiditaetsAnalyse = { ...LIQUIDE, maxMinutenOhneVolumen: 4, laengsteLueckeStart: '2026-09-24 10:12' };
    expect(beurteileNewsTrade(gap(8, 20), 'gewinnwarnung', illiquide)).toEqual({
      handelbar: false,
      gruende: ['Zu wenig Liquidität (4 Minuten ohne Volumen am Stück) – kein Einstieg.'],
    });
  });

  it('ist bei genau 3 Minuten ohne Volumen noch handelbar', () => {
    const grenzwert: LiquiditaetsAnalyse = { ...LIQUIDE, maxMinutenOhneVolumen: 3, laengsteLueckeStart: '2026-09-24 10:12' };
    expect(beurteileNewsTrade(gap(8, 20), 'gewinnwarnung', grenzwert).handelbar).toBe(true);
  });
});

function eintrag(id: string, symbol: string, gapDatum: string): NewsScreeningEintrag {
  return {
    id,
    symbol,
    gapDatum,
    gap: {
      richtung: 'long',
      vortagDatum: '2026-09-10',
      vortagSchluss: 100,
      gapTagOpen: 108,
      gapProzent: 8,
      gapSchliessungProzent: 37.5,
      extremSeitGap: 105,
    },
    newsArt: 'quartalsbericht',
    notiz: '',
    schlagzeilen: [],
    gespeichertAm: '2026-09-29T10:00:00.000Z',
    zuletztGeprueftAm: '2026-09-29T10:00:00.000Z',
  };
}

describe('fuegeNewsScreeningEin', () => {
  it('fügt in eine leere Liste ein', () => {
    expect(fuegeNewsScreeningEin([], eintrag('1', 'AAPL', '2026-09-11'))).toEqual([eintrag('1', 'AAPL', '2026-09-11')]);
  });

  it('stellt einen neuen Eintrag an den Anfang', () => {
    const liste = [eintrag('1', 'AAPL', '2026-09-11')];
    const ergebnis = fuegeNewsScreeningEin(liste, eintrag('2', 'MSFT', '2026-09-12'));
    expect(ergebnis.map((e) => e.id)).toEqual(['2', '1']);
  });

  it('ersetzt einen Eintrag mit gleichem Kürzel und Gap-Datum und stellt ihn nach vorne', () => {
    const liste = [eintrag('1', 'MSFT', '2026-09-12'), eintrag('2', 'AAPL', '2026-09-11')];
    const ergebnis = fuegeNewsScreeningEin(liste, eintrag('3', 'AAPL', '2026-09-11'));
    expect(ergebnis.map((e) => e.id)).toEqual(['3', '1']);
  });

  it('behält Einträge mit gleichem Kürzel, aber anderem Gap-Datum', () => {
    const liste = [eintrag('1', 'AAPL', '2026-09-11')];
    const ergebnis = fuegeNewsScreeningEin(liste, eintrag('2', 'AAPL', '2026-09-14'));
    expect(ergebnis.map((e) => e.id)).toEqual(['2', '1']);
  });

  it('behält beim Ersetzen die alte Notiz, wenn die neue Notiz leer ist', () => {
    const liste = [{ ...eintrag('1', 'AAPL', '2026-09-11'), notiz: 'alt' }];
    const ergebnis = fuegeNewsScreeningEin(liste, { ...eintrag('2', 'AAPL', '2026-09-11'), notiz: '' });
    expect(ergebnis[0].notiz).toBe('alt');
  });

  it('verwendet beim Ersetzen die neue Notiz, wenn sie nicht leer ist', () => {
    const liste = [{ ...eintrag('1', 'AAPL', '2026-09-11'), notiz: 'alt' }];
    const ergebnis = fuegeNewsScreeningEin(liste, { ...eintrag('2', 'AAPL', '2026-09-11'), notiz: 'neu' });
    expect(ergebnis[0].notiz).toBe('neu');
  });
});

describe('istGueltigerNewsScreeningEintrag', () => {
  it('akzeptiert einen vollständigen Eintrag', () => {
    expect(istGueltigerNewsScreeningEintrag(eintrag('1', 'AAPL', '2026-09-11'))).toBe(true);
  });

  it('lehnt null ab', () => {
    expect(istGueltigerNewsScreeningEintrag(null)).toBe(false);
  });

  it('lehnt einen Eintrag ohne Kürzel ab', () => {
    const { symbol: _symbol, ...ohneSymbol } = eintrag('1', 'AAPL', '2026-09-11');
    expect(istGueltigerNewsScreeningEintrag(ohneSymbol)).toBe(false);
  });

  it('lehnt eine unbekannte News-Art ab', () => {
    expect(istGueltigerNewsScreeningEintrag({ ...eintrag('1', 'AAPL', '2026-09-11'), newsArt: 'gerücht' })).toBe(false);
  });

  it('lehnt nicht-numerische Gap-Werte ab', () => {
    const basis = eintrag('1', 'AAPL', '2026-09-11');
    expect(istGueltigerNewsScreeningEintrag({ ...basis, gap: { ...basis.gap, gapProzent: Number.NaN } })).toBe(false);
    expect(istGueltigerNewsScreeningEintrag({ ...basis, gap: { ...basis.gap, gapProzent: '8' } })).toBe(false);
  });

  it('lehnt Schlagzeilen ab, die kein Array sind', () => {
    expect(istGueltigerNewsScreeningEintrag({ ...eintrag('1', 'AAPL', '2026-09-11'), schlagzeilen: 'x' })).toBe(false);
  });

  it('akzeptiert Einträge ohne, mit null und mit gültiger Liquidität', () => {
    const basis = eintrag('1', 'AAPL', '2026-09-11');
    expect(istGueltigerNewsScreeningEintrag(basis)).toBe(true);
    expect(istGueltigerNewsScreeningEintrag({ ...basis, liquiditaet: null })).toBe(true);
    expect(
      istGueltigerNewsScreeningEintrag({
        ...basis,
        liquiditaet: { maxMinutenOhneVolumen: 2, laengsteLueckeStart: '2026-09-24 10:00', gepruefteTage: ['2026-09-24'] },
      }),
    ).toBe(true);
  });

  it('lehnt eine ungültige Liquidität ab', () => {
    const basis = eintrag('1', 'AAPL', '2026-09-11');
    expect(
      istGueltigerNewsScreeningEintrag({
        ...basis,
        liquiditaet: { maxMinutenOhneVolumen: '2', laengsteLueckeStart: null, gepruefteTage: [] },
      }),
    ).toBe(false);
  });

  it('lehnt negative Minuten ohne Volumen ab', () => {
    const basis = eintrag('1', 'AAPL', '2026-09-11');
    expect(
      istGueltigerNewsScreeningEintrag({
        ...basis,
        liquiditaet: { maxMinutenOhneVolumen: -1, laengsteLueckeStart: null, gepruefteTage: [] },
      }),
    ).toBe(false);
  });

  it('lehnt geprüfte Tage ab, die keine Strings sind', () => {
    const basis = eintrag('1', 'AAPL', '2026-09-11');
    expect(
      istGueltigerNewsScreeningEintrag({
        ...basis,
        liquiditaet: { maxMinutenOhneVolumen: 1, laengsteLueckeStart: null, gepruefteTage: [1] },
      }),
    ).toBe(false);
  });
});

describe('istGueltigeGespeicherteSchlagzeile', () => {
  const gueltigeSchlagzeile = {
    zeitpunkt: '2026-09-11T12:00:00.000Z',
    titel: 'Titel',
    quelle: 'Reuters',
    url: 'https://example.com',
  };

  it('akzeptiert eine vollständige Schlagzeile', () => {
    expect(istGueltigeGespeicherteSchlagzeile(gueltigeSchlagzeile)).toBe(true);
  });

  it('lehnt null ab', () => {
    expect(istGueltigeGespeicherteSchlagzeile(null)).toBe(false);
  });

  it('lehnt eine Schlagzeile ohne url ab', () => {
    const { url: _url, ...ohneUrl } = gueltigeSchlagzeile;
    expect(istGueltigeGespeicherteSchlagzeile(ohneUrl)).toBe(false);
  });

  it('lehnt einen numerischen Titel ab', () => {
    expect(istGueltigeGespeicherteSchlagzeile({ ...gueltigeSchlagzeile, titel: 1 })).toBe(false);
  });
});

function hhmm(minutenSeitMitternacht: number): string {
  return `${String(Math.floor(minutenSeitMitternacht / 60)).padStart(2, '0')}:${String(minutenSeitMitternacht % 60).padStart(2, '0')}`;
}

// Erzeugt Minutenkerzen von `von` bis `bis` (inklusive) mit Volumen 100.
// `sonder`: Minute → 0 (Volumen 0) oder 'fehlt' (Kerze wird weggelassen).
function handelstag(datum: string, von: string, bis: string, sonder: Record<string, 0 | 'fehlt'> = {}): Minutenkerze[] {
  const [vh, vm] = von.split(':').map(Number);
  const [bh, bm] = bis.split(':').map(Number);
  const kerzen: Minutenkerze[] = [];
  for (let m = vh * 60 + vm; m <= bh * 60 + bm; m++) {
    const zeit = hhmm(m);
    if (sonder[zeit] === 'fehlt') continue;
    kerzen.push({ zeitpunkt: `${datum} ${zeit}:00`, volumen: sonder[zeit] === 0 ? 0 : 100 });
  }
  return kerzen;
}

describe('analysiereLiquiditaet', () => {
  it('lehnt Zeitstempel ohne Uhrzeit ab', () => {
    expect(() => analysiereLiquiditaet([{ zeitpunkt: '2026-09-24', volumen: 100 }])).toThrow(ValidationError);
  });

  it('meldet 0 Minuten bei durchgehendem Handel', () => {
    expect(analysiereLiquiditaet(handelstag('2026-09-24', '09:30', '09:40'))).toEqual({
      maxMinutenOhneVolumen: 0,
      laengsteLueckeStart: null,
      gepruefteTage: ['2026-09-24'],
    });
  });

  it('zählt Minuten mit Volumen 0', () => {
    const kerzen = handelstag('2026-09-24', '09:30', '09:40', { '09:33': 0, '09:34': 0, '09:35': 0 });
    const ergebnis = analysiereLiquiditaet(kerzen);
    expect(ergebnis.maxMinutenOhneVolumen).toBe(3);
    expect(ergebnis.laengsteLueckeStart).toBe('2026-09-24 09:33');
  });

  it('zählt fehlende Minuten innerhalb der Handelszeit', () => {
    const kerzen = handelstag('2026-09-24', '09:30', '09:40', {
      '09:35': 'fehlt',
      '09:36': 'fehlt',
      '09:37': 'fehlt',
      '09:38': 'fehlt',
    });
    const ergebnis = analysiereLiquiditaet(kerzen);
    expect(ergebnis.maxMinutenOhneVolumen).toBe(4);
    expect(ergebnis.laengsteLueckeStart).toBe('2026-09-24 09:35');
  });

  it('zählt eine Lücke direkt nach der Eröffnung um 09:30', () => {
    const ergebnis = analysiereLiquiditaet(handelstag('2026-09-24', '09:34', '09:40'));
    expect(ergebnis.maxMinutenOhneVolumen).toBe(4);
    expect(ergebnis.laengsteLueckeStart).toBe('2026-09-24 09:30');
  });

  it('ignoriert die Zeit nach der letzten gelieferten Minute eines Tages', () => {
    expect(analysiereLiquiditaet(handelstag('2026-09-24', '09:30', '10:00')).maxMinutenOhneVolumen).toBe(0);
  });

  it('prüft nur die letzten 5 Handelstage', () => {
    const tage = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-28'];
    const kerzen = [
      ...handelstag(tage[0], '09:30', '09:40', { '09:31': 'fehlt', '09:32': 'fehlt', '09:33': 'fehlt', '09:34': 'fehlt', '09:35': 'fehlt' }),
      ...tage.slice(1).flatMap((datum) => handelstag(datum, '09:30', '09:40')),
    ];
    const ergebnis = analysiereLiquiditaet(kerzen);
    expect(ergebnis.gepruefteTage).toEqual(tage.slice(1));
    expect(ergebnis.gepruefteTage).toHaveLength(LIQUIDITAET_TAGE);
    expect(ergebnis.maxMinutenOhneVolumen).toBe(0);
  });

  it('verkettet volumenlose Minuten nicht über Tagesgrenzen', () => {
    const kerzen = [
      ...handelstag('2026-09-24', '09:30', '09:40', { '09:39': 0, '09:40': 0 }),
      ...handelstag('2026-09-25', '09:30', '09:40', { '09:30': 0, '09:31': 0 }),
    ];
    expect(analysiereLiquiditaet(kerzen).maxMinutenOhneVolumen).toBe(2);
  });

  it('nimmt bei gleich langen Lücken die früheste', () => {
    const kerzen = handelstag('2026-09-24', '09:30', '09:50', { '09:32': 0, '09:33': 0, '09:42': 0, '09:43': 0 });
    expect(analysiereLiquiditaet(kerzen).laengsteLueckeStart).toBe('2026-09-24 09:32');
  });

  it('wirft ValidationError ohne Kerzen', () => {
    expect(() => analysiereLiquiditaet([])).toThrow(ValidationError);
  });
});
