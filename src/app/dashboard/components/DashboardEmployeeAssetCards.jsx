'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, PlugZap, Wrench, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, EmptyState, StatusBadge, metricHint } from './ui';

const EMPTY = {
    tools: [],
    vehicles: [],
    utilities: [],
};

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

function ToolTable({ items, onOpen, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';
    return (
        <DetailTable
            columns={TOOL_COLUMNS}
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
                        {item.name || item.title || '—'}
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

function VehicleTable({ items, onOpen, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';
    return (
        <DetailTable
            columns={VEHICLE_COLUMNS}
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
                        {item.name || item.code || '—'}
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

function UtilityTable({ items, onOpen, emptyText }) {
    const tdClass = 'px-2.5 py-2 text-[11px] text-slate-700 whitespace-nowrap align-middle';
    return (
        <DetailTable
            columns={UTILITY_COLUMNS}
            minWidth="min-w-[24rem]"
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
                        {item.type || item.title || '—'}
                    </td>
                    <td className={tdClass}>{item.number || item.code || '—'}</td>
                    <td className={tdClass}>{formatDate(item.date) || '—'}</td>
                </tr>
            )}
        />
    );
}

function CardBody({ card, items, onOpen }) {
    if (card.key === 'tools' || card.sourceKey === 'tools') {
        return <ToolTable items={items} onOpen={onOpen} emptyText={card.emptyText} />;
    }
    if (card.key === 'vehicles' || card.sourceKey === 'vehicles') {
        return <VehicleTable items={items} onOpen={onOpen} emptyText={card.emptyText} />;
    }
    return <UtilityTable items={items} onOpen={onOpen} emptyText={card.emptyText} />;
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

export default function DashboardEmployeeAssetCards({ embedded = false }) {
    const router = useRouter();
    const [data, setData] = useState(EMPTY);
    const [expandedKey, setExpandedKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/Employee/dashboard/my-asset-cards', { skipToast: true });
                if (cancelled || !res?.data) return;
                const hidePendingAsset = (item) => {
                    const s = String(item?.status || '').toLowerCase();
                    return !s.includes('pending') && !s.includes('submitted') && !s.includes('draft') && !s.includes('reject');
                };
                setData({
                    tools: (Array.isArray(res.data.tools) ? res.data.tools : []).filter(hidePendingAsset),
                    vehicles: (Array.isArray(res.data.vehicles) ? res.data.vehicles : []).filter(hidePendingAsset),
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
        </>
    );

    if (embedded) return body;

    return (
        <DashboardCard variants={dashboardItem} className="px-4 py-3.5">
            {body}
        </DashboardCard>
    );
}
