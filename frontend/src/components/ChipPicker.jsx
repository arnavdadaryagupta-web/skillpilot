import { useState } from 'react';

/**
 * Multi-select chips grouped by category, with search and "add your own".
 * groups: [{label, items}]   value: string[]   onChange(string[])
 */
export default function ChipPicker({ title, groups, value, onChange, customPlaceholder }) {
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const known = new Set(groups.flatMap((g) => g.items));
  const extras = value.filter((v) => !known.has(v));
  const q = query.trim().toLowerCase();

  const toggle = (item) =>
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);

  const addCustom = () => {
    const v = custom.trim().slice(0, 40);
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setCustom('');
  };

  return (
    <fieldset className="picker">
      <legend>{title} <span className="muted">({value.length} selected)</span></legend>
      <input
        type="search"
        className="picker-search"
        placeholder={`Search ${title.toLowerCase()}…`}
        aria-label={`Search ${title}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.map((g) => {
        const items = g.items.filter((i) => !q || i.toLowerCase().includes(q));
        if (!items.length) return null;
        return (
          <div className="picker-group" key={g.label}>
            <span className="picker-label">{g.label}</span>
            <div className="picker-chips">
              {items.map((i) => (
                <button type="button" key={i} className={`opt ${value.includes(i) ? 'on' : ''}`}
                  aria-pressed={value.includes(i)} onClick={() => toggle(i)}>{i}</button>
              ))}
            </div>
          </div>
        );
      })}
      {extras.length > 0 && (
        <div className="picker-group">
          <span className="picker-label">Added by you</span>
          <div className="picker-chips">
            {extras.map((i) => (
              <button type="button" key={i} className="opt on" aria-pressed="true" onClick={() => toggle(i)}>{i} ×</button>
            ))}
          </div>
        </div>
      )}
      <div className="picker-custom">
        <input
          value={custom}
          placeholder={customPlaceholder || 'Not in the list? Type and press Add'}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
        />
        <button type="button" className="ghost" onClick={addCustom} disabled={!custom.trim()}>Add</button>
      </div>
    </fieldset>
  );
}
