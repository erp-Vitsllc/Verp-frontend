'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Car, PlugZap, Wrench } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, EmptyState, StatusBadge, metricHint } from './ui';

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
        emptyText: 'No tools assigned',
        label: (count) => (count === 1 ? 'Assigned Tool' : 'Assigned Tools'),
        Icon: Wrench,
        iconWrap: 'bg-teal-50 text-teal-600',
        arrowHover: 'group-hover/card:text-teal-600',
        wrap: 'bg-teal-50/70 text-teal-800',
    },
    {
        key: 'vehicles',
        title: 'My Vehicles',
        emptyText: 'No vehicle assigned',
        label: (count) => (count === 1 ? 'Assigned Vehicle' : 'Assigned Vehicles'),
        Icon: Car,
        iconWrap: 'bg-cyan-50 text-cyan-600',
        arrowHover: 'group-hover/card:text-cyan-600',
        wrap: 'bg-cyan-50/70 text-cyan-800',
    },
    {
        key: 'utilities',
        title: 'My Utilities',
        emptyText: 'No utilities assigned',
        label: (count) => (count === 1 ? 'Active Utility' : 'Active Utilities'),
        Icon: PlugZap,
        iconWrap: 'bg-amber-50 text-amber-600',
        arrowHover: 'group-hover/card:text-amber-600',
        wrap: 'bg-amber-50/70 text-amber-800',
        groupBy: 'group',
    },
];

const TOOL_COLUMNS = ['Asset Name', 'Asset ID', 'Type', 'Assigned Date', 'Status'];
const VEHICLE_COLUMNS = ['Vehicle', 'Asset ID', 'Type', 'Assigned Date', 'Status'];
const UTILITY_COLUMNS = ['Utility Type', 'Number', 'Assigned Date'];

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

function ToolTable({ items, allowNavigate, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';
    return (
        <DetailTable
            columns={TOOL_COLUMNS}
            minWidth="min-w-[32rem]"
            items={items}
            emptyText={emptyText}
            allowNavigate={allowNavigate}
            renderRow={(item, canNavigate) => (
                <tr key={item.id} className="border-b border-[#E7EBF1] last:border-0 hover:bg-slate-50/80 transition-colors">
                    <td className={cn(tdClass, 'font-semibold text-[#111827]')}>
                        {canNavigate ? (
                            <Link href={item.href || '#'} className="hover:text-blue-600 hover:underline">
                                {item.name || item.title || '—'}
                            </Link>
                        ) : (
                            item.name || item.title || '—'
                        )}
                    </td>
                    <td className={tdClass}>{item.assetId || item.code || '—'}</td>
                    <td className={tdClass}>{item.type || '—'}</td>
                    <td className={tdClass}>{formatDate(item.date) || '—'}</td>
                    <td className={tdClass}>
                        <StatusBadge className={statusClass(item.status)}>{item.status || '—'}</StatusBadge>
                    </td>
                </tr>
            )}
        />
    );
}

function VehicleTable({ items, allowNavigate, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';
    return (
        <DetailTable
            columns={VEHICLE_COLUMNS}
            minWidth="min-w-[32rem]"
            items={items}
            emptyText={emptyText}
            allowNavigate={allowNavigate}
            renderRow={(item, canNavigate) => (
                <tr key={item.id} className="border-b border-[#E7EBF1] last:border-0 hover:bg-slate-50/80 transition-colors">
                    <td className={cn(tdClass, 'font-semibold text-[#111827]')}>
                        {canNavigate ? (
                            <Link href={item.href || '#'} className="hover:text-blue-600 hover:underline">
                                {item.name || item.code || '—'}
                            </Link>
                        ) : (
                            item.name || item.code || '—'
                        )}
                    </td>
                    <td className={tdClass}>{item.assetId || '—'}</td>
                    <td className={tdClass}>{item.type || '—'}</td>
                    <td className={tdClass}>{formatDate(item.date) || '—'}</td>
                    <td className={tdClass}>
                        <StatusBadge className={statusClass(item.status)}>{item.status || '—'}</StatusBadge>
                    </td>
                </tr>
            )}
        />
    );
}

function UtilityTable({ items, allowNavigate, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';
    return (
        <DetailTable
            columns={UTILITY_COLUMNS}
            minWidth="min-w-[24rem]"
            items={items}
            emptyText={emptyText}
            allowNavigate={allowNavigate}
            renderRow={(item, canNavigate) => (
                <tr key={item.id} className="border-b border-[#E7EBF1] last:border-0 hover:bg-slate-50/80 transition-colors">
                    <td className={cn(tdClass, 'font-semibold text-[#111827]')}>
                        {canNavigate ? (
                            <Link href={item.href || '#'} className="hover:text-blue-600 hover:underline">
                                {item.type || item.title || '—'}
                            </Link>
                        ) : (
                            item.type || item.title || '—'
                        )}
                    </td>
                    <td className={tdClass}>{item.number || item.code || '—'}</td>
                    <td className={tdClass}>{formatDate(item.date) || '—'}</td>
                </tr>
            )}
        />
    );
}

function CardBody({ card, items, allowNavigate }) {
    if (card.key === 'tools') {
        return <ToolTable items={items} allowNavigate={allowNavigate} emptyText={card.emptyText} />;
    }
    if (card.key === 'vehicles') {
        return <VehicleTable items={items} allowNavigate={allowNavigate} emptyText={card.emptyText} />;
    }
    return <UtilityTable items={items} allowNavigate={allowNavigate} emptyText={card.emptyText} />;
}

function ExpandedHeader({ card, count }) {
    const Icon = card.Icon;
    return (
        <div className="shrink-0 px-4 pt-3.5 pb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', card.iconWrap)}>
                    <Icon size={16} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#111827] truncate">{card.title}</h3>
                    <p className="text-[11px] text-[#8792A6] truncate">{card.label(count)}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <p className="text-[26px] font-bold text-[#111827] tabular-nums leading-none">{count}</p>
                <ArrowUpRight size={16} className={cn('text-[#8792A6] transition-colors duration-200', card.arrowHover)} />
            </div>
        </div>
    );
}

export default function DashboardEmployeeAssetCards({ embedded = false }) {
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
                    emptyText: `No ${provider} assigned`,
                    label: (count) => (count === 1 ? `Active ${provider}` : `${provider}`),
                    Icon: PlugZap,
                    iconWrap: 'bg-amber-50 text-amber-600',
                    arrowHover: 'group-hover/card:text-amber-600',
                    wrap: 'bg-amber-50/70 text-amber-800',
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

    const expandedCard = cards.find((card) => card.key === expandedKey) || null;
    const expandedItems = expandedCard ? itemsForCard(expandedCard) : [];

    const body = (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cards.map((card) => {
                    const count = itemsForCard(card).length;
                    const active = expandedKey === card.key;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            onClick={() => setExpandedKey((prev) => (prev === card.key ? null : card.key))}
                            className={cn(
                                'rounded-xl px-2.5 py-2.5 min-w-0 min-h-[72px] flex flex-col justify-center text-left transition-shadow duration-200',
                                card.wrap || 'bg-amber-50/70 text-amber-800',
                                active ? 'ring-1 ring-slate-900/20' : '',
                            )}
                        >
                            <p className="text-lg font-bold tabular-nums leading-none">{count}</p>
                            <p className="text-[11px] font-medium mt-1 leading-tight">{card.title}</p>
                            <p className="text-[10px] mt-0.5 leading-tight opacity-80">
                                {metricHint(count, card.emptyText)}
                            </p>
                        </button>
                    );
                })}
            </div>

            <AnimatePresence initial={false}>
                {expandedCard ? (
                    <motion.div
                        key={expandedCard.key}
                        className="mt-3 min-h-[220px] rounded-xl border border-[#E7EBF1] bg-white overflow-hidden flex flex-col"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={SPRING}
                    >
                        <ExpandedHeader card={expandedCard} count={expandedItems.length} />
                        <CardBody card={expandedCard} items={expandedItems} allowNavigate />
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    );

    if (embedded) return body;

    return (
        <DashboardCard variants={dashboardItem} className="px-4 py-3.5">
            {body}
        </DashboardCard>
    );
}
