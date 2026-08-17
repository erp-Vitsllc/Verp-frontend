'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Car, PlugZap, Wrench } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { dashboardItem } from './dashboardMotion';

const EMPTY = {
    tools: [],
    vehicles: [],
    utilities: [],
};

const SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.75 };

const CARD_META = [
    {
        key: 'tools',
        title: 'My Tools',
        emptyText: 'You have no tools',
        Icon: Wrench,
        iconWrap: 'bg-teal-50 text-teal-600',
        fadedIcon: 'text-teal-200',
    },
    {
        key: 'vehicles',
        title: 'My Vehicles',
        emptyText: 'You have no vehicles',
        Icon: Car,
        iconWrap: 'bg-cyan-50 text-cyan-600',
        fadedIcon: 'text-cyan-200',
    },
    {
        key: 'utilities',
        title: 'My Utilities',
        emptyText: 'You have no utilities',
        Icon: PlugZap,
        iconWrap: 'bg-amber-50 text-amber-600',
        fadedIcon: 'text-amber-200',
        groupBy: 'group',
    },
];

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
}

function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('reject') || s.includes('lost') || s.includes('inactive')) return 'bg-red-50 text-red-700';
    if (s.includes('pending') || s.includes('waiting') || s.includes('maintenance') || s.includes('service')) {
        return 'bg-amber-50 text-amber-700';
    }
    if (s.includes('assigned') || s.includes('active') || s.includes('online')) {
        return 'bg-emerald-50 text-emerald-700';
    }
    return 'bg-slate-50 text-slate-600';
}

function RecordRow({ item, allowNavigate }) {
    const className =
        'flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/80 transition-colors';
    const content = (
        <>
            <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">{item.code}</p>
                {item.title && item.title !== item.code ? (
                    <p className="text-[10px] text-slate-400 truncate">{item.title}</p>
                ) : null}
            </div>
            <div className="text-right shrink-0">
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusClass(item.status)}`}>
                    {item.status}
                </span>
                {item.date ? <p className="text-[9px] text-slate-400 mt-0.5">{formatDate(item.date)}</p> : null}
            </div>
        </>
    );

    if (!allowNavigate) {
        return <div className={className}>{content}</div>;
    }

    return (
        <Link href={item.href || '#'} onClick={(e) => e.stopPropagation()} className={className}>
            {content}
        </Link>
    );
}

function groupItems(items, groupKey) {
    if (!groupKey) return [{ name: '', items }];
    const map = new Map();
    items.forEach((item) => {
        const name = String(item?.[groupKey] || 'Other').trim() || 'Other';
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(item);
    });
    return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, groupItemsList]) => ({ name, items: groupItemsList }));
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

function CardBody({ card, items, allowNavigate }) {
    const Icon = card.Icon;
    const groups = groupItems(items, card.groupBy);
    const showGroupHeaders = Boolean(card.groupBy) && groups.length > 1;

    return (
        <div className="mx-3 mb-3 rounded-xl bg-slate-50">
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-8">
                    <Icon size={26} className={card.fadedIcon} />
                    <p className="text-xs text-slate-400">{card.emptyText}</p>
                </div>
            ) : (
                <div className="py-0.5">
                    {groups.map((group) => (
                        <div key={group.name || 'all'}>
                            {showGroupHeaders ? (
                                <p className="px-2.5 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    {group.name}
                                </p>
                            ) : null}
                            {group.items.map((item) => (
                                <RecordRow key={item.id} item={item} allowNavigate={allowNavigate} />
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CollapsedBody({ card, count }) {
    const Icon = card.Icon;
    return (
        <div className="mx-3 mb-3 flex-1 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-1.5 px-3 min-h-0">
            <Icon size={26} className={card.fadedIcon} />
            {count === 0 ? <p className="text-xs text-slate-400">{card.emptyText}</p> : null}
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

export default function DashboardEmployeeAssetCards() {
    const [data, setData] = useState(EMPTY);
    const [expandedKey, setExpandedKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/Employee/dashboard/my-asset-cards', { skipToast: true });
                if (cancelled || !res?.data) return;
                setData({
                    tools: Array.isArray(res.data.tools) ? res.data.tools : [],
                    vehicles: Array.isArray(res.data.vehicles) ? res.data.vehicles : [],
                    utilities: Array.isArray(res.data.utilities) ? res.data.utilities : [],
                });
            } catch {
                if (!cancelled) setData(EMPTY);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const cards = useMemo(() => {
        const utilityItems = data.utilities || [];
        const providers = new Set(utilityItems.map((item) => String(item.group || 'Other').trim() || 'Other'));
        if (providers.size <= 1) return CARD_META;

        return [
            CARD_META[0],
            CARD_META[1],
            ...Array.from(providers)
                .sort((a, b) => a.localeCompare(b))
                .map((provider) => ({
                    key: `utility:${provider}`,
                    title: `My ${provider}`,
                    emptyText: `You have no ${provider} utilities`,
                    Icon: PlugZap,
                    iconWrap: 'bg-amber-50 text-amber-600',
                    fadedIcon: 'text-amber-200',
                    sourceKey: 'utilities',
                    provider,
                })),
        ];
    }, [data.utilities]);

    const itemsForCard = (card) => {
        if (card.provider) {
            return (data.utilities || []).filter(
                (item) => String(item.group || 'Other').trim() === card.provider,
            );
        }
        return data[card.sourceKey || card.key] || [];
    };

    const sideKeys = expandedKey ? cards.map((c) => c.key).filter((key) => key !== expandedKey) : [];

    return (
        <motion.section variants={dashboardItem}>
            <motion.div
                layout
                className={cn(
                    'grid gap-3 items-stretch',
                    expandedKey
                        ? 'grid-cols-[minmax(0,1fr)_9.75rem]'
                        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
                )}
                style={
                    expandedKey
                        ? { gridTemplateRows: `repeat(${Math.max(sideKeys.length, 1)}, minmax(0, 1fr))` }
                        : undefined
                }
                transition={{ layout: SPRING }}
            >
                {cards.map((card) => {
                    const items = itemsForCard(card);
                    const isMain = expandedKey === card.key;
                    const isSide = Boolean(expandedKey) && !isMain;
                    const sideIndex = isSide ? sideKeys.indexOf(card.key) : -1;

                    return (
                        <motion.article
                            key={card.key}
                            layout
                            layoutId={`asset-overview-${card.key}`}
                            transition={{ layout: SPRING }}
                            onClick={() => setExpandedKey((prev) => (prev === card.key ? null : card.key))}
                            className={cn(
                                'dash-card-lift bg-white border border-slate-100 shadow-sm cursor-pointer overflow-hidden flex min-w-0 rounded-2xl',
                                !expandedKey && 'flex-col h-[11.75rem]',
                                isMain && 'flex-col col-start-1 row-start-1 h-full',
                                isSide && 'col-start-2 h-full min-h-0',
                            )}
                            style={
                                isMain
                                    ? { gridRow: `1 / span ${Math.max(sideKeys.length, 1)}` }
                                    : isSide
                                      ? { gridRowStart: sideIndex + 1 }
                                      : undefined
                            }
                        >
                            {isSide ? (
                                <SummaryCard card={card} count={items.length} />
                            ) : (
                                <>
                                    <ExpandedHeader card={card} count={items.length} />
                                    <AnimatePresence initial={false} mode="popLayout">
                                        <motion.div
                                            key={isMain ? 'list' : 'preview'}
                                            className="flex flex-col flex-1 min-h-0"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        >
                                            {isMain ? (
                                                <CardBody card={card} items={items} allowNavigate />
                                            ) : (
                                                <CollapsedBody card={card} count={items.length} />
                                            )}
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
