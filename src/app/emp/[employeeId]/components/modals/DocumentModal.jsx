'use client';

import { Upload, FileText, X } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

function FieldRow({ label, children, error }) {
    return (
        <div className="flex items-start gap-6">
            <label className="w-1/3 pt-3 text-sm font-bold uppercase tracking-tight text-gray-500">
                {label}
            </label>
            <div className="w-2/3">
                {children}
                {error && (
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-tight text-red-500">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}

function YesNoToggle({ value, onChange, disabled }) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onChange(true)}
                disabled={disabled}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-600'
                } disabled:opacity-50`}
            >
                Yes
            </button>
            <button
                type="button"
                onClick={() => onChange(false)}
                disabled={disabled}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    !value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-600'
                } disabled:opacity-50`}
            >
                No
            </button>
        </div>
    );
}

const inputClass = (hasError) =>
    `w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
        hasError ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'
    }`;

const datePickerClass = (hasError) =>
    `w-full h-[46px] rounded-xl border bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
        hasError ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-200'
    }`;

export default function DocumentModal({
    isOpen,
    onClose,
    documentForm,
    setDocumentForm,
    documentErrors,
    setDocumentErrors,
    savingDocument,
    documentFileRef,
    editingDocumentIndex,
    onDocumentFileChange,
    onSaveDocument,
    modalMode = 'with_expiry',
}) {
    if (!isOpen) return null;

    const isLabour = modalMode === 'labour';
    const hasExpiry = documentForm.hasExpiry !== false;
    const hasValue = !!documentForm.hasValue;
    const attachmentName =
        documentForm.file?.name ||
        documentForm.fileName ||
        (editingDocumentIndex !== null && documentForm.fileBase64 ? 'Current file attached' : '');

    const handleClose = () => {
        if (!savingDocument) {
            onClose();
            setDocumentErrors({});
        }
    };

    const clearAttachment = () => {
        if (documentFileRef?.current) {
            documentFileRef.current.value = '';
        }
        setDocumentForm((prev) => ({
            ...prev,
            file: null,
            fileBase64: '',
            fileName: '',
            fileMime: '',
        }));
        setDocumentErrors((prev) => {
            const next = { ...prev };
            delete next.file;
            return next;
        });
    };

    const modalTitle = (() => {
        if (documentForm.isRenewMode) return 'Renew Document';
        if (editingDocumentIndex !== null) return 'Edit Document';
        if (isLabour) return 'Labour Card Salary';
        return 'Add Document';
    })();

    const submitLabel = (() => {
        if (savingDocument) return 'Saving...';
        if (documentForm.isRenewMode) return 'Renew';
        if (editingDocumentIndex !== null) return 'Update';
        return 'Save';
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative flex max-h-[85vh] w-full max-w-[750px] flex-col rounded-[22px] bg-white p-6 shadow-[0_5px_20px_rgba(0,0,0,0.1)] md:p-8">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <h3 className="text-[22px] font-semibold text-gray-800">{modalTitle}</h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={savingDocument}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="modal-scroll flex-1 space-y-6 overflow-y-auto px-1 py-6 md:px-2">
                    {!isLabour && (
                        <>
                            <FieldRow
                                label={
                                    <>
                                        Document Type <span className="text-red-500">*</span>
                                    </>
                                }
                                error={documentErrors.type}
                            >
                                <input
                                    type="text"
                                    value={documentForm.type || ''}
                                    onChange={(e) =>
                                        setDocumentForm((prev) => ({ ...prev, type: e.target.value }))
                                    }
                                    className={inputClass(!!documentErrors.type)}
                                    placeholder="e.g. VAT Certificate, Rental Agreement..."
                                    disabled={savingDocument}
                                />
                            </FieldRow>

                            <FieldRow
                                label={
                                    <>
                                        Has Expiry Date? <span className="text-red-500">*</span>
                                    </>
                                }
                            >
                                <YesNoToggle
                                    value={hasExpiry}
                                    disabled={savingDocument}
                                    onChange={(next) =>
                                        setDocumentForm((prev) => ({
                                            ...prev,
                                            hasExpiry: next,
                                            expiryDate: next ? prev.expiryDate : '',
                                        }))
                                    }
                                />
                            </FieldRow>

                            <FieldRow
                                label={
                                    <>
                                        Add Value? <span className="text-red-500">*</span>
                                    </>
                                }
                            >
                                <YesNoToggle
                                    value={hasValue}
                                    disabled={savingDocument}
                                    onChange={(next) =>
                                        setDocumentForm((prev) => ({
                                            ...prev,
                                            hasValue: next,
                                            value: next ? prev.value : '',
                                        }))
                                    }
                                />
                            </FieldRow>

                            {hasValue && (
                                <FieldRow
                                    label={
                                        <>
                                            Value (AED) <span className="text-red-500">*</span>
                                        </>
                                    }
                                    error={documentErrors.value}
                                >
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={documentForm.value || ''}
                                        onChange={(e) =>
                                            setDocumentForm((prev) => ({ ...prev, value: e.target.value }))
                                        }
                                        className={inputClass(!!documentErrors.value)}
                                        placeholder="Enter amount in AED"
                                        disabled={savingDocument}
                                    />
                                </FieldRow>
                            )}

                            <FieldRow
                                label={
                                    <>
                                        Note{' '}
                                        <span className="text-xs font-normal normal-case text-gray-400">
                                            (Optional)
                                        </span>
                                    </>
                                }
                                error={documentErrors.description}
                            >
                                <textarea
                                    value={documentForm.description || ''}
                                    onChange={(e) =>
                                        setDocumentForm((prev) => ({
                                            ...prev,
                                            description: e.target.value,
                                        }))
                                    }
                                    className={`${inputClass(!!documentErrors.description)} min-h-[100px] resize-y`}
                                    placeholder="Add any notes here..."
                                    disabled={savingDocument}
                                    maxLength={500}
                                />
                            </FieldRow>

                            <FieldRow
                                label={
                                    <>
                                        Issue Date{' '}
                                        <span className="text-xs font-normal normal-case text-gray-400">
                                            (Optional)
                                        </span>
                                    </>
                                }
                                error={documentErrors.issueDate}
                            >
                                <DatePicker
                                    value={documentForm.issueDate || ''}
                                    onChange={(date) =>
                                        setDocumentForm((prev) => ({ ...prev, issueDate: date }))
                                    }
                                    placeholder="dd/mm/yyyy"
                                    disabledDays={{ after: new Date() }}
                                    className={datePickerClass(!!documentErrors.issueDate)}
                                    disabled={savingDocument}
                                />
                            </FieldRow>

                            {hasExpiry && (
                                <FieldRow
                                    label={
                                        <>
                                            Expiry Date <span className="text-red-500">*</span>
                                        </>
                                    }
                                    error={documentErrors.expiryDate}
                                >
                                    <DatePicker
                                        value={documentForm.expiryDate || ''}
                                        onChange={(date) =>
                                            setDocumentForm((prev) => ({ ...prev, expiryDate: date }))
                                        }
                                        placeholder="dd/mm/yyyy"
                                        disabledDays={
                                            documentForm.issueDate
                                                ? { before: documentForm.issueDate }
                                                : undefined
                                        }
                                        className={datePickerClass(!!documentErrors.expiryDate)}
                                        disabled={savingDocument}
                                    />
                                </FieldRow>
                            )}
                        </>
                    )}

                    {isLabour && (
                        <div className="space-y-4 rounded-xl border border-gray-100 bg-white px-4 py-4">
                            <p className="text-sm font-semibold text-gray-700">
                                Basic + allowances must equal total salary
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {[
                                    ['basicSalary', 'Basic'],
                                    ['houseRentAllowance', 'House Rent Allowance'],
                                    ['vehicleAllowance', 'Vehicle Allowance'],
                                    ['fuelAllowance', 'Fuel Allowance'],
                                    ['otherAllowance', 'Other Allowance'],
                                    ['totalSalary', 'Total Salary'],
                                ].map(([key, label]) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-[13px] font-bold uppercase tracking-tight text-gray-500">
                                            {label} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={documentForm[key] || ''}
                                            onChange={(e) =>
                                                setDocumentForm((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.value,
                                                }))
                                            }
                                            className={inputClass(!!documentErrors[key])}
                                            disabled={savingDocument}
                                        />
                                        {documentErrors[key] && (
                                            <p className="text-[11px] font-bold uppercase tracking-tight text-red-500">
                                                {documentErrors[key]}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <FieldRow
                        label={
                            <>
                                Attachment{' '}
                                {editingDocumentIndex === null && (
                                    <span className="text-red-500">*</span>
                                )}
                            </>
                        }
                        error={documentErrors.file}
                    >
                        {attachmentName ? (
                            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <FileText size={16} className="shrink-0 text-blue-500" />
                                    <span className="truncate text-sm font-semibold text-blue-700">
                                        {attachmentName}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearAttachment}
                                    disabled={savingDocument}
                                    className="rounded-lg p-1 text-blue-500 transition-all hover:bg-blue-100"
                                    title="Remove attachment"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => documentFileRef.current?.click()}
                                disabled={savingDocument}
                                className={`group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all hover:border-blue-300 hover:bg-blue-50/20 ${
                                    documentErrors.file
                                        ? 'border-red-300 bg-red-50/10'
                                        : 'border-gray-200'
                                }`}
                            >
                                <Upload className="text-gray-300 transition-all group-hover:text-blue-500" />
                                <span className="text-sm font-semibold text-gray-400 transition-all group-hover:text-blue-600">
                                    Upload PDF (max 10MB)
                                </span>
                                <input
                                    ref={documentFileRef}
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={onDocumentFileChange}
                                    className="hidden"
                                    disabled={savingDocument}
                                />
                            </button>
                        )}
                    </FieldRow>
                </div>

                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-2 py-4 md:px-6">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-sm font-semibold text-red-500 hover:text-red-600"
                        disabled={savingDocument}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSaveDocument}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        disabled={savingDocument}
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
