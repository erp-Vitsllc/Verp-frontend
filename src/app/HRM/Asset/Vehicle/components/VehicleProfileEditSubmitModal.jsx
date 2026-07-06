'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
    RowTable,
    VEHICLE_ACTIVATION_SECTION_LABELS,
} from './VehicleActivationSubmitModal';
import { sendVehicleProfileEditForApproval } from '../lib/vehicleProfileEditOps';

const actionLabel = (action) => {
    const a = String(action || 'edit').toLowerCase();
    if (a === 'renew') return 'Renew';
    if (a === 'not_renew') return 'Not renew';
    return 'Edit';
};

export default function VehicleProfileEditSubmitModal({
    isOpen,
    onClose,
    asset,
    assetMongoId,
    onSuccess,
    readOnly = false,
}) {
    const { toast } = useToast();
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!isOpen) setSending(false);
    }, [isOpen]);

    if (!isOpen || !asset) return null;

    const pending = Array.isArray(asset.vehiclePendingProfileEdits) ? asset.vehiclePendingProfileEdits : [];

    const submit = async () => {
        setSending(true);
        try {
            await sendVehicleProfileEditForApproval(assetMongoId);
            toast({
                title: 'Submitted for HR review',
                description: 'HR has been emailed and will see this request in their vehicle tasks.',
            });
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Submit failed',
                description: err.response?.data?.message || 'Could not submit for HR approval.',
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">
                        {readOnly ? 'Pending profile changes' : 'Submit for HR approval'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {readOnly
                            ? 'Review the submitted changes before approving or rejecting.'
                            : 'Compare current card data with your proposed changes. Live data stays unchanged until HR approves.'}
                    </p>
                </div>
                <div className="p-6 space-y-5">
                    {pending.length === 0 ? (
                        <p className="text-sm text-gray-600">No queued profile edits.</p>
                    ) : (
                        pending.map((entry) => {
                            const sectionId = entry?.sectionId || '';
                            const title =
                                VEHICLE_ACTIVATION_SECTION_LABELS[sectionId] ||
                                sectionId ||
                                'Section';
                            const previousRows = Array.isArray(entry.previousRows) ? entry.previousRows : [];
                            const proposedRows = Array.isArray(entry.proposedRows) ? entry.proposedRows : [];

                            return (
                                <div
                                    key={`${sectionId}-${entry.createdAt || ''}`}
                                    className="rounded-xl border border-slate-200 overflow-hidden"
                                >
                                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-slate-800">{title}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                            {actionLabel(entry.action)}
                                        </span>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                                                Current (live)
                                            </div>
                                            <RowTable rows={previousRows.length ? previousRows : [{ label: '—', value: '—' }]} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                                Proposed
                                            </div>
                                            <RowTable rows={proposedRows.length ? proposedRows : [{ label: '—', value: '—' }]} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (!sending) onClose();
                        }}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!readOnly && pending.length > 0 ? (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={sending}
                            className="px-5 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-60"
                        >
                            {sending ? 'Sending…' : 'Send to HR'}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
