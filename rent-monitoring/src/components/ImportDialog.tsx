import { useRef, useState, type ReactNode } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import type { ImportResult } from '../lib/excel';
import { Button, Modal, Notice } from './ui';

export default function ImportDialog<T>({
  title,
  parse,
  onImport,
  onClose,
  onTemplate,
  preview,
  hint,
}: {
  title: string;
  parse: (f: File) => Promise<ImportResult<T>>;
  onImport: (rows: T[]) => Promise<boolean>;
  onClose: () => void;
  onTemplate: () => void;
  preview: (rows: T[]) => ReactNode;
  hint?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setError(null);
    setResult(null);
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      setError('Поддерживаются файлы Excel (.xlsx, .xls) и CSV');
      return;
    }
    try {
      setResult(await parse(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            disabled={!result?.rows.length || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onImport(result!.rows);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            Загрузить {result?.rows.length ? `(${result.rows.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {hint}
        <div className="flex items-center gap-2">
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0]).then(() => (e.target.value = ''))} />
          <Button variant="primary" onClick={() => input.current?.click()}>
            <Upload size={15} /> Выбрать файл
          </Button>
          <Button onClick={onTemplate}>
            <FileSpreadsheet size={15} /> Скачать шаблон
          </Button>
          {fileName && <span className="text-sm text-slate-600">{fileName}</span>}
        </div>
        {error && <Notice kind="danger" title="Ошибка импорта">{error}</Notice>}
        {result && (
          <>
            <Notice kind={result.errors.length ? 'warning' : 'success'} title={`Распознано строк: ${result.rows.length}; с ошибками: ${result.errors.length}`}>
              {result.errors.length > 0 && 'Строки с ошибками не будут загружены.'}
            </Notice>
            {result.errors.length > 0 && (
              <ul className="max-h-32 overflow-auto rounded border border-line bg-red-50/40 px-3 py-2 text-xs text-red-800">
                {result.errors.slice(0, 100).map((e) => (
                  <li key={e.row}>
                    Строка {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            {result.rows.length > 0 && <div className="max-h-72 overflow-auto rounded border border-line">{preview(result.rows.slice(0, 50))}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}
