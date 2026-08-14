'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Gift, HandCoins, ShieldAlert, Wallet } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { dashboardItem } from './dashboardMotion';

const EMPTY = {
    loans: [],
    advances: [],
    rewards: [],
    fines: [],
};

const SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.75 };

const CARD_META = [
    {
        key: 'loans',
        title: 'My Loans',
        emptyText: 'You have no loans',
        Icon: HandCoins,
        iconWrap: 'bg-blue-50 text-blue-500',
        fadedIcon: 'text-blue-200',
    },
    {
        key: 'advances',
        title: 'My Advances',
        emptyText: 'You have no advances',
        Icon: Wallet,
        iconWrap: 'bg-violet-50 text-violet-500',
        fadedIcon: 'text-violet-200',
    },
    {
        key: 'rewards',
        title: 'My Rewards',
        emptyText: 'You have no rewards',
        Icon: Gift,
        iconWrap: 'bg-orange-50 text-orange-500',
        fadedIcon: 'text-orange-200',
    },
    {
        key: 'fines',
        title: 'My Fines',
        emptyText: 'You have no fines',
        Icon: ShieldAlert,
        iconWrap: 'bg-pink-50 text-pink-500',
        fadedIcon: 'text-pink-200',
    },
];

const SIDE_ROW = ['row-start-1', 'row-start-2', 'row-start-3'];

function formatAed(value) {
    const n = Number(value) || 0;
    return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function RecordRow({ item }) {
    const detail = itemDetail(item);
    return (
        <Link
            href={item.href || '#'}
            onClick={(e) => e.stopPropagation()}
            className="flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/80 transition-colors"
        >
            <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">{item.code}</p>
                {detail ? <p className="text-[10px] text-slate-400 truncate">{detail}</p> : null}
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700">{formatAed(item.amount)}</p>
            </div>
            <div className="text-right shrink-0">
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusClass(item.status)}`}>
                    {item.status}
                </span>
                {item.date ? <p className="text-[9px] text-slate-400 mt-0.5">{formatDate(item.date)}</p> : null}
            </div>
        </Link>
    );
}

function ExpandedHeader({ card, count }) {
    const Icon = card.Icon;
    return (
        <div className="shrink-0 px-4 pt-3 pb-2">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', card.iconWrap)}>
                    <Icon size={16} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 truncate">{card.title}</h3>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
                <span className="text-2xl font-black text-slate-800 tabular-nums leading-none">{count}</span>
                <ArrowUpRight size={14} className="text-slate-400" />
            </div>
        </div>
    );
}

function CardBody({ card, items }) {
    const Icon = card.Icon;

    return (
        <div className="flex-1 mx-3 mb-3 rounded-xl bg-slate-50 min-h-0 overflow-hidden flex flex-col">
            {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-3">
                    <Icon size={26} className={card.fadedIcon} />
                    <p className="text-xs text-slate-400">{card.emptyText}</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto py-0.5">
                    {items.map((item) => (
                        <RecordRow key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SummaryCard({ card, count }) {
    const Icon = card.Icon;
    return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-0.5 px-2 py-1.5">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.iconWrap)}>
                <Icon size={16} />
            </div>
            <span className="text-lg font-black text-slate-800 tabular-nums leading-none mt-0.5">{count}</span>
            <span className="text-[10px] font-medium text-slate-500 leading-tight text-center">{card.title}</span>
        </div>
    );
}

export default function DashboardEmployeeHrCards() {
    const [data, setData] = useState(EMPTY);
    const [expandedKey, setExpandedKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/Employee/dashboard/my-hr-cards', { skipToast: true });
                if (cancelled || !res?.data) return;
                setData({
                    loans: Array.isArray(res.data.loans) ? res.data.loans : [],
                    advances: Array.isArray(res.data.advances) ? res.data.advances : [],
                    rewards: Array.isArray(res.data.rewards) ? res.data.rewards : [],
                    fines: Array.isArray(res.data.fines) ? res.data.fines : [],
                });
            } catch {
                if (!cancelled) setData(EMPTY);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const sideKeys = expandedKey ? CARD_META.map((c) => c.key).filter((key) => key !== expandedKey) : [];

    const onCardClick = (key) => {
        setExpandedKey((prev) => (prev === key ? null : key));
    };

    return (
        <motion.section variants={dashboardItem}>
            <motion.div
                layout
                className={cn(
                    'grid gap-3',
                    expandedKey
                        ? 'grid-cols-[minmax(0,1fr)_9.75rem] grid-rows-3 h-[22.5rem]'
                        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 auto-rows-[11.75rem]',
                )}
                transition={{ layout: SPRING }}
            >
                {CARD_META.map((card) => {
                    const items = data[card.key] || [];
                    const isMain = expandedKey === card.key;
                    const isSide = Boolean(expandedKey) && !isMain;
                    const sideIndex = isSide ? sideKeys.indexOf(card.key) : -1;

                    return (
                        <motion.article
                            key={card.key}
                            layout
                            layoutId={`account-overview-${card.key}`}
                            transition={{ layout: SPRING }}
                            onClick={() => onCardClick(card.key)}
                            className={cn(
                                'dash-card-lift bg-white border border-slate-100 shadow-sm cursor-pointer overflow-hidden flex min-w-0 rounded-2xl',
                                !expandedKey && 'flex-col h-[11.75rem]',
                                isMain && 'flex-col col-start-1 row-start-1 row-span-3 h-full',
                                isSide && cn('col-start-2', SIDE_ROW[sideIndex]),
                            )}
                        >
                            {isSide ? (
                                <SummaryCard card={card} count={items.length} />
                            ) : (
                                <>
                                    <ExpandedHeader card={card} count={items.length} />
                                    <AnimatePresence initial={false} mode="popLayout">
                                        <motion.div
                                            key="body"
                                            className="flex-1 flex flex-col min-h-0"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        >
                                            <CardBody card={card} items={items} />
                                        </motion.div>
                                    </AnimatePresence>
                                </>
                            )}
                        </motion.article>
                    );
                })}
            </motion.div>
        </motion.section>
    );
}
