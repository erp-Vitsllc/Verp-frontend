'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { isAdmin } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';
import { ArchiveRestore, ExternalLink, Loader2, Paperclip, RotateCcw, Trash2, X } from 'lucide-react';

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

function archiveStatusBadgeClass(status) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'restored') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (s === 'purged') return 'bg-slate-200 text-slate-700 border-slate-300';
    return 'bg-violet-50 text-violet-800 border-violet-200';
}

function DeletedRecordsPageContent() {
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
    const [attachmentsModal, setAttachmentsModal] = useState(null);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [purgeConfirmId, setPurgeConfirmId] = useState(null);

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

    const fetchArchiveAttachments = useCallback(async (archiveId) => {
        const res = await axiosInstance.get(`/AdminDeletionArchive/${archiveId}/attachments`);
        return res.data?.attachments || [];
    }, []);

    const openAttachmentInNewTab = (att) => {
        if (att?.unavailable || !att?.url) {
            toast({
                title: 'File not available',
                description:
                    att?.unavailableReason ||
                    'This file is missing from storage and cannot be opened.',
                variant: 'destructive',
            });
            return;
        }
        window.open(att.url, '_blank', 'noopener,noreferrer');
    };

    const handleAttachmentsClick = async (item) => {
        const count = item.attachmentCount ?? 0;
        if (!count) return;
        setAttachmentsLoading(true);
        try {
            const attachments = await fetchArchiveAttachments(item._id);
            if (!attachments.length) {
                toast({
                    title: 'No attachments',
                    description: 'Could not load files for this record.',
                    variant: 'destructive',
                });
                return;
            }
            if (attachments.length === 1) {
                openAttachmentInNewTab(attachments[0]);
                return;
            }
            setAttachmentsModal({
                archiveId: item._id,
                title: item.title || item.moduleName || 'Attachments',
                attachments,
            });
        } catch (e) {
            toast({
                title: 'Attachments unavailable',
                description: e.response?.data?.message || e.message,
                variant: 'destructive',
            });
        } finally {
            setAttachmentsLoading(false);
        }
    };

    const handlePurge = (id) => {
        setPurgeConfirmId(id);
    };

    const executePurge = async () => {
        if (!purgeConfirmId) return;
        setActionLoading(true);
        try {
            await axiosInstance.delete(`/AdminDeletionArchive/${purgeConfirmId}`);
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
            setPurgeConfirmId(null);
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
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <span
                                                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${archiveStatusBadgeClass(item.status)}`}
                                                            >
                                                                {item.statusLabel || item.status || 'Pending recovery'}
                                                            </span>
                                                            {item.companyProfileStatus ? (
                                                                <span
                                                                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                                                                    title="Company profile status when deleted"
                                                                >
                                                                    Profile: {item.companyProfileStatus}
                                                                </span>
                                                            ) : null}
                                                            <span
                                                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${retentionBadgeClass(item.daysRemaining)}`}
                                                                title={`Maximum ${retentionDays} days in recovery`}
                                                            >
                                                                {item.daysRemaining != null
                                                                    ? `${item.daysRemaining} day${item.daysRemaining === 1 ? '' : 's'} left`
                                                                    : `Max ${retentionDays} days`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        {(item.attachmentCount ?? 0) > 0 ? (
                                                            <button
                                                                type="button"
                                                                disabled={attachmentsLoading}
                                                                onClick={() => handleAttachmentsClick(item)}
                                                                title={
                                                                    item.attachmentCount === 1
                                                                        ? 'Open attachment'
                                                                        : `View ${item.attachmentCount} attachments`
                                                                }
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-sky-200 text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 disabled:opacity-50"
                                                            >
                                                                <Paperclip className="h-3.5 w-3.5" />
                                                                {item.attachmentCount === 1
                                                                    ? 'Attachment'
                                                                    : `Attachments (${item.attachmentCount})`}
                                                            </button>
                                                        ) : null}
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

            {attachmentsModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[70vh] overflow-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <h2 className="font-semibold text-slate-900">{attachmentsModal.title}</h2>
                            <button
                                type="button"
                                onClick={() => setAttachmentsModal(null)}
                                className="p-1 rounded hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <ul className="divide-y divide-slate-100 p-2">
                            {attachmentsModal.attachments.map((att, idx) => (
                                <li key={`${att.name}-${idx}`}>
                                    <button
                                        type="button"
                                        onClick={() => openAttachmentInNewTab(att)}
                                        disabled={att.unavailable}
                                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm rounded-lg ${
                                            att.unavailable
                                                ? 'opacity-60 cursor-not-allowed bg-slate-50'
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-slate-800">
                                                {att.label || att.name || `Attachment ${idx + 1}`}
                                            </span>
                                            {att.unavailable ? (
                                                <span className="block text-xs text-amber-700 mt-0.5">
                                                    {att.unavailableReason || 'Not available'}
                                                </span>
                                            ) : null}
                                        </span>
                                        {!att.unavailable ? (
                                            <ExternalLink className="h-4 w-4 shrink-0 text-sky-600" />
                                        ) : null}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

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
                                    <span className="text-slate-500">Recovery status:</span>{' '}
                                    {selectedItem.statusLabel || selectedItem.status || 'Pending recovery'}
                                </p>
                                {selectedItem.companyProfileStatus ? (
                                    <p>
                                        <span className="text-slate-500">Profile status at deletion:</span>{' '}
                                        {selectedItem.companyProfileStatus}
                                    </p>
                                ) : null}
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
                                {(selectedItem.attachmentCount ?? 0) > 0 ? (
                                    <button
                                        type="button"
                                        disabled={attachmentsLoading}
                                        onClick={() => handleAttachmentsClick(selectedItem)}
                                        className="inline-flex items-center gap-1.5 text-sm text-sky-700 hover:text-sky-800 disabled:opacity-50"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                        {selectedItem.attachmentCount === 1
                                            ? 'Open attachment'
                                            : `View ${selectedItem.attachmentCount} attachments`}
                                    </button>
                                ) : null}
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
            <ConfirmAlertDialog
                open={Boolean(purgeConfirmId)}
                onOpenChange={(open) => !open && !actionLoading && setPurgeConfirmId(null)}
                title="Permanently delete record?"
                description="This item will be removed from recovery permanently. This cannot be undone."
                confirmLabel="Delete permanently"
                destructive
                loading={actionLoading}
                onConfirm={executePurge}
            />
        </div>
    );
}

export default function DeletedRecordsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <DeletedRecordsPageContent />
        </Suspense>
    );
}
