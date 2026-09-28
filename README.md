# Trade-Rechner

Positionsgrößen-Rechner, Trading-Journal, Handelsplan und Watchlist als installierbare PWA. Kein Backend — alle Daten bleiben nur im `localStorage` des Geräts, auf dem die App läuft.

Live: https://leomaschkech-ship-it.github.io/trade-rechner/

## Entwicklung

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
npm run typecheck
```

## Index-Scanner (Watchlist)

Die Watchlist bewertet alle Aktien eines Index automatisch nach den Watchlist-Kriterien.
Die Kursdaten lädt der GitHub-Workflow Mo–Fr nach US-Börsenschluss von Yahoo Finance
(`scripts/fetch-market-data.ts`) und legt sie unter `data/` neben die App. Manuell
starten: Actions → „Deploy to GitHub Pages" → „Run workflow".

- Index-Zusammensetzung: `src/scanner/indices.ts` (DAX, MDAX, TecDAX, Nasdaq 100 von Hand gepflegt, S&P 500 automatisch)
- Regeln: `src/scanner/regeln.ts`, Zusammenführung: `src/scanner/scan.ts`
- Lokal Daten laden: `npx tsx scripts/fetch-market-data.ts`
