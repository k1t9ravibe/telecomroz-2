import { useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { EMPTY_REQUEST_FILTER, RequestFilters, applyRequestFilter, type RequestFilterState } from '../components/RequestFilters';
import RequestsTable from '../components/RequestsTable';
import RequestDrawer from '../components/RequestDrawer';
import RequestForm from '../components/RequestForm';
import { Button, Card, Notice } from '../components/ui';
import { exportRequestsXlsx } from '../lib/excel';

export default function Requests() {
  const { requests, settings } = useData();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<RequestFilterState>(EMPTY_REQUEST_FILTER);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (params.get('new')) {
      setCreating(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const rows = applyRequestFilter(requests, filter);
  const open = requests.find((r) => r.id === openId);
  const awaiting = requests.filter((r) => r.status === 'justification_requested');

  return (
    <div className="space-y-4">
      {settings.role === 'customer' && awaiting.length > 0 && (
        <Notice kind="warning" title={`Запрошено обоснование цены по заявкам: ${awaiting.length}`}>
          Откройте заявку, чтобы предоставить пояснение и прикрепить подтверждающие документы: {awaiting.map((r) => r.number).join(', ')}.
        </Notice>
      )}
      <RequestFilters value={filter} onChange={setFilter} requests={requests} showSearch />
      <Card
        title={`Реестр заявок (${rows.length})`}
        actions={
          <>
            <Button size="sm" onClick={() => exportRequestsXlsx(rows)} disabled={!rows.length}>
              <Download size={14} /> Excel
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> Создать заявку
            </Button>
          </>
        }
        bodyClassName="p-0"
      >
        <RequestsTable rows={rows} onOpen={(r) => setOpenId(r.id)} selectedId={openId ?? undefined} />
      </Card>
      {creating && (
        <RequestForm
          onClose={() => setCreating(false)}
          onSaved={(r) => {
            setCreating(false);
            setOpenId(r.id);
          }}
        />
      )}
      {open && <RequestDrawer request={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
