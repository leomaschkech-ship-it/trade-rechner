import { type FormEvent, useState } from 'react';
import type { TradeStore } from '../hooks/useTradeStore';
import type { ExitStrategie, SetupTyp } from '../types';

const SETUP_OPTIONEN: { id: SetupTyp; label: string }[] = [
  { id: 'trick-des-traders', label: 'Trick des Traders' },
  { id: '52-wochenhoch', label: '52-Wochenhoch' },
  { id: 'breakaway-gap', label: 'Breakaway Gap' },
  { id: 'umkehrkerze', label: 'Umkehrkerze' },
  { id: 'news-trade', label: 'News-Trade' },
];

export function HandelsplanView({ store }: { store: TradeStore }) {
  const [maerkteProdukte, setMaerkteProdukte] = useState(store.handelsplan.maerkteProdukte);
  const [indizesZeiteinheiten, setIndizesZeiteinheiten] = useState(store.handelsplan.indizesZeiteinheiten);
  const [handelszeiten, setHandelszeiten] = useState(store.handelsplan.handelszeiten);
  const [setups, setSetups] = useState<SetupTyp[]>(store.handelsplan.setups);
  const [tagesverlustLimitProzent, setTagesverlustLimitProzent] = useState(
    String(store.handelsplan.tagesverlustLimitProzent),
  );
  const [wochenverlustLimitProzent, setWochenverlustLimitProzent] = useState(
    String(store.handelsplan.wochenverlustLimitProzent),
  );
  const [maxParalleleTrades, setMaxParalleleTrades] = useState(String(store.handelsplan.maxParalleleTrades));
  const [exitStrategie, setExitStrategie] = useState<ExitStrategie>(store.handelsplan.exitStrategie);
  const [teilgewinnCrvStufe, setTeilgewinnCrvStufe] = useState(
    store.handelsplan.teilgewinnCrvStufe !== undefined ? String(store.handelsplan.teilgewinnCrvStufe) : '',
  );
  const [ziele, setZiele] = useState(store.handelsplan.ziele);
  const [staerkenSchwaechen, setStaerkenSchwaechen] = useState(store.handelsplan.staerkenSchwaechen);
  const [routineTools, setRoutineTools] = useState(store.handelsplan.routineTools);
  const [mentaleStaerke, setMentaleStaerke] = useState(store.handelsplan.mentaleStaerke);
  const [savedMessage, setSavedMessage] = useState(false);

  function toggleSetup(id: SetupTyp) {
    setSetups((prev) => (prev.includes(id) ? prev.filter((setup) => setup !== id) : [...prev, id]));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    store.updateHandelsplan({
      maerkteProdukte,
      indizesZeiteinheiten,
      handelszeiten,
      setups,
      tagesverlustLimitProzent: Number(tagesverlustLimitProzent) || 0,
      wochenverlustLimitProzent: Number(wochenverlustLimitProzent) || 0,
      maxParalleleTrades: Number(maxParalleleTrades) || 0,
      exitStrategie,
      teilgewinnCrvStufe:
        exitStrategie === 'teilgewinne' && teilgewinnCrvStufe !== '' ? Number(teilgewinnCrvStufe) : undefined,
      ziele,
      staerkenSchwaechen,
      routineTools,
      mentaleStaerke,
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  }

  return (
    <div className="handelsplan-view">
      <h1>Handelsplan</h1>
      <form className="calc-form" onSubmit={handleSubmit}>
        <h2>Märkte &amp; Produkte</h2>
        <label>
          Welche Märkte und Produkte handelst du?
          <textarea value={maerkteProdukte} onChange={(event) => setMaerkteProdukte(event.target.value)} />
        </label>

        <h2>Indizes &amp; Zeiteinheiten</h2>
        <label>
          Welche Indizes/Zeiteinheiten nutzt du?
          <textarea value={indizesZeiteinheiten} onChange={(event) => setIndizesZeiteinheiten(event.target.value)} />
        </label>

        <h2>Handelszeiten &amp; Trade-Verwaltung</h2>
        <label>
          Handelszeiten, Screening-Zeitpunkte, Überwachungsrhythmus
          <textarea value={handelszeiten} onChange={(event) => setHandelszeiten(event.target.value)} />
        </label>

        <h2>Bevorzugte Setups</h2>
        <div className="handelsplan-setups">
          {SETUP_OPTIONEN.map((option) => (
            <label key={option.id} className="handelsplan-setups__item">
              <input type="checkbox" checked={setups.includes(option.id)} onChange={() => toggleSetup(option.id)} />
              {option.label}
            </label>
          ))}
        </div>

        <h2>Risiko- &amp; Money-Management</h2>
        <label>
          Tagesverlust-Limit (%)
          <input
            type="number"
            min={0}
            step="any"
            value={tagesverlustLimitProzent}
            onChange={(event) => setTagesverlustLimitProzent(event.target.value)}
          />
        </label>
        <label>
          Wochenverlust-Limit (%)
          <input
            type="number"
            min={0}
            step="any"
            value={wochenverlustLimitProzent}
            onChange={(event) => setWochenverlustLimitProzent(event.target.value)}
          />
        </label>
        <label>
          Max. parallele Trades
          <input
            type="number"
            min={0}
            step="1"
            value={maxParalleleTrades}
            onChange={(event) => setMaxParalleleTrades(event.target.value)}
          />
        </label>

        <h2>Exit-Strategie</h2>
        <label>
          Exit-Strategie
          <select value={exitStrategie} onChange={(event) => setExitStrategie(event.target.value as ExitStrategie)}>
            <option value="komplett-laufen-lassen">Komplett laufen lassen</option>
            <option value="teilgewinne">Teilgewinne</option>
          </select>
        </label>
        {exitStrategie === 'teilgewinne' && (
          <label>
            CRV-Stufe für Teilverkauf
            <input
              type="number"
              min={0}
              step="any"
              value={teilgewinnCrvStufe}
              onChange={(event) => setTeilgewinnCrvStufe(event.target.value)}
            />
          </label>
        )}

        <h2>Ziele &amp; Motivation</h2>
        <label>
          Kurz-, mittel-, langfristige Ziele
          <textarea value={ziele} onChange={(event) => setZiele(event.target.value)} />
        </label>

        <h2>Stärken &amp; Schwächen</h2>
        <label>
          Eigene emotionale Muster und Verhaltensregeln
          <textarea value={staerkenSchwaechen} onChange={(event) => setStaerkenSchwaechen(event.target.value)} />
        </label>

        <h2>Routine &amp; Tools</h2>
        <label>
          Morgenroutine, genutzte Software, Dokumentationsform
          <textarea value={routineTools} onChange={(event) => setRoutineTools(event.target.value)} />
        </label>

        <h2>Mentale Stärke &amp; Emotionen</h2>
        <label>
          Umgang mit Gewinnen/Verlusten, Rituale, Austausch
          <textarea value={mentaleStaerke} onChange={(event) => setMentaleStaerke(event.target.value)} />
        </label>

        <button type="submit">Speichern</button>
      </form>
      {savedMessage && <p className="calc-form__saved">Handelsplan gespeichert.</p>}
    </div>
  );
}
