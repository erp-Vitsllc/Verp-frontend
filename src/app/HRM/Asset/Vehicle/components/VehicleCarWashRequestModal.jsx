'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, ChevronDown, Paperclip, Sparkles, History, Calendar, Plus, CheckCircle2, Eye } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import { resolveAttachmentForViewer } from '@/utils/attachmentPreview';
import { buildAddServiceBody } from './vehicleServicePayload';
import {
    fleetServicesForTypeSortedDesc,
    parseVehicleServiceRemark,
    resolveAssetCurrentKilometer,
    resolveVehicleServiceListRowTone,
} from './vehicleServiceUtils';

const ASSET_CONTROLLER_VALUE = '__asset_controller__';
const PDF_MIME_TYPES = ['application/pdf'];
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function currentMonthValue() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatCarWashMonthLabel(yyyyMm) {
    if (!yyyyMm) return '';
    const [y, m] = yyyyMm.split('-').map(Number);
    if (!y || !m) return yyyyMm;
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const fieldControl =
    'w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400';
const fieldSelect = `${fieldControl} appearance-none pr-10`;
const labelClass = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500';
const metaCard =
    'rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 flex flex-col justify-center min-h-[72px] select-none';

function ReadOnlyMetaBox({ label, value, hint }) {
    return (
        <div className={metaCard}>
            <span className={labelClass}>{label}</span>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
            {hint ? <p className="text-[10px] text-slate-400 mt-1">{hint}</p> : null}
        </div>
    );
}

function formatDatedHeader(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    return `${day}/${month}/${year} · ${weekday}`;
}

function formatShortDate(date) {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

function employeeLabel(emp) {
    if (!emp) return '';
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return name || emp.employeeName || emp.name || emp.employeeId || 'Employee';
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            if (!base64) reject(new Error('empty'));
            else resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function FormField({ label, error, children }) {
    return (
        <div className="space-y-2">
            <label className={labelClass}>{label}</label>
            {children}
            {error ? <p className="text-[11px] text-red-600 font-medium">{error}</p> : null}
        </div>
    );
}

function SelectField({ label, value, onChange, error, disabled = false, children }) {
    return (
        <FormField label={label} error={error}>
            <div className="relative">
                <select
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    className={`${fieldSelect} ${error ? 'border-red-300' : ''} ${disabled ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                >
                    {children}
                </select>
                <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
            </div>
        </FormField>
    );
}

function invoiceLabelFromRef(urlOrKey) {
    if (!urlOrKey) return 'Invoice';
    const raw = String(urlOrKey).trim();
    const withoutQuery = raw.split('?')[0];
    const parts = withoutQuery.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const decoded = decodeURIComponent(last);
    return decoded || 'Invoice';
}

function UploadField({ label, fileName, onPick, error, disabled = false }) {
    const inputRef = useRef(null);
    return (
        <FormField label={label} error={error}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && inputRef.current?.click()}
                className={`${fieldControl} flex items-center justify-between gap-2 text-left hover:border-slate-300 hover:bg-slate-50/80 ${
                    error ? 'border-red-300' : ''
                } ${disabled ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
            >
                <span className={`truncate ${fileName ? 'text-slate-800' : 'text-slate-400'}`}>
                    {fileName || 'Choose file to upload'}
                </span>
                <Paperclip size={15} className="text-slate-400 shrink-0" />
            </button>
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={disabled}
                onChange={onPick}
            />
        </FormField>
    );
}

function InvoiceField({
    label,
    fileName,
    onPick,
    error,
    disabled = false,
    existingInvoiceUrl = '',
    existingInvoiceLabel = 'Invoice',
    onView,
    viewLoading = false,
}) {
    const inputRef = useRef(null);
    const hasExisting = Boolean(String(existingInvoiceUrl || '').trim());

    if (disabled) {
        return (
            <FormField label={label} error={error}>
                <div
                    className={`${fieldControl} flex items-center justify-between gap-2 bg-slate-50 ${
                        error ? 'border-red-300' : ''
                    }`}
                >
                    <span className={`truncate ${hasExisting ? 'text-slate-800' : 'text-slate-400'}`}>
                        {hasExisting ? existingInvoiceLabel : 'No invoice uploaded'}
                    </span>
                    {hasExisting ? (
                        <button
                            type="button"
                            disabled={viewLoading}
                            onClick={onView}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                        >
                            {viewLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Eye size={14} />
                            )}
                            View
                        </button>
                    ) : null}
                </div>
            </FormField>
        );
    }

    return (
        <UploadField label={label} fileName={fileName} onPick={onPick} error={error} disabled={disabled} />
    );
}

function CarWashTypeDropdown({
    label,
    value,
    options,
    loading,
    error,
    canManage,
    onChange,
    onAddType,
    disabled = false,
}) {
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

    const displayLabel = loading ? 'Loading types…' : value || 'Select type';

    if (!canManage) {
        return (
            <FormField label={label} error={error}>
                <div className="relative">
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={loading || disabled}
                        className={`${fieldSelect} ${error ? 'border-red-300' : ''} ${loading || disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                    >
                        <option value="">{loading ? 'Loading types…' : 'Select type'}</option>
                        {options.map((typeName) => (
                            <option key={typeName} value={typeName}>
                                {typeName}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                </div>
                {!loading && options.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                        No car wash types configured yet. Contact your administrator.
                    </p>
                ) : null}
            </FormField>
        );
    }

    return (
        <FormField label={label} error={error}>
            <div ref={rootRef} className="relative min-w-0">
                <button
                    type="button"
                    disabled={loading || disabled}
                    onClick={() => {
                        if (loading || disabled) return;
                        setOpen((prev) => !prev);
                        if (open) {
                            setShowAddInput(false);
                            setNewTypeName('');
                        }
                    }}
                    className={`${fieldSelect} flex w-full items-center justify-between gap-2 text-left ${
                        error ? 'border-red-300' : ''
                    } ${!value ? 'text-slate-400' : ''} ${loading || disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                >
                    <span className="truncate">{displayLabel}</span>
                    <ChevronDown
                        size={16}
                        className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </button>

                {open && !loading ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        <ul className="max-h-48 overflow-y-auto py-1">
                            {options.length ? (
                                options.map((typeName) => (
                                    <li key={typeName}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(typeName)}
                                            className={`w-full px-3.5 py-2.5 text-left text-sm font-medium hover:bg-slate-50 ${
                                                value === typeName
                                                    ? 'bg-slate-100 text-slate-900 font-semibold'
                                                    : 'text-slate-700'
                                            }`}
                                        >
                                            {typeName}
                                        </button>
                                    </li>
                                ))
                            ) : (
                                <li className="px-3.5 py-2.5 text-sm text-slate-400">No types yet</li>
                            )}
                        </ul>

                        <div className="border-t border-slate-100 bg-slate-50/80">
                            {!showAddInput ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAddInput(true)}
                                    className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                    <Plus size={14} className="shrink-0" />
                                    Add type
                                </button>
                            ) : (
                                <div className="space-y-2 p-2.5">
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
                                        placeholder="New car wash type"
                                        className={`${fieldControl} h-10 text-sm`}
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
                                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleSaveNewType()}
                                            disabled={adding || !String(newTypeName || '').trim()}
                                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
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
            {!loading && options.length === 0 ? (
                <p className="text-[11px] text-slate-400">Open the list and use Add type to create the first option.</p>
            ) : null}
        </FormField>
    );
}

function buildFormDataFromService(service, assignedEmployee, todayIso) {
    const remark = parseVehicleServiceRemark(service) || {};
    const assigneeId = assignedEmployee?._id ? String(assignedEmployee._id) : '';
    const ownerId = remark?.vehicleOwnerEmployeeId ? String(remark.vehicleOwnerEmployeeId) : assigneeId;
    const driverId = remark?.carDrivenByEmployeeId ? String(remark.carDrivenByEmployeeId) : assigneeId;
    const serviceDate =
        remark?.carWashServiceDate ||
        (service?.date ? new Date(service.date).toISOString().slice(0, 10) : todayIso);

    return {
        date: service?.date ? new Date(service.date).toISOString().slice(0, 10) : todayIso,
        vehicleOwnerEmployeeId: ownerId,
        carDrivenByEmployeeId: driverId,
        carWashMonth: remark?.carWashMonth || currentMonthValue(),
        carWashType: remark?.carWashType || '',
        value: service?.value != null ? String(service.value) : '',
        carWashServiceDate: serviceDate,
        serviceIssue: service?.description || remark?.serviceIssue || '',
        invoiceName: '',
        invoiceBase64: '',
        invoiceMime: '',
        amountReceiptName: '',
        amountReceiptBase64: '',
        amountReceiptMime: '',
    };
}

export default function VehicleCarWashRequestModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    asset = null,
    assignedEmployee = null,
    assetController = null,
    assetControllerId = null,
    existingService = null,
    accountsReviewMode = false,
    showApprovalActions = false,
    onApprove,
    onReject,
    approvalLoading = false,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [carWashTypes, setCarWashTypes] = useState([]);
    const [loadingCarWashTypes, setLoadingCarWashTypes] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [errors, setErrors] = useState({});
    const [previewDocument, setPreviewDocument] = useState(null);
    const [invoiceViewLoading, setInvoiceViewLoading] = useState(false);
    const todayIso = new Date().toISOString().slice(0, 10);
    const canManageCarWashTypes = mounted && isAdmin();

    useEffect(() => {
        setMounted(true);
    }, []);

    const previousCarWash = useMemo(() => {
        const list = fleetServicesForTypeSortedDesc(asset?.services, 'Car Wash');
        const completed = list.filter((s) => {
            const remark = parseVehicleServiceRemark(s);
            if (String(remark?.requestStatus || '').toLowerCase() === 'draft') return false;
            const tone = resolveVehicleServiceListRowTone(
                { serviceId: s._id, remark: s.remark, workflowSnapshot: s.workflowSnapshot },
                { activeServiceWorkflow: asset?.activeServiceWorkflow },
            );
            return tone === 'done';
        });
        return completed[0] || list[0] || null;
    }, [asset]);

    const previousWashDate = useMemo(() => {
        const remark = parseVehicleServiceRemark(previousCarWash);
        return remark?.carWashServiceDate || previousCarWash?.date || previousCarWash?.createdAt || null;
    }, [previousCarWash]);

    const vehicleCurrentKm = useMemo(() => {
        const fromAsset = resolveAssetCurrentKilometer(asset);
        if (fromAsset !== '') return fromAsset;
        if (previousCarWash?.currentKm != null && String(previousCarWash.currentKm).trim() !== '') {
            return String(previousCarWash.currentKm);
        }
        return asset ? '0' : '';
    }, [asset, previousCarWash]);

    const formattedVehicleKm = useMemo(() => {
        if (vehicleCurrentKm === '') return '—';
        const n = Number(vehicleCurrentKm);
        if (!Number.isFinite(n)) return vehicleCurrentKm;
        return n.toLocaleString();
    }, [vehicleCurrentKm]);

    const [formData, setFormData] = useState({
        date: todayIso,
        vehicleOwnerEmployeeId: '',
        carDrivenByEmployeeId: '',
        carWashMonth: currentMonthValue(),
        carWashType: '',
        value: '',
        carWashServiceDate: todayIso,
        serviceIssue: '',
        invoiceName: '',
        invoiceBase64: '',
        invoiceMime: '',
        amountReceiptName: '',
        amountReceiptBase64: '',
        amountReceiptMime: '',
    });

    const set = (key, val) => setFormData((prev) => ({ ...prev, [key]: val }));

    const resetForm = useCallback(() => {
        const assigneeId = assignedEmployee?._id ? String(assignedEmployee._id) : '';
        setFormData({
            date: todayIso,
            vehicleOwnerEmployeeId: assigneeId,
            carDrivenByEmployeeId: assigneeId,
            carWashMonth: currentMonthValue(),
            carWashType: '',
            value: '',
            carWashServiceDate: todayIso,
            serviceIssue: '',
            invoiceName: '',
            invoiceBase64: '',
            invoiceMime: '',
            amountReceiptName: '',
            amountReceiptBase64: '',
            amountReceiptMime: '',
        });
        setErrors({});
        setShowHistory(false);
    }, [assignedEmployee, todayIso]);

    useEffect(() => {
        if (!isOpen) return;
        if (existingService) {
            setFormData(buildFormDataFromService(existingService, assignedEmployee, todayIso));
            setErrors({});
            setShowHistory(false);
            return;
        }
        resetForm();
    }, [isOpen, existingService, resetForm, assignedEmployee, todayIso]);

    const formReadOnly = Boolean(existingService && !accountsReviewMode);
    const accountsFieldLocked = accountsReviewMode;

    const existingInvoiceUrl = useMemo(() => {
        const direct = String(existingService?.invoice || '').trim();
        if (direct) return direct;
        return '';
    }, [existingService]);

    const existingInvoiceLabel = useMemo(() => {
        if (formData.invoiceName) return formData.invoiceName;
        return invoiceLabelFromRef(existingInvoiceUrl);
    }, [formData.invoiceName, existingInvoiceUrl]);

    const handleViewInvoice = async () => {
        if (!existingInvoiceUrl) return;
        setInvoiceViewLoading(true);
        setPreviewDocument({
            data: '',
            name: existingInvoiceLabel,
            mimeType: 'application/pdf',
            loading: true,
        });
        try {
            const resolved = await resolveAttachmentForViewer(existingInvoiceUrl, {
                name: existingInvoiceLabel,
            });
            if (!resolved || resolved.error) {
                setPreviewDocument(null);
                toast({
                    variant: 'destructive',
                    title: 'Cannot open invoice',
                    description: resolved?.error || 'Invoice file is unavailable.',
                });
                return;
            }
            setPreviewDocument({ ...resolved, loading: false });
        } catch {
            setPreviewDocument(null);
            toast({
                variant: 'destructive',
                title: 'Cannot open invoice',
                description: 'Invoice file is unavailable.',
            });
        } finally {
            setInvoiceViewLoading(false);
        }
    };

    const handleAccountsApprove = async () => {
        if (!assetId) return;
        const amount = Number(formData.value);
        const month = String(formData.carWashMonth || '').trim();
        const nextErrors = {};
        if (!month) nextErrors.carWashMonth = 'Car wash month is required';
        if (!Number.isFinite(amount) || amount <= 0) nextErrors.value = 'Amount is required';
        if (Object.keys(nextErrors).length) {
            setErrors(nextErrors);
            toast({
                variant: 'destructive',
                title: 'Required fields',
                description: 'Enter a valid amount and car wash month before approving.',
            });
            return;
        }

        const existingRemark = parseVehicleServiceRemark(existingService) || {};
        const updatedRemark = {
            ...existingRemark,
            carWashMonth: month,
        };

        setLoading(true);
        try {
            const { data } = await axiosInstance.post(`/AssetItem/${assetId}/service-workflow/respond`, {
                action: 'approve',
                comment: 'Approved by Accounts',
                serviceUpdates: {
                    value: amount,
                    remark: JSON.stringify(updatedRemark),
                },
            });
            toast({
                title: 'Approved',
                description: data?.message || 'Car wash status updated to Not paid.',
            });
            if (onSuccess) onSuccess(data?.asset);
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Approval failed',
                description:
                    error.response?.data?.message ||
                    'Could not approve this car wash request. Check your digital signature in profile.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const response = await axiosInstance.get('/employee');
                if (!cancelled) setEmployees(response.data?.employees || []);
            } catch {
                if (!cancelled) setEmployees([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setLoadingCarWashTypes(true);
        (async () => {
            try {
                const { data } = await axiosInstance.get('/AssetItem/car-wash-types');
                if (!cancelled) {
                    setCarWashTypes(Array.isArray(data) ? data : []);
                }
            } catch {
                if (!cancelled) setCarWashTypes([]);
            } finally {
                if (!cancelled) setLoadingCarWashTypes(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const assetControllerName = useMemo(() => {
        const direct = employeeLabel(assetController);
        if (direct) return direct;
        return 'Asset Controller';
    }, [assetController]);

    const employeeOptions = useMemo(() => {
        const opts = employees.map((emp) => ({
            value: String(emp._id),
            label: employeeLabel(emp),
        }));
        if (assignedEmployee?._id) {
            const id = String(assignedEmployee._id);
            if (!opts.some((o) => o.value === id)) {
                opts.unshift({ value: id, label: employeeLabel(assignedEmployee) });
            }
        }
        return opts;
    }, [employees, assignedEmployee]);

    const historyRows = useMemo(
        () => fleetServicesForTypeSortedDesc(asset?.services, 'Car Wash').slice(0, 5),
        [asset],
    );

    const historySummary = useMemo(() => {
        if (!historyRows.length) return 'No records on file';
        return `${historyRows.length} record${historyRows.length === 1 ? '' : 's'}`;
    }, [historyRows]);

    const carWashTypeOptions = useMemo(() => {
        const names = new Set(carWashTypes);
        if (formData.carWashType) names.add(formData.carWashType);
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [carWashTypes, formData.carWashType]);

    const handleAddCarWashType = async (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        try {
            const { data } = await axiosInstance.post('/AssetItem/car-wash-types', { name: trimmed });
            const added = data?.name || trimmed;
            setCarWashTypes((prev) => [...new Set([...prev, added])].sort((a, b) => a.localeCompare(b)));
            set('carWashType', added);
            toast({
                title: 'Type added',
                description: `"${added}" is now available in the dropdown.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not add type',
                description: error.response?.data?.message || 'Try again.',
            });
            throw error;
        }
    };

    const validate = (forDraft = false) => {
        const e = {};
        if (!forDraft) {
            if (!formData.carWashType) e.carWashType = 'Car wash type is required';
            if (!formData.carWashMonth) e.carWashMonth = 'Car wash month is required';
            if (vehicleCurrentKm === '') e.currentKm = 'Vehicle KM is not available';
            const amount = Number(formData.value);
            if (!Number.isFinite(amount) || amount <= 0) e.value = 'Amount is required';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const buildPayload = (forDraft = false) => {
        const typeLabel = formData.carWashType || 'Car Wash';
        const monthLabel = formatCarWashMonthLabel(formData.carWashMonth);
        const description =
            String(formData.serviceIssue || '').trim() ||
            `Car wash request — ${typeLabel}${monthLabel ? ` (${monthLabel})` : ''}`;

        return {
            ...buildAddServiceBody({
                serviceType: 'Car Wash',
                date: formData.date,
                carWashServiceDate: formData.carWashServiceDate || formData.date,
                currentKm: vehicleCurrentKm,
                value: formData.value,
                serviceIssue: description,
                vehicleOwnerEmployeeId: formData.vehicleOwnerEmployeeId,
                carDrivenByEmployeeId: formData.carDrivenByEmployeeId,
                carWashMonth: formData.carWashMonth,
                carWashType: formData.carWashType,
                amountMode: 'amount',
                attachmentName: formData.amountReceiptName,
                attachmentBase64: formData.amountReceiptBase64,
                attachmentMime: formData.amountReceiptMime,
            }),
            serviceRequestSource: 'vehicle_asset_detail',
            isDraft: forDraft,
            invoice:
                formData.invoiceBase64 && formData.invoiceName
                    ? {
                          name: formData.invoiceName,
                          data: formData.invoiceBase64,
                          mimeType: formData.invoiceMime,
                      }
                    : null,
        };
    };

    const handleFilePick = async (event, kind) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const allowed = [...PDF_MIME_TYPES, ...IMAGE_MIME_TYPES];
        if (!allowed.includes(file.type)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file',
                description: 'Upload PDF, PNG, or JPEG only.',
            });
            event.target.value = '';
            return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            toast({
                variant: 'destructive',
                title: 'File too large',
                description: 'Maximum file size is 5 MB.',
            });
            event.target.value = '';
            return;
        }
        try {
            const base64 = await readFileAsBase64(file);
            if (kind === 'invoice') {
                setFormData((prev) => ({
                    ...prev,
                    invoiceName: file.name,
                    invoiceBase64: base64,
                    invoiceMime: file.type,
                }));
            } else {
                setFormData((prev) => ({
                    ...prev,
                    amountReceiptName: file.name,
                    amountReceiptBase64: base64,
                    amountReceiptMime: file.type,
                }));
            }
        } catch {
            toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not read file.' });
        }
        event.target.value = '';
    };

    const postRequest = async (forDraft) => {
        if (!assetId) return;
        if (!validate(forDraft)) return;
        setLoading(true);
        try {
            await axiosInstance.post(`/AssetItem/${assetId}/service`, buildPayload(forDraft));
            toast({
                title: forDraft ? 'Draft saved' : 'Request submitted',
                description: forDraft
                    ? 'Car wash request saved as draft.'
                    : 'Car wash request submitted for approval.',
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save',
                description: error.response?.data?.message || 'Try again in a moment.',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="car-wash-form-title"
                className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18)] flex flex-col"
            >
                {/* Header */}
                <div className="shrink-0 border-b border-slate-100 bg-white px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0">
                            <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <Sparkles size={20} strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Vehicle Service
                                </p>
                                <h2
                                    id="car-wash-form-title"
                                    className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight mt-0.5"
                                >
                                    {accountsReviewMode
                                        ? 'Car Wash Request — Accounts Review'
                                        : existingService
                                          ? 'Car Wash Request'
                                          : 'Car Wash Request Form'}
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                                    <Calendar size={14} className="text-slate-400 shrink-0" />
                                    <span>Dated {formatDatedHeader(new Date())}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Meta row — read-only vehicle details */}
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <ReadOnlyMetaBox
                            label="Current KM"
                            value={formattedVehicleKm}
                            hint={vehicleCurrentKm !== '' ? `Vehicle record: ${formattedVehicleKm} KM` : undefined}
                        />
                        <ReadOnlyMetaBox
                            label="Previous Car Wash"
                            value={formatShortDate(previousWashDate)}
                            hint={
                                previousWashDate
                                    ? undefined
                                    : 'No previous car wash on file'
                            }
                        />
                        <div className={metaCard}>
                            <span className={labelClass}>Car Wash History</span>
                            <p className="mt-1.5 text-sm font-semibold text-slate-900">{historySummary}</p>
                            {historyRows.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setShowHistory((v) => !v)}
                                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                    <History size={13} className="text-slate-400" />
                                    {showHistory ? 'Hide history' : 'View history'}
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {showHistory ? (
                        <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {['Date', 'Type', 'KM', 'Amount'].map((col) => (
                                            <th
                                                key={col}
                                                className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                            >
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {historyRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-4 text-sm text-slate-500">
                                                No previous car wash records on file.
                                            </td>
                                        </tr>
                                    ) : (
                                        historyRows.map((row) => {
                                            const remark = parseVehicleServiceRemark(row);
                                            return (
                                                <tr key={String(row._id)} className="hover:bg-slate-50/80">
                                                    <td className="px-4 py-2.5 text-slate-700">
                                                        {formatShortDate(
                                                            remark?.carWashServiceDate || row.date || row.createdAt,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-700">
                                                        {remark?.carWashType || '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                                                        {row.currentKm != null ? String(row.currentKm) : '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-700 tabular-nums">
                                                        {row.value != null ? `AED ${row.value}` : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </div>

                {/* Form body */}
                <form
                    className="flex-1 overflow-y-auto px-6 py-6 bg-white"
                    onSubmit={(e) => {
                        e.preventDefault();
                        postRequest(false);
                    }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                        <SelectField
                            label="Vehicle Assigned"
                            value={formData.vehicleOwnerEmployeeId}
                            onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                            disabled={formReadOnly || accountsFieldLocked}
                        >
                            <option value="">Select assignee</option>
                            {employeeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                            {!formData.vehicleOwnerEmployeeId ? (
                                <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                            ) : null}
                        </SelectField>

                        <SelectField
                            label="Car Driven By"
                            value={formData.carDrivenByEmployeeId}
                            onChange={(e) => set('carDrivenByEmployeeId', e.target.value)}
                            disabled={formReadOnly || accountsFieldLocked}
                        >
                            <option value="">Select driver</option>
                            {employeeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </SelectField>

                        <FormField label="Car Wash Month" error={errors.carWashMonth}>
                            <MonthYearPicker
                                value={formData.carWashMonth}
                                onChange={(v) => set('carWashMonth', v || '')}
                                placeholder="Select month"
                                valueFormat="yyyy-MM"
                                fromYear={new Date().getFullYear() - 2}
                                toYear={new Date().getFullYear() + 10}
                                disabled={formReadOnly}
                                className={`shadow-none font-medium ${
                                    errors.carWashMonth ? 'border-red-300' : ''
                                }`}
                            />
                        </FormField>

                        <CarWashTypeDropdown
                            label="Car Wash Type"
                            value={formData.carWashType}
                            options={carWashTypeOptions}
                            loading={loadingCarWashTypes}
                            error={errors.carWashType}
                            canManage={canManageCarWashTypes}
                            onChange={(typeName) => set('carWashType', typeName)}
                            onAddType={handleAddCarWashType}
                            disabled={formReadOnly || accountsFieldLocked}
                        />

                        <InvoiceField
                            label="Invoice"
                            fileName={formData.invoiceName}
                            onPick={(e) => handleFilePick(e, 'invoice')}
                            disabled={formReadOnly || accountsFieldLocked}
                            existingInvoiceUrl={existingInvoiceUrl}
                            existingInvoiceLabel={existingInvoiceLabel}
                            onView={() => void handleViewInvoice()}
                            viewLoading={invoiceViewLoading}
                        />

                        <FormField label="Amount" error={errors.value}>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                    AED
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.value}
                                    onChange={(e) => set('value', e.target.value)}
                                    placeholder="0.00"
                                    disabled={formReadOnly}
                                    className={`${fieldControl} pl-12 tabular-nums ${errors.value ? 'border-red-300' : ''} ${formReadOnly ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                                />
                            </div>
                        </FormField>
                    </div>
                </form>

                {/* Footer actions */}
                <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
                        {accountsReviewMode ? (
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleAccountsApprove}
                                className="inline-flex h-11 items-center justify-center gap-2 px-6 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Approve
                                    </>
                                )}
                            </button>
                        ) : formReadOnly ? null : (
                            <>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => postRequest(true)}
                                    className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 size={16} className="animate-spin mx-auto" />
                                    ) : (
                                        'Save Draft'
                                    )}
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => postRequest(false)}
                                    className="h-11 px-6 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 size={16} className="animate-spin mx-auto" />
                                    ) : (
                                        'Submit for Approval'
                                    )}
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            disabled={loading}
                            onClick={onClose}
                            className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
                        >
                            {formReadOnly ? 'Close' : 'Cancel'}
                        </button>
                    </div>
                </div>

                {showApprovalActions ? (
                    <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            disabled={approvalLoading}
                            onClick={onReject}
                            className="h-10 px-5 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            disabled={approvalLoading}
                            onClick={onApprove}
                            className="h-10 px-5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            Approve
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
        <DocumentViewerModal
            isOpen={!!previewDocument}
            onClose={() => setPreviewDocument(null)}
            viewingDocument={previewDocument}
        />
        </>
    );
}
