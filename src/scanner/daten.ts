import type { Branche } from './indices';

// Tageskurse einer Aktie oder eines Index. Alle Arrays sind gleich lang und
// chronologisch sortiert; d = Tage seit 1970-01-01 (UTC).
export interface Kursreihe {
  d: number[];
  c: number[]; // Schlusskurs
  h: number[]; // Tageshoch
  l: number[]; // Tagestief
  v: number[]; // Volumen
}

export interface AktienDaten {
  symbol: string;
  name: string;
  branche: Branche;
  reihe: Kursreihe;
}

// Inhalt von data/<index-id>.json
export interface IndexDatei {
  id: string;
  name: string;
  aktualisiert: string; // ISO-Zeitstempel des Abrufs
  index: Kursreihe;
  aktien: AktienDaten[];
}

// Inhalt von data/uebersicht.json: alle Indizes mit ihren Schlusskursen,
// damit der Scanner den stärksten Index bestimmen kann.
export interface UebersichtDatei {
  aktualisiert: string;
  indizes: { id: string; name: string; anzahlAktien: number; reihe: Kursreihe }[];
}

export function tagZuDatum(tag: number): Date {
  return new Date(tag * 86_400_000);
}
