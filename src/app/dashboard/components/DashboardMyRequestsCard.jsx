'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, EmptyState, SectionHeader } from './ui';

export const MY_REQUESTS_CHANGED = 'dashboard-my-requests-changed';
export const OPEN_MY_REQUESTS = 'dashboard-open-my-requests';

const PAGE_SIZE = 5;

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPendingStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return false;
    if (s.includes('reject') || s.includes('cancel') || s === 'draft') return false;
    return s.includes('pending');
}

function RequestRow({ item, onOpen }) {
    const reason = item.reason || item.label || '—';
    return (
        <tr
            onClick={() => item.href && onOpen(item.href)}
            className="cursor-pointer border-b border-[#F1F5F9] last:border-0 hover:bg-sky-50 transition-colors duration-200"
        >
            <td className="px-2 py-2 text-[12px] font-semibold whitespace-nowrap text-[#2563EB]">
                {item.taskNo || '—'}
            </td>
            <td className="px-2 py-2 text-[12px] text-[#64748B] whitespace-nowrap">
                {formatDate(item.date) || '—'}
            </td>
            <td className="px-2 py-2 text-[12px] text-[#334155]">
                <p className="truncate" title={reason}>{reason}</p>
            </td>
        </tr>
    );
}

function openMyRequestsLog() {
    try {
        window.dispatchEvent(new Event(OPEN_MY_REQUESTS));
    } catch {
        /* ignore */
    }
}

export default function DashboardMyRequestsCard() {
    const router = useRouter();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const loadRequests = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/Employee/dashboard/my-requests', { skipToast: true });
            const rows = Array.isArray(res.data?.requests) ? res.data.requests : [];
            const next = rows
                .filter((item) => isPendingStatus(item.status))
                .sort(
                    (a, b) =>
                        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
                );
            setRequests(next);
            setPage(0);
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);
    useEffect(() => {
        const refresh = () => loadRequests();
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, refresh);
        window.addEventListener(MY_REQUESTS_CHANGED, refresh);
        return () => {
            window.removeEventListener(ATTENDANCE_CHECK_CHANGED, refresh);
            window.removeEventListener(MY_REQUESTS_CHANGED, refresh);
        };
    }, [loadRequests]);

    const pageCount = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const visible = useMemo(
        () => requests.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
        [requests, safePage],
    );
    const isEmpty = !loading && requests.length === 0;

    return (
        <DashboardCard
            variants={dashboardItem}
            className={cn('px-4 py-3.5', isEmpty ? 'min-h-[108px]' : '')}
        >
            <SectionHeader
                icon={ClipboardList}
                iconWrap="bg-indigo-50 text-indigo-600"
                title="My Requests"
                subtitle={`Pending Requests · ${requests.length}`}
                action={
                    <button
                        type="button"
                        onClick={openMyRequestsLog}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#8792A6] hover:text-indigo-600 transition-colors duration-200"
                    >
                        View All
                        <ArrowRight size={14} />
                    </button>
                }
            />
            <div className="mt-2">
                {loading ? (
                    <p className="text-[12px] text-[#8792A6] py-3 text-center">Loading requests…</p>
                ) : isEmpty ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="No pending requests"
                        description="You're all caught up."
                        className="py-1 gap-0.5"
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[28rem] table-fixed">
                                <thead>
                                    <tr className="border-b border-[#E7EBF1] text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                                        <th className="w-[7.5rem] px-2 py-2 font-bold">Task no</th>
                                        <th className="w-[7.5rem] px-2 py-2 font-bold">Date</th>
                                        <th className="px-2 py-2 font-bold">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((item) => (
                                        <RequestRow
                                            key={`${item.source}-${item.id}`}
                                            item={item}
                                            onOpen={(href) => router.push(href)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {requests.length > PAGE_SIZE ? (
                            <div className="mt-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] text-[#8792A6]">
                                    {safePage * PAGE_SIZE + 1}–{Math.min(requests.length, (safePage + 1) * PAGE_SIZE)} of {requests.length}
                                </p>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setPage((value) => Math.max(0, value - 1))}
                                        disabled={safePage === 0}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7EBF1] text-[#64748B] disabled:opacity-40"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    {Array.from({ length: pageCount }, (_, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setPage(index)}
                                            className={`h-7 min-w-7 rounded-lg px-1.5 text-[11px] font-semibold ${
                                                index === safePage
                                                    ? 'bg-slate-900 text-white'
                                                    : 'border border-[#E7EBF1] text-[#64748B]'
                                            }`}
                                        >
                                            {index + 1}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                                        disabled={safePage >= pageCount - 1}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7EBF1] text-[#64748B] disabled:opacity-40"
                                        aria-label="Next page"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </DashboardCard>
    );
}
