'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, Clock, CheckCircle2, User } from 'lucide-react';
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
        assignedDays: ''
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
                return toast({ variant: "destructive", title: "Error", description: "Please specify number of days" });
            }
            if (parseInt(formData.assignedDays) > 60) {
                return toast({ variant: "destructive", title: "Warning", description: "Temporary assignment cannot exceed 60 days." });
            }
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
                        title: "Authorization Required",
                        description: "cant you cant assign u r signator not added"
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
                <div className="p-8 space-y-8">
                    {/* Asset Selector (Only if not pre-selected) */}
                    {!initialAsset && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Select Asset</label>
                            <select
                                value={selectedAsset?._id || ''}
                                onChange={(e) => {
                                    const asset = availableAssets.find(a => a._id === e.target.value);
                                    setSelectedAsset(asset);
                                }}
                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 shadow-sm"
                            >
                                <option value="">Select an asset...</option>
                                {availableAssets.map(a => (
                                    <option key={a._id} value={a._id}>{a.assetId} - {a.name}</option>
                                ))}
                            </select>
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
                        <select
                            value={formData.assignedTo}
                            onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800 shadow-sm"
                        >
                            <option value="">Select Employee...</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                                </option>
                            ))}
                        </select>
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
