'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
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
    getHandoverReportsIncompleteMessage,
    isHandoverHistoryFullyApproved,
    isHandoverReportsCompleteForEntry,
    mergeHandoverHistoryAfterHrApproval,
} from '../utils/vehicleHandoverAssignActions';
import {
    areAllHandoverFineItemsDecided,
    listHandoverApprovalFineDecisionItems,
    listIncludedHandoverFineItems,
} from '../utils/vehicleHandoverItemFineUtils';

const ACTION_BOX =
    'flex min-h-[44px] flex-1 items-center justify-between rounded-lg border px-4 py-2 transition-all';

const HANDOVER_RESPONSE_CONFIG = { skipActionDedupe: true };

export default function VehicleHandoverAssignActions({
    vehicle,
    historyEntry,
    assetHistory = [],
    handoverItemFines = {},
    handoverItemFineWaivers = {},
    handoverItemFineInclusions = {},
    onVehicleUpdated,
    onHistoryUpdated,
    onResponded,
    canApprove = false,
    isHrStage = false,
    onApproveWithIncludedFines,
    onScrollToAssessment,
    className = '',
    hideWhenInactive = false,
}) {
    const { toast } = useToast();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMode, setConfirmMode] = useState('accept');
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const submitInFlightRef = useRef(false);

    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    const canAct = canApprove;
    const reportsComplete = useMemo(
        () => isHandoverReportsCompleteForEntry(historyEntry, vehicle),
        [historyEntry, vehicle],
    );

    const fineDecisionArgs = useMemo(
        () => ({
            vehicle,
            historyEntry,
            assetHistory,
            handoverItemFineIndex: handoverItemFines,
            handoverItemFineWaiverIndex: handoverItemFineWaivers,
            handoverItemFineInclusionIndex: handoverItemFineInclusions,
        }),
        [
            assetHistory,
            handoverItemFineInclusions,
            handoverItemFineWaivers,
            handoverItemFines,
            historyEntry,
            vehicle,
        ],
    );

    const fineDecisionItems = useMemo(
        () => (isHrStage ? listHandoverApprovalFineDecisionItems(fineDecisionArgs) : []),
        [fineDecisionArgs, isHrStage],
    );
    const allFineItemsDecided = useMemo(
        () => !isHrStage || areAllHandoverFineItemsDecided(fineDecisionArgs),
        [fineDecisionArgs, isHrStage],
    );
    const includedFineItems = useMemo(
        () => (isHrStage ? listIncludedHandoverFineItems(fineDecisionArgs) : []),
        [fineDecisionArgs, isHrStage],
    );

    const acceptBlockedReason = useMemo(() => {
        if (!canAct) return '';
        if ((!stage || stage === 'target') && !reportsComplete) {
            return getHandoverReportsIncompleteMessage(historyEntry, vehicle);
        }
        if (isHrStage && fineDecisionItems.length > 0 && !allFineItemsDecided) {
            return 'Mark every changed body/accessory card as Add to Fine or Remove from Fine before approving.';
        }
        return '';
    }, [
        allFineItemsDecided,
        canAct,
        fineDecisionItems.length,
        historyEntry,
        isHrStage,
        reportsComplete,
        stage,
        vehicle,
    ]);

    const submitResponse = async ({ action, comments = '', handoverFineId = null, handoverFineIds = null }) => {
        if (!vehicle?._id || submitInFlightRef.current) return;
        submitInFlightRef.current = true;
        setActionLoading(true);
        try {
            const payload = { action, comments };
            if (handoverFineId) payload.handoverFineId = handoverFineId;
            if (Array.isArray(handoverFineIds) && handoverFineIds.length > 0) {
                payload.handoverFineIds = handoverFineIds;
                if (!payload.handoverFineId) payload.handoverFineId = handoverFineIds[0];
            }
            const res = await axiosInstance.put(
                `/AssetItem/${vehicle._id}/respond`,
                payload,
                HANDOVER_RESPONSE_CONFIG,
            );
            const detailRes = await axiosInstance.get(`/AssetItem/detail/${vehicle._id}`);
            const nextVehicle = detailRes.data || res.data?.asset || res.data;
            onVehicleUpdated?.(nextVehicle);

            const historyId = historyEntry?._id;
            const wasHrApproval =
                isHrStage ||
                String(getEffectiveHandoverStage(vehicle, historyEntry) || '').toLowerCase() === 'hr';

            if (historyId && !String(historyId).startsWith('live-')) {
                if (action === 'Accept' && wasHrApproval) {
                    onHistoryUpdated?.(mergeHandoverHistoryAfterHrApproval(historyEntry));
                }
                try {
                    if (onResponded) {
                        await onResponded();
                    } else {
                        const historyRes = await axiosInstance.get(
                            `/AssetItem/history-record/${historyId}`,
                            { skipToast: true },
                        );
                        onHistoryUpdated?.(historyRes.data);
                    }
                } catch {
                    /* non-fatal */
                }
            } else if (onResponded) {
                await onResponded();
            }

            toast({
                title: action === 'Reject' ? 'Rejected' : 'Approved',
                description:
                    action === 'Reject'
                        ? 'Handover was rejected.'
                        : handoverFineId || (handoverFineIds && handoverFineIds.length)
                          ? 'Handover approved. Draft fine rows were created for the selected sections.'
                          : 'Handover approved successfully.',
            });
            invalidateAssetPendingInbox('vehicle');
        } catch (error) {
            if (error?.silent || error?.code === 'ACTION_DEDUPED') return;
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: error.response?.data?.message || 'Could not update handover status.',
            });
            throw error;
        } finally {
            submitInFlightRef.current = false;
            setActionLoading(false);
        }
    };

    const openConfirm = (mode) => {
        setConfirmMode(mode);
        setRejectionReason('');
        setConfirmOpen(true);
    };

    const handleConfirm = async (event) => {
        event?.preventDefault?.();
        if (actionLoading || submitInFlightRef.current) return;
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
                title: 'Cannot approve',
                description: acceptBlockedReason,
            });
            return;
        }

        try {
            if (confirmMode === 'accept' && includedFineItems.length > 0 && onApproveWithIncludedFines) {
                setConfirmOpen(false);
                setActionLoading(true);
                try {
                    await onApproveWithIncludedFines(includedFineItems);
                } finally {
                    setActionLoading(false);
                }
                return;
            }

            await submitResponse({
                action: confirmMode === 'accept' ? 'Accept' : 'Reject',
                comments: confirmMode === 'reject' ? rejectionReason.trim() : '',
            });
            setConfirmOpen(false);
        } catch {
            /* toast shown */
        }
    };

    if (!vehicle || !historyEntry) return null;

    if (isHandoverHistoryFullyApproved(historyEntry)) {
        return hideWhenInactive ? null : (
            <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${className}`}>
                <div className={`${ACTION_BOX} border-transparent bg-transparent min-h-[44px]`} aria-hidden="true" />
                <div className={`${ACTION_BOX} border-transparent bg-transparent min-h-[44px]`} aria-hidden="true" />
            </div>
        );
    }

    if (hideWhenInactive && !canAct && !acceptBlockedReason) {
        return null;
    }

    const showActions = canAct || acceptBlockedReason;
    const includedLabels = includedFineItems.map((row) => row.itemLabel).filter(Boolean);

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
                                {actionLoading ? (
                                    <Loader2 size={16} className="shrink-0 animate-spin" />
                                ) : (
                                    <Check size={16} className="shrink-0" />
                                )}
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
                            <p>{acceptBlockedReason}</p>
                            {onScrollToAssessment ? (
                                <button
                                    type="button"
                                    onClick={onScrollToAssessment}
                                    className="mt-2 text-[11px] font-bold text-amber-900 underline"
                                >
                                    Go to assessment sections
                                </button>
                            ) : null}
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
                            {confirmMode === 'accept'
                                ? includedFineItems.length > 0
                                    ? 'Approve with fine sections?'
                                    : 'Approve handover'
                                : 'Reject handover'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                {confirmMode === 'accept' ? (
                                    includedFineItems.length > 0 ? (
                                        <>
                                            <p>
                                                These sections are marked for fine. Are you sure you want to add them
                                                and approve this handover?
                                            </p>
                                            <ul className="list-disc pl-5 text-slate-700">
                                                {includedLabels.map((label) => (
                                                    <li key={label}>{label}</li>
                                                ))}
                                            </ul>
                                            <p>Draft fine rows will be created so amounts can be edited afterward.</p>
                                        </>
                                    ) : (
                                        <p>
                                            Are you sure you want to approve this handover? The status will be set to
                                            approved.
                                        </p>
                                    )
                                ) : (
                                    <p>Please provide a reason for rejecting this handover.</p>
                                )}
                            </div>
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
                        <AlertDialogAction disabled={actionLoading} onClick={handleConfirm}>
                            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                            {confirmMode === 'accept' ? 'OK' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
