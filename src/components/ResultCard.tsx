import type { PositionSizeResult } from '../positionSize';

interface ResultCardProps {
  result: PositionSizeResult;
  waehrung: string;
  depotgroesse: number;
  einstiegLimit: number;
}

export function ResultCard({ result, waehrung, depotgroesse, einstiegLimit }: ResultCardProps) {
  return (
    <div className="result-card">
      <div className="result-card__row">
        <span>Risiko</span>
        <strong>
          {result.risikoEuro.toFixed(2)} {waehrung}
        </strong>
      </div>
      <div className="result-card__row">
        <span>Einstieg (gepuffert)</span>
        <strong>{result.einstiegGepuffert.toFixed(3)}</strong>
      </div>
      <div className="result-card__row">
        <span>Einstiegslimit</span>
        <strong>{einstiegLimit.toFixed(3)}</strong>
      </div>
      <div className="result-card__row">
        <span>Stop-Loss (gepuffert)</span>
        <strong>{result.stopGepuffert.toFixed(3)}</strong>
      </div>
      <div
        className={
          result.positionsgroesse > 0
            ? 'result-card__row result-card__row--highlight result-card__row--highlight-ok'
            : 'result-card__row result-card__row--highlight'
        }
      >
        <span>Positionsgröße</span>
        <strong>{result.positionsgroesse} Stück</strong>
      </div>
      {result.positionsgroesse === 0 && (
        <p className="result-card__warning">Keine Position möglich — Stop-Abstand größer als das Risiko.</p>
      )}
      <div className="result-card__row">
        <span>Tatsächliches Risiko</span>
        <strong>
          {result.tatsaechlichesRisiko.toFixed(2)} {waehrung} (
          {depotgroesse > 0 ? ((result.tatsaechlichesRisiko / depotgroesse) * 100).toFixed(2) : '0.00'} %)
        </strong>
      </div>
    </div>
  );
}
