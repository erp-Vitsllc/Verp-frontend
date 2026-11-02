'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { toast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import DropdownWithDelete from '@/components/ui/DropdownWithDelete';
import { ERP_PDF_ACCEPT } from '@/utils/uploadFileTypes';
import { validateEmployeeDocumentPdfFile } from '@/utils/employeeDocumentValidation';
import { getAllCountriesOptions } from '../utils/helpers';
import {
    hasCompleteOutsideUaeIdentityDocument,
    outsideUaeIdentityDocuments,
} from '@/utils/outsideUaeIdentityDocument';

const emptyForm = {
    type: '',
    issueDate: '',
    expiryDate: '',
    countryIssued: '',
    file: null,
    fileBase64: '',
    fileName: '',
    fileMime: '',
    existingUrl: '',
};

function dateInputValue(value) {
    const raw = String(value || '');
    return raw.length >= 10 ? raw.slice(0, 10) : '';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.readAsDataURL(file);
    });
}

export function OutsideUaeIdentityCards({ employee, formatDate, onEdit, onViewDocument }) {
    const rows = outsideUaeIdentityDocuments(employee);
    if (!rows.length) return null;

    return (
        <>
            {rows.map(({ doc, index }) => {
                const title = String(doc.type || doc.documentName || 'Document').trim();
                const fields = [
                    { label: 'Issue date', value: doc.issueDate ? formatDate(doc.issueDate) : '' },
                    { label: 'Expiry date', value: doc.expiryDate ? formatDate(doc.expiryDate) : '' },
                    { label: 'Country issued', value: doc.countryIssued || '' },
                    { label: 'Attachment', value: doc.document?.name || (doc.document?.url ? 'Attached' : '') },
                ];
                return (
                    <div key={`${title}-${index}`} className="break-inside-avoid mb-6">
                        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6">
                                <h3 className="text-base font-semibold text-gray-800 sm:text-xl">{title}</h3>
                                <div className="flex items-center gap-2">
                                    {doc.document && onViewDocument ? (
                                        <button
                                            type="button"
                                            onClick={() => onViewDocument(doc.document)}
                                            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                        >
                                            View
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => onEdit?.(doc, index)}
                                        className="text-blue-600 hover:text-blue-700"
                                        title="Edit"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {fields.map((field) => (
                                <div
                                    key={field.label}
                                    className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm last:border-b-0 sm:px-6"
                                >
                                    <span className="text-gray-500">{field.label}</span>
                                    <span className="text-gray-700">{field.value || '—'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </>
    );
}

export function OutsideUaeIdentityButton({ employee, onAdd }) {
    if (hasCompleteOutsideUaeIdentityDocument(employee)) return null;
    return (
        <div className="mt-6">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onAdd}
                    style={{ width: '132px' }}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-600"
                >
                    Document
                    <span className="text-sm font-bold leading-none">+</span>
                </button>
            </div>
        </div>
    );
}

export function OutsideUaeIdentityModal({
    isOpen,
    employeeId,
    editing,
    onClose,
    onSaved,
}) {
    const fileRef = useRef(null);
    const [types, setTypes] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const countries = useMemo(() => getAllCountriesOptions(), []);

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        axiosInstance
            .get('/OutsideUaeDocumentType', { skipToast: true })
            .then((response) => {
                if (cancelled) return;
                const rows = Array.isArray(response.data) ? response.data : [];
                setTypes(rows);
            })
            .catch(() => {
                if (!cancelled) setTypes([]);
            });
        const doc = editing?.doc;
        setForm(
            doc
                ? {
                      type: doc.type || doc.documentName || '',
                      issueDate: dateInputValue(doc.issueDate),
                      expiryDate: dateInputValue(doc.expiryDate),
                      countryIssued: doc.countryIssued || '',
                      file: null,
                      fileBase64: '',
                      fileName: doc.document?.name || '',
                      fileMime: doc.document?.mimeType || '',
                      existingUrl: doc.document?.url || '',
                  }
                : emptyForm,
        );
        setErrors({});
        return () => {
            cancelled = true;
        };
    }, [isOpen, editing]);

    if (!isOpen) return null;

    const typeOptions = types.map((row) => ({
        value: row.name,
        label: row.name,
    }));
    if (form.type && !typeOptions.some((option) => option.value === form.type)) {
        typeOptions.push({ value: form.type, label: form.type });
    }

    const addType = async (name) => {
        const trimmed = String(name || '').trim();
        if (trimmed.length < 2) return;
        try {
            const response = await axiosInstance.post('/OutsideUaeDocumentType', { name: trimmed }, { skipToast: true });
            const saved = response.data;
            setTypes((current) => {
                const nextName = saved?.name || trimmed;
                if (current.some((row) => String(row.name).toLowerCase() === nextName.toLowerCase())) return current;
                return [...current, saved?.name ? saved : { name: nextName }].sort((a, b) =>
                    String(a.name).localeCompare(String(b.name)),
                );
            });
            setForm((current) => ({ ...current, type: saved?.name || trimmed }));
            setErrors((current) => {
                const next = { ...current };
                delete next.type;
                return next;
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not add document type',
                description: error?.response?.data?.message || error.message || 'Try again.',
            });
        }
    };

    const onFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const check = validateEmployeeDocumentPdfFile(file, { requireFile: false });
        if (!check.isValid) {
            setErrors((current) => ({ ...current, file: check.error }));
            if (event.target) event.target.value = '';
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setForm((current) => ({
                ...current,
                file,
                fileBase64: dataUrl,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            }));
            setErrors((current) => {
                const next = { ...current };
                delete next.file;
                return next;
            });
        } catch (error) {
            setErrors((current) => ({ ...current, file: error.message }));
        }
    };

    const validate = () => {
        const next = {};
        if (!String(form.type || '').trim()) next.type = 'Document type is required';
        if (!form.issueDate) next.issueDate = 'Issue date is required';
        if (!form.expiryDate) next.expiryDate = 'Expiry date is required';
        if (form.issueDate && form.expiryDate && form.expiryDate <= form.issueDate) {
            next.expiryDate = 'Expiry date must be after the issue date';
        }
        if (!String(form.countryIssued || '').trim()) next.countryIssued = 'Country issued is required';
        const hasFile = Boolean(form.fileBase64 || form.existingUrl || form.fileName);
        if (!hasFile) next.file = 'Attachment is required';
        return next;
    };

    const save = async () => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;
        setSaving(true);
        try {
            const typeName = String(form.type).trim();
            const payload = {
                type: typeName,
                documentName: typeName,
                description: '',
                issueDate: form.issueDate,
                expiryDate: form.expiryDate,
                countryIssued: form.countryIssued,
                outsideUaeIdentity: true,
                cost: null,
                document: form.fileBase64
                    ? {
                          name: form.fileName,
                          data: form.fileBase64,
                          mimeType: form.fileMime || 'application/pdf',
                      }
                    : null,
            };
            const index = editing?.index;
            if (Number.isInteger(index)) {
                await axiosInstance.patch(`/Employee/${employeeId}/document/${index}`, payload, { skipToast: true });
            } else {
                await axiosInstance.post(`/Employee/${employeeId}/document`, payload, { skipToast: true });
            }
            toast({
                title: Number.isInteger(index) ? 'Document updated' : 'Document added',
                description: `${typeName} is saved.`,
            });
            onSaved?.();
            onClose?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save document',
                description: error?.response?.data?.message || error.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const attachmentLabel = form.fileName || (form.existingUrl ? 'Current file attached' : '');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose?.()} />
            <div className="relative flex max-h-[85vh] w-full max-w-[750px] flex-col rounded-[22px] bg-white p-6 shadow-xl md:p-8">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {Number.isInteger(editing?.index) ? 'Edit Document' : 'Add Document'}
                    </h3>
                    <button type="button" onClick={() => !saving && onClose?.()} className="text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div className="modal-scroll flex-1 space-y-5 overflow-y-auto py-6">
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold uppercase tracking-tight text-gray-500">
                            Document type <span className="text-red-500">*</span>
                        </span>
                        <DropdownWithDelete
                            options={typeOptions}
                            value={form.type}
                            onChange={(value) => setForm((current) => ({ ...current, type: value }))}
                            onAdd={() => addType(window.prompt('Document type') || '')}
                            onQuickAddFromSearch={addType}
                            placeholder="Select document type"
                            addNewLabel="+ Add document type"
                            disabled={saving}
                            error={!!errors.type}
                        />
                        {form.type ? (
                            <p className="mt-1 text-xs text-gray-500">This document is named {form.type}.</p>
                        ) : null}
                        {errors.type ? <p className="mt-1 text-xs font-semibold text-red-500">{errors.type}</p> : null}
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold uppercase tracking-tight text-gray-500">
                            Issue date <span className="text-red-500">*</span>
                        </span>
                        <DatePicker
                            value={form.issueDate}
                            onChange={(value) => setForm((current) => ({ ...current, issueDate: value }))}
                            placeholder="dd/mm/yyyy"
                            disabledDays={{ after: new Date() }}
                            disabled={saving}
                        />
                        {errors.issueDate ? <p className="mt-1 text-xs font-semibold text-red-500">{errors.issueDate}</p> : null}
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold uppercase tracking-tight text-gray-500">
                            Expiry date <span className="text-red-500">*</span>
                        </span>
                        <DatePicker
                            value={form.expiryDate}
                            onChange={(value) => setForm((current) => ({ ...current, expiryDate: value }))}
                            placeholder="dd/mm/yyyy"
                            disabledDays={form.issueDate ? { before: form.issueDate } : undefined}
                            disabled={saving}
                        />
                        {errors.expiryDate ? <p className="mt-1 text-xs font-semibold text-red-500">{errors.expiryDate}</p> : null}
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold uppercase tracking-tight text-gray-500">
                            Country issued <span className="text-red-500">*</span>
                        </span>
                        <DropdownWithDelete
                            options={countries}
                            value={form.countryIssued}
                            onChange={(value) => setForm((current) => ({ ...current, countryIssued: value }))}
                            placeholder="Select country"
                            disabled={saving}
                            error={!!errors.countryIssued}
                        />
                        {errors.countryIssued ? <p className="mt-1 text-xs font-semibold text-red-500">{errors.countryIssued}</p> : null}
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-bold uppercase tracking-tight text-gray-500">
                            Attachment <span className="text-red-500">*</span>
                        </span>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ERP_PDF_ACCEPT}
                            onChange={onFile}
                            disabled={saving}
                            className="block w-full text-sm text-gray-700"
                        />
                        {attachmentLabel ? <p className="mt-1 text-xs text-gray-500">{attachmentLabel}</p> : null}
                        {errors.file ? <p className="mt-1 text-xs font-semibold text-red-500">{errors.file}</p> : null}
                    </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                    <button
                        type="button"
                        onClick={() => !saving && onClose?.()}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
