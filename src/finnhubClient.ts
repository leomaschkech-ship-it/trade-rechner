export interface Schlagzeile {
  zeitpunkt: Date;
  titel: string;
  quelle: string;
  url: string;
}

export class FinnhubError extends Error {}

interface FinnhubNewsEintrag {
  datetime: number; // Unix-Sekunden
  headline: string;
  source: string;
  url: string;
}

export async function ladeSchlagzeilen(symbol: string, von: string, bis: string, apiKey: string): Promise<Schlagzeile[]> {
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(von)}&to=${encodeURIComponent(bis)}&token=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (response.status === 401) {
    throw new FinnhubError('Finnhub-API-Key ungültig.');
  }
  if (response.status === 429) {
    throw new FinnhubError('Finnhub-Rate-Limit erreicht.');
  }
  if (!response.ok) {
    throw new FinnhubError(`Fehler beim Laden der Schlagzeilen: HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new FinnhubError('Unerwartete Antwort von Finnhub.');
  }

  const gesehen = new Set<string>();

  return (data as Partial<FinnhubNewsEintrag>[])
    .filter(
      (eintrag): eintrag is Partial<FinnhubNewsEintrag> & { datetime: number; headline: string; url: string } =>
        typeof eintrag.datetime === 'number' &&
        Number.isFinite(eintrag.datetime) &&
        typeof eintrag.headline === 'string' &&
        eintrag.headline.trim() !== '' &&
        typeof eintrag.url === 'string' &&
        /^https?:\/\//.test(eintrag.url),
    )
    .filter((eintrag) => {
      if (gesehen.has(eintrag.url)) {
        return false;
      }
      gesehen.add(eintrag.url);
      return true;
    })
    .map((eintrag) => ({
      zeitpunkt: new Date(eintrag.datetime * 1000),
      titel: eintrag.headline,
      quelle: typeof eintrag.source === 'string' ? eintrag.source : '',
      url: eintrag.url,
    }))
    .sort((a, b) => b.zeitpunkt.getTime() - a.zeitpunkt.getTime());
}
