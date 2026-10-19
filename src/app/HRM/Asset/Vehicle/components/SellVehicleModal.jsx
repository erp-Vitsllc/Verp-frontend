'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function SellVehicleModal({ isOpen, assetId, onClose, onSold }) {
    const { toast } = useToast();
    const [description, setDescription] = useState('');
    const [checks, setChecks] = useState([]);
    const [canSell, setCanSell] = useState(false);
    const [loadingChecks, setLoadingChecks] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !assetId) return undefined;
        let cancelled = false;
        setDescription('');
        setChecks([]);
        setCanSell(false);
        setLoadingChecks(true);
        axiosInstance
            .get(`/AssetItem/${assetId}/sold-readiness`, { skipToast: true, timeout: 15000 })
            .then(({ data }) => {
                if (cancelled) return;
                setChecks(Array.isArray(data?.checks) ? data.checks : []);
                setCanSell(data?.canSell === true);
            })
            .catch((error) => {
                if (cancelled) return;
                setChecks([]);
                setCanSell(false);
                toast({
                    variant: 'destructive',
                    title: 'Could not check this vehicle',
                    description: error?.response?.data?.message || 'Sold checks failed to load.',
                });
            })
            .finally(() => {
                if (!cancelled) setLoadingChecks(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, assetId, toast]);

    if (!isOpen) return null;

    const descriptionReady = description.trim().length >= 3;
    const soldEnabled = canSell && descriptionReady && !loadingChecks && !saving;

    const confirmSold = async () => {
        if (!soldEnabled) return;
        try {
            setSaving(true);
            const { data } = await axiosInstance.post(`/AssetItem/${assetId}/sell`, {
                description: description.trim(),
            });
            toast({ title: 'Vehicle sold', description: data?.message || 'Status changed to sold.' });
            onSold?.();
            onClose?.();
        } catch (error) {
            const failed = error?.response?.data?.checks;
            if (Array.isArray(failed)) setChecks(failed);
            setCanSell(false);
            toast({
                variant: 'destructive',
                title: 'Cannot sell',
                description: error?.response?.data?.message || 'This vehicle did not pass the sold checks.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h3 className="text-base font-semibold text-gray-900">Sell vehicle</h3>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X size={18} />
                    </button>
                </div>
                <div className="space-y-4 px-5 py-4">
                    <p className="text-sm text-gray-600">
                        Selling sets the vehicle status to sold. A sold vehicle cannot be assigned, serviced, fuelled,
                        or edited, and its document expiry will not appear.
                    </p>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Why this vehicle is being sold"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm"
                        />
                    </div>
                    <ul className="space-y-2">
                        {loadingChecks ? (
                            <li className="text-sm text-gray-500">Checking vehicle…</li>
                        ) : (
                            checks.map((row) => (
                                <li key={row.key} className="flex items-start gap-2 text-sm">
                                    <span
                                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                            row.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                        }`}
                                    >
                                        {row.passed ? <Check size={14} /> : <X size={14} />}
                                    </span>
                                    <span>
                                        <span className="font-medium text-gray-800">{row.label}</span>
                                        {row.detail ? <span className="block text-xs text-gray-500">{row.detail}</span> : null}
                                    </span>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!soldEnabled}
                        onClick={confirmSold}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                        {saving ? 'Selling…' : 'Sold'}
                    </button>
                </div>
            </div>
        </div>
    );
}
