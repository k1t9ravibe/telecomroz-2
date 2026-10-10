import { useRef, useState } from 'react';
import { Check, FileUp, MessageSquareWarning, Paperclip, Pencil, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import type { Attachment, RentRequest } from '../types';
import { useData } from '../store/DataContext';
import { fmtDateTime, fmtMoney, fmtNum, fmtPercent, fmtSize, uid } from '../lib/format';
import { EvaluationSummary } from './Evaluation';
import { Button, DemoTag, Drawer, Notice, StatusBadge, Textarea, cx } from './ui';
import RequestForm from './RequestForm';

const MAX_FILE = 2 * 1024 * 1024;

function readFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve({ id: uid(), name: file.name, size: file.size, type: file.type, dataUrl: String(fr.result) });
    fr.onerror = () => reject(new Error(`Не удалось прочитать файл ${file.name}`));
    fr.readAsDataURL(file);
  });
}

export default function RequestDrawer({ request, onClose }: { request: RentRequest; onClose: () => void }) {
  const { settings, addRemark, setRequestStatus, recalcRequest, deleteRequest, notify } = useData();
  const [editing, setEditing] = useState(false);
  const [composer, setComposer] = useState<null | 'request' | 'reply' | 'comment'>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const isSpecialist = settings.role === 'specialist';
  const r = request;
  const closed = r.status === 'approved' || r.status === 'rejected';

  const openComposer = (mode: 'request' | 'reply' | 'comment') => {
    setComposer(mode);
    setFiles([]);
    setText(
      mode === 'request'
        ? `Заявленная стоимость аренды (${fmtMoney(r.pricePerM2)} за 1 м²) ${
            r.deviation !== null && r.deviation > 0 ? `превышает ценовой ориентир (${fmtMoney(r.benchmark)}) на ${fmtPercent(r.deviation, false)}` : 'требует подтверждения'
          }. Просим представить обоснование цены: коммерческие предложения, сведения об особенностях помещения, расчёт стоимости.`
        : '',
    );
  };

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    const out: Attachment[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE) {
        notify('error', `Файл «${f.name}» превышает 2 МБ`);
        continue;
      }
      try {
        out.push(await readFile(f));
      } catch (e) {
        notify('error', (e as Error).message);
      }
    }
    setFiles((x) => [...x, ...out]);
  };

  const send = async () => {
    if (!text.trim()) {
      notify('error', 'Введите текст замечания или пояснения');
      return;
    }
    const status = composer === 'request' ? 'justification_requested' : composer === 'reply' ? 'justification_received' : undefined;
    const ok = await addRemark(
      r.id,
      {
        role: settings.role,
        author: isSpecialist ? settings.userName || 'Специалист по закупкам' : 'Заказчик (инициатор закупки)',
        text: text.trim(),
        attachments: files,
      },
      status,
    );
    if (ok) {
      notify('success', composer === 'request' ? 'Запрос обоснования направлен Заказчику' : composer === 'reply' ? 'Пояснение Заказчика сохранено' : 'Комментарий добавлен');
      setComposer(null);
    }
  };

  return (
    <Drawer
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          Заявка {r.number}
          {r.isDemo && <DemoTag />}
          <StatusBadge status={r.status} />
        </span>
      }
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <Item label="Регион" value={r.region} />
          <Item label="Населённый пункт" value={r.settlement} />
          <Item label="Тип помещения" value={r.propertyType} />
          <Item label="Площадь" value={`${fmtNum(r.area)} м²`} />
          <Item label="Адрес помещения" value={r.address} wide />
          <Item label="Ежемесячная стоимость аренды" value={fmtMoney(r.monthlyCost)} />
          <Item label="Потенциальный поставщик" value={r.supplier} />
          {r.notes && <Item label="Дополнительная информация" value={r.notes} wide />}
          <Item label="Создана" value={fmtDateTime(r.createdAt)} />
          <Item label="Изменена" value={fmtDateTime(r.updatedAt)} />
        </dl>

        <EvaluationSummary ev={r} months={settings.benchmarkMonths} minCount={settings.minComparables} />

        <div className="flex flex-wrap gap-2 border-y border-line py-3">
          {isSpecialist && !closed && (
            <Button variant={r.compliance === 'over' ? 'primary' : 'secondary'} onClick={() => openComposer('request')}>
              <MessageSquareWarning size={15} /> Запросить обоснование цены
            </Button>
          )}
          {!isSpecialist && r.status === 'justification_requested' && (
            <Button variant="primary" onClick={() => openComposer('reply')}>
              <FileUp size={15} /> Предоставить пояснение
            </Button>
          )}
          {isSpecialist && !closed && (
            <>
              <Button variant="success" onClick={() => setRequestStatus(r.id, 'approved')}>
                <Check size={15} /> Согласовать
              </Button>
              <Button variant="danger" onClick={() => setRequestStatus(r.id, 'rejected')}>
                <X size={15} /> Отклонить
              </Button>
            </>
          )}
          {isSpecialist && closed && (
            <Button onClick={() => setRequestStatus(r.id, 'review')}>
              <Undo2 size={15} /> Вернуть на рассмотрение
            </Button>
          )}
          <Button onClick={() => openComposer('comment')}>Комментарий</Button>
          {!closed && (
            <Button onClick={() => setEditing(true)}>
              <Pencil size={15} /> Редактировать
            </Button>
          )}
          <Button onClick={() => recalcRequest(r.id)} title="Пересчитать ориентир по актуальной базе цен">
            <RefreshCw size={15} /> Пересчитать
          </Button>
          {isSpecialist && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(`Удалить заявку ${r.number}?`)) {
                  deleteRequest(r.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={15} />
            </Button>
          )}
        </div>

        {r.addedToPriceBase && <Notice kind="info">Сведения по заявке добавлены в базу цен как завершённая закупка.</Notice>}

        {composer && (
          <div className="rounded-md border border-kt-300 bg-kt-50/60 p-3">
            <div className="mb-2 text-sm font-semibold text-kt-800">
              {composer === 'request' ? 'Замечание Заказчику: запрос обоснования цены' : composer === 'reply' ? 'Пояснение Заказчика' : 'Комментарий'}
            </div>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files).then(() => (e.target.value = ''))} />
              <Button size="sm" onClick={() => fileInput.current?.click()}>
                <Paperclip size={14} /> Прикрепить документы
              </Button>
              {files.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 text-xs">
                  {f.name} ({fmtSize(f.size)})
                  <button onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} className="text-slate-400 hover:text-red-600" aria-label="Убрать">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <div className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => setComposer(null)}>
                  Отмена
                </Button>
                <Button size="sm" variant="primary" onClick={send}>
                  Отправить
                </Button>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Замечания и обоснование цены</h3>
          {r.remarks.length === 0 ? (
            <div className="text-sm text-slate-500">Замечаний по заявке нет.</div>
          ) : (
            <ol className="space-y-2.5">
              {r.remarks.map((m) => (
                <li key={m.id} className={cx('rounded-md border px-3 py-2.5 text-sm', m.role === 'specialist' ? 'border-amber-200 bg-amber-50/60' : 'border-violet-200 bg-violet-50/60')}>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{m.author}</span>
                    <span>{fmtDateTime(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{m.text}</p>
                  {m.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.attachments.map((a) => (
                        <a key={a.id} href={a.dataUrl} download={a.name} className="inline-flex items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 text-xs text-kt-700 hover:underline">
                          <Paperclip size={12} /> {a.name} ({fmtSize(a.size)})
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {editing && <RequestForm initial={r} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </Drawer>
  );
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
