'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { isLeaveActive } from '@/utils/assetStatusHelpers';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';

/**
 * On Duty / Leave control for an assignee who has parked (on-leave) assets.
 * Checking On Duty sends the existing owner → Asset Controller request.
 * Asset Controller accepts here; assets return to this user from leave.
 */
export default function OnDutyFromLeaveControl({
    ownerId,
    triggerAssetId = null,
    seedOnLeave = false,
    heroShell = false,
    className = '',
    onChanged,
}) {
    const { toast } = useToast();
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    const resolvedOwnerId = useMemo(() => {
        if (!ownerId) return '';
        if (typeof ownerId === 'object') {
            return String(ownerId._id || ownerId.employeeId || '').trim();
        }
        return String(ownerId).trim();
    }, [ownerId]);

    const loadStatus = useCallback(async () => {
        if (!resolvedOwnerId) {
            setStatus(null);
            return;
        }
        try {
            const res = await axiosInstance.get(
                `/AssetItem/owner-on-duty/status/${encodeURIComponent(resolvedOwnerId)}`,
                { skipToast: true },
            );
            setStatus(res.data || null);
        } catch {
            setStatus(null);
        }
    }, [resolvedOwnerId]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const parkingAssets = status?.parkingAssets || [];
    const onLeave = status ? status.onLeave === true : seedOnLeave;
    const pendingAcRequestId = status?.pendingAcRequestId || null;
    const canRequest = status?.canRequest === true;
    const canApproveAsAc = status?.canApproveAsAc === true;
    const showControl = status
        ? onLeave || !!pendingAcRequestId
        : seedOnLeave;

    const scopedAssets = useMemo(() => {
        if (!triggerAssetId) return parkingAssets;
        const match = parkingAssets.filter((a) => String(a._id) === String(triggerAssetId));
        return match.length ? match : parkingAssets;
    }, [parkingAssets, triggerAssetId]);

    if (!resolvedOwnerId || !showControl) {
        return null;
    }

    const isOnDutySelected = !onLeave && !pendingAcRequestId;
    const leaveSelected = onLeave || !!pendingAcRequestId;

    const canApplyDirectAsAc = canApproveAsAc && onLeave;
    const canClickOnDuty = !busy && !isOnDutySelected && (canRequest || canApplyDirectAsAc);

    const applyDirectAsAc = async (ids) => {
        const res = await axiosInstance.post('/AssetItem/owner-on-duty/apply-direct', {
            triggerAssetId: triggerAssetId || ids[0] || undefined,
            assetIds: ids.length ? ids : undefined,
        });
        toast({
            title: 'On Duty',
            description: res.data?.message || 'Asset is now On Duty.',
        });
        await loadStatus();
        invalidateAssetPendingInbox();
        onChanged?.();
    };

    const requestOnDuty = async () => {
        if (busy || isOnDutySelected) return;
        const ids = scopedAssets.map((a) => a._id);
        if (!ids.length && !triggerAssetId) {
            toast({
                variant: 'destructive',
                title: 'No parked assets',
                description: 'There are no on-leave assets to return to this user.',
            });
            return;
        }

        if (canApplyDirectAsAc) {
            const ok = typeof window === 'undefined'
                ? true
                : window.confirm('Set this asset On Duty now? One email will go to the employee company mailbox, or their primary reportee if they have none.');
            if (!ok) return;
            setBusy(true);
            try {
                await applyDirectAsAc(ids);
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Update failed',
                    description: error?.response?.data?.message || error?.message || 'Could not set On Duty.',
                });
            } finally {
                setBusy(false);
            }
            return;
        }

        if (!canRequest || pendingAcRequestId) return;
        const count = ids.length || 1;
        const ok = typeof window === 'undefined'
            ? true
            : window.confirm(
                `Send On Duty request to the Asset Controller for ${count} parked asset(s)? They will return to this user after the controller accepts.`,
            );
        if (!ok) return;
        setBusy(true);
        try {
            const res = await axiosInstance.post('/AssetItem/owner-on-duty/request-from-owner', {
                triggerAssetId: triggerAssetId || ids[0] || undefined,
                assetIds: ids.length ? ids : undefined,
            });
            toast({
                title: res.data?.alreadyPending ? 'Already pending' : 'On Duty requested',
                description:
                    res.data?.message ||
                    'Request sent to the Asset Controller. Assets return to you after they accept.',
            });
            await loadStatus();
            onChanged?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Request failed',
                description: error?.response?.data?.message || error?.message || 'Could not send On Duty request.',
            });
        } finally {
            setBusy(false);
        }
    };

    const respondAsAc = async (approve) => {
        if (!canApproveAsAc || !pendingAcRequestId || busy) return;
        setBusy(true);
        try {
            const res = await axiosInstance.put('/AssetItem/owner-on-duty/respond-ac-request', {
                dashboardActionId: pendingAcRequestId,
                approve,
            });
            toast({
                title: approve ? 'On Duty approved' : 'On Duty rejected',
                description:
                    res.data?.message ||
                    (approve
                        ? 'Assets are On Duty and returned to this user from leave.'
                        : 'Request rejected. Assets remain on leave.'),
            });
            await loadStatus();
            invalidateAssetPendingInbox();
            onChanged?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Action failed',
                description: error?.response?.data?.message || error?.message || 'Could not complete On Duty review.',
            });
        } finally {
            setBusy(false);
        }
    };

    const shell = heroShell
        ? 'bg-white/[0.12] border border-white/25 p-1 rounded-lg flex items-center w-32'
        : 'bg-gray-100 p-1 rounded-lg flex items-center w-32';
    const onDutyClass = heroShell
        ? isOnDutySelected || pendingAcRequestId
            ? 'bg-white text-[#0095DD] shadow-sm'
            : 'text-white/90 hover:bg-white/[0.08]'
        : isOnDutySelected || pendingAcRequestId
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700';
    const leaveClass = heroShell
        ? leaveSelected && !pendingAcRequestId
            ? 'bg-white text-[#0095DD] shadow-sm'
            : 'text-white/90 hover:bg-white/[0.08]'
        : leaveSelected && !pendingAcRequestId
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700';

    return (
        <div className={`flex flex-col items-center gap-1.5 ${className}`}>
            <div className={shell} role="group" aria-label="On duty or leave">
                <button
                    type="button"
                    onClick={() => void requestOnDuty()}
                    disabled={!canClickOnDuty || (!!pendingAcRequestId && !canApplyDirectAsAc)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all text-center disabled:opacity-70 ${onDutyClass}`}
                    title={
                        canApplyDirectAsAc
                            ? 'Set this asset On Duty now'
                            : pendingAcRequestId
                                ? 'On Duty request is waiting for Asset Controller'
                                : canRequest
                                    ? 'Request Asset Controller to return parked assets to you'
                                    : 'Only this employee or the Asset Controller can set On Duty'
                    }
                >
                    {busy ? '…' : 'On Duty'}
                </button>
                <button
                    type="button"
                    disabled
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all text-center ${leaveClass}`}
                >
                    Leave
                </button>
            </div>
            {pendingAcRequestId ? (
                <p className={`text-[10px] font-bold uppercase tracking-wide text-center ${heroShell ? 'text-white/85' : 'text-sky-700'}`}>
                    Pending controller
                </p>
            ) : null}
            {canApproveAsAc && pendingAcRequestId ? (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void respondAsAc(true)}
                        className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-wider"
                    >
                        Accept
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void respondAsAc(false)}
                        className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-wider"
                    >
                        Reject
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export function ownerHasOnLeaveAssets(employeeOrAsset) {
    if (!employeeOrAsset) return false;
    if (isLeaveActive(employeeOrAsset)) return true;
    const assets = employeeOrAsset.assets || employeeOrAsset.salaryAssets || [];
    return assets.some((asset) => isLeaveActive(asset));
}
