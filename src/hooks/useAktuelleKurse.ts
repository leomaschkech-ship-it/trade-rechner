import { useEffect, useRef, useState } from 'react';
import { ladeAktuelleKurse } from '../twelveDataClient';
import type { Calculation } from '../types';

export interface AktuelleKurse {
  kurse: Record<string, number>;
  stand: Date | null;
  fehler: string | null;
  ohneApiKey: boolean;
}

// Lädt beim Öffnen der App einmal die aktuellen Kurse aller geplanten und offenen Trades (nur zur Übersicht, nicht gespeichert).
export function useAktuelleKurse(calculations: Calculation[], apiKey: string): AktuelleKurse {
  const [kurse, setKurse] = useState<Record<string, number>>({});
  const [stand, setStand] = useState<Date | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const geladen = useRef(false);

  const symbole = [
    ...new Set(
      calculations
        .filter((c) => (c.status === 'geplant' || c.status === 'offen') && c.symbol)
        .map((c) => c.symbol as string),
    ),
  ];

  useEffect(() => {
    if (geladen.current || apiKey === '' || symbole.length === 0) return;
    geladen.current = true;
    ladeAktuelleKurse(symbole, apiKey)
      .then((ergebnis) => {
        setKurse(ergebnis);
        setStand(new Date());
      })
      .catch((error: unknown) => {
        setFehler(error instanceof Error ? error.message : 'Unbekannter Fehler.');
      });
    // Absichtlich nur abhängig vom API-Key: Kurse werden je App-Start einmal geladen.
  }, [apiKey]);

  return { kurse, stand, fehler, ohneApiKey: apiKey === '' };
}
