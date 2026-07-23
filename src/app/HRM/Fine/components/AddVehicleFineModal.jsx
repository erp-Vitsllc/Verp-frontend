'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, Trash2, Plus } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import Select from 'react-select';
import {
    validateVehicleFine,
    VEHICLE_FINE_ALLOWED_MIME,
    VEHICLE_FINE_IMAGE_MIME,
    VEHICLE_FINE_LIMITS,
    getVehicleFinePayableTotal,
    getVehicleFineServiceSharePerParty,
    toVehicleFinePartyBaseAmount,
    toVehicleFinePartyPayableAmount,
} from '@/app/HRM/Fine/utils/validateVehicleFine';
import ApprovedFineScheduleEditShell from './ApprovedFineScheduleEditShell';
import { submitApprovedFineScheduleEdit } from '../utils/fineApprovedEdit';
import { validateApprovedFineScheduleEdit } from '../utils/validateFineDeductionVsVisa';
import ZohoVendorSelect from '@/components/ZohoVendorSelect';

export default function AddVehicleFineModal({
    isOpen,
    onClose,
    onSuccess,
    employees = [],
    vehicles = [],
    onBack,
    initialData,
    isResubmitting = false,
    scheduleOnlyEdit = false,
    fineCategory = 'Violation',
    fineTypeName = 'Vehicle Fine',
    allowMultipleImages = false,
}) {
    const { toast } = useToast();
    // Vehicles are now passed via props
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        fineAmount: '',
        responsibleFor: 'Employee',
        employeeAmount: '',
        companyAmount: '',
        payableDuration: '1',
        monthStart: new Date().toISOString().split('T')[0].slice(0, 7), // YYYY-MM
        description: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: '',
        companyDescription: '',
        serviceCharge: '',
        fineSource: '',
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [fleetVehicles, setFleetVehicles] = useState([]);
    const [imageAttachments, setImageAttachments] = useState([]);
    const [existingImages, setExistingImages] = useState([]);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);

    const vehicleOptions = vehicles.length > 0 ? vehicles : fleetVehicles;


    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            setSelectedVehicleId(initialData.vehicleId || '');

            // Handle array of assigned employees (even if size 1) or flat field
            const empId = initialData.assignedEmployees?.[0]?.employeeId || initialData.employeeId || '';
            setSelectedEmployeeId(empId);

            const isBoth = (initialData.responsibleFor || 'Employee') === 'Employee & Company';
            const sc = parseFloat(initialData.serviceCharge || 0) || 0;
            const grandTotal = parseFloat(initialData.totalFineAmount || initialData.fineAmount || 0) || 0;
            const empStored = parseFloat(initialData.employeeAmount || 0) || 0;
            const compStored = parseFloat(initialData.companyAmount || 0) || 0;
            const partsBase = empStored + compStored;
            const baseFineAmount =
                partsBase > 0.001 ? partsBase : Math.max(0, grandTotal - sc);

            // Prefer top-level companyAmount; else recover from company party row
            const companyParty = (initialData.assignedEmployees || []).find(
                (e) => e?.employeeId === 'VEGA-HR-0000',
            );
            let storedEmpBase =
                initialData.employeeAmount !== undefined &&
                initialData.employeeAmount !== null &&
                initialData.employeeAmount !== ''
                    ? parseFloat(initialData.employeeAmount)
                    : NaN;
            let storedCompBase =
                initialData.companyAmount !== undefined &&
                initialData.companyAmount !== null &&
                initialData.companyAmount !== ''
                    ? parseFloat(initialData.companyAmount)
                    : NaN;
            if ((!Number.isFinite(storedCompBase) || storedCompBase < 0.01) && companyParty) {
                const partyBase = parseFloat(companyParty.employeeAmount);
                const partyPayable = parseFloat(companyParty.individualAmount ?? companyParty.fineAmount);
                if (Number.isFinite(partyBase) && partyBase > 0) storedCompBase = partyBase;
                else if (Number.isFinite(partyPayable) && partyPayable > 0) {
                    storedCompBase = Math.max(0, partyPayable - sc / 2);
                }
            }
            if (!Number.isFinite(storedEmpBase) || storedEmpBase < 0) {
                storedEmpBase = Math.max(0, baseFineAmount - (Number.isFinite(storedCompBase) ? storedCompBase : 0));
            }
            if (!Number.isFinite(storedCompBase) || storedCompBase < 0) {
                storedCompBase = Math.max(0, baseFineAmount - storedEmpBase);
            }
            
            let uiEmployeeAmount = String(initialData.employeeAmount ?? '');
            let uiCompanyAmount = String(initialData.companyAmount ?? '');
            
            if (isBoth) {
                uiEmployeeAmount = String(toVehicleFinePartyPayableAmount(storedEmpBase, sc));
                uiCompanyAmount = String(toVehicleFinePartyPayableAmount(storedCompBase, sc));
            }

            setFormData({
                fineAmount: String(baseFineAmount || ''),
                responsibleFor: initialData.responsibleFor || 'Employee',
                employeeAmount: uiEmployeeAmount,
                companyAmount: uiCompanyAmount,
                payableDuration: String(initialData.payableDuration || '1'),
                monthStart: initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7),
                description: initialData.description || '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: initialData.attachment?.name || '',
                attachmentMime: '',
                companyDescription: initialData.companyDescription || '',
                serviceCharge: String(initialData.serviceCharge || ''),
                fineSource: initialData.fineSource || '',
            });

            const savedImages = [];
            if (Array.isArray(initialData.attachments) && initialData.attachments.length > 0) {
                initialData.attachments.forEach((att, index) => {
                    if (att?.url) {
                        savedImages.push({
                            id: `existing-${index}`,
                            name: att.name || `Image ${index + 1}`,
                            url: att.url,
                            publicId: att.publicId || '',
                            existing: true,
                        });
                    }
                });
            } else if (initialData.attachment?.url) {
                savedImages.push({
                    id: 'existing-0',
                    name: initialData.attachment.name || 'Image 1',
                    url: initialData.attachment.url || '',
                    existing: true,
                });
            }
            setExistingImages(savedImages);
            setImageAttachments([]);

        } else if (isOpen) {
            // Reset if opening in create mode
            setSelectedVehicleId('');
            setSelectedEmployeeId('');
            setFormData({
                fineAmount: '',
                responsibleFor: 'Employee',
                employeeAmount: '',
                companyAmount: '',
                payableDuration: '1',
                monthStart: new Date().toISOString().split('T')[0].slice(0, 7),
                description: '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: '',
                attachmentMime: '',
                companyDescription: '',
                serviceCharge: '',
                fineSource: '',
            });
            setExistingImages([]);
            setImageAttachments([]);

        }
    }, [isOpen, initialData, employees]);

    useEffect(() => {
        const fetchFleetVehicles = async () => {
            try {
                const response = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard', {
                    skipToast: true,
                });
                const list = response?.data?.vehicles || response?.data?.data?.vehicles || [];
                setFleetVehicles(Array.isArray(list) ? list : []);
            } catch (error) {
                console.error('Error fetching fleet vehicles:', error);
                setFleetVehicles([]);
            }
        };
        if (isOpen && vehicles.length === 0) {
            void fetchFleetVehicles();
        }
    }, [isOpen, vehicles.length]);

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await axiosInstance.get('/Company');
                const data = response.data.companies || (Array.isArray(response.data) ? response.data : []);
                setCompanies(data);
                if (initialData?.company) {
                    setSelectedCompanyId(initialData.company._id || initialData.company);
                }
            } catch (error) {
                console.error("Error fetching companies:", error);
            }
        };
        if (isOpen) fetchCompanies();
    }, [isOpen, initialData]);

    const updateFineAmountAndPortions = (newFineAmount, nextState = {}) => {
        setFormData(prev => {
            const currentResponsible = nextState.responsibleFor || prev.responsibleFor;
            const fineAmount = newFineAmount !== undefined ? newFineAmount : prev.fineAmount;
            const serviceCharge =
                nextState.serviceCharge !== undefined ? nextState.serviceCharge : prev.serviceCharge;
            const splitTotal = getVehicleFinePayableTotal(fineAmount, serviceCharge);

            if (currentResponsible === 'Employee & Company') {
                const half = splitTotal / 2;
                return {
                    ...prev,
                    ...nextState,
                    fineAmount,
                    serviceCharge,
                    employeeAmount: String(half),
                    companyAmount: String(splitTotal - half),
                };
            }
            return {
                ...prev,
                ...nextState,
                fineAmount,
                serviceCharge,
            };
        });
    };

    const handleEmployeeAmountChange = (val) => {
        const splitTotal = getVehicleFinePayableTotal(formData.fineAmount, formData.serviceCharge);

        const numVal = parseFloat(val) || 0;
        let finalEmp = numVal;
        if (finalEmp > splitTotal) {
            finalEmp = splitTotal;
        }
        if (finalEmp < 0) {
            finalEmp = 0;
        }

        const finalComp = Math.max(0, splitTotal - finalEmp);

        setFormData(prev => ({
            ...prev,
            employeeAmount: val === '' ? '' : String(finalEmp),
            companyAmount: String(finalComp)
        }));
    };

    const handleCompanyAmountChange = (val) => {
        const splitTotal = getVehicleFinePayableTotal(formData.fineAmount, formData.serviceCharge);

        const numVal = parseFloat(val) || 0;
        let finalComp = numVal;
        if (finalComp > splitTotal) {
            finalComp = splitTotal;
        }
        if (finalComp < 0) {
            finalComp = 0;
        }

        const finalEmp = Math.max(0, splitTotal - finalComp);

        setFormData(prev => ({
            ...prev,
            companyAmount: val === '' ? '' : String(finalComp),
            employeeAmount: String(finalEmp)
        }));
    };

    // Show all employees
    const filteredEmployees = useMemo(() => {
        if (!searchQuery) return employees;
        return employees.filter(e => 
            (e.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (e.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (e.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [employees, searchQuery]);

    // Auto-fill employee name when employee is selected
    useEffect(() => {
        if (selectedEmployeeId) {
            const emp = employees.find(e => e.employeeId === selectedEmployeeId);
            if (emp) {
                setEmployeeName(`${emp.firstName} ${emp.lastName}`);
            }
        } else {
            setEmployeeName('');
        }
    }, [selectedEmployeeId, employees]);

    if (!isOpen) return null;

    const hasExistingAttachment = Boolean(
        formData.attachmentBase64 ||
        initialData?.attachment?.url ||
        (initialData?.attachment?.name && initialData?._id) ||
        existingImages.length > 0
    );

    const modalTitle = isResubmitting
        ? `Resubmit ${fineTypeName}`
        : initialData?._id
          ? scheduleOnlyEdit
            ? 'Edit Deduction Schedule'
            : `Edit ${fineTypeName}`
          : `Add ${fineTypeName}`;

    const validationMode =
        isResubmitting || (initialData?.fineStatus && initialData.fineStatus !== 'Draft')
            ? 'strict'
            : 'draft';

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!VEHICLE_FINE_ALLOWED_MIME.includes(file.type)) {
            toast({
                variant: 'destructive',
                title: 'Invalid file type',
                description: 'Only PDF, JPG, and PNG files are allowed.',
            });
            if (e.target) e.target.value = '';
            return;
        }
        if (file.size > VEHICLE_FINE_LIMITS.maxAttachmentBytes) {
            toast({
                variant: 'destructive',
                title: 'File too large',
                description: 'Attachment must be 5 MB or less.',
            });
            if (e.target) e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({
                ...prev,
                attachment: file,
                attachmentBase64: base64,
                attachmentName: file.name,
                attachmentMime: file.type || 'application/pdf',
            }));
            setErrors((prev) => ({ ...prev, attachment: '' }));
        };
        reader.readAsDataURL(file);
    };

    const handleMultipleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const allowedMime = VEHICLE_FINE_IMAGE_MIME;
        const maxCount = VEHICLE_FINE_LIMITS.maxImageAttachments;
        const currentCount = imageAttachments.length + existingImages.length;

        if (currentCount >= maxCount) {
            toast({
                variant: 'destructive',
                title: 'Image limit reached',
                description: `You can upload up to ${maxCount} images.`,
            });
            if (e.target) e.target.value = '';
            return;
        }

        const remainingSlots = maxCount - currentCount;
        const selectedFiles = files.slice(0, remainingSlots);
        const rejectedTypes = [];
        const rejectedSizes = [];

        selectedFiles.forEach((file) => {
            if (!allowedMime.includes(file.type)) {
                rejectedTypes.push(file.name);
                return;
            }
            if (file.size > VEHICLE_FINE_LIMITS.maxAttachmentBytes) {
                rejectedSizes.push(file.name);
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                const previewUrl = reader.result;
                setImageAttachments((prev) => [
                    ...prev,
                    {
                        id: `${Date.now()}-${file.name}`,
                        file,
                        name: file.name,
                        mime: file.type || 'image/jpeg',
                        base64,
                        previewUrl,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });

        if (rejectedTypes.length) {
            toast({
                variant: 'destructive',
                title: 'Invalid file type',
                description: 'Only JPG and PNG images are allowed.',
            });
        }
        if (rejectedSizes.length) {
            toast({
                variant: 'destructive',
                title: 'File too large',
                description: 'Each image must be 5 MB or less.',
            });
        }

        setErrors((prev) => ({ ...prev, attachment: '' }));
        if (e.target) e.target.value = '';
    };

    const removeImageAttachment = (id) => {
        setImageAttachments((prev) => prev.filter((item) => item.id !== id));
    };

    const removeExistingImage = (id) => {
        setExistingImages((prev) => prev.filter((item) => item.id !== id));
    };

    const scrollToFieldError = (errs) => {
        const firstKey = Object.keys(errs || {})[0];
        if (!firstKey) return;
        requestAnimationFrame(() => {
            document
                .querySelector(`[data-field-error="${firstKey}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    };

    const applyFieldErrorsFromApi = (apiErrors) => {
        if (!apiErrors || typeof apiErrors !== 'object') return false;
        const next = Object.fromEntries(
            Object.entries(apiErrors).filter(([, msg]) => typeof msg === 'string' && msg.trim()),
        );
        if (Object.keys(next).length === 0) return false;
        setErrors((prev) => ({ ...prev, ...next }));
        scrollToFieldError(next);
        return true;
    };

    const validateForm = () => {
        const selectedEmp = employees.find((e) => e.employeeId === selectedEmployeeId);
        const { valid, errors: nextErrors } = validateVehicleFine(
            {
                vehicleId: selectedVehicleId,
                employeeId: selectedEmployeeId,
                fineAmount: formData.fineAmount,
                serviceCharge: formData.serviceCharge,
                responsibleFor: formData.responsibleFor,
                employeeAmount: formData.employeeAmount,
                companyAmount: formData.companyAmount,
                description: formData.description,
                companyDescription: formData.companyDescription,
                companyId: selectedCompanyId,
                payableDuration: formData.payableDuration,
                monthStart: formData.monthStart,
                attachmentBase64: formData.attachmentBase64,
                attachmentImages: imageAttachments,
            },
            {
                mode: validationMode,
                employeeIds: employees.map((e) => String(e.employeeId || '')).filter(Boolean),
                hasExistingAttachment,
                allowMultipleImages,
                existingImageCount: existingImages.length,
                employee: selectedEmp,
                employeeLabel: employeeName || selectedEmployeeId,
            }
        );
        setErrors(nextErrors);
        if (!valid) scrollToFieldError(nextErrors);
        return valid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (scheduleOnlyEdit && initialData?._id) {
            const visaErrors = validateApprovedFineScheduleEdit({
                monthStart: formData.monthStart,
                payableDuration: formData.payableDuration,
                initialData,
                employees,
            });
            if (visaErrors) {
                setErrors(visaErrors);
                toast({
                    variant: 'destructive',
                    title: 'Invalid deduction schedule',
                    description: visaErrors.deductionSchedule || visaErrors.monthStart,
                });
                return;
            }
            await submitApprovedFineScheduleEdit({
                axiosInstance,
                fineId: initialData._id,
                monthStart: formData.monthStart,
                payableDuration: formData.payableDuration,
                toast,
                onSuccess,
                onClose,
                setSubmitting,
            });
            return;
        }

        if (!validateForm()) return;

        try {
            setSubmitting(true);
            let commonCompanyId = selectedCompanyId;
            if (!commonCompanyId) {
                const selectedEmp = employees.find(e => e.employeeId === selectedEmployeeId);
                commonCompanyId = selectedEmp?.company?._id || selectedEmp?.company;
            }

            const serviceChargeAmount = parseFloat(formData.serviceCharge || 0) || 0;
            const baseFineAmount = parseFloat(formData.fineAmount || 0) || 0;
            const grandTotalFine = baseFineAmount + serviceChargeAmount;

            const totalPartiesCount = (formData.responsibleFor === 'Employee & Company') ? 2 : 1;

            const employeesList = [];
            if (formData.responsibleFor !== 'Company') {
                const empPayable =
                    formData.responsibleFor === 'Employee'
                        ? grandTotalFine
                        : parseFloat(formData.employeeAmount || 0);
                const empBase =
                    formData.responsibleFor === 'Employee'
                        ? baseFineAmount
                        : toVehicleFinePartyBaseAmount(empPayable, serviceChargeAmount, totalPartiesCount);
                employeesList.push({
                    employeeId: selectedEmployeeId,
                    employeeName: employeeName,
                    employeeAmount: empBase.toFixed(2),
                    individualAmount: empPayable.toFixed(2),
                    fineAmount: empPayable.toFixed(2),
                    daysWorked: 0
                });
            }
            if (formData.responsibleFor === 'Employee & Company' || formData.responsibleFor === 'Company') {
                const compPayable =
                    formData.responsibleFor === 'Company'
                        ? grandTotalFine
                        : parseFloat(formData.companyAmount || 0);
                const compBase =
                    formData.responsibleFor === 'Company'
                        ? baseFineAmount
                        : toVehicleFinePartyBaseAmount(compPayable, serviceChargeAmount, totalPartiesCount);
                employeesList.push({
                    employeeId: 'VEGA-HR-0000',
                    employeeName: 'Vega Digital IT Solutions',
                    employeeAmount: compBase.toFixed(2),
                    individualAmount: compPayable.toFixed(2),
                    fineAmount: compPayable.toFixed(2),
                    daysWorked: 0
                });
            }

            const selectedVehicle = (vehicleOptions || []).find(
                (v) => String(v?._id || v?.id || '') === String(selectedVehicleId || '')
            );
            const payload = {
                isBulk: true,
                company: commonCompanyId,
                employees: employeesList,
                category: fineCategory,
                subCategory: fineTypeName,
                fineType: fineTypeName,
                // Payload fineAmount should be the TOTAL
                fineAmount: grandTotalFine,
                responsibleFor: formData.responsibleFor,
                employeeAmount:
                    formData.responsibleFor === 'Company'
                        ? 0
                        : formData.responsibleFor === 'Employee'
                          ? baseFineAmount
                          : toVehicleFinePartyBaseAmount(
                                parseFloat(formData.employeeAmount || 0),
                                serviceChargeAmount,
                                totalPartiesCount,
                            ),
                companyAmount:
                    formData.responsibleFor === 'Employee'
                        ? 0
                        : formData.responsibleFor === 'Company'
                          ? baseFineAmount
                          : toVehicleFinePartyBaseAmount(
                                parseFloat(formData.companyAmount || 0),
                                serviceChargeAmount,
                                totalPartiesCount,
                            ),
                payableDuration: parseInt(formData.payableDuration),
                monthStart: formData.monthStart,
                serviceCharge: serviceChargeAmount,
                vehicleId: selectedVehicleId,
                assetId:
                    selectedVehicle?.assetId ||
                    initialData?.assetId ||
                    '',
                description: formData.description,
                companyDescription: formData.companyDescription,
                fineSource: formData.fineSource || '',
                handoverHrApproval: initialData?.handoverApprovalFine === true,
                handoverApprovalContext: initialData?.handoverApprovalContext || null,
                fineStatus: isResubmitting
                    ? 'Pending'
                    : initialData?.handoverApprovalFine
                      ? 'Approved'
                      : initialData?._id
                        ? initialData.fineStatus
                        : 'Draft'
            };

            // Ensure top-level companyAmount is never zero when company party row has a base
            if (formData.responsibleFor === 'Employee & Company') {
                const companyRow = employeesList.find((e) => e.employeeId === 'VEGA-HR-0000');
                const rowBase = parseFloat(companyRow?.employeeAmount || 0) || 0;
                if ((parseFloat(payload.companyAmount) || 0) < 0.01 && rowBase >= 0.01) {
                    payload.companyAmount = rowBase;
                }
                const empSum = employeesList
                    .filter((e) => e.employeeId !== 'VEGA-HR-0000')
                    .reduce((s, e) => s + (parseFloat(e.employeeAmount) || 0), 0);
                if ((parseFloat(payload.employeeAmount) || 0) < 0.01 && empSum >= 0.01) {
                    payload.employeeAmount = empSum;
                }
            }

            if (allowMultipleImages) {
                const newUploads = imageAttachments.map((item) => ({
                    data: item.base64,
                    name: item.name,
                    mimeType: item.mime,
                }));
                const keptExisting = existingImages
                    .filter((item) => item.url)
                    .map((item) => ({
                        url: item.url,
                        name: item.name,
                        ...(item.publicId ? { publicId: item.publicId } : {}),
                    }));
                if (newUploads.length || keptExisting.length) {
                    payload.attachments = [...keptExisting, ...newUploads];
                    payload.attachment = payload.attachments[0];
                }
            } else if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            if (initialData?._id) {
                // Update Logic
                if (isResubmitting) {
                    payload.fineStatus = 'Pending';
                    payload.resubmit = true;
                }

                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({
                    title: "Success",
                    description: isResubmitting ? "Fine resubmitted successfully" : "Fine updated successfully"
                });
            } else {
                const response = await axiosInstance.post('/Fine', payload);
                toast({
                    title: 'Success',
                    description: initialData?.handoverApprovalFine
                        ? `${fineTypeName} recorded for handover approval.`
                        : `${fineTypeName} submitted for approval`,
                });
                if (onSuccess) onSuccess(response.data);
                onClose();
                return;
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            const apiErrors = error.response?.data?.errors;
            if (applyFieldErrorsFromApi(apiErrors)) {
                // Keep error on the modal fields — do not toast on the page behind
                return;
            }
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Submission failed',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[90vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">
                            {modalTitle}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5">
                    <ApprovedFineScheduleEditShell scheduleOnlyEdit={scheduleOnlyEdit}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Vehicle Selection */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Vehicle <span className="text-red-500">*</span></label>
                            <select
                                value={selectedVehicleId}
                                onChange={(e) => {
                                    setSelectedVehicleId(e.target.value);
                                    if (errors.vehicleId) setErrors(prev => ({ ...prev, vehicleId: '' }));
                                }}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.vehicleId ? 'border-red-400' : 'border-gray-200'} bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none`}
                            >
                                <option value="">Select Vehicle</option>
                                {vehicleOptions.map(v => <option key={v._id || v.id} value={v._id || v.id}>{v.name} {v.plateNumber ? `(${v.plateNumber})` : ''}</option>)}
                            </select>
                            {errors.vehicleId && <p className="text-xs text-red-500 ml-1">{errors.vehicleId}</p>}
                        </div>

                        {/* Employee Selection */}
                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="text-sm font-medium text-gray-700">Employee <span className="text-red-500">*</span></label>
                            <Select
                                options={employees.map(emp => ({
                                    value: emp.employeeId,
                                    label: `${emp.employeeId} - ${emp.firstName} ${emp.lastName}`
                                }))}
                                value={
                                    selectedEmployeeId
                                        ? { 
                                            value: selectedEmployeeId, 
                                            label: employees.find(e => e.employeeId === selectedEmployeeId) 
                                                ? `${selectedEmployeeId} - ${employees.find(e => e.employeeId === selectedEmployeeId).firstName} ${employees.find(e => e.employeeId === selectedEmployeeId).lastName}` 
                                                : selectedEmployeeId 
                                        }
                                        : null
                                }
                                onChange={(selectedOption) => {
                                    setSelectedEmployeeId(selectedOption ? selectedOption.value : '');
                                    if (errors.employeeId) setErrors(prev => ({ ...prev, employeeId: '' }));
                                }}
                                placeholder="🔍 Select Employee..."
                                isClearable
                                isSearchable
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        minHeight: '44px',
                                        borderRadius: '0.75rem',
                                        borderColor: errors.employeeId ? '#f87171' : '#e5e7eb',
                                        backgroundColor: '#f9fafb',
                                        boxShadow: 'none',
                                        '&:hover': { borderColor: '#cbd5e1' }
                                    }),
                                    menu: (base) => ({ ...base, zIndex: 50 })
                                }}
                            />
                            {errors.employeeId && <p className="text-xs text-red-500 ml-1">{errors.employeeId}</p>}
                        </div>

                        {/* Employee Name Auto-fill */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Employee Name</label>
                            <input
                                type="text"
                                value={employeeName}
                                readOnly
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
                            />
                        </div>

                        {/* Deduction Amount */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={formData.fineAmount}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    updateFineAmountAndPortions(val);
                                    if (errors.fineAmount) setErrors(prev => ({ ...prev, fineAmount: '' }));
                                }}
                                placeholder="0.00"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.fineAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20`}
                            />
                            {errors.fineAmount && <p className="text-xs text-red-500 ml-1">{errors.fineAmount}</p>}
                        </div>

                        {/* Service Charge */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Service Charge</label>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={formData.serviceCharge}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    updateFineAmountAndPortions(formData.fineAmount, { serviceCharge: val });
                                    if (errors.serviceCharge) setErrors(prev => ({ ...prev, serviceCharge: '' }));
                                }}
                                placeholder="0.00"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.serviceCharge ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20`}
                            />
                            {errors.serviceCharge ? <p className="text-xs text-red-500 ml-1">{errors.serviceCharge}</p> : null}
                        </div>

                        {/* Responsible For */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Responsible For</label>
                            <select
                                value={formData.responsibleFor}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => {
                                        const baseFine = parseFloat(prev.fineAmount || 0) || 0;
                                        const serviceCharge = parseFloat(prev.serviceCharge || 0) || 0;
                                        const splitTotal = baseFine + serviceCharge;
                                        
                                        let empAmt = prev.employeeAmount;
                                        let compAmt = prev.companyAmount;
                                        
                                        if (val === 'Employee & Company') {
                                            const half = splitTotal / 2;
                                            empAmt = String(half);
                                            compAmt = String(splitTotal - half);
                                        }
                                        
                                        return {
                                            ...prev,
                                            responsibleFor: val,
                                            employeeAmount: val === 'Employee' ? '' : empAmt,
                                            companyAmount: val === 'Employee' ? '' : compAmt,
                                        };
                                    });
                                    setErrors((prev) => ({
                                        ...prev,
                                        employeeAmount: '',
                                        companyAmount: '',
                                        amountMismatch: '',
                                        company: '',
                                        companyDescription: '',
                                    }));
                                }}
                                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="Employee">Employee</option>
                                <option value="Company">Company</option>
                                <option value="Employee & Company">Employee & Company</option>
                            </select>
                        </div>

                        {/* Responsible For - Extra Fields */}
                        {formData.responsibleFor === 'Employee & Company' && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Employee Amount <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={formData.employeeAmount}
                                        onChange={(e) => {
                                            handleEmployeeAmountChange(e.target.value);
                                            if (errors.employeeAmount) setErrors(prev => ({ ...prev, employeeAmount: '' }));
                                            if (errors.amountMismatch) setErrors(prev => ({ ...prev, amountMismatch: '' }));
                                        }}
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.employeeAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.employeeAmount && <p className="text-xs text-red-500 ml-1">{errors.employeeAmount}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Company Amount <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={formData.companyAmount}
                                        onChange={(e) => {
                                            handleCompanyAmountChange(e.target.value);
                                            if (errors.companyAmount) setErrors(prev => ({ ...prev, companyAmount: '' }));
                                            if (errors.amountMismatch) setErrors(prev => ({ ...prev, amountMismatch: '' }));
                                        }}
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.companyAmount || errors.amountMismatch ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`}
                                    />
                                    {errors.companyAmount && <p className="text-xs text-red-500 ml-1">{errors.companyAmount}</p>}
                                </div>
                                {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full ml-1 font-medium bg-red-50 p-2 rounded-lg border border-red-100">{errors.amountMismatch}</p>}
                            </>
                        )}

                        {/* Fine Source */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Fine Source</label>
                            <ZohoVendorSelect
                                value={formData.fineSource}
                                onChange={(nextValue) =>
                                    setFormData((prev) => ({ ...prev, fineSource: nextValue }))
                                }
                                placeholder="Select vendor..."
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5 col-span-1 md:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, description: e.target.value }));
                                    if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                                }}
                                placeholder="Provide more details about the fine..."
                                rows={3}
                                maxLength={VEHICLE_FINE_LIMITS.maxDescriptionLength}
                                className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none`}
                            />
                            {errors.description && <p className="text-xs text-red-500 ml-1">{errors.description}</p>}
                        </div>

                        {/* Company Description - Conditional */}
                        {(formData.responsibleFor === 'Company' || formData.responsibleFor === 'Employee & Company') && (
                            <div
                                className="space-y-1.5 col-span-1 md:col-span-2"
                                data-field-error="companyDescription"
                            >
                                <label className="text-sm font-medium text-gray-700">
                                    Company Description
                                    {validationMode === 'strict' ? <span className="text-red-500"> *</span> : null}
                                </label>
                                <textarea
                                    value={formData.companyDescription}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, companyDescription: e.target.value }));
                                        if (errors.companyDescription) setErrors(prev => ({ ...prev, companyDescription: '' }));
                                    }}
                                    placeholder="Explain why the company is bearing this cost..."
                                    rows={2}
                                    maxLength={VEHICLE_FINE_LIMITS.maxCompanyDescriptionLength}
                                    className={`w-full px-4 py-3 rounded-xl border ${errors.companyDescription ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none`}
                                />
                                {errors.companyDescription ? (
                                    <p className="text-xs text-red-500 ml-1">{errors.companyDescription}</p>
                                ) : (
                                    <p className="text-[11px] text-gray-400 ml-1">
                                        Required when company pays — at least {VEHICLE_FINE_LIMITS.minCompanyDescriptionLength} characters
                                        (separate from Description above).
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Company Selection */}
                        {(formData.responsibleFor === 'Company' || formData.responsibleFor === 'Employee & Company') && (
                            <div className="space-y-1.5 col-span-1 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Select Company <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedCompanyId}
                                    onChange={(e) => {
                                        setSelectedCompanyId(e.target.value);
                                        if (errors.company) setErrors(prev => ({ ...prev, company: '' }));
                                    }}
                                    className={`w-full h-11 px-4 rounded-xl border ${errors.company ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
                                >
                                    <option value="">Select Company</option>
                                    {companies.map(comp => (
                                        <option key={comp._id} value={comp._id}>{comp.name}</option>
                                    ))}
                                </select>
                                {errors.company && <p className="text-xs text-red-500 ml-1">{errors.company}</p>}
                            </div>
                        )}

                        {/* Payable Duration */}
                        {errors.deductionSchedule ? (
                            <p className="text-xs text-red-500 md:col-span-2">{errors.deductionSchedule}</p>
                        ) : null}
                        {formData.responsibleFor !== 'Company' && (
                            <div className="space-y-1.5" data-schedule-field>
                                <label className="text-sm font-medium text-gray-700">Fine Payable Duration</label>
                                <select
                                    value={formData.payableDuration}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, payableDuration: e.target.value }));
                                        if (errors.payableDuration) setErrors(prev => ({ ...prev, payableDuration: '' }));
                                    }}
                                    className={`w-full h-11 px-4 rounded-xl border ${errors.payableDuration ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500/20`}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                                </select>
                                {errors.payableDuration ? (
                                    <p className="text-xs text-red-500 ml-1">{errors.payableDuration}</p>
                                ) : null}
                            </div>
                        )}

                        {/* Month Start */}
                        <div className="space-y-1.5" data-schedule-field>
                            <label className="text-sm font-medium text-gray-700">Payable From</label>
                            <MonthYearPicker
                                value={formData.monthStart ? `${formData.monthStart}-01` : undefined}
                                onChange={(dateStr) => {
                                    if (dateStr) {
                                        const yyyyMM = dateStr.slice(0, 7);
                                        setFormData(prev => ({ ...prev, monthStart: yyyyMM }));
                                        if (errors.monthStart) setErrors(prev => ({ ...prev, monthStart: '' }));
                                    }
                                }}
                                className={`w-full bg-gray-50 ${errors.monthStart ? 'border-red-400' : 'border-gray-200'}`}
                            />
                            {errors.monthStart ? <p className="text-xs text-red-500 ml-1">{errors.monthStart}</p> : null}
                        </div>
                    </div>

                    {/* Attachment */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            {allowMultipleImages ? 'Damage Images' : 'Attachment'}
                            <span className="text-red-500"> *</span>
                        </label>

                        {allowMultipleImages ? (
                            <>
                                <div
                                    className={`rounded-xl border bg-gray-50 p-3 ${errors.attachment ? 'border-red-400' : 'border-gray-200'}`}
                                >
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                                        {existingImages.map((item) => (
                                            <div
                                                key={item.id}
                                                className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white"
                                            >
                                                {item.url ? (
                                                    <img
                                                        src={item.url}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover"
                                                        onError={(event) => {
                                                            event.currentTarget.style.display = 'none';
                                                            const fallback = event.currentTarget.nextElementSibling;
                                                            if (fallback) fallback.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div
                                                    className={`h-full w-full items-center justify-center px-1 text-[9px] text-gray-500 text-center leading-tight ${item.url ? 'hidden' : 'flex'}`}
                                                >
                                                    {item.name}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeExistingImage(item.id)}
                                                    className="absolute right-0.5 top-0.5 rounded-full bg-white/95 p-0.5 text-red-600 shadow"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        ))}
                                        {imageAttachments.map((item) => (
                                            <div
                                                key={item.id}
                                                className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white"
                                            >
                                                <img
                                                    src={item.previewUrl}
                                                    alt={item.name}
                                                    className="h-full w-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImageAttachment(item.id)}
                                                    className="absolute right-0.5 top-0.5 rounded-full bg-white/95 p-0.5 text-red-600 shadow"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        ))}
                                        {existingImages.length + imageAttachments.length <
                                        VEHICLE_FINE_LIMITS.maxImageAttachments ? (
                                            <button
                                                type="button"
                                                onClick={() => imageInputRef.current?.click()}
                                                className="flex h-24 w-16 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-400 transition-colors hover:border-teal-400 hover:bg-teal-50/40 hover:text-teal-600"
                                            >
                                                <Plus size={20} strokeWidth={2.5} />
                                            </button>
                                        ) : null}
                                    </div>
                                    <input
                                        ref={imageInputRef}
                                        type="file"
                                        className="hidden"
                                        multiple
                                        onChange={handleMultipleImageChange}
                                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-500">
                                    JPG or PNG — max 5 MB each — up to {VEHICLE_FINE_LIMITS.maxImageAttachments} images. Scroll horizontally to see more.
                                </p>
                            </>
                        ) : (
                            <>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full p-4 rounded-xl border-2 border-dashed bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors ${errors.attachment ? 'border-red-400' : 'border-gray-200'}`}
                                >
                                    <Upload className="text-gray-400 mb-2" size={24} />
                                    <span className="text-sm text-gray-500">
                                        {formData.attachment ? formData.attachmentName : 'Click to upload supporting document'}
                                    </span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-500">PDF, JPG, or PNG — max 5 MB</p>
                            </>
                        )}
                        {errors.attachment ? <p className="text-xs text-red-500 ml-1">{errors.attachment}</p> : null}
                    </div>

                    {/* Total Summary */}
                    <div className="flex items-center justify-between p-4 bg-gray-50/80 rounded-2xl border border-gray-100 shadow-sm mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Summary</span>
                            <span className="text-xs text-gray-600 font-medium italic">
                                Total payable amount (Fine + Service Charge)
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-gray-900">
                                {getVehicleFinePayableTotal(
                                    formData.fineAmount,
                                    formData.serviceCharge,
                                ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                            <span className="text-[11px] font-bold text-gray-700 uppercase">AED</span>
                        </div>
                    </div>
                    </ApprovedFineScheduleEditShell>

                    {/* Submit Section */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : (initialData?._id ? (scheduleOnlyEdit ? 'Save Schedule' : 'Save Changes') : (isResubmitting ? 'Resubmit' : 'Save as Draft'))}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
