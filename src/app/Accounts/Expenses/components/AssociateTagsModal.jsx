'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Tags, X } from 'lucide-react';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 36,
        borderRadius: '0.25rem',
        borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.12)' : 'none',
        backgroundColor: '#fff',
        cursor: 'pointer',
        '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#94a3b8' },
    }),
    valueContainer: (base) => ({ ...base, padding: '0 8px' }),
    input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: '0.875rem' }),
    placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
    singleValue: (base) => ({ ...base, fontSize: '0.875rem', color: '#334155' }),
    menu: (base) => ({
        ...base,
        zIndex: 100001,
        borderRadius: '0.375rem',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 100002 }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : '#fff',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: 'pointer',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
};

/**
 * Zoho-style Associate Tags dialog for reporting tags.
 * selections: { [tagId]: optionId }
 */
export default function AssociateTagsModal({
    open,
    tags = [],
    selections = {},
    onClose,
    onApply,
}) {
    const [draft, setDraft] = useState({});

    useEffect(() => {
        if (!open) return;
        setDraft({ ...(selections || {}) });
    }, [open, selections]);

    const tagRows = useMemo(
        () =>
            (Array.isArray(tags) ? tags : []).map((tag) => ({
                ...tag,
                options: (tag.options || []).map((opt) => ({
                    value: opt.option_id,
                    label:
                        Number(opt.depth) > 0
                            ? `${'— '.repeat(Math.min(Number(opt.depth), 3))}${opt.option_name}`
                            : opt.option_name,
                })),
            })),
        [tags],
    );

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Close associate tags"
                onClick={onClose}
            />
            <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Tags size={16} className="text-blue-600" />
                        <h3 className="text-sm font-semibold text-slate-900">Associate Tags</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
                    {!tagRows.length ? (
                        <p className="text-sm text-slate-500">
                            No reporting tags are configured in Zoho Books for this organization.
                        </p>
                    ) : (
                        tagRows.map((tag) => (
                            <label key={tag.tag_id} className="block space-y-1.5">
                                <span className="text-xs font-semibold text-slate-600">
                                    {tag.tag_name}
                                    {tag.is_mandatory ? (
                                        <span className="ml-0.5 text-red-500">*</span>
                                    ) : null}
                                </span>
                                <Select
                                    instanceId={`expense-tag-${tag.tag_id}`}
                                    styles={selectStyles}
                                    options={tag.options}
                                    value={
                                        tag.options.find((o) => o.value === draft[tag.tag_id]) ||
                                        null
                                    }
                                    onChange={(o) =>
                                        setDraft((prev) => {
                                            const next = { ...prev };
                                            if (o?.value) next[tag.tag_id] = o.value;
                                            else delete next[tag.tag_id];
                                            return next;
                                        })
                                    }
                                    isClearable={!tag.is_mandatory}
                                    placeholder={`Select ${tag.tag_name}`}
                                    menuPortalTarget={
                                        typeof document !== 'undefined' ? document.body : null
                                    }
                                />
                            </label>
                        ))
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onApply?.(draft)}
                        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Associate
                    </button>
                </div>
            </div>
        </div>
    );
}
