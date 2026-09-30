import { ValidationError } from './positionSize';
import type { Minutenkerze, Tageskerze } from './twelveDataClient';
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

export function beurteileNewsTrade(
  gap: GapAnalyse,
  newsArt: NewsArt | null,
  liquiditaet: LiquiditaetsAnalyse | null,
): NewsUrteil {
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
  if (liquiditaet === null) {
    gruende.push('Liquidität nicht geprüft.');
  } else if (liquiditaet.maxMinutenOhneVolumen > MAX_MINUTEN_OHNE_VOLUMEN) {
    gruende.push(
      `Zu wenig Liquidität (${liquiditaet.maxMinutenOhneVolumen} Minuten ohne Volumen am Stück) – kein Einstieg.`,
    );
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

function istGueltigeLiquiditaetsAnalyse(wert: unknown): wert is LiquiditaetsAnalyse {
  if (typeof wert !== 'object' || wert === null) return false;
  const l = wert as Record<string, unknown>;
  return (
    istEndlicheZahl(l.maxMinutenOhneVolumen) &&
    l.maxMinutenOhneVolumen >= 0 &&
    (l.laengsteLueckeStart === null || typeof l.laengsteLueckeStart === 'string') &&
    Array.isArray(l.gepruefteTage) &&
    l.gepruefteTage.every((tag) => typeof tag === 'string')
  );
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
    Array.isArray(e.schlagzeilen) &&
    (e.liquiditaet === undefined || e.liquiditaet === null || istGueltigeLiquiditaetsAnalyse(e.liquiditaet))
  );
}

export const MAX_MINUTEN_OHNE_VOLUMEN = 3;
export const LIQUIDITAET_TAGE = 5;
const HANDELSBEGINN_MINUTE = 9 * 60 + 30; // 09:30 Börsenzeit

export interface LiquiditaetsAnalyse {
  maxMinutenOhneVolumen: number;
  laengsteLueckeStart: string | null; // 'YYYY-MM-DD HH:MM' der ersten Minute der längsten Folge
  gepruefteTage: string[]; // 'YYYY-MM-DD', aufsteigend
}

function minuteDesTages(zeitpunkt: string): number {
  const [h, m] = zeitpunkt.slice(11, 16).split(':').map(Number);
  return h * 60 + m;
}

function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function analysiereLiquiditaet(kerzen: Minutenkerze[]): LiquiditaetsAnalyse {
  if (kerzen.length === 0) {
    throw new ValidationError('Keine Minutenkerzen für die Liquiditätsprüfung vorhanden.');
  }

  const proTag = new Map<string, { gehandelt: Set<number>; letzteMinute: number }>();
  for (const kerze of kerzen) {
    const datum = kerze.zeitpunkt.slice(0, 10);
    const minute = minuteDesTages(kerze.zeitpunkt);
    if (!Number.isFinite(minute)) {
      throw new ValidationError(`Ungültiger Zeitstempel in den Minutenkerzen: ${kerze.zeitpunkt}.`);
    }
    const tag = proTag.get(datum) ?? { gehandelt: new Set<number>(), letzteMinute: minute };
    if (kerze.volumen > 0) tag.gehandelt.add(minute);
    tag.letzteMinute = Math.max(tag.letzteMinute, minute);
    proTag.set(datum, tag);
  }

  const gepruefteTage = [...proTag.keys()].sort().slice(-LIQUIDITAET_TAGE);
  let maxMinutenOhneVolumen = 0;
  let laengsteLueckeStart: string | null = null;

  for (const datum of gepruefteTage) {
    const { gehandelt, letzteMinute } = proTag.get(datum)!;
    let lauf = 0;
    let laufStart = HANDELSBEGINN_MINUTE;
    for (let minute = HANDELSBEGINN_MINUTE; minute <= letzteMinute; minute++) {
      if (gehandelt.has(minute)) {
        lauf = 0;
        continue;
      }
      if (lauf === 0) laufStart = minute;
      lauf++;
      if (lauf > maxMinutenOhneVolumen) {
        maxMinutenOhneVolumen = lauf;
        laengsteLueckeStart = `${datum} ${formatMinute(laufStart)}`;
      }
    }
  }

  return { maxMinutenOhneVolumen, laengsteLueckeStart, gepruefteTage };
}
