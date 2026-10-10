import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileSpreadsheet, Link2Off, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { MarketOffer } from '../types';
import { useData } from '../store/DataContext';
import { PROPERTY_TYPES, REGION_NAMES } from '../lib/constants';
import { fmtDate, fmtInt, fmtMoney, fmtNum, fmtPercent, parseNumber } from '../lib/format';
import { monthsBefore, summarize, toISODate } from '../lib/stats';
import { downloadTemplate, exportMarketXlsx, importMarketFile } from '../lib/excel';
import { Button, Card, DemoTag, Empty, Field, Input, Notice, Select } from '../components/ui';
import { MarketOfferForm } from '../components/RecordForms';
import ImportDialog from '../components/ImportDialog';

interface Filter {
  region: string;
  settlement: string;
  propertyType: string;
  areaMin: string;
  areaMax: string;
  costMin: string;
  costMax: string;
}
const EMPTY: Filter = { region: '', settlement: '', propertyType: '', areaMin: '', areaMax: '', costMin: '', costMax: '' };

export default function Market() {
  const { market, prices, settings, deleteMarket, importMarket, notify } = useData();
  const [f, setF] = useState<Filter>(EMPTY);
  const [editing, setEditing] = useState<MarketOffer | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const settlements = useMemo(() => [...new Set(market.filter((p) => !f.region || p.region === f.region).map((p) => p.settlement))].sort((a, b) => a.localeCompare(b, 'ru')), [market, f.region]);

  const num = (s: string) => (s.trim() ? parseNumber(s) : Number.NaN);
  const inRange = (v: number, min: string, max: string) => (Number.isNaN(num(min)) || v >= num(min)) && (Number.isNaN(num(max)) || v <= num(max));

  const rows = useMemo(
    () =>
      market
        .filter(
          (m) =>
            (!f.region || m.region === f.region) &&
            (!f.settlement || m.settlement === f.settlement) &&
            (!f.propertyType || m.propertyType === f.propertyType) &&
            inRange(m.area, f.areaMin, f.areaMax) &&
            inRange(m.monthlyCost, f.costMin, f.costMax),
        )
        .sort((a, b) => b.listingDate.localeCompare(a.listingDate)),
    [market, f],
  );

  const stats = summarize(rows.map((r) => r.pricePerM2));
  const benchFrom = toISODate(monthsBefore(new Date(), settings.benchmarkMonths));
  const factual = summarize(
    prices
      .filter(
        (p) =>
          p.purchaseDate >= benchFrom &&
          (!f.region || p.region === f.region) &&
          (!f.settlement || p.settlement === f.settlement) &&
          (!f.propertyType || p.propertyType === f.propertyType) &&
          inRange(p.area, f.areaMin, f.areaMax),
      )
      .map((p) => p.pricePerM2),
  );
  const gap = stats.median !== null && factual.median ? ((stats.median - factual.median) / factual.median) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-3.5">
        <div className="grid grid-cols-[repeat(3,minmax(0,1.3fr))_repeat(4,minmax(0,1fr))_auto] items-end gap-3">
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
          <Field label="Площадь от, м²">
            <Input inputMode="decimal" value={f.areaMin} onChange={(e) => setF({ ...f, areaMin: e.target.value })} />
          </Field>
          <Field label="Площадь до, м²">
            <Input inputMode="decimal" value={f.areaMax} onChange={(e) => setF({ ...f, areaMax: e.target.value })} />
          </Field>
          <Field label="Стоимость от, ₸/мес">
            <Input inputMode="decimal" value={f.costMin} onChange={(e) => setF({ ...f, costMin: e.target.value })} />
          </Field>
          <Field label="Стоимость до, ₸/мес">
            <Input inputMode="decimal" value={f.costMax} onChange={(e) => setF({ ...f, costMax: e.target.value })} />
          </Field>
          <Button variant="ghost" onClick={() => setF(EMPTY)}>
            <RotateCcw size={15} /> Сбросить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Box label="Предложений" value={fmtInt(stats.count)} />
        <Box label="Средняя рыночная цена за 1 м²" value={fmtMoney(stats.mean)} />
        <Box label="Медианная рыночная цена за 1 м²" value={fmtMoney(stats.median)} />
        <Box label={`Медиана фактических договоров (${settings.benchmarkMonths} мес.)`} value={fmtMoney(factual.median)} sub={`объектов: ${factual.count}`} />
        <Box label="Рынок к фактическим ставкам" value={fmtPercent(gap)} sub="разница медиан" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
        <Card
          title={`Рыночные предложения (${rows.length})`}
          bodyClassName="p-0"
          actions={
            <>
              <Button size="sm" onClick={() => downloadTemplate('market')}>
                <FileSpreadsheet size={14} /> Шаблон
              </Button>
              <Button size="sm" onClick={() => setImporting(true)}>
                <Upload size={14} /> Загрузить Excel
              </Button>
              <Button size="sm" onClick={() => exportMarketXlsx(rows)} disabled={!rows.length}>
                <Download size={14} /> Выгрузить
              </Button>
              <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
                <Plus size={14} /> Добавить предложение
              </Button>
            </>
          }
        >
          {rows.length === 0 ? (
            <div className="p-4">
              <Empty>Предложения не найдены. Добавьте их вручную или загрузите из Excel.</Empty>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-360px)] min-h-[300px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Адрес объекта</th>
                    <th>Тип помещения</th>
                    <th className="text-right">Площадь, м²</th>
                    <th className="text-right">Ежемес. стоимость</th>
                    <th className="text-right">Цена за 1 м²</th>
                    <th>Дата объявления</th>
                    <th>Источник</th>
                    <th>Ссылка</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="row-plain">
                      <td className="min-w-[220px]">
                        {m.address}
                        <div className="text-[11px] text-slate-500">{m.region}</div>
                      </td>
                      <td>{m.propertyType}</td>
                      <td className="num">{fmtNum(m.area)}</td>
                      <td className="num">{fmtMoney(m.monthlyCost)}</td>
                      <td className="num font-medium">{fmtMoney(m.pricePerM2)}</td>
                      <td className="whitespace-nowrap">{fmtDate(m.listingDate)}</td>
                      <td>
                        {m.source}
                        {m.isDemo && <DemoTag />}
                      </td>
                      <td>
                        {m.url ? (
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-kt-700 hover:underline">
                            Открыть <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <button className="rounded p-1 text-kt-600 hover:bg-kt-50" onClick={() => setEditing(m)} title="Редактировать">
                          <Pencil size={14} />
                        </button>
                        <button className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => window.confirm('Удалить предложение?') && deleteMarket([m.id])} title="Удалить">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Интеграция с Krisha.kz">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Link2Off size={16} className="text-slate-400" />
                <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">Планируется</span>
              </div>
              <p>Автоматическая загрузка объявлений будет подключена после заключения соглашения и получения официального API. Несанкционированный парсинг сайта не используется.</p>
              <p>До подключения интеграции предложения вносятся вручную или загружаются из Excel.</p>
              <Button size="sm" disabled title="Доступно после подключения официальной интеграции">
                Синхронизировать
              </Button>
            </div>
          </Card>
          <Notice kind="info" title="Дополнительный ориентир">
            Рыночные предложения отражают цены предложения (а не сделки) и используются только для сопоставления. Ценовой ориентир по заявкам рассчитывается исключительно по фактически заключённым договорам из базы цен.
          </Notice>
        </div>
      </div>

      {editing && <MarketOfferForm offer={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {importing && (
        <ImportDialog
          title="Загрузка рыночных предложений из Excel"
          parse={importMarketFile}
          onTemplate={() => downloadTemplate('market')}
          onClose={() => setImporting(false)}
          onImport={async (r) => {
            const ok = await importMarket(r);
            if (ok) notify('success', `Загружено предложений: ${r.length}`);
            return ok;
          }}
          preview={(r) => (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Адрес</th>
                  <th>Тип</th>
                  <th className="text-right">Площадь</th>
                  <th className="text-right">Стоимость</th>
                  <th>Дата</th>
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {r.map((x, i) => (
                  <tr key={i}>
                    <td>{x.address}</td>
                    <td>{x.propertyType}</td>
                    <td className="num">{fmtNum(x.area)}</td>
                    <td className="num">{fmtMoney(x.monthlyCost)}</td>
                    <td>{fmtDate(x.listingDate)}</td>
                    <td>{x.source}</td>
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

function Box({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-800">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
