'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import DocumentModal from '@/app/emp/[employeeId]/components/modals/DocumentModal';
import {
    validateEmployeeDocumentForm,
    validateEmployeeDocumentPdfFile,
} from '@/utils/employeeDocumentValidation';
import { saveVehicleProfileCardOrQueue } from '../lib/vehicleProfileCardQueueSave';

const RESERVED_TYPES = new Set([
    'registration',
    'registration attachment',
    'insurance',
    'insurance attachment',
    'warranty',
    'warranty attachment',
    'permit',
    'permit attachment',
    'petrol',
    'petrol attachment',
    'toll',
    'toll attachment',
    'service',
    'basic detail attachment',
]);

const normType = (t) => String(t || '').toLowerCase().trim();

const EMPTY_FORM = {
    type: '',
    description: '',
    issueDate: '',
    expiryDate: '',
    hasExpiry: true,
    hasValue: false,
    value: '',
    basicSalary: '',
    houseRentAllowance: '',
    vehicleAllowance: '',
    fuelAllowance: '',
    otherAllowance: '',
    totalSalary: '',
    file: null,
    fileBase64: '',
    fileName: '',
    fileMime: '',
    isRenewMode: false,
};

function parseVehicleDocMeta(doc) {
    const raw = doc?.description;
    if (!raw) return { note: '', value: null };
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return {
                note: parsed.note != null ? String(parsed.note) : '',
                value: parsed.value != null && parsed.value !== '' ? parsed.value : null,
            };
        }
    } catch {
        /* plain text */
    }
    return { note: String(raw), value: null };
}

function buildVehicleDocDescription(form, existingDoc, isRenew) {
    const note = String(form.description || '').trim();
    let value = null;
    if (form.hasValue && form.value !== '' && form.value != null) {
        const n = Number(String(form.value).replace(/,/g, ''));
        if (Number.isFinite(n)) value = n;
    }

    if (isRenew && existingDoc?._id) {
        return JSON.stringify({
            note,
            ...(value != null ? { value } : {}),
            renewedFrom: existingDoc._id,
            renewedAt: new Date().toISOString(),
        });
    }

    if (value != null) {
        return JSON.stringify({ note, value });
    }
    return note || null;
}

function formFromExistingDoc(doc, isRenew) {
    if (!doc) return { ...EMPTY_FORM };
    if (isRenew) {
        return {
            ...EMPTY_FORM,
            type: doc.type || '',
            isRenewMode: true,
        };
    }
    const meta = parseVehicleDocMeta(doc);
    const hasValue = meta.value != null && meta.value !== '';
    return {
        ...EMPTY_FORM,
        type: doc.type || '',
        description: meta.note,
        issueDate: doc.issueDate ? String(doc.issueDate).substring(0, 10) : '',
        expiryDate: doc.expiryDate ? String(doc.expiryDate).substring(0, 10) : '',
        hasExpiry: !!doc.expiryDate,
        hasValue,
        value: hasValue ? String(meta.value) : '',
        fileName: doc.attachment ? 'Current file attached' : '',
        isRenewMode: false,
    };
}

export default function VehicleGeneralDocumentModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    asset = null,
    existingDoc = null,
    isRenew = false,
    hrMayApplyDirectly = false,
}) {
    const { toast } = useToast();
    const [documentForm, setDocumentForm] = useState(EMPTY_FORM);
    const [documentErrors, setDocumentErrors] = useState({});
    const [savingDocument, setSavingDocument] = useState(false);
    const documentFileRef = useRef(null);

    const isEditing = Boolean(existingDoc?._id && !isRenew);

    useEffect(() => {
        if (!isOpen) return;
        setDocumentForm(formFromExistingDoc(existingDoc, isRenew));
        setDocumentErrors({});
        if (documentFileRef.current) documentFileRef.current.value = '';
    }, [isOpen, existingDoc, isRenew]);

    const handleClose = useCallback(() => {
        if (savingDocument) return;
        setDocumentForm(EMPTY_FORM);
        setDocumentErrors({});
        if (documentFileRef.current) documentFileRef.current.value = '';
        onClose();
    }, [onClose, savingDocument]);

    const handleDocumentFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setDocumentForm((prev) => ({
                ...prev,
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: '',
            }));
            if (documentErrors.file) {
                setDocumentErrors((prev) => {
                    const next = { ...prev };
                    delete next.file;
                    return next;
                });
            }
            return;
        }

        const fileValidation = validateEmployeeDocumentPdfFile(file, { requireFile: false });
        if (!fileValidation.isValid) {
            setDocumentErrors((prev) => ({ ...prev, file: fileValidation.error }));
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: fileValidation.error,
            });
            if (e.target) e.target.value = '';
            setDocumentForm((prev) => ({
                ...prev,
                file: null,
                fileBase64: '',
                fileName: '',
                fileMime: '',
            }));
            return;
        }

        if (documentErrors.file) {
            setDocumentErrors((prev) => {
                const next = { ...prev };
                delete next.file;
                return next;
            });
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            setDocumentForm((prev) => ({
                ...prev,
                file,
                fileBase64: base64,
                fileName: file.name,
                fileMime: file.type || 'application/pdf',
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveDocument = async () => {
        const hasExistingFile = isEditing && Boolean(existingDoc?.attachment);
        const requireFile = !isEditing;

        const errors = validateEmployeeDocumentForm(documentForm, {
            isLabourModal: false,
            requireFile,
            hasExistingFile: hasExistingFile && !documentForm.fileBase64,
        });

        const typeTrimmed = String(documentForm.type || '').trim();
        if (!typeTrimmed) {
            errors.type = errors.type || 'Document Type is required';
        } else {
            const typeUnchanged = isEditing && normType(typeTrimmed) === normType(existingDoc?.type);
            if (RESERVED_TYPES.has(normType(typeTrimmed)) && !typeUnchanged) {
                errors.type =
                    'This document type is reserved for structured sections (registration, insurance, etc.). Choose another name.';
            }
        }

        if (Object.keys(errors).length > 0) {
            setDocumentErrors(errors);
            return;
        }

        if (!assetId) return;

        setSavingDocument(true);
        try {
            const hasExpiry = documentForm.hasExpiry !== false;
            const descriptionValue = buildVehicleDocDescription(documentForm, existingDoc, isRenew);

            const payload = {
                type: typeTrimmed,
                issueDate: documentForm.issueDate ? String(documentForm.issueDate).substring(0, 10) : null,
                expiryDate: hasExpiry && documentForm.expiryDate
                    ? String(documentForm.expiryDate).substring(0, 10)
                    : null,
                description: descriptionValue,
            };

            if (documentForm.fileBase64) {
                payload.document = {
                    name: documentForm.fileName || 'document',
                    data: documentForm.fileBase64,
                    mimeType: documentForm.fileMime || 'application/pdf',
                };
            }

            const steps = [];
            if (isEditing) {
                steps.push({ op: 'put_document', docId: existingDoc._id, body: payload });
            } else {
                if (isRenew && existingDoc?._id) {
                    payload.renewFromDocumentId = existingDoc._id;
                }
                steps.push({ op: 'post_document', body: payload });
            }

            await saveVehicleProfileCardOrQueue({
                asset,
                assetId,
                sectionId: 'documents',
                action: isRenew ? 'renew' : 'edit',
                steps,
                documentId: isRenew ? existingDoc?._id || null : null,
                hrMayApplyDirectly,
                proposedRows: [
                    { label: 'Document type', value: typeTrimmed },
                    {
                        label: 'Action',
                        value: isRenew ? 'Renew' : isEditing ? 'Edit' : 'Add',
                    },
                ],
                toast,
                queuedMessage: 'Document change saved. Submit for HR approval when ready.',
                appliedMessage: isRenew
                    ? 'New document is live. The previous file was moved to Old Documents.'
                    : isEditing
                      ? 'Document details have been updated successfully.'
                      : 'Document details have been added successfully.',
                onSuccess: () => {
                    setDocumentForm(EMPTY_FORM);
                    setDocumentErrors({});
                    if (documentFileRef.current) documentFileRef.current.value = '';
                    onSuccess?.();
                },
                onClose,
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.response?.data?.message || 'Failed to save document.',
            });
        } finally {
            setSavingDocument(false);
        }
    };

    return (
        <DocumentModal
            isOpen={isOpen}
            onClose={handleClose}
            documentForm={documentForm}
            setDocumentForm={setDocumentForm}
            documentErrors={documentErrors}
            setDocumentErrors={setDocumentErrors}
            savingDocument={savingDocument}
            documentFileRef={documentFileRef}
            editingDocumentIndex={isEditing ? 0 : null}
            onDocumentFileChange={handleDocumentFileChange}
            onSaveDocument={handleSaveDocument}
            modalMode="standard"
        />
    );
}
