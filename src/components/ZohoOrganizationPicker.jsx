'use client';

import { ArrowLeftRight } from 'lucide-react';

/**
 * Prominent VEGA ↔ NNIT switch for Payments Made.
 * Shows "Switch to NNIT" when on VEGA, and "Switch to VEGA" when on NNIT.
 */
export default function ZohoOrganizationPicker({
    options = [],
    value = '',
    onChange,
    disabled = false,
    loading = false,
    className = '',
    size = 'md',
}) {
    if (!options.length) return null;

    const compact = size === 'sm';
    const active =
        options.find((opt) => opt.organizationId === value) || options[0] || null;
    const alternate =
        options.find((opt) => opt.organizationId !== active?.organizationId) || null;

    // Prefer a clear Switch to NNIT / Switch to VEGA button when both brands exist.
    const vega = options.find((opt) => opt.brand === 'VEGA');
    const nnit = options.find((opt) => opt.brand === 'NNIT');
    const isOnNnit = active?.brand === 'NNIT';
    const switchTarget = vega && nnit ? (isOnNnit ? vega : nnit) : alternate;

    if (switchTarget) {
        const switchLabel = `Switch to ${switchTarget.brand || switchTarget.label}`;
        return (
            <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
                <span
                    className={`rounded-full border px-2.5 py-1 font-bold tracking-wide ${
                        compact ? 'text-[10px]' : 'text-xs'
                    } ${
                        isOnNnit
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                >
                    {active?.brand || active?.label || 'Zoho'}
                </span>
                <button
                    type="button"
                    disabled={disabled || loading}
                    title={
                        switchTarget.subtitle
                            ? `${switchLabel} — ${switchTarget.subtitle}`
                            : switchLabel
                    }
                    onClick={() => {
                        if (disabled || loading) return;
                        onChange?.(switchTarget.organizationId);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60 ${
                        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
                    }`}
                >
                    <ArrowLeftRight size={compact ? 13 : 14} />
                    {switchLabel}
                </button>
                {loading ? (
                    <span className="text-[10px] text-slate-400">Loading…</span>
                ) : null}
            </div>
        );
    }

    // Fallback segmented control when brands are not VEGA/NNIT.
    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
            <span
                className={`font-semibold uppercase tracking-wide text-slate-500 ${
                    compact ? 'text-[10px]' : 'text-xs'
                }`}
            >
                Zoho org
            </span>
            <div
                className={`inline-flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5 ${
                    disabled || loading ? 'opacity-60' : ''
                }`}
                role="group"
                aria-label="Zoho Books organization"
            >
                {options.map((option) => {
                    const selected = option.organizationId === value;
                    return (
                        <button
                            key={option.organizationId}
                            type="button"
                            disabled={disabled || loading}
                            title={
                                option.subtitle
                                    ? `${option.label} — ${option.subtitle}`
                                    : option.label
                            }
                            onClick={() => {
                                if (selected || disabled || loading) return;
                                onChange?.(option.organizationId);
                            }}
                            className={`rounded-md px-2.5 font-semibold transition-colors ${
                                compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'
                            } ${
                                selected
                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'
                            } disabled:cursor-not-allowed`}
                        >
                            {option.brand || option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
