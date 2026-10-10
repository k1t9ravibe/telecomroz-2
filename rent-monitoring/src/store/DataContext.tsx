import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MarketOffer, PriceRecord, Remark, RentRequest, RequestStatus, Settings } from '../types';
import { createRepository, type Repository } from '../lib/storage';
import { DEFAULT_SETTINGS, SOURCE_COMPLETED } from '../lib/constants';
import { complianceOf, computeBenchmark, deviationPercent, pricePerM2, toISODate } from '../lib/stats';
import { generateDemoData } from '../lib/seed';
import { uid } from '../lib/format';

export interface RequestInput {
  region: string;
  settlement: string;
  propertyType: RentRequest['propertyType'];
  address: string;
  area: number;
  monthlyCost: number;
  supplier: string;
  notes: string;
}

export type PriceInput = Omit<PriceRecord, 'id' | 'pricePerM2' | 'createdAt' | 'isDemo' | 'requestId'> & { id?: string };
export type MarketInput = Omit<MarketOffer, 'id' | 'pricePerM2' | 'createdAt' | 'isDemo'> & { id?: string };

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface DataContextValue {
  ready: boolean;
  loadError: string | null;
  repo: Repository;
  requests: RentRequest[];
  prices: PriceRecord[];
  market: MarketOffer[];
  settings: Settings;
  toasts: Toast[];
  notify: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: string) => void;
  evaluate: (input: Pick<RequestInput, 'region' | 'settlement' | 'propertyType' | 'area' | 'monthlyCost'>, excludeRequestId?: string) => Evaluation;
  createRequest: (input: RequestInput) => Promise<RentRequest | null>;
  updateRequest: (id: string, input: RequestInput) => Promise<RentRequest | null>;
  recalcRequest: (id: string, silent?: boolean) => Promise<void>;
  setRequestStatus: (id: string, status: RequestStatus) => Promise<void>;
  addRemark: (id: string, remark: Omit<Remark, 'id' | 'createdAt'>, status?: RequestStatus) => Promise<boolean>;
  deleteRequest: (id: string) => Promise<void>;
  savePrice: (input: PriceInput) => Promise<boolean>;
  importPrices: (inputs: PriceInput[]) => Promise<boolean>;
  deletePrices: (ids: string[]) => Promise<void>;
  saveMarket: (input: MarketInput) => Promise<boolean>;
  importMarket: (inputs: MarketInput[]) => Promise<boolean>;
  deleteMarket: (ids: string[]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetDemo: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export interface Evaluation {
  pricePerM2: number;
  benchmark: number | null;
  benchmarkCount: number;
  benchmarkLevel: RentRequest['benchmarkLevel'];
  periodFrom: string;
  periodTo: string;
  deviation: number | null;
  compliance: RentRequest['compliance'];
}

const Ctx = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createRepository(), []);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RentRequest[]>([]);
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [market, setMarket] = useState<MarketOffer[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Актуальные значения для асинхронных действий
  const state = useRef({ requests, prices, market, settings });
  state.current = { requests, prices, market, settings };

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = uid();
      setToasts((t) => [...t, { id, kind, text }]);
      setTimeout(() => dismissToast(id), kind === 'error' ? 8000 : 4000);
    },
    [dismissToast],
  );

  const guard = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        return true;
      } catch (e) {
        notify('error', e instanceof Error ? e.message : 'Не удалось сохранить данные');
        return false;
      }
    },
    [notify],
  );

  const seedDemo = useCallback(async () => {
    const demo = generateDemoData(new Date(), state.current.settings);
    await repo.saveRequests(demo.requests);
    await repo.savePrices(demo.prices);
    await repo.saveMarket(demo.market);
    setRequests(demo.requests);
    setPrices(demo.prices);
    setMarket(demo.market);
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await repo.load();
        if (cancelled) return;
        setSettings(data.settings);
        state.current.settings = data.settings;
        if (data.empty) {
          await seedDemo();
        } else {
          setRequests(data.requests);
          setPrices(data.prices);
          setMarket(data.market);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, seedDemo]);

  const evaluate = useCallback<DataContextValue['evaluate']>((input, excludeRequestId) => {
    const s = state.current.settings;
    const ppm = pricePerM2(input.monthlyCost, input.area);
    const b = computeBenchmark(state.current.prices, { ...input, excludeRequestId }, s);
    const dev = deviationPercent(ppm, b.value);
    return {
      pricePerM2: ppm,
      benchmark: b.value,
      benchmarkCount: b.count,
      benchmarkLevel: b.level,
      periodFrom: b.periodFrom,
      periodTo: b.periodTo,
      deviation: dev,
      compliance: complianceOf(dev, s.tolerancePercent),
    };
  }, []);

  const persistRequest = useCallback(
    async (r: RentRequest) => {
      const ok = await guard(() => repo.saveRequests([r]));
      if (ok) {
        setRequests((list) => {
          const i = list.findIndex((x) => x.id === r.id);
          if (i === -1) return [r, ...list];
          const copy = [...list];
          copy[i] = r;
          return copy;
        });
      }
      return ok;
    },
    [guard, repo],
  );

  const nextNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `АР-${year}-`;
    const max = state.current.requests
      .filter((r) => r.number.startsWith(prefix))
      .reduce((m, r) => Math.max(m, Number(r.number.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  };

  const applyEvaluation = (r: RentRequest): RentRequest => {
    const ev = evaluate(r, r.id);
    return {
      ...r,
      pricePerM2: ev.pricePerM2,
      benchmark: ev.benchmark,
      benchmarkCount: ev.benchmarkCount,
      benchmarkLevel: ev.benchmarkLevel,
      deviation: ev.deviation,
      compliance: ev.compliance,
    };
  };

  const createRequest: DataContextValue['createRequest'] = async (input) => {
    const now = new Date().toISOString();
    const r = applyEvaluation({
      ...input,
      id: uid(),
      number: nextNumber(),
      createdAt: now,
      updatedAt: now,
      pricePerM2: 0,
      benchmark: null,
      benchmarkCount: 0,
      benchmarkLevel: null,
      deviation: null,
      compliance: 'nodata',
      status: 'review',
      remarks: [],
      addedToPriceBase: false,
      isDemo: false,
    });
    return (await persistRequest(r)) ? r : null;
  };

  const updateRequest: DataContextValue['updateRequest'] = async (id, input) => {
    const cur = state.current.requests.find((x) => x.id === id);
    if (!cur) return null;
    const r = applyEvaluation({ ...cur, ...input, updatedAt: new Date().toISOString() });
    return (await persistRequest(r)) ? r : null;
  };

  const recalcRequest: DataContextValue['recalcRequest'] = async (id, silent) => {
    const cur = state.current.requests.find((x) => x.id === id);
    if (!cur) return;
    if ((await persistRequest(applyEvaluation({ ...cur, updatedAt: new Date().toISOString() }))) && !silent) {
      notify('success', `Заявка ${cur.number} пересчитана по актуальной базе цен`);
    }
  };

  const setRequestStatus: DataContextValue['setRequestStatus'] = async (id, status) => {
    const cur = state.current.requests.find((x) => x.id === id);
    if (!cur) return;
    let next: RentRequest = { ...cur, status, updatedAt: new Date().toISOString() };
    const s = state.current.settings;
    if (status === 'approved' && s.autoAddApproved && !cur.addedToPriceBase) {
      const rec: PriceRecord = {
        id: uid(),
        region: cur.region,
        settlement: cur.settlement,
        propertyType: cur.propertyType,
        area: cur.area,
        monthlyCost: cur.monthlyCost,
        pricePerM2: cur.pricePerM2,
        purchaseDate: toISODate(new Date()),
        source: `${SOURCE_COMPLETED} (заявка ${cur.number})`,
        requestId: cur.id,
        isDemo: cur.isDemo,
        createdAt: new Date().toISOString(),
      };
      // Сначала сохраняем заявку (на неё ссылается запись базы цен)
      next = { ...next, addedToPriceBase: true };
      if (!(await persistRequest(next))) return;
      if (await guard(() => repo.savePrices([rec]))) {
        setPrices((p) => [...p, rec]);
        notify('success', `Заявка ${cur.number} согласована и добавлена в базу цен`);
      }
      return;
    }
    if (await persistRequest(next)) notify('success', `Статус заявки ${cur.number}: обновлён`);
  };

  const addRemark: DataContextValue['addRemark'] = async (id, remark, status) => {
    const cur = state.current.requests.find((x) => x.id === id);
    if (!cur) return false;
    const full: Remark = { ...remark, id: uid(), createdAt: new Date().toISOString() };
    return persistRequest({
      ...cur,
      remarks: [...cur.remarks, full],
      status: status ?? cur.status,
      updatedAt: full.createdAt,
    });
  };

  const deleteRequest: DataContextValue['deleteRequest'] = async (id) => {
    if (await guard(() => repo.deleteRequest(id))) {
      setRequests((l) => l.filter((r) => r.id !== id));
      setPrices((p) => p.map((x) => (x.requestId === id ? { ...x, requestId: null } : x)));
      notify('info', 'Заявка удалена');
    }
  };

  const toPrice = (input: PriceInput): PriceRecord => {
    const existing = input.id ? state.current.prices.find((p) => p.id === input.id) : undefined;
    return {
      region: input.region,
      settlement: input.settlement,
      propertyType: input.propertyType,
      area: input.area,
      monthlyCost: input.monthlyCost,
      purchaseDate: input.purchaseDate,
      source: input.source,
      id: existing?.id ?? uid(),
      pricePerM2: pricePerM2(input.monthlyCost, input.area),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      isDemo: existing?.isDemo ?? false,
      requestId: existing?.requestId ?? null,
    };
  };

  const upsertLocal = <T extends { id: string }>(list: T[], items: T[]) => {
    const m = new Map(list.map((x) => [x.id, x]));
    for (const it of items) m.set(it.id, it);
    return [...m.values()];
  };

  const importPrices: DataContextValue['importPrices'] = async (inputs) => {
    const recs = inputs.map(toPrice);
    const ok = await guard(() => repo.savePrices(recs));
    if (ok) setPrices((p) => upsertLocal(p, recs));
    return ok;
  };
  const savePrice: DataContextValue['savePrice'] = (input) => importPrices([input]);

  const deletePrices: DataContextValue['deletePrices'] = async (ids) => {
    if (await guard(() => repo.deletePrices(ids))) {
      const set = new Set(ids);
      setPrices((p) => p.filter((x) => !set.has(x.id)));
      notify('info', `Удалено записей: ${ids.length}`);
    }
  };

  const toOffer = (input: MarketInput): MarketOffer => {
    const existing = input.id ? state.current.market.find((p) => p.id === input.id) : undefined;
    return {
      region: input.region,
      settlement: input.settlement,
      address: input.address,
      propertyType: input.propertyType,
      area: input.area,
      monthlyCost: input.monthlyCost,
      listingDate: input.listingDate,
      source: input.source,
      url: input.url,
      id: existing?.id ?? uid(),
      pricePerM2: pricePerM2(input.monthlyCost, input.area),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      isDemo: existing?.isDemo ?? false,
    };
  };

  const importMarket: DataContextValue['importMarket'] = async (inputs) => {
    const recs = inputs.map(toOffer);
    const ok = await guard(() => repo.saveMarket(recs));
    if (ok) setMarket((p) => upsertLocal(p, recs));
    return ok;
  };
  const saveMarket: DataContextValue['saveMarket'] = (input) => importMarket([input]);

  const deleteMarket: DataContextValue['deleteMarket'] = async (ids) => {
    if (await guard(() => repo.deleteMarket(ids))) {
      const set = new Set(ids);
      setMarket((p) => p.filter((x) => !set.has(x.id)));
      notify('info', `Удалено предложений: ${ids.length}`);
    }
  };

  const updateSettings: DataContextValue['updateSettings'] = async (patch) => {
    const next = { ...state.current.settings, ...patch };
    if (await guard(() => repo.saveSettings(next))) {
      setSettings(next);
      state.current.settings = next;
    }
  };

  const clearAll: DataContextValue['clearAll'] = async () => {
    if (await guard(() => repo.clearAll())) {
      setRequests([]);
      setPrices([]);
      setMarket([]);
      notify('info', 'Все данные удалены');
    }
  };

  const resetDemo: DataContextValue['resetDemo'] = async () => {
    if (await guard(() => repo.clearAll().then(seedDemo))) notify('success', 'Демонстрационные данные восстановлены');
  };

  const value: DataContextValue = {
    ready,
    loadError,
    repo,
    requests,
    prices,
    market,
    settings,
    toasts,
    notify,
    dismissToast,
    evaluate,
    createRequest,
    updateRequest,
    recalcRequest,
    setRequestStatus,
    addRemark,
    deleteRequest,
    savePrice,
    importPrices,
    deletePrices,
    saveMarket,
    importMarket,
    deleteMarket,
    updateSettings,
    resetDemo,
    clearAll,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
