'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const fileToPayload = (file) =>
    new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            resolve({
                name: file.name,
                data: base64,
                mimeType: file.type || 'application/octet-stream',
            });
        };
        reader.readAsDataURL(file);
    });

export default function VehicleMortgageCloseModal({ isOpen, onClose, assetMongoId, onSuccess }) {
    const { toast } = useToast();
    const [clearanceFile, setClearanceFile] = useState(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setClearanceFile(null);
    }, [isOpen]);

    if (!isOpen) return null;

    const submit = async () => {
        setSending(true);
        try {
            const clearanceAttachment = await fileToPayload(clearanceFile);
            await axiosInstance.post(`/AssetItem/${assetMongoId}/submit-vehicle-mortgage-close`, {
                clearanceAttachment,
            });
            toast({
                title: 'Request submitted',
                description: 'HR has been emailed. The mortgage will close after HR approves.',
            });
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Submit failed',
                description: err.response?.data?.message || 'Could not submit mortgage close request.',
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !sending && onClose()} />
            <div className="relative bg-white rounded-[22px] shadow-2xl w-full max-w-md p-6 md:p-8">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Close Mortgage</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={sending}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-5">
                    Send a request to HR to close this mortgage. After approval, the mortgage will be archived to{' '}
                    <strong>Old Documents</strong> and removed from live records on this vehicle.
                </p>

                <div className="space-y-2">
                    <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">
                        Clearance letter <span className="text-slate-400 font-semibold normal-case">(optional)</span>
                    </label>
                    <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setClearanceFile(e.target.files?.[0] || null)}
                        className="w-full h-11 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none text-sm"
                    />
                    {clearanceFile?.name ? (
                        <p className="text-[11px] text-slate-500">{clearanceFile.name}</p>
                    ) : null}
                </div>

                <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={sending}
                        className="px-5 h-11 rounded-xl border border-slate-200 text-[13px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={sending}
                        className="px-6 h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-[13px] font-black uppercase tracking-widest"
                    >
                        {sending ? 'Sending…' : 'Send request'}
                    </button>
                </div>
            </div>
        </div>
    );
}
