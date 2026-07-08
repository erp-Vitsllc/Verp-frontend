'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Clock, CheckCircle2, User, Camera } from 'lucide-react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import {
    isAssetAssignmentAcknowledgmentPending,
    isLeaveActive,
    isPoolAssignableAssetStatus,
} from '@/utils/assetStatusHelpers';

export default function AssignAssetModal({
    isOpen,
    onClose,
    asset: initialAsset,
    availableAssets = [],
    onUpdate,
    mode = 'assign',
    fleetAssigneeReassignRequest = false,
    assignmentContext = 'asset',
}) {
    const isTransferAssignee = mode === 'transferAssignee';
    const isFleetAssigneeReassign = fleetAssigneeReassignRequest === true;
    const isVehicleAssignment = assignmentContext === 'vehicle';
    const maxTemporaryDays = isVehicleAssignment ? 30 : 60;
    const itemLabel = isVehicleAssignment ? 'Vehicle' : 'Asset';
    const itemLabelLower = itemLabel.toLowerCase();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [companyAllocationAllowed, setCompanyAllocationAllowed] = useState(true);
    const [companyAllocationMessage, setCompanyAllocationMessage] = useState('');
    const [selectedAsset, setSelectedAsset] = useState(initialAsset);
    const [formData, setFormData] = useState({
        assignedTo: '',
        assignedToType: 'Employee',
        assignmentType: 'Permanent',
        assignedDays: '',
        assignmentReason: '',
        assetPhoto: '',
    });

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            borderColor: '#e2e8f0',
            backgroundColor: state.isDisabled ? '#f8fafc' : base.backgroundColor,
            borderRadius: '0.75rem',
            paddingTop: '4px',
            paddingBottom: '4px',
            '&:hover': {
                borderColor: state.isDisabled ? '#e2e8f0' : '#3b82f6',
            },
        }),
        menu: (base) => ({
            ...base,
            zIndex: 9999,
        }),
    };

    const currentAssignedEmployeeId = selectedAsset?.assignedTo?._id || selectedAsset?.assignedTo || null;
    const currentAssignedCompanyId = selectedAsset?.assignedCompany?._id || selectedAsset?.assignedCompany || null;

    const selectableEmployees = employees.filter((emp) => {
        if (!currentAssignedEmployeeId) return true;
        return String(emp._id) !== String(currentAssignedEmployeeId);
    });

    const selectableCompanies = companies.filter((comp) => {
        if (!currentAssignedCompanyId) return true;
        return String(comp._id) !== String(currentAssignedCompanyId);
    });

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            if (!isTransferAssignee && !isFleetAssigneeReassign && !isVehicleAssignment) {
                fetchCompanies();
                axiosInstance
                    .get('/AssetItem/company-allocation/coordinator', { skipToast: true })
                    .then((res) => {
                        const allowed = !!res.data?.canAllocateToCompany;
                        setCompanyAllocationAllowed(allowed);
                        setCompanyAllocationMessage(res.data?.message || '');
                        if (!allowed) {
                            setFormData((prev) =>
                                prev.assignedToType === 'Company'
                                    ? { ...prev, assignedToType: 'Employee', assignedTo: '' }
                                    : prev
                            );
                        }
                    })
                    .catch(() => {
                        setCompanyAllocationAllowed(false);
                        setCompanyAllocationMessage(
                            'No Assigned User or Admin in Flowchart. Configure one in Settings → Flowchart before allocating to a company.'
                        );
                    });
            }
            setSelectedAsset(initialAsset);
            setFormData({
                assignedTo: '',
                assignedToType: 'Employee',
                assignmentType: 'Permanent',
                assignedDays: '',
                assignmentReason: '',
                assetPhoto: '',
            });
        }
    }, [isOpen, initialAsset, isTransferAssignee, isFleetAssigneeReassign, isVehicleAssignment]);

    const fetchEmployees = async () => {
        try {
            const response = isVehicleAssignment
                ? await axiosInstance.get('/employee/driving-license-holders')
                : await axiosInstance.get('/employee');
            setEmployees(response.data.employees || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: isVehicleAssignment
                    ? 'Failed to load active employees with driving license'
                    : 'Failed to load employees',
            });
        }
    };

    const fetchCompanies = async () => {
        try {
            const response = await axiosInstance.get('/Company');
            setCompanies(response.data.companies || response.data || []);
        } catch (error) {
            /* ignore */
        }
    };

    const compressImageDataUrl = (dataUrl, maxWidth = 1280, quality = 0.82) =>
        new Promise((resolve) => {
            if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
                resolve(dataUrl);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const scale = img.width > maxWidth ? maxWidth / img.width : 1;
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(dataUrl);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });

    const ensureAssignerSignature = async () => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const empId = userData.employeeObjectId;
            if (!empId) return true;

            const empRes = await axiosInstance.get(`/employee/${empId}`, { skipToast: true });
            const empData = empRes.data.employee || empRes.data;
            if (empData?.signature?.url) return true;

            toast({
                variant: 'destructive',
                title: 'Signature Required',
                description: isTransferAssignee
                    ? 'You must set up your digital signature in your profile settings before transferring.'
                    : isVehicleAssignment
                      ? 'You must set up your digital signature in your profile settings before assigning vehicles.'
                      : 'You must set up your digital signature in your profile settings before assigning assets.',
            });
            return false;
        } catch (err) {
            return true;
        }
    };

    const handleSave = async () => {
        if (!selectedAsset) {
            return toast({
                variant: 'destructive',
                title: 'Error',
                description: `Please select a ${itemLabelLower}`,
            });
        }
        if (!formData.assignedTo) {
            return toast({
                variant: 'destructive',
                title: 'Error',
                description: isTransferAssignee
                    ? 'Please select the new assignee.'
                    : isVehicleAssignment
                      ? 'Please select an active employee with a driving license.'
                      : `Please select ${formData.assignedToType === 'Employee' ? 'an employee' : 'a company'}`,
            });
        }
        if (!isTransferAssignee && formData.assignmentType === 'Temporary') {
            if (!formData.assignedDays) {
                return toast({ variant: 'destructive', title: 'Wait!', description: 'Please specify number of days' });
            }
            const days = Number(formData.assignedDays);
            if (!Number.isInteger(days) || days < 1 || days > maxTemporaryDays) {
                return toast({
                    variant: 'destructive',
                    title: 'Invalid duration',
                    description: `Temporary duration must be between 1 and ${maxTemporaryDays} days.`,
                });
            }
        }
        if ((isVehicleAssignment || isFleetAssigneeReassign) && !String(formData.assignmentReason || '').trim()) {
            return toast({
                variant: 'destructive',
                title: 'Reason required',
                description: isFleetAssigneeReassign
                    ? 'Please enter a reason for this reassign request.'
                    : 'Please enter a reason for this vehicle assignment.',
            });
        }

        if (isVehicleAssignment && selectedAsset) {
            const inspStatus = String(selectedAsset.vehicleInspectionStatus || 'none').toLowerCase();
            if (inspStatus === 'draft' || inspStatus === 'pending_hr') {
                return toast({
                    variant: 'destructive',
                    title: 'Inspection not complete',
                    description:
                        inspStatus === 'pending_hr'
                            ? 'Approve the vehicle inspection handover (HR step) before assigning or reassigning.'
                            : 'Complete and approve the vehicle inspection handover before assigning or reassigning.',
                });
            }
        }

        if (!isTransferAssignee && !isVehicleAssignment && formData.assignedToType === 'Company' && !companyAllocationAllowed) {
            return toast({
                variant: 'destructive',
                title: 'Company allocation blocked',
                description:
                    companyAllocationMessage ||
                    'Assign an Assigned User or Admin in Settings → Flowchart before allocating assets to a company.',
            });
        }

        const hasSignature = isVehicleAssignment || isFleetAssigneeReassign
            ? await ensureAssignerSignature()
            : true;
        if (!hasSignature) return;

        if (!isTransferAssignee && !isFleetAssigneeReassign && selectedAsset) {
            const hasAssignee = !!(selectedAsset.assignedTo || selectedAsset.assignedCompany);
            const isReassignment =
                hasAssignee &&
                (selectedAsset.status === 'Assigned' || isAssetAssignmentAcknowledgmentPending(selectedAsset));
            const fromPool = isPoolAssignableAssetStatus(selectedAsset.status);
            if (!isReassignment && !fromPool) {
                return toast({
                    variant: 'destructive',
                    title: 'Cannot assign',
                    description: selectedAsset.pendingAction
                        ? `This asset has a pending "${selectedAsset.pendingAction}" request. Resolve it before assigning.`
                        : 'Only Unassigned or Returned assets can be assigned from the pool. Use Reassign if the asset is already allocated.',
                });
            }
        }

        setLoading(true);
        try {
            if (isTransferAssignee) {
                const res = await axiosInstance.put(`/AssetItem/${selectedAsset._id}/transfer-assignee`, {
                    assignedTo: formData.assignedTo,
                }, { skipActionDedupe: true });
                toast({
                    title: 'Transfer sent',
                    description:
                        res.data?.message ||
                        'The new assignee will receive an approval request by company email.',
                });
            } else {
                const payload = {
                    ...formData,
                    assignmentReason: String(formData.assignmentReason || '').trim(),
                    assignedToType: isVehicleAssignment ? 'Employee' : formData.assignedToType,
                };
                if (!payload.assetPhoto) delete payload.assetPhoto;

                const res = await axiosInstance.put(`/AssetItem/${selectedAsset._id}/assign`, payload, {
                    skipActionDedupe: true,
                    timeout: 20000,
                });
                toast({
                    title: 'Success',
                    description:
                        res.data?.message ||
                        (isFleetAssigneeReassign
                            ? 'Reassign request sent to HR for approval.'
                            : isVehicleAssignment
                              ? 'Vehicle assigned successfully'
                              : 'Asset assigned successfully'),
                });
            }
            onClose();
            if (onUpdate) {
                window.setTimeout(() => onUpdate(), 0);
            }
        } catch (error) {
            const errMsg =
                error.response?.data?.message ||
                (isTransferAssignee ? 'Failed to transfer assignee.' : `Failed to assign ${itemLabelLower}`);
            toast({ variant: 'destructive', title: 'Error', description: errMsg });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    if (isTransferAssignee && !initialAsset) return null;

    const assetOptions = isTransferAssignee
        ? initialAsset
            ? [{
                value: initialAsset._id,
                label: `${initialAsset.assetId || initialAsset.name || itemLabel}${initialAsset.name ? ` - ${initialAsset.name}` : ''}`,
            }]
            : []
        : availableAssets.map((a) => ({
            value: a._id,
            label: `${a.assetId || a.name || itemLabel}${a.name ? ` - ${a.name}` : ''}`,
        }));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl min-h-[600px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col justify-between">
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                            <User size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">
                                {isFleetAssigneeReassign
                                    ? 'Request Reassign'
                                    : isVehicleAssignment
                                      ? 'Vehicle Assignment'
                                      : 'Asset Assignment'}
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {selectedAsset
                                    ? `${itemLabel}: ${selectedAsset.assetId}`
                                    : `Build your ${isVehicleAssignment ? 'vehicle' : 'assignment'}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6 flex-1 overflow-y-auto max-h-[calc(90vh-200px)] scrollbar-hide">
                    {isFleetAssigneeReassign && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 leading-relaxed">
                            Choose the new employee. Your request is sent to <strong>HR</strong> for approval
                            (company email + dashboard task). The vehicle stays with you until HR approves.
                        </div>
                    )}
                    {isTransferAssignee && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                            The new assignee, asset controller, both HODs, and the current holder are notified on
                            company email. The new assignee must approve or reject.
                        </div>
                    )}
                    {selectedAsset && isLeaveActive(selectedAsset) && !isTransferAssignee && (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                            <strong>Parking transfer:</strong> This asset is on leave. The new holder will be <strong>Assigned</strong> with <strong>On Leave = Yes</strong>. Parking duration and settings stay unchanged until the period ends or Asset Controller extends/returns.
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            {isVehicleAssignment ? 'Select Vehicle' : 'Select Asset'}
                        </label>
                        <Select
                            value={
                                selectedAsset
                                    ? {
                                        value: selectedAsset._id,
                                        label: `${selectedAsset.assetId || selectedAsset.name || itemLabel}${selectedAsset.name ? ` - ${selectedAsset.name}` : ''}`,
                                    }
                                    : null
                            }
                            onChange={(selectedOption) => {
                                if (isTransferAssignee) return;
                                const picked = availableAssets.find((a) => String(a._id) === String(selectedOption?.value));
                                setSelectedAsset(picked || null);
                            }}
                            options={assetOptions}
                            className="basic-single"
                            classNamePrefix="select"
                            placeholder={isVehicleAssignment ? 'Search and select vehicle...' : 'Search and select asset...'}
                            isClearable={!isTransferAssignee}
                            isSearchable={!isTransferAssignee}
                            isDisabled={isTransferAssignee}
                            styles={selectStyles}
                        />
                    </div>

                    {!isFleetAssigneeReassign && !isVehicleAssignment ? (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Assign To</label>
                        <div className="grid grid-cols-2 gap-4 p-1 bg-slate-100 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => !isTransferAssignee && setFormData({ ...formData, assignedToType: 'Employee', assignedTo: '' })}
                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.assignedToType === 'Employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Individual Employee
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (isTransferAssignee || !companyAllocationAllowed) return;
                                    setFormData({ ...formData, assignedToType: 'Company', assignedTo: '' });
                                }}
                                disabled={isTransferAssignee || !companyAllocationAllowed}
                                title={
                                    !companyAllocationAllowed
                                        ? companyAllocationMessage ||
                                          'Configure Assigned User or Admin in Flowchart first'
                                        : 'Allocate asset to an entire company'
                                }
                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.assignedToType === 'Company' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isTransferAssignee || !companyAllocationAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                Entire Company
                            </button>
                        </div>
                        {!isTransferAssignee && !companyAllocationAllowed && (
                            <p className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-snug">
                                {companyAllocationMessage ||
                                    'Company allocation requires an Assigned User or Admin in Settings → Flowchart. The coordinator will accept before the asset appears on company tabs.'}
                            </p>
                        )}
                    </div>
                    ) : null}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            {isVehicleAssignment || formData.assignedToType === 'Employee'
                                ? 'Select Employee'
                                : 'Select Company'}
                        </label>
                        <Select
                            value={
                                isVehicleAssignment || formData.assignedToType === 'Employee'
                                    ? selectableEmployees
                                          .map((emp) => ({
                                              value: emp._id,
                                              label: `${emp.firstName} ${emp.lastName} (${emp.employeeId})`,
                                          }))
                                          .find((opt) => opt.value === formData.assignedTo)
                                    : selectableCompanies
                                          .map((comp) => ({
                                              value: comp._id,
                                              label: `${comp.name} (${comp.companyId})`,
                                          }))
                                          .find((opt) => opt.value === formData.assignedTo)
                            }
                            onChange={(selectedOption) =>
                                setFormData({ ...formData, assignedTo: selectedOption?.value || '' })
                            }
                            options={
                                isVehicleAssignment || formData.assignedToType === 'Employee'
                                    ? selectableEmployees.map((emp) => ({
                                          value: emp._id,
                                          label: `${emp.firstName} ${emp.lastName} (${emp.employeeId})`,
                                      }))
                                    : selectableCompanies.map((comp) => ({
                                          value: comp._id,
                                          label: `${comp.name} (${comp.companyId})`,
                                      }))
                            }
                            className="basic-single"
                            classNamePrefix="select"
                            placeholder={
                                isVehicleAssignment || formData.assignedToType === 'Employee'
                                    ? isVehicleAssignment
                                        ? 'Search licensed employee...'
                                        : 'Search for employee...'
                                    : 'Search for company...'
                            }
                            isClearable
                            isSearchable
                            styles={selectStyles}
                            noOptionsMessage={() =>
                                isVehicleAssignment
                                    ? 'No active employees with a driving license found'
                                    : 'No options'
                            }
                        />
                        {isVehicleAssignment && !selectableEmployees.length ? (
                            <p className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-snug">
                                Only employees with an active profile and a driving license card can be assigned a vehicle.
                            </p>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            Duration
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, assignmentType: 'Permanent', assignedDays: '' })}
                                className={`py-4 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${formData.assignmentType === 'Permanent'
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                    }`}
                            >
                                <CheckCircle2 size={16} />
                                Permanent
                            </button>
                            <button
                                type="button"
                                onClick={() => !isTransferAssignee && setFormData({ ...formData, assignmentType: 'Temporary' })}
                                disabled={isTransferAssignee}
                                className={`py-4 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${formData.assignmentType === 'Temporary'
                                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                    } ${isTransferAssignee ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Clock size={16} />
                                Temporary
                            </button>
                        </div>
                    </div>

                    {formData.assignmentType === 'Temporary' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                                Duration (Days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={maxTemporaryDays}
                                placeholder={`Max ${maxTemporaryDays} Days`}
                                value={formData.assignedDays}
                                onChange={(e) => setFormData({ ...formData, assignedDays: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 shadow-sm"
                            />
                            {(() => {
                                const days = Number(formData.assignedDays);
                                if (!days || days < 1) return null;
                                const start = new Date();
                                const end = new Date(start);
                                end.setDate(end.getDate() + days);
                                const endTxt = end.toLocaleDateString();
                                const targetTxt = formData.assignedToType === 'Company'
                                    ? 'HR and Asset Controller'
                                    : 'the assigned employee and Asset Controller';
                                return (
                                    <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Estimated ends on</p>
                                        <p className="text-sm font-black text-amber-800 mt-1">{endTxt}</p>
                                        <p className="text-[11px] text-amber-800/80 mt-2">
                                            A reminder email will be sent 5 days before expiry to {targetTxt}.
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {(isVehicleAssignment || isFleetAssigneeReassign) && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                                Reason
                            </label>
                            <textarea
                                rows={3}
                                value={formData.assignmentReason}
                                onChange={(e) => setFormData({ ...formData, assignmentReason: e.target.value })}
                                placeholder={
                                    isFleetAssigneeReassign
                                        ? 'Why is this vehicle being reassigned?'
                                        : 'Why is this vehicle being assigned?'
                                }
                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 shadow-sm resize-none"
                            />
                        </div>
                    )}

                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            {isVehicleAssignment ? 'Vehicle Condition Photo' : 'Asset Condition Photo'}{' '}
                            <span className="text-[9px] text-slate-400 font-bold ml-1">(Optional)</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="relative group cursor-pointer">
                                    <div className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-[24px] transition-all ${formData.assetPhoto ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-blue-400'}`}>
                                        {formData.assetPhoto ? (
                                            <div className="relative">
                                                <img src={formData.assetPhoto} className="h-32 w-48 object-cover rounded-xl shadow-md border border-white" alt="Condition" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-all text-white text-[10px] font-black uppercase tracking-widest">Change Photo</div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 mb-3 group-hover:scale-110 transition-transform">
                                                    <Camera size={24} strokeWidth={2.5} />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Click to upload photo</span>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = async () => {
                                                    const compressed = await compressImageDataUrl(reader.result);
                                                    setFormData({ ...formData, assetPhoto: compressed });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                            {formData.assetPhoto && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, assetPhoto: '' })}
                                    className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl shadow-sm border border-rose-100 transition-all font-black text-[10px] uppercase tracking-widest"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-slate-300 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <UserPlus size={18} strokeWidth={2.5} />
                                {isTransferAssignee
                                    ? 'Send for Approval'
                                    : isFleetAssigneeReassign
                                      ? 'Send Reassign Request'
                                      : (() => {
                                        const status = (selectedAsset?.status || '').toString();
                                        const statusLower = status.toLowerCase();
                                        const isReassign = ['Assigned', 'Returned', 'Service', 'On Service', 'Waiting for Service', 'Maintenance'].includes(status)
                                            || ['service', 'on service', 'waiting for service', 'maintenance'].includes(statusLower);
                                        if (!isReassign) return isVehicleAssignment ? 'Add Vehicle' : 'Add Asset';
                                        if (formData.assignmentType !== 'Temporary') return 'Reassign';
                                        const d = Number(formData.assignedDays);
                                        if (!Number.isFinite(d) || d < 1) return 'Reassign';
                                        return `Reassign (${d}d)`;
                                    })()}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
