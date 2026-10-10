import * as XLSX from 'xlsx';
import type { MarketOffer, PriceRecord, PropertyType, RentRequest } from '../types';
import { PROPERTY_TYPES, REGION_NAMES, STATUS_LABELS } from './constants';
import { parseNumber, toDateStamp } from './format';
import type { MarketInput, PriceInput } from '../store/DataContext';

function download(wb: XLSX.WorkBook, name: string) {
  XLSX.writeFile(wb, name, { compression: true });
}

function sheet(rows: (string | number | null)[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  return ws;
}

export function exportRequestsXlsx(rows: RentRequest[]) {
  const data = [
    ['№ заявки', 'Дата', 'Регион', 'Населённый пункт', 'Тип помещения', 'Адрес', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Цена за 1 м², ₸', 'Ценовой ориентир, ₸', 'Отклонение, %', 'Статус', 'Поставщик', 'Демо'],
    ...rows.map((r) => [
      r.number,
      r.createdAt.slice(0, 10),
      r.region,
      r.settlement,
      r.propertyType,
      r.address,
      r.area,
      r.monthlyCost,
      r.pricePerM2,
      r.benchmark,
      r.deviation,
      STATUS_LABELS[r.status],
      r.supplier,
      r.isDemo ? 'да' : '',
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(data, [14, 11, 26, 18, 16, 34, 10, 14, 12, 14, 11, 22, 28, 6]), 'Заявки');
  download(wb, `Заявки_${toDateStamp()}.xlsx`);
}

const PRICE_HEADERS = ['Регион', 'Населённый пункт', 'Тип помещения', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Дата закупки', 'Источник данных'];
const MARKET_HEADERS = ['Регион', 'Населённый пункт', 'Адрес объекта', 'Тип помещения', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Дата объявления', 'Источник', 'Ссылка на объявление'];

export function exportPricesXlsx(rows: PriceRecord[]) {
  const data = [
    [...PRICE_HEADERS, 'Цена за 1 м², ₸', 'Демо'],
    ...rows.map((r) => [r.region, r.settlement, r.propertyType, r.area, r.monthlyCost, r.purchaseDate, r.source, r.pricePerM2, r.isDemo ? 'да' : '']),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(data, [26, 18, 16, 11, 16, 12, 30, 12, 6]), 'База цен');
  download(wb, `База_цен_${toDateStamp()}.xlsx`);
}

export function exportMarketXlsx(rows: MarketOffer[]) {
  const data = [
    [...MARKET_HEADERS, 'Цена за 1 м², ₸', 'Демо'],
    ...rows.map((r) => [r.region, r.settlement, r.address, r.propertyType, r.area, r.monthlyCost, r.listingDate, r.source, r.url, r.pricePerM2, r.isDemo ? 'да' : '']),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(data, [26, 18, 34, 16, 11, 16, 12, 22, 30, 12, 6]), 'Рыночные предложения');
  download(wb, `Рыночные_предложения_${toDateStamp()}.xlsx`);
}

export function downloadTemplate(kind: 'prices' | 'market') {
  const wb = XLSX.utils.book_new();
  const example =
    kind === 'prices'
      ? [PRICE_HEADERS, ['Актюбинская область', 'Актобе', 'Производственное', 300, 600000, '15.03.2026', 'Договор аренды № 123']]
      : [MARKET_HEADERS, ['г. Астана', 'Астана', 'Астана, пр. Республики, 1', 'Офисное', 120, 900000, '01.10.2026', 'Krisha.kz (вручную)', 'https://krisha.kz/…']];
  XLSX.utils.book_append_sheet(wb, sheet(example, example[0].map(() => 20)), 'Данные');
  const help = [
    ['Допустимые типы помещений'],
    ...PROPERTY_TYPES.map((t) => [t]),
    [''],
    ['Регионы'],
    ...REGION_NAMES.map((r) => [r]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(help, [34]), 'Справочники');
  download(wb, kind === 'prices' ? 'Шаблон_база_цен.xlsx' : 'Шаблон_рыночные_предложения.xlsx');
}

// ---------------------------------------------------------------------------
// Импорт
// ---------------------------------------------------------------------------

export interface ImportResult<T> {
  rows: T[];
  errors: { row: number; message: string }[];
}

const normHeader = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

function pickCol(headers: string[], ...aliases: string[]): number {
  const hs = headers.map((h) => normHeader(String(h ?? '')));
  for (const a of aliases) {
    const i = hs.findIndex((h) => h.startsWith(normHeader(a)));
    if (i !== -1) return i;
  }
  return -1;
}

function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

function matchType(v: unknown): PropertyType | null {
  const s = String(v ?? '').trim().toLowerCase();
  return PROPERTY_TYPES.find((t) => t.toLowerCase() === s || s.startsWith(t.toLowerCase().slice(0, 5))) ?? null;
}

function matchRegion(v: unknown): string | null {
  const s = normHeader(String(v ?? ''));
  if (!s) return null;
  return REGION_NAMES.find((r) => normHeader(r) === s) ?? REGION_NAMES.find((r) => normHeader(r).includes(s) || s.includes(normHeader(r).replace('область', ''))) ?? null;
}

async function readRows(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Файл не содержит листов');
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: null });
}

interface Common {
  region: string;
  settlement: string;
  propertyType: PropertyType;
  area: number;
  monthlyCost: number;
  date: string;
}

function parseCommon(row: unknown[], c: Record<string, number>, rowNo: number, errors: ImportResult<unknown>['errors']): Common | null {
  const msgs: string[] = [];
  const region = matchRegion(row[c.region]);
  if (!region) msgs.push(`регион «${row[c.region] ?? ''}» не распознан`);
  const settlement = String(row[c.settlement] ?? '').trim();
  if (!settlement) msgs.push('не указан населённый пункт');
  const propertyType = matchType(row[c.type]);
  if (!propertyType) msgs.push(`тип помещения «${row[c.type] ?? ''}» не распознан`);
  const area = parseNumber(row[c.area] as string);
  if (!(area > 0)) msgs.push('некорректная площадь');
  const monthlyCost = parseNumber(row[c.cost] as string);
  if (!(monthlyCost > 0)) msgs.push('некорректная стоимость');
  const date = parseDate(row[c.date]);
  if (!date) msgs.push('некорректная дата');
  if (msgs.length) {
    errors.push({ row: rowNo, message: msgs.join('; ') });
    return null;
  }
  return { region: region!, settlement, propertyType: propertyType!, area, monthlyCost, date: date! };
}

export async function importPricesFile(file: File): Promise<ImportResult<PriceInput>> {
  const all = await readRows(file);
  if (all.length < 2) throw new Error('В файле нет данных');
  const h = all[0].map(String);
  const c = {
    region: pickCol(h, 'регион', 'область'),
    settlement: pickCol(h, 'населенный', 'город', 'нп'),
    type: pickCol(h, 'тип'),
    area: pickCol(h, 'площадь'),
    cost: pickCol(h, 'ежемесячн', 'стоимость', 'сумма'),
    date: pickCol(h, 'дата'),
    source: pickCol(h, 'источник'),
  };
  const missing = Object.entries(c).filter(([k, v]) => v === -1 && k !== 'source');
  if (missing.length) throw new Error(`Не найдены обязательные столбцы. Используйте шаблон: ${PRICE_HEADERS.join(', ')}`);
  const out: ImportResult<PriceInput> = { rows: [], errors: [] };
  all.slice(1).forEach((row, i) => {
    const base = parseCommon(row, c, i + 2, out.errors);
    if (!base) return;
    out.rows.push({
      region: base.region,
      settlement: base.settlement,
      propertyType: base.propertyType,
      area: base.area,
      monthlyCost: base.monthlyCost,
      purchaseDate: base.date,
      source: (c.source >= 0 && String(row[c.source] ?? '').trim()) || `Импорт Excel (${file.name})`,
    });
  });
  return out;
}

export async function importMarketFile(file: File): Promise<ImportResult<MarketInput>> {
  const all = await readRows(file);
  if (all.length < 2) throw new Error('В файле нет данных');
  const h = all[0].map(String);
  const c = {
    region: pickCol(h, 'регион', 'область'),
    settlement: pickCol(h, 'населенный', 'город'),
    address: pickCol(h, 'адрес'),
    type: pickCol(h, 'тип'),
    area: pickCol(h, 'площадь'),
    cost: pickCol(h, 'ежемесячн', 'стоимость', 'цена'),
    date: pickCol(h, 'дата'),
    source: pickCol(h, 'источник'),
    url: pickCol(h, 'ссылка', 'url'),
  };
  const required = ['region', 'settlement', 'address', 'type', 'area', 'cost', 'date'] as const;
  if (required.some((k) => c[k] === -1)) throw new Error(`Не найдены обязательные столбцы. Используйте шаблон: ${MARKET_HEADERS.join(', ')}`);
  const out: ImportResult<MarketInput> = { rows: [], errors: [] };
  all.slice(1).forEach((row, i) => {
    const base = parseCommon(row, c, i + 2, out.errors);
    if (!base) return;
    const address = String(row[c.address] ?? '').trim();
    if (!address) {
      out.errors.push({ row: i + 2, message: 'не указан адрес' });
      return;
    }
    const url = c.url >= 0 ? String(row[c.url] ?? '').trim() : '';
    out.rows.push({
      region: base.region,
      settlement: base.settlement,
      address,
      propertyType: base.propertyType,
      area: base.area,
      monthlyCost: base.monthlyCost,
      listingDate: base.date,
      source: (c.source >= 0 && String(row[c.source] ?? '').trim()) || 'Импорт Excel',
      url: /^https?:\/\//i.test(url) ? url : '',
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Справка
// ---------------------------------------------------------------------------

export interface ReportRow {
  region: string;
  propertyType: string;
  mean: number;
  median: number;
  count: number;
}

export interface ReportMeta {
  number: string;
  createdAt: string;
  params: [string, string][];
  source: string;
  note: string;
}

export function exportReportXlsx(rows: ReportRow[], meta: ReportMeta) {
  const data: (string | number | null)[][] = [
    ['АО «Казахтелеком»'],
    ['Справка о стоимости аренды помещений за 1 м²'],
    [`№ ${meta.number} от ${meta.createdAt}`],
    [],
    ['Параметры формирования'],
    ...meta.params.map(([k, v]) => [k, v]),
    [],
    ['Регион', 'Тип помещения', 'Средняя цена, ₸/м²', 'Медианная цена, ₸/м²', 'Количество объектов'],
    ...rows.map((r) => [r.region, r.propertyType, Math.round(r.mean), Math.round(r.median), r.count]),
    [],
    ['Источник информации', meta.source],
    ['Примечание', meta.note],
  ];
  const ws = sheet(data, [34, 22, 18, 20, 18]);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Справка');
  download(wb, `Справка_аренда_${toDateStamp()}.xlsx`);
}
