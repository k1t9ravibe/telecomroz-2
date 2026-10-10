import { useState } from 'react';
import { Database, RefreshCw, Trash2 } from 'lucide-react';
import { useData } from '../store/DataContext';
import { Button, Card, Field, Input, Notice, Select } from '../components/ui';
import type { Settings } from '../types';

export default function SettingsPage() {
  const { settings, updateSettings, repo, requests, prices, market, resetDemo, clearAll, recalcRequest, notify } = useData();
  const [draft, setDraft] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async () => {
    if (!(draft.benchmarkMonths >= 1 && draft.benchmarkMonths <= 60)) return notify('error', 'Период расчёта ориентира: от 1 до 60 месяцев');
    if (!(draft.minComparables >= 1 && draft.minComparables <= 50)) return notify('error', 'Минимальное число объектов: от 1 до 50');
    if (!(draft.tolerancePercent >= 0 && draft.tolerancePercent <= 100)) return notify('error', 'Допустимое отклонение: от 0 до 100%');
    await updateSettings(draft);
    notify('success', 'Настройки сохранены');
  };

  const recalcAll = async () => {
    setBusy(true);
    const open = requests.filter((r) => r.status !== 'approved' && r.status !== 'rejected');
    for (const r of open) await recalcRequest(r.id, true);
    setBusy(false);
    notify('success', `Пересчитано заявок: ${open.length}`);
  };

  return (
    <div className="grid max-w-6xl grid-cols-2 gap-4">
      <Card title="Параметры ценового ориентира">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Период расчёта, месяцев" hint="Используются фактические ставки за последние N месяцев">
            <Input type="number" min={1} max={60} value={draft.benchmarkMonths} onChange={(e) => setDraft({ ...draft, benchmarkMonths: Number(e.target.value) })} />
          </Field>
          <Field label="Минимум сопоставимых объектов" hint="При меньшем количестве ориентир не формируется">
            <Input type="number" min={1} max={50} value={draft.minComparables} onChange={(e) => setDraft({ ...draft, minComparables: Number(e.target.value) })} />
          </Field>
          <Field label="Допустимое отклонение, %" hint="Превышение фиксируется, если отклонение больше значения">
            <Input type="number" min={0} max={100} step={0.5} value={draft.tolerancePercent} onChange={(e) => setDraft({ ...draft, tolerancePercent: Number(e.target.value) })} />
          </Field>
          <Field label="Расширение выборки" hint="Населённый пункт → регион, с учётом площади и без">
            <Select value={draft.allowFallback ? '1' : '0'} onChange={(e) => setDraft({ ...draft, allowFallback: e.target.value === '1' })}>
              <option value="1">Разрешено</option>
              <option value="0">Только точное совпадение</option>
            </Select>
          </Field>
          <Field label="Пополнение базы цен" className="col-span-2">
            <Select value={draft.autoAddApproved ? '1' : '0'} onChange={(e) => setDraft({ ...draft, autoAddApproved: e.target.value === '1' })}>
              <option value="1">Автоматически добавлять согласованные заявки как завершённые закупки</option>
              <option value="0">Не добавлять автоматически</option>
            </Select>
          </Field>
          <Field label="Имя пользователя (для замечаний)" className="col-span-2">
            <Input value={draft.userName} onChange={(e) => setDraft({ ...draft, userName: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Сохранить настройки
          </Button>
          <Button onClick={recalcAll} disabled={busy || dirty} title={dirty ? 'Сначала сохраните настройки' : ''}>
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Пересчитать заявки на рассмотрении
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Ценовой ориентир носит рекомендательный характер: превышение не блокирует заявку, а сигнализирует о необходимости проверки и, при необходимости, запроса обоснования.</p>
      </Card>

      <div className="space-y-4">
        <Card title="Хранилище данных">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-kt-600" />
              <b>{repo.label}</b>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['Заявок', requests.length],
                ['Записей в базе цен', prices.length],
                ['Рыночных предложений', market.length],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border border-line bg-kt-50/50 py-2">
                  <div className="text-lg font-semibold tabular-nums">{v}</div>
                  <div className="text-[11px] text-slate-500">{l}</div>
                </div>
              ))}
            </div>
            {repo.kind === 'local' ? (
              <Notice kind="info">
                Данные сохраняются в базе браузера и не исчезают после обновления страницы. Для многопользовательской работы подключите Supabase (PostgreSQL): выполните <code>supabase/schema.sql</code> и задайте <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>.
              </Notice>
            ) : (
              <Notice kind="success">Подключена серверная база данных Supabase (PostgreSQL).</Notice>
            )}
          </div>
        </Card>

        <Card title="Внешние интеграции">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              Krisha.kz — рыночные предложения <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Планируется</span>
            </li>
            <li className="flex items-center justify-between">
              Портал закупок — сведения о заключённых договорах <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Планируется</span>
            </li>
            <li className="flex items-center justify-between">
              Импорт/экспорт Excel <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">Доступно</span>
            </li>
          </ul>
        </Card>

        <Card title="Демонстрационный режим">
          <p className="mb-3 text-sm text-slate-600">Демонстрационные заявки, цены и предложения отмечены меткой «демо» и не отражают фактические договоры.</p>
          <div className="flex gap-2">
            <Button onClick={() => window.confirm('Удалить все данные и загрузить демонстрационный набор заново?') && resetDemo()}>
              <RefreshCw size={15} /> Восстановить демо-данные
            </Button>
            <Button variant="danger" onClick={() => window.confirm('Удалить ВСЕ заявки, записи базы цен и рыночные предложения? Действие необратимо.') && clearAll()}>
              <Trash2 size={15} /> Очистить все данные
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
