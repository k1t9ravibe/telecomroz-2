import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { importPricesFile } from './excel';

describe('импорт Excel', () => {
  it('распознаёт строки и сообщает об ошибках', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Регион', 'Населённый пункт', 'Тип помещения', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Дата закупки', 'Источник данных'],
      ['Актюбинская', 'Актобе', 'Производственное', 300, '600 000', '15.03.2026', 'Договор №1'],
      ['г. Астана', 'Астана', 'Офисное', 100, 650000, '2026-05-01', ''],
      ['Неизвестная', 'X', 'Офис', -5, 0, 'вчера', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Данные');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const res = await importPricesFile(new File([buf], 'test.xlsx'));
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ region: 'Актюбинская область', monthlyCost: 600000, purchaseDate: '2026-03-15', source: 'Договор №1' });
    expect(res.rows[1].source).toContain('Импорт Excel');
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].row).toBe(4);
  });
});
