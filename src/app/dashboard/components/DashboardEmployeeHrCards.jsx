'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, HandCoins, ShieldAlert, Wallet, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { dashboardItem } from './dashboardMotion';
import DashboardEmployeeAssetCards from './DashboardEmployeeAssetCards';
import { DashboardCard, EmptyState, SectionHeader, StatusBadge, metricHint } from './ui';

const EMPTY = {
    loans: [],
    advances: [],
    rewards: [],
    fines: [],
};

/** Hide anything still pending with people; keep approved / paid / recovered only. */
function isSettledHrItem(item) {
    const s = String(item?.status || '').toLowerCase();
    if (!s) return false;
    if (s.includes('pending') || s.includes('draft') || s.includes('reject') || s.includes('cancel')) {
        return false;
    }
    return true;
}

function settledList(list) {
    return (Array.isArray(list) ? list : []).filter(isSettledHrItem);
}

const CARD_META = [
    {
        key: 'loans',
        title: 'My Loans',
        emptyText: 'No active loans',
        label: (count) => (count === 1 ? 'Active Loan' : 'Active Loans'),
        Icon: HandCoins,
        iconWrap: 'bg-blue-50 text-blue-500',
        arrowHover: 'group-hover/card:text-blue-500',
        valueClass: 'text-blue-700',
    },
    {
        key: 'rewards',
        title: 'My Rewards',
        emptyText: 'No rewards yet',
        label: (count) => (count === 1 ? 'Reward' : 'Rewards'),
        Icon: Gift,
        iconWrap: 'bg-orange-50 text-orange-500',
        arrowHover: 'group-hover/card:text-orange-500',
        valueClass: 'text-orange-600',
    },
    {
        key: 'fines',
        title: 'My Fines',
        emptyText: 'No active fines',
        label: (count) => (count === 1 ? 'Active Fine' : 'Active Fines'),
        Icon: ShieldAlert,
        iconWrap: 'bg-pink-50 text-pink-500',
        arrowHover: 'group-hover/card:text-pink-500',
        valueClass: 'text-rose-700',
    },
    {
        key: 'advances',
        title: 'My Advances',
        emptyText: 'No active advances',
        label: (count) => (count === 1 ? 'Advance' : 'Advances'),
        Icon: Wallet,
        iconWrap: 'bg-violet-50 text-violet-500',
        arrowHover: 'group-hover/card:text-violet-500',
        valueClass: 'text-violet-700',
    },
];

function formatAed(value) {
    const n = Number(value) || 0;
    return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function itemOutstanding(item) {
    const outstanding = Number(item?.outstanding);
    if (Number.isFinite(outstanding)) return Math.max(0, outstanding);
    const amount = Number(item?.amount) || 0;
    const repaid = Number(item?.repaid);
    if (Number.isFinite(repaid)) return Math.max(0, amount - repaid);
    return 0;
}

function isRecoveredItem(item) {
    const s = String(item?.status || '').toLowerCase();
    const payment = String(item?.payment || '').toLowerCase();
    if (s.includes('recover') || s.includes('completed') || s === 'paid') return true;
    if (payment === 'paid') return true;
    return itemOutstanding(item) <= 0.01;
}

/** Approved loans, advances, and fines the employee still owes (not rewards, not fully paid). */
function sumEmployeeToPay(data) {
    const rows = [...(data?.loans || []), ...(data?.advances || []), ...(data?.fines || [])];
    return rows.reduce((sum, item) => {
        if (isRecoveredItem(item)) return sum;
        return sum + itemOutstanding(item);
    }, 0);
}

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
}

function itemDetail(item) {
    if (item.title && item.title !== item.code && item.title !== item.type) return item.title;
    if (item.type && item.type !== 'Loan' && item.type !== 'Advance') return item.type;
    if (Number(item.outstanding) > 0) return `Outstanding ${formatAed(item.outstanding)}`;
    return '';
}

function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('reject')) return 'bg-red-50 text-red-700';
    if (s.includes('pending')) return 'bg-amber-50 text-amber-700';
    if (s.includes('recover') || s.includes('paid') || s.includes('completed') || s.includes('closed')) {
        return 'bg-emerald-50 text-emerald-700';
    }
    if (s.includes('approved') || s.includes('active')) return 'bg-blue-50 text-blue-700';
    return 'bg-slate-50 text-slate-600';
}

function RecordRow({ item, onOpen }) {
    const detail = itemDetail(item);
    const className =
        'flex w-full items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors duration-200';
    const content = (
        <>
            <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-semibold text-[#2563EB] truncate">{item.code}</p>
                {detail ? <p className="text-[10px] text-[#8792A6] truncate">{detail}</p> : null}
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700">{formatAed(item.amount)}</p>
            </div>
            <div className="text-right shrink-0">
                <StatusBadge className={statusClass(item.status)}>{item.status}</StatusBadge>
                {item.date ? <p className="text-[9px] text-[#8792A6] mt-0.5">{formatDate(item.date)}</p> : null}
            </div>
        </>
    );
    if (!onOpen || !item.href) return <div className={className}>{content}</div>;
    return (
        <button type="button" onClick={() => onOpen(item)} className={className}>
            {content}
        </button>
    );
}

function ExpandedHeader({ card, count, onClose }) {
    const Icon = card.Icon;
    return (
        <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', card.iconWrap)}>
                    <Icon size={16} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#111827] truncate">{card.title}</h3>
                    <p className="text-[11px] text-[#8792A6] truncate">{card.label(count)} · open a row for details</p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <p className="text-[26px] font-bold text-[#111827] tabular-nums leading-none">{count}</p>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#94A3B8] hover:bg-slate-100" aria-label="Close">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

function ScheduleChips({ schedule }) {
    if (!Array.isArray(schedule) || schedule.length === 0) {
        return <span className="text-[#8792A6]">—</span>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {schedule.map((box, idx) => (
                <span
                    key={`${box.label}-${idx}`}
                    className={cn(
                        'px-1.5 py-0.5 text-[9px] font-semibold rounded border',
                        box.paid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200',
                    )}
                >
                    {box.label}
                </span>
            ))}
        </div>
    );
}

function DetailTable({ columns, minWidth, items, emptyText, allowNavigate, renderRow }) {
    const thClass = 'px-2.5 py-2 text-[10px] font-semibold text-[#8792A6] whitespace-nowrap text-left';

    return (
        <div
            className="mx-4 mb-3 flex-1 min-h-0 overflow-auto border-t border-[#E7EBF1]"
            onClick={(e) => e.stopPropagation()}
        >
            <table className={cn('w-full border-collapse', minWidth)}>
                <thead className="sticky top-0 bg-white z-[1]">
                    <tr className="border-b border-[#E7EBF1]">
                        {columns.map((col) => (
                            <th key={col} className={thClass}>
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-2.5 py-6">
                                <EmptyState title={emptyText} />
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => renderRow(item, allowNavigate))
                    )}
                </tbody>
            </table>
        </div>
    );
}

const FINE_COLUMNS = [
    'Fine ID',
    'Type',
    'Individual Amount',
    'Paid Amount',
    'Balance',
    'Status',
    'Payment Schedule',
];

const LOAN_ADVANCE_COLUMNS = [
    'Type',
    'Date',
    'Total Amount',
    'Deduction',
    'Status',
    'Payment Schedule',
];

const REWARD_COLUMNS = ['Date', 'Month', 'Description', 'Amount', 'Status'];

function FineTable({ items, onOpen, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';

    return (
        <DetailTable
            columns={FINE_COLUMNS}
            minWidth="min-w-[46rem]"
            items={items}
            emptyText={emptyText}
            allowNavigate={Boolean(onOpen)}
            renderRow={(item) => (
                <tr
                    key={item.id}
                    onClick={() => item.href && onOpen?.(item)}
                    className="cursor-pointer border-b border-[#E7EBF1] last:border-0 hover:bg-sky-50 transition-colors"
                >
                    <td className={cn(tdClass, 'font-semibold text-[#2563EB]')}>
                        {item.code || '—'}
                    </td>
                    <td className={tdClass}>{item.type || '—'}</td>
                    <td className={cn(tdClass, 'font-semibold')}>{formatAed(item.amount)}</td>
                    <td className={cn(tdClass, 'font-semibold text-emerald-700')}>{formatAed(item.paid)}</td>
                    <td className={cn(tdClass, 'font-semibold text-rose-600')}>{formatAed(item.outstanding)}</td>
                    <td className={tdClass}>
                        <StatusBadge className={statusClass(item.status)}>{item.status || '—'}</StatusBadge>
                    </td>
                    <td className={cn(tdClass, 'whitespace-normal')}>
                        <ScheduleChips schedule={item.schedule} />
                    </td>
                </tr>
            )}
        />
    );
}

function LoanAdvanceTable({ items, onOpen, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';

    return (
        <DetailTable
            columns={LOAN_ADVANCE_COLUMNS}
            minWidth="min-w-[40rem]"
            items={items}
            emptyText={emptyText}
            allowNavigate={Boolean(onOpen)}
            renderRow={(item) => (
                <tr
                    key={item.id}
                    onClick={() => item.href && onOpen?.(item)}
                    className="cursor-pointer border-b border-[#E7EBF1] last:border-0 hover:bg-sky-50 transition-colors"
                >
                    <td className={cn(tdClass, 'font-semibold text-[#2563EB]')}>
                        {item.code || item.type || '—'}
                    </td>
                    <td className={tdClass}>{formatDate(item.date) || '—'}</td>
                    <td className={cn(tdClass, 'font-semibold')}>{formatAed(item.amount)}</td>
                    <td className={tdClass}>{formatAed(item.deduction)}</td>
                    <td className={tdClass}>
                        <StatusBadge className={statusClass(item.status)}>{item.status || '—'}</StatusBadge>
                    </td>
                    <td className={cn(tdClass, 'whitespace-normal')}>
                        <ScheduleChips schedule={item.schedule} />
                    </td>
                </tr>
            )}
        />
    );
}

function formatMonthName(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('default', { month: 'long' });
}

function RewardTable({ items, onOpen, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';

    return (
        <DetailTable
            columns={REWARD_COLUMNS}
            minWidth="min-w-[32rem]"
            items={items}
            emptyText={emptyText}
            allowNavigate={Boolean(onOpen)}
            renderRow={(item) => (
                <tr
                    key={item.id}
                    onClick={() => item.href && onOpen?.(item)}
                    className="cursor-pointer border-b border-[#E7EBF1] last:border-0 hover:bg-sky-50 transition-colors"
                >
                    <td className={cn(tdClass, 'font-semibold text-[#2563EB]')}>
                        {formatDate(item.date) || '—'}
                    </td>
                    <td className={tdClass}>{formatMonthName(item.date)}</td>
                    <td className={cn(tdClass, 'whitespace-normal max-w-[14rem]')}>
                        <span className="line-clamp-2">{item.title || item.type || '—'}</span>
                    </td>
                    <td className={cn(tdClass, 'font-semibold')}>{formatAed(item.amount)}</td>
                    <td className={tdClass}>
                        <StatusBadge className={statusClass(item.status)}>{item.status || '—'}</StatusBadge>
                    </td>
                </tr>
            )}
        />
    );
}

function CardBody({ card, items, onOpen }) {
    if (card.key === 'fines') {
        return <FineTable items={items} onOpen={onOpen} emptyText={card.emptyText} />;
    }
    if (card.key === 'loans' || card.key === 'advances') {
        return <LoanAdvanceTable items={items} onOpen={onOpen} emptyText={card.emptyText} />;
    }
    if (card.key === 'rewards') {
        return <RewardTable items={items} onOpen={onOpen} emptyText={card.emptyText} />;
    }

    return (
        <div className="mx-4 mb-3 border-t border-[#E7EBF1]">
            {items.length === 0 ? (
                <EmptyState title={card.emptyText} />
            ) : (
                <div className="py-0.5">
                    {items.map((item) => (
                        <RecordRow key={item.id} item={item} onOpen={onOpen} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DashboardEmployeeHrCards() {
    const router = useRouter();
    const [data, setData] = useState(EMPTY);
    const [expandedKey, setExpandedKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/Employee/dashboard/my-hr-cards', { skipToast: true });
                if (cancelled || !res?.data) return;
                setData({
                    loans: settledList(res.data.loans),
                    advances: settledList(res.data.advances),
                    rewards: settledList(res.data.rewards),
                    fines: settledList(res.data.fines),
                });
            } catch {
                if (!cancelled) setData(EMPTY);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const expandedCard = CARD_META.find((card) => card.key === expandedKey) || null;
    const expandedItems = expandedCard ? data[expandedCard.key] || [] : [];
    const payableTotal = useMemo(() => sumEmployeeToPay(data), [data]);

    return (
        <DashboardCard variants={dashboardItem} className="px-4 py-3.5">
            <SectionHeader
                icon={Wallet}
                iconWrap="bg-violet-50 text-violet-600"
                title="My Account"
                subtitle="Loans, rewards, fines, advances and assigned assets"
                action={
                    <div className="text-right shrink-0 min-w-[7.5rem]">
                        <p className="text-[10px] font-medium text-[#8792A6] leading-none">To pay</p>
                        <p
                            className={cn(
                                'mt-1 text-lg sm:text-xl font-bold tabular-nums leading-none',
                                payableTotal > 0.01 ? 'text-rose-600' : 'text-slate-400',
                            )}
                        >
                            {formatAed(payableTotal)}
                        </p>
                    </div>
                }
            />

            <div className="mt-3 grid grid-cols-2 min-[1200px]:grid-cols-4 gap-3">
                {CARD_META.map((card) => {
                    const count = (data[card.key] || []).length;
                    const active = expandedKey === card.key;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            onClick={() => setExpandedKey((prev) => (prev === card.key ? null : card.key))}
                            className={cn(
                                'min-h-[84px] rounded-xl border bg-white px-3.5 py-3 flex flex-col justify-center text-left transition-colors duration-200',
                                active
                                    ? 'border-slate-900 shadow-[0_1px_3px_rgba(16,24,40,0.06)]'
                                    : 'border-[#E7EBF1] hover:border-[#D8DEE8]',
                            )}
                        >
                            <p className={cn('text-[26px] font-bold tabular-nums leading-none', card.valueClass)}>
                                {count}
                            </p>
                            <p className="text-[11px] font-medium text-[#8792A6] mt-1.5 leading-tight">{card.title}</p>
                            <p className="text-[10px] text-[#8792A6] mt-0.5 leading-tight">
                                {metricHint(count, card.emptyText)}
                            </p>
                        </button>
                    );
                })}
            </div>

            {expandedCard ? (
                <div
                    className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => setExpandedKey(null)}
                    role="presentation"
                >
                    <div
                        className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E7EBF1] bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <ExpandedHeader
                            card={expandedCard}
                            count={expandedItems.length}
                            onClose={() => setExpandedKey(null)}
                        />
                        <CardBody
                            card={expandedCard}
                            items={expandedItems}
                            onOpen={(item) => item?.href && router.push(item.href)}
                        />
                    </div>
                </div>
            ) : null}

            <div className="mt-3">
                <DashboardEmployeeAssetCards embedded />
            </div>
        </DashboardCard>
    );
}
