'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, Plus, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    extractStorageReference,
    loadStorageFileBlob,
    openAttachmentInNewTab,
} from '@/utils/attachmentPreview';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { DatePicker } from '@/components/ui/date-picker';
import VehicleAccidentRepairFormFieldCell from './VehicleAccidentRepairFormFieldCell';
import VehicleCarDrivenBySelect from './VehicleCarDrivenBySelect';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';
import { formatDisplayDate } from './VehicleAccidentRepairForm';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import { useDrivingLicenseHolders } from '@/hooks/useDrivingLicenseHolders';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import {
    buildAccidentRepairDetailFormState,
    buildAccidentRepairDetailSubmitBody,
    getAccidentRepairDetailFormMissingFields,
    isAccidentRepairDetailFormComplete,
    validateAccidentRepairDetailForm,
} from '../utils/vehicleAccidentRepairDetailForm';
import {
    ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT,
    tireAccent,
    tireBtnPrimary,
    tireBtnSecondary,
    tireDatePickerClass,
    tireFieldInput,
    tireFieldSelect,
    tireMoneyInput,
    tirePhotoAddBtn,
    tirePhotoThumb,
    tireUploadBtn,
    tireViewBtn,
} from '../utils/vehicleAccidentRepairDetailUi';
import { applyCarDrivenBySelection } from '../utils/vehicleCarDrivenBySelect';
const ASSET_CONTROLLER_VALUE = '__asset_controller__';
const PDF_MIME_TYPES = ['application/pdf'];
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;

function normalizeControllerEmployeeId(rawId) {
    const id = String(rawId || '').trim();
    if (!id) return '';
    if (id.startsWith('flowchart_')) return id.replace(/^flowchart_/, '').trim();
    return id;
}

function formatShortDate(isoOrDate) {
    if (!isoOrDate) return '—';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

function directAccidentImageSrc(img) {
    const url = String(img?.url || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    return '';
}

function AccidentPartyToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {[
                { id: 'self', label: 'SELF' },
                { id: 'thirdParty', label: 'OTHER PARTY DAMAGE' },
            ].map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id)}
                    className={`flex-1 rounded-md px-1 py-1.5 text-[10px] font-bold transition-all ${
                        value === opt.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    } disabled:opacity-60`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function AutoFillField({ value, placeholder = 'Auto Fill' }) {
    const display = value != null && String(value).trim() !== '' ? String(value) : '';
    return (
        <input
            type="text"
            readOnly
            value={display}
            placeholder={placeholder}
            className={`${tireFieldInput} text-gray-900 font-semibold placeholder:text-gray-400`}
        />
    );
}

export default function VehicleAccidentRepairDetailForm({
    asset,
    service,
    vehicleId,
    serviceId,
    onSaved,
    draftSubmitRef,
    onDraftStateChange,
    canEditAssignment = true,
    className = '',
}) {
    const router = useRouter();
    const { toast } = useToast();
    const photoInputRef = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [saving, setSaving] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);
    const [resolvedExistingPhotoSrc, setResolvedExistingPhotoSrc] = useState({});
    const [formData, setFormData] = useState(() => buildAccidentRepairDetailFormState(service, asset));

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const fieldsDisabled = !assignmentPending || saving || !canEditAssignment;

    const assetController = asset?.assetController || null;
    const assetControllerId = asset?.assetControllerId || null;
    const resolvedAssetControllerEmployeeId = normalizeControllerEmployeeId(
        assetController?._id || assetController?.id || assetController?.employeeId || assetControllerId,
    );

    const assetControllerName = useMemo(() => {
        const toLabel = (emp) => {
            if (!emp) return '';
            if (typeof emp === 'string') return emp.trim();
            const nm = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            return nm || emp.employeeName || emp.name || emp.employeeId || '';
        };

        const direct = toLabel(assetController);
        if (direct) return direct;

        const lookupId = resolvedAssetControllerEmployeeId || String(assetControllerId || '').trim();
        if (lookupId) {
            const byId = (employees || []).find((emp) => String(emp?._id || emp?.id || '') === lookupId);
            const byEmpCode = (employees || []).find((emp) => String(emp?.employeeId || '') === lookupId);
            const label = toLabel(byId || byEmpCode);
            if (label) return label;
        }

        const byRole = (employees || []).find((emp) => {
            const department = String(emp?.department || '').toLowerCase();
            const designation = String(emp?.designation || '').toLowerCase();
            const role = String(emp?.role || '').toLowerCase();
            return (
                department.includes('asset controller') ||
                designation.includes('asset controller') ||
                role.includes('asset controller')
            );
        });
        return toLabel(byRole) || 'Asset Controller';
    }, [assetController, assetControllerId, employees, resolvedAssetControllerEmployeeId]);

    const hasResolvedControllerInEmployees = useMemo(() => {
        const target = String(resolvedAssetControllerEmployeeId || '').trim();
        if (!target) return false;
        return (employees || []).some(
            (emp) =>
                String(emp?._id || emp?.id || '') === target ||
                String(emp?.employeeId || '') === target,
        );
    }, [employees, resolvedAssetControllerEmployeeId]);

    useEffect(() => {
        setFormData(buildAccidentRepairDetailFormState(service, asset));
    }, [service?._id, service?.updatedAt, service?.remark, asset]);

    useEffect(() => {
        const existing = formData.existingAccidentImages || [];
        if (!existing.length) {
            setResolvedExistingPhotoSrc({});
            return undefined;
        }

        let cancelled = false;
        const objectUrls = [];

        (async () => {
            const next = {};
            for (let idx = 0; idx < existing.length; idx += 1) {
                const img = existing[idx];
                const direct = directAccidentImageSrc(img);
                const key = `existing-${idx}`;
                if (direct) {
                    next[key] = direct;
                    continue;
                }
                const storageKey = extractStorageReference(img)?.key;
                if (!storageKey) continue;
                try {
                    const blob = await loadStorageFileBlob(storageKey);
                    const objectUrl = URL.createObjectURL(blob);
                    objectUrls.push(objectUrl);
                    next[key] = objectUrl;
                } catch {
                    /* storage key could not be loaded */
                }
            }
            if (!cancelled) {
                setResolvedExistingPhotoSrc(next);
            } else {
                objectUrls.forEach((url) => URL.revokeObjectURL(url));
            }
        })();

        return () => {
            cancelled = true;
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [formData.existingAccidentImages]);

    useEffect(() => {
        let active = true;
        Promise.all([
            axiosInstance.get('/employee'),
            axiosInstance.get('/Company'),
        ])
            .then(([empRes, companyRes]) => {
                if (!active) return;
                const list = Array.isArray(empRes.data) ? empRes.data : empRes.data?.employees || [];
                setEmployees(list);
                setCompanies(companyRes.data?.companies || companyRes.data || []);
            })
            .catch(() => {
                if (active) {
                    setEmployees([]);
                    setCompanies([]);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    const licensedEmployees = useDrivingLicenseHolders({
        preserveEmployeeId: formData.carDrivenByEmployeeId,
        sourceEmployees: employees,
    });

    useEffect(() => {
        if (!asset?.documents) return;
        const insDocs = asset.documents.filter((d) => d.type === 'Insurance');
        if (!insDocs.length) return;
        insDocs.sort((a, b) => new Date(b.issueDate || b.createdAt) - new Date(a.issueDate || a.createdAt));
        const doc = insDocs[0];
        let parsed = {};
        try {
            parsed = doc.description ? JSON.parse(doc.description) : {};
        } catch {
            parsed = {};
        }
        setFormData((prev) => {
            const next = { ...prev };
            if (!prev.insuranceCompany) next.insuranceCompany = parsed.company || doc.issueAuthority || '';
            if (!prev.policyNumber) next.policyNumber = parsed.policy || '';
            if (!prev.insuranceExpiryDate && doc.expiryDate) {
                next.insuranceExpiryDate = new Date(doc.expiryDate).toISOString().slice(0, 10);
            }
            if (
                prev.accidentOwnerType !== 'thirdParty' &&
                prev.insuranceFineAmount === '' &&
                parsed.excessCharge != null
            ) {
                next.insuranceFineAmount = String(parsed.excessCharge);
            }
            return next;
        });
    }, [asset?._id, asset?.documents, formData.accidentOwnerType]);

    useEffect(() => {
        if (formData.accidentOwnerType !== 'thirdParty') return;
        setFormData((prev) => {
            const updates = {};
            if (prev.policeFineAmount) updates.policeFineAmount = '';
            return Object.keys(updates).length ? { ...prev, ...updates } : prev;
        });
    }, [formData.accidentOwnerType]);

    const set = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const isSelfParty = formData.accidentOwnerType !== 'thirdParty';
    const insuranceExcess = isSelfParty ? Number(formData.insuranceFineAmount || 0) : 0;
    const policeFine = Number(formData.policeFineAmount || 0);
    const otherFine = Number(formData.otherFineAmount || 0);
    const totalFines = insuranceExcess + policeFine + otherFine;

    const headerDateLabel = useMemo(() => formatDisplayDate(formData.date), [formData.date]);

    const handleFileChange = useCallback(
        (e, kind = 'attachment') => {
            const file = e.target.files?.[0];
            if (!file) return;

            const isPdfField = kind === 'attachment' || kind === 'quotation2' || kind === 'quotation3';
            if (isPdfField && !PDF_MIME_TYPES.includes(file.type)) {
                toast({
                    variant: 'destructive',
                    title: 'Invalid file type',
                    description: 'Only PDF files are allowed for attachments.',
                });
                if (e.target) e.target.value = '';
                return;
            }
            if (kind === 'tireCondition') {
                if (!IMAGE_MIME_TYPES.includes(file.type)) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid image type',
                        description: 'Only PNG and JPEG images are allowed.',
                    });
                    if (e.target) e.target.value = '';
                    return;
                }
                if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
                    toast({
                        variant: 'destructive',
                        title: 'Image too large',
                        description: 'Image size must be 2 MB or less.',
                    });
                    if (e.target) e.target.value = '';
                    return;
                }
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = String(reader.result || '').split(',')[1] || '';
                if (kind === 'quotation2') {
                    setFormData((prev) => ({
                        ...prev,
                        quotation2Name: file.name,
                        quotation2Base64: base64,
                        quotation2Mime: file.type || 'application/pdf',
                        existingQuotation2Url: '',
                    }));
                } else if (kind === 'quotation3') {
                    setFormData((prev) => ({
                        ...prev,
                        quotation3Name: file.name,
                        quotation3Base64: base64,
                        quotation3Mime: file.type || 'application/pdf',
                        existingQuotation3Url: '',
                    }));
                } else if (kind === 'tireCondition') {
                    setFormData((prev) => ({
                        ...prev,
                        tireConditionName: file.name,
                        tireConditionBase64: base64,
                        tireConditionMime: file.type || 'application/pdf',
                        existingTireConditionUrl: '',
                    }));
                } else {
                    setFormData((prev) => ({
                        ...prev,
                        attachmentName: file.name,
                        attachmentBase64: base64,
                        attachmentMime: file.type || 'application/pdf',
                        existingAttachmentUrl: '',
                        remarkAttachmentName: '',
                    }));
                }
            };
            reader.readAsDataURL(file);
        },
        [toast],
    );

    const appendAccidentImagesFromFiles = useCallback(
        (fileList) => {
            const files = Array.from(fileList || []);
            files.forEach((file) => {
                if (!IMAGE_MIME_TYPES.includes(file.type)) {
                    toast({
                        variant: 'destructive',
                        title: 'Invalid image type',
                        description: 'Only PNG and JPEG images are allowed.',
                    });
                    return;
                }
                if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
                    toast({
                        variant: 'destructive',
                        title: 'Image too large',
                        description: 'Each image must be 2 MB or less.',
                    });
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = String(reader.result || '').split(',')[1] || '';
                    if (!base64) return;
                    setFormData((prev) => ({
                        ...prev,
                        accidentImages: [
                            ...(prev.accidentImages || []),
                            { name: file.name, data: base64, mimeType: file.type || 'image/jpeg' },
                        ],
                    }));
                };
                reader.readAsDataURL(file);
            });
        },
        [toast],
    );

    const photoGalleryItems = useMemo(() => {
        const items = [];
        (formData.existingAccidentImages || []).forEach((img, idx) => {
            const url = resolvedExistingPhotoSrc[`existing-${idx}`] || directAccidentImageSrc(img);
            if (!url) return;
            items.push({
                key: `existing-${idx}`,
                label: `Accident photo ${items.length + 1}`,
                url,
            });
        });
        (formData.accidentImages || []).forEach((img, idx) => {
            const url = img?.data
                ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                : '';
            if (!url) return;
            items.push({
                key: `new-${idx}`,
                label: `Accident photo ${items.length + 1}`,
                url,
            });
        });
        return items;
    }, [formData.existingAccidentImages, formData.accidentImages, resolvedExistingPhotoSrc]);

    const openPhotoViewer = useCallback(
        (key) => {
            const index = photoGalleryItems.findIndex((item) => item.key === key);
            if (index < 0) return;
            setViewerStartIndex(index);
            setViewerOpen(true);
        },
        [photoGalleryItems],
    );

    const errors = useMemo(() => {
        if (!assignmentPending || !canEditAssignment) return {};
        return validateAccidentRepairDetailForm(formData, asset);
    }, [asset, assignmentPending, canEditAssignment, formData]);

    const persistForm = useCallback(
        async ({ submitAfterSave = false } = {}) => {
            if (!vehicleId || !serviceId) return false;
            setSaving(true);
            try {
                const body = buildAccidentRepairDetailSubmitBody(formData, { keepPending: true });
                await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}`, body);
                if (submitAfterSave) {
                    await axiosInstance.post(
                        `/AssetItem/${vehicleId}/service/${serviceId}/submit-request`,
                    );
                    toast({
                        title: 'Submitted',
                        description:
                            'Vehicle Accident Form was sent. Admin Officer was emailed to complete Garage / Service Details.',
                    });
                } else {
                    toast({ title: 'Draft saved', description: 'Accident repair assignment draft saved.' });
                }
                if (typeof onSaved === 'function') onSaved();
                return true;
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: submitAfterSave ? 'Could not submit' : 'Could not save draft',
                    description: error.response?.data?.message || 'Try again.',
                });
                return false;
            } finally {
                setSaving(false);
            }
        },
        [formData, onSaved, serviceId, toast, vehicleId],
    );

    const handleSubmit = useCallback(async () => {
        if (!assignmentPending || !isAccidentRepairDetailFormComplete(formData, asset)) return;
        await persistForm({ submitAfterSave: true });
    }, [asset, assignmentPending, formData, persistForm]);

    const handleSaveDraft = async () => {
        await persistForm({ submitAfterSave: false });
    };

    const handleCancel = () => {
        if (vehicleId) {
            router.push(`/HRM/Asset/Vehicle/details/${vehicleId}?tab=service`);
        } else {
            router.back();
        }
    };

    const canRequest =
        assignmentPending && !saving && canEditAssignment && isAccidentRepairDetailFormComplete(formData, asset);
    const missingFields = useMemo(
        () =>
            assignmentPending && canEditAssignment ? getAccidentRepairDetailFormMissingFields(formData, asset) : [],
        [asset, formData, assignmentPending, canEditAssignment],
    );

    const submitHandlerRef = useRef(handleSubmit);
    submitHandlerRef.current = handleSubmit;
    if (draftSubmitRef) {
        draftSubmitRef.current = canRequest ? submitHandlerRef.current : null;
    }

    useEffect(() => {
        if (typeof onDraftStateChange !== 'function') return;
        onDraftStateChange({ canRequest, requesting: saving });
    }, [canRequest, onDraftStateChange, saving]);

    const employeeOptions = employees.map((emp) => (
        <option key={emp._id} value={String(emp._id)}>
            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
        </option>
    ));

    const UploadField = ({ label, kind, fileName, existingUrl }) => (
        <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
            {existingUrl ? (
                <button
                    type="button"
                    className={tireViewBtn}
                    onClick={() => void openAttachmentInNewTab(existingUrl, { name: fileName || label })}
                >
                    View
                </button>
            ) : null}
            {!fieldsDisabled ? (
                <label className={tireUploadBtn}>
                    <Upload size={14} />
                    {fileName || existingUrl ? 'Change' : 'Upload'}
                    <input
                        type="file"
                        className="sr-only"
                        accept={kind === 'tireCondition' ? '.jpg,.jpeg,.png,image/jpeg,image/png' : '.pdf,application/pdf'}
                        disabled={fieldsDisabled}
                        onChange={(e) => {
                            handleFileChange(e, kind);
                            e.target.value = '';
                        }}
                    />
                </label>
            ) : null}
            {fileName ? <span className="text-[10px] text-gray-500 truncate">{fileName}</span> : null}
        </div>
    );

    const { fieldMinHeightPx, gapClass } = ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT;
    const accent = tireAccent;

    return (
        <>
            <div className={`flex w-full ${className}`.trim()}>
                <FineFormCard
                    title="Vehicle Accident Form"
                    subtitle={
                        assignmentPending
                            ? `Dated: ${headerDateLabel || '—'} · Complete all fields, then click Send`
                            : `Dated: ${headerDateLabel || '—'} · Submitted assignment`
                    }
                    icon={ClipboardList}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    className={`w-full ${assignmentPending ? '' : 'opacity-[0.97]'}`}
                >
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Date"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <DatePicker
                                value={formData.accidentDate}
                                onChange={(v) => set('accidentDate', v || '')}
                                placeholder="dd/mm/yyyy"
                                disabled={fieldsDisabled}
                                className={tireDatePickerClass}
                            />
                            {errors.accidentDate ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.accidentDate}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Time"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="time"
                                value={formData.accidentTime || ''}
                                onChange={(e) => set('accidentTime', e.target.value)}
                                disabled={fieldsDisabled}
                                className={tireFieldInput}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Location"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="text"
                                value={formData.accidentLocation || ''}
                                onChange={(e) => set('accidentLocation', e.target.value)}
                                disabled={fieldsDisabled}
                                className={tireFieldInput}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Vehicle Assigned"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <select
                                className={tireFieldSelect}
                                value={formData.vehicleOwnerEmployeeId || ''}
                                onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                disabled={fieldsDisabled}
                            >
                                {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                    <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                ) : null}
                                <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                {employeeOptions}
                            </select>
                            {errors.vehicleOwnerEmployeeId ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.vehicleOwnerEmployeeId}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Car Driven By"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <VehicleCarDrivenBySelect
                                formData={formData}
                                employees={licensedEmployees}
                                companies={companies}
                                disabled={fieldsDisabled}
                                className={tireFieldSelect}
                                placeholder="Select employee with driving license"
                                onChange={(selection) => {
                                    setFormData((prev) =>
                                        applyCarDrivenBySelection(prev, selection, { companies }),
                                    );
                                }}
                            />
                            {errors.carDrivenByEmployeeId ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.carDrivenByEmployeeId}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Accident Party"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AccidentPartyToggle
                                value={formData.accidentOwnerType || 'self'}
                                onChange={(v) => set('accidentOwnerType', v)}
                                disabled={fieldsDisabled}
                            />
                            {errors.accidentOwnerType ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.accidentOwnerType}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Insurance Company"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AutoFillField value={formData.insuranceCompany} />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Policy Number"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AutoFillField value={formData.policyNumber} />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Insurance Expiry Date"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <AutoFillField
                                value={
                                    formData.insuranceExpiryDate
                                        ? formatShortDate(formData.insuranceExpiryDate)
                                        : ''
                                }
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    <div
                        className={`grid grid-cols-2 ${isSelfParty ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} ${gapClass} mt-2.5`}
                    >
                        {isSelfParty ? (
                            <VehicleAccidentRepairFormFieldCell
                                label="Insurance Excess"
                                accentClass={accent(0)}
                                minHeightPx={fieldMinHeightPx}
                            >
                                <AutoFillField
                                    value={
                                        formData.insuranceFineAmount !== '' && formData.insuranceFineAmount != null
                                            ? `${formData.insuranceFineAmount} AED`
                                            : ''
                                    }
                                />
                            </VehicleAccidentRepairFormFieldCell>
                        ) : null}

                        <VehicleAccidentRepairFormFieldCell
                            label="Police Fine"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={formData.policeFineAmount}
                                onChange={(e) => set('policeFineAmount', e.target.value)}
                                disabled={fieldsDisabled || formData.accidentOwnerType !== 'self'}
                                placeholder="AED"
                                className={tireMoneyInput}
                            />
                            {errors.policeFineAmount ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.policeFineAmount}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Other Fine"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={formData.otherFineAmount || ''}
                                onChange={(e) => set('otherFineAmount', e.target.value)}
                                disabled={fieldsDisabled}
                                placeholder="AED"
                                className={tireMoneyInput}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Total"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <input
                                type="text"
                                readOnly
                                value={totalFines ? `${totalFines} AED` : ''}
                                className={`${tireMoneyInput} bg-gray-50`}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-3 ${gapClass} mt-2.5`}>
                        <VehicleAccidentRepairFormFieldCell
                            label="Police Report"
                            accentClass={accent(1)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Police Report"
                                kind="attachment"
                                fileName={formData.attachmentName || formData.remarkAttachmentName}
                                existingUrl={formData.existingAttachmentUrl}
                            />
                            {errors.attachment ? (
                                <p className="text-[10px] text-red-500 font-bold mt-1">{errors.attachment}</p>
                            ) : null}
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Police Fine Document"
                            accentClass={accent(2)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Police Fine Document"
                                kind="quotation3"
                                fileName={formData.quotation3Name}
                                existingUrl={formData.existingQuotation3Url}
                            />
                        </VehicleAccidentRepairFormFieldCell>

                        <VehicleAccidentRepairFormFieldCell
                            label="Other Document"
                            accentClass={accent(0)}
                            minHeightPx={fieldMinHeightPx}
                        >
                            <UploadField
                                label="Other Document"
                                kind="tireCondition"
                                fileName={formData.tireConditionName}
                                existingUrl={formData.existingTireConditionUrl}
                            />
                        </VehicleAccidentRepairFormFieldCell>
                    </div>

                    {assignmentPending ? (
                    <>
                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Accident Photos
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {(formData.existingAccidentImages || []).map((img, idx) => {
                                const src =
                                    resolvedExistingPhotoSrc[`existing-${idx}`] || directAccidentImageSrc(img);
                                if (!src) return null;
                                return (
                                    <button
                                        key={`existing-photo-${idx}`}
                                        type="button"
                                        onClick={() => openPhotoViewer(`existing-${idx}`)}
                                        className={tirePhotoThumb}
                                    >
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                    </button>
                                );
                            })}
                            {(formData.accidentImages || []).map((img, idx) => {
                                const src = img?.data
                                    ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
                                    : '';
                                if (!src) return null;
                                return (
                                    <button
                                        key={`new-photo-${idx}`}
                                        type="button"
                                        onClick={() => openPhotoViewer(`new-${idx}`)}
                                        className={tirePhotoThumb}
                                    >
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                    </button>
                                );
                            })}
                            {!fieldsDisabled ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        className={tirePhotoAddBtn}
                                    >
                                        <Plus size={20} />
                                    </button>
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        multiple
                                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                        className="hidden"
                                        onChange={(e) => {
                                            appendAccidentImagesFromFiles(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                </>
                            ) : null}
                        </div>
                        {errors.accidentImages ? (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{errors.accidentImages}</p>
                        ) : null}
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Accident Description
                        </span>
                        <textarea
                            className={`${tireFieldSelect} mt-1.5 resize-y min-h-[88px] font-medium`}
                            value={formData.serviceIssue || ''}
                            onChange={(e) => set('serviceIssue', e.target.value)}
                            disabled={fieldsDisabled}
                            rows={4}
                            placeholder="Describe the accident and any details HR should know…"
                        />
                        {errors.serviceIssue ? (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{errors.serviceIssue}</p>
                        ) : null}
                    </div>
                    </>
                    ) : null}

                    {assignmentPending && canEditAssignment && missingFields.length > 0 ? (
                        <p className="mt-4 text-xs text-amber-700">
                            Still required: {missingFields.join(', ')}
                        </p>
                    ) : null}

                    {assignmentPending && canEditAssignment ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleSaveDraft()}
                                className={tireBtnSecondary}
                            >
                                Save Draft
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleCancel}
                                className={tireBtnSecondary}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving || !canRequest}
                                onClick={() => void handleSubmit()}
                                className={tireBtnPrimary}
                            >
                                {saving ? 'Sending…' : 'Send'}
                            </button>
                        </div>
                    ) : null}

                    {saving ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 size={16} className="animate-spin" />
                            Saving…
                        </div>
                    ) : null}
                </FineFormCard>
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={photoGalleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
}
