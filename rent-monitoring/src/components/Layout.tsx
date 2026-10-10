import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Database, FileSpreadsheet, FileText, LayoutDashboard, Loader2, Search, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { useData } from '../store/DataContext';
import { Notice, Select, Toasts } from './ui';
import type { UserRole } from '../types';

const NAV = [
  { to: '/', label: 'Главная', icon: LayoutDashboard, end: true },
  { to: '/requests', label: 'Заявки', icon: FileText },
  { to: '/prices', label: 'База цен', icon: Database },
  { to: '/market', label: 'Рыночный мониторинг', icon: Search },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/reports', label: 'Справки', icon: FileSpreadsheet },
  { to: '/settings', label: 'Настройки', icon: SettingsIcon },
];

export default function Layout() {
  const { ready, loadError, settings, updateSettings, repo, requests } = useData();
  const loc = useLocation();
  const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  const hasDemo = requests.some((r) => r.isDemo);

  return (
    <div className="app-shell flex h-full min-w-[1180px]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white no-print">
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-4">
          <img src="./kazakhtelecom-logo.png" alt="" className="h-8 w-8 object-contain" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-kt-800">Казахтелеком</div>
            <div className="text-[11px] text-slate-500">Закупки из одного источника</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-kt-600 font-medium text-white' : 'text-slate-600 hover:bg-kt-50 hover:text-kt-700'
                }`
              }
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${loadError ? 'bg-red-500' : 'bg-emerald-500'}`} />
            {repo.label}
          </div>
          {hasDemo && <div className="mt-1 text-amber-700">Демонстрационный режим</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-white px-6 no-print">
          <div>
            <h1 className="text-lg font-semibold text-kt-800">Мониторинг стоимости аренды</h1>
            <div className="text-xs text-slate-500">АО «Казахтелеком» · {current?.label ?? ''}</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <UserRound size={18} className="text-kt-600" />
            <Select
              aria-label="Роль пользователя"
              className="w-60"
              value={settings.role}
              onChange={(e) => updateSettings({ role: e.target.value as UserRole })}
            >
              <option value="specialist">Специалист по закупкам</option>
              <option value="customer">Заказчик (инициатор закупки)</option>
            </Select>
          </div>
        </header>
        <main className="app-main flex-1 overflow-y-auto px-6 py-5">
          {!ready ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={16} /> Загрузка данных…
            </div>
          ) : loadError ? (
            <Notice kind="danger" title="Не удалось загрузить данные из базы">
              {loadError}. Проверьте подключение к Supabase и наличие таблиц (supabase/schema.sql).
            </Notice>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <Toasts />
    </div>
  );
}
