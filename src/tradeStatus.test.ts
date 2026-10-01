import { describe, expect, it } from 'vitest';
import { statusLabel } from './tradeStatus';

describe('statusLabel', () => {
  it('liefert deutsche Labels für alle Status', () => {
    expect(statusLabel('geplant')).toBe('Geplant');
    expect(statusLabel('offen')).toBe('Offen');
    expect(statusLabel('geschlossen')).toBe('Geschlossen');
    expect(statusLabel('verworfen')).toBe('Verworfen');
  });
});
