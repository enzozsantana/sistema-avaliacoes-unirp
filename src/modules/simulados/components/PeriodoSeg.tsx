import { periodoLabel } from '../../../lib/storage';
import type { SimPeriodo } from '../types';

export function PeriodoSeg({
  value,
  onChange,
  id,
  label = 'Turma',
}: {
  value: string;
  onChange: (p: SimPeriodo) => void;
  id: string;
  label?: string;
}) {
  return (
    <div>
      <span className="f" id={`${id}-lbl`}>
        {label}
      </span>
      <div className="periodo-seg" id={id} role="group" aria-labelledby={`${id}-lbl`}>
        {(['diurno', 'noturno'] as const).map((p) => (
          <button
            key={p}
            type="button"
            data-periodo={p}
            className={value === p ? 'on' : ''}
            onClick={() => onChange(p)}
          >
            {periodoLabel(p)}
          </button>
        ))}
      </div>
    </div>
  );
}
