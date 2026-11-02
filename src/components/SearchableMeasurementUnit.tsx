import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  searchMeasurementUnitGroups,
  unitName,
  type QuantityUnit,
} from '../domain/measurementUnits';

type Props = {
  value: QuantityUnit;
  onChange: (value: QuantityUnit) => void;
  inputClassName?: string;
};

/** Search by unit name, abbreviation, or category. Persist only the catalog's stable code. */
export function SearchableMeasurementUnit({ value, onChange, inputClassName = '' }: Props) {
  const inputId = useId();
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const groups = useMemo(() => searchMeasurementUnitGroups(query), [query]);
  const matches = useMemo(() => groups.flatMap(group => group.units), [groups]);

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        setExpanded(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [expanded]);

  const open = () => {
    setQuery('');
    setActive(0);
    setExpanded(true);
  };
  const close = () => {
    setExpanded(false);
    setQuery('');
    setActive(0);
  };
  const select = (unit: QuantityUnit) => {
    onChange(unit);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation(); // Escape closes the picker, not the requisition modal.
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!expanded) open();
      else setActive(index => Math.min(matches.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) open();
      else setActive(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault(); // Never submit the PR while picking a measurement unit.
      const choice = matches[active];
      if (choice) select(choice.value);
    }
  };

  let position = -1;
  return <div ref={wrapper} className="relative min-w-0 text-sm font-semibold text-slate-700">
    <label htmlFor={inputId} className="block">Unit of measurement</label>
    <div className="relative mt-1">
      <input
        ref={input}
        id={inputId}
        type="search"
        autoComplete="off"
        role="combobox"
        aria-label="Search and select a unit of measurement"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && matches[active] ? `${listId}-${matches[active].value}` : undefined}
        placeholder="Search kg, piece, weight, box…"
        className={`${inputClassName} w-full pr-10 text-base sm:text-sm`}
        value={expanded ? query : unitName(value)}
        onFocus={() => { if (!expanded) open(); }}
        onChange={event => { setExpanded(true); setQuery(event.target.value); setActive(0); }}
        onBlur={event => { if (!wrapper.current?.contains(event.relatedTarget as Node)) close(); }}
        onKeyDown={onKeyDown}
      />
      <button type="button" tabIndex={-1} aria-label={expanded ? 'Close unit choices' : 'Show unit choices'}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { if (expanded) close(); else input.current?.focus(); }}
        className="absolute inset-y-0 right-2 flex w-8 items-center justify-center text-slate-500 hover:text-[#a64f32]">
        <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true" />
      </button>
    </div>
    {expanded && <div id={listId} role="listbox" aria-label="Measurement units"
      className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
      {groups.length === 0 && <div className="px-3 py-3 text-sm font-normal text-slate-500">No matching units. Try a name, symbol, or category.</div>}
      {groups.map(group => <div key={group.label} role="group" aria-label={group.label}>
        <div className="sticky top-0 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.label}</div>
        {group.units.map(unit => {
          position += 1;
          const activeOption = position === active;
          return <button key={unit.value} id={`${listId}-${unit.value}`} role="option" aria-selected={unit.value === value}
            type="button" onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActive(matches.findIndex(match => match.value === unit.value))}
            onClick={() => select(unit.value)}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium ${activeOption ? 'bg-[#f6e9e2] text-[#873e27]' : 'text-slate-700 hover:bg-slate-50'}`}>
            <span>{unit.label}</span>
            {value === unit.value && <i className="fa-solid fa-check text-[#a64f32]" aria-hidden="true" />}
          </button>;
        })}
      </div>)}
    </div>}
    <p className="mt-1 text-xs font-normal text-slate-500">Selected: <span className="font-semibold text-slate-700">{unitName(value)}</span>. Search by unit, abbreviation, or type.</p>
  </div>;
}
