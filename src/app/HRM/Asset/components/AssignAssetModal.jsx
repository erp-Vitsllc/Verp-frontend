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
    const [companies, setCompanies] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState(initialAsset);
    const [formData, setFormData] = useState({
        assignedTo: '',
        assignedToType: 'Employee',
        assignmentType: 'Permanent',
        assignedDays: '',
        assetPhoto: ''
    });

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
            fetchCompanies();
            setSelectedAsset(initialAsset);
        }
    }, [isOpen, initialAsset]);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/employee');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load employees" });
        }
    };

    const fetchCompanies = async () => {
        try {
            const response = await axiosInstance.get('/company');
            setCompanies(response.data.companies || response.data || []);
        } catch (error) {
            console.error('Failed to fetch companies:', error);
        }
    };

    const handleSave = async () => {
        if (!selectedAsset) {
            return toast({ variant: "destructive", title: "Error", description: "Please select an asset" });
        }
        if (!formData.assignedTo) {
            return toast({ variant: "destructive", title: "Error", description: `Please select ${formData.assignedToType === 'Employee' ? 'an employee' : 'a company'}` });
        }
        if (formData.assignmentType === 'Temporary') {
            if (!formData.assignedDays) {
                return toast({ variant: "destructive", title: "Wait!", description: "Please specify number of days" });
            }
        }

        // Proactive Signature Check
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const empId = userData.employeeObjectId;

            if (empId) {
                const empRes = await axiosInstance.get(`/employee/${empId}`);
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
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Asset Assignment</h2>
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
                    {/* Asset Select */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            Select Asset
                        </label>
                        <Select
                            value={
                                selectedAsset
                                    ? {
                                        value: selectedAsset._id,
                                        label: `${selectedAsset.assetId || selectedAsset.name || 'Asset'}${selectedAsset.name ? ` - ${selectedAsset.name}` : ''}`,
                                    }
                                    : null
                            }
                            onChange={(selectedOption) => {
                                const picked = availableAssets.find((a) => String(a._id) === String(selectedOption?.value));
                                setSelectedAsset(picked || null);
                            }}
                            options={availableAssets.map((a) => ({
                                value: a._id,
                                label: `${a.assetId || a.name || 'Asset'}${a.name ? ` - ${a.name}` : ''}`,
                            }))}
                            className="basic-single"
                            classNamePrefix="select"
                            placeholder="Search and select asset..."
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

                    {/* Assignment Target Toggle */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Assign To</label>
                        <div className="grid grid-cols-2 gap-4 p-1 bg-slate-100 rounded-2xl">
                            <button
                                onClick={() => setFormData({ ...formData, assignedToType: 'Employee', assignedTo: '' })}
                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.assignedToType === 'Employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Individual Employee
                            </button>
                            <button
                                onClick={() => setFormData({ ...formData, assignedToType: 'Company', assignedTo: '' })}
                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.assignedToType === 'Company' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Entire Company
                            </button>
                        </div>
                    </div>

                    {/* Target Select */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                            {formData.assignedToType === 'Employee' ? 'Select Employee' : 'Select Company'}
                        </label>
                        <Select
                            value={formData.assignedToType === 'Employee'
                                ? selectableEmployees.map(emp => ({ value: emp._id, label: `${emp.firstName} ${emp.lastName} (${emp.employeeId})` })).find(opt => opt.value === formData.assignedTo)
                                : selectableCompanies.map(comp => ({ value: comp._id, label: `${comp.name} (${comp.companyId})` })).find(opt => opt.value === formData.assignedTo)
                            }
                            onChange={(selectedOption) => setFormData({ ...formData, assignedTo: selectedOption?.value || '' })}
                            options={formData.assignedToType === 'Employee'
                                ? selectableEmployees.map((emp) => ({ value: emp._id, label: `${emp.firstName} ${emp.lastName} (${emp.employeeId})` }))
                                : selectableCompanies.map((comp) => ({ value: comp._id, label: `${comp.name} (${comp.companyId})` }))
                            }
                            className="basic-single"
                            classNamePrefix="select"
                            placeholder={formData.assignedToType === 'Employee' ? "Search for employee..." : "Search for company..."}
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
                                        {(() => {
                                            const status = (selectedAsset?.status || '').toString();
                                            const isReassign = ['Assigned', 'On Leave', 'Returned'].includes(status);
                                            if (!isReassign) return 'Add Asset';
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
