import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

function resolveDisplayLabel(value, groups, options) {
  if (groups?.length) {
    for (const group of groups) {
      const hit = group.options.find((o) => o.value === value);
      if (hit) {
        return group.label === 'Vertical' ? hit.label : `${hit.label} · ${group.label}`;
      }
    }
    return value;
  }
  const flat = options?.find((o) => o.value === value);
  if (flat?.label) return flat.label.replace(/ — .*$/, '');
  return value;
}

export default function ScenarioPicker({
  id,
  label,
  hint = 'Click to change',
  icon: Icon,
  value,
  onChange,
  options = null,
  groups = null,
  openPickerId,
  setOpenPickerId,
  menuMaxHeight = 220,
}) {
  const uid = useId();
  const listboxId = `${id || uid}-listbox`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);
  const isOpen = openPickerId === id;

  const displayLabel = resolveDisplayLabel(value, groups, options);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const maxH = Math.min(menuMaxHeight, window.innerHeight - r.bottom - gap - 12);
    setMenuPos({
      top: r.bottom + gap,
      left: r.left,
      width: Math.max(r.width, 168),
      maxHeight: Math.max(120, maxH),
    });
  }, [menuMaxHeight]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpenPickerId(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenPickerId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, listboxId, setOpenPickerId]);

  const pick = (next) => {
    onChange(next);
    setOpenPickerId(null);
  };

  const renderOption = (opt, groupLabel) => {
    const selected = opt.value === value;
    const key = groupLabel ? `${groupLabel}-${opt.value}` : opt.value;
    return (
      <button
        key={key}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => pick(opt.value)}
        className={`scenario-picker-option w-full text-left flex items-center gap-2 px-2.5 py-2 text-[11px] transition-colors ${
          selected ? 'scenario-picker-option--selected' : ''
        }`}
      >
        <span className="flex-1 min-w-0 truncate">{opt.label}</span>
        {selected && <Check size={14} className="shrink-0 text-[#ff9a6c]" aria-hidden />}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="min-w-0 group/picker scenario-picker">
      <div className="flex items-baseline justify-between gap-2 mb-1.5 px-0.5">
        <span className="text-[10px] font-medium text-[#94a3b8] group-hover/picker:text-[#cbd5e1] transition-colors">
          {label}
        </span>
        <span className="text-[9px] text-[#475569] group-hover/picker:text-[#ff9a6c]/90 transition-colors shrink-0">
          {hint}
        </span>
      </div>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setOpenPickerId(isOpen ? null : id)}
        className={`scenario-picker-trigger w-full ${Icon ? 'scenario-picker-trigger--icon' : ''} ${
          isOpen ? 'scenario-picker-trigger--open' : ''
        }`}
      >
        {Icon && <Icon size={14} className="scenario-picker-trigger-icon" aria-hidden />}
        <span className="truncate text-left flex-1">{displayLabel}</span>
        <ChevronDown
          size={16}
          className={`scenario-picker-chevron shrink-0 ${isOpen ? 'scenario-picker-chevron--open' : ''}`}
          aria-hidden
        />
      </button>

      {isOpen && menuPos && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="scenario-picker-menu scrollbar-thin"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
          }}
        >
          {groups?.map((group) => (
            <div key={group.label} className="scenario-picker-group">
              <div className="scenario-picker-group-label">{group.label}</div>
              {group.options.map((opt) => renderOption(opt, group.label))}
            </div>
          ))}
          {!groups && options?.map((opt) => renderOption(opt, null))}
        </div>
      )}
    </div>
  );
}