export type Tab = 'rechner' | 'verlauf' | 'profil' | 'plan' | 'watchlist';

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'rechner', label: 'Rechner' },
  { id: 'verlauf', label: 'Verlauf' },
  { id: 'profil', label: 'Profil' },
  { id: 'plan', label: 'Plan' },
  { id: 'watchlist', label: 'Watch' },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={
            tab.id === active ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'
          }
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
