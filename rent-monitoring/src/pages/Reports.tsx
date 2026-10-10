import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useData } from '../store/DataContext';
import { AREA_RANGES, PROPERTY_TYPES, REGION_NAMES, areaRangeOf } from '../lib/constants';
import { fmtDate, fmtInt } from '../lib/format';
import { groupBy, mean, median, monthsBefore, toISODate } from '../lib/stats';
import { exportReportXlsx, type ReportMeta, type ReportRow } from '../lib/excel';
import { exportReportPdf } from '../lib/pdf';
import { Button, Card, Empty, Field, Input, Notice, Select } from '../components/ui';

interface Params {
  region: string;
  settlement: string;
  propertyType: string;
  areaRange: string;
  dateFrom: string;
  dateTo: string;
}

interface Report {
  rows: ReportRow[];
  total: ReportRow | null;
  meta: ReportMeta;
  hasDemo: boolean;
}

export default function Reports() {
  const { prices, settings, notify } = useData();
  const today = toISODate(new Date());
  const [p, setP] = useState<Params>({ region: '', settlement: '', propertyType: '', areaRange: '', dateFrom: toISODate(monthsBefore(new Date(), settings.benchmarkMonths)), dateTo: today });
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const settlements = useMemo(() => [...new Set(prices.filter((x) => x.region === p.region).map((x) => x.settlement))].sort((a, b) => a.localeCompare(b, 'ru')), [prices, p.region]);

  const generate = () => {
    setError(null);
    if (!p.dateFrom || !p.dateTo) return setError('Укажите период формирования справки');
    if (p.dateFrom > p.dateTo) return setError('Дата начала периода не может быть позже даты окончания');
    const src = prices.filter(
      (x) =>
        (!p.region || x.region === p.region) &&
        (!p.settlement || x.settlement === p.settlement) &&
        (!p.propertyType || x.propertyType === p.propertyType) &&
        (!p.areaRange || areaRangeOf(x.area).id === p.areaRange) &&
        x.purchaseDate >= p.dateFrom &&
        x.purchaseDate <= p.dateTo,
    );
    const g = groupBy(src, (x) => `${x.region}\u0000${x.propertyType}`);
    const rows: ReportRow[] = [...g.entries()]
      .map(([k, items]) => {
        const [region, propertyType] = k.split('\u0000');
        const v = items.map((x) => x.pricePerM2);
        return { region: p.settlement ? `${region} (${p.settlement})` : region, propertyType, mean: mean(v)!, median: median(v)!, count: v.length };
      })
      .sort((a, b) => a.region.localeCompare(b.region, 'ru') || PROPERTY_TYPES.indexOf(a.propertyType as never) - PROPERTY_TYPES.indexOf(b.propertyType as never));
    const allV = src.map((x) => x.pricePerM2);
    const now = new Date();
    const stamp = `${toISODate(now).replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const hasDemo = src.some((x) => x.isDemo);
    setReport({
      rows,
      hasDemo,
      total: allV.length ? { region: 'Итого по выборке', propertyType: '', mean: mean(allV)!, median: median(allV)!, count: allV.length } : null,
      meta: {
        number: `СП-${stamp}`,
        createdAt: now.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        params: [
          ['Регион', p.region || 'Все регионы'],
          ['Населённый пункт', p.settlement || 'Все'],
          ['Тип помещения', p.propertyType || 'Все типы'],
          ['Диапазон площади', AREA_RANGES.find((a) => a.id === p.areaRange)?.label ?? 'Любой'],
          ['Период', `${fmtDate(p.dateFrom)} – ${fmtDate(p.dateTo)}`],
        ],
        source: `Накопительная база цен ИС «Мониторинг стоимости аренды»: фактические ставки по заключённым договорам аренды и завершённым закупкам АО «Казахтелеком» (${allV.length} объектов).${hasDemo ? ' В выборку включены демонстрационные данные.' : ''}`,
        note: `Цена за 1 м² = ежемесячная стоимость аренды / площадь помещения. Ценовой ориентир определяется как медиана сопоставимых фактических ставок за последние ${settings.benchmarkMonths} мес. и носит рекомендательный характер.`,
      },
    });
  };

  const set = (k: keyof Params, v: string) => setP((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-4">
      <Card title="Параметры справки" className="no-print">
        <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] items-end gap-3">
          <Field label="Регион">
            <Select value={p.region} onChange={(e) => setP({ ...p, region: e.target.value, settlement: '' })}>
              <option value="">Все регионы</option>
              {REGION_NAMES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Населённый пункт">
            <Select value={p.settlement} onChange={(e) => set('settlement', e.target.value)} disabled={!p.region}>
              <option value="">Все</option>
              {settlements.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Тип помещения">
            <Select value={p.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
              <option value="">Все типы</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Диапазон площади">
            <Select value={p.areaRange} onChange={(e) => set('areaRange', e.target.value)}>
              <option value="">Любой</option>
              {AREA_RANGES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Период с">
            <Input type="date" value={p.dateFrom} max={today} onChange={(e) => set('dateFrom', e.target.value)} />
          </Field>
          <Field label="Период по">
            <Input type="date" value={p.dateTo} max={today} onChange={(e) => set('dateTo', e.target.value)} />
          </Field>
          <Button variant="primary" onClick={generate}>
            <FileText size={15} /> Сформировать справку
          </Button>
        </div>
        {error && (
          <div className="mt-3">
            <Notice kind="danger">{error}</Notice>
          </div>
        )}
      </Card>

      {report && (
        <>
          <div className="flex justify-end gap-2 no-print">
            <Button onClick={() => exportReportXlsx(report.total ? [...report.rows, report.total] : report.rows, report.meta)} disabled={!report.rows.length}>
              <FileSpreadsheet size={15} /> Скачать Excel
            </Button>
            <Button
              disabled={!report.rows.length || pdfBusy}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await exportReportPdf(report.rows, report.meta, report.total);
                } catch (e) {
                  notify('error', e instanceof Error ? e.message : 'Ошибка формирования PDF');
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              <FileDown size={15} /> {pdfBusy ? 'Формирование…' : 'Скачать PDF'}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer size={15} /> Печать
            </Button>
          </div>

          <article className="print-area mx-auto max-w-[900px] rounded-lg border border-line bg-white px-14 py-10 text-[13px] text-slate-800">
            <div className="flex items-center justify-between border-b-2 border-kt-600 pb-2">
              <div className="flex items-center gap-2">
                <img src="./kazakhtelecom-logo.png" alt="" className="h-7 w-7 object-contain" />
                <span className="font-semibold text-kt-800">АО «Казахтелеком»</span>
              </div>
              <span className="text-xs text-slate-500">Мониторинг стоимости аренды</span>
            </div>
            <div className="mt-6 text-center">
              <div className="text-lg font-bold tracking-wide">СПРАВКА</div>
              <div className="font-semibold">о стоимости аренды помещений за 1 м²</div>
              <div className="mt-1 text-slate-600">
                № {report.meta.number} от {report.meta.createdAt}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-1 font-semibold">Параметры формирования:</div>
              <table className="text-[13px]">
                <tbody>
                  {report.meta.params.map(([k, v]) => (
                    <tr key={k}>
                      <td className="w-48 py-0.5 pr-4 text-slate-500">{k}</td>
                      <td className="py-0.5">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5">
              {report.rows.length === 0 ? (
                <Empty>По выбранным параметрам данные в базе цен отсутствуют</Empty>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-kt-600 text-white">
                      {['Регион', 'Тип помещения', 'Средняя цена, ₸/м²', 'Медианная цена, ₸/м²', 'Количество объектов'].map((h, i) => (
                        <th key={h} className={`border border-kt-700 px-2.5 py-2 font-semibold ${i >= 2 ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.region + r.propertyType} className="odd:bg-white even:bg-kt-50/50">
                        <td className="border border-line px-2.5 py-1.5">{r.region}</td>
                        <td className="border border-line px-2.5 py-1.5">{r.propertyType}</td>
                        <td className="border border-line px-2.5 py-1.5 text-right tabular-nums">{fmtInt(r.mean)}</td>
                        <td className="border border-line px-2.5 py-1.5 text-right tabular-nums">{fmtInt(r.median)}</td>
                        <td className="border border-line px-2.5 py-1.5 text-right tabular-nums">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  {report.total && (
                    <tfoot>
                      <tr className="bg-kt-100 font-semibold">
                        <td className="border border-line px-2.5 py-1.5" colSpan={2}>
                          {report.total.region}
                        </td>
                        <td className="border border-line px-2.5 py-1.5 text-right tabular-nums">{fmtInt(report.total.mean)}</td>
                        <td className="border border-line px-2.5 py-1.5 text-right tabular-nums">{fmtInt(report.total.median)}</td>
                        <td className="border border-line px-2.5 py-1.5 text-right tabular-nums">{report.total.count}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            <div className="mt-5 space-y-1.5 text-[12px] leading-relaxed text-slate-700">
              <p>
                <b>Источник информации:</b> {report.meta.source}
              </p>
              <p>
                <b>Примечание:</b> {report.meta.note}
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-8 text-[12px]">
              <div>
                Исполнитель: ______________________
                <div className="mt-6">Дата: «____» ______________ 20___ г.</div>
              </div>
              <div className="text-right text-slate-500">Сформировано автоматически</div>
            </div>
          </article>
        </>
      )}
    </div>
  );
}
