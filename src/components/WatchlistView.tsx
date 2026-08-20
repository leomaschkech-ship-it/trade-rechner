import { type FormEvent, useState } from 'react';
import { calculateScreeningScore } from '../screening';
import { SETUP_KRITERIEN, SETUP_LABELS } from '../screeningSetups';
import type { TradeStore } from '../hooks/useTradeStore';
import type { Richtung, RetestQualitaet, ScreeningSetupTyp } from '../types';

const SETUP_TYPEN = Object.keys(SETUP_LABELS) as ScreeningSetupTyp[];

export function WatchlistView({ store }: { store: TradeStore }) {
  const [aktie, setAktie] = useState('');
  const [symbol, setSymbol] = useState('');
  const [index, setIndex] = useState('');
  const [branche, setBranche] = useState('');
  const [richtung, setRichtung] = useState<Richtung>('long');
  const [kursBeiAufnahme, setKursBeiAufnahme] = useState('');
  const [marktphaseBestaetigt, setMarktphaseBestaetigt] = useState(false);
  const [relativeStaerkeErfuellt, setRelativeStaerkeErfuellt] = useState(false);
  const [naeheAn52WochenExtrem, setNaeheAn52WochenExtrem] = useState(false);
  const [retestQualitaet, setRetestQualitaet] = useState<RetestQualitaet>('unklar');
  const [brancheBestaetigtWoche, setBrancheBestaetigtWoche] = useState(false);
  const [brancheBestaetigtMonat, setBrancheBestaetigtMonat] = useState(false);
  const [wachsendeKorrekturen, setWachsendeKorrekturen] = useState(false);
  const [volumenWarnsignal, setVolumenWarnsignal] = useState(false);
  const [setupTyp, setSetupTyp] = useState<ScreeningSetupTyp>('long-ueber-p2');
  const [setupKriterien, setSetupKriterien] = useState<Record<string, boolean>>({});
  const [freitext, setFreitext] = useState('');

  function handleSetupTypChange(value: ScreeningSetupTyp) {
    setSetupTyp(value);
    setSetupKriterien({});
  }

  function toggleSetupKriterium(id: string) {
    setSetupKriterien((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleClearAll() {
    if (store.screenings.length === 0) return;
    if (window.confirm('Wirklich alle gespeicherten Watchlist-Einträge löschen?')) {
      store.clearScreenings();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    store.addScreening({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      aktie,
      symbol,
      index,
      branche,
      richtung,
      kursBeiAufnahme: Number(kursBeiAufnahme) || 0,
      marktphaseBestaetigt,
      relativeStaerkeErfuellt,
      naeheAn52WochenExtrem,
      retestQualitaet,
      brancheBestaetigtWoche,
      brancheBestaetigtMonat,
      wachsendeKorrekturen,
      volumenWarnsignal,
      setupTyp,
      setupKriterien,
      freitext: freitext || undefined,
    });
    setAktie('');
    setSymbol('');
    setIndex('');
    setBranche('');
    setRichtung('long');
    setKursBeiAufnahme('');
    setMarktphaseBestaetigt(false);
    setRelativeStaerkeErfuellt(false);
    setNaeheAn52WochenExtrem(false);
    setRetestQualitaet('unklar');
    setBrancheBestaetigtWoche(false);
    setBrancheBestaetigtMonat(false);
    setWachsendeKorrekturen(false);
    setVolumenWarnsignal(false);
    setSetupTyp('long-ueber-p2');
    setSetupKriterien({});
    setFreitext('');
  }

  return (
    <div className="watchlist-view">
      <h1>Watchlist</h1>

      {store.screenings.length === 0 && <p>Noch keine Kandidaten erfasst.</p>}
      <ul className="calc-list">
        {store.screenings.map((entry) => {
          const score = calculateScreeningScore({
            marktphaseBestaetigt: entry.marktphaseBestaetigt,
            relativeStaerkeErfuellt: entry.relativeStaerkeErfuellt,
            naeheAn52WochenExtrem: entry.naeheAn52WochenExtrem,
            brancheBestaetigtWoche: entry.brancheBestaetigtWoche,
            brancheBestaetigtMonat: entry.brancheBestaetigtMonat,
            wachsendeKorrekturen: entry.wachsendeKorrekturen,
            volumenWarnsignal: entry.volumenWarnsignal,
            setupTyp: entry.setupTyp,
            setupKriterien: entry.setupKriterien,
          });
          return (
            <li key={entry.id} className="calc-list__item">
              <div className="calc-list__header">
                <span>
                  {entry.aktie} ({entry.symbol})
                </span>
                <span className={`calc-list__richtung calc-list__richtung--${entry.richtung}`}>
                  {entry.richtung === 'long' ? 'Long' : 'Short'}
                </span>
              </div>
              <div className="calc-list__body">
                <span>
                  {entry.index} · {entry.branche}
                </span>
                <strong>{entry.kursBeiAufnahme.toFixed(3)}</strong>
              </div>
              <div className="calc-list__body">
                <span>{new Date(entry.timestamp).toLocaleString('de-DE')}</span>
              </div>
              <div className="watchlist-list__scores">
                {score.ausgeschlossen ? (
                  <span className="watchlist-list__badge watchlist-list__badge--ausgeschlossen">Ausgeschlossen</span>
                ) : (
                  <>
                    <span className="watchlist-list__badge">{SETUP_LABELS[entry.setupTyp]}</span>
                    <span className="watchlist-list__badge">
                      {score.kernErfuellt}/{score.kernGesamt} Kernkriterien
                    </span>
                    <span className="watchlist-list__badge">
                      {score.setupErfuellt}/{score.setupGesamt} Setup-Kriterien
                    </span>
                  </>
                )}
                <span className="watchlist-list__badge">
                  Retest:{' '}
                  {entry.retestQualitaet === 'gesund'
                    ? 'Gesund'
                    : entry.retestQualitaet === 'schwach'
                      ? 'Schwach'
                      : 'Unklar'}
                </span>
              </div>
              {entry.freitext && <p className="calc-list__freitext">{entry.freitext}</p>}
              <div className="calc-list__actions">
                <button type="button" onClick={() => store.removeScreening(entry.id)}>
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {store.screenings.length > 0 && (
        <button type="button" className="calc-list__clear" onClick={handleClearAll}>
          Alle löschen
        </button>
      )}

      <form className="calc-form" onSubmit={handleSubmit}>
        <h2>Kandidat hinzufügen</h2>
        <label>
          Aktie
          <input type="text" value={aktie} onChange={(event) => setAktie(event.target.value)} required />
        </label>
        <label>
          Symbol
          <input type="text" value={symbol} onChange={(event) => setSymbol(event.target.value)} required />
        </label>
        <label>
          Index
          <input type="text" value={index} onChange={(event) => setIndex(event.target.value)} />
        </label>
        <label>
          Branche
          <input type="text" value={branche} onChange={(event) => setBranche(event.target.value)} />
        </label>

        <div className="richtung-toggle">
          <button
            type="button"
            className={
              richtung === 'long' ? 'richtung-toggle__btn richtung-toggle__btn--active-long' : 'richtung-toggle__btn'
            }
            onClick={() => setRichtung('long')}
          >
            Long
          </button>
          <button
            type="button"
            className={
              richtung === 'short' ? 'richtung-toggle__btn richtung-toggle__btn--active-short' : 'richtung-toggle__btn'
            }
            onClick={() => setRichtung('short')}
          >
            Short
          </button>
        </div>

        <label>
          Kurs bei Aufnahme
          <input
            type="number"
            min={0}
            step="any"
            value={kursBeiAufnahme}
            onChange={(event) => setKursBeiAufnahme(event.target.value)}
          />
        </label>

        <h2>Kern-Kriterien</h2>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={marktphaseBestaetigt}
            onChange={(event) => setMarktphaseBestaetigt(event.target.checked)}
          />
          Marktphase bestätigt (Phase 3/6 laut 6-Phasen-Modell)
        </label>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={relativeStaerkeErfuellt}
            onChange={(event) => setRelativeStaerkeErfuellt(event.target.checked)}
          />
          Relative Stärke/Schwäche vs. Index erfüllt
        </label>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={naeheAn52WochenExtrem}
            onChange={(event) => setNaeheAn52WochenExtrem(event.target.checked)}
          />
          Nähe zum 52-Wochen-Hoch/-Tief
        </label>
        <label>
          Retest-Qualität
          <select value={retestQualitaet} onChange={(event) => setRetestQualitaet(event.target.value as RetestQualitaet)}>
            <option value="gesund">Gesund</option>
            <option value="schwach">Schwach</option>
            <option value="unklar">Unklar</option>
          </select>
        </label>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={brancheBestaetigtWoche}
            onChange={(event) => setBrancheBestaetigtWoche(event.target.checked)}
          />
          Branche bestätigt auf Wochensicht
        </label>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={brancheBestaetigtMonat}
            onChange={(event) => setBrancheBestaetigtMonat(event.target.checked)}
          />
          Branche bestätigt auf Monatssicht
        </label>

        <h2>Exklusionskriterien (K.O.)</h2>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={wachsendeKorrekturen}
            onChange={(event) => setWachsendeKorrekturen(event.target.checked)}
          />
          Wachsende Korrekturen (Tiefpunkte steigen nicht mit)
        </label>
        <label className="watchlist-checkbox">
          <input
            type="checkbox"
            checked={volumenWarnsignal}
            onChange={(event) => setVolumenWarnsignal(event.target.checked)}
          />
          Volumen-Warnsignal
        </label>

        <h2>Setup-Checkliste</h2>
        <label>
          Setup-Typ
          <select value={setupTyp} onChange={(event) => handleSetupTypChange(event.target.value as ScreeningSetupTyp)}>
            {SETUP_TYPEN.map((typ) => (
              <option key={typ} value={typ}>
                {SETUP_LABELS[typ]}
              </option>
            ))}
          </select>
        </label>
        <div className="watchlist-setup-kriterien">
          {SETUP_KRITERIEN[setupTyp].map((kriterium) => (
            <label key={kriterium.id} className="watchlist-checkbox">
              <input
                type="checkbox"
                checked={Boolean(setupKriterien[kriterium.id])}
                onChange={() => toggleSetupKriterium(kriterium.id)}
              />
              {kriterium.label}
            </label>
          ))}
        </div>

        <label>
          Freitext
          <input type="text" value={freitext} onChange={(event) => setFreitext(event.target.value)} />
        </label>

        <button type="submit">Speichern</button>
      </form>
    </div>
  );
}
