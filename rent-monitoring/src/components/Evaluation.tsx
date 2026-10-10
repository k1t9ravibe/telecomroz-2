import type { ComparableLevel, Compliance } from '../types';
import { INSUFFICIENT_DATA_MESSAGE, LEVEL_LABELS } from '../lib/constants';
import { fmtDate, fmtMoney, fmtPercent } from '../lib/format';
import { Notice, cx } from './ui';

export interface EvaluationView {
  pricePerM2: number;
  benchmark: number | null;
  benchmarkCount: number;
  benchmarkLevel: ComparableLevel | null;
  deviation: number | null;
  compliance: Compliance;
  periodFrom?: string;
  periodTo?: string;
}

export function excessMessage(deviation: number) {
  return `Внимание! Заявленная стоимость аренды превышает ценовой ориентир по данному региону на ${fmtPercent(deviation, false)}.`;
}

export function EvaluationSummary({ ev, months, minCount }: { ev: EvaluationView; months: number; minCount: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Цена за 1 м²" value={fmtMoney(ev.pricePerM2)} hint="Ежемесячная стоимость / площадь" />
        <Metric label="Ценовой ориентир" value={ev.benchmark === null ? '—' : fmtMoney(ev.benchmark)} hint={`Медиана за ${months} мес.`} />
        <Metric
          label="Отклонение"
          value={fmtPercent(ev.deviation)}
          tone={ev.compliance === 'over' ? 'danger' : ev.compliance === 'within' ? 'success' : undefined}
          hint={ev.compliance === 'over' ? 'Выше ориентира' : ev.compliance === 'within' ? 'В пределах ориентира' : 'Сравнение невозможно'}
        />
      </div>
      {ev.compliance === 'over' && ev.deviation !== null && <Notice kind="danger" title={excessMessage(ev.deviation)}>Ценовой ориентир носит рекомендательный характер и не блокирует заявку. При необходимости запросите обоснование цены у Заказчика.</Notice>}
      {ev.compliance === 'within' && <Notice kind="success" title="Заявленная стоимость находится в пределах ценового ориентира" />}
      {ev.compliance === 'nodata' && (
        <Notice kind="warning" title={INSUFFICIENT_DATA_MESSAGE}>
          В базе цен найдено сопоставимых объектов: {ev.benchmarkCount} (требуется не менее {minCount}).
        </Notice>
      )}
      {ev.benchmarkLevel && (
        <div className="text-xs text-slate-500">
          Сопоставимые объекты: {LEVEL_LABELS[ev.benchmarkLevel].toLowerCase()} · количество: {ev.benchmarkCount}
          {ev.periodFrom && ` · период: ${fmtDate(ev.periodFrom)} – ${fmtDate(ev.periodTo)}`}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="rounded-md border border-line bg-kt-50/50 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('mt-0.5 text-xl font-semibold tabular-nums', tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-800')}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
