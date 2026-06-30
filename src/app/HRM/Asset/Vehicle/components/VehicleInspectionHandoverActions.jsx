'use client';

import { useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { invalidateAssetPendingInbox } from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { useToast } from '@/hooks/use-toast';
import { isHandoverReportsCompleteForEntry } from '../utils/vehicleHandoverAssignActions';

export default function VehicleInspectionHandoverActions({
    vehicle,
    historyEntry,
    onVehicleUpdated,
    onHistoryUpdated,
    canReview = false,
    canSubmitForHr = false,
    className = '',
}) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);

    const status = String(vehicle?.vehicleInspectionStatus || '').toLowerCase();
    const pending = status === 'pending_hr';
    const draft = status === 'draft';
    const historyId = historyEntry?._id;
    const reportsComplete = isHandoverReportsCompleteForEntry(historyEntry, vehicle);

    if (!vehicle?._id) return null;

    const process = async (approved) => {
        setBusy(true);
        try {
            const endpoint = approved
                ? `/AssetItem/${vehicle._id}/approve-vehicle-inspection`
                : `/AssetItem/${vehicle._id}/reject-vehicle-inspection`;
            await axiosInstance.post(endpoint);
            const refreshed = await axiosInstance.get(`/AssetItem/detail/${vehicle._id}`);
            if (typeof onVehicleUpdated === 'function') {
                onVehicleUpdated(refreshed.data);
            }
            toast({
                title: approved ? 'Approved' : 'Rejected',
                description: approved
                    ? 'Vehicle inspection has been approved and recorded.'
                    : 'The inspection request was rejected.',
            });
            invalidateAssetPendingInbox('vehicle');
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to process inspection request.',
            });
        } finally {
            setBusy(false);
        }
    };

    const handleSendToHr = async () => {
        if (!historyId || String(historyId).startsWith('live-')) return;

        setBusy(true);
        try {
            const res = await axiosInstance.post(
                `/AssetItem/history-record/${historyId}/submit-inspection-for-hr`,
            );
            if (res.data?.vehicleAsset && typeof onVehicleUpdated === 'function') {
                onVehicleUpdated(res.data.vehicleAsset);
            }
            if (typeof onHistoryUpdated === 'function') {
                onHistoryUpdated(res.data);
            }
            toast({
                title: 'Sent to HR',
                description: 'Inspection reports were submitted for HR approval.',
            });
            invalidateAssetPendingInbox('vehicle');
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Could not send to HR',
                description: err.response?.data?.message || 'Please try again.',
            });
        } finally {
            setBusy(false);
        }
    };

    if (canReview && pending) {
        return (
            <div className={`col-span-2 flex flex-wrap gap-2 ${className}`}>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => process(true)}
                    className="flex-1 min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                    Approve inspection
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => process(false)}
                    className="flex-1 min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                    Reject
                </button>
            </div>
        );
    }

    if (canSubmitForHr && draft && reportsComplete) {
        return (
            <div className={`col-span-2 ${className}`}>
                <button
                    type="button"
                    disabled={busy}
                    onClick={handleSendToHr}
                    className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50"
                >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
                    Send to HR
                </button>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">
                    Assessment and body condition are complete. Submit this inspection for HR approval.
                </p>
            </div>
        );
    }

    if (pending) {
        return (
            <div
                className={`col-span-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 ${className}`}
            >
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                    Submitted for HR approval
                </p>
                <p className="mt-1 text-[11px] leading-snug text-emerald-700">
                    Assessment and body condition reports are complete. HR will approve or reject this
                    inspection.
                </p>
            </div>
        );
    }

    return null;
}
