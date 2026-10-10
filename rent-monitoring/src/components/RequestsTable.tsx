import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { RentRequest } from '../types';
import { fmtMoney, fmtNum, fmtPercent } from '../lib/format';
import { ComplianceBadge, DemoTag, Empty, StatusBadge, cx } from './ui';

type SortKey = 'number' | 'region' | 'settlement' | 'propertyType' | 'area' | 'pricePerM2' | 'benchmark' | 'deviation' | 'status';

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'number', label: '№ заявки' },
  { key: 'region', label: 'Регион' },
  { key: 'settlement', label: 'Населённый пункт' },
  { key: 'propertyType', label: 'Тип помещения' },
  { key: 'area', label: 'Площадь, м²', num: true },
  { key: 'pricePerM2', label: 'Цена за 1 м²', num: true },
  { key: 'benchmark', label: 'Ценовой ориентир', num: true },
  { key: 'deviation', label: 'Отклонение', num: true },
  { key: 'status', label: 'Статус' },
];

export default function RequestsTable({ rows, onOpen, selectedId }: { rows: RentRequest[]; onOpen: (r: RentRequest) => void; selectedId?: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'number', dir: -1 });
  const sorted = useMemo(() => {
    const s = [...rows];
    s.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb), 'ru') * sort.dir;
    });
    return s;
  }, [rows, sort]);

  if (rows.length === 0) return <Empty>Заявки, соответствующие условиям отбора, не найдены</Empty>;

  return (
    <div className="max-h-[calc(100vh-330px)] min-h-[300px] overflow-auto rounded-md border border-line">
      <table className="tbl">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={cx('cursor-pointer select-none', c.num && 'text-right')} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r)}
              className={cx('cursor-pointer', r.compliance === 'over' ? 'row-over' : r.compliance === 'within' ? 'row-within' : 'row-plain', selectedId === r.id && 'outline outline-2 -outline-offset-2 outline-kt-500')}
            >
              <td className="whitespace-nowrap font-medium text-kt-700">
                {r.number}
                {r.isDemo && <DemoTag />}
              </td>
              <td>{r.region}</td>
              <td className="whitespace-nowrap">{r.settlement}</td>
              <td>{r.propertyType}</td>
              <td className="num">{fmtNum(r.area)}</td>
              <td className="num font-medium">{fmtMoney(r.pricePerM2)}</td>
              <td className="num">{r.benchmark === null ? <span className="text-slate-400">нет данных</span> : fmtMoney(r.benchmark)}</td>
              <td className="num">
                {r.deviation === null ? (
                  <ComplianceBadge compliance="nodata" />
                ) : (
                  <span className={cx('font-semibold', r.compliance === 'over' ? 'text-red-700' : 'text-emerald-700')}>{fmtPercent(r.deviation)}</span>
                )}
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
