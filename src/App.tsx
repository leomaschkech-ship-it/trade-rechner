import { useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { HandelsplanView } from './components/HandelsplanView';
import { NewsScreeningView } from './components/NewsScreeningView';
import { ProfilView } from './components/ProfilView';
import { RechnerView } from './components/RechnerView';
import { VerlaufView } from './components/VerlaufView';
import { WatchlistView } from './components/WatchlistView';
import { useAktuelleKurse } from './hooks/useAktuelleKurse';
import { useTradeStore } from './hooks/useTradeStore';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rechner');
  const store = useTradeStore();
  const aktuelleKurse = useAktuelleKurse(store.calculations, store.profile.twelveDataApiKey);

  return (
    <div className="app">
      <main className="app__content">
        {activeTab === 'rechner' && <RechnerView store={store} />}
        {activeTab === 'verlauf' && <VerlaufView store={store} aktuelleKurse={aktuelleKurse} />}
        {activeTab === 'profil' && <ProfilView store={store} />}
        {activeTab === 'plan' && <HandelsplanView store={store} />}
        {activeTab === 'watchlist' && <WatchlistView store={store} />}
        {activeTab === 'news' && <NewsScreeningView store={store} />}
      </main>
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
