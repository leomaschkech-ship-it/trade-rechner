import type { Kursreihe } from './daten';
import type { RetestQualitaet, Richtung } from '../types';

// Berechnet die Watchlist-Kriterien aus Tageskursen. Alle Funktionen beziehen sich
// auf den letzten Tag der Reihe. "Long" ist der Normalfall, "Short" wird gespiegelt.

export interface ScannerEinstellungen {
  swingKerzen: number; // Kerzen links/rechts, die ein Swing-Hoch/-Tief nicht übertreffen dürfen
  naehe52WochenProzent: number;
  volumenFaktor: number;
  retestToleranzProzent: number;
}

export const STANDARD_EINSTELLUNGEN: ScannerEinstellungen = {
  swingKerzen: 5,
  naehe52WochenProzent: 10,
  volumenFaktor: 1.5,
  retestToleranzProzent: 2,
};

export interface SwingPunkt {
  i: number;
  kurs: number;
  typ: 'hoch' | 'tief';
}

export const HANDELSTAGE_52_WOCHEN = 252;

/**
 * Swing-Hochs und -Tiefs, abwechselnd (Zickzack). Ein Swing-Hoch liegt vor, wenn das
 * Tageshoch von den k Kerzen davor übertroffen und von den k Kerzen danach nicht
 * überschritten wird. Zwei gleiche Punkte in Folge werden zum extremeren zusammengefasst.
 */
export function swingPunkte(reihe: Kursreihe, kerzen: number): SwingPunkt[] {
  const k = Math.max(1, Math.round(kerzen));
  const n = reihe.c.length;
  const roh: SwingPunkt[] = [];
  for (let i = k; i < n - k; i++) {
    let istHoch = true;
    let istTief = true;
    for (let j = i - k; j <= i + k && (istHoch || istTief); j++) {
      if (j === i) continue;
      if (j < i ? reihe.h[j] >= reihe.h[i] : reihe.h[j] > reihe.h[i]) istHoch = false;
      if (j < i ? reihe.l[j] <= reihe.l[i] : reihe.l[j] < reihe.l[i]) istTief = false;
    }
    if (istHoch) roh.push({ i, kurs: reihe.h[i], typ: 'hoch' });
    if (istTief) roh.push({ i, kurs: reihe.l[i], typ: 'tief' });
  }

  const zickzack: SwingPunkt[] = [];
  for (const punkt of roh) {
    const letzter = zickzack[zickzack.length - 1];
    if (!letzter || letzter.typ !== punkt.typ) {
      zickzack.push(punkt);
    } else if (punkt.typ === 'hoch' ? punkt.kurs > letzter.kurs : punkt.kurs < letzter.kurs) {
      zickzack[zickzack.length - 1] = punkt;
    }
  }
  return zickzack;
}

const letzte = (punkte: SwingPunkt[], typ: SwingPunkt['typ'], anzahl: number) =>
  punkte.filter((p) => p.typ === typ).slice(-anzahl);

export type Trend = 'auf' | 'ab' | 'seitwaerts';

export interface Marktphase {
  trend: Trend;
  /** 3 = Aufwärtstrend und Kurs über dem letzten Swing-Hoch (P2), 6 = gespiegelt. */
  phase: 3 | 6 | null;
  p2: number | null;
}

/**
 * Aufwärtstrend: die letzten zwei Swing-Hochs und -Tiefs steigen und der Kurs liegt
 * über dem letzten Swing-Tief. Phase 3: Kurs zusätzlich über dem letzten Swing-Hoch (P2).
 */
export function marktphase(reihe: Kursreihe, k: number): Marktphase {
  const punkte = swingPunkte(reihe, k);
  const hochs = letzte(punkte, 'hoch', 2);
  const tiefs = letzte(punkte, 'tief', 2);
  const kurs = reihe.c[reihe.c.length - 1];
  if (hochs.length < 2 || tiefs.length < 2) return { trend: 'seitwaerts', phase: null, p2: null };

  const [h1, h2] = hochs;
  const [t1, t2] = tiefs;
  if (h2.kurs > h1.kurs && t2.kurs > t1.kurs && kurs > t2.kurs) {
    return { trend: 'auf', phase: kurs > h2.kurs ? 3 : null, p2: h2.kurs };
  }
  if (h2.kurs < h1.kurs && t2.kurs < t1.kurs && kurs < h2.kurs) {
    return { trend: 'ab', phase: kurs < t2.kurs ? 6 : null, p2: t2.kurs };
  }
  return { trend: 'seitwaerts', phase: null, p2: null };
}

/** Kursveränderung in Prozent (als Faktor-1) über die letzten `kalendertage` Tage. */
export function performance(reihe: Kursreihe, kalendertage: number): number | null {
  const n = reihe.c.length;
  if (n < 2) return null;
  const ziel = reihe.d[n - 1] - kalendertage;
  let i = n - 1;
  while (i > 0 && reihe.d[i] > ziel) i--;
  if (reihe.d[i] > ziel) return null; // Reihe reicht nicht so weit zurück
  return reihe.c[n - 1] / reihe.c[i] - 1;
}

/** Relative Stärke: Aktie über 3 und 6 Monate besser (Short: schlechter) als der Index. */
export function relativeStaerke(aktie: Kursreihe, index: Kursreihe, richtung: Richtung): boolean {
  return [91, 182].every((tage) => {
    const a = performance(aktie, tage);
    const i = performance(index, tage);
    if (a === null || i === null) return false;
    return richtung === 'long' ? a > i : a < i;
  });
}

/** Abstand des Schlusskurses zum 52-Wochen-Hoch (Long) bzw. -Tief (Short) in Prozent. */
export function abstand52Wochen(reihe: Kursreihe, richtung: Richtung): number {
  const n = reihe.c.length;
  const start = Math.max(0, n - HANDELSTAGE_52_WOCHEN);
  const kurs = reihe.c[n - 1];
  if (richtung === 'long') {
    const hoch = Math.max(...reihe.h.slice(start));
    return ((hoch - kurs) / hoch) * 100;
  }
  const tief = Math.min(...reihe.l.slice(start));
  return ((kurs - tief) / tief) * 100;
}

export function naeheAn52WochenExtrem(reihe: Kursreihe, richtung: Richtung, prozent: number): boolean {
  return abstand52Wochen(reihe, richtung) <= prozent;
}

const mittel = (werte: number[]) => (werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : 0);

/**
 * Retest nach dem letzten Ausbruch über ein Swing-Hoch (Short: unter ein Swing-Tief)
 * innerhalb der letzten 60 Tage.
 * - schwach: ein Schlusskurs danach liegt mehr als die Toleranz unter dem Ausbruchsniveau
 * - gesund: Rücksetzer bis ans Ausbruchsniveau, der hält, bei sinkendem Volumen
 * - unklar: kein Ausbruch, noch kein Retest oder Volumen nicht rückläufig
 */
export function retestQualitaet(
  reihe: Kursreihe,
  richtung: Richtung,
  einstellungen: ScannerEinstellungen,
): RetestQualitaet {
  const n = reihe.c.length;
  const toleranz = einstellungen.retestToleranzProzent / 100;
  const typ = richtung === 'long' ? 'hoch' : 'tief';
  const ueber = (a: number, b: number) => (richtung === 'long' ? a > b : a < b);

  let ausbruch: { tag: number; niveau: number } | null = null;
  for (const punkt of swingPunkte(reihe, einstellungen.swingKerzen)) {
    if (punkt.typ !== typ) continue;
    for (let i = punkt.i + 1; i < n; i++) {
      if (ueber(reihe.c[i], punkt.kurs)) {
        if (!ausbruch || i > ausbruch.tag) ausbruch = { tag: i, niveau: punkt.kurs };
        break;
      }
    }
  }
  if (!ausbruch || ausbruch.tag < n - 60 || ausbruch.tag === n - 1) return 'unklar';

  const { tag, niveau } = ausbruch;
  const grenze = richtung === 'long' ? niveau * (1 - toleranz) : niveau * (1 + toleranz);
  for (let i = tag + 1; i < n; i++) {
    if (ueber(grenze, reihe.c[i])) return 'schwach';
  }

  const retestZone = richtung === 'long' ? niveau * (1 + toleranz) : niveau * (1 - toleranz);
  let retestTag = -1;
  for (let i = tag + 1; i < n; i++) {
    const extrem = richtung === 'long' ? reihe.l[i] : reihe.h[i];
    if (!ueber(extrem, retestZone)) retestTag = i;
  }
  if (retestTag === -1) return 'unklar';

  // Hochpunkt (Short: Tiefpunkt) zwischen Ausbruch und Retest
  let spitze = tag;
  for (let i = tag; i <= retestTag; i++) {
    if (richtung === 'long' ? reihe.h[i] > reihe.h[spitze] : reihe.l[i] < reihe.l[spitze]) spitze = i;
  }
  if (spitze === retestTag) return 'unklar';
  const volumenBewegung = mittel(reihe.v.slice(tag, spitze + 1));
  const volumenRuecksetzer = mittel(reihe.v.slice(spitze + 1, retestTag + 1));
  return volumenRuecksetzer < volumenBewegung ? 'gesund' : 'unklar';
}

/** Tiefe aller Korrekturen im Trend in Prozent, chronologisch. */
function korrekturTiefen(punkte: SwingPunkt[], richtung: Richtung): number[] {
  const tiefen: number[] = [];
  const startTyp = richtung === 'long' ? 'hoch' : 'tief';
  for (let j = 0; j < punkte.length - 1; j++) {
    const a = punkte[j];
    const b = punkte[j + 1];
    if (a.typ !== startTyp) continue;
    tiefen.push(Math.abs(a.kurs - b.kurs) / a.kurs);
  }
  return tiefen;
}

/** K.O.: Die letzten drei Korrekturen werden prozentual jeweils tiefer. */
export function wachsendeKorrekturen(reihe: Kursreihe, richtung: Richtung, k: number): boolean {
  const tiefen = korrekturTiefen(swingPunkte(reihe, k), richtung).slice(-3);
  return tiefen.length === 3 && tiefen[0] < tiefen[1] && tiefen[1] < tiefen[2];
}

/**
 * K.O.: In den letzten 10 Tagen mindestens 2 Tage gegen die Richtung mit mehr als
 * `faktor`-fachem Durchschnittsvolumen der 50 Tage davor.
 */
export function volumenWarnsignal(reihe: Kursreihe, richtung: Richtung, faktor: number): boolean {
  const n = reihe.c.length;
  let treffer = 0;
  for (let i = Math.max(51, n - 10); i < n; i++) {
    const gegenRichtung = richtung === 'long' ? reihe.c[i] < reihe.c[i - 1] : reihe.c[i] > reihe.c[i - 1];
    if (gegenRichtung && reihe.v[i] > faktor * mittel(reihe.v.slice(i - 50, i))) treffer++;
  }
  return treffer >= 2;
}

export interface LetzteKorrektur {
  /** Rückgang in Prozent der vorangegangenen Bewegung (0,25 = 25 %). */
  retracement: number;
  korrekturKerzen: number;
  bewegungsKerzen: number;
  kerzenSeitHoch: number;
}

/**
 * Die letzte Korrektur: vom letzten Swing-Hoch (P2) bis zum tiefsten Tief danach,
 * gemessen an der Bewegung vom Swing-Tief davor bis P2. Short gespiegelt.
 */
export function letzteKorrektur(reihe: Kursreihe, richtung: Richtung, k: number): LetzteKorrektur | null {
  const punkte = swingPunkte(reihe, k);
  const typ = richtung === 'long' ? 'hoch' : 'tief';
  let p2Index = -1;
  for (let j = punkte.length - 1; j >= 1; j--) {
    if (punkte[j].typ === typ) {
      p2Index = j;
      break;
    }
  }
  if (p2Index < 1) return null;
  const p2 = punkte[p2Index];
  const start = punkte[p2Index - 1];
  const n = reihe.c.length;
  if (p2.i >= n - 1) return null;

  let extremTag = p2.i + 1;
  for (let i = p2.i + 1; i < n; i++) {
    if (richtung === 'long' ? reihe.l[i] < reihe.l[extremTag] : reihe.h[i] > reihe.h[extremTag]) extremTag = i;
  }
  const extrem = richtung === 'long' ? reihe.l[extremTag] : reihe.h[extremTag];
  const bewegung = Math.abs(p2.kurs - start.kurs);
  if (bewegung === 0) return null;
  return {
    retracement: Math.abs(p2.kurs - extrem) / bewegung,
    korrekturKerzen: extremTag - p2.i,
    bewegungsKerzen: p2.i - start.i,
    kerzenSeitHoch: n - 1 - p2.i,
  };
}

/** Steigung der Regressionsgeraden über die logarithmierten Schlusskurse der letzten Tage. */
export function trendstaerke(reihe: Kursreihe, tage = 20): number {
  const werte = reihe.c.slice(-tage).map(Math.log);
  const n = werte.length;
  const xMittel = (n - 1) / 2;
  const yMittel = mittel(werte);
  let zaehler = 0;
  let nenner = 0;
  werte.forEach((y, x) => {
    zaehler += (x - xMittel) * (y - yMittel);
    nenner += (x - xMittel) ** 2;
  });
  return nenner === 0 ? 0 : zaehler / nenner;
}

/** Tage seit dem 52-Wochen-Hoch, das vor den letzten 10 Tagen erreicht wurde. */
export function tageSeitVorherigem52WochenHoch(reihe: Kursreihe): number {
  const n = reihe.h.length;
  const ende = Math.max(0, n - 10);
  const start = Math.max(0, n - HANDELSTAGE_52_WOCHEN);
  let maxI = start;
  for (let i = start; i < ende; i++) if (reihe.h[i] > reihe.h[maxI]) maxI = i;
  return n - 1 - maxI;
}

/** Schlusskurs markiert ein neues 52-Wochen-Hoch (über allen Hochs der Tage davor). */
export function neues52WochenHoch(reihe: Kursreihe): boolean {
  const n = reihe.c.length;
  const vorher = reihe.h.slice(Math.max(0, n - 1 - HANDELSTAGE_52_WOCHEN), n - 1);
  return vorher.length > 0 && reihe.c[n - 1] >= Math.max(...vorher);
}
