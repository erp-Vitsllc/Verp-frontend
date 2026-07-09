'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    resolveAssessmentMediaUrl,
    resolveCurrentLiveAccessoryRow,
} from '../utils/vehicleHandoverReceiverAssessment';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function AddVehicleAccessoryModal({
    isOpen,
    onClose,
    onSubmit,
    saving = false,
    displaySets = [],
}) {
    const fileInputRef = useRef(null);
    const [accessoryKey, setAccessoryKey] = useState(RECEIVER_ASSESSMENT_ITEMS[0]?.key || '');
    const [photo, setPhoto] = useState(null);
    const [amount, setAmount] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setAccessoryKey(RECEIVER_ASSESSMENT_ITEMS[0]?.key || '');
        setPhoto(null);
        setAmount('');
        setUploading(false);
    }, [isOpen]);

    const selectedItem = useMemo(
        () => RECEIVER_ASSESSMENT_ITEMS.find((item) => item.key === accessoryKey) || null,
        [accessoryKey],
    );

    const currentLiveRow = useMemo(
        () => (accessoryKey ? resolveCurrentLiveAccessoryRow(displaySets, accessoryKey) : null),
        [accessoryKey, displaySets],
    );

    const currentLivePhotoUrl = resolveAssessmentMediaUrl(
        currentLiveRow?.photo || currentLiveRow?.photoUrl || null,
    );

    const isReplacing = Boolean(currentLiveRow);

    if (!isOpen) return null;

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) return;

        setUploading(true);
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setPhoto(dataUrl);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = () => {
        if (!accessoryKey || !photo) return;
        onSubmit?.({
            accessoryKey,
            photo,
            amount: amount.trim(),
            isReplacing,
        });
    };

    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Add accessory</h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                            Choose type and upload image for Live Accessories
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Type
                        </label>
                        <select
                            value={accessoryKey}
                            onChange={(event) => setAccessoryKey(event.target.value)}
                            disabled={saving || uploading}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            {RECEIVER_ASSESSMENT_ITEMS.map((item) => (
                                <option key={item.key} value={item.key}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isReplacing ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                            A live <strong>{selectedItem?.label}</strong> already exists. The current
                            one will move to <strong>Lost Accessories</strong> and this new image will
                            become live.
                        </div>
                    ) : null}

                    {currentLivePhotoUrl ? (
                        <div>
                            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                Current live image
                            </p>
                            <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                <img
                                    src={currentLivePhotoUrl}
                                    alt={`Current ${selectedItem?.label || 'accessory'}`}
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                        </div>
                    ) : null}

                    <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Image <span className="text-red-500">*</span>
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={saving || uploading}
                            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50"
                        >
                            {uploading ? (
                                <Loader2 size={22} className="animate-spin" />
                            ) : photo ? (
                                <img
                                    src={photo}
                                    alt="New accessory"
                                    className="max-h-24 max-w-full object-contain"
                                />
                            ) : (
                                <>
                                    <ImageIcon size={24} />
                                    <span className="text-xs font-semibold">Upload image</span>
                                </>
                            )}
                        </button>
                        {photo ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={saving || uploading}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                                <Upload size={12} />
                                Change image
                            </button>
                        ) : null}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Amount (optional)
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">AED</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                disabled={saving || uploading}
                                placeholder="0"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || uploading || !photo || !accessoryKey}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
