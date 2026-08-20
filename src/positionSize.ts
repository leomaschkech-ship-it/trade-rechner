import type { Richtung } from './types';

/** 0,1%-Sicherheitspuffer auf Einstieg/Stop, siehe Die-0.1-Prozent-Regel. */
const PUFFER = 0.001;

export class ValidationError extends Error {}

export interface PositionSizeInput {
  richtung: Richtung;
  depotgroesse: number;
  risikoProzent: number;
  einstiegRoh: number;
  stopRoh: number;
}

export interface PositionSizeResult {
  risikoEuro: number;
  einstiegGepuffert: number;
  stopGepuffert: number;
  positionsgroesse: number;
  tatsaechlichesRisiko: number;
}

export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const { richtung, depotgroesse, risikoProzent, einstiegRoh, stopRoh } = input;

  if (!(depotgroesse > 0)) throw new ValidationError('Depotgröße muss positiv sein.');
  if (!(risikoProzent > 0)) throw new ValidationError('Risiko% muss positiv sein.');
  if (!(einstiegRoh > 0)) throw new ValidationError('Einstiegskurs muss positiv sein.');
  if (!(stopRoh > 0)) throw new ValidationError('Stop-Loss muss positiv sein.');

  if (richtung === 'long' && stopRoh >= einstiegRoh) {
    throw new ValidationError('Bei Long muss der Stop-Loss unter dem Einstiegskurs liegen.');
  }
  if (richtung === 'short' && stopRoh <= einstiegRoh) {
    throw new ValidationError('Bei Short muss der Stop-Loss über dem Einstiegskurs liegen.');
  }

  const risikoEuro = depotgroesse * (risikoProzent / 100);

  const einstiegGepuffert = richtung === 'long' ? einstiegRoh * (1 + PUFFER) : einstiegRoh * (1 - PUFFER);
  const stopGepuffert = richtung === 'long' ? stopRoh * (1 - PUFFER) : stopRoh * (1 + PUFFER);

  const abstand = Math.abs(einstiegGepuffert - stopGepuffert);
  const positionsgroesse = Math.floor(risikoEuro / abstand);
  const tatsaechlichesRisiko = positionsgroesse * abstand;

  return { risikoEuro, einstiegGepuffert, stopGepuffert, positionsgroesse, tatsaechlichesRisiko };
}

export function calculateEinstiegslimit(
  einstiegGepuffert: number,
  richtung: Richtung,
  limitPufferProzent: number,
): number {
  if (!(limitPufferProzent > 0)) throw new ValidationError('Limitpuffer muss positiv sein.');

  return richtung === 'long'
    ? einstiegGepuffert * (1 + limitPufferProzent / 100)
    : einstiegGepuffert * (1 - limitPufferProzent / 100);
}
