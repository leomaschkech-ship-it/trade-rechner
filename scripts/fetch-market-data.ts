// Lädt Tageskurse für alle Scanner-Indizes von Yahoo Finance und schreibt sie nach
// public/data/. Läuft nächtlich im GitHub-Workflow vor dem Build.
//
// Aktien, die nicht geladen werden können, übernimmt das Skript aus den zuletzt
// veröffentlichten Daten. Das Skript bricht nie mit Fehler ab, damit der Build
// (und damit die App) auch bei einem Ausfall von Yahoo weiterläuft.

import { mkdir, writeFile } from 'node:fs/promises';
import { GICS_BRANCHE, INDIZES, type IndexDefinition, type IndexMitglied } from '../src/scanner/indices';
import type { AktienDaten, IndexDatei, Kursreihe, UebersichtDatei } from '../src/scanner/daten';

const AUSGABE = new URL('../public/data/', import.meta.url);
const VEROEFFENTLICHT = 'https://leomaschkech-ship-it.github.io/trade-rechner/data/';
const SP500_LISTE = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv';
const USER_AGENT = 'Mozilla/5.0 (compatible; trade-rechner/1.0)';
const PARALLEL = 4;
const MAX_HANDELSTAGE = 330; // gut 15 Monate: 52 Wochen plus Vorlauf für 6-Monats-Vergleiche

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
const runde = (x: number) => Math.round(x * 100) / 100;

async function ladeKursreihe(symbol: string): Promise<Kursreihe | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`;
  for (let versuch = 0; versuch < 3; versuch++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.status === 429 || res.status >= 500) {
        await warte(2000 * (versuch + 1));
        continue;
      }
      if (!res.ok) return null;
      const json = await res.json();
      const r = json?.chart?.result?.[0];
      const q = r?.indicators?.quote?.[0];
      if (!r?.timestamp || !q) return null;
      const reihe: Kursreihe = { d: [], c: [], h: [], l: [], v: [] };
      (r.timestamp as number[]).forEach((ts, i) => {
        const [c, h, l] = [q.close[i], q.high[i], q.low[i]];
        if (c == null || h == null || l == null) return;
        const tag = Math.floor(ts / 86_400);
        if (reihe.d[reihe.d.length - 1] === tag) return;
        reihe.d.push(tag);
        reihe.c.push(runde(c));
        reihe.h.push(runde(h));
        reihe.l.push(runde(l));
        reihe.v.push(Math.round(q.volume[i] ?? 0));
      });
      if (!reihe.c.length) return null;
      const start = Math.max(0, reihe.c.length - MAX_HANDELSTAGE);
      return {
        d: reihe.d.slice(start),
        c: reihe.c.slice(start),
        h: reihe.h.slice(start),
        l: reihe.l.slice(start),
        v: reihe.v.slice(start),
      };
    } catch {
      await warte(2000 * (versuch + 1));
    }
  }
  return null;
}

async function ladeVeroeffentlicht<T>(datei: string): Promise<T | null> {
  try {
    const res = await fetch(VEROEFFENTLICHT + datei);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function parseCsvZeile(zeile: string): string[] {
  const felder: string[] = [];
  let aktuell = '';
  let inAnfuehrung = false;
  for (const zeichen of zeile) {
    if (zeichen === '"') inAnfuehrung = !inAnfuehrung;
    else if (zeichen === ',' && !inAnfuehrung) {
      felder.push(aktuell);
      aktuell = '';
    } else aktuell += zeichen;
  }
  felder.push(aktuell);
  return felder;
}

async function ladeSp500(): Promise<IndexMitglied[]> {
  try {
    const res = await fetch(SP500_LISTE);
    if (!res.ok) return [];
    const zeilen = (await res.text()).trim().split('\n').slice(1);
    return zeilen
      .map(parseCsvZeile)
      .filter(([symbol, , sektor]) => symbol && GICS_BRANCHE[sektor])
      .map(([symbol, name, sektor]) => ({
        symbol: symbol.replace('.', '-'), // Yahoo schreibt BRK-B statt BRK.B
        name,
        branche: GICS_BRANCHE[sektor],
      }));
  } catch {
    return [];
  }
}

async function parallel<T, R>(elemente: T[], fn: (e: T) => Promise<R>): Promise<R[]> {
  const ergebnisse: R[] = new Array(elemente.length);
  let naechstes = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (naechstes < elemente.length) {
        const i = naechstes++;
        ergebnisse[i] = await fn(elemente[i]);
        await warte(150);
      }
    }),
  );
  return ergebnisse;
}

async function ladeIndex(def: IndexDefinition): Promise<IndexDatei | null> {
  const alt = await ladeVeroeffentlicht<IndexDatei>(`${def.id}.json`);
  let mitglieder = def.mitglieder;
  if (def.id === 'sp500') {
    mitglieder = await ladeSp500();
    if (mitglieder.length === 0 && alt) {
      mitglieder = alt.aktien.map(({ symbol, name, branche }) => ({ symbol, name, branche }));
    }
  }

  const index = (await ladeKursreihe(def.indexSymbol)) ?? alt?.index ?? null;
  if (!index) {
    console.warn(`${def.name}: Index-Kurse nicht verfügbar, übersprungen`);
    return null;
  }

  const altNachSymbol = new Map(alt?.aktien.map((a) => [a.symbol, a.reihe]));
  let neu = 0;
  const aktien = await parallel(mitglieder, async (m): Promise<AktienDaten | null> => {
    const reihe = await ladeKursreihe(m.symbol);
    if (reihe) neu++;
    const ergebnis = reihe ?? altNachSymbol.get(m.symbol);
    return ergebnis ? { ...m, reihe: ergebnis } : null;
  });
  const gefunden = aktien.filter((a): a is AktienDaten => a !== null);
  const fehlend = mitglieder.filter((m) => !gefunden.some((a) => a.symbol === m.symbol)).map((m) => m.symbol);

  console.log(
    `${def.name}: ${neu}/${mitglieder.length} neu geladen, ${gefunden.length - neu} aus letztem Stand` +
      (fehlend.length ? `, fehlen: ${fehlend.join(', ')}` : ''),
  );
  return {
    id: def.id,
    name: def.name,
    aktualisiert: neu > 0 || !alt ? new Date().toISOString() : alt.aktualisiert,
    index,
    aktien: gefunden,
  };
}

async function main() {
  await mkdir(AUSGABE, { recursive: true });
  const uebersicht: UebersichtDatei = { aktualisiert: new Date().toISOString(), indizes: [] };

  for (const def of INDIZES) {
    try {
      const datei = await ladeIndex(def);
      if (!datei) continue;
      await writeFile(new URL(`${def.id}.json`, AUSGABE), JSON.stringify(datei));
      uebersicht.indizes.push({ id: def.id, name: def.name, anzahlAktien: datei.aktien.length, reihe: datei.index });
    } catch (fehler) {
      console.warn(`${def.name}: Fehler beim Abruf`, fehler);
    }
  }
  const ergebnis = uebersicht.indizes.length ? uebersicht : await ladeVeroeffentlicht<UebersichtDatei>('uebersicht.json');
  if (ergebnis) await writeFile(new URL('uebersicht.json', AUSGABE), JSON.stringify(ergebnis));
}

main().catch((fehler) => {
  console.warn('Abruf der Kursdaten fehlgeschlagen', fehler);
});
