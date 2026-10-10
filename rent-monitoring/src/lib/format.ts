const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf0.format(n));
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf2.format(n));
export const fmtMoney = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${nf0.format(n)} ₸`);
export const fmtPercent = (n: number | null | undefined, signed = true) => {
  if (n === null || n === undefined) return '—';
  const s = nf1.format(Math.abs(n));
  if (!signed) return `${nf1.format(n)}%`;
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}%`;
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${nf1.format(bytes / 1024)} КБ`;
  return `${nf1.format(bytes / 1024 / 1024)} МБ`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Разбор числа, введённого пользователем: «750 000», «2500,5». */
export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return Number.NaN;
  const s = v.replace(/[\s ₸]/g, '').replace(',', '.');
  if (s === '') return Number.NaN;
  return Number(s);
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

/** Метка даты для имён файлов: 2026-10-10. */
export function toDateStamp(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
