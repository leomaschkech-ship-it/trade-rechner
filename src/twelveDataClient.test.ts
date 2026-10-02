import { describe, expect, it } from 'vitest';
import { parseKursAntwort } from './twelveDataClient';

describe('parseKursAntwort', () => {
  it('liest die Antwort für ein einzelnes Kürzel', () => {
    expect(parseKursAntwort(['NU'], { price: '13.45' })).toEqual({ NU: 13.45 });
  });

  it('liest die Antwort für mehrere Kürzel', () => {
    expect(parseKursAntwort(['NU', 'AAPL'], { NU: { price: '13.45' }, AAPL: { price: '330.47' } })).toEqual({
      NU: 13.45,
      AAPL: 330.47,
    });
  });

  it('lässt Kürzel mit Fehler oder ungültigem Kurs weg', () => {
    expect(
      parseKursAntwort(['NU', 'SAP', 'XYZ'], {
        NU: { price: '13.45' },
        SAP: { code: 404, message: 'not found', status: 'error' },
        XYZ: { price: 'abc' },
      }),
    ).toEqual({ NU: 13.45 });
  });

  it('liefert ein leeres Ergebnis bei unerwarteter Antwort', () => {
    expect(parseKursAntwort(['NU'], null)).toEqual({});
    expect(parseKursAntwort(['NU'], { status: 'error', message: 'x' })).toEqual({});
  });
});
