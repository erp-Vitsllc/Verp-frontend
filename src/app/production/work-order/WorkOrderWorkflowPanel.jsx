'use client';

import { useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { formatWorkOrderDate } from './workOrderNumber';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/40';

export default function WorkOrderWorkflowPanel({ order, onSaved }) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const kick = order?.salesKickOff || {};
    const momApproved = Boolean(kick.momApproved) || order?.momStatus === 'approved';
    const pending = kick.status === 'pending';

    const complete = async () => {
        setBusy(true);
        try {
            const response = await axiosInstance.patch(
                `/WorkOrder/${order._id}`,
                { completeSalesKickOff: true },
                { skipToast: true },
            );
            if (response.data?.workOrder) onSaved?.(response.data.workOrder);
            toast({
                title: 'Sales kick off completed',
                description: response.data?.emailMessage || 'Sales kick off is complete.',
            });
        } catch (error) {
            toast({
                title: 'Could not complete sales kick off',
                description: error?.response?.data?.message || 'Try again.',
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-2xl border border-[#e6eef6] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.4)] sm:p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-slate-800">Workflow</h2>
            <ol className="space-y-3">
                <li className="rounded-xl border border-[#e6eef6] px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">Work order create</p>
                    <p className="mt-1 text-sm text-slate-600">By {order?.createdByName || '—'}</p>
                    <p className="text-sm text-slate-600">Date {formatWorkOrderDate(order?.createdOn)}</p>
                </li>
                <li className="rounded-xl border border-[#e6eef6] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Sales kick off</p>
                            {kick.status === 'completed' ? (
                                <p className="mt-1 text-sm text-emerald-700">
                                    Completed{kick.completedAt ? ` ${formatWorkOrderDate(kick.completedAt)}` : ''}
                                </p>
                            ) : kick.status === 'unassigned' ? (
                                <p className="mt-1 text-sm text-slate-500">Not assigned. No active Admin Officer is set on the flowchart.</p>
                            ) : (
                                <>
                                    <p className="mt-1 text-sm text-amber-800">Pending</p>
                                    <p className="text-sm text-slate-600">Pending with {kick.pendingWith || '—'}</p>
                                </>
                            )}
                        </div>
                        {pending ? (
                            <button
                                type="button"
                                disabled={busy || !momApproved}
                                title={momApproved ? 'Complete sales kick off' : 'Complete is available after the project manager approves the MOM'}
                                onClick={complete}
                                className={`inline-flex h-10 items-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245fe0] disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
                            >
                                {busy ? 'Saving…' : 'Complete'}
                            </button>
                        ) : null}
                    </div>
                    {pending && !momApproved ? (
                        <p className="mt-2 text-sm text-slate-500">
                            Complete is available after the MOM is submitted and the project manager approves it.
                        </p>
                    ) : null}
                </li>
            </ol>
        </section>
    );
}
