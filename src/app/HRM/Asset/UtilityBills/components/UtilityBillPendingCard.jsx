'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { formatAed } from '../utils/utilityBillStats';
import { MONTH_OPTIONS } from '../utils/utilityOverviewStats';
import { hexToRgba, utilityTypeColor, utilityTypeIcon } from '../utils/utilityTypeVisuals';

const PREVIEW_COUNT = 4;

function typeIndex(typeName, typeNames = []) {
    const i = typeNames.findIndex(
        (name) =>
            String(name || '').trim().toLowerCase() === String(typeName || '').trim().toLowerCase(),
    );
    return i >= 0 ? i : 0;
}

function periodBadge(row) {
    if (row?.period === 'current') {
        return {
            label: 'Current Month',
            className: 'bg-[#FFF1E8] text-[#F58220]',
        };
    }
    if (row?.period === 'previous') {
        return {
            label: 'Previous Month',
            className: 'bg-[#FDECEE] text-[#E11D48]',
        };
    }
    const ym = String(row?.billMonth || '');
    const month = MONTH_OPTIONS.find((opt) => opt.value === ym.slice(5, 7));
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
        'grid w-full grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_auto] items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-shadow hover:shadow-sm sm:gap-3';
    const body = (
        <>
            <div className="flex min-w-0 items-center gap-2.5">
                <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: color }}
                >
                    <Icon size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold leading-tight text-[#1A2B48]">{row.title}</p>
                    <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[#94A3B8]">{row.type}</p>
                </div>
            </div>
            <p className="px-1 text-center text-[13px] font-bold tabular-nums text-[#1A2B48] sm:text-[14px]">
                {formatAed(row.amount)}
            </p>
            <span
                className={`inline-flex shrink-0 justify-self-end whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${badge.className}`}
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
                <div className="space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
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

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-4 shrink-0">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A2B48]">
                    Bill Pending
                </h3>
                <p className="mt-1 text-[12px] font-medium text-[#94A3B8]">Current and previous month</p>
            </div>

            <div className="mb-3 grid shrink-0 grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-[#FDBA74] bg-[#FFF7ED] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#C2410C]">
                        Current Month Pending
                    </p>
                    <p className="mt-1.5 text-[20px] font-extrabold leading-none text-[#EA580C]">
                        {current.count} {current.count === 1 ? 'Bill' : 'Bills'}
                    </p>
                    <p className="mt-1.5 text-[13px] font-bold tabular-nums text-[#C2410C]">
                        {formatAed(current.amount)}
                    </p>
                </div>
                <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#E11D48]">
                        Previous Month Pending
                    </p>
                    <p className="mt-1.5 text-[20px] font-extrabold leading-none text-[#E11D48]">
                        {previous.count} {previous.count === 1 ? 'Bill' : 'Bills'}
                    </p>
                    <p className="mt-1.5 text-[13px] font-bold tabular-nums text-[#BE123C]">
                        {formatAed(previous.amount)}
                    </p>
                </div>
            </div>

            {previewRows.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3">
                    <p className="text-center text-sm text-[#94A3B8]">
                        No pending bills for the current or previous month.
                    </p>
                </div>
            ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
                    {previewRows.map((row) => (
                        <PendingRow
                            key={row.id || `${row.type}-${row.subtitle}`}
                            row={row}
                            typeNames={typeNames}
                        />
                    ))}
                </div>
            )}

            <div className="mt-3 flex shrink-0 items-center justify-between gap-2 pt-1">
                <p className="text-[13px] font-bold text-[#1A2B48]">
                    Total Pending:{' '}
                    <span className="tabular-nums">{formatAed(pending.totalAmount || 0)}</span>
                </p>
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
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
