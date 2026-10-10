import type { ReportMeta, ReportRow } from './excel';
import { fmtInt } from './format';
import { toDateStamp } from './format';

async function loadFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить шрифт для PDF (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Формирует PDF-справку с поддержкой кириллицы (шрифт Liberation Sans, OFL). */
export async function exportReportPdf(rows: ReportRow[], meta: ReportMeta, total: ReportRow | null) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const [regular, bold] = await Promise.all([loadFontBase64('./fonts/LiberationSans-Regular.ttf'), loadFontBase64('./fonts/LiberationSans-Bold.ttf')]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('LiberationSans-Regular.ttf', regular);
  doc.addFont('LiberationSans-Regular.ttf', 'Liberation', 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', bold);
  doc.addFont('LiberationSans-Bold.ttf', 'Liberation', 'bold');
  doc.setFont('Liberation', 'normal');

  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = 18;

  doc.setFontSize(10);
  doc.setTextColor(11, 75, 125);
  doc.text('АО «Казахтелеком»', M, y);
  doc.setTextColor(100);
  doc.text('Мониторинг стоимости аренды', W - M, y, { align: 'right' });
  doc.setDrawColor(10, 114, 192);
  doc.setLineWidth(0.6);
  doc.line(M, y + 2.5, W - M, y + 2.5);

  y += 13;
  doc.setTextColor(20);
  doc.setFont('Liberation', 'bold');
  doc.setFontSize(14);
  doc.text('СПРАВКА', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11.5);
  doc.text('о стоимости аренды помещений за 1 м²', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('Liberation', 'normal');
  doc.setFontSize(10);
  doc.text(`№ ${meta.number} от ${meta.createdAt}`, W / 2, y, { align: 'center' });

  y += 9;
  doc.setFont('Liberation', 'bold');
  doc.text('Параметры формирования:', M, y);
  doc.setFont('Liberation', 'normal');
  y += 1.5;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { font: 'Liberation', fontSize: 9.5, cellPadding: 0.9, textColor: 40 },
    columnStyles: { 0: { cellWidth: 55, textColor: 90 } },
    body: meta.params.map(([k, v]) => [k, v]),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 5;

  const body = rows.map((r) => [r.region, r.propertyType, fmtInt(r.mean), fmtInt(r.median), String(r.count)]);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Регион', 'Тип помещения', 'Средняя цена, тенге/м²', 'Медианная цена, тенге/м²', 'Количество объектов']],
    body,
    foot: total ? [[total.region, '', fmtInt(total.mean), fmtInt(total.median), String(total.count)]] : undefined,
    showFoot: 'lastPage',
    theme: 'grid',
    styles: { font: 'Liberation', fontSize: 9, cellPadding: 1.8, lineColor: [200, 220, 238], lineWidth: 0.2, textColor: 30 },
    headStyles: { fillColor: [10, 114, 192], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
    footStyles: { fillColor: [232, 242, 252], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    alternateRowStyles: { fillColor: [247, 251, 255] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 7;

  const H = doc.internal.pageSize.getHeight();
  const para = (label: string, text: string) => {
    const lines = doc.splitTextToSize(text, W - 2 * M - 40) as string[];
    if (y + lines.length * 4.5 > H - 30) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('Liberation', 'bold');
    doc.setFontSize(9);
    doc.text(label, M, y);
    doc.setFont('Liberation', 'normal');
    doc.text(lines, M + 40, y);
    y += lines.length * 4.5 + 2;
  };
  // В шрифте нет символа тенге — заменяем на текст
  para('Источник информации:', meta.source.replace(/₸/g, 'тенге'));
  para('Примечание:', meta.note);

  y += 8;
  if (y > H - 25) {
    doc.addPage();
    y = 25;
  }
  doc.setFontSize(10);
  doc.text('Исполнитель: ____________________ / ____________________ /', M, y);
  y += 8;
  doc.text('Дата: «____» ______________ 20___ г.', M, y);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Сформировано автоматически в ИС «Мониторинг стоимости аренды» · стр. ${i} из ${pages}`, W / 2, H - 10, { align: 'center' });
  }

  doc.save(`Справка_аренда_${toDateStamp()}.pdf`);
}
