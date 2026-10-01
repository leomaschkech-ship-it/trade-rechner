import { useState } from 'react';
import { calculateEinstiegslimit, calculatePositionSize, ValidationError, type PositionSizeResult } from '../positionSize';
import type { TradeStore } from '../hooks/useTradeStore';
import type { Richtung } from '../types';
import { ResultCard } from './ResultCard';

export function RechnerView({ store }: { store: TradeStore }) {
  const [richtung, setRichtung] = useState<Richtung>('long');
  const [symbolEingabe, setSymbolEingabe] = useState('');
  const symbol = symbolEingabe.trim().toUpperCase();
  const [depotgroesse, setDepotgroesse] = useState(String(store.profile.depotgroesse || ''));
  const [risikoProzent, setRisikoProzent] = useState(String(store.profile.standardRisikoProzent || ''));
  const [limitPuffer, setLimitPuffer] = useState(String(store.profile.standardLimitPuffer || ''));
  const [einstiegRoh, setEinstiegRoh] = useState('');
  const [stopRoh, setStopRoh] = useState('');
  const [savedMessage, setSavedMessage] = useState(false);

  let result: PositionSizeResult | null = null;
  let einstiegLimit: number | null = null;
  let error: string | null = null;

  const hasAllInputs =
    depotgroesse !== '' && risikoProzent !== '' && limitPuffer !== '' && einstiegRoh !== '' && stopRoh !== '';

  if (hasAllInputs) {
    try {
      result = calculatePositionSize({
        richtung,
        depotgroesse: Number(depotgroesse),
        risikoProzent: Number(risikoProzent),
        einstiegRoh: Number(einstiegRoh),
        stopRoh: Number(stopRoh),
      });
      einstiegLimit = calculateEinstiegslimit(result.einstiegGepuffert, richtung, Number(limitPuffer));
    } catch (err) {
      result = null;
      einstiegLimit = null;
      error = err instanceof ValidationError ? err.message : 'Unbekannter Fehler bei der Berechnung.';
    }
  }

  function handleSave() {
    if (!result || einstiegLimit === null || symbol === '') return;
    store.addCalculation({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      richtung,
      depotgroesse: Number(depotgroesse),
      risikoProzent: Number(risikoProzent),
      einstiegRoh: Number(einstiegRoh),
      stopRoh: Number(stopRoh),
      einstiegGepuffert: result.einstiegGepuffert,
      stopGepuffert: result.stopGepuffert,
      positionsgroesse: result.positionsgroesse,
      tatsaechlichesRisiko: result.tatsaechlichesRisiko,
      limitPufferProzent: Number(limitPuffer),
      einstiegLimit,
      status: 'geplant',
      symbol,
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  }

  return (
    <div className="rechner-view">
      <h1>Trade-Rechner</h1>

      <div className="richtung-toggle">
        <button
          type="button"
          className={richtung === 'long' ? 'richtung-toggle__btn richtung-toggle__btn--active-long' : 'richtung-toggle__btn'}
          onClick={() => setRichtung('long')}
        >
          Long
        </button>
        <button
          type="button"
          className={richtung === 'short' ? 'richtung-toggle__btn richtung-toggle__btn--active-short' : 'richtung-toggle__btn'}
          onClick={() => setRichtung('short')}
        >
          Short
        </button>
      </div>

      <form className="calc-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Kürzel
          <input
            type="text"
            placeholder="z.B. NU"
            value={symbolEingabe}
            onChange={(event) => setSymbolEingabe(event.target.value)}
          />
        </label>
        <label>
          Depotgröße ({store.profile.waehrung})
          <input
            type="number"
            min={0}
            step="any"
            value={depotgroesse}
            onChange={(event) => setDepotgroesse(event.target.value)}
          />
        </label>
        <label>
          Risiko (%)
          <input
            type="number"
            min={0}
            step="any"
            value={risikoProzent}
            onChange={(event) => setRisikoProzent(event.target.value)}
          />
        </label>
        <label>
          Limitpuffer (%)
          <input
            type="number"
            min={0}
            step="any"
            value={limitPuffer}
            onChange={(event) => setLimitPuffer(event.target.value)}
          />
        </label>
        <label>
          Einstiegskurs
          <input
            type="number"
            min={0}
            step="any"
            value={einstiegRoh}
            onChange={(event) => setEinstiegRoh(event.target.value)}
          />
        </label>
        <label>
          Stop-Loss
          <input
            type="number"
            min={0}
            step="any"
            value={stopRoh}
            onChange={(event) => setStopRoh(event.target.value)}
          />
        </label>
      </form>

      {error && <p className="calc-form__error">{error}</p>}
      {result && einstiegLimit !== null && (
        <ResultCard
          result={result}
          waehrung={store.profile.waehrung}
          depotgroesse={Number(depotgroesse)}
          einstiegLimit={einstiegLimit}
        />
      )}
      {result && symbol === '' && <p className="calc-form__error">Kürzel eingeben, um zu speichern.</p>}
      {result && (
        <button type="button" onClick={handleSave} disabled={symbol === ''}>
          Speichern
        </button>
      )}
      {savedMessage && <p className="calc-form__saved">Im Verlauf gespeichert.</p>}
    </div>
  );
}
