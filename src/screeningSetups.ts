import type { ScreeningSetupTyp } from './types';

export interface SetupKriterium {
  id: string;
  label: string;
}

export const SETUP_LABELS: Record<ScreeningSetupTyp, string> = {
  'long-ueber-p2': 'Long über P2',
  'short-unter-p2': 'Short unter P2',
  '52-wochenhoch': '52-Wochenhoch',
  'bewegungshandel': 'Bewegungshandel',
};

export const SETUP_KRITERIEN: Record<ScreeningSetupTyp, SetupKriterium[]> = {
  'long-ueber-p2': [
    { id: 'index-phase3', label: 'Aktie aus starkem Index (Index in Phase 3)' },
    { id: 'aktie-phase3', label: 'Aufwärtstrend und Phase 3 im Tageschart der Aktie' },
    { id: 'korrektur-50', label: 'Korrektur ≥ 50% der letzten Bewegung' },
    { id: 'min-3-kerzen', label: 'Mindestens 3 Korrekturkerzen vor Ausbruch' },
    { id: 'trendstaerke', label: 'Trendstärke der Aktie stärker als der Index' },
    { id: 'fib-25', label: 'Korrektur erreicht mind. 0,25-Fibonacci-Level' },
  ],
  'short-unter-p2': [
    { id: 'index-phase6', label: 'Aktie aus schwächstem Index (Index in Phase 6)' },
    { id: 'aktie-phase6', label: 'Abwärtstrend und Phase 6 im Tageschart der Aktie' },
    { id: 'korrektur-50', label: 'Korrektur ≥ 50% der letzten Bewegung' },
    { id: 'min-3-kerzen', label: 'Mindestens 3 Korrekturkerzen vor Ausbruch' },
    { id: 'trendstaerke', label: 'Trendstärke der Aktie schwächer als der Index' },
  ],
  '52-wochenhoch': [
    { id: 'staerkster-index', label: 'Aktie aus stärkstem Index' },
    { id: 'aktie-phase3', label: 'Aufwärtstrend und Phase 3 im Tageschart der Aktie' },
    { id: 'hoch-3-monate', label: '52-Wochenhoch liegt mind. 3 Monate zurück' },
    { id: 'korrektur-vor-ausbruch', label: 'Korrektur unmittelbar vor Ausbruch vorhanden' },
    { id: 'trendstaerke', label: 'Trendstärke der Aktie im Vergleich zum Index' },
  ],
  'bewegungshandel': [
    { id: 'staerkster-index', label: 'Aktie aus stärkstem Index' },
    { id: 'aktie-phase3', label: 'Aufwärtstrend und Phase 3 im Tageschart der Aktie' },
    { id: 'ausbruch-52wh-relevant', label: 'Ausbruch über P2 mit markttechnisch relevantem neuen 52-Wochenhoch' },
    { id: 'trendstaerke', label: 'Trendstärke der Aktie im Vergleich zum Index' },
  ],
};
