import type { TradeStatus } from './types';

const LABELS: Record<TradeStatus, string> = {
  geplant: 'Geplant',
  offen: 'Offen',
  geschlossen: 'Geschlossen',
  verworfen: 'Verworfen',
};

export function statusLabel(status: TradeStatus): string {
  return LABELS[status];
}
