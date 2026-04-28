'use client';

import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Settings, DollarSign, FileText, AlignLeft, Paperclip, Calendar, ExternalLink, Search, ChevronDown, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import {
    mapServiceRecordToFormData,
    validateVehicleServiceForm,
    buildAddServiceBody,
    parseServiceRemark,
} from '@/app/HRM/Asset/Vehicle/components/vehicleServicePayload';

const input = (err) =>
    `w-full h-11 px-3 bg-white border rounded-xl text-sm font-medium text-slate-700 outline-none transition-all focus:ring-2 focus:ring-teal-500/15 ${err ? 'border-red-300' : 'border-slate-200 focus:border-[#00B5AD]'
    }`;
const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const PDF_MIME_TYPES = ['application/pdf'];

function BodyWorkEmployeeSearch({ employees, value, onChange, disabled, hasError }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((e) => {
            const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
            const empId = String(e.employeeId || '').toLowerCase();
            return name.includes(q) || empId.includes(q);
        });
    }, [employees, query]);

    const selected = employees.find((e) => String(e._id) === String(value));

    useEffect(() => {
        const handler = (ev) => {
            if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const label = selected
        ? `${[selected.firstName, selected.lastName].filter(Boolean).join(' ')}${selected.employeeId ? ` (${selected.employeeId})` : ''}`
        : 'Select employee';

    return (
        <div ref={wrapRef} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setOpen((o) => !o);
                    setQuery('');
                }}
                className={`w-full px-4 py-3 rounded-2xl border text-left text-sm font-semibold outline-none transition-all focus:ring-4 focus:ring-teal-500/10 flex items-center justify-between gap-2 bg-gray-50 ${hasError ? 'border-red-300' : 'border-gray-200 focus:border-[#00B5AD]'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
                <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !disabled ? (
                <div className="absolute z-50 mt-1 w-full rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <Search size={14} className="text-gray-400 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name or employee ID..."
                            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
                        />
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-gray-400">No employees found</li>
                        ) : (
                            filtered.map((emp) => {
                                const active = String(emp._id) === String(value);
                                return (
                                    <li key={emp._id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange(String(emp._id));
                                                setOpen(false);
                                                setQuery('');
                                            }}
                                            className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-teal-50/80 transition-colors ${active ? 'bg-teal-50 font-semibold text-[#00B5AD]' : 'text-gray-700'
                                                }`}
                                        >
                                            <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                {(emp.firstName || 'E').charAt(0)}
                                            </span>
                                            <span className="min-w-0 truncate">
                                                {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
                                            </span>
                                            {emp.employeeId ? (
                                                <span className="ml-auto text-[10px] text-gray-400 font-mono shrink-0">{emp.employeeId}</span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

const VehicleServiceModal = forwardRef(function VehicleServiceModal(
    {
        isOpen,
        onClose,
        onSuccess,
        assetId,
        presetServiceType = '',
        assignedEmployee = null,
        assetController = null,
        assetControllerId = null,
        /** Latest completed service of this type (before the new entry you're adding). */
        lastCompletedServiceDate = null,
        /** When set, sent on POST so the API allows vehicle service creation (fleet dashboard only). */
        serviceRequestSource = null,
        /** When true, render only the form (no full-screen overlay) for workflow approval modal. */
        embedMode = false,
        /** Hydrate form from an existing services[] document (workflow review). */
        workflowServiceRecord = null,
        /** Hide Save/Cancel footer (workflow provides Approve/Reject). */
        hideFormFooter = false,
        /** Active workflow stage when used in approval modal. */
        workflowStage = '',
    },
    ref
) {
    const ASSET_CONTROLLER_VALUE = '__asset_controller__';
    const normalizeControllerEmployeeId = (rawId) => {
        const id = String(rawId || '').trim();
        if (!id) return '';
        if (id.startsWith('flowchart_')) return id.replace(/^flowchart_/, '').trim();
        return id;
    };
    const resolvedAssetControllerEmployeeId = normalizeControllerEmployeeId(
        assetController?._id || assetController?.id || assetController?.employeeId || assetControllerId
    );
    const { toast } = useToast();
    const isOilPreset = presetServiceType === 'Oil Service';
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const initialDate = new Date().toISOString().slice(0, 10);
    const [formData, setFormData] = useState({
        serviceType: presetServiceType || '',
        oilServiceTypeText: '',
        date: initialDate,
        adminScheduledServiceDate: '',
        adminServiceDurationDays: '',
        amountMode: 'amount', // amount | warranty
        liableOn: 'company', // company | person
        liablePersonId: '',
        serviceIssue: '',
        mechanicalDurationDays: '',
        value: '',
        tireNumber: '',
        previousChangeKm: '',
        currentKm: '',
        nextChangeKm: '',
        nextChangeMonth: '',
        carWashServiceDate: initialDate,
        accidentDate: '',
        accidentOwnerType: 'self',
        policeFineAmount: '',
        assignedByEmployeeId: '',
        vehicleOwnerEmployeeId: assignedEmployee?._id
            ? String(assignedEmployee._id)
            : (resolvedAssetControllerEmployeeId || ASSET_CONTROLLER_VALUE),
        insuranceCompany: '',
        insuranceFineAmount: '',
        accidentImages: [],
        existingAccidentImages: [],
        accidentRepairDurationDays: '',
        policyReportDate: '',
        accidentOwner: '',
        accidentStatus: 'Active',
        insuranceApprovalStatus: '',
        attachmentName: '',
        tireConditionName: '',
        tireConditionBase64: '',
        tireConditionMime: '',
        existingTireConditionUrl: '',
        attachmentBase64: '',
        attachmentMime: '',
        existingAttachmentUrl: '',
        remarkAttachmentName: '',
        quotation2Name: '',
        quotation2Base64: '',
        quotation2Mime: '',
        existingQuotation2Url: '',
        quotation3Name: '',
        quotation3Base64: '',
        quotation3Mime: '',
        existingQuotation3Url: '',
        bodyWorkImages: [],
        existingBodyWorkImages: [],
        expectedDurationDays: '',
        approvedQuotationChoice: '',
        vendorName: '',
        quotation1Amount: '',
        quotation2Amount: '',
        quotation3Amount: '',
    });
    const [errors, setErrors] = useState({});
    const [bodyWorkLightboxSrc, setBodyWorkLightboxSrc] = useState(null);
    const [showPreviousServicesModal, setShowPreviousServicesModal] = useState(false);
    const [loadingPreviousServices, setLoadingPreviousServices] = useState(false);
    const [previousServicesError, setPreviousServicesError] = useState('');
    const [previousServices, setPreviousServices] = useState([]);
    const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState('');
    const bodyWorkImagesInputRef = useRef(null);
    const accidentImagesInputRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        if (!isOpen) setBodyWorkLightboxSrc(null);
    }, [isOpen]);

    useEffect(() => {
        if (!bodyWorkLightboxSrc) return;
        const onKey = (e) => {
            if (e.key === 'Escape') setBodyWorkLightboxSrc(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [bodyWorkLightboxSrc]);

    useEffect(() => {
        if (!isOpen) return;
        if (embedMode && workflowServiceRecord) {
            setFormData(mapServiceRecordToFormData(workflowServiceRecord, assignedEmployee));
            setErrors({});
            return;
        }
        if (isOilPreset && assetId) {
            try {
                const raw = localStorage.getItem(`oil-service-draft:${assetId}`);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setFormData({
                        ...parsed,
                        serviceType: 'Oil Service',
                        date: new Date().toISOString().slice(0, 10),
                    });
                    setErrors({});
                    return;
                }
            } catch {
                // ignore corrupted local draft
            }
        }
        setFormData({
            serviceType: presetServiceType || '',
            oilServiceTypeText: '',
            date: new Date().toISOString().slice(0, 10),
            adminScheduledServiceDate: '',
            adminServiceDurationDays: '',
            amountMode: 'amount',
            liableOn: 'company',
            liablePersonId: assignedEmployee?._id ? String(assignedEmployee._id) : '',
            serviceIssue: '',
            mechanicalDurationDays: '',
            value: '',
            tireNumber: '',
            previousChangeKm: '',
            currentKm: '',
            nextChangeKm: '',
            nextChangeMonth: '',
            carWashServiceDate: new Date().toISOString().slice(0, 10),
            accidentDate: '',
            accidentOwnerType: 'self',
            policeFineAmount: '',
            assignedByEmployeeId: '',
            vehicleOwnerEmployeeId: assignedEmployee?._id
                ? String(assignedEmployee._id)
                : (resolvedAssetControllerEmployeeId || ASSET_CONTROLLER_VALUE),
            insuranceCompany: '',
            insuranceFineAmount: '',
            accidentImages: [],
            existingAccidentImages: [],
            accidentRepairDurationDays: '',
            policyReportDate: '',
            accidentOwner: '',
            accidentStatus: 'Active',
            insuranceApprovalStatus: '',
            attachmentName: '',
            tireConditionName: '',
            tireConditionBase64: '',
            tireConditionMime: '',
            existingTireConditionUrl: '',
            attachmentBase64: '',
            attachmentMime: '',
            existingAttachmentUrl: '',
            remarkAttachmentName: '',
            quotation2Name: '',
            quotation2Base64: '',
            quotation2Mime: '',
            existingQuotation2Url: '',
            quotation3Name: '',
            quotation3Base64: '',
            quotation3Mime: '',
            existingQuotation3Url: '',
            bodyWorkImages: [],
            existingBodyWorkImages: [],
            expectedDurationDays: '',
            approvedQuotationChoice: '',
            vendorName: '',
            quotation1Amount: '',
            quotation2Amount: '',
            quotation3Amount: '',
        });
        setErrors({});
    }, [isOpen, presetServiceType, assignedEmployee, embedMode, workflowServiceRecord, isOilPreset, assetId]);

    useEffect(() => {
        if (!isOpen) return;
        setFormData((prev) => {
            if (String(prev.vehicleOwnerEmployeeId || '').trim()) return prev;
            return {
                ...prev,
                vehicleOwnerEmployeeId: assignedEmployee?._id
                    ? String(assignedEmployee._id)
                    : (resolvedAssetControllerEmployeeId || ASSET_CONTROLLER_VALUE),
            };
        });
    }, [isOpen, assignedEmployee, resolvedAssetControllerEmployeeId]);

    useImperativeHandle(
        ref,
        () => ({
            validateForm: () => {
                const e = validateVehicleServiceForm(formData, { workflowStage });
                setErrors(e);
                return Object.keys(e).length === 0;
            },
            getServiceUpdatePayload: () => buildAddServiceBody(formData, { workflowStage }),
        }),
        [formData, workflowStage]
    );

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

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
    const isOilService = formData.serviceType === 'Oil Service';
    const isTireChange = formData.serviceType === 'Tire Change';
    const isMechanicalWork = formData.serviceType === 'Mechanical Work';
    const isBodyWork = formData.serviceType === 'Body Work';
    const isAccidentRepair = formData.serviceType === 'Accident Repair';
    const isCarWash = formData.serviceType === 'Car Wash';
    const isAddServiceMode = !workflowServiceRecord;
    const lockedServiceDate = isAddServiceMode ? initialDate : formData.date;
    const assetControllerName = useMemo(() => {
        const toLabel = (emp) => {
            if (!emp) return '';
            if (typeof emp === 'string') return emp.trim();
            const nm = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            return nm || emp.employeeName || emp.name || emp.employeeId || '';
        };

        const direct = toLabel(assetController);
        if (direct) return direct;

        const acId = String(assetControllerId || '').trim();
        const normalizedAcId = normalizeControllerEmployeeId(acId);
        const lookupId = normalizedAcId || acId;
        if (lookupId) {
            const byId = (employees || []).find((emp) => String(emp?._id || emp?.id || '') === lookupId);
            const byEmpCode = (employees || []).find((emp) => String(emp?.employeeId || '') === lookupId);
            const matched = byId || byEmpCode;
            const label = toLabel(matched);
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
        const roleLabel = toLabel(byRole);
        return roleLabel || 'Asset Controller';
    }, [assetController, assetControllerId, employees]);
    const hasResolvedControllerInEmployees = useMemo(() => {
        const target = String(resolvedAssetControllerEmployeeId || '').trim();
        if (!target) return false;
        return (employees || []).some((emp) => String(emp?._id || emp?.id || '') === target);
    }, [employees, resolvedAssetControllerEmployeeId]);
    const requiresKmSchedule = isOilService || isTireChange || isCarWash;
    const requiresCurrentKmOnly = isMechanicalWork || isBodyWork;
    const requiresThreeQuotations =
        isTireChange ||
        isMechanicalWork ||
        isBodyWork ||
        (isOilService && formData.amountMode === 'amount');
    const usesSingleMandatoryAttachment =
        formData.serviceType === 'Car Wash' ||
        formData.serviceType === 'Taxi Charge' ||
        formData.serviceType === 'Other';
    const allowWarranty = true;
    const showQuotationAmounts = requiresThreeQuotations;

    useEffect(() => {
        if (!allowWarranty && formData.amountMode !== 'amount') {
            setFormData((prev) => ({ ...prev, amountMode: 'amount' }));
        }
    }, [allowWarranty, formData.amountMode]);

    useEffect(() => {
        if (isBodyWork && formData.amountMode !== 'amount') {
            setFormData((prev) => ({ ...prev, amountMode: 'amount' }));
        }
    }, [isBodyWork, formData.amountMode]);

    useEffect(() => {
        if (isCarWash && formData.amountMode !== 'amount') {
            setFormData((prev) => ({ ...prev, amountMode: 'amount' }));
        }
    }, [isCarWash, formData.amountMode]);

    useEffect(() => {
        if (!isAccidentRepair) return;
        if (formData.accidentOwnerType === 'thirdParty' && formData.policeFineAmount) {
            setFormData((prev) => ({ ...prev, policeFineAmount: '' }));
        }
    }, [isAccidentRepair, formData.accidentOwnerType, formData.policeFineAmount]);

    const licensedEmployees = useMemo(() => {
        const hasLicense = (emp) =>
            Boolean(
                emp?.drivingLicenceDetails?.number ||
                emp?.drivingLicenseDetails?.number ||
                emp?.drivingLicenceNo ||
                emp?.drivingLicenseNo
            );
        return (employees || []).filter(hasLicense);
    }, [employees]);

    const isHrApprovalStep = embedMode && workflowStage === 'pending_hr';
    const isAdminApprovalStep = embedMode && workflowStage === 'pending_admin';

    useEffect(() => {
        if (!isOpen || !isAdminApprovalStep || !workflowServiceRecord) return;
        setFormData((prev) => {
            if (String(prev.adminScheduledServiceDate || '').trim()) return prev;
            const seed = prev.date || new Date().toISOString().slice(0, 10);
            return { ...prev, adminScheduledServiceDate: seed, adminServiceDurationDays: prev.adminServiceDurationDays || '1' };
        });
    }, [isOpen, isAdminApprovalStep, workflowServiceRecord?._id]);
    const vendorOptions = [
        'Al Futtaim Motors',
        'AGMC',
        'Emirates Motor Company',
        'Dynatrade',
        'FastTrack Auto',
        'Galadari Automobiles',
        'Arabian Automobiles',
        'Premier Car Care',
    ];
    const availableQuotations = useMemo(() => {
        const list = [];
        if (formData.attachmentName || formData.existingAttachmentUrl) {
            list.push({ key: 'q1', label: 'Quotation 1', url: formData.existingAttachmentUrl, name: formData.attachmentName || formData.remarkAttachmentName || '' });
        }
        if (formData.quotation2Name || formData.existingQuotation2Url) {
            list.push({ key: 'q2', label: 'Quotation 2', url: formData.existingQuotation2Url, name: formData.quotation2Name || '' });
        }
        if (formData.quotation3Name || formData.existingQuotation3Url) {
            list.push({ key: 'q3', label: 'Quotation 3', url: formData.existingQuotation3Url, name: formData.quotation3Name || '' });
        }
        return list;
    }, [
        formData.attachmentName,
        formData.existingAttachmentUrl,
        formData.remarkAttachmentName,
        formData.quotation2Name,
        formData.existingQuotation2Url,
        formData.quotation3Name,
        formData.existingQuotation3Url,
    ]);
    const selectedQuotationKey = String(formData.approvedQuotationChoice || '').trim();
    const selectedQuotation = useMemo(() => {
        if (!selectedQuotationKey) return null;
        const exact = availableQuotations.find((q) => q.key === selectedQuotationKey) || null;
        if (exact?.url) return exact;
        // Fallback for older records where selected key is q2/q3, but backend already
        // collapsed selected file into Quotation 1 storage.
        const q1 = availableQuotations.find((q) => q.key === 'q1') || null;
        return q1 || exact;
    }, [availableQuotations, selectedQuotationKey]);

    const openPreviousServicesModal = async () => {
        if (!assetId) return;
        setShowPreviousServicesModal(true);
        setPreviousServicesError('');
        setLoadingPreviousServices(true);
        try {
            const response = await axiosInstance.get('/AssetItem/vehicle-fleet-service-requests');
            const payload = response?.data;
            const targetAssetId = String(assetId);
            let list = [];

            // Preferred source: same flat rows used by Vehicle Service Requests table.
            if (Array.isArray(payload?.items)) {
                list = payload.items
                    .filter((row) => String(row?.vehicleId || '') === targetAssetId)
                    .map((row) => ({
                        _id: row?.serviceId || row?._id,
                        serviceId: row?.serviceId || row?._id,
                        vehicleId: row?.vehicleId || assetId,
                        serviceType: row?.serviceType,
                        date: row?.date,
                        value: row?.value,
                        description: row?.description,
                        currentKm: row?.currentKm,
                        remark: row?.remark,
                        attachment: row?.attachment,
                        quotation2: row?.quotation2,
                        quotation3: row?.quotation3,
                        invoice: row?.invoice,
                    }));
            } else if (Array.isArray(payload)) {
                list = payload.filter((row) => String(row?.vehicleId || row?.assetId || '') === targetAssetId);
            } else {
                // Fallback: asset-detail endpoint shape.
                const asset = payload || {};
                const ownerAssetId = String(asset?._id || asset?.id || '');
                const rawServices = Array.isArray(asset?.services) ? asset.services : [];
                list = rawServices.filter((service) => {
                    const serviceAssetRef = String(
                        service?.assetId || service?.assetItemId || service?.asset || service?.assetRef || ''
                    );
                    // Many service rows are embedded without explicit asset reference; keep those.
                    if (!serviceAssetRef) return true;
                    return serviceAssetRef === targetAssetId || serviceAssetRef === ownerAssetId;
                });
            }

            const sorted = [...list].sort((a, b) => {
                const da = a?.date ? new Date(a.date).getTime() : 0;
                const db = b?.date ? new Date(b.date).getTime() : 0;
                return db - da;
            });
            setPreviousServices(sorted);
        } catch (error) {
            setPreviousServices([]);
            setPreviousServicesError(error?.response?.data?.message || 'Failed to load previous services.');
        } finally {
            setLoadingPreviousServices(false);
        }
    };

    const formatServiceDate = (date) => {
        if (!date) return '—';
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString();
    };

    const getServiceDetailsSummary = (service) => {
        const remark = parseServiceRemark(service?.remark);
        const detailBits = [];
        if (service?.description) detailBits.push(service.description);
        if (service?.currentKm != null && service.currentKm !== '') detailBits.push(`KM: ${service.currentKm}`);
        if (remark?.vendorName) detailBits.push(`Vendor: ${remark.vendorName}`);
        if (remark?.accidentRepairDurationDays) detailBits.push(`Duration: ${remark.accidentRepairDurationDays} day(s)`);
        if (remark?.nextChangeKm) detailBits.push(`Next KM: ${remark.nextChangeKm}`);
        if (remark?.nextChangeMonth) detailBits.push(`Next month: ${remark.nextChangeMonth}`);
        if (remark?.insuranceCompany) detailBits.push(`Insurance: ${remark.insuranceCompany}`);
        return detailBits.slice(0, 4).join(' • ') || '—';
    };

    const openServiceDetailsPage = (service) => {
        const vehicleId = String(service?.vehicleId || assetId || '').trim();
        const serviceId = String(service?.serviceId || service?._id || '').trim();
        if (!vehicleId || !serviceId) return;
        router.push(`/HRM/Asset/Vehicle/service-requests/details/${vehicleId}/${serviceId}`);
    };

    useEffect(() => {
        if (!isHrApprovalStep) return;
        if (availableQuotations.length === 1) {
            setFormData((prev) => ({ ...prev, approvedQuotationChoice: availableQuotations[0].key }));
        }
    }, [isHrApprovalStep, availableQuotations]);

    const handleFileChange = (e, kind = 'attachment') => {
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
            const base64 = reader.result.split(',')[1];
            if (kind === 'quotation2') {
                setFormData(prev => ({
                    ...prev,
                    quotation2Name: file.name,
                    quotation2Base64: base64,
                    quotation2Mime: file.type || 'application/pdf',
                    existingQuotation2Url: '',
                }));
            } else if (kind === 'quotation3') {
                setFormData(prev => ({
                    ...prev,
                    quotation3Name: file.name,
                    quotation3Base64: base64,
                    quotation3Mime: file.type || 'application/pdf',
                    existingQuotation3Url: '',
                }));
            } else if (kind === 'tireCondition') {
                setFormData(prev => ({
                    ...prev,
                    tireConditionName: file.name,
                    tireConditionBase64: base64,
                    tireConditionMime: file.type || 'application/pdf',
                    existingTireConditionUrl: '',
                }));
            } else {
                setFormData(prev => ({
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
    };

    const appendBodyWorkImagesFromFiles = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
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
                    bodyWorkImages: [
                        ...(prev.bodyWorkImages || []),
                        { name: file.name, data: base64, mimeType: file.type || 'image/jpeg' },
                    ],
                }));
            };
            reader.readAsDataURL(file);
        });
    };

    const appendAccidentImagesFromFiles = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
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
    };

    const validate = () => {
        const e = validateVehicleServiceForm(formData, { workflowStage });
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (embedMode) return;
        if (!validate()) return;
        setLoading(true);
        try {
            const body = {
                ...buildAddServiceBody(formData),
                ...(serviceRequestSource ? { serviceRequestSource } : {}),
            };
            await axiosInstance.post(`/AssetItem/${assetId}/service`, body);
            if (isOilPreset && assetId) {
                try {
                    localStorage.removeItem(`oil-service-draft:${assetId}`);
                } catch {
                    // ignore
                }
            }
            toast({ title: 'Success', description: 'Service record added successfully' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.response?.data?.message || 'Failed to save service record' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    const saveServiceDraft = async () => {
        if (!assetId) return;
        setLoading(true);
        try {
            const body = {
                ...buildAddServiceBody(formData),
                ...(serviceRequestSource ? { serviceRequestSource } : {}),
                isDraft: true,
            };
            await axiosInstance.post(`/AssetItem/${assetId}/service`, body);
            toast({ title: 'Draft saved', description: 'Service request saved as draft.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Could not save draft',
                description: error.response?.data?.message || 'Try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    const formInner = (
        <>
            {!embedMode && (
                <>
                    <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white">
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-[#00B5AD]">
                                <Settings size={18} />
                            </div>
                            {isOilPreset
                                ? 'Add oil change service'
                                : presetServiceType === 'Tire Change'
                                    ? 'Add tire change service'
                                    : presetServiceType === 'Mechanical Work'
                                        ? 'Add mechanical service record'
                                        : presetServiceType === 'Body Work'
                                            ? 'Add body work service'
                                            : presetServiceType === 'Car Wash'
                                                ? 'Add car wash service'
                                            : presetServiceType === 'Accident Repair'
                                                ? 'Add accident repair'
                                                : 'Add Service Record'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {lastCompletedServiceDate && !isTireChange && presetServiceType !== 'Accident Repair' && presetServiceType !== 'Car Wash' && (
                        <div className="mx-8 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 flex gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#00B5AD] shrink-0">
                                <Calendar size={18} />
                            </div>
                            <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-semibold text-slate-600">
                                    Previous service date (this type)
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                    {new Date(lastCompletedServiceDate).toLocaleString()}
                                </p>
                                <p className="text-[11px] text-slate-600 leading-snug">
                                    Use this as reference when scheduling the next visit or entering current odometer.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}

            <form
                onSubmit={handleSubmit}
                className={`${embedMode ? 'px-4 py-4 max-h-[min(70vh,520px)]' : 'px-8 py-7 max-h-[78vh]'} overflow-y-auto flex flex-col gap-6 [&_label]:!text-xs [&_label]:!font-medium [&_label]:!text-slate-600 [&_label]:!normal-case [&_label]:!tracking-normal [&_textarea]:!bg-white [&_textarea]:!border-slate-200 [&_textarea]:!rounded-xl [&_select]:!bg-white [&_select]:!border-slate-200 [&_select]:!rounded-xl`}
            >
                {!isAccidentRepair && !isCarWash && (
                <>
                {/* Row 1: Oil service type (oil only) + Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {isOilService && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Settings size={11} /> Oil Service Type
                            </label>
                            <input
                                type="text"
                                value={formData.oilServiceTypeText}
                                onChange={(e) => set('oilServiceTypeText', e.target.value)}
                                placeholder="Enter oil service type"
                                className={input(errors.oilServiceTypeText)}
                            />
                            {errors.oilServiceTypeText && <p className="text-[10px] text-red-500 font-bold">{errors.oilServiceTypeText}</p>}
                        </div>
                    )}

                    <div className={`space-y-1.5 ${isOilService || isMechanicalWork || isBodyWork ? '' : 'md:col-span-2'}`}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <FileText size={11} /> Date
                        </label>
                        <DatePicker
                            value={lockedServiceDate}
                            onChange={(v) => {
                                if (isAddServiceMode) return;
                                set('date', v || '');
                            }}
                            placeholder="Today"
                            className={input(errors.date || errors.serviceType)}
                            disabled={isAddServiceMode}
                        />
                        {errors.date && <p className="text-[10px] text-red-500 font-bold">{errors.date}</p>}
                        {errors.serviceType && <p className="text-[10px] text-red-500 font-bold">{errors.serviceType}</p>}
                    </div>
                    {isMechanicalWork ? (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600 opacity-0 select-none">History</label>
                            <button
                                type="button"
                                onClick={openPreviousServicesModal}
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-teal-700 hover:bg-teal-50 text-left"
                            >
                                View previous services
                            </button>
                        </div>
                    ) : null}
                    {isBodyWork ? (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600 opacity-0 select-none">History</label>
                            <button
                                type="button"
                                onClick={openPreviousServicesModal}
                                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-teal-700 hover:bg-teal-50 text-left"
                            >
                                View previous services
                            </button>
                        </div>
                    ) : null}
                </div>

                {isOilService || isTireChange || isMechanicalWork ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {isMechanicalWork ? 'Payment Type' : 'Amount Type'}
                            </label>
                            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => set('amountMode', 'amount')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.amountMode === 'amount'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {isMechanicalWork ? 'Cash' : 'Amount'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set('amountMode', 'warranty')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.amountMode === 'warranty'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Warranty
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier name</label>
                            <select
                                value={formData.vendorName}
                                onChange={(e) => set('vendorName', e.target.value)}
                                disabled={formData.amountMode !== 'warranty'}
                                className={`${input(errors.vendorName)} ${formData.amountMode !== 'warranty' ? 'opacity-60' : ''}`}
                            >
                                <option value="">
                                    {formData.amountMode === 'warranty'
                                        ? 'Select supplier...'
                                        : 'Supplier (for warranty)'}
                                </option>
                                {vendorOptions.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                            {errors.vendorName ? <p className="text-[10px] text-red-500 font-bold">{errors.vendorName}</p> : null}
                        </div>
                    </div>
                ) : null}

                {/* Row 2: Amount / Warranty (legacy non-oil; hidden for Oil, Tire, Body Work) */}
                <div className={`grid grid-cols-2 gap-6 ${isOilService || isTireChange || isMechanicalWork || isBodyWork || isAccidentRepair || isCarWash ? 'hidden' : ''}`}>
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount Type</label>
                        {allowWarranty ? (
                            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => set('amountMode', 'amount')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.amountMode === 'amount'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Amount
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set('amountMode', 'warranty')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.amountMode === 'warranty'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Warranty
                                </button>
                            </div>
                        ) : (
                            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-[11px] font-bold text-slate-600">
                                Amount
                            </div>
                        )}
                    </div>
                    <div className={`space-y-1.5 ${requiresThreeQuotations ? 'opacity-50' : ''}`}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <DollarSign size={11} /> Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 select-none">AED</span>
                            <input
                                type="number"
                                min="0"
                                value={formData.value}
                                onChange={(e) => set('value', e.target.value)}
                                placeholder={formData.amountMode === 'warranty' ? 'Covered by warranty' : '0.00'}
                                disabled={formData.amountMode === 'warranty' || requiresThreeQuotations}
                                className={`${input(errors.value)} pl-14 ${formData.amountMode === 'warranty' ? 'opacity-60' : ''}`}
                            />
                        </div>
                        {requiresThreeQuotations ? (
                            <p className="text-[10px] text-slate-500">Use quotation-level amounts below.</p>
                        ) : errors.value ? (
                            <p className="text-[10px] text-red-500 font-bold">{errors.value}</p>
                        ) : null}
                    </div>
                </div>

                {isOilService || isTireChange ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {isTireChange ? 'Previous change KM' : 'Current KM'}
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={isTireChange ? formData.previousChangeKm : formData.currentKm}
                                onChange={(e) => set(isTireChange ? 'previousChangeKm' : 'currentKm', e.target.value)}
                                placeholder={isTireChange ? 'Previous change kilometer' : 'Current kilometer'}
                                className={input(isTireChange ? errors.previousChangeKm : errors.currentKm)}
                            />
                            {isTireChange
                                ? (errors.previousChangeKm && <p className="text-[10px] text-red-500 font-bold">{errors.previousChangeKm}</p>)
                                : (errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>)}
                        </div>
                        {isOilService ? (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle owner</label>
                                <select
                                    value={formData.vehicleOwnerEmployeeId || ''}
                                    onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                    className={input(false)}
                                >
                                    {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                        <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                    ) : null}
                                    <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={String(emp._id)}>
                                            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
                                            {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : isTireChange ? (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Previous change date</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={lastCompletedServiceDate ? new Date(lastCompletedServiceDate).toLocaleDateString() : '—'}
                                    className={`${input(false)} bg-slate-100`}
                                />
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {isMechanicalWork ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.currentKm}
                                onChange={(e) => set('currentKm', e.target.value)}
                                placeholder="Current kilometer"
                                className={input(errors.currentKm)}
                            />
                            {errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle owner</label>
                            <select
                                value={formData.vehicleOwnerEmployeeId || ''}
                                onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                className={input(false)}
                            >
                                {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                    <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                ) : null}
                                <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                {employees.map((emp) => (
                                    <option key={emp._id} value={String(emp._id)}>
                                        {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
                                        {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : null}

                {isTireChange ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle owner</label>
                            <select
                                value={formData.vehicleOwnerEmployeeId || ''}
                                onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                className={input(false)}
                            >
                                {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                    <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                ) : null}
                                <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                {employees.map((emp) => (
                                    <option key={emp._id} value={String(emp._id)}>
                                        {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
                                        {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.currentKm}
                                onChange={(e) => set('currentKm', e.target.value)}
                                placeholder="Current kilometer"
                                className={input(errors.currentKm)}
                            />
                            {errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>}
                        </div>
                    </div>
                ) : null}

                {isTireChange ? (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Paperclip size={11} /> Upload tire condition <span className="text-red-500">*</span>
                        </label>
                        {formData.existingTireConditionUrl ? (
                            <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 mb-1 flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-teal-900">Tire condition file on record</p>
                                    {formData.tireConditionName ? (
                                        <p className="text-[10px] text-teal-800/80 truncate max-w-[240px]">{formData.tireConditionName}</p>
                                    ) : null}
                                </div>
                                <a
                                    href={formData.existingTireConditionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 shrink-0 text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline"
                                >
                                    <ExternalLink size={14} />
                                    Open
                                </a>
                            </div>
                        ) : null}
                        <div className={`relative flex items-center justify-center w-full h-28 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${formData.tireConditionName
                            ? 'border-teal-300 bg-teal-50/30'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => handleFileChange(e, 'tireCondition')}
                                accept=".jpg,.jpeg,.png"
                            />
                            <div className="text-center pointer-events-none px-2">
                                {formData.tireConditionName ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <FileText className="text-[#00B5AD]" size={22} />
                                        <p className="text-[10px] font-black text-gray-700 max-w-[180px] truncate mt-1">{formData.tireConditionName}</p>
                                        <p className="text-[9px] text-[#00B5AD] font-bold uppercase tracking-widest">Change</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5">
                                        <Paperclip size={18} className="text-gray-300" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {errors.tireCondition ? <p className="text-[10px] text-red-500 font-bold">{errors.tireCondition}</p> : null}
                    </div>
                ) : null}

                {/* Row removed as requested: Current KM / Next Change KM / Next Change Month */}

                {/* Body Work: liable party + searchable employee when Employee is liable */}
                {isBodyWork && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Type</label>
                            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        set('liableOn', 'company');
                                        set('liablePersonId', '');
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.liableOn === 'company'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Company
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set('liableOn', 'person')}
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.liableOn === 'person'
                                        ? 'bg-white text-[#00B5AD] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Employee
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select employee</label>
                            <BodyWorkEmployeeSearch
                                employees={employees}
                                value={formData.liablePersonId}
                                onChange={(id) => set('liablePersonId', id)}
                                disabled={formData.liableOn !== 'person'}
                                hasError={!!errors.liablePersonId}
                            />
                            {formData.liableOn !== 'person' ? (
                                <p className="text-[10px] text-slate-500">Choose Employee as liable party to search and select a person.</p>
                            ) : errors.liablePersonId ? (
                                <p className="text-[10px] text-red-500 font-bold">{errors.liablePersonId}</p>
                            ) : null}
                        </div>
                    </div>
                )}

                {isBodyWork ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.currentKm}
                                onChange={(e) => set('currentKm', e.target.value)}
                                placeholder="Current kilometer"
                                className={input(errors.currentKm)}
                            />
                            {errors.currentKm && <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle owner</label>
                            <select
                                value={formData.vehicleOwnerEmployeeId || ''}
                                onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                className={input(false)}
                            >
                                {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                    <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                ) : null}
                                <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                {employees.map((emp) => (
                                    <option key={emp._id} value={String(emp._id)}>
                                        {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
                                        {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : null}

                {isBodyWork ? (
                    <div className="space-y-1.5 order-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Upload images
                        </label>
                        <div className="relative rounded-xl border border-slate-200 bg-slate-50/90 max-w-full">
                            <div
                                className="overflow-x-auto overflow-y-hidden max-w-full px-2 pt-2 pb-1.5 [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500"
                            >
                                <div className="flex items-center gap-2 w-max min-h-[56px] py-0.5">
                                    {(formData.existingBodyWorkImages || []).map((img, idx) => {
                                        const src = img?.url || '';
                                        if (!src) return null;
                                        return (
                                            <button
                                                key={`existing-${idx}`}
                                                type="button"
                                                onClick={() => setBodyWorkLightboxSrc(src)}
                                                className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-teal-200/90 bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B5AD] focus-visible:ring-offset-1"
                                                aria-label="View image larger"
                                            >
                                                <img src={src} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        );
                                    })}
                                    {(formData.bodyWorkImages || []).map((img, idx) => {
                                        const mime = img?.mimeType || 'image/jpeg';
                                        const src = img?.data ? `data:${mime};base64,${img.data}` : '';
                                        if (!src) return null;
                                        return (
                                            <button
                                                key={`new-${idx}`}
                                                type="button"
                                                onClick={() => setBodyWorkLightboxSrc(src)}
                                                className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B5AD] focus-visible:ring-offset-1"
                                                aria-label="View image larger"
                                            >
                                                <img src={src} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => bodyWorkImagesInputRef.current?.click()}
                                        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border-2 border-dashed border-[#00B5AD]/50 bg-white text-[#00B5AD] hover:border-[#00B5AD] hover:bg-teal-50/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B5AD] focus-visible:ring-offset-1"
                                        aria-label="Add images"
                                    >
                                        <Plus size={18} strokeWidth={2.25} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 px-2 pb-2 leading-snug">
                                {(formData.existingBodyWorkImages || []).length + (formData.bodyWorkImages || []).length === 0
                                    ? 'Use + to add photos (JPG, PNG, WEBP).'
                                    : 'Use the bar under the row to scroll. Tap a thumbnail to view full size.'}
                            </p>
                            <input
                                ref={bodyWorkImagesInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                accept=".jpg,.jpeg,.png"
                                onChange={(e) => {
                                    appendBodyWorkImagesFromFiles(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                        </div>
                    </div>
                ) : null}
                </>
                )}

                {isCarWash && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <FileText size={11} /> Date
                                </label>
                                <DatePicker
                                    value={lockedServiceDate}
                                    onChange={(v) => {
                                        if (isAddServiceMode) return;
                                        set('date', v || '');
                                    }}
                                    placeholder="Today"
                                    className={input(errors.date || errors.serviceType)}
                                    disabled={isAddServiceMode}
                                />
                                {errors.date && <p className="text-[10px] text-red-500 font-bold">{errors.date}</p>}
                                {errors.serviceType && <p className="text-[10px] text-red-500 font-bold">{errors.serviceType}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Service date
                                </label>
                                <DatePicker
                                    value={formData.carWashServiceDate}
                                    onChange={(v) => set('carWashServiceDate', v || '')}
                                    placeholder="Select service date"
                                    className={input(errors.carWashServiceDate)}
                                />
                                {errors.carWashServiceDate ? <p className="text-[10px] text-red-500 font-bold">{errors.carWashServiceDate}</p> : null}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 select-none">AED</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.value}
                                        onChange={(e) => set('value', e.target.value)}
                                        placeholder="0.00"
                                        className={`${input(errors.value)} pl-14`}
                                    />
                                </div>
                                {errors.value ? <p className="text-[10px] text-red-500 font-bold">{errors.value}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    Previous service date
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={lastCompletedServiceDate ? new Date(lastCompletedServiceDate).toLocaleDateString() : 'No previous car wash service'}
                                    className={`${input(false)} bg-slate-100`}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.currentKm}
                                    onChange={(e) => set('currentKm', e.target.value)}
                                    placeholder="Current kilometer"
                                    className={input(errors.currentKm)}
                                />
                                {errors.currentKm ? <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle owner</label>
                                <select
                                    value={formData.vehicleOwnerEmployeeId || ''}
                                    onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                    className={input(false)}
                                >
                                    {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                        <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                    ) : null}
                                    <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={String(emp._id)}>
                                            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
                                            {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <AlignLeft size={11} /> Description
                            </label>
                            <textarea
                                value={formData.serviceIssue}
                                onChange={(e) => set('serviceIssue', e.target.value)}
                                placeholder="Describe service details..."
                                rows={4}
                                className={`${input(errors.serviceIssue)} resize-none`}
                            />
                            {errors.serviceIssue ? <p className="text-[10px] text-red-500 font-bold">{errors.serviceIssue}</p> : null}
                        </div>
                    </div>
                )}

                {isAccidentRepair && (
                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <FileText size={11} /> Date
                                </label>
                                <DatePicker
                                    value={lockedServiceDate}
                                    onChange={(v) => {
                                        if (isAddServiceMode) return;
                                        set('date', v || '');
                                    }}
                                    placeholder="Request date"
                                    className={input(errors.date || errors.serviceType)}
                                    disabled={isAddServiceMode}
                                />
                                {errors.date && <p className="text-[10px] text-red-500 font-bold">{errors.date}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600 opacity-0 select-none">History</label>
                                <button
                                    type="button"
                                    onClick={openPreviousServicesModal}
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-teal-700 hover:bg-teal-50 text-left"
                                >
                                    View previous services
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accident date</label>
                                <DatePicker
                                    value={formData.accidentDate}
                                    onChange={(v) => set('accidentDate', v || '')}
                                    placeholder="When the accident happened"
                                    className={input(errors.accidentDate)}
                                />
                                {errors.accidentDate && <p className="text-[10px] text-red-500 font-bold">{errors.accidentDate}</p>}
                            </div>
                            <div className="flex flex-col items-start gap-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Accident party</label>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => set('accidentOwnerType', 'self')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.accidentOwnerType === 'self'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Self
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => set('accidentOwnerType', 'thirdParty')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${formData.accidentOwnerType === 'thirdParty'
                                            ? 'bg-white text-[#00B5AD] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Third party
                                    </button>
                                </div>
                                {errors.accidentOwnerType && <p className="text-[10px] text-red-500 font-bold">{errors.accidentOwnerType}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current KM</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.currentKm}
                                    onChange={(e) => set('currentKm', e.target.value)}
                                    placeholder="Current kilometer"
                                    className={input(errors.currentKm)}
                                />
                                {errors.currentKm ? <p className="text-[10px] text-red-500 font-bold">{errors.currentKm}</p> : null}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vehicle owner</label>
                                <select
                                    value={formData.vehicleOwnerEmployeeId || ''}
                                    onChange={(e) => set('vehicleOwnerEmployeeId', e.target.value)}
                                    className={input(false)}
                                >
                                    {resolvedAssetControllerEmployeeId && !hasResolvedControllerInEmployees ? (
                                        <option value={resolvedAssetControllerEmployeeId}>{assetControllerName}</option>
                                    ) : null}
                                    <option value={ASSET_CONTROLLER_VALUE}>{assetControllerName}</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={String(emp._id)}>
                                            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Employee'}
                                            {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned by</label>
                                <select
                                    value={formData.assignedByEmployeeId}
                                    onChange={(e) => set('assignedByEmployeeId', e.target.value)}
                                    className={input(errors.assignedByEmployeeId)}
                                >
                                    <option value="">Select employee...</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={emp._id}>
                                            {`${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
                                            {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {errors.assignedByEmployeeId ? <p className="text-[10px] text-red-500 font-bold">{errors.assignedByEmployeeId}</p> : null}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insurance company</label>
                                <input
                                    type="text"
                                    value={formData.insuranceCompany}
                                    onChange={(e) => set('insuranceCompany', e.target.value)}
                                    placeholder="As per policy (enter company name)"
                                    className={input(false)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insurance fine (AED)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">AED</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.insuranceFineAmount}
                                        onChange={(e) => set('insuranceFineAmount', e.target.value)}
                                        placeholder="0.00"
                                        className={`${input(false)} pl-14`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repair duration (days)</label>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={formData.accidentRepairDurationDays}
                                    onChange={(e) => set('accidentRepairDurationDays', e.target.value)}
                                    placeholder="e.g. 7"
                                    className={input(errors.accidentRepairDurationDays)}
                                />
                                {errors.accidentRepairDurationDays && (
                                    <p className="text-[10px] text-red-500 font-bold">{errors.accidentRepairDurationDays}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Police fine (AED)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">AED</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.policeFineAmount}
                                        onChange={(e) => set('policeFineAmount', e.target.value)}
                                        placeholder={formData.accidentOwnerType === 'self' ? '0.00' : 'Disabled for third party'}
                                        disabled={formData.accidentOwnerType !== 'self'}
                                        className={`${input(false)} pl-14 ${formData.accidentOwnerType !== 'self' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Police report (PDF) <span className="text-red-500">*</span>
                            </label>
                            {formData.existingAttachmentUrl ? (
                                <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold text-teal-900">File on record</p>
                                    <a
                                        href={formData.existingAttachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-teal-700 hover:underline"
                                    >
                                        Open
                                    </a>
                                </div>
                            ) : null}
                            <div className="relative flex items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl border-gray-200 bg-gray-50">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => {
                                        handleFileChange(e, 'attachment');
                                        e.target.value = '';
                                    }}
                                />
                                <div className="text-center pointer-events-none px-2">
                                    {formData.attachmentName ? (
                                        <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{formData.attachmentName}</p>
                                    ) : (
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload PDF</p>
                                    )}
                                </div>
                            </div>
                            {errors.attachment && <p className="text-[10px] text-red-500 font-bold">{errors.attachment}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Claim report (upload)</label>
                                {formData.existingQuotation2Url ? (
                                    <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 flex justify-between">
                                        <p className="text-[11px] font-bold text-teal-900 truncate pr-2">{formData.quotation2Name || 'File'}</p>
                                        <a href={formData.existingQuotation2Url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-teal-700">Open</a>
                                    </div>
                                ) : null}
                                <div className="relative flex items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl border-gray-200 bg-gray-50">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".pdf,application/pdf"
                                        onChange={(e) => {
                                            handleFileChange(e, 'quotation2');
                                            e.target.value = '';
                                        }}
                                    />
                                    <p className="text-[10px] font-black text-slate-400 uppercase text-center pointer-events-none px-2">
                                        {formData.quotation2Name || 'Upload claim report'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Insurance fine (copy / upload)</label>
                                {formData.existingQuotation3Url ? (
                                    <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 flex justify-between">
                                        <p className="text-[11px] font-bold text-teal-900 truncate pr-2">{formData.quotation3Name || 'File'}</p>
                                        <a href={formData.existingQuotation3Url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-teal-700">Open</a>
                                    </div>
                                ) : null}
                                <div className="relative flex items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl border-gray-200 bg-gray-50">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".pdf,application/pdf"
                                        onChange={(e) => {
                                            handleFileChange(e, 'quotation3');
                                            e.target.value = '';
                                        }}
                                    />
                                    <p className="text-[10px] font-black text-slate-400 uppercase text-center pointer-events-none px-2">
                                        {formData.quotation3Name || 'Upload copy'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <AlignLeft size={11} /> Accident description
                            </label>
                            <textarea
                                value={formData.serviceIssue}
                                onChange={(e) => set('serviceIssue', e.target.value)}
                                placeholder="Describe the accident and damage..."
                                rows={4}
                                className={`${input(errors.serviceIssue)} resize-none`}
                            />
                            {errors.serviceIssue && <p className="text-[10px] text-red-500 font-bold">{errors.serviceIssue}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accident photos</label>
                            <div className="relative rounded-xl border border-slate-200 bg-slate-50/90 max-w-full">
                                <div className="overflow-x-auto overflow-y-hidden max-w-full px-2 pt-2 pb-1.5 [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400">
                                    <div className="flex items-center gap-2 w-max min-h-[56px] py-0.5">
                                        {(formData.existingAccidentImages || []).map((img, idx) => {
                                            const src = img?.url || '';
                                            if (!src) return null;
                                            return (
                                                <button
                                                    key={`ex-acc-${idx}`}
                                                    type="button"
                                                    onClick={() => setBodyWorkLightboxSrc(src)}
                                                    className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-amber-200/90 bg-white shadow-sm"
                                                    aria-label="View image"
                                                >
                                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            );
                                        })}
                                        {(formData.accidentImages || []).map((img, idx) => {
                                            const mime = img?.mimeType || 'image/jpeg';
                                            const src = img?.data ? `data:${mime};base64,${img.data}` : '';
                                            if (!src) return null;
                                            return (
                                                <button
                                                    key={`new-acc-${idx}`}
                                                    type="button"
                                                    onClick={() => setBodyWorkLightboxSrc(src)}
                                                    className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm"
                                                    aria-label="View image"
                                                >
                                                    <img src={src} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => accidentImagesInputRef.current?.click()}
                                            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border-2 border-dashed border-amber-500/50 bg-white text-amber-700 hover:border-amber-600 hover:bg-amber-50/60"
                                            aria-label="Add photos"
                                        >
                                            <Plus size={18} strokeWidth={2.25} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 px-2 pb-2">Scroll the row, tap + to add, tap a photo to enlarge.</p>
                                <input
                                    ref={accidentImagesInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                accept=".jpg,.jpeg,.png"
                                    onChange={(e) => {
                                        appendAccidentImagesFromFiles(e.target.files);
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                        </div>

                    </div>
                )}

                {!isAccidentRepair && !isCarWash && (
                <>
                <div className="space-y-1.5 order-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlignLeft size={11} /> Description
                    </label>
                    <textarea
                        value={formData.serviceIssue}
                        onChange={(e) => set('serviceIssue', e.target.value)}
                        placeholder="Describe service details..."
                        rows={4}
                        className={`${input(errors.serviceIssue)} resize-none`}
                    />
                    {errors.serviceIssue && <p className="text-[10px] text-red-500 font-bold">{errors.serviceIssue}</p>}
                </div>
                {isMechanicalWork ? (
                    <div className="space-y-1.5 max-w-sm">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Time duration (days)
                        </label>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={formData.mechanicalDurationDays}
                            onChange={(e) => set('mechanicalDurationDays', e.target.value)}
                            placeholder="e.g. 3"
                            className={input(errors.mechanicalDurationDays)}
                        />
                        {errors.mechanicalDurationDays ? <p className="text-[10px] text-red-500 font-bold">{errors.mechanicalDurationDays}</p> : null}
                    </div>
                ) : null}

                <div className="space-y-3 order-last">
                    {requiresThreeQuotations ? (
                        <>
                            {!isHrApprovalStep ? (
                                <>
                                    {embedMode && selectedQuotation ? (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                Approved quotation
                                            </label>
                                            <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2.5 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-700">{selectedQuotation.label}</p>
                                                    {selectedQuotation.name ? (
                                                        <p className="text-[11px] text-slate-600 truncate max-w-[280px]">{selectedQuotation.name}</p>
                                                    ) : null}
                                                </div>
                                                {selectedQuotation.url ? (
                                                    <a
                                                        href={selectedQuotation.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 shrink-0 text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline"
                                                    >
                                                        <ExternalLink size={14} />
                                                        Open
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-400">No file</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Paperclip size={11} /> Quotations
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                    {(isTireChange || isMechanicalWork || isBodyWork)
                                                        ? 'Upload supplier quotations (3 files). Quotation 1 is required; Quotation 2 and 3 are optional.'
                                                        : 'Upload three separate quotation files. Quotation 1 is required; Quotation 2 and 3 are optional.'}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {[
                                                    {
                                                        key: 'q1',
                                                        label: (isTireChange || isMechanicalWork || isBodyWork) ? 'Supplier quotation 1' : 'Quotation 1',
                                                        required: true,
                                                        kind: 'attachment',
                                                        existingUrl: formData.existingAttachmentUrl,
                                                        fileName: formData.attachmentName,
                                                        remarkName: formData.remarkAttachmentName,
                                                    },
                                                    {
                                                        key: 'q2',
                                                        label: (isTireChange || isMechanicalWork || isBodyWork) ? 'Supplier quotation 2' : 'Quotation 2',
                                                        required: false,
                                                        kind: 'quotation2',
                                                        existingUrl: formData.existingQuotation2Url,
                                                        fileName: formData.quotation2Name,
                                                        remarkName: formData.quotation2Name,
                                                    },
                                                    {
                                                        key: 'q3',
                                                        label: (isTireChange || isMechanicalWork || isBodyWork) ? 'Supplier quotation 3' : 'Quotation 3',
                                                        required: false,
                                                        kind: 'quotation3',
                                                        existingUrl: formData.existingQuotation3Url,
                                                        fileName: formData.quotation3Name,
                                                        remarkName: formData.quotation3Name,
                                                    },
                                                ].map((slot) => (
                                                    <div key={slot.key} className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                            {slot.label}
                                                            {slot.required ? <span className="text-red-500"> *</span> : null}
                                                        </label>
                                                        {slot.existingUrl ? (
                                                            <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 mb-1 flex flex-wrap items-center justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-bold text-teal-900">File on record</p>
                                                                    {slot.remarkName ? (
                                                                        <p className="text-[10px] text-teal-800/80 truncate max-w-[200px]">{slot.remarkName}</p>
                                                                    ) : null}
                                                                </div>
                                                                <a
                                                                    href={slot.existingUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 shrink-0 text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline"
                                                                >
                                                                    <ExternalLink size={14} />
                                                                    Open
                                                                </a>
                                                            </div>
                                                        ) : null}
                                                        <div
                                                            className={`relative flex items-center justify-center w-full h-28 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${(formData.amountMode === 'warranty' && allowWarranty)
                                                                ? 'border-slate-200 bg-slate-100 opacity-60'
                                                                : slot.fileName
                                                                    ? 'border-teal-300 bg-teal-50/30'
                                                                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}
                                                        >
                                                            <input
                                                                type="file"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                onChange={(e) => handleFileChange(e, slot.kind)}
                                                                accept=".pdf,application/pdf"
                                                                disabled={formData.amountMode === 'warranty' && allowWarranty}
                                                            />
                                                            <div className="text-center pointer-events-none px-2">
                                                                {slot.fileName ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <FileText className="text-[#00B5AD]" size={22} />
                                                                        <p className="text-[10px] font-black text-gray-700 max-w-[160px] truncate mt-1">{slot.fileName}</p>
                                                                        <p className="text-[9px] text-[#00B5AD] font-bold uppercase tracking-widest">Change</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-1.5">
                                                                        <Paperclip size={18} className="text-gray-300" />
                                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {showQuotationAmounts ? (
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                    Amount ({slot.label})
                                                                    {(formData.amountMode !== 'warranty' &&
                                                                        (slot.key === 'q1' || (slot.key === 'q2' && (formData.quotation2Name || formData.existingQuotation2Url)) || (slot.key === 'q3' && (formData.quotation3Name || formData.existingQuotation3Url))))
                                                                        ? <span className="text-red-500"> *</span>
                                                                        : null}
                                                                </label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">AED</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={
                                                                            slot.key === 'q1'
                                                                                ? formData.quotation1Amount
                                                                                : slot.key === 'q2'
                                                                                    ? formData.quotation2Amount
                                                                                    : formData.quotation3Amount
                                                                        }
                                                                        onChange={(e) => {
                                                                            if (slot.key === 'q1') set('quotation1Amount', e.target.value);
                                                                            else if (slot.key === 'q2') set('quotation2Amount', e.target.value);
                                                                            else set('quotation3Amount', e.target.value);
                                                                        }}
                                                                        placeholder={formData.amountMode === 'warranty' ? 'Covered by warranty' : '0.00'}
                                                                        disabled={formData.amountMode === 'warranty'}
                                                                        className={`${input(
                                                                            slot.key === 'q1'
                                                                                ? errors.quotation1Amount
                                                                                : slot.key === 'q2'
                                                                                    ? errors.quotation2Amount
                                                                                    : errors.quotation3Amount
                                                                        )} pl-12 ${formData.amountMode === 'warranty' ? 'opacity-60' : ''}`}
                                                                    />
                                                                </div>
                                                                {slot.key === 'q1' && errors.quotation1Amount ? <p className="text-[10px] text-red-500 font-bold">{errors.quotation1Amount}</p> : null}
                                                                {slot.key === 'q2' && errors.quotation2Amount ? <p className="text-[10px] text-red-500 font-bold">{errors.quotation2Amount}</p> : null}
                                                                {slot.key === 'q3' && errors.quotation3Amount ? <p className="text-[10px] text-red-500 font-bold">{errors.quotation3Amount}</p> : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                            {errors.attachment && <p className="text-[10px] text-red-500 font-bold">{errors.attachment}</p>}
                                        </>
                                    )}
                                </>
                            ) : null}

                            {isHrApprovalStep ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            Select approved quotation {availableQuotations.length > 1 ? <span className="text-red-500">*</span> : null}
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {availableQuotations.map((q) => {
                                                const active = formData.approvedQuotationChoice === q.key;
                                                return (
                                                    <div key={q.key} className={`rounded-xl border p-3 ${active ? 'border-teal-400 bg-teal-50/50' : 'border-slate-200 bg-white'}`}>
                                                        <p className="text-xs font-black text-slate-700">{q.label}</p>
                                                        {q.name ? <p className="text-[10px] text-slate-500 truncate mt-1">{q.name}</p> : null}
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => set('approvedQuotationChoice', q.key)}
                                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                                            >
                                                                {active ? 'Selected' : 'Select'}
                                                            </button>
                                                            {q.url ? (
                                                                <a
                                                                    href={q.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[11px] font-semibold text-teal-700 hover:underline"
                                                                >
                                                                    Open
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {errors.approvedQuotationChoice && (
                                            <p className="text-[10px] text-red-500 font-bold">{errors.approvedQuotationChoice}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            Vendor <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.vendorName || ''}
                                            onChange={(e) => set('vendorName', e.target.value)}
                                            className={input(errors.vendorName)}
                                        >
                                            <option value="">Select vendor...</option>
                                            {vendorOptions.map((v) => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                        {errors.vendorName && (
                                            <p className="text-[10px] text-red-500 font-bold">{errors.vendorName}</p>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {embedMode && !isHrApprovalStep && requiresThreeQuotations && (formData.vendorName || formData.approvedQuotationChoice) ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approved quotation</p>
                                        <p className="text-sm font-semibold text-slate-800 mt-1">
                                            {formData.approvedQuotationChoice === 'q1'
                                                ? 'Quotation 1'
                                                : formData.approvedQuotationChoice === 'q2'
                                                    ? 'Quotation 2'
                                                    : formData.approvedQuotationChoice === 'q3'
                                                        ? 'Quotation 3'
                                                        : '—'}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</p>
                                        <p className="text-sm font-semibold text-slate-800 mt-1">{formData.vendorName || '—'}</p>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Paperclip size={11} /> {isTireChange ? 'Upload tire condition' : 'Attachment'}
                                {usesSingleMandatoryAttachment ? <span className="text-red-500"> *</span> : null}
                            </label>
                            {usesSingleMandatoryAttachment ? (
                                <p className="text-[11px] text-gray-500">
                                    One file is required. You may combine two quotations in a single PDF if needed.
                                </p>
                            ) : null}
                            {formData.existingAttachmentUrl ? (
                                <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 mb-1 flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold text-teal-900">File on this request</p>
                                        {formData.remarkAttachmentName ? (
                                            <p className="text-[10px] text-teal-800/80 truncate max-w-[240px]">{formData.remarkAttachmentName}</p>
                                        ) : null}
                                    </div>
                                    <a
                                        href={formData.existingAttachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 shrink-0 text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline"
                                    >
                                        <ExternalLink size={14} />
                                        Open
                                    </a>
                                </div>
                            ) : null}
                            <div className={`relative flex items-center justify-center w-full h-32 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${(formData.amountMode === 'warranty' && allowWarranty)
                                ? 'border-slate-200 bg-slate-100 opacity-60'
                                : formData.attachmentName
                                    ? 'border-teal-300 bg-teal-50/30'
                                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}>
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => handleFileChange(e, 'attachment')}
                                    accept=".pdf,application/pdf"
                                    disabled={formData.amountMode === 'warranty' && allowWarranty}
                                />
                                <div className="text-center pointer-events-none">
                                    {formData.attachmentName ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <FileText className="text-[#00B5AD]" size={26} />
                                            <p className="text-xs font-black text-gray-700 max-w-[300px] truncate mt-1">{formData.attachmentName}</p>
                                            <p className="text-[10px] text-[#00B5AD] font-bold uppercase tracking-widest">Click to change</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-gray-300 shadow-sm border border-gray-100">
                                                <Paperclip size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Upload attachment</p>
                                                <p className="text-[10px] text-gray-300 text-center mt-0.5">PDF, JPG, PNG</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {errors.attachment && <p className="text-[10px] text-red-500 font-bold">{errors.attachment}</p>}
                        </div>
                    )}
                </div>
                </>
                )}

                {isAdminApprovalStep ? (
                    <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-900">
                            Admin — in-shop service window
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Calendar size={11} /> Service date
                                </label>
                                <DatePicker
                                    value={formData.adminScheduledServiceDate}
                                    onChange={(v) => set('adminScheduledServiceDate', v || '')}
                                    placeholder="Planned first day in service"
                                    className={input(errors.adminScheduledServiceDate)}
                                />
                                {errors.adminScheduledServiceDate ? (
                                    <p className="text-[10px] text-red-500 font-bold">{errors.adminScheduledServiceDate}</p>
                                ) : null}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Duration (calendar days)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={formData.adminServiceDurationDays}
                                    onChange={(e) => set('adminServiceDurationDays', e.target.value)}
                                    placeholder="e.g. 7"
                                    className={input(errors.adminServiceDurationDays)}
                                />
                                {errors.adminServiceDurationDays ? (
                                    <p className="text-[10px] text-red-500 font-bold">{errors.adminServiceDurationDays}</p>
                                ) : null}
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-600">
                            Service date and duration are mandatory to Accept.
                        </p>
                    </div>
                ) : null}

                {!hideFormFooter && (
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 order-last">
                        <button
                            type="button"
                            onClick={saveServiceDraft}
                            disabled={loading}
                            className="px-7 py-2.5 text-slate-700 hover:bg-slate-100 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border border-slate-200 bg-white"
                        >
                            Save draft
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-7 py-2.5 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-10 py-2.5 rounded-2xl bg-[#00B5AD] hover:bg-[#00928C] text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2.5 shadow-lg shadow-teal-100 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            Create request
                        </button>
                    </div>
                )}
            </form>
        </>
    );

    const bodyWorkLightbox =
        bodyWorkLightboxSrc ? (
            <div
                className="fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-8 bg-black/80"
                onClick={() => setBodyWorkLightboxSrc(null)}
                role="presentation"
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setBodyWorkLightboxSrc(null);
                    }}
                    className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="Close image preview"
                >
                    <X size={22} />
                </button>
                <img
                    src={bodyWorkLightboxSrc}
                    alt=""
                    className="max-h-[min(90vh,900px)] max-w-full w-auto object-contain rounded-lg shadow-2xl select-none"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        ) : null;

    const attachmentPreviewModal = previewAttachmentUrl ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 bg-black/65">
            <div className="w-full max-w-5xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900">Attachment Preview</h4>
                    <button
                        type="button"
                        onClick={() => setPreviewAttachmentUrl('')}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="h-[70vh] bg-slate-50">
                    {/(\.png|\.jpe?g|\.webp|\.gif)(\?|$)/i.test(previewAttachmentUrl) ? (
                        <img src={previewAttachmentUrl} alt="Attachment preview" className="w-full h-full object-contain" />
                    ) : (
                        <iframe src={previewAttachmentUrl} title="Attachment preview" className="w-full h-full border-0" />
                    )}
                </div>
            </div>
        </div>
    ) : null;

    const previousServicesModal = showPreviousServicesModal ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/55">
            <div className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-base font-semibold text-slate-900">Previous Services</h3>
                    <button
                        type="button"
                        onClick={() => setShowPreviousServicesModal(false)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[65vh] overflow-y-auto p-4">
                    {loadingPreviousServices ? (
                        <p className="text-sm text-slate-500">Loading previous services...</p>
                    ) : previousServicesError ? (
                        <p className="text-sm text-red-500">{previousServicesError}</p>
                    ) : previousServices.length === 0 ? (
                        <p className="text-sm text-slate-500">No previous services found.</p>
                    ) : (
                        <div className="space-y-3">
                            {previousServices.map((service, idx) => (
                                <div key={service?._id || idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm items-start">
                                        <div>
                                            <p className="text-xs text-slate-500">Service Type</p>
                                            <p className="font-medium text-slate-900">{service?.serviceType || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Service Date</p>
                                            <p className="font-medium text-slate-900">{formatServiceDate(service?.date)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Amount</p>
                                            <p className="font-medium text-slate-900">
                                                {service?.value != null && service?.value !== '' ? `${Number(service.value).toLocaleString()} AED` : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Attachment</p>
                                            {service?.attachment ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewAttachmentUrl(service.attachment)}
                                                    className="text-teal-700 font-medium hover:underline"
                                                >
                                                    Open
                                                </button>
                                            ) : (
                                                <p className="font-medium text-slate-900">—</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Details</p>
                                            <p className="text-sm text-slate-700 truncate">{getServiceDetailsSummary(service)}</p>
                                        </div>
                                        <div className="flex items-end md:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => openServiceDetailsPage(service)}
                                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                                            >
                                                Go to service page
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    if (embedMode) {
        return (
            <>
                <div className="w-full min-w-0">{formInner}</div>
                {bodyWorkLightbox}
                {previousServicesModal}
                {attachmentPreviewModal}
            </>
        );
    }

    return (
        <>
            <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    {formInner}
                </div>
            </div>
            {bodyWorkLightbox}
            {previousServicesModal}
            {attachmentPreviewModal}
        </>
    );
});

export default VehicleServiceModal;
