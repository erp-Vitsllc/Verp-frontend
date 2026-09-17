'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Bell, Info, Loader2, Mail, MessageCircle } from 'lucide-react';

function ChannelCheck({ checked, disabled, onChange, label }) {
    return (
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            {label}
        </label>
    );
}

export default function NotificationEmailsPage() {
    const { toast } = useToast();
    const [accessChecked, setAccessChecked] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState([]);
    const [savingKey, setSavingKey] = useState('');

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
            setGroups(Array.isArray(res.data?.groups) ? res.data.groups : []);
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

    const saveChannel = async (item, patch) => {
        setSavingKey(item.key);
        try {
            await axiosInstance.patch('/NotificationEmailPermission', {
                eventKey: item.key,
                ...patch,
            });
            setGroups((prev) =>
                prev.map((group) => ({
                    ...group,
                    modules: group.modules.map((mod) => ({
                        ...mod,
                        items: mod.items.map((row) =>
                            row.key === item.key ? { ...row, ...patch } : row,
                        ),
                    })),
                })),
            );
        } catch (error) {
            toast({
                title: 'Could not save',
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
            load();
        } finally {
            setSavingKey('');
        }
    };

    if (!accessChecked) {
        return (
            <div className="flex min-h-screen bg-slate-50">
                <Sidebar />
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </div>
            </div>
        );
    }

    if (!allowed) {
        return (
            <div className="flex min-h-screen bg-slate-50">
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
        <div className="flex min-h-screen bg-[#f4f6f8]">
            <Sidebar />
            <div className="flex flex-1 flex-col min-w-0">
                <Navbar />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                    <div className="max-w-5xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                                Notifications and Email Permission
                            </h1>
                            <p className="mt-2 text-sm text-slate-600 max-w-3xl">
                                Turn Notification, Email, and WhatsApp on or off for each event. WhatsApp is paid:
                                if the employee has a company email, only that email is sent. If they have no company
                                email, only WhatsApp is sent. Never both, and never a second copy.
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {groups.map((group) => (
                                    <section key={group.group} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <div className="border-b border-slate-100 px-5 py-3">
                                            <h2 className="text-sm font-bold uppercase tracking-wide text-teal-700">
                                                {group.group}
                                            </h2>
                                        </div>
                                        {group.modules.map((mod) => (
                                            <div key={`${group.group}-${mod.module}`} className="border-b border-slate-100 last:border-b-0">
                                                <div className="bg-slate-50 px-5 py-2">
                                                    <h3 className="text-sm font-semibold text-slate-800">{mod.module}</h3>
                                                </div>
                                                <ul>
                                                    {mod.items.map((item) => (
                                                        <li
                                                            key={item.key}
                                                            className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start sm:justify-between border-t border-slate-100 first:border-t-0"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                                                                    {item.label}
                                                                    <span
                                                                        className="relative inline-flex group"
                                                                        title={item.detail}
                                                                    >
                                                                        <Info
                                                                            size={14}
                                                                            className="text-slate-400 cursor-help"
                                                                        />
                                                                        <span className="pointer-events-none absolute left-0 top-5 z-20 hidden w-72 rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-600 shadow-lg group-hover:block">
                                                                            {item.detail}
                                                                        </span>
                                                                    </span>
                                                                </p>
                                                                <p className="mt-0.5 text-xs text-slate-500">{item.hint}</p>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                                                                <ChannelCheck
                                                                    label={
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Bell size={12} /> Notification
                                                                        </span>
                                                                    }
                                                                    checked={item.notification}
                                                                    disabled={savingKey === item.key}
                                                                    onChange={(notification) =>
                                                                        saveChannel(item, { notification })
                                                                    }
                                                                />
                                                                <ChannelCheck
                                                                    label={
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <Mail size={12} /> Email
                                                                        </span>
                                                                    }
                                                                    checked={item.email}
                                                                    disabled={savingKey === item.key}
                                                                    onChange={(email) => saveChannel(item, { email })}
                                                                />
                                                                <ChannelCheck
                                                                    label={
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <MessageCircle size={12} /> WhatsApp
                                                                        </span>
                                                                    }
                                                                    checked={item.whatsapp}
                                                                    disabled={savingKey === item.key}
                                                                    onChange={(whatsapp) =>
                                                                        saveChannel(item, { whatsapp })
                                                                    }
                                                                />
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </section>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
