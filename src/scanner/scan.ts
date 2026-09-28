import type { AktienDaten, IndexDatei, Kursreihe, UebersichtDatei } from './daten';
import {
  abstand52Wochen,
  letzteKorrektur,
  marktphase,
  naeheAn52WochenExtrem,
  neues52WochenHoch,
  performance,
  relativeStaerke,
  retestQualitaet,
  tageSeitVorherigem52WochenHoch,
  trendstaerke,
  volumenWarnsignal,
  wachsendeKorrekturen,
  type ScannerEinstellungen,
} from './regeln';
import { calculateScreeningScore, type ScreeningScoreResult } from '../screening';
import { SETUP_KRITERIEN } from '../screeningSetups';
import type { RetestQualitaet, Richtung, ScreeningSetupTyp } from '../types';

export const MIN_HANDELSTAGE = 200;

export interface ScanErgebnis {
  symbol: string;
  name: string;
  branche: string;
  richtung: Richtung;
  kurs: number;
  marktphaseBestaetigt: boolean;
  relativeStaerkeErfuellt: boolean;
  naeheAn52WochenExtrem: boolean;
  retestQualitaet: RetestQualitaet;
  brancheBestaetigtWoche: boolean;
  brancheBestaetigtMonat: boolean;
  wachsendeKorrekturen: boolean;
  volumenWarnsignal: boolean;
  setupTyp: ScreeningSetupTyp;
  setupKriterien: Record<string, boolean>;
  score: ScreeningScoreResult;
  abstand52WochenProzent: number;
  performance3Monate: number | null;
}

const SETUPS_NACH_RICHTUNG: Record<Richtung, ScreeningSetupTyp[]> = {
  long: ['long-ueber-p2', '52-wochenhoch', 'bewegungshandel'],
  short: ['short-unter-p2'],
};

interface Kontext {
  index: Kursreihe;
  indexPhase: 3 | 6 | null;
  staerksterIndex: boolean;
  /** Durchschnittliche Performance je Branche über 1 Woche / 1 Monat. */
  branchenPerformance: Map<string, { woche: number; monat: number }>;
  indexWoche: number;
  indexMonat: number;
  einstellungen: ScannerEinstellungen;
}

function bewerteRichtung(aktie: AktienDaten, richtung: Richtung, ctx: Kontext): ScanErgebnis {
  const { reihe } = aktie;
  const k = ctx.einstellungen.swingKerzen;
  const phase = marktphase(reihe, k);
  const long = richtung === 'long';
  const phaseErfuellt = phase.phase === (long ? 3 : 6);
  const indexPhaseErfuellt = ctx.indexPhase === (long ? 3 : 6);

  const branche = ctx.branchenPerformance.get(aktie.branche);
  const besser = (a: number, b: number) => (long ? a > b : a < b);

  const korrektur = letzteKorrektur(reihe, richtung, k);
  const staerkeAktie = trendstaerke(reihe);
  const staerkeIndex = trendstaerke(ctx.index);

  const alleSetupKriterien: Record<string, boolean> = {
    'index-phase3': indexPhaseErfuellt,
    'index-phase6': indexPhaseErfuellt,
    'aktie-phase3': phaseErfuellt,
    'aktie-phase6': phaseErfuellt,
    'korrektur-50': !!korrektur && korrektur.korrekturKerzen >= 0.5 * korrektur.bewegungsKerzen,
    'min-3-kerzen': !!korrektur && korrektur.korrekturKerzen >= 3,
    'fib-25': !!korrektur && korrektur.retracement >= 0.25,
    trendstaerke: besser(staerkeAktie, staerkeIndex),
    'staerkster-index': ctx.staerksterIndex,
    'hoch-3-monate': tageSeitVorherigem52WochenHoch(reihe) >= 63,
    'korrektur-vor-ausbruch': !!korrektur && korrektur.korrekturKerzen >= 3 && korrektur.kerzenSeitHoch <= 60,
    'ausbruch-52wh-relevant': phaseErfuellt && neues52WochenHoch(reihe),
  };

  // Setup mit dem höchsten Anteil erfüllter Punkte wählen
  let setupTyp = SETUPS_NACH_RICHTUNG[richtung][0];
  let besterAnteil = -1;
  for (const typ of SETUPS_NACH_RICHTUNG[richtung]) {
    const kriterien = SETUP_KRITERIEN[typ];
    const anteil = kriterien.filter((kr) => alleSetupKriterien[kr.id]).length / kriterien.length;
    if (anteil > besterAnteil) {
      besterAnteil = anteil;
      setupTyp = typ;
    }
  }
  const setupKriterien = Object.fromEntries(
    SETUP_KRITERIEN[setupTyp].map((kr) => [kr.id, alleSetupKriterien[kr.id] ?? false]),
  );

  const felder = {
    marktphaseBestaetigt: phaseErfuellt,
    relativeStaerkeErfuellt: relativeStaerke(reihe, ctx.index, richtung),
    naeheAn52WochenExtrem: naeheAn52WochenExtrem(reihe, richtung, ctx.einstellungen.naehe52WochenProzent),
    brancheBestaetigtWoche: !!branche && besser(branche.woche, ctx.indexWoche),
    brancheBestaetigtMonat: !!branche && besser(branche.monat, ctx.indexMonat),
    wachsendeKorrekturen: wachsendeKorrekturen(reihe, richtung, k),
    volumenWarnsignal: volumenWarnsignal(reihe, richtung, ctx.einstellungen.volumenFaktor),
    setupTyp,
    setupKriterien,
  };

  return {
    symbol: aktie.symbol,
    name: aktie.name,
    branche: aktie.branche,
    richtung,
    kurs: reihe.c[reihe.c.length - 1],
    ...felder,
    retestQualitaet: retestQualitaet(reihe, richtung, ctx.einstellungen),
    score: calculateScreeningScore(felder),
    abstand52WochenProzent: abstand52Wochen(reihe, richtung),
    performance3Monate: performance(reihe, 91),
  };
}

/**
 * Richtung: im Aufwärtstrend Long, im Abwärtstrend Short. Seitwärts entscheidet die
 * Richtung mit mehr erfüllten Kernkriterien (bei Gleichstand Long).
 */
function bewerteAktie(aktie: AktienDaten, ctx: Kontext): ScanErgebnis {
  const trend = marktphase(aktie.reihe, ctx.einstellungen.swingKerzen).trend;
  if (trend === 'auf') return bewerteRichtung(aktie, 'long', ctx);
  if (trend === 'ab') return bewerteRichtung(aktie, 'short', ctx);
  const long = bewerteRichtung(aktie, 'long', ctx);
  const short = bewerteRichtung(aktie, 'short', ctx);
  return short.score.kernErfuellt > long.score.kernErfuellt ? short : long;
}

/** Sortierung: nicht ausgeschlossene zuerst, dann Kernkriterien, dann Setup-Anteil. */
export function vergleicheErgebnisse(a: ScanErgebnis, b: ScanErgebnis): number {
  if (a.score.ausgeschlossen !== b.score.ausgeschlossen) return a.score.ausgeschlossen ? 1 : -1;
  if (a.score.kernErfuellt !== b.score.kernErfuellt) return b.score.kernErfuellt - a.score.kernErfuellt;
  const anteil = (e: ScanErgebnis) => e.score.setupErfuellt / Math.max(1, e.score.setupGesamt);
  return anteil(b) - anteil(a);
}

export interface ScanAusgabe {
  ergebnisse: ScanErgebnis[];
  zuWenigDaten: string[];
}

export function scanneIndex(
  datei: IndexDatei,
  uebersicht: UebersichtDatei | null,
  einstellungen: ScannerEinstellungen,
): ScanAusgabe {
  const auswertbar = datei.aktien.filter((a) => a.reihe.c.length >= MIN_HANDELSTAGE);
  const zuWenigDaten = datei.aktien.filter((a) => a.reihe.c.length < MIN_HANDELSTAGE).map((a) => a.name);

  const summen = new Map<string, { woche: number; monat: number; anzahl: number }>();
  for (const aktie of auswertbar) {
    const woche = performance(aktie.reihe, 7);
    const monat = performance(aktie.reihe, 30);
    if (woche === null || monat === null) continue;
    const s = summen.get(aktie.branche) ?? { woche: 0, monat: 0, anzahl: 0 };
    summen.set(aktie.branche, { woche: s.woche + woche, monat: s.monat + monat, anzahl: s.anzahl + 1 });
  }
  const branchenPerformance = new Map(
    [...summen].map(([branche, s]) => [branche, { woche: s.woche / s.anzahl, monat: s.monat / s.anzahl }]),
  );

  const indexPerformance3M = (reihe: Kursreihe) => performance(reihe, 91) ?? -Infinity;
  const eigene = indexPerformance3M(datei.index);
  const staerksterIndex =
    !!uebersicht && uebersicht.indizes.every((i) => i.id === datei.id || indexPerformance3M(i.reihe) <= eigene);

  const ctx: Kontext = {
    index: datei.index,
    indexPhase: marktphase(datei.index, einstellungen.swingKerzen).phase,
    staerksterIndex,
    branchenPerformance,
    indexWoche: performance(datei.index, 7) ?? 0,
    indexMonat: performance(datei.index, 30) ?? 0,
    einstellungen,
  };

  const ergebnisse = auswertbar.map((aktie) => bewerteAktie(aktie, ctx)).sort(vergleicheErgebnisse);
  return { ergebnisse, zuWenigDaten };
}
