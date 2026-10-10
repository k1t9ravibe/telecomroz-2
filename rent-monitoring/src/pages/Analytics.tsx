import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { X } from 'lucide-react';
import { useData } from '../store/DataContext';
import { PROPERTY_TYPES, REGION_NAMES, REGION_SHORT } from '../lib/constants';
import { fmtInt, fmtMoney, fmtMonth } from '../lib/format';
import { groupBy, mean, median, monthsBefore, toISODate } from '../lib/stats';
import RegionMap from '../components/RegionMap';
import { Button, Card, Empty, Field, Select, Stat } from '../components/ui';

const C = { mean: '#2a78d6', median: '#eb6834', over: '#d64545', within: '#2e9e5b', nodata: '#a3a9b3', grid: '#e3eef8', axis: '#64748b' };
const money = (v: number) => fmtInt(v);
const tooltipStyle = { fontSize: 12, borderRadius: 6, borderColor: '#d4e6f6' };

export default function Analytics() {
  const { prices, requests } = useData();
  const [region, setRegion] = useState('');
  const [type, setType] = useState('');
  const [months, setMonths] = useState('12');

  const from = months ? toISODate(monthsBefore(new Date(), Number(months))) : '';
  const scopedPrices = useMemo(() => prices.filter((p) => (!from || p.purchaseDate >= from) && (!type || p.propertyType === type)), [prices, from, type]);
  const scopedRequests = useMemo(() => requests.filter((r) => (!from || r.createdAt.slice(0, 10) >= from) && (!type || r.propertyType === type)), [requests, from, type]);

  const regionPrices = region ? scopedPrices.filter((p) => p.region === region) : scopedPrices;
  const regionRequests = region ? scopedRequests.filter((r) => r.region === region) : scopedRequests;
  const vals = regionPrices.map((p) => p.pricePerM2);
  const overCount = regionRequests.filter((r) => r.compliance === 'over').length;
  const share = regionRequests.length ? (overCount / regionRequests.length) * 100 : null;

  const byRegion = useMemo(() => {
    const g = groupBy(scopedPrices, (p) => p.region);
    return REGION_NAMES.map((r) => {
      const v = (g.get(r) ?? []).map((p) => p.pricePerM2);
      return { region: r, short: REGION_SHORT[r], mean: mean(v), median: median(v), count: v.length };
    });
  }, [scopedPrices]);
  const mapValues = Object.fromEntries(byRegion.map((r) => [r.region, r.median === null ? null : Math.round(r.median)]));
  const regionBars = byRegion.filter((r) => r.count > 0).sort((a, b) => (b.median ?? 0) - (a.median ?? 0));

  const trend = useMemo(() => {
    // Тренд всегда за 24 мес. для выбранного региона/типа
    const tf = toISODate(monthsBefore(new Date(), 24));
    const src = prices.filter((p) => p.purchaseDate >= tf && (!type || p.propertyType === type) && (!region || p.region === region));
    const g = groupBy(src, (p) => p.purchaseDate.slice(0, 7));
    return [...g.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, items]) => {
        const v = items.map((p) => p.pricePerM2);
        return { month: fmtMonth(m), mean: Math.round(mean(v)!), median: Math.round(median(v)!), count: v.length };
      });
  }, [prices, type, region]);

  const byType = useMemo(() => {
    const src = prices.filter((p) => (!from || p.purchaseDate >= from) && (!region || p.region === region));
    const g = groupBy(src, (p) => p.propertyType);
    return PROPERTY_TYPES.map((t) => {
      const v = (g.get(t) ?? []).map((p) => p.pricePerM2);
      return { type: t, mean: v.length ? Math.round(mean(v)!) : null, median: v.length ? Math.round(median(v)!) : null, count: v.length };
    }).filter((x) => x.count > 0);
  }, [prices, from, region]);

  const excess = useMemo(() => {
    const g = groupBy(scopedRequests, (r) => r.region);
    return [...g.entries()]
      .map(([r, items]) => ({
        region: r,
        short: REGION_SHORT[r] ?? r,
        over: items.filter((x) => x.compliance === 'over').length,
        within: items.filter((x) => x.compliance === 'within').length,
        nodata: items.filter((x) => x.compliance === 'nodata').length,
        total: items.length,
      }))
      .sort((a, b) => b.over - a.over || b.total - a.total);
  }, [scopedRequests]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 rounded-lg border border-line bg-white p-3.5">
        <Field label="Регион" className="w-72">
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Все регионы (Казахстан)</option>
            {REGION_NAMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Тип помещения" className="w-56">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Все типы</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Период" className="w-56">
          <Select value={months} onChange={(e) => setMonths(e.target.value)}>
            <option value="6">Последние 6 месяцев</option>
            <option value="12">Последние 12 месяцев</option>
            <option value="24">Последние 24 месяца</option>
            <option value="">За всё время</option>
          </Select>
        </Field>
        {region && (
          <Button variant="ghost" onClick={() => setRegion('')}>
            <X size={15} /> Сбросить выбор региона
          </Button>
        )}
        <div className="ml-auto text-sm text-slate-500">
          Показатели: <b className="text-slate-700">{region || 'Казахстан, все регионы'}</b>
          {type && `, ${type.toLowerCase()}`}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Средняя стоимость за 1 м²" value={fmtMoney(mean(vals) === null ? null : Math.round(mean(vals)!))} sub="по фактическим договорам" />
        <Stat label="Медианная стоимость за 1 м²" value={fmtMoney(median(vals) === null ? null : Math.round(median(vals)!))} tone="info" sub="основа ценового ориентира" />
        <Stat label="Объектов в базе цен" value={fmtInt(vals.length)} sub="за выбранный период" />
        <Stat label="Заявок с превышением" value={fmtInt(overCount)} tone="danger" sub={`из ${regionRequests.length} заявок`} />
        <Stat label="Доля заявок с превышением" value={share === null ? '—' : `${Math.round(share)}%`} tone="danger" sub="от числа заявок" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
        <Card title="Карта регионов: медианная стоимость за 1 м², ₸" actions={<span className="text-xs text-slate-500">нажмите на регион для выбора</span>}>
          <RegionMap values={mapValues} selected={region} onSelect={setRegion} />
        </Card>
        <Card title="Средняя и медианная стоимость по регионам, ₸/м²">
          {regionBars.length === 0 ? (
            <Empty>Нет данных за выбранный период</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={regionBars} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={2} onClick={(e) => e?.activePayload && setRegion(e.activePayload[0].payload.region === region ? '' : e.activePayload[0].payload.region)}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="short" tick={{ fontSize: 10, fill: C.axis }} interval={0} angle={-35} textAnchor="end" height={60} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} tickFormatter={money} tickLine={false} axisLine={false} width={50} />
                <Tooltip formatter={(v: number) => fmtMoney(Math.round(v))} labelFormatter={(_, p) => p?.[0]?.payload.region ?? ''} contentStyle={tooltipStyle} cursor={{ fill: '#eef6fd' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="mean" name="Средняя" fill={C.mean} radius={[4, 4, 0, 0]} className="cursor-pointer">
                  {regionBars.map((r) => (
                    <Cell key={r.region} fillOpacity={!region || r.region === region ? 1 : 0.3} />
                  ))}
                </Bar>
                <Bar dataKey="median" name="Медиана" fill={C.median} radius={[4, 4, 0, 0]} className="cursor-pointer">
                  {regionBars.map((r) => (
                    <Cell key={r.region} fillOpacity={!region || r.region === region ? 1 : 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`Изменение цен по месяцам (24 мес.), ₸/м² — ${region || 'все регионы'}`}>
          {trend.length === 0 ? (
            <Empty>Нет данных</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} tickFormatter={money} tickLine={false} axisLine={false} width={50} />
                <Tooltip formatter={(v: number, n) => [fmtMoney(v), n]} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="mean" name="Средняя" stroke={C.mean} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="median" name="Медиана" stroke={C.median} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title={`Сравнение стоимости по типам помещений, ₸/м² — ${region || 'все регионы'}`}>
          {byType.length === 0 ? (
            <Empty>Нет данных</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byType} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: C.axis }} interval={0} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} tickFormatter={money} tickLine={false} axisLine={false} width={50} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={tooltipStyle} cursor={{ fill: '#eef6fd' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="mean" name="Средняя" fill={C.mean} radius={[4, 4, 0, 0]} />
                <Bar dataKey="median" name="Медиана" fill={C.median} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Заявки с превышением ценового ориентира по регионам">
        {excess.length === 0 ? (
          <Empty>Заявок за выбранный период нет</Empty>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
            <ResponsiveContainer width="100%" height={Math.max(200, excess.length * 30 + 50)}>
              <BarChart data={excess} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="short" tick={{ fontSize: 11, fill: C.axis }} width={84} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(_, p) => p?.[0]?.payload.region ?? ''} contentStyle={tooltipStyle} cursor={{ fill: '#eef6fd' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="over" name="С превышением" stackId="a" fill={C.over} stroke="#fff" strokeWidth={1}>
                  {excess.map((r) => (
                    <Cell key={r.region} fillOpacity={!region || r.region === region ? 1 : 0.3} />
                  ))}
                </Bar>
                <Bar dataKey="within" name="В пределах ориентира" stackId="a" fill={C.within} stroke="#fff" strokeWidth={1}>
                  {excess.map((r) => (
                    <Cell key={r.region} fillOpacity={!region || r.region === region ? 1 : 0.3} />
                  ))}
                </Bar>
                <Bar dataKey="nodata" name="Нет ориентира" stackId="a" fill={C.nodata} stroke="#fff" strokeWidth={1} radius={[0, 4, 4, 0]}>
                  {excess.map((r) => (
                    <Cell key={r.region} fillOpacity={!region || r.region === region ? 1 : 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-auto rounded-md border border-line">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Регион</th>
                    <th className="text-right">Заявок</th>
                    <th className="text-right">С превышением</th>
                    <th className="text-right">Доля</th>
                  </tr>
                </thead>
                <tbody>
                  {excess.map((r) => (
                    <tr key={r.region} className={r.region === region ? 'bg-kt-50' : 'row-plain cursor-pointer'} onClick={() => setRegion(r.region === region ? '' : r.region)}>
                      <td className={r.region === region ? 'font-semibold' : ''}>{r.region}</td>
                      <td className="num">{r.total}</td>
                      <td className="num text-red-700">{r.over}</td>
                      <td className="num">{Math.round((r.over / r.total) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
