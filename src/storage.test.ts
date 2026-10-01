import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadCalculations,
  loadHandelsplan,
  loadNewsScreenings,
  loadProfile,
  loadScreenings,
  saveCalculations,
  saveHandelsplan,
  saveNewsScreenings,
  saveProfile,
  saveScreenings,
} from './storage';
import type { Calculation, Handelsplan, NewsScreeningEintrag, Profile, ScreeningEintrag } from './types';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

describe('loadProfile', () => {
  it('gibt Default-Profil zurück, wenn nichts gespeichert ist', () => {
    expect(loadProfile()).toEqual({ depotgroesse: 0, standardRisikoProzent: 1, standardLimitPuffer: 0.3, waehrung: '€', twelveDataApiKey: '', finnhubApiKey: '' });
  });

  it('speichert und lädt ein Profil unverändert', () => {
    const profile: Profile = { depotgroesse: 10000, standardRisikoProzent: 1, standardLimitPuffer: 0.3, waehrung: '€', twelveDataApiKey: '', finnhubApiKey: '' };
    saveProfile(profile);
    expect(loadProfile()).toEqual(profile);
  });

  it('ergänzt fehlende Felder eines gespeicherten Profils mit Defaults', () => {
    localStorage.setItem('trade-rechner:profile', JSON.stringify({ depotgroesse: 5000 }));
    expect(loadProfile()).toEqual({ depotgroesse: 5000, standardRisikoProzent: 1, standardLimitPuffer: 0.3, waehrung: '€', twelveDataApiKey: '', finnhubApiKey: '' });
  });

  it('gibt Default-Profil zurück bei kaputtem JSON', () => {
    localStorage.setItem('trade-rechner:profile', '{not valid json');
    expect(loadProfile()).toEqual({ depotgroesse: 0, standardRisikoProzent: 1, standardLimitPuffer: 0.3, waehrung: '€', twelveDataApiKey: '', finnhubApiKey: '' });
  });
});

describe('loadCalculations', () => {
  it('gibt leeres Array zurück, wenn nichts gespeichert ist', () => {
    expect(loadCalculations()).toEqual([]);
  });

  it('speichert und lädt Berechnungen unverändert', () => {
    const calculations: Calculation[] = [
      {
        id: '1',
        timestamp: '2026-08-18T10:00:00.000Z',
        richtung: 'long',
        depotgroesse: 10000,
        risikoProzent: 1,
        einstiegRoh: 100,
        stopRoh: 95,
        einstiegGepuffert: 100.1,
        stopGepuffert: 94.905,
        positionsgroesse: 19,
        tatsaechlichesRisiko: 98.705,
        limitPufferProzent: 0.3,
        einstiegLimit: 100.4003,
        status: 'offen',
      },
    ];
    saveCalculations(calculations);
    expect(loadCalculations()).toEqual(calculations);
  });

  it('gibt leeres Array zurück bei kaputtem JSON', () => {
    localStorage.setItem('trade-rechner:calculations', '{not valid json');
    expect(loadCalculations()).toEqual([]);
  });

  it('ergänzt fehlende Felder eines Legacy-Eintrags ohne limitPufferProzent/einstiegLimit mit Defaults', () => {
    const legacyEntry = {
      id: '1',
      timestamp: '2026-08-18T10:00:00.000Z',
      richtung: 'long',
      depotgroesse: 10000,
      risikoProzent: 1,
      einstiegRoh: 100,
      stopRoh: 95,
      einstiegGepuffert: 100.1,
      stopGepuffert: 94.905,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
    };
    localStorage.setItem('trade-rechner:calculations', JSON.stringify([legacyEntry]));
    expect(loadCalculations()).toEqual([
      { ...legacyEntry, limitPufferProzent: 0, einstiegLimit: 0, status: 'offen' },
    ]);
  });

  it('ergänzt fehlende status bei Legacy-Eintrag ohne status mit Default "offen"', () => {
    const legacyEntry = {
      id: '1',
      timestamp: '2026-08-18T10:00:00.000Z',
      richtung: 'long',
      depotgroesse: 10000,
      risikoProzent: 1,
      einstiegRoh: 100,
      stopRoh: 95,
      einstiegGepuffert: 100.1,
      stopGepuffert: 94.905,
      positionsgroesse: 19,
      tatsaechlichesRisiko: 98.705,
      limitPufferProzent: 0.3,
      einstiegLimit: 100.4003,
    };
    localStorage.setItem('trade-rechner:calculations', JSON.stringify([legacyEntry]));
    expect(loadCalculations()).toEqual([{ ...legacyEntry, status: 'offen' }]);
  });

  it('speichert und lädt eine geplante Berechnung mit Kürzel unverändert', () => {
    const calculations: Calculation[] = [
      {
        id: '2',
        timestamp: '2026-10-01T10:00:00.000Z',
        richtung: 'long',
        depotgroesse: 56000,
        risikoProzent: 0.5,
        einstiegRoh: 100,
        stopRoh: 95,
        einstiegGepuffert: 100.1,
        stopGepuffert: 94.905,
        positionsgroesse: 53,
        tatsaechlichesRisiko: 275.335,
        limitPufferProzent: 0.3,
        einstiegLimit: 100.4003,
        status: 'geplant',
        symbol: 'NU',
      },
      {
        id: '3',
        timestamp: '2026-10-01T11:00:00.000Z',
        richtung: 'short',
        depotgroesse: 56000,
        risikoProzent: 0.5,
        einstiegRoh: 50,
        stopRoh: 52,
        einstiegGepuffert: 49.95,
        stopGepuffert: 52.052,
        positionsgroesse: 133,
        tatsaechlichesRisiko: 279.666,
        limitPufferProzent: 0.3,
        einstiegLimit: 49.80015,
        status: 'verworfen',
        symbol: 'XYZ',
      },
    ];
    saveCalculations(calculations);
    expect(loadCalculations()).toEqual(calculations);
  });

  it('lässt das Kürzel bei Legacy-Einträgen weg', () => {
    localStorage.setItem(
      'trade-rechner:calculations',
      JSON.stringify([
        {
          id: '1',
          timestamp: '2026-08-18T10:00:00.000Z',
          richtung: 'long',
          depotgroesse: 10000,
          risikoProzent: 1,
          einstiegRoh: 100,
          stopRoh: 95,
          einstiegGepuffert: 100.1,
          stopGepuffert: 94.905,
          positionsgroesse: 19,
          tatsaechlichesRisiko: 98.705,
        },
      ]),
    );
    const [geladen] = loadCalculations();
    expect(geladen.symbol).toBeUndefined();
    expect(geladen.status).toBe('offen');
  });
});

describe('loadHandelsplan', () => {
  const DEFAULT_HANDELSPLAN: Handelsplan = {
    maerkteProdukte: '',
    indizesZeiteinheiten: '',
    handelszeiten: '',
    setups: [],
    tagesverlustLimitProzent: 0,
    wochenverlustLimitProzent: 0,
    maxParalleleTrades: 0,
    exitStrategie: 'komplett-laufen-lassen',
    ziele: '',
    staerkenSchwaechen: '',
    routineTools: '',
    mentaleStaerke: '',
  };

  it('gibt Default-Handelsplan zurück, wenn nichts gespeichert ist', () => {
    expect(loadHandelsplan()).toEqual(DEFAULT_HANDELSPLAN);
  });

  it('speichert und lädt einen Handelsplan unverändert', () => {
    const handelsplan: Handelsplan = {
      maerkteProdukte: 'Aktien, Nasdaq 100',
      indizesZeiteinheiten: 'Tageschart, Stundenchart',
      handelszeiten: '9-17:30 Uhr',
      setups: ['trick-des-traders', '52-wochenhoch'],
      tagesverlustLimitProzent: 3,
      wochenverlustLimitProzent: 6,
      maxParalleleTrades: 4,
      exitStrategie: 'teilgewinne',
      teilgewinnCrvStufe: 2,
      ziele: '1% pro Woche',
      staerkenSchwaechen: 'FOMO bei starken Aktien',
      routineTools: 'TradingView, Morgenroutine',
      mentaleStaerke: 'Sport nach Verlustserien',
    };
    saveHandelsplan(handelsplan);
    expect(loadHandelsplan()).toEqual(handelsplan);
  });

  it('ergänzt fehlende Felder eines gespeicherten Handelsplans mit Defaults', () => {
    localStorage.setItem('trade-rechner:handelsplan', JSON.stringify({ maerkteProdukte: 'Aktien' }));
    expect(loadHandelsplan()).toEqual({ ...DEFAULT_HANDELSPLAN, maerkteProdukte: 'Aktien' });
  });

  it('gibt Default-Handelsplan zurück bei kaputtem JSON', () => {
    localStorage.setItem('trade-rechner:handelsplan', '{not valid json');
    expect(loadHandelsplan()).toEqual(DEFAULT_HANDELSPLAN);
  });

  it('entfernt teilgewinnCrvStufe, wenn ein späterer Speichervorgang ihn nicht mehr setzt', () => {
    saveHandelsplan({ ...DEFAULT_HANDELSPLAN, exitStrategie: 'teilgewinne', teilgewinnCrvStufe: 2 });
    saveHandelsplan({ ...DEFAULT_HANDELSPLAN, exitStrategie: 'komplett-laufen-lassen', teilgewinnCrvStufe: undefined });
    expect(loadHandelsplan().teilgewinnCrvStufe).toBeUndefined();
  });
});

describe('loadScreenings', () => {
  it('gibt leeres Array zurück, wenn nichts gespeichert ist', () => {
    expect(loadScreenings()).toEqual([]);
  });

  it('speichert und lädt Screening-Einträge unverändert', () => {
    const screenings: ScreeningEintrag[] = [
      {
        id: '1',
        timestamp: '2026-08-20T10:00:00.000Z',
        aktie: 'Apple',
        symbol: 'AAPL',
        index: 'Nasdaq 100',
        branche: 'Technologie',
        richtung: 'long',
        kursBeiAufnahme: 190.5,
        marktphaseBestaetigt: true,
        relativeStaerkeErfuellt: true,
        naeheAn52WochenExtrem: true,
        retestQualitaet: 'gesund',
        brancheBestaetigtWoche: true,
        brancheBestaetigtMonat: true,
        wachsendeKorrekturen: false,
        volumenWarnsignal: false,
        setupTyp: 'long-ueber-p2',
        setupKriterien: {
          'index-phase3': true,
          'aktie-phase3': true,
          'korrektur-50': false,
          'min-3-kerzen': true,
          'trendstaerke': true,
          'fib-25': false,
        },
        freitext: 'Starker Kandidat',
      },
    ];
    saveScreenings(screenings);
    expect(loadScreenings()).toEqual(screenings);
  });

  it('gibt leeres Array zurück bei kaputtem JSON', () => {
    localStorage.setItem('trade-rechner:screenings', '{not valid json');
    expect(loadScreenings()).toEqual([]);
  });
});

describe('loadNewsScreenings', () => {
  const gueltig: NewsScreeningEintrag = {
    id: 'n1',
    symbol: 'AAPL',
    gapDatum: '2026-09-11',
    gap: {
      richtung: 'long',
      vortagDatum: '2026-09-10',
      vortagSchluss: 100,
      gapTagOpen: 108,
      gapProzent: 8,
      gapSchliessungProzent: 37.5,
      extremSeitGap: 105,
    },
    newsArt: 'gewinnwarnung',
    notiz: 'P2 beobachten',
    schlagzeilen: [{ zeitpunkt: '2026-09-11T12:00:00.000Z', titel: 'Titel', quelle: 'Reuters', url: 'https://example.com' }],
    gespeichertAm: '2026-09-29T10:00:00.000Z',
    zuletztGeprueftAm: '2026-09-29T10:00:00.000Z',
  };

  it('gibt leeres Array zurück, wenn nichts gespeichert ist', () => {
    expect(loadNewsScreenings()).toEqual([]);
  });

  it('speichert und lädt Einträge unverändert', () => {
    saveNewsScreenings([gueltig]);
    expect(loadNewsScreenings()).toEqual([gueltig]);
  });

  it('gibt leeres Array zurück bei kaputtem JSON', () => {
    localStorage.setItem('trade-rechner:news-screenings', '{kaputt');
    expect(loadNewsScreenings()).toEqual([]);
  });

  it('gibt leeres Array zurück, wenn kein Array gespeichert ist', () => {
    localStorage.setItem('trade-rechner:news-screenings', JSON.stringify({ id: 'n1' }));
    expect(loadNewsScreenings()).toEqual([]);
  });

  it('verwirft ungültige Einträge und behält gültige', () => {
    localStorage.setItem(
      'trade-rechner:news-screenings',
      JSON.stringify([gueltig, { id: 'kaputt' }, { ...gueltig, id: 'n2', newsArt: 'unbekannt' }]),
    );
    expect(loadNewsScreenings()).toEqual([gueltig]);
  });

  it('verwirft ungültige Schlagzeilen innerhalb eines sonst gültigen Eintrags', () => {
    const validHeadline = gueltig.schlagzeilen[0];
    localStorage.setItem(
      'trade-rechner:news-screenings',
      JSON.stringify([{ ...gueltig, schlagzeilen: [validHeadline, null, { titel: 1 }] }]),
    );
    expect(loadNewsScreenings()).toEqual([{ ...gueltig, schlagzeilen: [validHeadline] }]);
  });
});
