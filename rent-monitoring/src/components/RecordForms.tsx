import { useMemo, useState } from 'react';
import type { MarketOffer, PriceRecord, PropertyType } from '../types';
import { PROPERTY_TYPES, REGIONS, REGION_NAMES } from '../lib/constants';
import { fmtMoney, parseNumber } from '../lib/format';
import { pricePerM2, toISODate } from '../lib/stats';
import { useData, type MarketInput, type PriceInput } from '../store/DataContext';
import { Button, Field, Input, Modal, Select } from './ui';

interface Base {
  region: string;
  settlement: string;
  propertyType: PropertyType | '';
  area: string;
  monthlyCost: string;
  date: string;
  source: string;
  address: string;
  url: string;
}

function validate(f: Base, market: boolean) {
  const e: Partial<Record<keyof Base, string>> = {};
  if (!f.region) e.region = 'Выберите регион';
  if (!f.settlement.trim()) e.settlement = 'Укажите населённый пункт';
  if (!f.propertyType) e.propertyType = 'Выберите тип';
  const area = parseNumber(f.area);
  if (!(area > 0) || area > 100000) e.area = 'Некорректная площадь';
  const cost = parseNumber(f.monthlyCost);
  if (!(cost > 0)) e.monthlyCost = 'Некорректная стоимость';
  if (!f.date) e.date = 'Укажите дату';
  else if (f.date > toISODate(new Date())) e.date = 'Дата не может быть в будущем';
  if (!f.source.trim()) e.source = 'Укажите источник';
  if (market && !f.address.trim()) e.address = 'Укажите адрес';
  if (market && f.url && !/^https?:\/\/\S+$/i.test(f.url.trim())) e.url = 'Ссылка должна начинаться с http:// или https://';
  return { e, area, cost };
}

function useSettlements(region: string) {
  const { prices, market } = useData();
  return useMemo(() => {
    const s = new Set(REGIONS[region] ?? []);
    prices.forEach((p) => p.region === region && s.add(p.settlement));
    market.forEach((p) => p.region === region && s.add(p.settlement));
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [region, prices, market]);
}

function RecordForm({
  title,
  market,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  market: boolean;
  initial: Base;
  onClose: () => void;
  onSubmit: (f: Base, area: number, cost: number) => Promise<boolean>;
}) {
  const [f, setF] = useState<Base>(initial);
  const [touched, setTouched] = useState(false);
  const { e, area, cost } = validate(f, market);
  const settlements = useSettlements(f.region);
  const set = (k: keyof Base, v: string) => setF((s) => ({ ...s, [k]: v }));
  const err = (k: keyof Base) => (touched ? e[k] : undefined);

  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            onClick={async () => {
              setTouched(true);
              if (Object.keys(e).length) return;
              if (await onSubmit(f, area, cost)) onClose();
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Регион" required error={err('region')}>
          <Select value={f.region} onChange={(ev) => setF((s) => ({ ...s, region: ev.target.value, settlement: '' }))}>
            <option value="">— выберите —</option>
            {REGION_NAMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Населённый пункт" required error={err('settlement')}>
          <Input list="rec-settlements" value={f.settlement} onChange={(ev) => set('settlement', ev.target.value)} disabled={!f.region} />
          <datalist id="rec-settlements">
            {settlements.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        {market && (
          <Field label="Адрес объекта" required error={err('address')} className="col-span-2">
            <Input value={f.address} onChange={(ev) => set('address', ev.target.value)} />
          </Field>
        )}
        <Field label="Тип помещения" required error={err('propertyType')}>
          <Select value={f.propertyType} onChange={(ev) => set('propertyType', ev.target.value)}>
            <option value="">— выберите —</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Площадь, м²" required error={err('area')}>
          <Input inputMode="decimal" value={f.area} onChange={(ev) => set('area', ev.target.value)} />
        </Field>
        <Field label="Ежемесячная стоимость, ₸" required error={err('monthlyCost')}>
          <Input inputMode="decimal" value={f.monthlyCost} onChange={(ev) => set('monthlyCost', ev.target.value)} />
        </Field>
        <Field label={market ? 'Дата объявления' : 'Дата закупки'} required error={err('date')}>
          <Input type="date" value={f.date} max={toISODate(new Date())} onChange={(ev) => set('date', ev.target.value)} />
        </Field>
        <Field label={market ? 'Источник' : 'Источник данных'} required error={err('source')} className={market ? '' : 'col-span-2'}>
          <Input value={f.source} onChange={(ev) => set('source', ev.target.value)} placeholder={market ? 'Krisha.kz (вручную), OLX, агентство…' : 'Договор аренды № …, протокол закупки …'} />
        </Field>
        {market && (
          <Field label="Ссылка на объявление" error={err('url')}>
            <Input value={f.url} onChange={(ev) => set('url', ev.target.value)} placeholder="https://" />
          </Field>
        )}
        <div className="col-span-2 rounded-md border border-line bg-kt-50/60 px-3 py-2 text-sm">
          Цена за 1 м² (рассчитывается автоматически): <b className="tabular-nums">{area > 0 && cost > 0 ? fmtMoney(pricePerM2(cost, area)) : '—'}</b>
        </div>
      </div>
    </Modal>
  );
}

export function PriceRecordForm({ record, onClose }: { record?: PriceRecord; onClose: () => void }) {
  const { savePrice, notify } = useData();
  return (
    <RecordForm
      title={record ? 'Редактирование записи базы цен' : 'Добавление записи в базу цен'}
      market={false}
      onClose={onClose}
      initial={{
        region: record?.region ?? '',
        settlement: record?.settlement ?? '',
        propertyType: record?.propertyType ?? '',
        area: record ? String(record.area) : '',
        monthlyCost: record ? String(record.monthlyCost) : '',
        date: record?.purchaseDate ?? toISODate(new Date()),
        source: record?.source ?? '',
        address: '',
        url: '',
      }}
      onSubmit={async (f, area, cost) => {
        const input: PriceInput = {
          id: record?.id,
          region: f.region,
          settlement: f.settlement.trim(),
          propertyType: f.propertyType as PropertyType,
          area,
          monthlyCost: cost,
          purchaseDate: f.date,
          source: f.source.trim(),
        };
        const ok = await savePrice(input);
        if (ok) notify('success', record ? 'Запись обновлена' : 'Запись добавлена в базу цен');
        return ok;
      }}
    />
  );
}

export function MarketOfferForm({ offer, onClose }: { offer?: MarketOffer; onClose: () => void }) {
  const { saveMarket, notify } = useData();
  return (
    <RecordForm
      title={offer ? 'Редактирование рыночного предложения' : 'Добавление рыночного предложения'}
      market
      onClose={onClose}
      initial={{
        region: offer?.region ?? '',
        settlement: offer?.settlement ?? '',
        propertyType: offer?.propertyType ?? '',
        area: offer ? String(offer.area) : '',
        monthlyCost: offer ? String(offer.monthlyCost) : '',
        date: offer?.listingDate ?? toISODate(new Date()),
        source: offer?.source ?? 'Krisha.kz (ручной ввод)',
        address: offer?.address ?? '',
        url: offer?.url ?? '',
      }}
      onSubmit={async (f, area, cost) => {
        const input: MarketInput = {
          id: offer?.id,
          region: f.region,
          settlement: f.settlement.trim(),
          address: f.address.trim(),
          propertyType: f.propertyType as PropertyType,
          area,
          monthlyCost: cost,
          listingDate: f.date,
          source: f.source.trim(),
          url: f.url.trim(),
        };
        const ok = await saveMarket(input);
        if (ok) notify('success', offer ? 'Предложение обновлено' : 'Предложение добавлено');
        return ok;
      }}
    />
  );
}
