import { useState } from 'react';
import type { TradeStore } from '../hooks/useTradeStore';
import {
  type LiquiditaetsAnalyse,
  MAX_GAP_SCHLIESSUNG_PROZENT,
  MAX_MINUTEN_OHNE_VOLUMEN,
  MIN_GAP_PROZENT,
  NEWS_ARTEN,
  analysiereGap,
  analysiereLiquiditaet,
  beurteileNewsTrade,
  verschiebeDatum,
} from '../newsScreening';
import { ladeMinutenkerzen, ladeTageskerzen } from '../twelveDataClient';
import type { NewsScreeningEintrag } from '../types';

function formatZeitpunkt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function newsArtLabel(eintrag: NewsScreeningEintrag): string {
  return NEWS_ARTEN.find((art) => art.id === eintrag.newsArt)?.label ?? eintrag.newsArt;
}

export function NewsScreeningListe({ store }: { store: TradeStore }) {
  const [pruefendIds, setPruefendIds] = useState<string[]>([]);
  const [fehlerProId, setFehlerProId] = useState<Record<string, string>>({});
  const [bearbeiteteNotiz, setBearbeiteteNotiz] = useState<{ id: string; text: string } | null>(null);

  if (store.newsScreenings.length === 0) return null;

  function setzeFehler(id: string, meldung: string | null) {
    setFehlerProId((prev) => {
      const naechste = { ...prev };
      if (meldung === null) delete naechste[id];
      else naechste[id] = meldung;
      return naechste;
    });
  }

  async function handleNeuPruefen(eintrag: NewsScreeningEintrag) {
    const apiKey = store.profile.twelveDataApiKey;
    if (apiKey === '') {
      setzeFehler(eintrag.id, 'Twelve-Data-API-Key im Profil hinterlegen, um neu prüfen zu können.');
      return;
    }
    setPruefendIds((prev) => [...prev, eintrag.id]);
    setzeFehler(eintrag.id, null);
    try {
      const kerzen = await ladeTageskerzen(eintrag.symbol, verschiebeDatum(eintrag.gapDatum, -10), apiKey);
      const gap = analysiereGap(kerzen, eintrag.gapDatum);
      let liquiditaet: LiquiditaetsAnalyse | null = null;
      let liquiditaetsFehler: string | null = null;
      try {
        liquiditaet = analysiereLiquiditaet(await ladeMinutenkerzen(eintrag.symbol, apiKey));
      } catch (liquiditaetsError) {
        liquiditaetsFehler = `Liquidität konnte nicht geprüft werden: ${
          liquiditaetsError instanceof Error ? liquiditaetsError.message : 'Unbekannter Fehler.'
        }`;
      }
      store.updateNewsScreening(eintrag.id, { gap, liquiditaet, zuletztGeprueftAm: new Date().toISOString() });
      if (liquiditaetsFehler) setzeFehler(eintrag.id, liquiditaetsFehler);
    } catch (error) {
      setzeFehler(eintrag.id, error instanceof Error ? error.message : 'Unbekannter Fehler.');
    } finally {
      setPruefendIds((prev) => prev.filter((id) => id !== eintrag.id));
    }
  }

  function handleNotizUebernehmen() {
    if (!bearbeiteteNotiz) return;
    store.updateNewsScreening(bearbeiteteNotiz.id, { notiz: bearbeiteteNotiz.text.trim() });
    setBearbeiteteNotiz(null);
  }

  function handleLoeschen(eintrag: NewsScreeningEintrag) {
    if (!window.confirm(`${eintrag.symbol} · ${eintrag.gapDatum} wirklich löschen?`)) return;
    store.removeNewsScreening(eintrag.id);
    setzeFehler(eintrag.id, null);
  }

  return (
    <section className="news-screening-liste">
      <h2>Gespeichert</h2>
      <ul className="calc-list">
        {store.newsScreenings.map((eintrag) => {
          const urteil = beurteileNewsTrade(eintrag.gap, eintrag.newsArt, eintrag.liquiditaet ?? null);
          const pruefend = pruefendIds.includes(eintrag.id);
          const fehler = fehlerProId[eintrag.id];
          const bearbeitet = bearbeiteteNotiz?.id === eintrag.id;

          return (
            <li key={eintrag.id} className="calc-list__item">
              <div className="calc-list__header">
                <span>
                  {eintrag.symbol} · {eintrag.gapDatum}
                </span>
                <strong>{eintrag.gap.richtung === 'long' ? 'Gap-Up → Long' : 'Gap-Down → Short'}</strong>
              </div>
              <div className="watchlist-list__scores">
                <span className="watchlist-list__badge">
                  Gap {eintrag.gap.gapProzent.toFixed(1)} %: {eintrag.gap.gapProzent >= MIN_GAP_PROZENT ? '✅' : '❌'}
                </span>
                <span className="watchlist-list__badge">
                  Schließung {eintrag.gap.gapSchliessungProzent.toFixed(1)} %:{' '}
                  {eintrag.gap.gapSchliessungProzent <= MAX_GAP_SCHLIESSUNG_PROZENT ? '✅' : '❌'}
                </span>
                <span className="watchlist-list__badge">
                  {eintrag.liquiditaet
                    ? `Liquidität: max. ${eintrag.liquiditaet.maxMinutenOhneVolumen} Min. ohne Volumen: ${
                        eintrag.liquiditaet.maxMinutenOhneVolumen <= MAX_MINUTEN_OHNE_VOLUMEN ? '✅' : '❌'
                      }`
                    : 'Liquidität: nicht geprüft'}
                </span>
              </div>
              {eintrag.liquiditaet?.laengsteLueckeStart && (
                <p>
                  Längste Lücke ab {eintrag.liquiditaet.laengsteLueckeStart} – kann auch ein Handelsstopp sein, im
                  Minutenchart prüfen.
                </p>
              )}
              <p>News-Art: {newsArtLabel(eintrag)}</p>
              <p>
                Urteil:{' '}
                <strong className={urteil.handelbar ? 'calc-list__pl--positiv' : 'calc-list__pl--negativ'}>
                  {urteil.handelbar ? 'Handelbar' : 'Nicht handelbar'}
                </strong>
              </p>
              {urteil.gruende.length > 0 && (
                <ul>
                  {urteil.gruende.map((grund) => (
                    <li key={grund}>{grund}</li>
                  ))}
                </ul>
              )}
              <p>Zuletzt geprüft: {formatZeitpunkt(eintrag.zuletztGeprueftAm)}</p>

              {eintrag.schlagzeilen.length > 0 && (
                <ul>
                  {eintrag.schlagzeilen.map((zeile) => (
                    <li key={`${zeile.url}-${zeile.zeitpunkt}`}>
                      {formatZeitpunkt(zeile.zeitpunkt)} ·{' '}
                      <a href={zeile.url} target="_blank" rel="noopener noreferrer">
                        {zeile.titel}
                      </a>{' '}
                      ({zeile.quelle})
                    </li>
                  ))}
                </ul>
              )}

              {bearbeitet ? (
                <div className="calc-form">
                  <label>
                    Notiz
                    <textarea
                      value={bearbeiteteNotiz.text}
                      onChange={(event) => setBearbeiteteNotiz({ id: eintrag.id, text: event.target.value })}
                    />
                  </label>
                  <div className="calc-list__actions">
                    <button type="button" onClick={handleNotizUebernehmen}>
                      Übernehmen
                    </button>
                    <button type="button" onClick={() => setBearbeiteteNotiz(null)}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <p>Notiz: {eintrag.notiz !== '' ? eintrag.notiz : 'Keine Notiz'}</p>
              )}

              {fehler && <p className="calc-form__error">{fehler}</p>}

              <div className="calc-list__actions">
                <button type="button" onClick={() => handleNeuPruefen(eintrag)} disabled={pruefendIds.length > 0}>
                  {pruefend ? 'Prüfe …' : 'Neu prüfen'}
                </button>
                {!bearbeitet && (
                  <button type="button" onClick={() => setBearbeiteteNotiz({ id: eintrag.id, text: eintrag.notiz })}>
                    Notiz bearbeiten
                  </button>
                )}
                <button type="button" onClick={() => handleLoeschen(eintrag)}>
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
