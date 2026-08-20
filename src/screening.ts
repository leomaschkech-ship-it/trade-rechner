import { SETUP_KRITERIEN } from './screeningSetups';
import type { ScreeningSetupTyp } from './types';

export interface ScreeningScoreInput {
  marktphaseBestaetigt: boolean;
  relativeStaerkeErfuellt: boolean;
  naeheAn52WochenExtrem: boolean;
  brancheBestaetigtWoche: boolean;
  brancheBestaetigtMonat: boolean;
  wachsendeKorrekturen: boolean;
  volumenWarnsignal: boolean;
  setupTyp: ScreeningSetupTyp;
  setupKriterien: Record<string, boolean>;
}

export interface ScreeningScoreResult {
  kernErfuellt: number;
  kernGesamt: number;
  setupErfuellt: number;
  setupGesamt: number;
  ausgeschlossen: boolean;
}

export function calculateScreeningScore(input: ScreeningScoreInput): ScreeningScoreResult {
  const kernKriterien = [
    input.marktphaseBestaetigt,
    input.relativeStaerkeErfuellt,
    input.naeheAn52WochenExtrem,
    input.brancheBestaetigtWoche,
    input.brancheBestaetigtMonat,
  ];
  const kernErfuellt = kernKriterien.filter(Boolean).length;

  const setupDefinitionen = SETUP_KRITERIEN[input.setupTyp] ?? [];
  const setupErfuellt = setupDefinitionen.filter((kriterium) => input.setupKriterien[kriterium.id]).length;

  return {
    kernErfuellt,
    kernGesamt: kernKriterien.length,
    setupErfuellt,
    setupGesamt: setupDefinitionen.length,
    ausgeschlossen: input.wachsendeKorrekturen || input.volumenWarnsignal,
  };
}
