import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileText, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { IN_REVIEW_STATUSES } from '../lib/constants';
import { fmtInt } from '../lib/format';
import { EMPTY_REQUEST_FILTER, RequestFilters, applyRequestFilter, type RequestFilterState } from '../components/RequestFilters';
import RequestsTable from '../components/RequestsTable';
import RequestDrawer from '../components/RequestDrawer';
import { Button, Card, Stat, cx } from '../components/ui';

export default function Dashboard() {
  const { requests } = useData();
  const nav = useNavigate();
  const [filter, setFilter] = useState<RequestFilterState>(EMPTY_REQUEST_FILTER);
  const [openId, setOpenId] = useState<string | null>(null);

  const base = applyRequestFilter(requests, filter, { skipCompliance: true });
  const rows = filter.compliance ? base.filter((r) => r.compliance === filter.compliance) : base;
  const over = base.filter((r) => r.compliance === 'over').length;
  const within = base.filter((r) => r.compliance === 'within').length;
  const inReview = base.filter((r) => IN_REVIEW_STATUSES.includes(r.status)).length;
  const open = requests.find((r) => r.id === openId);

  const card = (key: RequestFilterState['compliance'], node: ReactNode) => (
    <button
      className={cx('text-left transition-shadow hover:shadow-md', filter.compliance === key && key !== '' && 'rounded-lg ring-2 ring-kt-400')}
      onClick={() => setFilter((f) => ({ ...f, compliance: f.compliance === key ? '' : key }))}
    >
      {node}
    </button>
  );

  return (
    <div className="space-y-4">
      <RequestFilters value={filter} onChange={setFilter} requests={requests} />

      <div className="grid grid-cols-4 gap-4">
        {card('', <Stat label="Всего заявок" value={fmtInt(base.length)} icon={<FileText size={16} />} sub="по выбранным условиям" />)}
        {card('over', <Stat label="Заявки с превышением цены" value={fmtInt(over)} tone="danger" icon={<AlertTriangle size={16} />} sub={base.length ? `${Math.round((over / base.length) * 100)}% от общего числа` : '—'} />)}
        {card('within', <Stat label="В пределах ценового ориентира" value={fmtInt(within)} tone="success" icon={<CheckCircle2 size={16} />} sub={base.length ? `${Math.round((within / base.length) * 100)}% от общего числа` : '—'} />)}
        <button className={cx('text-left transition-shadow hover:shadow-md', filter.status === 'in_review' && 'rounded-lg ring-2 ring-kt-400')} onClick={() => setFilter((f) => ({ ...f, status: f.status === 'in_review' ? '' : 'in_review' }))}>
          <Stat label="Заявки на рассмотрении" value={fmtInt(inReview)} tone="info" icon={<Clock size={16} />} sub="включая запросы обоснования" />
        </button>
      </div>

      <Card
        title={`Заявки на аренду помещений (${rows.length})`}
        actions={
          <>
            <span className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm border border-red-200 bg-[#fdeeee]" /> превышение ориентира
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm border border-emerald-200 bg-[#ebf8f1]" /> в пределах ориентира
              </span>
            </span>
            <Button variant="primary" size="sm" onClick={() => nav('/requests?new=1')}>
              <Plus size={14} /> Создать заявку
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        <RequestsTable rows={rows} onOpen={(r) => setOpenId(r.id)} selectedId={openId ?? undefined} />
      </Card>

      {open && <RequestDrawer request={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
