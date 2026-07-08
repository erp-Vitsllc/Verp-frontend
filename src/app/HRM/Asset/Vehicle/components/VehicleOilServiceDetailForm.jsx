'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, ChevronDown, Loader2, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { isSystemSuperUser } from '@/utils/permissions';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import { DatePicker } from '@/components/ui/date-picker';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import {
    OIL_SERVICE_DETAIL_GRID_ACCENTS,
    OIL_SERVICE_DETAIL_GRID_LAYOUT,
} from '../utils/vehicleOilServiceDetailGrid';
import {
    isOilServiceAssignmentPending,
} from '../utils/vehicleOilServiceAccess';
import {
    formatWarrantyExpiryFromAsset,
} from '../utils/vehicleOilServiceWarranty';
import {
    DEFAULT_OIL_SERVICE_TYPE,
    buildOilServiceDetailFormState,
    buildOilServiceDetailSubmitBody,
    isOilServiceDetailFormComplete,
    getOilServiceDetailFormMissingFields,
} from '../utils/vehicleOilServiceDetailForm';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';
import { buildGarageHistoryOptions } from '../utils/buildGarageHistoryOptions';

const PDF_MIME_TYPES = ['application/pdf'];

const fieldInput =
    'w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed';
const datePickerClass = `${fieldInput} h-auto justify-start font-normal`;
const fieldSelect = `${fieldInput} appearance-none`;
const uploadBtn =
    'inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const viewBtn =
    'inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-100';

function FormFieldCell({ label, children, accentClass, minHeightPx }) {
    return (
        <div
            className={`flex flex-col justify-center rounded-lg border px-3 py-2.5 ${accentClass}`}
            style={{ minHeight: `${minHeightPx}px` }}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
            <div className="mt-1.5 min-w-0">{children}</div>
        </div>
    );
}

function PaymentToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {[
                { id: 'amount', label: 'Cash' },
                { id: 'warranty', label: 'Warranty' },
            ].map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-all ${
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

function QuoteField({ existingUrl, fileName, disabled, onFile }) {
    const { toast } = useToast();
    const [viewing, setViewing] = useState(false);

    const handleView = async () => {
        if (!existingUrl || viewing) return;
        setViewing(true);
        try {
            const result = await openAttachmentInNewTab(existingUrl, {
                name: fileName || 'Quotation.pdf',
                mimeType: 'application/pdf',
            });
            if (!result.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot open file',
                    description: result.error || 'Attachment is unavailable.',
                });
            }
        } catch {
            toast({
                variant: 'destructive',
                title: 'Cannot open file',
                description: 'Attachment is unavailable.',
            });
        } finally {
            setViewing(false);
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                {existingUrl ? (
                    <button
                        type="button"
                        onClick={() => void handleView()}
                        disabled={viewing}
                        className={viewBtn}
                    >
                        {viewing ? 'Opening…' : 'View'}
                    </button>
                ) : null}
                {!disabled ? (
                    <label className={uploadBtn}>
                        {fileName || existingUrl ? 'Change' : 'Add'}
                        <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,application/pdf"
                            onChange={(e) => {
                                onFile(e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </label>
                ) : null}
                {!existingUrl && !fileName && disabled ? (
                    <span className="text-sm font-medium text-gray-400">—</span>
                ) : null}
            </div>
            {fileName ? (
                <p className="truncate text-[10px] font-medium text-gray-500" title={fileName}>
                    {fileName}
                </p>
            ) : null}
        </div>
    );
}

function OilTypeSuperUserDropdown({ value, options, disabled, onChange, onAddType }) {
    const rootRef = useRef(null);
    const addInputRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [showAddInput, setShowAddInput] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setOpen(false);
                setShowAddInput(false);
                setNewTypeName('');
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    useEffect(() => {
        if (showAddInput && addInputRef.current) {
            addInputRef.current.focus();
        }
    }, [showAddInput]);

    const closeMenu = () => {
        setOpen(false);
        setShowAddInput(false);
        setNewTypeName('');
    };

    const handleSelect = (typeName) => {
        onChange(typeName);
        closeMenu();
    };

    const handleStartAdd = () => {
        setShowAddInput(true);
        setNewTypeName('');
    };

    const handleSaveNewType = async () => {
        const name = String(newTypeName || '').trim();
        if (!name) return;
        setAdding(true);
        try {
            await onAddType(name);
            closeMenu();
        } finally {
            setAdding(false);
        }
    };

    const displayLabel = value || 'Select oil type';

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setOpen((prev) => !prev);
                    if (open) {
                        setShowAddInput(false);
                        setNewTypeName('');
                    }
                }}
                className={`${fieldSelect} flex w-full items-center justify-between gap-2 text-left ${
                    !value ? 'text-gray-400' : ''
                }`}
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && !disabled ? (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    <ul className="max-h-48 overflow-y-auto py-1">
                        {options.length ? (
                            options.map((typeName) => (
                                <li key={typeName}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(typeName)}
                                        className={`w-full px-3 py-2 text-left text-sm font-semibold hover:bg-blue-50 ${
                                            value === typeName ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                        }`}
                                    >
                                        {typeName}
                                    </button>
                                </li>
                            ))
                        ) : (
                            <li className="px-3 py-2 text-sm text-gray-400">No types yet</li>
                        )}
                    </ul>

                    <div className="border-t border-gray-100 bg-gray-50/80">
                        {!showAddInput ? (
                            <button
                                type="button"
                                onClick={handleStartAdd}
                                className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm font-bold text-blue-700 hover:bg-blue-50"
                            >
                                <Plus size={14} className="shrink-0" />
                                Add type
                            </button>
                        ) : (
                            <div className="space-y-2 p-2">
                                <input
                                    ref={addInputRef}
                                    type="text"
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void handleSaveNewType();
                                        }
                                        if (e.key === 'Escape') {
                                            setShowAddInput(false);
                                            setNewTypeName('');
                                        }
                                    }}
                                    placeholder="New oil type name"
                                    className={`${fieldInput} text-sm`}
                                    disabled={adding}
                                />
                                <div className="flex justify-end gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddInput(false);
                                            setNewTypeName('');
                                        }}
                                        disabled={adding}
                                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleSaveNewType()}
                                        disabled={adding || !String(newTypeName || '').trim()}
                                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {adding ? <Loader2 size={12} className="animate-spin" /> : null}
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default function VehicleOilServiceDetailForm({
    asset,
    service,
    scheduleRow,
    vehicleId,
    serviceId,
    onSaved,
    draftSubmitRef,
    onDraftStateChange,
    canEditAssignment = true,
    canEditServiceDates = false,
    className = '',
}) {
    const { toast } = useToast();
    const [employees, setEmployees] = useState([]);
    const [oilTypes, setOilTypes] = useState([DEFAULT_OIL_SERVICE_TYPE]);
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [formData, setFormData] = useState(() => buildOilServiceDetailFormState(service, asset, scheduleRow));

    useEffect(() => {
        setMounted(true);
    }, []);

    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const assignmentPending = isOilServiceAssignmentPending(remark);
    const fieldsDisabled = !assignmentPending || saving || !canEditAssignment;
    const datesEditable = (assignmentPending && canEditAssignment) || canEditServiceDates;

    useEffect(() => {
        setFormData(buildOilServiceDetailFormState(service, asset, scheduleRow));
    }, [service?._id, service?.updatedAt, service?.remark, asset, scheduleRow]);

    const warrantyPaymentMode = formData.amountMode === 'warranty';
    const cashPaymentMode = !warrantyPaymentMode;

    const garageHistoryOptions = useMemo(
        () => buildGarageHistoryOptions(asset, service, formData.garageName),
        [asset, service, formData.garageName],
    );

    useEffect(() => {
        let active = true;
        axiosInstance
            .get('/AssetItem/oil-service-types')
            .then(({ data }) => {
                if (!active) return;
                const list = Array.isArray(data) ? data.filter(Boolean) : [];
                setOilTypes(list.length ? list : [DEFAULT_OIL_SERVICE_TYPE]);
            })
            .catch(() => {
                if (active) setOilTypes([DEFAULT_OIL_SERVICE_TYPE]);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        axiosInstance
            .get('/employee')
            .then(({ data }) => {
                if (!active) return;
                const list = Array.isArray(data) ? data : data?.employees || [];
                setEmployees(list);
            })
            .catch(() => {
                if (active) setEmployees([]);
            });
        return () => {
            active = false;
        };
    }, []);

    const set = useCallback((key, value) => {
        setFormData((prev) => {
            const next = { ...prev, [key]: value };
            if (key === 'value' && prev.amountMode === 'amount') {
                next.quotation1Amount = value;
            }
            return next;
        });
    }, []);

    const warrantyExpiryLabel = formatWarrantyExpiryFromAsset(asset);
    const serviceReqNo = String(service?._id || '').slice(-8) || asset?.assetId || '—';
    const isSuperUser = mounted && isSystemSuperUser();

    const vehicleAssignedLabel = useMemo(() => {
        const id = formData.vehicleOwnerEmployeeId;
        const fromList = employees.find((e) => String(e._id) === String(id));
        if (fromList) {
            return `${fromList.firstName || ''} ${fromList.lastName || ''}`.trim() || fromList.employeeId || '—';
        }
        const assignee = asset?.assignedTo;
        if (assignee && typeof assignee === 'object') {
            return `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.employeeId || '—';
        }
        return '—';
    }, [asset?.assignedTo, employees, formData.vehicleOwnerEmployeeId]);

    const oilTypeOptions = useMemo(() => {
        const set = new Set(oilTypes);
        if (formData.oilServiceTypeText) set.add(formData.oilServiceTypeText);
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [formData.oilServiceTypeText, oilTypes]);

    const handleAddOilType = async (presetName) => {
        const name = String(presetName ?? '').trim();
        if (!name) return;
        try {
            const { data } = await axiosInstance.post('/AssetItem/oil-service-types', { name });
            const added = data?.name || name;
            setOilTypes((prev) => [...new Set([...prev, added])].sort((a, b) => a.localeCompare(b)));
            set('oilServiceTypeText', added);
            toast({ title: 'Oil type added', description: `"${added}" is now available for everyone.` });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not add oil type',
                description: error.response?.data?.message || 'Try again.',
            });
            throw error;
        }
    };

    const { fieldMinHeightPx, gapClass } = OIL_SERVICE_DETAIL_GRID_LAYOUT;
    const accent = (index) => OIL_SERVICE_DETAIL_GRID_ACCENTS[index % OIL_SERVICE_DETAIL_GRID_ACCENTS.length];

    const readPdfFile = (file, onDone) => {
        if (!file) return;
        if (!PDF_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Only PDF files are allowed for quotations.',
            });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const raw = String(reader.result || '');
            const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
            onDone(file, base64);
        };
        reader.readAsDataURL(file);
    };

    const handleQuoteFile = (kind, file) => {
        readPdfFile(file, (f, base64) => {
            if (kind === 'attachment') {
                setFormData((prev) => ({
                    ...prev,
                    attachmentName: f.name,
                    attachmentBase64: base64,
                    attachmentMime: f.type || 'application/pdf',
                    existingAttachmentUrl: '',
                }));
            } else if (kind === 'quotation2') {
                setFormData((prev) => ({
                    ...prev,
                    quotation2Name: f.name,
                    quotation2Base64: base64,
                    quotation2Mime: f.type || 'application/pdf',
                    existingQuotation2Url: '',
                }));
            } else if (kind === 'quotation3') {
                setFormData((prev) => ({
                    ...prev,
                    quotation3Name: f.name,
                    quotation3Base64: base64,
                    quotation3Mime: f.type || 'application/pdf',
                    existingQuotation3Url: '',
                }));
            }
        });
    };

    const handleSaveServiceDates = useCallback(async () => {
        if (!canEditServiceDates || !vehicleId || !serviceId) return;
        setSaving(true);
        try {
            await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}/oil-dates`, {
                serviceStartDate: formData.serviceStartDate || '',
                serviceEndDate: formData.serviceEndDate || '',
            });
            toast({ title: 'Service dates updated' });
            if (typeof onSaved === 'function') onSaved();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not update dates',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setSaving(false);
        }
    }, [canEditServiceDates, formData.serviceEndDate, formData.serviceStartDate, onSaved, serviceId, toast, vehicleId]);

    const handleCreate = useCallback(async () => {
        if (!assignmentPending || saving || !isOilServiceDetailFormComplete(formData) || !vehicleId || !serviceId) {
            return;
        }
        setSaving(true);
        try {
            const body = buildOilServiceDetailSubmitBody(formData);
            await axiosInstance.put(`/AssetItem/${vehicleId}/service/${serviceId}`, body);
            const submitRes = await axiosInstance.post(
                `/AssetItem/${vehicleId}/service/${serviceId}/submit-request`,
            );
            toast({
                title: 'Service requested',
                description: 'Vehicle is on service. HR, Admin Officer, and assignee have been notified.',
            });
            if (typeof onSaved === 'function') {
                onSaved(submitRes.data?.asset || null);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not submit request',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setSaving(false);
        }
    }, [formData, assignmentPending, onSaved, saving, serviceId, toast, vehicleId]);

    const canRequest = assignmentPending && !saving && canEditAssignment && isOilServiceDetailFormComplete(formData);
    const missingFields = useMemo(
        () => (assignmentPending && canEditAssignment ? getOilServiceDetailFormMissingFields(formData) : []),
        [formData, assignmentPending, canEditAssignment],
    );
    const submitHandlerRef = useRef(handleCreate);
    submitHandlerRef.current = handleCreate;

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

    return (
        <div className={`flex w-full ${className}`.trim()}>
            <FineFormCard
                title="Oil Service Assignment Details"
                subtitle={
                    assignmentPending
                        ? 'Complete all fields, then click Send to submit'
                        : 'Submitted assignment — vehicle, schedule, and service request information'
                }
                icon={ClipboardList}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                className="w-full"
            >
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                    <FormFieldCell label="Payment Type" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                        <PaymentToggle
                            value={formData.amountMode === 'warranty' ? 'warranty' : 'amount'}
                            onChange={(mode) => set('amountMode', mode)}
                            disabled={fieldsDisabled}
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Select Warranty Type" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                        <ZohoVendorSelect
                            className={`w-full ${cashPaymentMode ? 'opacity-60' : ''}`}
                            value={formData.vendorName || ''}
                            onChange={(nextValue) => set('vendorName', nextValue)}
                            disabled={fieldsDisabled || cashPaymentMode}
                            placeholder={
                                warrantyPaymentMode
                                    ? 'Select warranty type'
                                    : 'Warranty supplier (select Warranty above)'
                            }
                            extraOptions={garageHistoryOptions}
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Warranty Expiry" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                        <input
                            className={`${fieldInput} ${cashPaymentMode ? 'opacity-60' : ''}`}
                            type="text"
                            readOnly
                            value={warrantyExpiryLabel}
                            disabled
                        />
                    </FormFieldCell>

                    <FormFieldCell label="Oil Type" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                        {isSuperUser && !fieldsDisabled ? (
                            <OilTypeSuperUserDropdown
                                value={formData.oilServiceTypeText || ''}
                                options={oilTypeOptions}
                                disabled={fieldsDisabled}
                                onChange={(typeName) => set('oilServiceTypeText', typeName)}
                                onAddType={handleAddOilType}
                            />
                        ) : (
                            <select
                                className={fieldSelect}
                                value={formData.oilServiceTypeText || ''}
                                onChange={(e) => set('oilServiceTypeText', e.target.value)}
                                disabled={fieldsDisabled}
                            >
                                <option value="">Select oil type</option>
                                {oilTypeOptions.map((typeName) => (
                                    <option key={typeName} value={typeName}>
                                        {typeName}
                                    </option>
                                ))}
                            </select>
                        )}
                    </FormFieldCell>
                    <FormFieldCell label="Current KM" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                        <input
                            className={fieldInput}
                            type="number"
                            min="0"
                            value={formData.currentKm || ''}
                            onChange={(e) => set('currentKm', e.target.value)}
                            disabled={fieldsDisabled}
                            placeholder="KM"
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Last change KM" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                        <input
                            className={fieldInput}
                            type="number"
                            min="0"
                            value={formData.lastChangeKm || ''}
                            onChange={(e) => set('lastChangeKm', e.target.value)}
                            disabled={fieldsDisabled}
                            placeholder="KM"
                        />
                    </FormFieldCell>

                    <FormFieldCell label="Vehicle assigned to" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                        <input
                            className={fieldInput}
                            type="text"
                            readOnly
                            value={vehicleAssignedLabel}
                            disabled
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Car Driven By" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                        <select
                            className={fieldSelect}
                            value={formData.carDrivenByEmployeeId || ''}
                            onChange={(e) => set('carDrivenByEmployeeId', e.target.value)}
                            disabled={fieldsDisabled}
                        >
                            <option value="">Select employee</option>
                            {employeeOptions}
                        </select>
                    </FormFieldCell>
                    {cashPaymentMode ? (
                        <FormFieldCell label="Amount" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                    AED
                                </span>
                                <input
                                    className={`${fieldInput} pl-11`}
                                    type="number"
                                    min="0"
                                    value={formData.value || ''}
                                    onChange={(e) => set('value', e.target.value)}
                                    disabled={fieldsDisabled}
                                    placeholder="0"
                                />
                            </div>
                        </FormFieldCell>
                    ) : null}

                    {cashPaymentMode ? (
                        <>
                            <FormFieldCell label="Quote 1" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                                <QuoteField
                                    existingUrl={formData.existingAttachmentUrl}
                                    fileName={formData.attachmentName || formData.remarkAttachmentName}
                                    disabled={fieldsDisabled}
                                    onFile={(file) => handleQuoteFile('attachment', file)}
                                />
                            </FormFieldCell>
                            <FormFieldCell label="Quote 2" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                                <QuoteField
                                    existingUrl={formData.existingQuotation2Url}
                                    fileName={formData.quotation2Name}
                                    disabled={fieldsDisabled}
                                    onFile={(file) => handleQuoteFile('quotation2', file)}
                                />
                            </FormFieldCell>
                            <FormFieldCell label="Quote 3" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                                <QuoteField
                                    existingUrl={formData.existingQuotation3Url}
                                    fileName={formData.quotation3Name}
                                    disabled={fieldsDisabled}
                                    onFile={(file) => handleQuoteFile('quotation3', file)}
                                />
                            </FormFieldCell>
                        </>
                    ) : null}

                    <FormFieldCell label="Garage Name" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                        <ZohoVendorSelect
                            className="w-full"
                            value={formData.garageName || ''}
                            onChange={(nextValue) => set('garageName', nextValue)}
                            disabled={fieldsDisabled}
                            placeholder="Select vendor"
                            extraOptions={garageHistoryOptions}
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Garage Location" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                        <input
                            className={fieldInput}
                            type="text"
                            value={formData.garageLocation || ''}
                            onChange={(e) => set('garageLocation', e.target.value)}
                            disabled={fieldsDisabled}
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Garage Contact" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                        <input
                            className={fieldInput}
                            type="text"
                            value={formData.garageContact || ''}
                            onChange={(e) => set('garageContact', e.target.value)}
                            disabled={fieldsDisabled}
                        />
                    </FormFieldCell>

                    <FormFieldCell label="Service Req No" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                        <input className={fieldInput} type="text" readOnly value={serviceReqNo} disabled />
                    </FormFieldCell>
                    <FormFieldCell label="Service Start Date" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                        <DatePicker
                            value={formData.serviceStartDate || ''}
                            onChange={(value) => set('serviceStartDate', value || '')}
                            placeholder="dd/mm/yyyy"
                            className={datePickerClass}
                            disabled={!datesEditable || saving}
                        />
                    </FormFieldCell>
                    <FormFieldCell label="Service End Date" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                        <DatePicker
                            value={formData.serviceEndDate || ''}
                            onChange={(value) => {
                                set('serviceEndDate', value || '');
                                if (value) set('nextChangeMonth', value.slice(0, 7));
                            }}
                            placeholder="dd/mm/yyyy"
                            className={datePickerClass}
                            disabled={!datesEditable || saving}
                        />
                    </FormFieldCell>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Work Description
                    </span>
                    <textarea
                        className={`${fieldInput} mt-1.5 min-h-[88px] resize-y font-medium`}
                        rows={3}
                        value={formData.serviceIssue || ''}
                        onChange={(e) => set('serviceIssue', e.target.value)}
                        disabled={fieldsDisabled}
                        placeholder="Enter work description"
                    />
                </div>

                {assignmentPending && canEditAssignment ? (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                        {missingFields.length > 0 ? (
                            <p className="mb-3 text-xs text-amber-700">
                                Still required: {missingFields.join(', ')}
                            </p>
                        ) : null}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => void handleCreate()}
                                disabled={!canRequest}
                                className="min-w-[140px] rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title={
                                    missingFields.length
                                        ? `Missing: ${missingFields.join(', ')}`
                                        : ''
                                }
                            >
                                {saving ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                ) : canEditServiceDates ? (
                    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={() => void handleSaveServiceDates()}
                            disabled={saving}
                            className="min-w-[140px] rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
                        >
                            {saving ? 'Saving...' : 'Save dates'}
                        </button>
                    </div>
                ) : null}
            </FineFormCard>
        </div>
    );
}
