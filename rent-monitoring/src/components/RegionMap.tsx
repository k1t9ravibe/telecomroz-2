import { REGION_SHORT } from '../lib/constants';
import { fmtInt } from '../lib/format';
import { cx } from './ui';

/**
 * Схематичная карта Казахстана: регионы размещены сеткой в приблизительном
 * географическом порядке (запад → восток, север → юг).
 */
const LAYOUT: Record<string, [number, number]> = {
  'Костанайская область': [2, 0],
  'Северо-Казахстанская область': [3, 0],
  'Павлодарская область': [5, 0],
  'Западно-Казахстанская область': [0, 1],
  'Актюбинская область': [1, 1],
  'Акмолинская область': [3, 1],
  'г. Астана': [4, 1],
  'Абайская область': [5, 1],
  'Восточно-Казахстанская область': [6, 1],
  'Атырауская область': [0, 2],
  'Улытауская область': [2, 2],
  'Карагандинская область': [3, 2],
  'Жетысуская область': [6, 2],
  'Мангистауская область': [0, 3],
  'Кызылординская область': [2, 3],
  'Жамбылская область': [4, 3],
  'Алматинская область': [5, 3],
  'г. Алматы': [6, 3],
  'Туркестанская область': [3, 3],
  'г. Шымкент': [3, 4],
};

// Последовательная шкала: один оттенок синего, от светлого к тёмному
const RAMP = ['#dbeafb', '#b5d4f5', '#86b7ec', '#5597df', '#2a78d6', '#1b5fb3', '#124a8f'];

export default function RegionMap({ values, selected, onSelect }: { values: Record<string, number | null>; selected: string; onSelect: (r: string) => void }) {
  const nums = Object.values(values).filter((v): v is number => v !== null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const color = (v: number | null) => {
    if (v === null || !nums.length) return null;
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
  };

  return (
    <div>
      <div className="relative grid grid-cols-7 gap-1.5 rounded-md bg-kt-50/60 p-2" style={{ gridTemplateRows: 'repeat(5, 62px)' }}>
        {Object.entries(LAYOUT).map(([region, [x, y]]) => {
          const v = values[region] ?? null;
          const bg = color(v);
          const dark = bg !== null && RAMP.indexOf(bg) >= 4;
          const isSel = selected === region;
          return (
            <button
              key={region}
              title={`${region}: ${v === null ? 'нет данных' : fmtInt(v) + ' ₸/м²'}`}
              onClick={() => onSelect(isSel ? '' : region)}
              style={{ gridColumn: x + 1, gridRow: y + 1, background: bg ?? '#ffffff' }}
              className={cx(
                'flex flex-col items-center justify-center rounded-md border px-1 text-center leading-tight transition-all',
                bg ? 'border-white/60' : 'border-dashed border-slate-300',
                isSel ? 'ring-[3px] ring-orange-500 ring-offset-1' : 'hover:ring-2 hover:ring-kt-400',
                selected && !isSel && 'opacity-60',
              )}
            >
              <span className={cx('text-[11px] font-semibold', dark ? 'text-white' : 'text-slate-800')}>{REGION_SHORT[region]}</span>
              <span className={cx('text-[10px] tabular-nums', dark ? 'text-white/85' : bg ? 'text-slate-700' : 'text-slate-400')}>{v === null ? 'нет данных' : fmtInt(v)}</span>
            </button>
          );
        })}
      </div>
      {nums.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          <span>{fmtInt(min)} ₸/м²</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded">
            {RAMP.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <span>{fmtInt(max)} ₸/м²</span>
        </div>
      )}
    </div>
  );
}
