import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { SETUP_KRITERIEN, SETUP_LABELS } from '../screeningSetups';
import { INDIZES } from '../scanner/indices';
import { tagZuDatum, type IndexDatei, type UebersichtDatei } from '../scanner/daten';
import { STANDARD_EINSTELLUNGEN, type ScannerEinstellungen } from '../scanner/regeln';
import { scanneIndex, type ScanErgebnis } from '../scanner/scan';
import { loadScannerEinstellungen, saveScannerEinstellungen } from '../storage';
import type { TradeStore } from '../hooks/useTradeStore';
import type { RetestQualitaet } from '../types';

const DATEN_URL = `${import.meta.env.BASE_URL}data/`;

type Filter = 'alle' | 'long' | 'short';

const RETEST_LABEL: Record<RetestQualitaet, string> = { gesund: 'Gesund', schwach: 'Schwach', unklar: 'Unklar' };

const EINSTELLUNGS_FELDER: { key: keyof ScannerEinstellungen; label: string; step: number }[] = [
  { key: 'naehe52WochenProzent', label: 'Max. Abstand zum 52-Wochen-Hoch/-Tief (%)', step: 1 },
  { key: 'volumenFaktor', label: 'Volumen-Warnsignal ab x-fachem Durchschnitt', step: 0.1 },
  { key: 'retestToleranzProzent', label: 'Retest-Toleranz um das Ausbruchsniveau (%)', step: 0.5 },
  { key: 'swingKerzen', label: 'Kerzen links/rechts für Swing-Hoch/-Tief', step: 1 },
];

async function ladeJson<T>(datei: string): Promise<T | null> {
  try {
    const res = await fetch(DATEN_URL + datei, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function Haken({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? 'scanner-kriterium scanner-kriterium--ok' : 'scanner-kriterium'}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span> {children}
    </li>
  );
}

function ErgebnisDetails({ e }: { e: ScanErgebnis }) {
  const long = e.richtung === 'long';
  return (
    <div className="scanner-details">
      <strong>Kernkriterien</strong>
      <ul>
        <Haken ok={e.marktphaseBestaetigt}>Marktphase {long ? '3' : '6'}</Haken>
        <Haken ok={e.relativeStaerkeErfuellt}>Relative {long ? 'Stärke' : 'Schwäche'} vs. Index (3 und 6 Monate)</Haken>
        <Haken ok={e.naeheAn52WochenExtrem}>
          Nähe 52-Wochen-{long ? 'Hoch' : 'Tief'} ({e.abstand52WochenProzent.toFixed(1)} % entfernt)
        </Haken>
        <Haken ok={e.brancheBestaetigtWoche}>Branche bestätigt (Woche)</Haken>
        <Haken ok={e.brancheBestaetigtMonat}>Branche bestätigt (Monat)</Haken>
      </ul>
      <p className="scanner-details__zeile">Retest-Qualität: {RETEST_LABEL[e.retestQualitaet]}</p>
      <strong>K.O.-Kriterien</strong>
      <ul>
        <Haken ok={!e.wachsendeKorrekturen}>Keine wachsenden Korrekturen</Haken>
        <Haken ok={!e.volumenWarnsignal}>Kein Volumen-Warnsignal</Haken>
      </ul>
      <strong>Setup: {SETUP_LABELS[e.setupTyp]}</strong>
      <ul>
        {SETUP_KRITERIEN[e.setupTyp].map((kr) => (
          <Haken key={kr.id} ok={!!e.setupKriterien[kr.id]}>
            {kr.label}
          </Haken>
        ))}
      </ul>
    </div>
  );
}

export function IndexScanner({ store }: { store: TradeStore }) {
  const [uebersicht, setUebersicht] = useState<UebersichtDatei | null>(null);
  const [indexId, setIndexId] = useState<string | null>(null);
  const [dateien, setDateien] = useState<Record<string, IndexDatei | null>>({});
  const [laedt, setLaedt] = useState(false);
  const [filter, setFilter] = useState<Filter>('alle');
  const [ausgeschlosseneZeigen, setAusgeschlosseneZeigen] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);
  const [einstellungen, setEinstellungen] = useState<ScannerEinstellungen>(() => loadScannerEinstellungen());

  useEffect(() => {
    ladeJson<UebersichtDatei>('uebersicht.json').then(setUebersicht);
  }, []);

  useEffect(() => saveScannerEinstellungen(einstellungen), [einstellungen]);

  async function waehleIndex(id: string) {
    setIndexId(id);
    setOffen(null);
    if (id in dateien) return;
    setLaedt(true);
    const datei = await ladeJson<IndexDatei>(`${id}.json`);
    setDateien((prev) => ({ ...prev, [id]: datei }));
    setLaedt(false);
  }

  const datei = indexId ? dateien[indexId] : undefined;
  const scan = useMemo(
    () => (datei ? scanneIndex(datei, uebersicht, einstellungen) : null),
    [datei, uebersicht, einstellungen],
  );

  const gespeichert = new Set(store.screenings.map((s) => s.symbol));
  const sichtbar = (scan?.ergebnisse ?? []).filter(
    (e) => (filter === 'alle' || e.richtung === filter) && (ausgeschlosseneZeigen || !e.score.ausgeschlossen),
  );
  const anzahlAusgeschlossen = (scan?.ergebnisse ?? []).filter((e) => e.score.ausgeschlossen).length;

  function zurWatchlist(e: ScanErgebnis) {
    if (!datei) return;
    store.addScreening({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      aktie: e.name,
      symbol: e.symbol,
      index: datei.name,
      branche: e.branche,
      richtung: e.richtung,
      kursBeiAufnahme: e.kurs,
      marktphaseBestaetigt: e.marktphaseBestaetigt,
      relativeStaerkeErfuellt: e.relativeStaerkeErfuellt,
      naeheAn52WochenExtrem: e.naeheAn52WochenExtrem,
      retestQualitaet: e.retestQualitaet,
      brancheBestaetigtWoche: e.brancheBestaetigtWoche,
      brancheBestaetigtMonat: e.brancheBestaetigtMonat,
      wachsendeKorrekturen: e.wachsendeKorrekturen,
      volumenWarnsignal: e.volumenWarnsignal,
      setupTyp: e.setupTyp,
      setupKriterien: e.setupKriterien,
    });
  }

  const stand = datei ? tagZuDatum(datei.index.d[datei.index.d.length - 1]).toLocaleDateString('de-DE') : null;

  return (
    <section className="scanner">
      <h2>Index-Scanner</h2>
      <div className="scanner-indizes">
        {INDIZES.map((def) => (
          <button
            key={def.id}
            type="button"
            className={def.id === indexId ? 'scanner-chip scanner-chip--aktiv' : 'scanner-chip'}
            onClick={() => waehleIndex(def.id)}
          >
            {def.name}
          </button>
        ))}
      </div>

      {!indexId && <p className="scanner-hinweis">Wähle einen Index. Alle Aktien daraus werden automatisch bewertet.</p>}
      {laedt && <p className="scanner-hinweis">Lade Kursdaten …</p>}
      {indexId && !laedt && datei === null && (
        <p className="scanner-hinweis">
          Für diesen Index liegen noch keine Kursdaten vor. Sie werden jede Nacht nach Börsenschluss geladen.
        </p>
      )}

      {datei && scan && (
        <>
          <p className="scanner-hinweis">
            Stand: Schlusskurs {stand} · {scan.ergebnisse.length} Aktien bewertet
            {scan.zuWenigDaten.length > 0 && ` · ${scan.zuWenigDaten.length} mit zu kurzer Historie`}
          </p>
          <div className="richtung-toggle">
            {(['alle', 'long', 'short'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={
                  filter === f
                    ? `richtung-toggle__btn richtung-toggle__btn--active-${f === 'short' ? 'short' : 'long'}`
                    : 'richtung-toggle__btn'
                }
                onClick={() => setFilter(f)}
              >
                {f === 'alle' ? 'Alle' : f === 'long' ? 'Long' : 'Short'}
              </button>
            ))}
          </div>
          <label className="scanner-checkbox">
            <input
              type="checkbox"
              checked={ausgeschlosseneZeigen}
              onChange={(event) => setAusgeschlosseneZeigen(event.target.checked)}
            />
            K.O.-Aktien anzeigen ({anzahlAusgeschlossen})
          </label>

          <ul className="calc-list">
            {sichtbar.map((e) => (
              <li key={e.symbol} className="calc-list__item">
                <div className="calc-list__header">
                  <span>{e.branche}</span>
                  <span className={`calc-list__richtung calc-list__richtung--${e.richtung}`}>
                    {e.richtung === 'long' ? 'Long' : 'Short'}
                  </span>
                </div>
                <div className="calc-list__body">
                  <span>
                    {e.name} ({e.symbol})
                  </span>
                  <strong>{e.kurs.toFixed(2)}</strong>
                </div>
                <div className="watchlist-list__scores">
                  {e.score.ausgeschlossen && (
                    <span className="watchlist-list__badge watchlist-list__badge--ausgeschlossen">
                      K.O.: {[e.wachsendeKorrekturen && 'Korrekturen', e.volumenWarnsignal && 'Volumen'].filter(Boolean).join(', ')}
                    </span>
                  )}
                  <span className="watchlist-list__badge">
                    {e.score.kernErfuellt}/{e.score.kernGesamt} Kernkriterien
                  </span>
                  <span className="watchlist-list__badge">
                    {SETUP_LABELS[e.setupTyp]} {e.score.setupErfuellt}/{e.score.setupGesamt}
                  </span>
                  <span className="watchlist-list__badge">Retest: {RETEST_LABEL[e.retestQualitaet]}</span>
                </div>
                {offen === e.symbol && <ErgebnisDetails e={e} />}
                <div className="calc-list__actions">
                  <button type="button" onClick={() => setOffen(offen === e.symbol ? null : e.symbol)}>
                    {offen === e.symbol ? 'Weniger' : 'Details'}
                  </button>
                  <button type="button" disabled={gespeichert.has(e.symbol)} onClick={() => zurWatchlist(e)}>
                    {gespeichert.has(e.symbol) ? 'Auf Watchlist' : 'Zur Watchlist'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {sichtbar.length === 0 && <p className="scanner-hinweis">Keine Aktie passt zu diesem Filter.</p>}
        </>
      )}

      <details className="scanner-einstellungen">
        <summary>Einstellungen</summary>
        <div className="calc-form">
          {EINSTELLUNGS_FELDER.map((feld) => (
            <label key={feld.key}>
              {feld.label}
              <input
                type="number"
                inputMode="decimal"
                min={feld.step}
                step={feld.step}
                value={einstellungen[feld.key]}
                onChange={(event) => {
                  const wert = Number(event.target.value);
                  if (wert > 0) setEinstellungen((prev) => ({ ...prev, [feld.key]: wert }));
                }}
              />
            </label>
          ))}
          <button type="button" onClick={() => setEinstellungen(STANDARD_EINSTELLUNGEN)}>
            Standardwerte
          </button>
        </div>
      </details>
    </section>
  );
}
