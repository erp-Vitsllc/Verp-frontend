'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function AddLossDamageModal({ isOpen, onClose, onSuccess, employees = [], onBack, initialData, isResubmitting = false, isAssetFlow = false, onAssetRequest = null, isInitialRequest = false, isApprovalFlow = false }) {
    const { toast } = useToast();
    const [assets, setAssets] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [selectedAssetName, setSelectedAssetName] = useState('');
    const [selectedAssetObjectId, setSelectedAssetObjectId] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [companies, setCompanies] = useState([]);

    const [accessories, setAccessories] = useState([]);
    const [selectedAccessoryId, setSelectedAccessoryId] = useState('');
    const [selectedAccessoryName, setSelectedAccessoryName] = useState('');
    const [selectedAccessoryObjectId, setSelectedAccessoryObjectId] = useState('');

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
        serviceCharge: ''
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);


    // Fetch all assigned assets on mount
    useEffect(() => {
        const fetchAssignedAssets = async () => {
            try {
                setLoadingAssets(true);
                const response = await axiosInstance.get('/AssetItem/assigned/all');
                const assetData = response.data;
                if (Array.isArray(assetData)) {
                    setAssets(assetData.map(a => ({
                        id: a.assetId,
                        _id: a._id,
                        name: a.name,
                        assetValue: a.assetValue,
                        assignedTo: a.assignedTo,
                        companyId: a.companyId || (a.company?._id || a.company),
                        accessories: a.accessories || []
                    })));
                } else setAssets([]);
            } catch (error) {
                console.error("Error fetching assigned assets:", error);
                setAssets([]);
            } finally {
                setLoadingAssets(false);
            }
        };
        fetchAssignedAssets();
    }, []);

    const filteredAssets = useMemo(() => assets, [assets]);

    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            setSelectedAssetId(initialData.assetId || '');
            setSelectedAssetName(initialData.assetName || '');

            const empId = initialData.assignedEmployees?.[0]?.employeeId || initialData.employeeId || '';
            setSelectedEmployeeId(empId);
            setEmployeeName(initialData.assignedEmployees?.[0]?.employeeName || initialData.employeeName || '');

            // Handle accessory pre-selection
            if (initialData.useAccessoryWorkflow || initialData.accessoryObjectId || initialData.isAccessoryFlow) {
                setSelectedAccessoryObjectId(initialData.accessoryObjectId || '');
                setSelectedAccessoryId(initialData.accessoryId || initialData.assetId || ''); // Use accessoryId if available
                setSelectedAccessoryName(initialData.accessoryName || initialData.assetName || '');
            }

            const existingAttachment = initialData.attachment;
            const existingAttachmentName =
                typeof existingAttachment === 'string'
                    ? (existingAttachment.split('/').pop() || 'Existing Attachment')
                    : existingAttachment?.name || 'Existing Attachment';

            // For UI purposes we mark `attachment` truthy so the dropzone shows the existing file name.
            // Payload submission still relies on `attachmentBase64`, so this does not re-upload anything.
            const attachmentForUi =
                existingAttachment ? existingAttachment : null;

            setFormData({
                // When editing, load the GRAND TOTAL fine amount
                fineAmount: String(initialData.fineAmount || ''),
                responsibleFor: initialData.responsibleFor || 'Employee',
                employeeAmount: String(initialData.employeeAmount ?? ''),
                companyAmount: String(initialData.companyAmount ?? ''),
                payableDuration: String(initialData.payableDuration || '1'),
                monthStart: initialData.monthStart || new Date().toISOString().split('T')[0].slice(0, 7),
                description: initialData.description || '',
                attachment: attachmentForUi,
                attachmentBase64: '',
                attachmentName: existingAttachmentName,
                attachmentMime: typeof existingAttachment === 'string' ? 'application/pdf' : (existingAttachment?.mimeType || ''),
                companyDescription: initialData.companyDescription || '',
                serviceCharge: String(initialData.serviceCharge || '')
            });

            if (initialData.company) {
                setSelectedCompanyId(initialData.company._id || initialData.company);
            }

            // If we have a mainAssetObjectId, we should find that asset and populate its accessories
            if (initialData.mainAssetObjectId || initialData.assetObjectId) {
                const mainAsset = assets.find(a => a._id === (initialData.mainAssetObjectId || initialData.assetObjectId));
                if (mainAsset) {
                    setSelectedAssetId(mainAsset.id);
                    setSelectedAssetName(mainAsset.name);
                    setSelectedAssetObjectId(mainAsset._id);
                    setAccessories(mainAsset.accessories || []);

                    // If we came from an accessory, find its name
                    if (initialData.accessoryObjectId) {
                        const acc = mainAsset.accessories.find(ac => ac._id === initialData.accessoryObjectId);
                        if (acc) {
                            setSelectedAccessoryName(acc.name);
                            setSelectedAccessoryId(acc.accessoryId);
                        }
                    }
                } else {
                    // Fallback to manually injecting values if it's not in the fetched list (Unassigned or Accessory)
                    setSelectedAssetId(initialData.assetId);
                    setSelectedAssetName(initialData.assetName);
                    setSelectedAssetObjectId(initialData.mainAssetObjectId || initialData.assetObjectId);
                    setAccessories(initialData.accessories || []);

                    if (initialData.accessoryObjectId) {
                        const acc = (initialData.accessories || []).find(ac => ac._id === initialData.accessoryObjectId);
                        if (acc) {
                            setSelectedAccessoryName(acc.name);
                            setSelectedAccessoryId(acc.accessoryId);
                        } else {
                            setSelectedAccessoryName(initialData.accessoryName || initialData.assetName);
                            setSelectedAccessoryId(initialData.assetId); // fallback
                        }
                    }
                }
            }

        } else if (isOpen) {
            setSelectedAssetId('');
            setSelectedAssetName('');
            setSelectedEmployeeId('');
            setEmployeeName('');
            setAccessories([]);
            setSelectedAccessoryId('');
            setSelectedAccessoryName('');
            setSelectedAccessoryObjectId('');
            setSelectedCompanyId('');
            setFormData({
                fineAmount: '', responsibleFor: 'Employee', employeeAmount: '', companyAmount: '',
                payableDuration: '1', monthStart: new Date().toISOString().split('T')[0].slice(0, 7),
                description: '', attachment: null, attachmentBase64: '', attachmentName: '', attachmentMime: '',
                companyDescription: '', serviceCharge: ''
            });

        }
    }, [isOpen, initialData, assets]);

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

    const handleAssetChange = (e) => {
        const assetId = e.target.value;
        setSelectedAssetId(assetId);
        setSelectedAccessoryId('');
        setSelectedAccessoryName('');
        setSelectedAccessoryObjectId('');
        setAccessories([]);

        if (assetId) {
            if (errors.assetId) setErrors(prev => ({ ...prev, assetId: '' }));
            const asset = assets.find(a => a.id === assetId);
            if (asset) {
                setSelectedAssetName(asset.name || '');
                setSelectedAssetObjectId(asset._id);
                setAccessories(asset.accessories || []);
                setFormData(prev => ({ ...prev, fineAmount: asset.assetValue ? String(asset.assetValue) : '' }));
                if (asset.assignedTo) {
                    setSelectedEmployeeId(asset.assignedTo.employeeId);
                    setEmployeeName(`${asset.assignedTo.firstName} ${asset.assignedTo.lastName}`);
                }
            }
        } else {
            setSelectedAssetName('');
            setSelectedAssetObjectId('');
            setSelectedEmployeeId('');
            setEmployeeName('');
            setFormData(prev => ({ ...prev, fineAmount: '' }));
        }
    };

    const handleAccessoryChange = (e) => {
        const accId = e.target.value;
        setSelectedAccessoryId(accId);
        if (accId === 'main') {
            setSelectedAccessoryName('');
            setSelectedAccessoryObjectId('');
            // Optional: reset amount to main asset if it was changed
            const asset = assets.find(a => a.id === selectedAssetId);
            if (asset) setFormData(prev => ({ ...prev, fineAmount: asset.assetValue ? String(asset.assetValue) : '' }));
        } else {
            const acc = accessories.find(a => a.accessoryId === accId);
            if (acc) {
                setSelectedAccessoryName(acc.name);
                setSelectedAccessoryObjectId(acc._id);
                setFormData(prev => ({ ...prev, fineAmount: acc.amount ? String(acc.amount) : '' }));
            }
        }
    };

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({ ...prev, attachment: file, attachmentBase64: base64, attachmentName: file.name, attachmentMime: file.type || 'application/pdf' }));
        };
        reader.readAsDataURL(file);
    };

    const validateForm = () => {
        const newErrors = {};
        // For initial request, only validate description
        if (isInitialRequest) {
            if (!formData.description) newErrors.description = 'Description is required';
            setErrors(newErrors);
            return { ok: Object.keys(newErrors).length === 0, newErrors };
        }

        const initialCompanyContext =
            initialData?.assignedToType === 'Company' ||
            !!initialData?.company ||
            initialData?.responsibleFor === 'Company';

        // Full validation for approval flow
        // For approval flow, assetId might come from initialData
        // For accessories, we need the main asset ID, not the accessory ID
        const effectiveAssetId = selectedAssetId || initialData?.assetId;
        const effectiveAssetObjectId = selectedAssetObjectId || initialData?.assetObjectId;

        // If it's an accessory flow, we still need a main asset ID
        // For approval flow with accessories, we need either assetId or assetObjectId
        if (!isInitialRequest) {
            if (!effectiveAssetId && !effectiveAssetObjectId) {
                newErrors.assetId = 'Asset is required';
            }
        }

        const effectiveEmployeeId = selectedEmployeeId || initialData?.employeeId || initialData?.assignedEmployees?.[0]?.employeeId;

        const responsibleIsCompany =
            formData.responsibleFor === 'Company' || (isApprovalFlow && initialCompanyContext);

        if (!effectiveEmployeeId && !isInitialRequest && !responsibleIsCompany) {
            if (formData.responsibleFor === 'Employee' || formData.responsibleFor === 'Employee & Company') {
                newErrors.employeeId =
                    'Assigned employee is required (or set Responsible to Company if this is a company allocation)';
            }
        }

        if (!formData.fineAmount || parseFloat(formData.fineAmount) <= 0) {
            newErrors.fineAmount = 'Total fine amount is required and must be greater than 0';
        }
        if (!formData.description || formData.description.trim() === '') {
            newErrors.description = 'Description is required';
        }

        if (formData.responsibleFor === 'Employee & Company') {
            const empTarget = parseFloat(formData.employeeAmount || 0);
            const compTarget = parseFloat(formData.companyAmount || 0);
            const serviceChargeAmount = parseFloat(formData.serviceCharge || 0);
            const totalInput = parseFloat(formData.fineAmount || 0);

            if (Math.abs((empTarget + compTarget + serviceChargeAmount) - totalInput) > 0.01) {
                newErrors.amountMismatch = `Sum of employee portion (AED ${empTarget.toFixed(2)}), company portion (AED ${compTarget.toFixed(2)}), and service charge (AED ${serviceChargeAmount.toFixed(2)}) must equal total fine amount (AED ${totalInput.toFixed(2)})`;
            }
        }

        const needsCompanyPick =
            formData.responsibleFor === 'Company' || formData.responsibleFor === 'Employee & Company';
        const hasCompanyId =
            !!(selectedCompanyId && String(selectedCompanyId).trim()) ||
            !!(initialData?.company && (initialData.company._id || initialData.company));
        if (needsCompanyPick && !hasCompanyId) {
            newErrors.company = 'Company selection is required';
        }

        setErrors(newErrors);
        const ok = Object.keys(newErrors).length === 0;
        return { ok, newErrors };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const { ok: validationResult, newErrors: validationErrors } = validateForm();
        if (!validationResult) {
            // Wait a tick for errors to be set, then scroll to first error
            setTimeout(() => {
                const firstErrorKey = Object.keys(validationErrors)[0];
                if (firstErrorKey) {
                    console.log("[LossDamageModal] Validation failed. First error:", firstErrorKey, validationErrors[firstErrorKey]);
                    // Try to find and focus the error field
                    const errorElement = document.querySelector(`[name="${firstErrorKey}"]`) ||
                        document.querySelector(`#${firstErrorKey}`) ||
                        document.querySelector(`input[aria-invalid="true"]`) ||
                        document.querySelector(`textarea[aria-invalid="true"]`);
                    if (errorElement) {
                        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        errorElement.focus();
                    }
                }
            }, 100);
            return;
        }

        try {
            setSubmitting(true);
            console.log("[LossDamageModal] Starting submission...", {
                isApprovalFlow,
                isInitialRequest,
                isAssetFlow,
                hasOnAssetRequest: !!onAssetRequest,
                selectedAssetId,
                initialData: initialData ? {
                    assetId: initialData.assetId,
                    assetObjectId: initialData.assetObjectId,
                    isAccessoryFlow: initialData.isAccessoryFlow,
                    accessoryObjectId: initialData.accessoryObjectId
                } : null
            });

            // For approval flow, use initialData values if available
            const effectiveAssetId = selectedAssetId || initialData?.assetId || '';
            const effectiveAssetName = selectedAssetName || initialData?.assetName || '';
            const effectiveAssetObjectId = selectedAssetObjectId || initialData?.assetObjectId || '';
            // For accessories, employeeId might come from initialData.assignedEmployees or employeeId
            const effectiveEmployeeId = selectedEmployeeId ||
                initialData?.employeeId ||
                initialData?.assignedEmployees?.[0]?.employeeId ||
                '';
            const effectiveEmployeeName = employeeName ||
                initialData?.employeeName ||
                initialData?.assignedEmployees?.[0]?.employeeName ||
                '';

            const selectedAsset = assets.find(a => a.id === effectiveAssetId);

            let commonCompanyId = selectedCompanyId;
            if (!commonCompanyId) {
                commonCompanyId = selectedAsset?.companyId || initialData?.company?._id || initialData?.company;
            }

            const serviceChargeAmount = parseFloat(formData.serviceCharge || 0);
            const grandTotalFine = parseFloat(formData.fineAmount || 0);
            const baseFineAmount = grandTotalFine - serviceChargeAmount;

            const totalPartiesCount = (formData.responsibleFor === 'Employee & Company' && effectiveEmployeeId) ? 2 : 1;
            const scPerParty = serviceChargeAmount / totalPartiesCount;

            const employeesList = [];
            if (formData.responsibleFor !== 'Company' && effectiveEmployeeId) {
                const empBase = formData.responsibleFor === 'Employee' ? baseFineAmount : parseFloat(formData.employeeAmount || 0);
                employeesList.push({
                    employeeId: effectiveEmployeeId,
                    employeeName: effectiveEmployeeName,
                    employeeAmount: empBase.toFixed(2),
                    individualAmount: (empBase + scPerParty).toFixed(2),
                    fineAmount: (empBase + scPerParty).toFixed(2),
                    daysWorked: 0
                });
            }
            if (formData.responsibleFor === 'Employee & Company' || formData.responsibleFor === 'Company') {
                const compBase = formData.responsibleFor === 'Company' ? baseFineAmount : parseFloat(formData.companyAmount || 0);
                employeesList.push({
                    employeeId: 'VEGA-HR-0000',
                    employeeName: 'Vega Digital IT Solutions',
                    employeeAmount: compBase.toFixed(2),
                    individualAmount: (compBase + scPerParty).toFixed(2),
                    fineAmount: (compBase + scPerParty).toFixed(2),
                    daysWorked: 0
                });
            }

            const payload = {
                category: 'Damage',
                company: commonCompanyId,
                subCategory: 'Loss & Damage',
                fineType: 'Loss & Damage',
                assetId: effectiveAssetId,
                assetName: effectiveAssetName,
                assetObjectId: effectiveAssetObjectId,
                accessoryId: selectedAccessoryObjectId || initialData?.accessoryObjectId || selectedAccessoryId || null,
                accessoryName: selectedAccessoryName || initialData?.accessoryName || '',
                isBulk: true,
                employees: employeesList,
                // Payload fineAmount should be the TOTAL
                fineAmount: grandTotalFine,
                responsibleFor: formData.responsibleFor,
                employeeAmount: formData.responsibleFor === 'Company' ? 0 : (formData.responsibleFor === 'Employee' ? baseFineAmount : parseFloat(formData.employeeAmount)),
                companyAmount: formData.responsibleFor === 'Employee' ? 0 : (formData.responsibleFor === 'Company' ? baseFineAmount : parseFloat(formData.companyAmount)),
                payableDuration: parseInt(formData.payableDuration),
                monthStart: formData.monthStart,
                serviceCharge: serviceChargeAmount,
                description: formData.description,
                companyDescription: formData.companyDescription,
                fineStatus: isResubmitting ? 'Pending' : (initialData?._id ? initialData.fineStatus : 'Draft')
            };

            if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName,
                    mimeType: formData.attachmentMime
                };
            }

            // If it's an asset flow and we have a callback, use it instead of direct POST
            if (isAssetFlow && onAssetRequest) {
                // For initial request (isInitialRequest = true), only send description and attachment
                if (isInitialRequest) {
                    await onAssetRequest({
                        description: formData.description,
                        attachment: formData.attachmentBase64 ? {
                            data: formData.attachmentBase64,
                            name: formData.attachmentName,
                            mimeType: formData.attachmentMime
                        } : null
                    });
                    toast({ title: "Success", description: "Loss/Damage request sent to Asset Controller" });
                    onClose();
                    return;
                } else if (isApprovalFlow) {
                    // For approval flow, send full fine data
                    const requestPayload = { ...payload };
                    console.log("[LossDamageModal] Approval flow - preparing payload", {
                        initialData: initialData ? {
                            isAccessoryFlow: initialData.isAccessoryFlow,
                            accessoryObjectId: initialData.accessoryObjectId,
                            assetId: initialData.assetId,
                            assetObjectId: initialData.assetObjectId
                        } : null,
                        selectedAccessoryObjectId,
                        payload: {
                            assetId: payload.assetId,
                            accessoryId: payload.accessoryId
                        }
                    });

                    // Handle accessory data from initialData if present
                    if (initialData?.isAccessoryFlow && initialData?.accessoryObjectId) {
                        // For accessories, assetId should be the main asset ID, not the accessory ID
                        requestPayload.assetId = initialData.assetId || selectedAssetId;
                        requestPayload.assetName = initialData.assetName || selectedAssetName;
                        requestPayload.assetObjectId = initialData.assetObjectId || selectedAssetObjectId;
                        requestPayload.accessoryId = initialData.accessoryObjectId;
                        requestPayload.accessoryName = initialData.accessoryName || '';
                        console.log("[LossDamageModal] Using accessory data from initialData", requestPayload);
                    } else if (selectedAccessoryObjectId) {
                        // Fallback to selected accessory if available
                        // For accessories, use main asset ID, not accessory ID
                        requestPayload.assetId = selectedAssetId; // Main asset ID
                        requestPayload.assetName = selectedAssetName; // Main asset name
                        requestPayload.assetObjectId = selectedAssetObjectId; // Main asset object ID
                        requestPayload.accessoryId = selectedAccessoryObjectId;
                        requestPayload.accessoryName = selectedAccessoryName || '';
                        console.log("[LossDamageModal] Using selected accessory", requestPayload);
                    }

                    console.log("[LossDamageModal] Calling onAssetRequest with payload:", requestPayload);
                    try {
                        await onAssetRequest(requestPayload);
                        console.log("[LossDamageModal] onAssetRequest completed successfully");
                        toast({ title: "Success", description: "Loss/Damage approved. Fine created with status Pending HR." });
                        onClose();
                        return;
                    } catch (callbackError) {
                        console.error("[LossDamageModal] Error in onAssetRequest callback:", callbackError);
                        toast({
                            variant: "destructive",
                            title: "Error",
                            description: callbackError?.response?.data?.message || callbackError?.message || "Failed to approve Loss/Damage request"
                        });
                        setSubmitting(false);
                        return;
                    }
                } else {
                    // Legacy flow - send full fine data
                    const requestPayload = { ...payload };
                    if (selectedAccessoryObjectId) {
                        // Update fineData to reflect the selected accessory
                        requestPayload.assetId = selectedAccessoryId;
                        requestPayload.assetName = selectedAccessoryName;
                        requestPayload.accessoryId = selectedAccessoryObjectId;
                    }
                    await onAssetRequest(requestPayload);
                    toast({ title: "Success", description: "Loss/Damage request processed" });
                    onClose();
                    return;
                }
            }

            if (initialData?._id) {
                if (isResubmitting) { payload.fineStatus = 'Pending'; payload.resubmit = true; }
                await axiosInstance.put(`/Fine/${initialData._id}`, payload);
                toast({ title: "Success", description: "Fine updated successfully" });
            } else {
                await axiosInstance.post('/Fine', payload);
                toast({ title: "Success", description: "Loss/Damage fine submitted for approval" });
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error submitting Loss/Damage form:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || error.message || "Submission failed. Please check all required fields."
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" aria-hidden />
            <div className="relative z-[60] bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[90vh] p-6 md:p-8 flex flex-col pointer-events-auto">
                <div className="flex items-center justify-between relative pb-4 border-b border-gray-100 mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors mr-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <h3 className="text-[20px] font-semibold text-gray-800">
                            {isResubmitting ? 'Resubmit Loss & Damage' : (initialData?._id ? 'Edit Loss & Damage' : 'Add Loss & Damage')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5 text-gray-700">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Only show asset selection if NOT initial request */}
                        {!isInitialRequest && (
                            <div className="space-y-1.5 col-span-1">
                                <label className="text-sm font-medium text-gray-700">Select Asset <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedAssetId}
                                    onChange={handleAssetChange}
                                    className={`w-full h-11 px-4 rounded-xl border ${errors.assetId ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none focus:ring-2 focus:ring-red-500/20 transition-all`}
                                >
                                    <option value="">Select Asset</option>
                                    {filteredAssets.map(a => <option key={a.id} value={a.id}>{a.id} - {a.name}</option>)}
                                    {selectedAssetId && !filteredAssets.find(a => a.id === selectedAssetId) && (
                                        <option value={selectedAssetId}>{selectedAssetId} - {selectedAssetName}</option>
                                    )}
                                </select>
                                {errors.assetId && <p className="text-xs text-red-500 ml-1">{errors.assetId}</p>}
                            </div>
                        )}

                        {/* Only show fine form fields if NOT initial request */}
                        {!isInitialRequest && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Select Item / Accessory</label>
                                    <select
                                        value={selectedAccessoryId || (accessories.length > 0 ? '' : 'main')}
                                        onChange={handleAccessoryChange}
                                        disabled={!selectedAssetId}
                                        className={`w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${!selectedAssetId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="main">Main Asset - {selectedAssetName || 'Selected Asset'}</option>
                                        {accessories.map(acc => (
                                            <option key={acc._id} value={acc.accessoryId}>
                                                Accessory: {acc.name} ({acc.accessoryId})
                                            </option>
                                        ))}
                                        {selectedAccessoryId && selectedAccessoryId !== 'main' && !accessories.find(ac => ac.accessoryId === selectedAccessoryId) && (
                                            <option value={selectedAccessoryId}>Accessory: {selectedAccessoryName || selectedAccessoryId}</option>
                                        )}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Assigned Employee</label>
                                    <input type="text" value={employeeName || '—'} readOnly className={`w-full h-11 px-4 rounded-xl border bg-gray-100 outline-none ${errors.employeeId ? 'border-red-400 text-red-900' : 'border-gray-200 text-gray-500'}`} />
                                    {errors.employeeId && <p className="text-xs text-red-500 ml-1">{errors.employeeId}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Total Fine Amount <span className="text-red-500">*</span></label>
                                    <input type="number" value={formData.fineAmount} onChange={(e) => setFormData(prev => ({ ...prev, fineAmount: e.target.value }))} placeholder="0.00" className={`w-full h-11 px-4 rounded-xl border ${errors.fineAmount ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none`} />
                                    {errors.fineAmount && <p className="text-xs text-red-500 ml-1">{errors.fineAmount}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Service Charge</label>
                                    <input
                                        type="number"
                                        value={formData.serviceCharge}
                                        onChange={(e) => setFormData(prev => ({ ...prev, serviceCharge: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Responsible For</label>
                                    <select value={formData.responsibleFor} onChange={(e) => setFormData(prev => ({ ...prev, responsibleFor: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none">
                                        <option value="Employee">Employee</option><option value="Company">Company</option><option value="Employee & Company">Employee & Company</option>
                                    </select>
                                </div>

                                {formData.responsibleFor === 'Employee & Company' && (
                                    <>
                                        <div className="space-y-1.5 "><label className="text-sm font-medium text-gray-700">Employee Portion</label><input type="number" value={formData.employeeAmount} onChange={(e) => setFormData(prev => ({ ...prev, employeeAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" /></div>
                                        <div className="space-y-1.5 "><label className="text-sm font-medium text-gray-700">Company Portion</label><input type="number" value={formData.companyAmount} onChange={(e) => setFormData(prev => ({ ...prev, companyAmount: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none" /></div>
                                        {errors.amountMismatch && <p className="text-xs text-red-500 col-span-full">{errors.amountMismatch}</p>}
                                    </>
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

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Fine Payable Duration</label>
                                    <select value={formData.payableDuration} onChange={(e) => setFormData(prev => ({ ...prev, payableDuration: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 outline-none">
                                        {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Month Start</label>
                                    <MonthYearPicker value={formData.monthStart ? `${formData.monthStart}-01` : undefined} onChange={(d) => d && setFormData(prev => ({ ...prev, monthStart: d.slice(0, 7) }))} className="w-full bg-gray-50" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
                        <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-red-400' : 'border-gray-200'} bg-gray-50 outline-none resize-none`} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Attachment</label>
                        <div onClick={() => fileInputRef.current?.click()} className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100"><Upload className="text-gray-400 mb-2" size={24} /><span className="text-sm text-gray-500">{formData.attachment ? formData.attachmentName : 'Click to upload'}</span><input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} /></div>
                    </div>

                    {/* Total Summary */}
                    <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-100 shadow-sm mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-0.5">Summary</span>
                            <span className="text-xs text-red-600 font-medium italic">
                                Total payable amount (Fine + Service Charge)
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-red-900">
                                {(parseFloat(formData.fineAmount || 0)).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-bold text-red-700 uppercase">AED</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={submitting} className={`px-6 py-2.5 rounded-xl bg-red-600 text-white font-medium shadow-sm transition-all hover:bg-red-700 hover:shadow-md disabled:opacity-50`}>
                            {submitting ? 'Saving...' : (isApprovalFlow ? 'Approve & Create Fine' : (initialData?._id ? 'Save Changes' : (isResubmitting ? 'Resubmit' : (isInitialRequest ? 'Send Request' : 'Save as Draft'))))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
