'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { formatAed } from '../utils/utilityBillStats';
import { MONTH_OPTIONS } from '../utils/utilityOverviewStats';
import { hexToRgba, utilityTypeColor, utilityTypeIcon } from '../utils/utilityTypeVisuals';

const PREVIEW_COUNT = 5;

function typeIndex(typeName, typeNames = []) {
    const i = typeNames.findIndex(
        (name) =>
            String(name || '').trim().toLowerCase() === String(typeName || '').trim().toLowerCase(),
    );
    return i >= 0 ? i : 0;
}

function periodBadge(row) {
    const ym = String(row?.billMonth || '');
    const month = MONTH_OPTIONS.find((opt) => opt.value === ym.slice(5, 7));
    const monthName = month ? month.label : '';
    if (row?.period === 'current') {
        return {
            label: monthName || 'Previous month',
            className: 'bg-[#FFF1E8] text-[#F58220]',
        };
    }
    if (row?.period === 'previous') {
        return {
            label: monthName || 'Earlier month',
            className: 'bg-[#FDECEE] text-[#E11D48]',
        };
    }
    return {
        label: month ? `${month.label.slice(0, 3)} ${ym.slice(0, 4)}` : ym || 'Earlier',
        className: 'bg-[#F1F5F9] text-[#64748B]',
    };
}

function PendingRow({ row, typeNames, onNavigate }) {
    const index = typeIndex(row.type, typeNames);
    const color = utilityTypeColor(index);
    const Icon = utilityTypeIcon(row.type, index);
    const badge = periodBadge(row);
    const href = String(row.href || '').trim();
    const className =
        'grid h-9 w-full grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_auto] items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition-shadow hover:shadow-sm';
    const body = (
        <>
            <div className="flex min-w-0 items-center gap-1.5">
                <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: color }}
                >
                    <Icon size={12} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 leading-none">
                    <p className="truncate text-[10px] font-bold leading-tight text-[#1A2B48]">{row.title}</p>
                    <p className="truncate text-[8px] font-medium leading-tight text-[#94A3B8]">{row.type}</p>
                </div>
            </div>
            <p className="px-1 text-center text-[11px] font-bold tabular-nums text-[#1A2B48] sm:text-[12px]">
                {formatAed(row.amount)}
            </p>
            <span
                className={`inline-flex shrink-0 justify-self-end whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-semibold leading-none sm:text-[9px] ${badge.className}`}
            >
                {badge.label}
            </span>
        </>
    );

    const style = {
        borderColor: hexToRgba(color, 0.22),
        background: hexToRgba(color, 0.06),
    };

    if (href) {
        return (
            <Link href={href} onClick={onNavigate} className={className} style={style}>
                {body}
            </Link>
        );
    }

    return (
        <div className={className} style={style}>
            {body}
        </div>
    );
}

function PendingBillsModal({ open, onClose, rows, typeNames, totalAmount }) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4"
            onClick={onClose}
        >
            <div
                className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
                    <div>
                        <h2 className="text-lg font-bold text-[#1A2B48]">All Pending Bills</h2>
                        <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">
                            {rows.length} {rows.length === 1 ? 'bill' : 'bills'} · {formatAed(totalAmount)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="space-y-1.5 overflow-y-auto px-4 py-3 sm:px-5">
                    {rows.length === 0 ? (
                        <p className="py-10 text-center text-sm text-[#94A3B8]">No pending bills.</p>
                    ) : (
                        rows.map((row) => (
                            <PendingRow
                                key={row.id || `${row.type}-${row.subtitle}`}
                                row={row}
                                typeNames={typeNames}
                                onNavigate={onClose}
                            />
                        ))
                    )}
                </div>
                <div className="flex justify-end border-t border-gray-100 px-4 py-3 sm:px-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function UtilityBillPendingCard({ pending = {}, typeNames = [] }) {
    const [modalOpen, setModalOpen] = useState(false);
    const current = pending.current || { count: 0, amount: 0, rows: [] };
    const previous = pending.previous || { count: 0, amount: 0, rows: [] };
    const windowRows = pending.windowRows || [];
    const allRows = pending.allRows || [];

    const previewRows = useMemo(() => windowRows.slice(0, PREVIEW_COUNT), [windowRows]);
    const modalRows = allRows.length ? allRows : windowRows;
    const modalTotal = modalRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

    const currentLabel = current.monthLabel || 'Previous month';
    const previousLabel = previous.monthLabel || 'Earlier month';

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-1 flex shrink-0 items-baseline justify-between gap-2">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] leading-tight text-[#1A2B48] sm:text-[13px]">
                    Bill Pending
                </h3>
                <p className="shrink-0 text-[10px] font-medium leading-tight text-[#94A3B8] sm:text-[11px]">
                    {currentLabel} and {previousLabel}
                </p>
            </div>

            <div className="mb-1.5 grid shrink-0 grid-cols-2 gap-1.5">
                <div className="flex h-[46px] flex-col justify-center rounded-lg border border-[#FDBA74] bg-[#FFF7ED] px-2 py-1">
                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] leading-none text-[#C2410C] sm:text-[9px]">
                        {currentLabel} Pending
                    </p>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-extrabold leading-none text-[#EA580C]">
                            {current.count} {current.count === 1 ? 'Bill' : 'Bills'}
                        </p>
                        <p className="text-[10px] font-bold tabular-nums leading-none text-[#C2410C]">
                            {formatAed(current.amount)}
                        </p>
                    </div>
                </div>
                <div className="flex h-[46px] flex-col justify-center rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-2 py-1">
                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] leading-none text-[#E11D48] sm:text-[9px]">
                        {previousLabel} Pending
                    </p>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-extrabold leading-none text-[#E11D48]">
                            {previous.count} {previous.count === 1 ? 'Bill' : 'Bills'}
                        </p>
                        <p className="text-[10px] font-bold tabular-nums leading-none text-[#BE123C]">
                            {formatAed(previous.amount)}
                        </p>
                    </div>
                </div>
            </div>

            {previewRows.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3">
                    <p className="text-center text-xs text-[#94A3B8]">
                        No pending bills for {currentLabel} or {previousLabel}.
                    </p>
                </div>
            ) : (
                <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
                    {previewRows.map((row) => (
                        <PendingRow
                            key={row.id || `${row.type}-${row.subtitle}`}
                            row={row}
                            typeNames={typeNames}
                        />
                    ))}
                </div>
            )}

            <div className="mt-1 flex shrink-0 items-center justify-between gap-2 pt-0">
                <p className="text-[12px] font-bold text-[#1A2B48]">
                    Total Pending:{' '}
                    <span className="tabular-nums">{formatAed(pending.totalAmount || 0)}</span>
                </p>
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                    View All Pending Bills
                    <ArrowRight size={14} />
                </button>
            </div>

            <PendingBillsModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                rows={modalRows}
                typeNames={typeNames}
                totalAmount={modalTotal}
            />
        </div>
    );
}
