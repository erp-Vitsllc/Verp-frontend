'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    Activity,
    ExternalLink,
    Loader2,
    Search,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function formatTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return '—';
    }
}

function actionBadgeClass(action) {
    const a = String(action || '').toLowerCase();
    if (a === 'create') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (a === 'update') return 'bg-sky-50 text-sky-800 border-sky-200';
    if (a === 'delete') return 'bg-red-50 text-red-800 border-red-200';
    if (a === 'approve') return 'bg-violet-50 text-violet-800 border-violet-200';
    if (a === 'reject') return 'bg-amber-50 text-amber-900 border-amber-200';
    if (a === 'restore') return 'bg-teal-50 text-teal-800 border-teal-200';
    if (a === 'login') return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function ActivityLogsPage() {
    const { toast } = useToast();

    const [accessChecked, setAccessChecked] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [modules, setModules] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const limit = 50;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get('/ActivityLog/access');
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

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit };
            if (search) params.search = search;
            if (moduleFilter) params.module = moduleFilter;
            if (actionFilter) params.action = actionFilter;
            const res = await axiosInstance.get('/ActivityLog', { params });
            setItems(res.data?.items || []);
            setTotal(res.data?.total || 0);
            setTotalPages(res.data?.totalPages || 1);
            setModules(res.data?.modules || []);
        } catch (e) {
            toast({
                title: 'Failed to load activity logs',
                description: e.response?.data?.message || e.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [page, search, moduleFilter, actionFilter, toast]);

    useEffect(() => {
        if (!allowed) return;
        loadLogs();
    }, [allowed, loadLogs]);

    const applySearch = (e) => {
        e?.preventDefault?.();
        setPage(1);
        setSearch(searchInput.trim());
    };

    if (!accessChecked) {
        return (
            <div className="flex min-h-screen bg-slate-50">
                <Sidebar />
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
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
                            You do not have access to activity logs. Administrator or Flowchart Management only.
                        </p>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <div className="flex flex-1 flex-col min-w-0">
                <Navbar />
                <main className="flex-1 p-6 lg:p-8 overflow-auto">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-slate-900">Activity Logs</h1>
                                <p className="text-sm text-slate-500">
                                    Every create, update, delete, approval, and login across the ERP — who did it, from which IP, when, and a link to the record.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-3 mb-5">
                            <form onSubmit={applySearch} className="flex-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="search"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder="Search by person, action, IP, or record…"
                                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
                                >
                                    Search
                                </button>
                            </form>
                            <select
                                value={moduleFilter}
                                onChange={(e) => {
                                    setPage(1);
                                    setModuleFilter(e.target.value);
                                }}
                                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
                            >
                                <option value="">All modules</option>
                                {modules.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={actionFilter}
                                onChange={(e) => {
                                    setPage(1);
                                    setActionFilter(e.target.value);
                                }}
                                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
                            >
                                <option value="">All actions</option>
                                <option value="login">Login</option>
                                <option value="create">Create</option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                                <option value="approve">Approve</option>
                                <option value="reject">Reject</option>
                                <option value="restore">Restore</option>
                                <option value="assign">Assign</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                                No activity logged yet. Actions across the ERP will appear here as people create, update, or delete records.
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    <div className="hidden md:grid grid-cols-[1.5fr_0.85fr_0.85fr_0.7fr_0.7fr_0.5fr] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <span>Activity</span>
                                        <span>Module</span>
                                        <span>IP</span>
                                        <span>Date</span>
                                        <span>Time</span>
                                        <span className="text-right">View</span>
                                    </div>
                                    <ul className="divide-y divide-slate-100">
                                        {items.map((row) => {
                                            const actor = row.actor?.name || 'Someone';
                                            return (
                                                <li
                                                    key={row._id}
                                                    className="grid grid-cols-1 md:grid-cols-[1.5fr_0.85fr_0.85fr_0.7fr_0.7fr_0.5fr] gap-2 md:gap-3 px-4 py-3.5 hover:bg-slate-50/80 items-start md:items-center"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-slate-900">
                                                            <span className="font-semibold">{actor}</span>
                                                            {' '}
                                                            <span className="text-slate-700">{row.summary}</span>
                                                        </p>
                                                        <span
                                                            className={`inline-flex mt-1.5 md:mt-1 px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${actionBadgeClass(row.action)}`}
                                                        >
                                                            {row.action || 'other'}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-600">
                                                        <span className="md:hidden text-xs text-slate-400 mr-1">Module:</span>
                                                        {row.module || '—'}
                                                        {row.entityType ? (
                                                            <span className="text-slate-400"> · {row.entityType}</span>
                                                        ) : null}
                                                    </div>
                                                    <div className="text-sm text-slate-600 font-mono tabular-nums">
                                                        <span className="md:hidden text-xs text-slate-400 mr-1 font-sans">IP:</span>
                                                        {row.ip || '—'}
                                                    </div>
                                                    <div className="text-sm text-slate-600">
                                                        <span className="md:hidden text-xs text-slate-400 mr-1">Date:</span>
                                                        {formatDate(row.createdAt)}
                                                    </div>
                                                    <div className="text-sm text-slate-600 tabular-nums">
                                                        <span className="md:hidden text-xs text-slate-400 mr-1">Time:</span>
                                                        {formatTime(row.createdAt)}
                                                    </div>
                                                    <div className="md:text-right">
                                                        {row.viewHref ? (
                                                            <Link
                                                                href={row.viewHref}
                                                                className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
                                                            >
                                                                View
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </Link>
                                                        ) : (
                                                            <span className="text-sm text-slate-300">—</span>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
                                    <p>
                                        {total} activit{total === 1 ? 'y' : 'ies'}
                                        {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}
                                    </p>
                                    {totalPages > 1 ? (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={page <= 1}
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Prev
                                            </button>
                                            <button
                                                type="button"
                                                disabled={page >= totalPages}
                                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
