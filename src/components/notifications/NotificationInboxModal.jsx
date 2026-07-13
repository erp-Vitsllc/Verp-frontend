'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Award,
    BadgeCheck,
    Bell,
    BookUser,
    CheckCheck,
    ChevronRight,
    Clock,
    CreditCard,
    IdCard,
    Loader2,
    Plane,
    Settings2,
    Trash2,
    X,
} from 'lucide-react';
import {
    formatNotificationPendingSince,
    formatNotificationTime,
    groupNotificationsByDate,
    notificationStatusClass,
} from '@/utils/notificationInboxPresentation';
import { sortNotificationPresentationRows } from '@/utils/notificationSortOrder';

const NOTIFICATION_ICON_STYLES = {
    'expiry-plane': {
        Icon: Plane,
        shell: 'bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 border-sky-200/80 text-indigo-600 shadow-sm shadow-indigo-100/60',
    },
    'expiry-idcard': {
        Icon: IdCard,
        shell: 'bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 border-blue-200/80 text-blue-600 shadow-sm shadow-blue-100/60',
    },
    'expiry-idcard-teal': {
        Icon: IdCard,
        shell: 'bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 border-teal-200/80 text-teal-700 shadow-sm shadow-teal-100/60',
    },
    'expiry-idcard-amber': {
        Icon: IdCard,
        shell: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-amber-200/80 text-amber-700 shadow-sm shadow-amber-100/60',
    },
    'expiry-book-violet': {
        Icon: BookUser,
        shell: 'bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 border-violet-200/80 text-violet-600 shadow-sm shadow-violet-100/60',
    },
    'expiry-book-warm': {
        Icon: BookUser,
        shell: 'bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 border-orange-200/80 text-orange-600 shadow-sm shadow-orange-100/60',
    },
    'renew-plane': {
        Icon: Plane,
        shell: 'bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 border-rose-200/80 text-rose-600 shadow-sm shadow-rose-100/60',
    },
    'renew-idcard': {
        Icon: IdCard,
        shell: 'bg-gradient-to-br from-rose-50 via-pink-50 to-red-50 border-rose-200/80 text-rose-700 shadow-sm shadow-rose-100/60',
    },
    'renew-book': {
        Icon: BookUser,
        shell: 'bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 border-red-200/70 text-red-600 shadow-sm shadow-red-100/60',
    },
    'activation-profile': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 border-blue-200/80 text-blue-600 shadow-sm shadow-blue-100/60',
    },
    'activation-company': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-emerald-200/80 text-emerald-700 shadow-sm shadow-emerald-100/60',
    },
    'incomplete-settings': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-200/80 text-amber-700 shadow-sm shadow-amber-100/60',
    },
    'probation-settings': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-violet-50 via-indigo-50 to-blue-50 border-violet-200/80 text-violet-600 shadow-sm shadow-violet-100/60',
    },
    'progress-check': {
        Icon: CheckCheck,
        shell: 'bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50 border-emerald-200/80 text-emerald-600 shadow-sm shadow-emerald-100/60',
    },
    'payment-card': {
        Icon: CreditCard,
        shell: 'bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 border-sky-200/80 text-sky-700 shadow-sm shadow-sky-100/60',
    },
    'fine-book': {
        Icon: BookUser,
        shell: 'bg-gradient-to-br from-rose-50 via-red-50 to-orange-50 border-rose-200/80 text-rose-600 shadow-sm shadow-rose-100/60',
    },
    'fine-group': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-fuchsia-50 via-rose-50 to-pink-50 border-fuchsia-200/80 text-fuchsia-700 shadow-sm shadow-fuchsia-100/60',
    },
    'reward-award': {
        Icon: Award,
        shell: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-200/80 text-amber-700 shadow-sm shadow-amber-100/60',
    },
    'asset-settings': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-200/80 text-amber-700 shadow-sm shadow-amber-100/60',
    },
    'asset-settings-urgent': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 border-red-200/80 text-red-600 shadow-sm shadow-red-100/60',
    },
    'asset-settings-bulk': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-slate-50 via-zinc-50 to-stone-50 border-slate-300/80 text-slate-600 shadow-sm shadow-slate-100/60',
    },
    'asset-settings-accessory': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 border-purple-200/80 text-purple-600 shadow-sm shadow-purple-100/60',
    },
    'asset-settings-unattach': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-orange-50 via-red-50 to-rose-50 border-orange-200/80 text-orange-700 shadow-sm shadow-orange-100/60',
    },
    'asset-settings-service': {
        Icon: Settings2,
        shell: 'bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 border-indigo-200/80 text-indigo-700 shadow-sm shadow-indigo-100/60',
    },
    'asset-badge-duty': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 border-lime-200/80 text-green-700 shadow-sm shadow-green-100/60',
    },
    'asset-badge-request': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 border-teal-200/80 text-teal-700 shadow-sm shadow-teal-100/60',
    },
    'asset-badge-assign': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-lime-50 via-emerald-50 to-teal-50 border-lime-200/80 text-emerald-700 shadow-sm shadow-emerald-100/60',
    },
    'asset-badge-approve': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 border-blue-200/80 text-indigo-700 shadow-sm shadow-blue-100/60',
    },
    'asset-badge-accessory': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-50 border-purple-200/80 text-purple-700 shadow-sm shadow-purple-100/60',
    },
    'asset-badge-vehicle': {
        Icon: BadgeCheck,
        shell: 'bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 border-cyan-200/80 text-sky-700 shadow-sm shadow-cyan-100/60',
    },
    'asset-plane': {
        Icon: Plane,
        shell: 'bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 border-sky-200/80 text-sky-700 shadow-sm shadow-sky-100/60',
    },
    'asset-clock': {
        Icon: Clock,
        shell: 'bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 border-cyan-200/80 text-cyan-700 shadow-sm shadow-cyan-100/60',
    },
    'asset-clock-eol': {
        Icon: Clock,
        shell: 'bg-gradient-to-br from-stone-50 via-slate-50 to-gray-50 border-stone-300/80 text-stone-600 shadow-sm shadow-stone-100/60',
    },
    'asset-check-return': {
        Icon: CheckCheck,
        shell: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 border-emerald-200/80 text-emerald-700 shadow-sm shadow-emerald-100/60',
    },
    'asset-book-loss': {
        Icon: BookUser,
        shell: 'bg-gradient-to-br from-stone-50 via-amber-50 to-orange-50 border-stone-200/80 text-stone-700 shadow-sm shadow-stone-100/60',
    },
    'default-bell': {
        Icon: Bell,
        shell: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 border-slate-200/80 text-slate-500 shadow-sm shadow-slate-100/60',
    },
};

function NotificationIcon({ variant }) {
    const style = NOTIFICATION_ICON_STYLES[variant] || NOTIFICATION_ICON_STYLES['default-bell'];
    const { Icon, shell } = style;

    return (
        <div
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${shell}`}
        >
            <span className="absolute inset-[3px] rounded-[0.7rem] bg-white/35 pointer-events-none" />
            <Icon size={17} strokeWidth={2.1} className="relative z-[1] drop-shadow-sm" />
        </div>
    );
}

/** Shared compact inbox width — matches Company / expiry notification modal sizing across all pages. */
export const NOTIFICATION_INBOX_MODAL_CLASS =
    'w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col';

export default function NotificationInboxModal({
    isOpen,
    onClose,
    title = 'My Requests & Notifications',
    items = [],
    loading = false,
    refreshing = false,
    error = '',
    emptyMessage = 'No notifications found.',
    onItemClick,
    onDelete,
    hideItemTitle = false,
    listMaxHeight,
}) {
    const [unreadKeys, setUnreadKeys] = useState(() => new Set());

    useEffect(() => {
        if (!isOpen) return;
        setUnreadKeys(new Set(items.map((row) => row.key)));
    }, [isOpen, items]);

    const sortedItems = useMemo(() => sortNotificationPresentationRows(items), [items]);
    const groupedItems = useMemo(() => groupNotificationsByDate(sortedItems), [sortedItems]);
    const scrollMaxHeight = listMaxHeight || 'min(28rem, calc(90vh - 11rem))';

    const markRead = (key) => {
        setUnreadKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
            <div className={NOTIFICATION_INBOX_MODAL_CLASS}>
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-sm shadow-sky-100/70">
                                <Bell size={18} strokeWidth={2.1} />
                            </div>
                            {items.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                                    {items.length > 99 ? '99+' : items.length}
                                </span>
                            )}
                        </div>
                        <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
                            {title}
                            {refreshing ? (
                                <Loader2 className="inline-block ml-2 h-3.5 w-3.5 animate-spin text-sky-500 align-middle" />
                            ) : null}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div
                    className="overflow-y-auto min-h-0 flex-1"
                    style={{ maxHeight: scrollMaxHeight }}
                >
                    {loading && items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Loading…</span>
                        </div>
                    ) : error && items.length === 0 ? (
                        <div className="m-6 py-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3">
                            {error}
                        </div>
                    ) : sortedItems.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-500 px-6">{emptyMessage}</div>
                    ) : (
                        <div className="py-2">
                            {groupedItems.map((group) => (
                                <div key={group.label}>
                                    <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                        {group.label}
                                    </div>
                                    <ul className="divide-y divide-slate-100">
                                        {group.items.map((row) => {
                                            const isUnread = unreadKeys.has(row.key);
                                            const pendingSince = formatNotificationPendingSince(
                                                row.requestedDate,
                                                row.raw,
                                                row.status,
                                            );
                                            const notificationTime = formatNotificationTime(
                                                row.requestedDate,
                                                row.raw,
                                            );
                                            return (
                                                <li key={row.key} className="flex items-stretch gap-0 group">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            markRead(row.key);
                                                            onItemClick?.(row.raw ?? row);
                                                        }}
                                                        className="flex-1 flex items-center gap-1 px-5 py-3 text-left hover:bg-gradient-to-r hover:from-sky-50/70 hover:to-transparent transition-all min-w-0"
                                                    >
                                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                                            {isUnread ? (
                                                                <span className="w-2 h-2 rounded-full bg-sky-500 mt-5 shrink-0 ring-2 ring-sky-100" />
                                                            ) : (
                                                                <span className="w-2 shrink-0" />
                                                            )}
                                                            <NotificationIcon variant={row.iconVariant} />
                                                            <div className="min-w-0 flex-1">
                                                                <div
                                                                    className={`flex items-start justify-between gap-4${hideItemTitle ? '' : ' mb-1'}`}
                                                                >
                                                                    {!hideItemTitle ? (
                                                                        <p className="text-sm font-bold text-slate-900">
                                                                            {row.title}
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-sm font-semibold text-slate-900 min-w-0 break-words">
                                                                            {row.source}
                                                                            {row.category ? (
                                                                                <>
                                                                                    {' '}
                                                                                    · {row.category}
                                                                                </>
                                                                            ) : null}
                                                                        </p>
                                                                    )}
                                                                    <span
                                                                        className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${notificationStatusClass(row.status)}`}
                                                                    >
                                                                        {row.status || 'Pending'}
                                                                    </span>
                                                                </div>
                                                                {!hideItemTitle ? (
                                                                <p className="text-xs text-slate-500 break-words">
                                                                    {row.source}
                                                                    {row.category ? <> · {row.category}</> : null}
                                                                    {row.highlight ? (
                                                                        <>
                                                                            {' '}
                                                                            · Exp{' '}
                                                                            <span className="font-semibold text-[11px] text-red-600">
                                                                                {row.highlight}
                                                                            </span>
                                                                        </>
                                                                    ) : null}
                                                                </p>
                                                                ) : null}
                                                                {(row.entityName || row.entityId) && (
                                                                    <div className="mt-2 inline-flex items-center gap-1.5 max-w-full">
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 max-w-full shadow-sm">
                                                                            {row.entityName ? (
                                                                                <span className="font-medium truncate">
                                                                                    {row.entityName}
                                                                                </span>
                                                                            ) : null}
                                                                            {row.entityId ? (
                                                                                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                                                                    {row.entityId}
                                                                                </span>
                                                                            ) : null}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-end mt-2">
                                                                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                                                                        {pendingSince ? (
                                                                            <span className="text-slate-500">{pendingSince}</span>
                                                                        ) : null}
                                                                        {notificationTime ? (
                                                                            <span className="inline-flex items-center gap-1">
                                                                                {pendingSince ? (
                                                                                    <span aria-hidden>·</span>
                                                                                ) : null}
                                                                                <Clock size={12} />
                                                                                {notificationTime}
                                                                            </span>
                                                                        ) : null}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight
                                                            size={16}
                                                            className="shrink-0 self-center mr-2 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                                                            aria-hidden
                                                        />
                                                    </button>
                                                    {onDelete ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onDelete(row.raw ?? row)}
                                                            className="self-center px-4 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                                            title="Remove notification"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50 shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                        {sortedItems.length} item{sortedItems.length === 1 ? '' : 's'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
