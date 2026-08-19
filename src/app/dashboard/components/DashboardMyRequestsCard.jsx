'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';
import axiosInstance from '@/utils/axios';
import { cn } from '@/lib/utils';
import { ATTENDANCE_CHECK_CHANGED } from './DashboardCheckInOutCard';
import { dashboardItem } from './dashboardMotion';

export const MY_REQUESTS_CHANGED = 'dashboard-my-requests-changed';

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                {item.detail ? <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.detail}</p> : null}
            </div>
            <div className="text-right shrink-0">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', statusClass(item.status))}>{item.status}</span>
                {item.date ? <p className="text-[10px] text-slate-400 mt-1">{formatDate(item.date)}</p> : null}
            </div>
        </>
    );
    const className = 'flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50/90 transition-colors';
    return item.href ? <Link href={item.href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

export default function DashboardMyRequestsCard() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const loadRequests = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/Employee/dashboard/my-requests', { skipToast: true });
            setRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
        } catch { setRequests([]); } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadRequests(); }, [loadRequests]);
    useEffect(() => {
        const refresh = () => loadRequests();
        window.addEventListener(ATTENDANCE_CHECK_CHANGED, refresh);
        window.addEventListener(MY_REQUESTS_CHANGED, refresh);
        return () => {
            window.removeEventListener(ATTENDANCE_CHECK_CHANGED, refresh);
            window.removeEventListener(MY_REQUESTS_CHANGED, refresh);
        };
    }, [loadRequests]);

    return (
        <motion.article variants={dashboardItem} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 pt-3 pb-4">
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><ClipboardList size={16} /></div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">My Requests</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Requests you sent · {requests.length}</p>
                </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 min-h-[120px] max-h-[220px] overflow-y-auto">
                {loading ? <p className="text-sm text-slate-400 px-3 py-8 text-center">Loading requests…</p>
                : requests.length === 0 ? <p className="text-sm text-slate-400 px-3 py-8 text-center">You haven&apos;t sent any requests yet</p>
                : <div className="py-1">{requests.map((item) => <RequestRow key={`${item.source}-${item.id}`} item={item} />)}</div>}
            </div>
        </motion.article>
    );
}
