import { ValidationError } from './positionSize';
import type { Richtung } from './types';

export interface AbschlussInput {
  richtung: Richtung;
  einstiegGepuffert: number;
  positionsgroesse: number;
  tatsaechlichesRisiko: number;
  depotgroesse: number;
  ausstiegPreis: number;
  gebuehren: number;
}

export interface AbschlussResult {
  plEuro: number;
  plProzent: number;
  crv: number;
}

export function calculateAbschluss(input: AbschlussInput): AbschlussResult {
  const { richtung, einstiegGepuffert, positionsgroesse, tatsaechlichesRisiko, depotgroesse, ausstiegPreis, gebuehren } =
    input;

  if (!(einstiegGepuffert > 0)) throw new ValidationError('Tatsächlicher Einstieg muss positiv sein.');
  if (!(ausstiegPreis > 0)) throw new ValidationError('Ausstiegspreis muss positiv sein.');
  if (gebuehren < 0) throw new ValidationError('Gebühren dürfen nicht negativ sein.');

  const rohgewinn =
    richtung === 'long'
      ? (ausstiegPreis - einstiegGepuffert) * positionsgroesse
      : (einstiegGepuffert - ausstiegPreis) * positionsgroesse;

  const plEuro = rohgewinn - gebuehren;
  const plProzent = depotgroesse > 0 ? (plEuro / depotgroesse) * 100 : 0;
  const crv = tatsaechlichesRisiko > 0 ? plEuro / tatsaechlichesRisiko : 0;

  return { plEuro, plProzent, crv };
}
