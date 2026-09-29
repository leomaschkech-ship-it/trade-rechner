import { ValidationError } from './positionSize';
import type { Tageskerze } from './twelveDataClient';
import type { GespeicherteSchlagzeile, NewsScreeningEintrag, Richtung } from './types';

export const MIN_GAP_PROZENT = 5;
export const MAX_GAP_SCHLIESSUNG_PROZENT = 50;

export function verschiebeDatum(datum: string, tage: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

export interface GapAnalyse {
  richtung: Richtung; // Gap-Up → 'long', Gap-Down → 'short'
  vortagDatum: string;
  vortagSchluss: number;
  gapTagOpen: number;
  gapProzent: number; // Betrag, z.B. 7.3
  gapSchliessungProzent: number; // 0 = gar nicht ins Gap gelaufen, 100 = komplett geschlossen
  extremSeitGap: number; // tiefstes Tief (long) bzw. höchstes Hoch (short) ab Gap-Tag inkl.
}

export function analysiereGap(kerzen: Tageskerze[], gapDatum: string): GapAnalyse {
  const index = kerzen.findIndex((k) => k.datum === gapDatum);
  if (index === -1) {
    const letzteKerze = kerzen[kerzen.length - 1];
    if (letzteKerze && gapDatum > letzteKerze.datum) {
      throw new ValidationError(`Für den ${gapDatum} liegen noch keine Kursdaten vor (Markt noch nicht eröffnet?).`);
    }
    throw new ValidationError(`Am ${gapDatum} gibt es keinen Handelstag.`);
  }
  if (index === 0) {
    throw new ValidationError(`Für den Handelstag vor dem ${gapDatum} liegen keine Kursdaten vor.`);
  }

  const vortag = kerzen[index - 1];
  const gapTag = kerzen[index];
  const vortagSchluss = vortag.close;
  const gapTagOpen = gapTag.open;

  if (gapTagOpen === vortagSchluss) {
    throw new ValidationError(`Am ${gapDatum} gab es kein Gap.`);
  }

  const richtung: Richtung = gapTagOpen > vortagSchluss ? 'long' : 'short';
  const gapProzent = (Math.abs(gapTagOpen - vortagSchluss) / vortagSchluss) * 100;
  const abGapTag = kerzen.slice(index);

  let extremSeitGap: number;
  let schliessungRoh: number;
  if (richtung === 'long') {
    extremSeitGap = Math.min(...abGapTag.map((k) => k.low));
    schliessungRoh = ((gapTagOpen - extremSeitGap) / (gapTagOpen - vortagSchluss)) * 100;
  } else {
    extremSeitGap = Math.max(...abGapTag.map((k) => k.high));
    schliessungRoh = ((extremSeitGap - gapTagOpen) / (vortagSchluss - gapTagOpen)) * 100;
  }
  const gapSchliessungProzent = Math.min(100, Math.max(0, schliessungRoh));

  return {
    richtung,
    vortagDatum: vortag.datum,
    vortagSchluss,
    gapTagOpen,
    gapProzent,
    gapSchliessungProzent,
    extremSeitGap,
  };
}

export type NewsArt =
  | 'arbeitsmarktdaten'
  | 'inflationsdaten'
  | 'unternehmenszahlen'
  | 'quartalsbericht'
  | 'gewinnwarnung'
  | 'prognoseanpassung'
  | 'uebernahmeangebot'
  | 'kapitalerhoehung'
  | 'geschaeftsfuehrungswechsel'
  | 'produktvorstellung'
  | 'dividendenaenderung'
  | 'politische-einflussnahme'
  | 'keine-relevante-news';

// Labels wie auf der Kurs-Folie „Welche News sind beispielsweise relevant?"
export const NEWS_ARTEN: { id: NewsArt; label: string }[] = [
  { id: 'arbeitsmarktdaten', label: 'Arbeitsmarktdaten' },
  { id: 'inflationsdaten', label: 'Inflationsdaten' },
  { id: 'unternehmenszahlen', label: 'Unternehmenszahlen' },
  { id: 'quartalsbericht', label: 'Quartalsbericht' },
  { id: 'gewinnwarnung', label: 'Gewinnwarnung' },
  { id: 'prognoseanpassung', label: 'Signifikante Anpassung von Prognosen für Gewinn/Umsatz' },
  { id: 'uebernahmeangebot', label: 'Übernahmeangebote' },
  { id: 'kapitalerhoehung', label: 'Kapitalerhöhungen' },
  { id: 'geschaeftsfuehrungswechsel', label: 'Wechsel in der Geschäftsführung (CEO, CFO)' },
  { id: 'produktvorstellung', label: 'Neue Produktvorstellung' },
  { id: 'dividendenaenderung', label: 'Starke Erhöhung/Kürzung der Dividenden' },
  { id: 'politische-einflussnahme', label: 'Politische Einflussnahme auf bestehende Geschäftsmodelle' },
  { id: 'keine-relevante-news', label: 'Keine relevante News' },
];

export interface NewsUrteil {
  handelbar: boolean;
  gruende: string[]; // leer bei handelbar
}

export function beurteileNewsTrade(gap: GapAnalyse, newsArt: NewsArt | null): NewsUrteil {
  const gruende: string[] = [];

  if (gap.gapProzent < MIN_GAP_PROZENT) {
    gruende.push(`Gap zu klein (${gap.gapProzent.toFixed(1)} % < ${MIN_GAP_PROZENT} %).`);
  }
  if (gap.gapSchliessungProzent > MAX_GAP_SCHLIESSUNG_PROZENT) {
    gruende.push(
      `Gap zu ${gap.gapSchliessungProzent.toFixed(1)} % geschlossen (> ${MAX_GAP_SCHLIESSUNG_PROZENT} %) – kein Einstieg.`,
    );
  }
  if (newsArt === null) {
    gruende.push('Keine News-Art ausgewählt.');
  } else if (newsArt === 'keine-relevante-news') {
    gruende.push('News als nicht handelsrelevant eingestuft.');
  }

  return { handelbar: gruende.length === 0, gruende };
}

export function fuegeNewsScreeningEin(
  liste: NewsScreeningEintrag[],
  eintrag: NewsScreeningEintrag,
): NewsScreeningEintrag[] {
  const bestehenderEintrag = liste.find((e) => e.symbol === eintrag.symbol && e.gapDatum === eintrag.gapDatum);
  const ohneDuplikat = liste.filter((e) => !(e.symbol === eintrag.symbol && e.gapDatum === eintrag.gapDatum));
  const neuerEintrag =
    bestehenderEintrag && eintrag.notiz === '' ? { ...eintrag, notiz: bestehenderEintrag.notiz } : eintrag;
  return [neuerEintrag, ...ohneDuplikat];
}

function istEndlicheZahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert);
}

function istGueltigeGapAnalyse(wert: unknown): wert is GapAnalyse {
  if (typeof wert !== 'object' || wert === null) return false;
  const gap = wert as Record<string, unknown>;
  return (
    (gap.richtung === 'long' || gap.richtung === 'short') &&
    typeof gap.vortagDatum === 'string' &&
    istEndlicheZahl(gap.vortagSchluss) &&
    istEndlicheZahl(gap.gapTagOpen) &&
    istEndlicheZahl(gap.gapProzent) &&
    istEndlicheZahl(gap.gapSchliessungProzent) &&
    istEndlicheZahl(gap.extremSeitGap)
  );
}

export function istGueltigeGespeicherteSchlagzeile(wert: unknown): wert is GespeicherteSchlagzeile {
  if (typeof wert !== 'object' || wert === null) return false;
  const s = wert as Record<string, unknown>;
  return (
    typeof s.zeitpunkt === 'string' &&
    typeof s.titel === 'string' &&
    typeof s.quelle === 'string' &&
    typeof s.url === 'string'
  );
}

export function istGueltigerNewsScreeningEintrag(wert: unknown): wert is NewsScreeningEintrag {
  if (typeof wert !== 'object' || wert === null) return false;
  const e = wert as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.symbol === 'string' &&
    typeof e.gapDatum === 'string' &&
    typeof e.notiz === 'string' &&
    typeof e.gespeichertAm === 'string' &&
    typeof e.zuletztGeprueftAm === 'string' &&
    NEWS_ARTEN.some((art) => art.id === e.newsArt) &&
    istGueltigeGapAnalyse(e.gap) &&
    Array.isArray(e.schlagzeilen)
  );
}
