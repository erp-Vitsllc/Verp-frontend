'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { formatAed } from '../utils/utilityBillStats';
import { MONTH_OPTIONS } from '../utils/utilityOverviewStats';
import { hexToRgba, utilityTypeColor, utilityTypeIcon } from '../utils/utilityTypeVisuals';

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
            label: month ? month.label.slice(0, 3) : 'Earlier',
            className: 'bg-[#FDECEE] text-[#E11D48]',
        };
    }
    return {
        label: month ? `${month.label.slice(0, 3)} ${ym.slice(0, 4)}` : ym || 'Earlier',
        className: 'bg-[#F1F5F9] text-[#64748B]',
    };
}

function PendingRow({ row, typeNames, onNavigate, showPeriodBadge = true }) {
    const index = typeIndex(row.type, typeNames);
    const color = utilityTypeColor(index);
    const Icon = utilityTypeIcon(row.type, index);
    const badge = periodBadge(row);
    const href = String(row.href || '').trim();
    const className = showPeriodBadge
        ? 'grid h-9 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-lg border px-1.5 py-1 text-left transition-shadow hover:shadow-sm'
        : 'grid h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-lg border px-1.5 py-1 text-left transition-shadow hover:shadow-sm';
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
            <p className="px-0.5 text-right text-[10px] font-bold tabular-nums text-[#1A2B48] sm:text-[11px]">
                {formatAed(row.amount)}
            </p>
            {showPeriodBadge ? (
                <span
                    className={`inline-flex shrink-0 justify-self-end whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8px] font-semibold leading-none sm:text-[9px] ${badge.className}`}
                >
                    {badge.label}
                </span>
            ) : null}
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

function PendingColumn({
    title,
    count,
    amount,
    rows,
    typeNames,
    emptyLabel,
    showPeriodBadge,
    headerClassName,
    titleClassName,
    countClassName,
    amountClassName,
}) {
    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
            <div className={`flex h-[46px] shrink-0 flex-col justify-center rounded-lg border px-2 py-1 ${headerClassName}`}>
                <p className={`text-[8px] font-bold uppercase tracking-[0.08em] leading-none sm:text-[9px] ${titleClassName}`}>
                    {title}
                </p>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <p className={`text-[13px] font-extrabold leading-none ${countClassName}`}>
                        {count} {count === 1 ? 'Bill' : 'Bills'}
                    </p>
                    <p className={`text-[10px] font-bold tabular-nums leading-none ${amountClassName}`}>
                        {formatAed(amount)}
                    </p>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-2">
                    <p className="text-center text-[10px] leading-snug text-[#94A3B8]">{emptyLabel}</p>
                </div>
            ) : (
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                    {rows.map((row) => (
                        <PendingRow
                            key={row.id || `${row.type}-${row.subtitle}`}
                            row={row}
                            typeNames={typeNames}
                            showPeriodBadge={showPeriodBadge}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PendingBillsModal({
    open,
    onClose,
    currentLabel,
    currentRows,
    previousRows,
    typeNames,
    totalAmount,
}) {
    if (!open) return null;

    const currentCount = currentRows.length;
    const previousCount = previousRows.length;
    const totalCount = currentCount + previousCount;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4"
            onClick={onClose}
        >
            <div
                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
                    <div>
                        <h2 className="text-lg font-bold text-[#1A2B48]">All Pending Bills</h2>
                        <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">
                            {totalCount} {totalCount === 1 ? 'bill' : 'bills'} · {formatAed(totalAmount)}
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
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
                    <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#C2410C]">
                            {currentLabel} pending
                        </p>
                        {currentCount === 0 ? (
                            <p className="py-6 text-center text-sm text-[#94A3B8]">No pending bills.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {currentRows.map((row) => (
                                    <PendingRow
                                        key={row.id || `${row.type}-${row.subtitle}`}
                                        row={row}
                                        typeNames={typeNames}
                                        onNavigate={onClose}
                                        showPeriodBadge={false}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#E11D48]">
                            Previous Bill Pending
                        </p>
                        {previousCount === 0 ? (
                            <p className="py-6 text-center text-sm text-[#94A3B8]">No pending bills.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {previousRows.map((row) => (
                                    <PendingRow
                                        key={row.id || `${row.type}-${row.subtitle}`}
                                        row={row}
                                        typeNames={typeNames}
                                        onNavigate={onClose}
                                        showPeriodBadge
                                    />
                                ))}
                            </div>
                        )}
                    </div>
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
    const currentRows = current.rows || [];
    const previousRows = previous.rows || [];
    const currentLabel = current.monthLabel || 'Previous month';

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-1 flex shrink-0 items-baseline justify-between gap-2">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] leading-tight text-[#1A2B48] sm:text-[13px]">
                    Bill Pending
                </h3>
                <p className="shrink-0 text-[10px] font-medium leading-tight text-[#94A3B8] sm:text-[11px]">
                    {currentLabel} and earlier
                </p>
            </div>

            <div className="flex min-h-0 flex-1 gap-1.5">
                <PendingColumn
                    title={`${currentLabel} Pending`}
                    count={current.count}
                    amount={current.amount}
                    rows={currentRows}
                    typeNames={typeNames}
                    emptyLabel={`No pending bills for ${currentLabel}.`}
                    showPeriodBadge={false}
                    headerClassName="border-[#FDBA74] bg-[#FFF7ED]"
                    titleClassName="text-[#C2410C]"
                    countClassName="text-[#EA580C]"
                    amountClassName="text-[#C2410C]"
                />
                <PendingColumn
                    title="Previous Bill Pending"
                    count={previous.count}
                    amount={previous.amount}
                    rows={previousRows}
                    typeNames={typeNames}
                    emptyLabel="No earlier pending bills."
                    showPeriodBadge
                    headerClassName="border-[#FECDD3] bg-[#FFF1F2]"
                    titleClassName="text-[#E11D48]"
                    countClassName="text-[#E11D48]"
                    amountClassName="text-[#BE123C]"
                />
            </div>

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
                currentLabel={currentLabel}
                currentRows={currentRows}
                previousRows={previousRows}
                typeNames={typeNames}
                totalAmount={pending.totalAmount || 0}
            />
        </div>
    );
}
