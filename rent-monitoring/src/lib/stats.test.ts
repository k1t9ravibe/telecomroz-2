import { describe, expect, it } from 'vitest';
import { complianceOf, computeBenchmark, deviationPercent, median, pricePerM2 } from './stats';
import { generateDemoData } from './seed';
import { DEFAULT_SETTINGS } from './constants';
import type { PriceRecord } from '../types';

const rec = (p: Partial<PriceRecord>): PriceRecord => ({
  id: Math.random().toString(36),
  region: 'Актюбинская область',
  settlement: 'Актобе',
  propertyType: 'Производственное',
  area: 300,
  monthlyCost: 600000,
  pricePerM2: 2000,
  purchaseDate: '2026-09-01',
  source: 'test',
  requestId: null,
  isDemo: false,
  createdAt: '',
  ...p,
});

describe('расчёты', () => {
  it('цена за 1 м² и пример из ТЗ', () => {
    expect(pricePerM2(750000, 300)).toBe(2500);
    expect(deviationPercent(2500, 2000)).toBe(25);
    expect(complianceOf(25, 0)).toBe('over');
    expect(complianceOf(-3, 0)).toBe('within');
    expect(complianceOf(null, 0)).toBe('nodata');
  });

  it('медиана', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('ориентир — медиана за 12 месяцев, старые записи не учитываются', () => {
    const asOf = new Date('2026-10-10');
    const recs = [rec({ pricePerM2: 1800 }), rec({ pricePerM2: 2000 }), rec({ pricePerM2: 2200 }), rec({ pricePerM2: 9000, purchaseDate: '2024-01-01' })];
    const b = computeBenchmark(recs, { region: 'Актюбинская область', settlement: 'Актобе', propertyType: 'Производственное', area: 300, asOf }, DEFAULT_SETTINGS);
    expect(b.value).toBe(2000);
    expect(b.count).toBe(3);
    expect(b.level).toBe('settlement_type_area');
  });

  it('недостаточно данных', () => {
    const b = computeBenchmark([rec({})], { region: 'Актюбинская область', settlement: 'Актобе', propertyType: 'Производственное', area: 300, asOf: new Date('2026-10-10') }, DEFAULT_SETTINGS);
    expect(b.value).toBeNull();
  });

  it('демо-данные: ≥20 заявок всех категорий и контрольный пример', () => {
    const d = generateDemoData(new Date('2026-10-10'));
    expect(d.requests.length).toBeGreaterThanOrEqual(20);
    expect(d.requests.some((r) => r.compliance === 'over')).toBe(true);
    expect(d.requests.some((r) => r.compliance === 'within')).toBe(true);
    expect(d.requests.some((r) => r.status === 'review')).toBe(true);
    const ex = d.requests[0];
    expect(ex.pricePerM2).toBe(2500);
    expect(ex.benchmark).toBe(2000);
    expect(ex.deviation).toBe(25);
    expect(d.requests.every((r) => r.isDemo)).toBe(true);
  });
});
