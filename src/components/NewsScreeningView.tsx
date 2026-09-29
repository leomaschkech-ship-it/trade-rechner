import { type FormEvent, useState } from 'react';
import { type Schlagzeile, ladeSchlagzeilen } from '../finnhubClient';
import type { TradeStore } from '../hooks/useTradeStore';
import { NewsScreeningListe } from './NewsScreeningListe';
import {
  type GapAnalyse,
  MAX_GAP_SCHLIESSUNG_PROZENT,
  MIN_GAP_PROZENT,
  NEWS_ARTEN,
  type NewsArt,
  analysiereGap,
  beurteileNewsTrade,
  verschiebeDatum,
} from '../newsScreening';
import { ladeTageskerzen } from '../twelveDataClient';

function heuteLokal(): string {
  const jetzt = new Date();
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0');
  const tag = String(jetzt.getDate()).padStart(2, '0');
  return `${jetzt.getFullYear()}-${monat}-${tag}`;
}

interface Pruefergebnis {
  symbol: string;
  gapDatum: string;
  gap: GapAnalyse;
  geprueftAm: string; // ISO-8601
}

export function NewsScreeningView({ store }: { store: TradeStore }) {
  const [symbolEingabe, setSymbolEingabe] = useState('');
  const [gapDatum, setGapDatum] = useState('');
  const [pruefend, setPruefend] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Pruefergebnis | null>(null);
  const [schlagzeilen, setSchlagzeilen] = useState<Schlagzeile[] | null>(null);
  const [newsFehler, setNewsFehler] = useState<string | null>(null);
  const [newsArt, setNewsArt] = useState<NewsArt | ''>('');
  const [notiz, setNotiz] = useState('');
  const [gespeichertMeldung, setGespeichertMeldung] = useState(false);

  const { twelveDataApiKey, finnhubApiKey } = store.profile;
  const symbol = symbolEingabe.trim().toUpperCase();
  const kannPruefen = twelveDataApiKey !== '' && symbol !== '' && gapDatum !== '' && !pruefend;

  async function handlePruefen(event: FormEvent) {
    event.preventDefault();
    if (!kannPruefen) return;

    setPruefend(true);
    setFehler(null);
    setErgebnis(null);
    setSchlagzeilen(null);
    setNewsFehler(null);
    setNewsArt('');
    setNotiz('');
    setGespeichertMeldung(false);

    try {
      const kerzen = await ladeTageskerzen(symbol, verschiebeDatum(gapDatum, -10), twelveDataApiKey);
      const gap = analysiereGap(kerzen, gapDatum);
      setErgebnis({ symbol, gapDatum, gap, geprueftAm: new Date().toISOString() });

      if (finnhubApiKey !== '') {
        try {
          setSchlagzeilen(await ladeSchlagzeilen(symbol, gap.vortagDatum, gapDatum, finnhubApiKey));
        } catch (newsError) {
          setNewsFehler(newsError instanceof Error ? newsError.message : 'Schlagzeilen konnten nicht geladen werden.');
        }
      }
    } catch (error) {
      setFehler(`${symbol}: ${error instanceof Error ? error.message : 'Unbekannter Fehler.'}`);
    } finally {
      setPruefend(false);
    }
  }

  function handleSpeichern() {
    if (!ergebnis || newsArt === '') return;
    store.speichereNewsScreening({
      id: crypto.randomUUID(),
      symbol: ergebnis.symbol,
      gapDatum: ergebnis.gapDatum,
      gap: ergebnis.gap,
      newsArt,
      notiz: notiz.trim(),
      schlagzeilen: (schlagzeilen ?? []).map((zeile) => ({
        zeitpunkt: zeile.zeitpunkt.toISOString(),
        titel: zeile.titel,
        quelle: zeile.quelle,
        url: zeile.url,
      })),
      gespeichertAm: new Date().toISOString(),
      zuletztGeprueftAm: ergebnis.geprueftAm,
    });
    setGespeichertMeldung(true);
    setTimeout(() => setGespeichertMeldung(false), 2000);
  }

  const urteil = ergebnis ? beurteileNewsTrade(ergebnis.gap, newsArt === '' ? null : newsArt) : null;

  return (
    <div className="news-screening-view">
      <h1>News-Screening</h1>
      <form className="calc-form" onSubmit={handlePruefen}>
        <label>
          Kürzel
          <input
            type="text"
            placeholder="z.B. AAPL"
            value={symbolEingabe}
            onChange={(event) => setSymbolEingabe(event.target.value)}
          />
        </label>
        <label>
          Gap-Datum
          <input type="date" max={heuteLokal()} value={gapDatum} onChange={(event) => setGapDatum(event.target.value)} />
        </label>
        {twelveDataApiKey === '' && (
          <p className="calc-form__error">Twelve-Data-API-Key im Profil hinterlegen, um prüfen zu können.</p>
        )}
        <button type="submit" disabled={!kannPruefen}>
          {pruefend ? 'Prüfe …' : 'Prüfen'}
        </button>
      </form>

      {fehler && <p className="calc-form__error">{fehler}</p>}

      {ergebnis && urteil && (
        <ul className="calc-list">
          <li className="calc-list__item">
            <div className="calc-list__header">
              <span>
                {ergebnis.symbol} · {ergebnis.gapDatum}
              </span>
              <strong>{ergebnis.gap.richtung === 'long' ? 'Gap-Up → Long' : 'Gap-Down → Short'}</strong>
            </div>
            <p>
              Vortagesschluss {ergebnis.gap.vortagSchluss.toFixed(2)} ({ergebnis.gap.vortagDatum}) → Eröffnung{' '}
              {ergebnis.gap.gapTagOpen.toFixed(2)}
            </p>
            <div className="watchlist-list__scores">
              <span className="watchlist-list__badge">
                Gap {ergebnis.gap.gapProzent.toFixed(1)} % (≥ {MIN_GAP_PROZENT} %):{' '}
                {ergebnis.gap.gapProzent >= MIN_GAP_PROZENT ? '✅' : '❌'}
              </span>
              <span className="watchlist-list__badge">
                Gap-Schließung {ergebnis.gap.gapSchliessungProzent.toFixed(1)} % (≤ {MAX_GAP_SCHLIESSUNG_PROZENT} %):{' '}
                {ergebnis.gap.gapSchliessungProzent <= MAX_GAP_SCHLIESSUNG_PROZENT ? '✅' : '❌'}
              </span>
            </div>
            <p>Je weniger die Aktie ins Gap zurückläuft, desto interessanter für den Einstieg.</p>
          </li>

          <li className="calc-list__item">
            <div className="calc-list__header">
              <span>Schlagzeilen</span>
            </div>
            {finnhubApiKey === '' && <p>Finnhub-API-Key im Profil hinterlegen, um Schlagzeilen zu sehen.</p>}
            {newsFehler && <p className="calc-form__error">{newsFehler}</p>}
            {schlagzeilen && schlagzeilen.length === 0 && <p>Keine Schlagzeilen gefunden.</p>}
            {schlagzeilen && schlagzeilen.length > 0 && (
              <ul>
                {schlagzeilen.map((zeile) => (
                  <li key={`${zeile.url}-${zeile.zeitpunkt.getTime()}`}>
                    {zeile.zeitpunkt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    <a href={zeile.url} target="_blank" rel="noopener noreferrer">
                      {zeile.titel}
                    </a>{' '}
                    ({zeile.quelle})
                  </li>
                ))}
              </ul>
            )}
            <form className="calc-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                News-Art
                <select value={newsArt} onChange={(event) => setNewsArt(event.target.value as NewsArt | '')}>
                  <option value="">– bitte wählen –</option>
                  {NEWS_ARTEN.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notiz (optional)
                <textarea value={notiz} onChange={(event) => setNotiz(event.target.value)} />
              </label>
              <button type="button" onClick={handleSpeichern} disabled={newsArt === ''}>
                Speichern
              </button>
              {gespeichertMeldung && <p className="calc-form__saved">Gespeichert.</p>}
            </form>
          </li>

          <li className="calc-list__item">
            <div className="calc-list__header">
              <span>Urteil</span>
              <strong className={urteil.handelbar ? 'calc-list__pl--positiv' : 'calc-list__pl--negativ'}>
                {urteil.handelbar ? 'Handelbar' : 'Nicht handelbar'}
              </strong>
            </div>
            {urteil.gruende.length > 0 && (
              <ul>
                {urteil.gruende.map((grund) => (
                  <li key={grund}>{grund}</li>
                ))}
              </ul>
            )}
            <p>
              Einstieg nur über ein Setup: Ausbruch über P2 (Stunde/Tag), Trend-im-Trend, Umkehrkerze in der Korrektur,
              Bewegungshandel im Tageschart oder Trick des Traders (50 %-Level darf nicht im Gap-Bereich liegen).
            </p>
          </li>
        </ul>
      )}
      <NewsScreeningListe store={store} />
    </div>
  );
}
