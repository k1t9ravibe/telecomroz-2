import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Compliance, RentRequest, RequestStatus } from '../types';
import { AREA_RANGES, IN_REVIEW_STATUSES, PROPERTY_TYPES, REGION_NAMES, STATUS_LABELS, areaRangeOf } from '../lib/constants';
import { monthsBefore, toISODate } from '../lib/stats';
import { Button, Field, Input, Select } from './ui';

export interface RequestFilterState {
  region: string;
  settlement: string;
  propertyType: string;
  areaRange: string;
  period: string;
  dateFrom: string;
  dateTo: string;
  status: '' | 'in_review' | RequestStatus;
  compliance: '' | Compliance;
  search: string;
}

export const EMPTY_REQUEST_FILTER: RequestFilterState = {
  region: '',
  settlement: '',
  propertyType: '',
  areaRange: '',
  period: '',
  dateFrom: '',
  dateTo: '',
  status: '',
  compliance: '',
  search: '',
};

export function periodBounds(period: string, dateFrom: string, dateTo: string): [string, string] {
  if (period === 'custom') return [dateFrom, dateTo];
  const months = Number(period);
  if (!months) return ['', ''];
  return [toISODate(monthsBefore(new Date(), months)), ''];
}

export function applyRequestFilter(list: RentRequest[], f: RequestFilterState, opts: { skipCompliance?: boolean } = {}): RentRequest[] {
  const [from, to] = periodBounds(f.period, f.dateFrom, f.dateTo);
  const q = f.search.trim().toLowerCase();
  return list.filter((r) => {
    if (f.region && r.region !== f.region) return false;
    if (f.settlement && r.settlement !== f.settlement) return false;
    if (f.propertyType && r.propertyType !== f.propertyType) return false;
    if (f.areaRange && areaRangeOf(r.area).id !== f.areaRange) return false;
    const d = r.createdAt.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (f.status === 'in_review' && !IN_REVIEW_STATUSES.includes(r.status)) return false;
    if (f.status && f.status !== 'in_review' && r.status !== f.status) return false;
    if (!opts.skipCompliance && f.compliance && r.compliance !== f.compliance) return false;
    if (q && !`${r.number} ${r.address} ${r.supplier} ${r.settlement}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function RequestFilters({ value, onChange, requests, showSearch }: { value: RequestFilterState; onChange: (v: RequestFilterState) => void; requests: RentRequest[]; showSearch?: boolean }) {
  const set = <K extends keyof RequestFilterState>(k: K, v: RequestFilterState[K]) => onChange({ ...value, [k]: v });
  const settlements = useMemo(() => {
    const s = new Set(requests.filter((r) => !value.region || r.region === value.region).map((r) => r.settlement));
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [requests, value.region]);

  return (
    <div className="rounded-lg border border-line bg-white p-3.5">
      <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] items-end gap-3">
        <Field label="Регион">
          <Select value={value.region} onChange={(e) => onChange({ ...value, region: e.target.value, settlement: '' })}>
            <option value="">Все регионы</option>
            {REGION_NAMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Населённый пункт">
          <Select value={value.settlement} onChange={(e) => set('settlement', e.target.value)}>
            <option value="">Все</option>
            {settlements.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Тип помещения">
          <Select value={value.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
            <option value="">Все типы</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Площадь помещения">
          <Select value={value.areaRange} onChange={(e) => set('areaRange', e.target.value)}>
            <option value="">Любая</option>
            {AREA_RANGES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Период">
          <Select value={value.period} onChange={(e) => set('period', e.target.value)}>
            <option value="">За всё время</option>
            <option value="1">Последний месяц</option>
            <option value="3">Последние 3 месяца</option>
            <option value="6">Последние 6 месяцев</option>
            <option value="12">Последние 12 месяцев</option>
            <option value="custom">Произвольный…</option>
          </Select>
        </Field>
        <Field label="Статус заявки">
          <Select value={value.status} onChange={(e) => set('status', e.target.value as RequestFilterState['status'])}>
            <option value="">Все статусы</option>
            <option value="in_review">Все на рассмотрении</option>
            {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => onChange(EMPTY_REQUEST_FILTER)} title="Сбросить фильтры">
          <RotateCcw size={15} /> Сбросить
        </Button>
      </div>
      {(value.period === 'custom' || showSearch) && (
        <div className="mt-3 grid grid-cols-6 gap-3">
          {value.period === 'custom' && (
            <>
              <Field label="Дата с">
                <Input type="date" value={value.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
              </Field>
              <Field label="Дата по">
                <Input type="date" value={value.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
              </Field>
            </>
          )}
          {showSearch && (
            <Field label="Поиск" className="col-span-2">
              <Input placeholder="№ заявки, адрес, поставщик…" value={value.search} onChange={(e) => set('search', e.target.value)} />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
