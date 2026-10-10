import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import type { PropertyType, RentRequest } from '../types';
import { PROPERTY_TYPES, REGIONS, REGION_NAMES } from '../lib/constants';
import { parseNumber } from '../lib/format';
import { useData, type RequestInput } from '../store/DataContext';
import { EvaluationSummary } from './Evaluation';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

interface FormState {
  region: string;
  settlement: string;
  propertyType: PropertyType | '';
  address: string;
  area: string;
  monthlyCost: string;
  supplier: string;
  notes: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

export function validateRequest(f: FormState): { errors: Errors; value: RequestInput | null } {
  const errors: Errors = {};
  if (!f.region) errors.region = 'Выберите регион';
  if (!f.settlement.trim()) errors.settlement = 'Укажите населённый пункт';
  if (!f.propertyType) errors.propertyType = 'Выберите тип помещения';
  if (!f.address.trim()) errors.address = 'Укажите адрес помещения';
  const area = parseNumber(f.area);
  if (!f.area.trim()) errors.area = 'Укажите площадь';
  else if (!Number.isFinite(area) || area <= 0) errors.area = 'Площадь должна быть положительным числом';
  else if (area > 100000) errors.area = 'Проверьте значение: площадь более 100 000 м²';
  const cost = parseNumber(f.monthlyCost);
  if (!f.monthlyCost.trim()) errors.monthlyCost = 'Укажите стоимость';
  else if (!Number.isFinite(cost) || cost <= 0) errors.monthlyCost = 'Стоимость должна быть положительным числом';
  else if (cost > 1e11) errors.monthlyCost = 'Слишком большое значение';
  if (!f.supplier.trim()) errors.supplier = 'Укажите наименование поставщика';
  if (Object.keys(errors).length) return { errors, value: null };
  return {
    errors,
    value: {
      region: f.region,
      settlement: f.settlement.trim(),
      propertyType: f.propertyType as PropertyType,
      address: f.address.trim(),
      area,
      monthlyCost: cost,
      supplier: f.supplier.trim(),
      notes: f.notes.trim(),
    },
  };
}

export default function RequestForm({ initial, onClose, onSaved }: { initial?: RentRequest; onClose: () => void; onSaved: (r: RentRequest) => void }) {
  const { evaluate, createRequest, updateRequest, prices, settings } = useData();
  const [f, setF] = useState<FormState>(
    initial
      ? {
          region: initial.region,
          settlement: initial.settlement,
          propertyType: initial.propertyType,
          address: initial.address,
          area: String(initial.area),
          monthlyCost: String(initial.monthlyCost),
          supplier: initial.supplier,
          notes: initial.notes,
        }
      : { region: '', settlement: '', propertyType: '', address: '', area: '', monthlyCost: '', supplier: '', notes: '' },
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const { errors, value } = validateRequest(f);
  const set = (k: keyof FormState, v: string) => setF((s) => ({ ...s, [k]: v }));

  const settlements = useMemo(() => {
    const s = new Set(REGIONS[f.region] ?? []);
    prices.forEach((p) => p.region === f.region && s.add(p.settlement));
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [f.region, prices]);

  const calcArea = parseNumber(f.area);
  const calcCost = parseNumber(f.monthlyCost);
  const canCalc = !!f.region && !!f.settlement.trim() && !!f.propertyType && calcArea > 0 && calcCost > 0 && !errors.area && !errors.monthlyCost;
  const ev = canCalc
    ? evaluate({ region: f.region, settlement: f.settlement.trim(), propertyType: f.propertyType as PropertyType, area: calcArea, monthlyCost: calcCost }, initial?.id)
    : null;

  const submit = async () => {
    setTouched(true);
    if (!value) return;
    setSaving(true);
    const saved = initial ? await updateRequest(initial.id, value) : await createRequest(value);
    setSaving(false);
    if (saved) onSaved(saved);
  };

  const err = (k: keyof FormState) => (touched ? errors[k] : undefined);

  return (
    <Modal
      title={initial ? `Редактирование заявки ${initial.number}` : 'Создание заявки на аренду помещения'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {initial ? 'Сохранить изменения' : 'Создать заявку'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Регион" required error={err('region')}>
          <Select value={f.region} invalid={!!err('region')} onChange={(e) => setF((s) => ({ ...s, region: e.target.value, settlement: '' }))}>
            <option value="">— выберите —</option>
            {REGION_NAMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Населённый пункт" required error={err('settlement')} hint="Выберите из списка или введите вручную">
          <Input list="settlements-list" value={f.settlement} invalid={!!err('settlement')} onChange={(e) => set('settlement', e.target.value)} disabled={!f.region} />
          <datalist id="settlements-list">
            {settlements.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Тип помещения" required error={err('propertyType')}>
          <Select value={f.propertyType} invalid={!!err('propertyType')} onChange={(e) => set('propertyType', e.target.value)}>
            <option value="">— выберите —</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Адрес помещения" required error={err('address')}>
          <Input value={f.address} invalid={!!err('address')} onChange={(e) => set('address', e.target.value)} placeholder="Город, улица, дом" />
        </Field>
        <Field label="Площадь помещения, м²" required error={err('area')}>
          <Input inputMode="decimal" value={f.area} invalid={!!err('area')} onChange={(e) => set('area', e.target.value)} placeholder="300" />
        </Field>
        <Field label="Ежемесячная стоимость аренды, ₸" required error={err('monthlyCost')}>
          <Input inputMode="decimal" value={f.monthlyCost} invalid={!!err('monthlyCost')} onChange={(e) => set('monthlyCost', e.target.value)} placeholder="750 000" />
        </Field>
        <Field label="Наименование потенциального поставщика" required error={err('supplier')} className="col-span-2">
          <Input value={f.supplier} invalid={!!err('supplier')} onChange={(e) => set('supplier', e.target.value)} placeholder="ТОО «…»" />
        </Field>
        <Field label="Дополнительная информация" className="col-span-2">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Особенности объекта, срок аренды, коммунальные услуги и т. п." />
        </Field>
      </div>

      <div className="mt-4 rounded-md border border-line p-3.5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-kt-800">
          <Calculator size={16} /> Автоматический расчёт и сравнение с базой цен
        </div>
        {ev ? (
          <EvaluationSummary ev={ev} months={settings.benchmarkMonths} minCount={settings.minComparables} />
        ) : (
          <div className="text-sm text-slate-500">Укажите регион, населённый пункт, тип помещения, площадь и стоимость — расчёт стоимости за 1 м² и сравнение с ценовым ориентиром выполняются автоматически.</div>
        )}
      </div>
    </Modal>
  );
}
