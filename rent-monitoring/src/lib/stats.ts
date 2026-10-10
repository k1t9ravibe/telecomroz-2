import type { BenchmarkResult, ComparableLevel, Compliance, PriceRecord, PropertyType, Settings } from '../types';
import { areaRangeOf } from './constants';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pricePerM2(monthlyCost: number, area: number): number {
  if (!(area > 0) || !Number.isFinite(monthlyCost)) return 0;
  return round2(monthlyCost / area);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface Summary {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

export function summarize(values: number[]): Summary {
  return {
    count: values.length,
    mean: mean(values),
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthsBefore(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

export interface BenchmarkQuery {
  region: string;
  settlement: string;
  propertyType: PropertyType;
  area: number;
  /** Дата, на которую рассчитывается ориентир (по умолчанию — сегодня). */
  asOf?: Date;
  /** Исключить запись (например, созданную из самой заявки). */
  excludeRequestId?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

/**
 * Ценовой ориентир — медиана сопоставимых фактических ставок за последние N месяцев.
 * Сопоставимость проверяется последовательно от наиболее узкого уровня к более широкому
 * (если разрешено настройками); используется первый уровень с достаточным числом объектов.
 */
export function computeBenchmark(records: PriceRecord[], q: BenchmarkQuery, settings: Settings): BenchmarkResult {
  const asOf = q.asOf ?? new Date();
  const from = monthsBefore(asOf, settings.benchmarkMonths);
  const fromISO = toISODate(from);
  const toISO = toISODate(asOf);
  const range = areaRangeOf(q.area);

  const inPeriod = records.filter(
    (r) =>
      r.purchaseDate >= fromISO &&
      r.purchaseDate <= toISO &&
      r.propertyType === q.propertyType &&
      norm(r.region) === norm(q.region) &&
      (!q.excludeRequestId || r.requestId !== q.excludeRequestId),
  );

  const levels: [ComparableLevel, (r: PriceRecord) => boolean][] = [
    ['settlement_type_area', (r) => norm(r.settlement) === norm(q.settlement) && areaRangeOf(r.area).id === range.id],
    ['settlement_type', (r) => norm(r.settlement) === norm(q.settlement)],
    ['region_type_area', (r) => areaRangeOf(r.area).id === range.id],
    ['region_type', () => true],
  ];
  const usable = settings.allowFallback ? levels : levels.slice(0, 1);

  let best = 0;
  for (const [level, pred] of usable) {
    const sel = inPeriod.filter(pred).map((r) => r.pricePerM2);
    best = Math.max(best, sel.length);
    if (sel.length >= settings.minComparables) {
      return { value: round2(median(sel)!), count: sel.length, level, periodFrom: fromISO, periodTo: toISO };
    }
  }
  return { value: null, count: best, level: null, periodFrom: fromISO, periodTo: toISO };
}

/** Отклонение заявленной цены от ориентира, %. */
export function deviationPercent(price: number, benchmark: number | null): number | null {
  if (benchmark === null || !(benchmark > 0)) return null;
  return round2(((price - benchmark) / benchmark) * 100);
}

export function complianceOf(deviation: number | null, tolerancePercent: number): Compliance {
  if (deviation === null) return 'nodata';
  return deviation > tolerancePercent ? 'over' : 'within';
}

export interface GroupStats extends Summary {
  key: string;
  dims: Record<string, string>;
}

export function groupBy<T>(items: T[], keyFn: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}
