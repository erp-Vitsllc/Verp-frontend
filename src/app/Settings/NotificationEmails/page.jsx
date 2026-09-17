'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CHANNELS = [
    { id: 'notification', label: 'Notification' },
    { id: 'email', label: 'Email' },
    { id: 'whatsapp', label: 'WhatsApp' },
];

const allOn = (items, channelId) =>
    items.length > 0 && items.every((item) => item[channelId] === true);

export default function NotificationEmailsPage() {
    const { toast } = useToast();
    const [accessChecked, setAccessChecked] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState([]);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [detailItem, setDetailItem] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/NotificationEmailPermission/access');
                if (!cancelled) {
                    setAllowed(!!res.data?.allowed);
                    setAccessChecked(true);
                }
            } catch {
                if (!cancelled) {
                    setAllowed(false);
                    setAccessChecked(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/NotificationEmailPermission');
            const next = Array.isArray(res.data?.groups) ? res.data.groups : [];
            setGroups(next);
            setExpanded((prev) => {
                if (Object.keys(prev).length) return prev;
                const open = {};
                next.forEach((group) => {
                    open[group.group] = true;
                    (group.modules || []).forEach((mod) => {
                        open[`${group.group}::${mod.module}`] = true;
                    });
                });
                return open;
            });
        } catch (error) {
            toast({
                title: 'Could not load permissions',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!allowed) return;
        load();
    }, [allowed, load]);

    const allItems = useMemo(
        () =>
            groups.flatMap((group) =>
                (group.modules || []).flatMap((mod) =>
                    (mod.items || []).map((item) => ({ ...item, group: group.group, module: mod.module })),
                ),
            ),
        [groups],
    );

    const applyLocalPatch = (keys, patch) => {
        const set = new Set(keys);
        setGroups((prev) =>
            prev.map((group) => ({
                ...group,
                modules: group.modules.map((mod) => ({
                    ...mod,
                    items: mod.items.map((row) => (set.has(row.key) ? { ...row, ...patch } : row)),
                })),
            })),
        );
    };

    const saveItems = async (items, patch) => {
        if (!items.length) return;
        setSaving(true);
        const keys = items.map((item) => item.key);
        applyLocalPatch(keys, patch);
        try {
            await Promise.all(
                keys.map((eventKey) =>
                    axiosInstance.patch('/NotificationEmailPermission', { eventKey, ...patch }),
                ),
            );
        } catch (error) {
            toast({
                title: 'Could not save',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
            load();
        } finally {
            setSaving(false);
        }
    };

    const toggle = (id) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    if (!accessChecked || (allowed && loading && !groups.length)) {
        return (
            <div className="flex min-h-screen bg-[#F2F6F9] w-full max-w-full overflow-x-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 text-center text-xs sm:text-sm text-gray-500">
                            Loading permissions...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex min-h-screen bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex flex-1 flex-col">
                    <Navbar />
                    <main className="flex flex-1 items-center justify-center p-8">
                        <p className="text-slate-600">
                            You do not have access to Notifications and Email Permission. Super User (admin) only.
                        </p>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#F2F6F9] w-full max-w-full overflow-x-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                <Navbar />
                <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">
                    <div className="mb-4 sm:mb-6">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
                            Notifications and Email Permission
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600">
                            Turn Notification, Email, and WhatsApp on or off for each event. Click a topic for the full
                            description. WhatsApp is paid: company email gets one email only; no company email gets one
                            WhatsApp.
                        </p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
                        <div className="mb-4 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="full-channel"
                                checked={
                                    allItems.length > 0 &&
                                    allItems.every((item) => item.notification && item.email && item.whatsapp)
                                }
                                disabled={saving}
                                onChange={(event) =>
                                    void saveItems(allItems, {
                                        notification: event.target.checked,
                                        email: event.target.checked,
                                        whatsapp: event.target.checked,
                                    })
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                            />
                            <label htmlFor="full-channel" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Full Permission (select all notification, email, WhatsApp)
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Module notifications
                            </label>
                            <div className="border border-gray-300 rounded-lg overflow-x-auto">
                                <table className="w-full min-w-[640px] text-xs sm:text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase">
                                                Module
                                            </th>
                                            {CHANNELS.map((channel) => (
                                                <th
                                                    key={channel.id}
                                                    className="px-3 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-700 uppercase"
                                                >
                                                    {channel.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {groups.map((group) => {
                                            const groupOpen = expanded[group.group] !== false;
                                            const groupItems = (group.modules || []).flatMap((mod) => mod.items || []);
                                            return (
                                                <Fragment key={group.group}>
                                                    <tr className="hover:bg-gray-50">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggle(group.group)}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                    aria-label={
                                                                        groupOpen
                                                                            ? `Collapse ${group.group}`
                                                                            : `Expand ${group.group}`
                                                                    }
                                                                >
                                                                    {groupOpen ? (
                                                                        <ChevronDown size={16} />
                                                                    ) : (
                                                                        <ChevronRight size={16} />
                                                                    )}
                                                                </button>
                                                                <span className="text-sm font-medium text-gray-900">
                                                                    {group.group}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {CHANNELS.map((channel) => (
                                                            <td key={channel.id} className="px-4 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allOn(groupItems, channel.id)}
                                                                    disabled={saving}
                                                                    onChange={(event) =>
                                                                        void saveItems(groupItems, {
                                                                            [channel.id]: event.target.checked,
                                                                        })
                                                                    }
                                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                                                                    aria-label={`${group.group} - ${channel.label}`}
                                                                    title={`${group.group} - ${channel.label}`}
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    {groupOpen &&
                                                        (group.modules || []).map((mod) => {
                                                            const modId = `${group.group}::${mod.module}`;
                                                            const modOpen = expanded[modId] !== false;
                                                            const modItems = mod.items || [];
                                                            return (
                                                                <Fragment key={modId}>
                                                                    <tr className="hover:bg-gray-50">
                                                                        <td className="px-4 py-3 pl-8">
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggle(modId)}
                                                                                    className="text-gray-400 hover:text-gray-600"
                                                                                    aria-label={
                                                                                        modOpen
                                                                                            ? `Collapse ${mod.module}`
                                                                                            : `Expand ${mod.module}`
                                                                                    }
                                                                                >
                                                                                    {modOpen ? (
                                                                                        <ChevronDown size={16} />
                                                                                    ) : (
                                                                                        <ChevronRight size={16} />
                                                                                    )}
                                                                                </button>
                                                                                <span className="text-sm font-medium text-gray-900">
                                                                                    {mod.module}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        {CHANNELS.map((channel) => (
                                                                            <td
                                                                                key={channel.id}
                                                                                className="px-4 py-3 text-center"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={allOn(modItems, channel.id)}
                                                                                    disabled={saving}
                                                                                    onChange={(event) =>
                                                                                        void saveItems(modItems, {
                                                                                            [channel.id]:
                                                                                                event.target.checked,
                                                                                        })
                                                                                    }
                                                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                                                                                    aria-label={`${mod.module} - ${channel.label}`}
                                                                                    title={`${mod.module} - ${channel.label}`}
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                    {modOpen &&
                                                                        modItems.map((item) => (
                                                                            <tr key={item.key} className="hover:bg-gray-50">
                                                                                <td className="px-4 py-3 pl-16">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="w-4" />
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setDetailItem(item)}
                                                                                            className="text-left text-sm font-medium text-gray-900 hover:text-blue-700"
                                                                                        >
                                                                                            {item.label}
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setDetailItem(item)}
                                                                                            className="text-gray-400 hover:text-blue-600"
                                                                                            title="View description"
                                                                                            aria-label={`Details for ${item.label}`}
                                                                                        >
                                                                                            <Info size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                                {CHANNELS.map((channel) => (
                                                                                    <td
                                                                                        key={channel.id}
                                                                                        className="px-4 py-3 text-center"
                                                                                    >
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={item[channel.id] === true}
                                                                                            disabled={saving}
                                                                                            onChange={(event) =>
                                                                                                void saveItems([item], {
                                                                                                    [channel.id]:
                                                                                                        event.target.checked,
                                                                                                })
                                                                                            }
                                                                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                                                                                            aria-label={`${item.label} - ${channel.label}`}
                                                                                            title={`${item.label} - ${channel.label}`}
                                                                                        />
                                                                                    </td>
                                                                                ))}
                                                                            </tr>
                                                                        ))}
                                                                </Fragment>
                                                            );
                                                        })}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AlertDialog open={Boolean(detailItem)} onOpenChange={(open) => !open && setDetailItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{detailItem?.label || 'Topic'}</AlertDialogTitle>
                        {detailItem?.hint ? (
                            <p className="text-sm font-medium text-gray-800 text-left">{detailItem.hint}</p>
                        ) : null}
                        <AlertDialogDescription className="text-left whitespace-pre-wrap">
                            {detailItem?.detail || ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction type="button" onClick={() => setDetailItem(null)}>
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
