'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, Clock, CheckCircle2, User, Image as ImageIcon, Camera } from 'lucide-react';
import Select from 'react-select';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AssignAssetModal({ isOpen, onClose, asset: initialAsset, availableAssets = [], onUpdate }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState(initialAsset);
    const [formData, setFormData] = useState({
        assignedTo: '',
        assignmentType: 'Permanent',
        assignedDays: '',
        assetPhoto: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            setSelectedAsset(initialAsset);
        }
    }, [isOpen, initialAsset]);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/employee');
            // getEmployees returns { employees, total, pages, currentPage }
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load employees" });
        }
    };

    const handleSave = async () => {
        if (!selectedAsset) {
            return toast({ variant: "destructive", title: "Error", description: "Please select an asset" });
        }
        if (!formData.assignedTo) {
            return toast({ variant: "destructive", title: "Error", description: "Please select an employee" });
        }
        if (formData.assignmentType === 'Temporary') {
            if (!formData.assignedDays) {
                return toast({ variant: "destructive", title: "Wait!", description: "Please specify number of days" });
            }
        }

        // Check for Portal Access & Reportee (Manager fallback)
        const selectedEmp = employees.find(e => e._id === formData.assignedTo);
        const hasNoPortal = !selectedEmp?.companyEmail || !selectedEmp?.enablePortalAccess;
        const hasNoManager = !selectedEmp?.primaryReportee;

        if (hasNoPortal && hasNoManager) {
            return toast({
                variant: "destructive",
                title: "No Recipient Available",
                description: "This employee has no Company Email/Portal Access AND no Primary Reportee (Manager). No one can receive or acknowledge this assignment."
            });
        }

        // Proactive Signature Check
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const empId = userData.employeeObjectId;

            if (empId) {
                const empRes = await axiosInstance.get(`/employee/${empId}`);
                // API returns { message, employee: {...} } so we need to access .employee
                const empData = empRes.data.employee || empRes.data;

                if (!empData?.signature?.url) {
                    return toast({
                        variant: "destructive",
                        title: "Signature Required",
                        description: "You must set up your digital signature in your profile settings before assigning assets."
                    });
                }
            }
        } catch (err) {
            console.error('Signature check failed:', err);
        }

        setLoading(true);
        try {
            await axiosInstance.put(`/AssetItem/${selectedAsset._id}/assign`, formData);
            toast({ title: "Success", description: "Asset assigned successfully" });
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error('Failed to assign asset:', error);
            const errMsg = error.response?.data?.message || "Failed to assign asset";
            toast({ variant: "destructive", title: "Error", description: errMsg });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl min-h-[600px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col justify-between">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                            <User size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Individual Assignment</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {selectedAsset ? `Asset: ${selectedAsset.assetId}` : 'Build your assignment'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6 flex-1 overflow-y-auto max-h-[calc(90vh-200px)] scrollbar-hide">
                    {/* Asset Selector (Only if not pre-selected) */}
                    {!initialAsset && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Select Asset</label>
                            <Select
                                value={availableAssets.map(a => ({ value: a._id, label: `${a.assetId} - ${a.name}` })).find(opt => opt.value === selectedAsset?._id)}
                                onChange={(selectedOption) => {
                                    const asset = availableAssets.find(a => a._id === selectedOption?.value);
                                    setSelectedAsset(asset);
                                }}
                                options={availableAssets.map(a => ({ value: a._id, label: `${a.assetId} - ${a.name}` }))}
                                className="basic-single"
                                classNamePrefix="select"
                                placeholder="Select an asset..."
                                isClearable
                                isSearchable
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        borderColor: '#e2e8f0',
                                        borderRadius: '0.75rem',
                                        paddingTop: '4px',
                                        paddingBottom: '4px',
                                        '&:hover': {
                                            borderColor: '#3b82f6'
                                        }
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        zIndex: 9999
                                    })
                                }}
                            />
                        </div>
                    )}

                    {/* Asset Info Summary */}
                    <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Asset Type</label>
                            <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                {selectedAsset?.type || '-'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Category</label>
                            <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 uppercase tracking-tight shadow-sm min-h-[48px] flex items-center">
                                {selectedAsset?.category || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Employee Select */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            Assigned To
                        </label>
                        <Select
                            value={employees.map(emp => ({
                                value: emp._id,
                                label: `${emp.firstName} ${emp.lastName} (${emp.employeeId})`
                            })).find(opt => opt.value === formData.assignedTo)}
                            onChange={(selectedOption) => setFormData({ ...formData, assignedTo: selectedOption?.value || '' })}
                            options={employees.map((emp) => ({
                                value: emp._id,
                                label: `${emp.firstName} ${emp.lastName} (${emp.employeeId})`
                            }))}
                            className="basic-single"
                            classNamePrefix="select"
                            placeholder="Select Employee..."
                            isClearable
                            isSearchable
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    borderColor: '#e2e8f0',
                                    borderRadius: '0.75rem',
                                    paddingTop: '4px',
                                    paddingBottom: '4px',
                                    '&:hover': {
                                        borderColor: '#3b82f6'
                                    }
                                }),
                                menu: (base) => ({
                                    ...base,
                                    zIndex: 9999
                                })
                            }}
                        />
                    </div>

                    {/* Assignment Type */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            Duration
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
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
                                onClick={() => setFormData({ ...formData, assignmentType: 'Temporary' })}
                                className={`py-4 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${formData.assignmentType === 'Temporary'
                                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                    }`}
                            >
                                <Clock size={16} />
                                Temporary
                            </button>
                        </div>
                    </div>

                    {/* Conditional Days Input */}
                    {formData.assignmentType === 'Temporary' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                                Duration (Days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                placeholder="Max 60 Days"
                                value={formData.assignedDays}
                                onChange={(e) => setFormData({ ...formData, assignedDays: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 shadow-sm"
                            />
                        </div>
                    )}

                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            Asset Condition Photo <span className="text-[9px] text-slate-400 font-bold ml-1">(Optional)</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="relative group cursor-pointer">
                                    <div className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-[24px] transition-all ${formData.assetPhoto ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-blue-400'}`}>
                                        {formData.assetPhoto ? (
                                            <div className="relative">
                                                <img src={formData.assetPhoto} className="h-32 w-48 object-cover rounded-xl shadow-md border border-white" />
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
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => setFormData({ ...formData, assetPhoto: reader.result });
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                            {formData.assetPhoto && (
                                <button
                                    onClick={() => setFormData({ ...formData, assetPhoto: '' })}
                                    className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl shadow-sm border border-rose-100 transition-all font-black text-[10px] uppercase tracking-widest"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:border-slate-300 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <UserPlus size={18} strokeWidth={2.5} />
                                Add Asset
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
