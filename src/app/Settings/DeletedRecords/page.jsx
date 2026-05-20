'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { isAdmin } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import { ArchiveRestore, Loader2, RotateCcw, Trash2, X } from 'lucide-react';

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return '—';
    }
}

function formatExpiryDate(value) {
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

function retentionBadgeClass(daysRemaining) {
    if (daysRemaining == null) return 'bg-slate-100 text-slate-600';
    if (daysRemaining <= 7) return 'bg-amber-100 text-amber-900 border-amber-200';
    return 'bg-sky-50 text-sky-800 border-sky-200';
}

export default function DeletedRecordsPage() {
    const searchParams = useSearchParams();
    const deepLinkId = searchParams.get('item');
    const { toast } = useToast();

    const [accessChecked, setAccessChecked] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modules, setModules] = useState([]);
    const [activeModule, setActiveModule] = useState('');
    const [activeCategory, setActiveCategory] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [retentionDays, setRetentionDays] = useState(60);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (isAdmin()) {
                    if (!cancelled) {
                        setAllowed(true);
                        setAccessChecked(true);
                    }
                    return;
                }
                const res = await axiosInstance.get('/AdminDeletionArchive/access');
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

    const loadTree = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/AdminDeletionArchive/tree');
            const list = res.data?.modules || [];
            setModules(list);
            if (res.data?.retentionDays) setRetentionDays(Number(res.data.retentionDays) || 60);
            if (list.length > 0) {
                setActiveModule((prev) => prev || list[0].key);
                const firstCat = list[0].categories?.[0]?.key;
                if (firstCat) setActiveCategory((prev) => prev || firstCat);
            }
        } catch (e) {
            toast({
                title: 'Failed to load deleted records',
                description: e.response?.data?.message || e.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!allowed) return;
        loadTree();
    }, [allowed, loadTree]);

    const activeModuleData = useMemo(
        () => modules.find((m) => m.key === activeModule),
        [modules, activeModule]
    );

    const activeCategoryData = useMemo(
        () => activeModuleData?.categories?.find((c) => c.key === activeCategory),
        [activeModuleData, activeCategory]
    );

    const items = activeCategoryData?.items || [];

    const openItemDetail = useCallback(async (id) => {
        setDetailLoading(true);
        try {
            const res = await axiosInstance.get(`/AdminDeletionArchive/${id}`);
            setSelectedItem(res.data?.item || null);
        } catch (e) {
            toast({
                title: 'Could not load record',
                description: e.response?.data?.message || e.message,
                variant: 'destructive',
            });
        } finally {
            setDetailLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!deepLinkId || !allowed || loading) return;
        openItemDetail(deepLinkId);
    }, [deepLinkId, allowed, loading, openItemDetail]);

    const handleRestore = async (id) => {
        setActionLoading(true);
        try {
            await axiosInstance.post(`/AdminDeletionArchive/${id}/restore`);
            toast({ title: 'Restored', description: 'Record was restored successfully.' });
            setSelectedItem(null);
            await loadTree();
        } catch (e) {
            toast({
                title: 'Restore failed',
                description: e.response?.data?.message || e.message,
                variant: 'destructive',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePurge = async (id) => {
        if (!window.confirm('Permanently remove this item from recovery? This cannot be undone.')) return;
        setActionLoading(true);
        try {
            await axiosInstance.delete(`/AdminDeletionArchive/${id}`);
            toast({ title: 'Removed', description: 'Record permanently removed from recovery.' });
            setSelectedItem(null);
            await loadTree();
        } catch (e) {
            toast({
                title: 'Delete failed',
                description: e.response?.data?.message || e.message,
                variant: 'destructive',
            });
        } finally {
            setActionLoading(false);
        }
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
                        <p className="text-slate-600">You do not have access to deleted records recovery.</p>
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
                                <ArchiveRestore className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-slate-900">Deleted Records</h1>
                                <p className="text-sm text-slate-500">
                                    Review admin deletions by module. Restore or permanently remove each item.
                                    Items are kept for <strong>{retentionDays} days</strong>, then removed automatically.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                            </div>
                        ) : modules.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                                No deleted records pending recovery.
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
                                    {modules.map((mod) => (
                                        <button
                                            key={mod.key}
                                            type="button"
                                            onClick={() => {
                                                setActiveModule(mod.key);
                                                const first = mod.categories?.[0]?.key;
                                                if (first) setActiveCategory(first);
                                            }}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                activeModule === mod.key
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {mod.label}
                                            <span className="ml-1.5 opacity-80">({mod.count})</span>
                                        </button>
                                    ))}
                                </div>

                                {activeModuleData?.categories?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {activeModuleData.categories.map((cat) => (
                                            <button
                                                key={cat.key}
                                                type="button"
                                                onClick={() => setActiveCategory(cat.key)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                                                    activeCategory === cat.key
                                                        ? 'bg-slate-800 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {cat.label} ({cat.count})
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    {items.length === 0 ? (
                                        <p className="p-8 text-center text-slate-500 text-sm">
                                            No items in this category.
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100">
                                            {items.map((item) => (
                                                <li
                                                    key={item._id}
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900 truncate">
                                                            {item.title || item.moduleName}
                                                        </p>
                                                        <p className="text-sm text-slate-500 truncate">
                                                            {item.subtitle || item.recordId}
                                                            {item.details ? ` · ${item.details}` : ''}
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Deleted {formatDate(item.deletedAt)}
                                                            {item.expiresAt
                                                                ? ` · Auto-remove ${formatExpiryDate(item.expiresAt)}`
                                                                : ''}
                                                        </p>
                                                        <span
                                                            className={`inline-flex mt-2 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${retentionBadgeClass(item.daysRemaining)}`}
                                                            title={`Maximum ${retentionDays} days in recovery`}
                                                        >
                                                            {item.daysRemaining != null
                                                                ? `${item.daysRemaining} day${item.daysRemaining === 1 ? '' : 's'} left`
                                                                : `Max ${retentionDays} days`}
                                                        </span>
                                                    </div>
                                                    <div className="flex shrink-0 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openItemDetail(item._id)}
                                                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-100"
                                                        >
                                                            View
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoading}
                                                            onClick={() => handleRestore(item._id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                            Restore
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoading}
                                                            onClick={() => handlePurge(item._id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Permanent delete
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>

            {(selectedItem || detailLoading) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <h2 className="font-semibold text-slate-900">Deleted record</h2>
                            <button
                                type="button"
                                onClick={() => setSelectedItem(null)}
                                className="p-1 rounded hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {detailLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                            </div>
                        ) : selectedItem ? (
                            <div className="p-5 space-y-3 text-sm">
                                <p>
                                    <span className="text-slate-500">Module:</span>{' '}
                                    {selectedItem.moduleName || selectedItem.title}
                                </p>
                                <p>
                                    <span className="text-slate-500">Record:</span> {selectedItem.recordId}
                                </p>
                                <p>
                                    <span className="text-slate-500">Details:</span> {selectedItem.details || '—'}
                                </p>
                                <p>
                                    <span className="text-slate-500">Deleted:</span>{' '}
                                    {formatDate(selectedItem.deletedAt)}
                                </p>
                                <p>
                                    <span className="text-slate-500">Auto-remove:</span>{' '}
                                    {formatExpiryDate(selectedItem.expiresAt)}
                                    {selectedItem.daysRemaining != null ? (
                                        <span className="ml-2 text-amber-700 font-medium">
                                            ({selectedItem.daysRemaining} day
                                            {selectedItem.daysRemaining === 1 ? '' : 's'} left)
                                        </span>
                                    ) : null}
                                </p>
                                <p>
                                    <span className="text-slate-500">By:</span>{' '}
                                    {selectedItem.deletedBy?.name || selectedItem.deletedBy?.employeeId || '—'}
                                </p>
                                <div className="flex gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleRestore(selectedItem._id)}
                                        className="flex-1 inline-flex justify-center items-center gap-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        Restore
                                    </button>
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handlePurge(selectedItem._id)}
                                        className="flex-1 inline-flex justify-center items-center gap-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Permanent delete
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
