import { useState } from 'react';
import { berechneRisikoBisStop, calculateAbschluss } from '../journal';
import { ValidationError } from '../positionSize';
import { statusLabel } from '../tradeStatus';
import type { TradeStore } from '../hooks/useTradeStore';
import type { Calculation } from '../types';

export function VerlaufView({ store }: { store: TradeStore }) {
  const [closingId, setClosingId] = useState<string | null>(null);
  const [tatsaechlicherEinstieg, setTatsaechlicherEinstieg] = useState('');
  const [ausstiegPreis, setAusstiegPreis] = useState('');
  const [gebuehren, setGebuehren] = useState('0');
  const [freitext, setFreitext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [einstiegId, setEinstiegId] = useState<string | null>(null);
  const [einstiegKurs, setEinstiegKurs] = useState('');
  const [einstiegFehler, setEinstiegFehler] = useState<string | null>(null);

  function startEinstieg(calculation: Calculation) {
    setEinstiegId(calculation.id);
    setEinstiegKurs(String(calculation.einstiegGepuffert));
    setEinstiegFehler(null);
  }

  function confirmEinstieg(calculation: Calculation) {
    const kurs = Number(einstiegKurs);
    if (!(kurs > 0)) {
      setEinstiegFehler('Einstiegskurs muss positiv sein.');
      return;
    }
    store.updateCalculation(calculation.id, { status: 'offen', tatsaechlicherEinstieg: kurs });
    setEinstiegId(null);
    setEinstiegFehler(null);
  }

  function handleClearAll() {
    if (store.calculations.length === 0) return;
    if (window.confirm('Wirklich alle gespeicherten Berechnungen löschen?')) {
      store.clearCalculations();
    }
  }

  function startClosing(calculation: Calculation) {
    setClosingId(calculation.id);
    setTatsaechlicherEinstieg(String(calculation.tatsaechlicherEinstieg ?? calculation.einstiegGepuffert));
    setAusstiegPreis('');
    setGebuehren('0');
    setFreitext('');
    setError(null);
  }

  function cancelClosing() {
    setClosingId(null);
    setError(null);
  }

  function confirmClosing(calculation: Calculation) {
    try {
      const ergebnis = calculateAbschluss({
        richtung: calculation.richtung,
        einstiegGepuffert: Number(tatsaechlicherEinstieg),
        positionsgroesse: calculation.positionsgroesse,
        tatsaechlichesRisiko: calculation.tatsaechlichesRisiko,
        depotgroesse: calculation.depotgroesse,
        ausstiegPreis: Number(ausstiegPreis),
        gebuehren: Number(gebuehren),
      });
      store.updateCalculation(calculation.id, {
        status: 'geschlossen',
        tatsaechlicherEinstieg: Number(tatsaechlicherEinstieg),
        ausstiegPreis: Number(ausstiegPreis),
        gebuehren: Number(gebuehren),
        freitext: freitext || undefined,
        plEuro: ergebnis.plEuro,
        plProzent: ergebnis.plProzent,
        crv: ergebnis.crv,
      });
      setClosingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Unbekannter Fehler bei der Berechnung.');
    }
  }

  return (
    <div className="verlauf-view">
      <h1>Verlauf</h1>
      {store.calculations.length === 0 && <p>Noch keine Berechnungen gespeichert.</p>}
      <ul className="calc-list">
        {store.calculations.map((calculation) => (
          <li key={calculation.id} className="calc-list__item">
            <div className="calc-list__header">
              <strong>{calculation.symbol ?? '—'}</strong>
              <span>{new Date(calculation.timestamp).toLocaleString('de-DE')}</span>
              <span className={`calc-list__richtung calc-list__richtung--${calculation.richtung}`}>
                {calculation.richtung === 'long' ? 'Long' : 'Short'}
              </span>
              <span className="watchlist-list__badge">{statusLabel(calculation.status)}</span>
            </div>
            <div className="calc-list__body">
              <span>Einstieg (Stop-Buy)</span>
              <strong>{calculation.einstiegGepuffert.toFixed(3)}</strong>
            </div>
            {calculation.status === 'offen' && calculation.tatsaechlicherEinstieg !== undefined && (
              <>
                <div className="calc-list__body">
                  <span>Einstieg (tatsächlich)</span>
                  <strong>{calculation.tatsaechlicherEinstieg.toFixed(3)}</strong>
                </div>
                <div className="calc-list__body">
                  <span>Risiko bis Stop</span>
                  <strong>
                    {berechneRisikoBisStop(
                      calculation.richtung,
                      calculation.tatsaechlicherEinstieg,
                      calculation.stopGepuffert,
                      calculation.positionsgroesse,
                    ).toFixed(2)}{' '}
                    {store.profile.waehrung} (geplant {calculation.tatsaechlichesRisiko.toFixed(2)} {store.profile.waehrung})
                  </strong>
                </div>
              </>
            )}
            {calculation.einstiegLimit > 0 && (
              <div className="calc-list__body">
                <span>Limit</span>
                <strong>{calculation.einstiegLimit.toFixed(3)}</strong>
              </div>
            )}
            <div className="calc-list__body">
              <span>Stop-Loss</span>
              <strong>{calculation.stopGepuffert.toFixed(3)}</strong>
            </div>
            <div className="calc-list__body">
              <span>Stück</span>
              <strong>{calculation.positionsgroesse}</strong>
            </div>
            <p className="calc-list__freitext">
              eingegeben: Einstieg {calculation.einstiegRoh} → Stop {calculation.stopRoh}
            </p>

            {calculation.status === 'geschlossen' && (
              <div className="calc-list__abschluss">
                <div className="calc-list__body">
                  <span>Einstieg (tatsächlich)</span>
                  <strong>{(calculation.tatsaechlicherEinstieg ?? calculation.einstiegGepuffert).toFixed(3)}</strong>
                </div>
                <div className="calc-list__body">
                  <span>P/L</span>
                  <strong className={calculation.plEuro! >= 0 ? 'calc-list__pl--positiv' : 'calc-list__pl--negativ'}>
                    {calculation.plEuro!.toFixed(2)} {store.profile.waehrung} ({calculation.plProzent!.toFixed(2)} %)
                  </strong>
                </div>
                <div className="calc-list__body">
                  <span>CRV</span>
                  <strong>{calculation.crv!.toFixed(2)} R</strong>
                </div>
                {calculation.freitext && <p className="calc-list__freitext">{calculation.freitext}</p>}
              </div>
            )}

            {calculation.status === 'offen' && closingId === calculation.id && (
              <div className="calc-form calc-list__abschluss-form">
                <label>
                  Tatsächlicher Einstieg
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={tatsaechlicherEinstieg}
                    onChange={(event) => setTatsaechlicherEinstieg(event.target.value)}
                  />
                </label>
                <label>
                  Ausstiegspreis
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={ausstiegPreis}
                    onChange={(event) => setAusstiegPreis(event.target.value)}
                  />
                </label>
                <label>
                  Gebühren
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={gebuehren}
                    onChange={(event) => setGebuehren(event.target.value)}
                  />
                </label>
                <label>
                  Freitext
                  <input type="text" value={freitext} onChange={(event) => setFreitext(event.target.value)} />
                </label>
                {error && <p className="calc-form__error">{error}</p>}
                <div className="calc-list__abschluss-actions">
                  <button type="button" onClick={() => confirmClosing(calculation)}>
                    Bestätigen
                  </button>
                  <button type="button" onClick={cancelClosing}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {calculation.status === 'geplant' && einstiegId === calculation.id && (
              <div className="calc-form calc-list__abschluss-form">
                <label>
                  Zu welchem Kurs bist du eingestiegen?
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={einstiegKurs}
                    onChange={(event) => setEinstiegKurs(event.target.value)}
                  />
                </label>
                {einstiegFehler && <p className="calc-form__error">{einstiegFehler}</p>}
                <div className="calc-list__abschluss-actions">
                  <button type="button" onClick={() => confirmEinstieg(calculation)}>
                    Bestätigen
                  </button>
                  <button type="button" onClick={() => setEinstiegId(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            <div className="calc-list__actions">
              {calculation.status === 'geplant' && einstiegId !== calculation.id && (
                <>
                  <button type="button" onClick={() => startEinstieg(calculation)}>
                    Eingestiegen
                  </button>
                  <button type="button" onClick={() => store.updateCalculation(calculation.id, { status: 'verworfen' })}>
                    Verworfen
                  </button>
                </>
              )}
              {calculation.status === 'offen' && closingId !== calculation.id && (
                <button type="button" onClick={() => startClosing(calculation)}>
                  Trade abschließen
                </button>
              )}
              <button type="button" onClick={() => store.removeCalculation(calculation.id)}>
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
      {store.calculations.length > 0 && (
        <button type="button" className="calc-list__clear" onClick={handleClearAll}>
          Alle löschen
        </button>
      )}
    </div>
  );
}
