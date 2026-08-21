'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardItem } from './dashboardMotion';
import { DashboardCard, EmptyState, SectionHeader, StatusBadge } from './ui';

export const MY_REQUESTS_CHANGED = 'dashboard-my-requests-changed';
export const OPEN_MY_REQUESTS = 'dashboard-open-my-requests';

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

function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('reject')) return 'bg-rose-50 text-rose-700';
    if (s.includes('cancel') || s.includes('draft')) return 'bg-slate-100 text-slate-600';
    if (s.includes('pending')) return 'bg-amber-50 text-amber-700';
    if (s.includes('approved')) return 'bg-emerald-50 text-emerald-700';
    return 'bg-blue-50 text-blue-700';
}

function RequestRow({ item }) {
    const body = (
        <>
            <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#111827] truncate">{item.label}</p>
                {item.detail ? (
                    <p className="text-[11px] text-[#8792A6] truncate mt-0.5">{item.detail}</p>
                ) : null}
            </div>
            <div className="text-right shrink-0">
                <StatusBadge className={statusClass(item.status)}>{item.status}</StatusBadge>
                {item.date ? (
                    <p className="text-[10px] text-[#8792A6] mt-1">{formatDate(item.date)}</p>
                ) : null}
            </div>
        </>
    );
    const className =
        'flex items-start justify-between gap-3 px-1 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-200';
    return item.href ? (
        <Link href={item.href} className={className}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
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
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const loadRequests = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/Employee/dashboard/my-requests', { skipToast: true });
            const rows = Array.isArray(res.data?.requests) ? res.data.requests : [];
            setRequests(rows.filter((item) => isPendingStatus(item.status)));
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
            <div className={cn('mt-2', isEmpty ? '' : 'max-h-[168px] overflow-y-auto')}>
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
                    <div className="divide-y divide-[#E7EBF1]">
                        {requests.map((item) => (
                            <RequestRow key={`${item.source}-${item.id}`} item={item} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardCard>
    );
}
