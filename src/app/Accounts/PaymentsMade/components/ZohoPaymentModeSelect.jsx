'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

function normalizeMode(value) {
    return String(value || '').trim();
}

function modeKey(value) {
    return normalizeMode(value).toLowerCase();
}

function computeMenuStyle(triggerEl) {
    if (!triggerEl || typeof window === 'undefined') return null;

    const rect = triggerEl.getBoundingClientRect();
    const viewportPadding = 8;
    const estimatedMenuHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
        180,
        Math.min(estimatedMenuHeight, openUpward ? spaceAbove - 4 : spaceBelow - 4),
    );

    return {
        position: 'fixed',
        left: rect.left,
        width: Math.max(rect.width, 240),
        zIndex: 100000,
        maxHeight,
        ...(openUpward
            ? { bottom: window.innerHeight - rect.top + 4 }
            : { top: rect.bottom + 4 }),
    };
}

export default function ZohoPaymentModeSelect({
    value = '',
    options = [],
    onChange,
    onOptionsChange,
    defaultMode = 'Cash',
    placeholder = 'Select payment mode',
    disabled = false,
}) {
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const searchRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [configureMode, setConfigureMode] = useState(false);
    const [search, setSearch] = useState('');
    const [draftModes, setDraftModes] = useState(options);
    const [draftDefault, setDraftDefault] = useState(defaultMode);
    const [newMode, setNewMode] = useState('');
    const [menuStyle, setMenuStyle] = useState(null);

    const selected = normalizeMode(value);

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;
        return options.filter((mode) => String(mode).toLowerCase().includes(query));
    }, [options, search]);

    const updateMenuPosition = () => {
        setMenuStyle(computeMenuStyle(buttonRef.current));
    };

    useLayoutEffect(() => {
        if (!open) return undefined;
        updateMenuPosition();

        const onReposition = () => updateMenuPosition();
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        return () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [open, configureMode, filteredOptions.length]);

    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = (event) => {
            const target = event.target;
            if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
            setConfigureMode(false);
            setSearch('');
            setNewMode('');
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [open, configureMode]);

    const openMenu = () => {
        if (disabled) return;
        setDraftModes(options);
        setDraftDefault(defaultMode || selected || 'Cash');
        setConfigureMode(false);
        setSearch('');
        setNewMode('');
        setOpen(true);
    };

    const selectMode = (mode) => {
        onChange?.(normalizeMode(mode));
        setOpen(false);
        setConfigureMode(false);
        setSearch('');
    };

    const addDraftMode = () => {
        const next = normalizeMode(newMode);
        if (!next) return;
        if (draftModes.some((mode) => modeKey(mode) === modeKey(next))) {
            setNewMode('');
            return;
        }
        setDraftModes((prev) => [...prev, next]);
        setNewMode('');
    };

    const removeDraftMode = (modeToRemove) => {
        setDraftModes((prev) => {
            const next = prev.filter((mode) => modeKey(mode) !== modeKey(modeToRemove));
            if (modeKey(draftDefault) === modeKey(modeToRemove)) {
                setDraftDefault(next[0] || '');
            }
            return next;
        });
    };

    const saveConfigure = () => {
        const cleaned = draftModes.map(normalizeMode).filter(Boolean);
        onOptionsChange?.(cleaned);
        const nextValue =
            cleaned.find((mode) => modeKey(mode) === modeKey(draftDefault)) ||
            cleaned.find((mode) => modeKey(mode) === modeKey(selected)) ||
            cleaned[0] ||
            '';
        onChange?.(nextValue);
        setOpen(false);
        setConfigureMode(false);
        setSearch('');
        setNewMode('');
    };

    const menu = open && menuStyle && typeof document !== 'undefined'
        ? createPortal(
              <div
                  ref={menuRef}
                  style={menuStyle}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
              >
                  {configureMode ? (
                      <div className="flex h-full max-h-[inherit] flex-col p-3">
                          <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-700">Configure Payment Mode</p>
                              <button
                                  type="button"
                                  onClick={() => setConfigureMode(false)}
                                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                              >
                                  Back
                              </button>
                          </div>

                          <div className="mb-2 flex gap-2">
                              <input
                                  ref={searchRef}
                                  type="text"
                                  value={newMode}
                                  onChange={(event) => setNewMode(event.target.value)}
                                  onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                          event.preventDefault();
                                          addDraftMode();
                                      }
                                  }}
                                  placeholder="Add payment mode"
                                  className="h-9 flex-1 rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-blue-500"
                              />
                              <button
                                  type="button"
                                  onClick={addDraftMode}
                                  className="inline-flex h-9 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                  <Plus size={14} />
                                  Add
                              </button>
                          </div>

                          <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-100">
                              {draftModes.map((mode) => {
                                  const isDefault = modeKey(mode) === modeKey(draftDefault);
                                  return (
                                      <li
                                          key={mode}
                                          className="group flex items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-2 last:border-b-0 hover:bg-slate-50"
                                      >
                                          <div className="min-w-0">
                                              <p className="truncate text-sm text-slate-700">{mode}</p>
                                              {isDefault ? (
                                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                                                      Default
                                                  </span>
                                              ) : (
                                                  <button
                                                      type="button"
                                                      onClick={() => setDraftDefault(mode)}
                                                      className="hidden text-[10px] font-semibold text-slate-500 underline group-hover:inline"
                                                  >
                                                      Mark as Default
                                                  </button>
                                              )}
                                          </div>
                                          <button
                                              type="button"
                                              onClick={() => removeDraftMode(mode)}
                                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                                              aria-label={`Remove ${mode}`}
                                          >
                                              <X size={14} />
                                          </button>
                                      </li>
                                  );
                              })}
                              {!draftModes.length ? (
                                  <li className="px-2.5 py-3 text-center text-xs text-slate-400">
                                      No payment modes
                                  </li>
                              ) : null}
                          </ul>

                          <div className="mt-3 flex justify-end gap-2">
                              <button
                                  type="button"
                                  onClick={() => {
                                      setConfigureMode(false);
                                      setDraftModes(options);
                                      setDraftDefault(defaultMode || selected || 'Cash');
                                      setNewMode('');
                                  }}
                                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                  Cancel
                              </button>
                              <button
                                  type="button"
                                  onClick={saveConfigure}
                                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                  Save
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex h-full max-h-[inherit] flex-col">
                          <div className="shrink-0 border-b border-slate-100 p-2">
                              <div className="flex h-9 items-center gap-2 rounded-md border border-blue-400 bg-white px-2.5">
                                  <Search size={14} className="shrink-0 text-slate-400" />
                                  <input
                                      ref={searchRef}
                                      type="text"
                                      value={search}
                                      onChange={(event) => setSearch(event.target.value)}
                                      onKeyDown={(event) => {
                                          if (event.key === 'Enter' && search.trim()) {
                                              event.preventDefault();
                                              const exact = filteredOptions.find(
                                                  (mode) => modeKey(mode) === modeKey(search),
                                              );
                                              if (exact) {
                                                  selectMode(exact);
                                                  return;
                                              }
                                              const next = normalizeMode(search);
                                              if (!options.some((mode) => modeKey(mode) === modeKey(next))) {
                                                  onOptionsChange?.([...options, next]);
                                              }
                                              selectMode(next);
                                          }
                                      }}
                                      placeholder="Search"
                                      className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                  />
                              </div>
                          </div>

                          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                              {filteredOptions.map((mode) => {
                                  const isSelected = modeKey(mode) === modeKey(selected);
                                  return (
                                      <li key={mode}>
                                          <button
                                              type="button"
                                              onClick={() => selectMode(mode)}
                                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                                  isSelected
                                                      ? 'bg-blue-600 text-white'
                                                      : 'text-slate-700 hover:bg-blue-50'
                                              }`}
                                          >
                                              <span>{mode}</span>
                                              {isSelected ? <Check size={14} className="shrink-0" /> : null}
                                          </button>
                                      </li>
                                  );
                              })}
                              {!filteredOptions.length ? (
                                  <li className="px-3 py-3 text-center text-xs text-slate-400">
                                      No matches. Press Enter to use &quot;{search.trim()}&quot;
                                  </li>
                              ) : null}
                          </ul>

                          <div className="shrink-0 border-t border-slate-100">
                              <button
                                  type="button"
                                  onClick={() => {
                                      setConfigureMode(true);
                                      setNewMode('');
                                  }}
                                  className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50"
                              >
                                  <Plus size={14} />
                                  Configure Payment Mode
                              </button>
                          </div>
                      </div>
                  )}
              </div>,
              document.body,
          )
        : null;

    return (
        <div ref={rootRef} className="relative w-full">
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={() => (open ? setOpen(false) : openMenu())}
                className={`flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm outline-none transition ${
                    open
                        ? 'border-blue-500 ring-2 ring-blue-500/15'
                        : 'border-slate-200 hover:border-slate-300'
                } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'text-slate-700'}`}
            >
                <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
                    {selected || placeholder}
                </span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {menu}
        </div>
    );
}
