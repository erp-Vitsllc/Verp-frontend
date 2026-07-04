'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import {
    BODY_CONDITION_VIEW_FIELDS,
    buildBodyConditionFormState,
    buildBodyConditionPayload,
    getBodyConditionRowChunks,
    isBodyConditionFormComplete,
    validateBodyConditionForm,
} from '../utils/vehicleHandoverBodyCondition';
import { HANDOVER_BODY_CONDITION_GRID_CLASS, HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS, resolveAssessmentMediaUrl } from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverLandscapePhotoBox from './VehicleHandoverLandscapePhotoBox';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function ViewFieldEditor({ fieldKey, label, row, error, saving, onCommentChange, onPhotoChange }) {
    const photoUrl = resolveAssessmentMediaUrl(row?.photo);

    return (
        <div
            className={`rounded-xl border p-3 ${
                error ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-white'
            }`}
        >
            <p className="truncate text-xs font-semibold text-gray-800">{label}</p>

            <label className="mt-2 block text-[9px] font-bold uppercase tracking-wide text-gray-400">
                Comment <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
                value={row?.comment || ''}
                onChange={(e) => onCommentChange(fieldKey, e.target.value)}
                disabled={saving}
                rows={1}
                placeholder="Add comment..."
                className="mt-1 min-h-[32px] w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
            />

            <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                Photo <span className="text-red-500">*</span>
            </p>
            <div className="mt-1">
                <VehicleHandoverLandscapePhotoBox
                    label={label}
                    photoUrl={photoUrl}
                    uploading={saving}
                    onUpload={(file) => onPhotoChange(fieldKey, file)}
                    inputIdPrefix={`modal-body-${fieldKey}`}
                    boxClassName={HANDOVER_BODY_CONDITION_PHOTO_BOX_CLASS}
                />
            </div>

            {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
        </div>
    );
}

export default function VehicleHandoverBodyConditionModal({
    open,
    onClose,
    historyEntry,
    onSave,
    saving = false,
}) {
    const [form, setForm] = useState(() => buildBodyConditionFormState(historyEntry));
    const [errors, setErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (open) {
            setForm(buildBodyConditionFormState(historyEntry));
            setErrors({});
            setSubmitAttempted(false);
        }
    }, [open, historyEntry]);

    useEffect(() => {
        if (!open) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    if (!mounted || !open) return null;

    const formComplete = isBodyConditionFormComplete(form);
    const fieldLabels = Object.fromEntries(
        BODY_CONDITION_VIEW_FIELDS.map((field) => [field.key, field.label]),
    );

    const handleCommentChange = (key, comment) => {
        setForm((prev) => ({
            ...prev,
            [key]: { ...prev[key], comment },
        }));
    };

    const handlePhotoChange = async (key, file) => {
        if (!file.type.startsWith('image/')) {
            setErrors((prev) => ({ ...prev, [key]: 'Upload an image file' }));
            return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        setForm((prev) => ({
            ...prev,
            [key]: { ...prev[key], photo: dataUrl },
        }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSubmit = () => {
        setSubmitAttempted(true);
        const nextErrors = validateBodyConditionForm(form);
        if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            return;
        }
        onSave(buildBodyConditionPayload(form));
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Body condition report"
        >
            <div
                className="mx-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Body Condition Report</h3>
                        <p className="mt-1 text-xs text-gray-500">
                            All views require a photo upload. Comments are optional.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {submitAttempted && !formComplete ? (
                        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            Upload a photo for every mandatory view before saving.
                        </p>
                    ) : null}

                    <div className="space-y-2">
                        {getBodyConditionRowChunks().map((rowKeys) => (
                            <div key={rowKeys.join('-')} className={HANDOVER_BODY_CONDITION_GRID_CLASS}>
                                {rowKeys.map((fieldKey) => (
                                    <ViewFieldEditor
                                        key={fieldKey}
                                        fieldKey={fieldKey}
                                        label={fieldLabels[fieldKey]}
                                        row={form[fieldKey]}
                                        error={errors[fieldKey]}
                                        saving={saving}
                                        onCommentChange={handleCommentChange}
                                        onPhotoChange={handlePhotoChange}
                                    />
                                ))}
                            </div>
                        ))}
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
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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
