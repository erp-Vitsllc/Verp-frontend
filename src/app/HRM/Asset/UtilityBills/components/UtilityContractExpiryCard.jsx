'use client';

import Link from 'next/link';
import { formatBillMoney } from '../utils/utilityBillStats';

function rowTone(row, variant) {
    if (variant === 'paid') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    if (row?.isMissingBill || String(row?.rawStatus || '').toLowerCase() === 'missing') {
        return 'bg-rose-50 border-rose-200 text-rose-800';
    }
    if (row?.isOverdue) return 'bg-orange-50 border-orange-200 text-orange-900';
    const s = String(row?.status || row?.rawStatus || '').toLowerCase();
    if (s.includes('pending hr')) return 'bg-blue-50 border-blue-200 text-blue-800';
    if (s.includes('pending')) return 'bg-teal-50 border-teal-200 text-teal-800';
    if (s.includes('not paid') || s.includes('approved')) return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-amber-50 border-amber-200 text-amber-800';
}

function BillRowsList({ rows = [], emptyLabel, variant = 'unpaid' }) {
    if (!rows.length) {
        return (
            <div className="flex min-h-[7rem] flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3">
                <p className="text-center text-xs text-gray-500">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {rows.map((row) => {
                const href = String(row.href || '').trim();
                const className = `flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left ${rowTone(row, variant)} ${
                    href ? 'cursor-pointer transition-shadow hover:shadow-sm' : ''
                }`;
                const body = (
                    <>
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold">{row.title}</p>
                            <p className="truncate text-[9px] font-semibold uppercase tracking-wider opacity-70">
                                {row.type}
                                {row.subtitle ? ` · ${row.subtitle}` : ''}
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="text-[11px] font-bold tabular-nums">{formatBillMoney(row.amount)}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">
                                {row.status || (variant === 'paid' ? 'paid' : 'unpaid')}
                            </p>
                        </div>
                    </>
                );
                if (href) {
                    return (
                        <Link key={row.id || `${row.type}-${row.subtitle}`} href={href} className={className}>
                            {body}
                        </Link>
                    );
                }
                return (
                    <div key={row.id || `${row.type}-${row.subtitle}`} className={className}>
                        {body}
                    </div>
                );
            })}
        </div>
    );
}

/** Paid and unpaid bills for the selected overview month / year. */
export default function UtilityContractExpiryCard({ paidRows = [], unpaidRows = [] }) {
    return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex min-h-0 flex-col">
                <h3 className="mb-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 sm:text-[11px]">
                    Paid Bills
                </h3>
                <p className="mb-2 shrink-0 text-[9px] font-semibold text-gray-400">
                    Current &amp; previous month
                </p>
                <BillRowsList
                    rows={paidRows}
                    variant="paid"
                    emptyLabel="No paid bills for the current or previous month."
                />
            </div>

            <div className="flex min-h-0 flex-col">
                <h3 className="mb-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 sm:text-[11px]">
                    Unpaid Bills
                </h3>
                <p className="mb-2 shrink-0 text-[9px] font-semibold text-gray-400">
                    Pending or not created · current &amp; earlier months
                </p>
                <BillRowsList
                    rows={unpaidRows}
                    variant="unpaid"
                    emptyLabel="No pending or missing bills for the current or earlier months."
                />
            </div>
        </div>
    );
}
