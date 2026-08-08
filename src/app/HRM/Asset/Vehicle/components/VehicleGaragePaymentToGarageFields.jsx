'use client';

import { useRef } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import {
    ERP_PDF_ACCEPT,
    validateErpPdfFile,
} from '@/utils/uploadFileTypes';
import { SegmentedToggle } from './VehicleServicePaymentTypeMethodFields';
import { normalizePaymentToGarage } from '../utils/vehicleGaragePaymentToGarageFields';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });
}

const YES_NO_OPTIONS = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
];

/**
 * Payment to Garage (Yes/No) + Amount + multi attachments, and optional Description
 * for Schedule and Reschedule Service cards.
 */
export default function VehicleGaragePaymentToGarageFields({
    formData,
    setField,
    setFormData,
    fieldsDisabled = false,
    FieldCell,
    accent,
    fieldMinHeightPx = 88,
    fieldClassName = '',
    moneyInputClassName = '',
    showDescription = true,
}) {
    const { toast } = useToast();
    const fileRef = useRef(null);
    const paymentYes = normalizePaymentToGarage(formData.paymentToGarage) === 'yes';
    const existing = Array.isArray(formData.paymentToGarageAttachments)
        ? formData.paymentToGarageAttachments
        : [];
    const fresh = Array.isArray(formData.paymentToGarageNewAttachments)
        ? formData.paymentToGarageNewAttachments
        : [];

    const updateForm = (patch) => {
        if (typeof setFormData === 'function') {
            setFormData((prev) => ({ ...prev, ...patch }));
            return;
        }
        Object.entries(patch).forEach(([key, value]) => setField(key, value));
    };

    const handlePaymentToggle = (next) => {
        const value = normalizePaymentToGarage(next);
        if (value === 'no') {
            updateForm({
                paymentToGarage: 'no',
                paymentToGarageAmount: '',
                paymentToGarageNewAttachments: [],
            });
            return;
        }
        updateForm({ paymentToGarage: 'yes' });
    };

    const handleAddFiles = async (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const accepted = [];
        for (const file of files) {
            const check = validateErpPdfFile(file);
            if (!check.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file',
                    description: check.message,
                });
                continue;
            }
            try {
                const dataUrl = await readFileAsDataUrl(file);
                const base64 = String(dataUrl).includes(',')
                    ? String(dataUrl).split(',')[1]
                    : String(dataUrl);
                accepted.push({
                    name: file.name,
                    data: base64,
                    mimeType: file.type || 'application/pdf',
                });
            } catch {
                toast({
                    variant: 'destructive',
                    title: 'Upload failed',
                    description: `Could not read ${file.name}.`,
                });
            }
        }
        if (accepted.length) {
            updateForm({
                paymentToGarageNewAttachments: [...fresh, ...accepted],
            });
        }
        if (fileRef.current) fileRef.current.value = '';
    };

    const removeExisting = (index) => {
        updateForm({
            paymentToGarageAttachments: existing.filter((_, i) => i !== index),
        });
    };

    const removeFresh = (index) => {
        updateForm({
            paymentToGarageNewAttachments: fresh.filter((_, i) => i !== index),
        });
    };

    const moneyClass =
        moneyInputClassName ||
        `w-full min-h-[40px] rounded-lg border border-gray-200 px-2.5 text-sm font-semibold ${fieldClassName}`.trim();

    return (
        <>
            <FieldCell
                label="Payment to Garage"
                accentClass={accent?.(0)}
                minHeightPx={fieldMinHeightPx}
            >
                <SegmentedToggle
                    options={YES_NO_OPTIONS}
                    value={normalizePaymentToGarage(formData.paymentToGarage)}
                    onChange={handlePaymentToggle}
                    disabled={fieldsDisabled}
                    selectedFallback="no"
                />
            </FieldCell>

            {paymentYes ? (
                <>
                    <FieldCell
                        label="Amount (AED)"
                        accentClass={accent?.(1)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={moneyClass}
                            placeholder="0.00"
                            value={formData.paymentToGarageAmount || ''}
                            disabled={fieldsDisabled}
                            onChange={(e) => setField('paymentToGarageAmount', e.target.value)}
                        />
                    </FieldCell>

                    <FieldCell
                        label="Attachment (PDF)"
                        accentClass={accent?.(2)}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                {!fieldsDisabled ? (
                                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">
                                        <Upload size={14} />
                                        Add
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            className="sr-only"
                                            multiple
                                            accept={ERP_PDF_ACCEPT}
                                            disabled={fieldsDisabled}
                                            onChange={(e) => void handleAddFiles(e.target.files)}
                                        />
                                    </label>
                                ) : null}
                                {!fieldsDisabled ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                        disabled={fieldsDisabled}
                                        onClick={() => fileRef.current?.click()}
                                        title="Add another attachment"
                                    >
                                        <Plus size={14} />
                                    </button>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {existing.map((row, index) => (
                                    <div
                                        key={`pay-garage-existing-${index}-${row.url || row.name}`}
                                        className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1"
                                    >
                                        {row.url ? (
                                            <button
                                                type="button"
                                                className="truncate text-xs font-semibold text-sky-700 hover:underline"
                                                onClick={() =>
                                                    void openAttachmentInNewTab(row.url, {
                                                        name: row.name || 'Attachment',
                                                    })
                                                }
                                            >
                                                {row.name || 'View attachment'}
                                            </button>
                                        ) : (
                                            <span className="truncate text-xs text-gray-600">
                                                {row.name || 'Attachment'}
                                            </span>
                                        )}
                                        {!fieldsDisabled ? (
                                            <button
                                                type="button"
                                                className="ml-auto text-red-500 hover:text-red-700"
                                                onClick={() => removeExisting(index)}
                                                title="Remove"
                                            >
                                                <X size={14} />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                                {fresh.map((row, index) => (
                                    <div
                                        key={`pay-garage-new-${index}-${row.name}`}
                                        className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 px-2 py-1"
                                    >
                                        <span className="truncate text-xs font-semibold text-gray-700">
                                            {row.name}
                                        </span>
                                        {!fieldsDisabled ? (
                                            <button
                                                type="button"
                                                className="ml-auto text-red-500 hover:text-red-700"
                                                onClick={() => removeFresh(index)}
                                                title="Remove"
                                            >
                                                <X size={14} />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                                {!existing.length && !fresh.length ? (
                                    <span className="text-[11px] text-gray-400">
                                        No attachments yet — click Add
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </FieldCell>
                </>
            ) : null}

            {showDescription ? (
                <div className="col-span-full mt-1">
                    <FieldCell
                        label="Description (optional)"
                        accentClass={accent?.(0) || 'border-gray-200 bg-white'}
                        minHeightPx={fieldMinHeightPx}
                    >
                        <textarea
                            className={`w-full min-h-[72px] resize-y rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-medium outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 ${fieldClassName}`.trim()}
                            rows={3}
                            value={formData.scheduleDescription || ''}
                            disabled={fieldsDisabled}
                            placeholder="Optional schedule notes"
                            onChange={(e) => setField('scheduleDescription', e.target.value)}
                        />
                    </FieldCell>
                </div>
            ) : null}
        </>
    );
}
