import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MarketOffer, PriceRecord, RentRequest, Settings } from '../types';
import { DEFAULT_SETTINGS } from './constants';

export interface AppData {
  requests: RentRequest[];
  prices: PriceRecord[];
  market: MarketOffer[];
  settings: Settings;
  /** true, если хранилище пустое и ещё ни разу не инициализировалось. */
  empty: boolean;
}

export interface Repository {
  readonly kind: 'local' | 'supabase';
  readonly label: string;
  load(): Promise<AppData>;
  saveRequests(items: RentRequest[]): Promise<void>;
  deleteRequest(id: string): Promise<void>;
  savePrices(items: PriceRecord[]): Promise<void>;
  deletePrices(ids: string[]): Promise<void>;
  saveMarket(items: MarketOffer[]): Promise<void>;
  deleteMarket(ids: string[]): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  clearAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Локальное хранилище браузера (работает без сервера)
// ---------------------------------------------------------------------------

const LS_PREFIX = 'kt-rent-monitoring:v1:';

class LocalRepository implements Repository {
  readonly kind = 'local' as const;
  readonly label = 'Локальная база данных браузера';

  private read<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        throw new Error('Превышен объём локального хранилища браузера. Удалите крупные вложения или подключите Supabase.');
      }
      throw e;
    }
  }

  private upsert<T extends { id: string }>(key: string, items: T[]) {
    const all = this.read<T[]>(key, []);
    const idx = new Map(all.map((x, i) => [x.id, i]));
    for (const it of items) {
      const i = idx.get(it.id);
      if (i === undefined) all.push(it);
      else all[i] = it;
    }
    this.write(key, all);
  }

  private remove<T extends { id: string }>(key: string, ids: string[]) {
    const set = new Set(ids);
    this.write(key, this.read<T[]>(key, []).filter((x) => !set.has(x.id)));
  }

  async load(): Promise<AppData> {
    const initialized = localStorage.getItem(LS_PREFIX + 'initialized') !== null;
    return {
      requests: this.read('requests', []),
      prices: this.read('prices', []),
      market: this.read('market', []),
      settings: { ...DEFAULT_SETTINGS, ...this.read<Partial<Settings>>('settings', {}) },
      empty: !initialized,
    };
  }
  async saveRequests(items: RentRequest[]) {
    this.upsert('requests', items);
    localStorage.setItem(LS_PREFIX + 'initialized', '1');
  }
  async deleteRequest(id: string) {
    this.remove('requests', [id]);
  }
  async savePrices(items: PriceRecord[]) {
    this.upsert('prices', items);
    localStorage.setItem(LS_PREFIX + 'initialized', '1');
  }
  async deletePrices(ids: string[]) {
    this.remove('prices', ids);
  }
  async saveMarket(items: MarketOffer[]) {
    this.upsert('market', items);
  }
  async deleteMarket(ids: string[]) {
    this.remove('market', ids);
  }
  async saveSettings(s: Settings) {
    this.write('settings', s);
  }
  async clearAll() {
    for (const k of ['requests', 'prices', 'market']) localStorage.removeItem(LS_PREFIX + k);
    localStorage.setItem(LS_PREFIX + 'initialized', '1');
  }
}

// ---------------------------------------------------------------------------
// Supabase / PostgreSQL (схема — supabase/schema.sql)
// ---------------------------------------------------------------------------

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function rowToDb(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[toSnake(k)] = v;
  return out;
}
function rowFromDb<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // numeric-колонки PostgreSQL могут возвращаться строками
    out[toCamel(k)] = typeof v === 'string' && /^(area|monthly_cost|price_per_m2|benchmark|deviation)$/.test(k) ? Number(v) : v;
  }
  return out as T;
}

class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;
  readonly label = 'Supabase (PostgreSQL)';
  constructor(private db: SupabaseClient) {}

  private async all<T>(table: string): Promise<T[]> {
    const out: T[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await this.db.from(table).select('*').range(from, from + page - 1);
      if (error) throw new Error(`Ошибка чтения таблицы ${table}: ${error.message}`);
      out.push(...(data ?? []).map((r) => rowFromDb<T>(r)));
      if (!data || data.length < page) break;
    }
    return out;
  }
  private async upsert(table: string, items: object[]) {
    for (let i = 0; i < items.length; i += 500) {
      const { error } = await this.db.from(table).upsert(items.slice(i, i + 500).map(rowToDb));
      if (error) throw new Error(`Ошибка сохранения в ${table}: ${error.message}`);
    }
  }
  private async remove(table: string, ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await this.db.from(table).delete().in('id', ids);
    if (error) throw new Error(`Ошибка удаления из ${table}: ${error.message}`);
  }

  async load(): Promise<AppData> {
    const [requests, prices, market, settingsRows] = await Promise.all([
      this.all<RentRequest>('rent_requests'),
      this.all<PriceRecord>('price_records'),
      this.all<MarketOffer>('market_offers'),
      this.db.from('app_settings').select('*').eq('id', 'default'),
    ]);
    if (settingsRows.error) throw new Error(`Ошибка чтения настроек: ${settingsRows.error.message}`);
    const stored = settingsRows.data?.[0]?.data as Partial<Settings> | undefined;
    return {
      requests,
      prices,
      market,
      settings: { ...DEFAULT_SETTINGS, ...(stored ?? {}) },
      empty: !stored && requests.length === 0 && prices.length === 0,
    };
  }
  saveRequests(items: RentRequest[]) {
    return this.upsert('rent_requests', items);
  }
  deleteRequest(id: string) {
    return this.remove('rent_requests', [id]);
  }
  savePrices(items: PriceRecord[]) {
    return this.upsert('price_records', items);
  }
  deletePrices(ids: string[]) {
    return this.remove('price_records', ids);
  }
  saveMarket(items: MarketOffer[]) {
    return this.upsert('market_offers', items);
  }
  deleteMarket(ids: string[]) {
    return this.remove('market_offers', ids);
  }
  async saveSettings(s: Settings) {
    const { error } = await this.db.from('app_settings').upsert({ id: 'default', data: s });
    if (error) throw new Error(`Ошибка сохранения настроек: ${error.message}`);
  }
  async clearAll() {
    for (const t of ['rent_requests', 'price_records', 'market_offers']) {
      const { error } = await this.db.from(t).delete().neq('id', '');
      if (error) throw new Error(`Ошибка очистки ${t}: ${error.message}`);
    }
  }
}

export function createRepository(): Repository {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) return new SupabaseRepository(createClient(url, key));
  return new LocalRepository();
}
