import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { PriceRecord } from '../types';
import { useData } from '../store/DataContext';
import { AREA_RANGES, INSUFFICIENT_DATA_MESSAGE, PROPERTY_TYPES, REGION_NAMES, areaRangeOf } from '../lib/constants';
import { fmtDate, fmtInt, fmtMoney, fmtNum } from '../lib/format';
import { groupBy, monthsBefore, summarize, toISODate } from '../lib/stats';
import { downloadTemplate, exportPricesXlsx, importPricesFile } from '../lib/excel';
import { Button, Card, DemoTag, Empty, Field, Input, Notice, Select, cx } from '../components/ui';
import { PriceRecordForm } from '../components/RecordForms';
import ImportDialog from '../components/ImportDialog';

type Dim = 'region' | 'settlement' | 'propertyType' | 'area';
const DIM_LABELS: Record<Dim, string> = { region: 'Регион', settlement: 'Населённый пункт', propertyType: 'Тип помещения', area: 'Диапазон площади' };

interface Filter {
  region: string;
  settlement: string;
  propertyType: string;
  areaRange: string;
  period: string;
  search: string;
}
const EMPTY: Filter = { region: '', settlement: '', propertyType: '', areaRange: '', period: '', search: '' };

export default function PriceBase() {
  const { prices, settings, deletePrices, importPrices, notify } = useData();
  const [tab, setTab] = useState<'records' | 'groups'>('groups');
  const [f, setF] = useState<Filter>(EMPTY);
  const [editing, setEditing] = useState<PriceRecord | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(200);
  const [dims, setDims] = useState<Dim[]>(['region', 'settlement', 'propertyType']);

  const settlements = useMemo(() => [...new Set(prices.filter((p) => !f.region || p.region === f.region).map((p) => p.settlement))].sort((a, b) => a.localeCompare(b, 'ru')), [prices, f.region]);

  const filtered = useMemo(() => {
    const from = f.period ? toISODate(monthsBefore(new Date(), Number(f.period))) : '';
    const q = f.search.trim().toLowerCase();
    return prices
      .filter(
        (p) =>
          (!f.region || p.region === f.region) &&
          (!f.settlement || p.settlement === f.settlement) &&
          (!f.propertyType || p.propertyType === f.propertyType) &&
          (!f.areaRange || areaRangeOf(p.area).id === f.areaRange) &&
          (!from || p.purchaseDate >= from) &&
          (!q || p.source.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  }, [prices, f]);

  const benchFrom = toISODate(monthsBefore(new Date(), settings.benchmarkMonths));
  const groups = useMemo(() => {
    const keyOf = (p: PriceRecord) => dims.map((d) => (d === 'area' ? areaRangeOf(p.area).label : p[d])).join(' | ');
    const g = groupBy(filtered, keyOf);
    return [...g.entries()]
      .map(([key, items]) => {
        const recent = items.filter((p) => p.purchaseDate >= benchFrom).map((p) => p.pricePerM2);
        const first = items[0];
        return {
          key,
          dims: Object.fromEntries(dims.map((d) => [d, d === 'area' ? areaRangeOf(first.area).label : first[d]])) as Record<Dim, string>,
          all: summarize(items.map((p) => p.pricePerM2)),
          recentCount: recent.length,
          benchmark: recent.length >= settings.minComparables ? summarize(recent).median : null,
          sortArea: areaRangeOf(first.area).min,
        };
      })
      .sort((a, b) => {
        for (const d of dims) {
          const c = d === 'area' ? a.sortArea - b.sortArea : a.dims[d].localeCompare(b.dims[d], 'ru');
          if (c) return c;
        }
        return 0;
      });
  }, [filtered, dims, benchFrom, settings.minComparables]);

  const total = summarize(filtered.map((p) => p.pricePerM2));
  const toggleDim = (d: Dim) => setDims((x) => (x.includes(d) ? x.filter((y) => y !== d) : (['region', 'settlement', 'propertyType', 'area'] as Dim[]).filter((y) => y === d || x.includes(y))));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-3.5">
        <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] items-end gap-3">
          <Field label="Регион">
            <Select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value, settlement: '' })}>
              <option value="">Все регионы</option>
              {REGION_NAMES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Населённый пункт">
            <Select value={f.settlement} onChange={(e) => setF({ ...f, settlement: e.target.value })}>
              <option value="">Все</option>
              {settlements.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Тип помещения">
            <Select value={f.propertyType} onChange={(e) => setF({ ...f, propertyType: e.target.value })}>
              <option value="">Все типы</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Диапазон площади">
            <Select value={f.areaRange} onChange={(e) => setF({ ...f, areaRange: e.target.value })}>
              <option value="">Любой</option>
              {AREA_RANGES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Период закупки">
            <Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>
              <option value="">За всё время</option>
              <option value="3">Последние 3 месяца</option>
              <option value="6">Последние 6 месяцев</option>
              <option value="12">Последние 12 месяцев</option>
              <option value="24">Последние 24 месяца</option>
            </Select>
          </Field>
          <Field label="Источник данных">
            <Input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Поиск по источнику" />
          </Field>
          <Button variant="ghost" onClick={() => setF(EMPTY)}>
            <RotateCcw size={15} /> Сбросить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          ['Количество объектов', fmtInt(total.count)],
          ['Средняя цена за 1 м²', fmtMoney(total.mean)],
          ['Медианная цена за 1 м²', fmtMoney(total.median)],
          ['Минимальная цена', fmtMoney(total.min)],
          ['Максимальная цена', fmtMoney(total.max)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-white px-4 py-3">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <Card
        title={
          <div className="flex gap-1">
            {(
              [
                ['groups', 'Ценовые ориентиры по группам'],
                ['records', `Записи базы (${filtered.length})`],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={cx('rounded-md px-3 py-1.5 text-sm', tab === k ? 'bg-kt-600 text-white' : 'text-slate-600 hover:bg-kt-50')}>
                {l}
              </button>
            ))}
          </div>
        }
        actions={
          <>
            <Button size="sm" onClick={() => downloadTemplate('prices')}>
              <FileSpreadsheet size={14} /> Шаблон
            </Button>
            <Button size="sm" onClick={() => setImporting(true)}>
              <Upload size={14} /> Импорт из Excel
            </Button>
            <Button size="sm" onClick={() => exportPricesXlsx(filtered)} disabled={!filtered.length}>
              <Download size={14} /> Выгрузить
            </Button>
            <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
              <Plus size={14} /> Добавить запись
            </Button>
          </>
        }
      >
        {tab === 'groups' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-slate-500">Группировка:</span>
              {(Object.keys(DIM_LABELS) as Dim[]).map((d) => (
                <label key={d} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={dims.includes(d)} onChange={() => toggleDim(d)} className="accent-kt-600" />
                  {DIM_LABELS[d]}
                </label>
              ))}
              <span className="ml-auto text-xs text-slate-500">
                Ценовой ориентир — медиана фактических ставок за последние {settings.benchmarkMonths} мес. (с {fmtDate(benchFrom)}), не менее {settings.minComparables} объектов
              </span>
            </div>
            {dims.length === 0 ? (
              <Notice kind="info">Выберите хотя бы один признак группировки.</Notice>
            ) : groups.length === 0 ? (
              <Empty>Нет данных по выбранным условиям</Empty>
            ) : (
              <div className="max-h-[calc(100vh-430px)] min-h-[300px] overflow-auto rounded-md border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      {dims.map((d) => (
                        <th key={d}>{DIM_LABELS[d]}</th>
                      ))}
                      <th className="text-right">Кол-во объектов</th>
                      <th className="text-right">Средняя, ₸/м²</th>
                      <th className="text-right">Медиана, ₸/м²</th>
                      <th className="text-right">Мин., ₸/м²</th>
                      <th className="text-right">Макс., ₸/м²</th>
                      <th className="text-right">Ценовой ориентир, ₸/м²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key} className="row-plain">
                        {dims.map((d) => (
                          <td key={d}>{g.dims[d]}</td>
                        ))}
                        <td className="num">{g.all.count}</td>
                        <td className="num">{fmtMoney(g.all.mean)}</td>
                        <td className="num">{fmtMoney(g.all.median)}</td>
                        <td className="num">{fmtMoney(g.all.min)}</td>
                        <td className="num">{fmtMoney(g.all.max)}</td>
                        <td className="min-w-[190px] text-right tabular-nums">
                          {g.benchmark === null ? (
                            <span className="text-xs leading-tight text-amber-700" title={`Объектов за период: ${g.recentCount}`}>
                              {INSUFFICIENT_DATA_MESSAGE}
                            </span>
                          ) : (
                            <span className="font-semibold text-kt-800">
                              {fmtMoney(g.benchmark)} <span className="text-xs font-normal text-slate-400">({g.recentCount})</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <Empty>Записи не найдены. Добавьте данные вручную или загрузите из Excel.</Empty>
        ) : (
          <div className="space-y-2">
            {selected.size > 0 && (
              <div className="flex items-center gap-3 text-sm">
                Выбрано: {selected.size}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (window.confirm(`Удалить выбранные записи (${selected.size})?`)) {
                      await deletePrices([...selected]);
                      setSelected(new Set());
                    }
                  }}
                >
                  <Trash2 size={14} /> Удалить выбранные
                </Button>
              </div>
            )}
            <div className="max-h-[calc(100vh-430px)] min-h-[300px] overflow-auto rounded-md border border-line">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        className="accent-kt-600"
                        checked={selected.size > 0 && filtered.slice(0, limit).every((p) => selected.has(p.id))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(filtered.slice(0, limit).map((p) => p.id)) : new Set())}
                      />
                    </th>
                    <th>Регион</th>
                    <th>Населённый пункт</th>
                    <th>Тип помещения</th>
                    <th className="text-right">Площадь, м²</th>
                    <th className="text-right">Ежемес. стоимость</th>
                    <th className="text-right">Цена за 1 м²</th>
                    <th>Дата закупки</th>
                    <th>Источник данных</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((p) => (
                    <tr key={p.id} className="row-plain">
                      <td>
                        <input
                          type="checkbox"
                          className="accent-kt-600"
                          checked={selected.has(p.id)}
                          onChange={() =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (n.has(p.id)) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td>{p.region}</td>
                      <td>{p.settlement}</td>
                      <td>{p.propertyType}</td>
                      <td className="num">{fmtNum(p.area)}</td>
                      <td className="num">{fmtMoney(p.monthlyCost)}</td>
                      <td className="num font-medium">{fmtMoney(p.pricePerM2)}</td>
                      <td className="whitespace-nowrap">{fmtDate(p.purchaseDate)}</td>
                      <td>
                        {p.source}
                        {p.isDemo && <DemoTag />}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <button className="rounded p-1 text-kt-600 hover:bg-kt-50" onClick={() => setEditing(p)} title="Редактировать">
                          <Pencil size={14} />
                        </button>
                        <button
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                          title="Удалить"
                          onClick={() => window.confirm('Удалить запись из базы цен?') && deletePrices([p.id])}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > limit && (
              <div className="text-center">
                <Button size="sm" onClick={() => setLimit((l) => l + 200)}>
                  Показать ещё (показано {limit} из {filtered.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Notice kind="info" title="Автоматическое пополнение базы">
        При согласовании заявки сведения о завершённой закупке автоматически добавляются в базу цен (настраивается в разделе «Настройки»). В перспективе — загрузка данных о заключённых договорах из системы электронных закупок.
      </Notice>

      {editing && <PriceRecordForm record={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {importing && (
        <ImportDialog
          title="Импорт данных в базу цен из Excel"
          parse={importPricesFile}
          onTemplate={() => downloadTemplate('prices')}
          onClose={() => setImporting(false)}
          onImport={async (rows) => {
            const ok = await importPrices(rows);
            if (ok) notify('success', `Загружено записей: ${rows.length}`);
            return ok;
          }}
          hint={<div className="text-sm text-slate-600">Первая строка — заголовки: Регион, Населённый пункт, Тип помещения, Площадь, Ежемесячная стоимость, Дата закупки, Источник данных.</div>}
          preview={(rows) => (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Регион</th>
                  <th>Населённый пункт</th>
                  <th>Тип</th>
                  <th className="text-right">Площадь</th>
                  <th className="text-right">Стоимость</th>
                  <th>Дата</th>
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.region}</td>
                    <td>{r.settlement}</td>
                    <td>{r.propertyType}</td>
                    <td className="num">{fmtNum(r.area)}</td>
                    <td className="num">{fmtMoney(r.monthlyCost)}</td>
                    <td>{fmtDate(r.purchaseDate)}</td>
                    <td>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      )}
    </div>
  );
}
