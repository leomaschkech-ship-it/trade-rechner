export type Waehrung = '€' | '$';

export interface Profile {
  depotgroesse: number;
  standardRisikoProzent: number;
  standardLimitPuffer: number;
  waehrung: Waehrung;
}

export type Richtung = 'long' | 'short';

export type TradeStatus = 'offen' | 'geschlossen';

export interface Calculation {
  id: string;
  timestamp: string; // ISO-Zeitstempel
  richtung: Richtung;
  depotgroesse: number;
  risikoProzent: number;
  einstiegRoh: number;
  stopRoh: number;
  einstiegGepuffert: number;
  stopGepuffert: number;
  positionsgroesse: number;
  tatsaechlichesRisiko: number;
  limitPufferProzent: number;
  einstiegLimit: number;
  status: TradeStatus;
  ausstiegPreis?: number;
  gebuehren?: number;
  freitext?: string;
  plEuro?: number;
  plProzent?: number;
  crv?: number;
  tatsaechlicherEinstieg?: number;
}

export type SetupTyp = 'trick-des-traders' | '52-wochenhoch' | 'breakaway-gap' | 'umkehrkerze' | 'news-trade';

export type ExitStrategie = 'komplett-laufen-lassen' | 'teilgewinne';

export interface Handelsplan {
  maerkteProdukte: string;
  indizesZeiteinheiten: string;
  handelszeiten: string;
  setups: SetupTyp[];
  tagesverlustLimitProzent: number;
  wochenverlustLimitProzent: number;
  maxParalleleTrades: number;
  exitStrategie: ExitStrategie;
  teilgewinnCrvStufe?: number;
  ziele: string;
  staerkenSchwaechen: string;
  routineTools: string;
  mentaleStaerke: string;
}

export type RetestQualitaet = 'gesund' | 'schwach' | 'unklar';

export type ScreeningSetupTyp = 'long-ueber-p2' | 'short-unter-p2' | '52-wochenhoch' | 'bewegungshandel';

export interface ScreeningEintrag {
  id: string;
  timestamp: string; // ISO-Zeitstempel
  aktie: string;
  symbol: string;
  index: string;
  branche: string;
  richtung: Richtung;
  kursBeiAufnahme: number;

  // Kern-Kriterien
  marktphaseBestaetigt: boolean;
  relativeStaerkeErfuellt: boolean;
  naeheAn52WochenExtrem: boolean;
  retestQualitaet: RetestQualitaet;
  brancheBestaetigtWoche: boolean;
  brancheBestaetigtMonat: boolean;

  // Exklusionskriterien (K.O.)
  wachsendeKorrekturen: boolean;
  volumenWarnsignal: boolean;

  // Setup-Checkliste
  setupTyp: ScreeningSetupTyp;
  setupKriterien: Record<string, boolean>;

  freitext?: string;
}
