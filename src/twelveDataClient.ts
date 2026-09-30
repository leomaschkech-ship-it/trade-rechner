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

export interface Minutenkerze {
  zeitpunkt: string; // 'YYYY-MM-DD HH:MM:SS', Börsenzeit
  volumen: number;
}

interface TwelveDataMinutenResponse {
  meta?: { exchange_timezone?: string };
  values?: { datetime: string; volume: string }[];
  status?: string;
  message?: string;
  code?: number;
}

const MINUTEN_AUSGABE_LAENGE = 5000; // Maximum von Twelve Data; 6 volle Handelstage = 2340 Zeilen, damit sind die 5 neuesten Tage vollständig

export async function ladeMinutenkerzen(symbol: string, apiKey: string): Promise<Minutenkerze[]> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1min&outputsize=${MINUTEN_AUSGABE_LAENGE}&apikey=${encodeURIComponent(apiKey)}`;
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

  const data = (await response.json()) as TwelveDataMinutenResponse;

  if (data.status === 'error') {
    throw new TwelveDataError(`Twelve Data meldet einen Fehler für ${symbol}: ${data.message ?? 'unbekannt'}.`, data.code);
  }
  const zeitzone = data.meta?.exchange_timezone;
  if (zeitzone !== undefined && zeitzone !== 'America/New_York') {
    throw new TwelveDataError(`Liquiditätsprüfung nur für US-Aktien möglich (${symbol}: ${zeitzone}).`);
  }
  if (!data.values || data.values.length === 0) {
    throw new TwelveDataError(`Keine Minutenkerzen für ${symbol} erhalten.`);
  }

  return data.values
    .map((eintrag) => {
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(eintrag.datetime)) {
        throw new TwelveDataError(`Ungültiger Zeitstempel für ${symbol}: ${eintrag.datetime}.`);
      }
      const volumen = Number(eintrag.volume);
      if (!Number.isFinite(volumen) || volumen < 0) {
        throw new TwelveDataError(`Ungültiges Volumen für ${symbol} am ${eintrag.datetime}.`);
      }
      return { zeitpunkt: eintrag.datetime, volumen };
    })
    .reverse();
}
