import { calculateScreeningScore } from '../screening';
import { SETUP_LABELS } from '../screeningSetups';
import type { TradeStore } from '../hooks/useTradeStore';
import { IndexScanner } from './IndexScanner';

export function WatchlistView({ store }: { store: TradeStore }) {
  function handleClearAll() {
    if (store.screenings.length === 0) return;
    if (window.confirm('Wirklich alle gespeicherten Watchlist-Einträge löschen?')) {
      store.clearScreenings();
    }
  }

  return (
    <div className="watchlist-view">
      <h1>Watchlist</h1>

      <IndexScanner store={store} />

      <h2>Meine Watchlist</h2>
      {store.screenings.length === 0 && <p>Noch keine Kandidaten gespeichert.</p>}
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
    </div>
  );
}
