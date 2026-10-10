/**
 * Демонстрационные данные. Все цены, заявки и предложения — условные (ДЕМО)
 * и не отражают фактические договоры АО «Казахтелеком».
 */
import type { MarketOffer, PriceRecord, PropertyType, Remark, RentRequest, RequestStatus, Settings } from '../types';
import { DEFAULT_SETTINGS, PROPERTY_TYPES } from './constants';
import { complianceOf, computeBenchmark, deviationPercent, pricePerM2, toISODate } from './stats';
import { uid } from './format';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Базовая ставка за 1 м² офисного помещения в основном городе региона (₸/мес, демо). */
const REGION_BASE: { region: string; main: string; base: number; secondary: string[] }[] = [
  { region: 'г. Астана', main: 'Астана', base: 6500, secondary: [] },
  { region: 'г. Алматы', main: 'Алматы', base: 7200, secondary: [] },
  { region: 'г. Шымкент', main: 'Шымкент', base: 4200, secondary: [] },
  { region: 'Актюбинская область', main: 'Актобе', base: 5000, secondary: ['Хромтау', 'Кандыагаш'] },
  { region: 'Атырауская область', main: 'Атырау', base: 5800, secondary: ['Кульсары'] },
  { region: 'Карагандинская область', main: 'Караганда', base: 4200, secondary: ['Темиртау', 'Балхаш'] },
  { region: 'Мангистауская область', main: 'Актау', base: 5400, secondary: ['Жанаозен'] },
  { region: 'Павлодарская область', main: 'Павлодар', base: 3800, secondary: ['Экибастуз'] },
  { region: 'Восточно-Казахстанская область', main: 'Усть-Каменогорск', base: 3900, secondary: ['Риддер'] },
  { region: 'Костанайская область', main: 'Костанай', base: 3500, secondary: ['Рудный'] },
  { region: 'Акмолинская область', main: 'Кокшетау', base: 3400, secondary: ['Щучинск'] },
  { region: 'Туркестанская область', main: 'Туркестан', base: 3000, secondary: ['Кентау'] },
  { region: 'Западно-Казахстанская область', main: 'Уральск', base: 3700, secondary: [] },
];

const TYPE_FACTOR: Record<PropertyType, number> = {
  Офисное: 1,
  Административное: 0.9,
  Жилое: 0.75,
  Производственное: 0.4,
  Складское: 0.32,
  Техническое: 0.55,
  Другое: 0.6,
};

const TYPE_AREA: Record<PropertyType, [number, number]> = {
  Жилое: [35, 120],
  Офисное: [25, 400],
  Административное: [50, 600],
  Производственное: [150, 1500],
  Складское: [100, 2000],
  Техническое: [8, 150],
  Другое: [20, 300],
};

const DEMO_SOURCE = 'Договор аренды (демо)';

export interface DemoData {
  prices: PriceRecord[];
  market: MarketOffer[];
  requests: RentRequest[];
}

export function generateDemoData(now = new Date(), settings: Settings = DEFAULT_SETTINGS): DemoData {
  const rnd = mulberry32(20261010);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const daysAgo = (d: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() - Math.round(d));
    return x;
  };
  const createdAt = now.toISOString();

  // ---------- База цен ----------
  const prices: PriceRecord[] = [];
  const addPrice = (region: string, settlement: string, type: PropertyType, area: number, ppm: number, date: Date) => {
    const monthlyCost = Math.round((ppm * area) / 100) * 100;
    prices.push({
      id: uid(),
      region,
      settlement,
      propertyType: type,
      area,
      monthlyCost,
      pricePerM2: pricePerM2(monthlyCost, area),
      purchaseDate: toISODate(date),
      source: DEMO_SOURCE,
      requestId: null,
      isDemo: true,
      createdAt,
    });
  };

  for (const rb of REGION_BASE) {
    const settlements: [string, number, number][] = [[rb.main, 1, 7], ...rb.secondary.map((s): [string, number, number] => [s, 0.72, 3])];
    for (const [settlement, sFactor, perType] of settlements) {
      const types = sFactor === 1 ? PROPERTY_TYPES : PROPERTY_TYPES.filter((t) => t !== 'Жилое' && t !== 'Другое');
      for (const type of types) {
        const n = perType + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const age = between(5, 600); // дней назад
          const trend = 1 - (age / 30) * 0.007; // рост ставок ~0,7% в месяц
          // Для контрольного примера (Актобе, производственное) диапазон 250–500 м² заполняется отдельно.
          const control = settlement === 'Актобе' && type === 'Производственное';
          const [amin, amax] = control ? [600, 1500] : TYPE_AREA[type];
          const area = Math.round(between(amin, amax));
          const ppm = rb.base * TYPE_FACTOR[type] * sFactor * trend * between(0.86, 1.14);
          addPrice(rb.region, settlement, type, area, ppm, daysAgo(age));
        }
      }
    }
  }
  // Контрольный пример: Актобе, производственные помещения 250–500 м², медиана 2 000 ₸/м².
  [1850, 1900, 1950, 2000, 2000, 2050, 2100, 2150].forEach((p, i) =>
    addPrice('Актюбинская область', 'Актобе', 'Производственное', 260 + i * 30, p, daysAgo(20 + i * 35)),
  );
  // Недостаточно данных: Жамбылская область — только две записи.
  addPrice('Жамбылская область', 'Тараз', 'Офисное', 120, 3100, daysAgo(80));
  addPrice('Жамбылская область', 'Тараз', 'Офисное', 75, 3300, daysAgo(140));

  // ---------- Рыночные предложения ----------
  const streets = ['ул. Абая', 'пр. Республики', 'ул. Сейфуллина', 'ул. Желтоксан', 'пр. Назарбаева', 'ул. Байтурсынова', 'мкр. Самал', 'ул. Ауэзова', 'ул. Пушкина', 'пр. Тауелсиздик'];
  const market: MarketOffer[] = [];
  for (const rb of REGION_BASE) {
    const n = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const type = pick(PROPERTY_TYPES);
      const [amin, amax] = TYPE_AREA[type];
      const area = Math.round(between(amin, amax));
      const ppm = rb.base * TYPE_FACTOR[type] * between(1.0, 1.25);
      const monthlyCost = Math.round((ppm * area) / 1000) * 1000;
      market.push({
        id: uid(),
        region: rb.region,
        settlement: rb.main,
        address: `${rb.main}, ${pick(streets)}, ${1 + Math.floor(rnd() * 180)}`,
        propertyType: type,
        area,
        monthlyCost,
        pricePerM2: pricePerM2(monthlyCost, area),
        listingDate: toISODate(daysAgo(between(1, 75))),
        source: 'Ручной ввод (демо)',
        url: '',
        isDemo: true,
        createdAt,
      });
    }
  }

  // ---------- Заявки ----------
  type Spec = [string, string, PropertyType, number, number | null, RequestStatus, string, number];
  // регион, н.п., тип, площадь, коэффициент к ориентиру (null — фиксированная сумма), статус, адрес, дней назад
  const specs: Spec[] = [
    ['Актюбинская область', 'Актобе', 'Производственное', 300, null, 'justification_requested', 'Актобе, промзона, ул. Промышленная, 12', 3],
    ['г. Астана', 'Астана', 'Офисное', 180, 1.18, 'justification_received', 'Астана, пр. Республики, 34', 12],
    ['г. Астана', 'Астана', 'Административное', 420, 0.94, 'approved', 'Астана, ул. Сыганак, 18', 40],
    ['г. Алматы', 'Алматы', 'Офисное', 95, 1.32, 'justification_requested', 'Алматы, ул. Желтоксан, 115', 6],
    ['г. Алматы', 'Алматы', 'Техническое', 24, 0.88, 'approved', 'Алматы, мкр. Самал-2, 58', 55],
    ['г. Шымкент', 'Шымкент', 'Складское', 640, 1.08, 'review', 'Шымкент, ул. Капал батыра, 5', 2],
    ['г. Шымкент', 'Шымкент', 'Офисное', 140, 0.97, 'review', 'Шымкент, пр. Тауке хана, 41', 1],
    ['Атырауская область', 'Атырау', 'Офисное', 210, 1.15, 'justification_received', 'Атырау, ул. Сатпаева, 27', 18],
    ['Атырауская область', 'Атырау', 'Техническое', 40, 0.92, 'approved', 'Атырау, ул. Азаттык, 61', 70],
    ['Карагандинская область', 'Караганда', 'Административное', 380, 1.05, 'review', 'Караганда, пр. Бухар-Жырау, 47', 4],
    ['Карагандинская область', 'Темиртау', 'Складское', 900, 0.9, 'approved', 'Темиртау, ул. Металлургов, 3', 85],
    ['Мангистауская область', 'Актау', 'Офисное', 120, 1.22, 'rejected', 'Актау, 14 мкр., 9', 60],
    ['Мангистауская область', 'Жанаозен', 'Техническое', 30, 0.95, 'review', 'Жанаозен, ул. Сатпаева, 2', 5],
    ['Павлодарская область', 'Павлодар', 'Офисное', 160, 1.0, 'approved', 'Павлодар, ул. Торайгырова, 64', 33],
    ['Павлодарская область', 'Экибастуз', 'Производственное', 520, 1.12, 'justification_requested', 'Экибастуз, ул. Энергетиков, 21', 9],
    ['Восточно-Казахстанская область', 'Усть-Каменогорск', 'Административное', 260, 0.91, 'approved', 'Усть-Каменогорск, ул. Казахстан, 88', 47],
    ['Восточно-Казахстанская область', 'Риддер', 'Техническое', 18, 1.27, 'review', 'Риддер, ул. Гагарина, 10', 7],
    ['Костанайская область', 'Костанай', 'Складское', 1200, 0.86, 'approved', 'Костанай, ул. Карбышева, 140', 95],
    ['Костанайская область', 'Рудный', 'Офисное', 75, 1.09, 'review', 'Рудный, ул. 50 лет Октября, 31', 3],
    ['Акмолинская область', 'Кокшетау', 'Жилое', 65, 0.96, 'approved', 'Кокшетау, ул. Абая, 102', 28],
    ['Акмолинская область', 'Щучинск', 'Административное', 150, 1.35, 'justification_requested', 'Щучинск, ул. Ленина, 15', 11],
    ['Туркестанская область', 'Туркестан', 'Офисное', 110, 0.99, 'review', 'Туркестан, пр. Тауке хана, 7', 2],
    ['Западно-Казахстанская область', 'Уральск', 'Складское', 450, 1.14, 'justification_received', 'Уральск, ул. Монкеулы, 76', 15],
    ['Жамбылская область', 'Тараз', 'Офисное', 130, null, 'review', 'Тараз, ул. Толе би, 39', 1],
    ['Кызылординская область', 'Кызылорда', 'Техническое', 22, null, 'review', 'Кызылорда, ул. Айтеке би, 50', 8],
  ];

  const fixedCost: Record<number, number> = { 0: 750_000, 23: 455_000, 24: 66_000 };
  const year = now.getFullYear();
  const requests: RentRequest[] = specs.map((s, idx) => {
    const [region, settlement, type, area, factor, status, address, ago] = s;
    const created = daysAgo(ago);
    const bench = computeBenchmark(prices, { region, settlement, propertyType: type, area, asOf: created }, settings);
    let monthlyCost = fixedCost[idx];
    if (monthlyCost === undefined) {
      const base = bench.value ?? 3000;
      monthlyCost = Math.round((area * base * (factor ?? 1)) / 1000) * 1000;
    }
    const ppm = pricePerM2(monthlyCost, area);
    const dev = deviationPercent(ppm, bench.value);
    const remarks: Remark[] = [];
    if (status === 'justification_requested' || status === 'justification_received' || status === 'rejected') {
      remarks.push({
        id: uid(),
        role: 'specialist',
        author: 'Специалист по закупкам',
        text: `Заявленная стоимость превышает ценовой ориентир на ${dev?.toFixed(1).replace('.', ',')}%. Просим представить обоснование цены (сравнительные предложения, особенности объекта).`,
        createdAt: new Date(created.getTime() + 3600_000 * 5).toISOString(),
        attachments: [],
      });
    }
    if (status === 'justification_received') {
      remarks.push({
        id: uid(),
        role: 'customer',
        author: 'Заказчик (структурное подразделение)',
        text: 'Объект расположен рядом с узлом связи, имеет выделенную электрическую мощность и охраняемую территорию. Альтернативные предложения в районе отсутствуют.',
        createdAt: new Date(created.getTime() + 86_400_000 * 2).toISOString(),
        attachments: [],
      });
    }
    return {
      id: uid(),
      number: `АР-${year}-${String(idx + 1).padStart(4, '0')}`,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      region,
      settlement,
      propertyType: type,
      address,
      area,
      monthlyCost,
      supplier: `ТОО «Демо-арендодатель ${idx + 1}»`,
      notes: 'Демонстрационная заявка.',
      pricePerM2: ppm,
      benchmark: bench.value,
      benchmarkCount: bench.count,
      benchmarkLevel: bench.level,
      deviation: dev,
      compliance: complianceOf(dev, settings.tolerancePercent),
      status,
      remarks,
      addedToPriceBase: false,
      isDemo: true,
    };
  });

  return { prices, market, requests };
}
