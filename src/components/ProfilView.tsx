import { type FormEvent, useState } from 'react';
import type { TradeStore } from '../hooks/useTradeStore';
import type { Waehrung } from '../types';

export function ProfilView({ store }: { store: TradeStore }) {
  const [depotgroesse, setDepotgroesse] = useState(String(store.profile.depotgroesse));
  const [standardRisikoProzent, setStandardRisikoProzent] = useState(String(store.profile.standardRisikoProzent));
  const [standardLimitPuffer, setStandardLimitPuffer] = useState(String(store.profile.standardLimitPuffer));
  const [waehrung, setWaehrung] = useState<Waehrung>(store.profile.waehrung);
  const [twelveDataApiKey, setTwelveDataApiKey] = useState(store.profile.twelveDataApiKey);
  const [finnhubApiKey, setFinnhubApiKey] = useState(store.profile.finnhubApiKey);
  const [savedMessage, setSavedMessage] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    store.updateProfile({
      depotgroesse: Number(depotgroesse) || 0,
      standardRisikoProzent: Number(standardRisikoProzent) || 0,
      standardLimitPuffer: Number(standardLimitPuffer) || 0,
      waehrung,
      twelveDataApiKey: twelveDataApiKey.trim(),
      finnhubApiKey: finnhubApiKey.trim(),
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  }

  return (
    <div className="profil-view">
      <h1>Profil</h1>
      <form className="calc-form" onSubmit={handleSubmit}>
        <label>
          Depotgröße
          <input
            type="number"
            min={0}
            step="any"
            value={depotgroesse}
            onChange={(event) => setDepotgroesse(event.target.value)}
          />
        </label>
        <label>
          Standard-Risiko (%)
          <input
            type="number"
            min={0}
            step="any"
            value={standardRisikoProzent}
            onChange={(event) => setStandardRisikoProzent(event.target.value)}
          />
        </label>
        <label>
          Standard-Limitpuffer (%)
          <input
            type="number"
            min={0}
            step="any"
            value={standardLimitPuffer}
            onChange={(event) => setStandardLimitPuffer(event.target.value)}
          />
        </label>
        <label>
          Währung
          <select value={waehrung} onChange={(event) => setWaehrung(event.target.value as Waehrung)}>
            <option value="€">€</option>
            <option value="$">$</option>
          </select>
        </label>

        <h2>News-Screening</h2>
        <label>
          Twelve-Data-API-Key
          <input
            type="password"
            autoComplete="off"
            value={twelveDataApiKey}
            onChange={(event) => setTwelveDataApiKey(event.target.value)}
          />
        </label>
        <label>
          Finnhub-API-Key
          <input
            type="password"
            autoComplete="off"
            value={finnhubApiKey}
            onChange={(event) => setFinnhubApiKey(event.target.value)}
          />
        </label>

        <button type="submit">Speichern</button>
      </form>
      {savedMessage && <p className="calc-form__saved">Profil gespeichert.</p>}
    </div>
  );
}
