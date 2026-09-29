export class TwelveDataError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface Tageskerze {
  datum: string; // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TwelveDataOhlcResponse {
  values?: { datetime: string; open: string; high: string; low: string; close: string }[];
  status?: string;
  message?: string;
  code?: number;
}

export async function ladeTageskerzen(symbol: string, startDatum: string, apiKey: string): Promise<Tageskerze[]> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${encodeURIComponent(startDatum)}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (response.status === 429) {
    throw new TwelveDataError(`Rate-Limit erreicht beim Abruf von ${symbol}.`, 429);
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const fehlerData = (await response.json()) as { message?: string };
      if (fehlerData.message) detail = fehlerData.message;
    } catch {
      // Antwort war kein JSON — Standardmeldung verwenden
    }
    throw new TwelveDataError(`Fehler beim Abruf von ${symbol}: ${detail}.`);
  }

  const data = (await response.json()) as TwelveDataOhlcResponse;

  if (data.status === 'error') {
    throw new TwelveDataError(`Twelve Data meldet einen Fehler für ${symbol}: ${data.message ?? 'unbekannt'}.`, data.code);
  }
  if (!data.values || data.values.length === 0) {
    throw new TwelveDataError(`Keine Kursdaten für ${symbol} erhalten.`);
  }

  return data.values
    .map((eintrag) => {
      const open = Number(eintrag.open);
      const high = Number(eintrag.high);
      const low = Number(eintrag.low);
      const close = Number(eintrag.close);
      if ([open, high, low, close].some((wert) => !Number.isFinite(wert) || wert <= 0)) {
        throw new TwelveDataError(`Ungültige Kursdaten für ${symbol} am ${eintrag.datetime}.`);
      }
      return { datum: eintrag.datetime.slice(0, 10), open, high, low, close };
    })
    .reverse();
}
