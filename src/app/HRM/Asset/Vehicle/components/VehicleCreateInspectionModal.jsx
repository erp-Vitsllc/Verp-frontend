'use client';

import { useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function VehicleCreateInspectionModal({ isOpen, onClose, assetMongoId, onSuccess }) {
    const { toast } = useToast();
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    const submit = async () => {
        setSending(true);
        try {
            await axiosInstance.post(`/AssetItem/${assetMongoId}/submit-vehicle-inspection-request`);
            toast({
                title: 'Request submitted',
                description: 'HR has been emailed. The inspection record will be created after HR approves.',
            });
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Submit failed',
                description: err.response?.data?.message || 'Could not submit inspection request.',
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">Create Vehicle Inspection</h3>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Vehicle inspection form is <strong>on working</strong> (under development). Press OK to send an
                        approval request to HR. The inspection record is created only after HR approves.
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (!sending) onClose();
                        }}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={sending}
                        className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? 'Submitting…' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
}
