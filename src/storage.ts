import { STANDARD_EINSTELLUNGEN, type ScannerEinstellungen } from './scanner/regeln';
import type { Calculation, Handelsplan, Profile, ScreeningEintrag } from './types';

const PROFILE_KEY = 'trade-rechner:profile';
const CALCULATIONS_KEY = 'trade-rechner:calculations';
const HANDELSPLAN_KEY = 'trade-rechner:handelsplan';
const SCREENINGS_KEY = 'trade-rechner:screenings';
const SCANNER_KEY = 'trade-rechner:scanner-einstellungen';

const DEFAULT_PROFILE: Profile = {
  depotgroesse: 0,
  standardRisikoProzent: 1,
  standardLimitPuffer: 0.3,
  waehrung: '€',
};

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

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage nicht beschreibbar (z.B. voll oder deaktiviert) - bewusst ignoriert
  }
}

export function loadCalculations(): Calculation[] {
  try {
    const raw = localStorage.getItem(CALCULATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({ limitPufferProzent: 0, einstiegLimit: 0, status: 'offen', ...entry }));
  } catch {
    return [];
  }
}

export function saveCalculations(calculations: Calculation[]): void {
  try {
    localStorage.setItem(CALCULATIONS_KEY, JSON.stringify(calculations));
  } catch {
    // siehe saveProfile
  }
}

export function loadHandelsplan(): Handelsplan {
  try {
    const raw = localStorage.getItem(HANDELSPLAN_KEY);
    if (!raw) return DEFAULT_HANDELSPLAN;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_HANDELSPLAN;
    return { ...DEFAULT_HANDELSPLAN, ...parsed };
  } catch {
    return DEFAULT_HANDELSPLAN;
  }
}

export function saveHandelsplan(handelsplan: Handelsplan): void {
  try {
    localStorage.setItem(HANDELSPLAN_KEY, JSON.stringify(handelsplan));
  } catch {
    // siehe saveProfile
  }
}

export function loadScreenings(): ScreeningEintrag[] {
  try {
    const raw = localStorage.getItem(SCREENINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveScreenings(screenings: ScreeningEintrag[]): void {
  try {
    localStorage.setItem(SCREENINGS_KEY, JSON.stringify(screenings));
  } catch {
    // siehe saveProfile
  }
}

export function loadScannerEinstellungen(): ScannerEinstellungen {
  try {
    const raw = localStorage.getItem(SCANNER_KEY);
    if (!raw) return STANDARD_EINSTELLUNGEN;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return STANDARD_EINSTELLUNGEN;
    return { ...STANDARD_EINSTELLUNGEN, ...parsed };
  } catch {
    return STANDARD_EINSTELLUNGEN;
  }
}

export function saveScannerEinstellungen(einstellungen: ScannerEinstellungen): void {
  try {
    localStorage.setItem(SCANNER_KEY, JSON.stringify(einstellungen));
  } catch {
    // siehe saveProfile
  }
}
