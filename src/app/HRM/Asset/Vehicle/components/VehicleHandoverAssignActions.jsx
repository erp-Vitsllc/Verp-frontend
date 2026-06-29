'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    getEffectiveHandoverStage,
    isHandoverReportsCompleteForEntry,
} from '../utils/vehicleHandoverAssignActions';

const ACTION_BOX =
    'flex min-h-[44px] flex-1 items-center justify-between rounded-lg border px-4 py-2 transition-all';

export default function VehicleHandoverAssignActions({
    vehicle,
    historyEntry,
    onVehicleUpdated,
    onHistoryUpdated,
    canApprove = false,
    className = '',
    hideWhenInactive = false,
}) {
    const { toast } = useToast();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMode, setConfirmMode] = useState('accept');
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    const canAct = canApprove;
    const reportsComplete = useMemo(
        () => isHandoverReportsCompleteForEntry(historyEntry, vehicle),
        [historyEntry, vehicle],
    );
    const acceptBlockedReason = useMemo(() => {
        if (!canAct) return '';
        if ((!stage || stage === 'target') && !reportsComplete) {
            return 'Complete assessment (Next Step) and body condition (Go to Approval) before approving.';
        }
        return '';
    }, [canAct, stage, reportsComplete]);

    const openConfirm = (mode) => {
        setConfirmMode(mode);
        setRejectionReason('');
        setConfirmOpen(true);
    };

    const handleConfirm = async () => {
        if (!vehicle?._id) return;
        if (confirmMode === 'reject' && !rejectionReason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Reason required',
                description: 'Please enter a rejection reason.',
            });
            return;
        }
        if (confirmMode === 'accept' && acceptBlockedReason) {
            toast({
                variant: 'destructive',
                title: 'Cannot accept',
                description: acceptBlockedReason,
            });
            return;
        }

        setActionLoading(true);
        try {
            const res = await axiosInstance.put(`/AssetItem/${vehicle._id}/respond`, {
                action: confirmMode === 'accept' ? 'Accept' : 'Reject',
                comments: confirmMode === 'reject' ? rejectionReason.trim() : '',
            });
            const detailRes = await axiosInstance.get(`/AssetItem/detail/${vehicle._id}`);
            onVehicleUpdated?.(detailRes.data || res.data?.asset || res.data);

            const historyId = historyEntry?._id;
            if (historyId && !String(historyId).startsWith('live-')) {
                try {
                    const historyRes = await axiosInstance.get(
                        `/AssetItem/history-record/${historyId}`,
                        { skipToast: true },
                    );
                    onHistoryUpdated?.(historyRes.data);
                } catch {
                    /* non-fatal */
                }
            }

            setConfirmOpen(false);
            toast({
                title: confirmMode === 'accept' ? 'Approved' : 'Rejected',
                description:
                    confirmMode === 'accept'
                        ? 'Handover response recorded successfully.'
                        : 'Handover was rejected.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: error.response?.data?.message || 'Could not update handover status.',
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (!vehicle || !historyEntry) return null;

    if (hideWhenInactive && !canAct && !acceptBlockedReason) {
        return null;
    }

    const showActions = canAct || acceptBlockedReason;

    return (
        <>
            {showActions ? (
                <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${className}`}>
                    {canAct ? (
                        <>
                            <button
                                type="button"
                                onClick={() => openConfirm('accept')}
                                disabled={actionLoading || !!acceptBlockedReason}
                                title={acceptBlockedReason || undefined}
                                className={`${ACTION_BOX} border-green-100 bg-green-50 text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wide">Approve</span>
                                <Check size={16} className="shrink-0" />
                            </button>
                            <button
                                type="button"
                                onClick={() => openConfirm('reject')}
                                disabled={actionLoading}
                                className={`${ACTION_BOX} border-red-100 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50`}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wide">Reject</span>
                                <X size={16} className="shrink-0" />
                            </button>
                        </>
                    ) : (
                        <>
                            <div className={`${ACTION_BOX} border-transparent bg-transparent`} aria-hidden="true" />
                            <div className={`${ACTION_BOX} border-transparent bg-transparent`} aria-hidden="true" />
                        </>
                    )}

                    {acceptBlockedReason ? (
                        <div className="col-span-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                            {acceptBlockedReason}
                        </div>
                    ) : null}
                </div>
            ) : !hideWhenInactive ? (
                <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${className}`}>
                    <div className={`${ACTION_BOX} border-transparent bg-transparent min-h-[44px]`} aria-hidden="true" />
                    <div className={`${ACTION_BOX} border-transparent bg-transparent min-h-[44px]`} aria-hidden="true" />
                </div>
            ) : null}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmMode === 'accept' ? 'Approve handover' : 'Reject handover'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmMode === 'accept'
                                ? 'Are you sure you want to approve this handover stage?'
                                : 'Please provide a reason for rejecting this handover.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {confirmMode === 'reject' ? (
                        <textarea
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            className="min-h-[96px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            placeholder="Rejection reason"
                        />
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                            {confirmMode === 'accept' ? 'Approve' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
