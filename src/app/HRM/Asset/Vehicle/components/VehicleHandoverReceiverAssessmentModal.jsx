'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Upload, X } from 'lucide-react';
import {
    RECEIVER_ASSESSMENT_ITEMS,
    buildAssessmentFormState,
    buildAssessmentPayload,
    isAssessmentFormComplete,
    resolveAssessmentMediaUrl,
    validateAssessmentForm,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function YesNoToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(true)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                    value === true
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Yes
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(false)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                    value === false
                        ? 'bg-slate-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                No
            </button>
        </div>
    );
}

export default function VehicleHandoverReceiverAssessmentModal({
    open,
    onClose,
    historyEntry,
    vehicle,
    onSave,
    saving = false,
}) {
    const [form, setForm] = useState(() => buildAssessmentFormState(historyEntry, vehicle));
    const [errors, setErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (open) {
            setForm(buildAssessmentFormState(historyEntry, vehicle));
            setErrors({});
            setSubmitAttempted(false);
        }
    }, [open, historyEntry, vehicle]);

    useEffect(() => {
        if (!open) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    if (!mounted || !open) return null;

    const formComplete = isAssessmentFormComplete(form);

    const setPresent = (key, present) => {
        setForm((prev) => {
            const photo = present === true ? prev[key]?.photo ?? null : null;
            const next = {
                ...prev,
                [key]: { present, photo },
            };

            setErrors((errs) => {
                const updated = { ...errs };
                delete updated[key];
                if (present === true && !resolveAssessmentMediaUrl(photo)) {
                    updated[key] = 'Photo required (mandatory) when Yes is selected';
                }
                return updated;
            });

            return next;
        });
    };

    const handlePhotoChange = async (key, file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrors((prev) => ({ ...prev, [key]: 'Upload an image file' }));
            return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        setForm((prev) => ({
            ...prev,
            [key]: { ...prev[key], present: true, photo: dataUrl },
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSubmit = () => {
        setSubmitAttempted(true);
        const nextErrors = validateAssessmentForm(form);
        if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            return;
        }
        onSave(buildAssessmentPayload(form));
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Add accessories"
        >
            <div
                className="mx-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Add Accessories</h3>
                        <p className="mt-1 text-xs text-gray-500">
                            Yes or No is required for each item. Photo is required only when Yes is selected.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {submitAttempted && !formComplete ? (
                        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            Complete all fields: select Yes or No for each item. Upload a photo for every Yes answer.
                        </p>
                    ) : null}

                    <div className="space-y-4">
                        {RECEIVER_ASSESSMENT_ITEMS.map((item) => {
                            const row = form[item.key] || { present: null, photo: null };
                            const photoUrl = resolveAssessmentMediaUrl(row.photo);
                            const error = errors[item.key];
                            const showError = Boolean(error) || (submitAttempted && row.present !== true && row.present !== false);
                            const missingSelection = row.present !== true && row.present !== false;

                            return (
                                <div
                                    key={item.key}
                                    className={`rounded-xl border p-4 ${
                                        showError
                                            ? 'border-red-200 bg-red-50/40'
                                            : 'border-gray-100 bg-slate-50/60'
                                    }`}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm font-semibold text-gray-800">
                                            {item.label}
                                            <span className="ml-1 text-red-500">*</span>
                                        </p>
                                        <YesNoToggle
                                            value={row.present}
                                            onChange={(value) => setPresent(item.key, value)}
                                            disabled={saving}
                                        />
                                    </div>

                                    {missingSelection && submitAttempted ? (
                                        <p className="mt-2 text-xs font-medium text-red-600">
                                            Select Yes or No (required)
                                        </p>
                                    ) : null}

                                    {row.present === true ? (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-[11px] font-medium text-amber-700">
                                                Photo required (mandatory)
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <label
                                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold transition-colors hover:bg-gray-50 ${
                                                        submitAttempted && !photoUrl
                                                            ? 'border-red-300 text-red-700'
                                                            : 'border-gray-200 text-gray-700'
                                                    }`}
                                                >
                                                    <Upload size={14} />
                                                    Upload photo
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        required={row.present === true}
                                                        className="hidden"
                                                        disabled={saving}
                                                        onChange={(e) => {
                                                            handlePhotoChange(item.key, e.target.files?.[0]);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                                {photoUrl ? (
                                                    <VehicleHandoverAssessmentPhotoPanel
                                                        url={photoUrl}
                                                        label={item.label}
                                                    />
                                                ) : (
                                                    <VehicleHandoverAssessmentPhotoPanel
                                                        url={null}
                                                        label={item.label}
                                                        missing={submitAttempted}
                                                    />
                                                )}
                                            </div>
                                            {submitAttempted && !photoUrl ? (
                                                <p className="text-xs font-medium text-red-600">
                                                    Photo required (mandatory) when Yes is selected
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {error && !missingSelection && !(row.present === true && !photoUrl && submitAttempted) ? (
                                        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !formComplete}
                        title={
                            !formComplete
                                ? 'Complete all Yes/No selections and upload photos for Yes items'
                                : undefined
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
