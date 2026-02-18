'use client';

import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { X, UserPlus, Calendar, Clock, CheckCircle2, Trash2, Plus, Table, User, Package } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function BulkAssignAssetModal({ isOpen, onClose, selectedAssets = [], allAvailableAssets = [], onUpdate }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);

    // Assignment Builder State
    const [stagedAssignments, setStagedAssignments] = useState([]);
    const [formState, setFormState] = useState({
        targetAssetId: '',
        assignedTo: '',
        assignmentType: 'Permanent',
        assignedDays: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            setStagedAssignments([]);
            setFormState({
                targetAssetId: '',
                assignedTo: '',
                assignmentType: 'Permanent',
                assignedDays: ''
            });
        }
    }, [isOpen]);

    const fetchEmployees = async () => {
        try {
            const response = await axiosInstance.get('/employee');
            setEmployees(response.data.employees || []);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load employees" });
        }
    };

    // Filter out assets that are already staged
    const availableAssets = useMemo(() => {
        const pool = allAvailableAssets.length > 0 ? allAvailableAssets : selectedAssets;
        const stagedIds = new Set(stagedAssignments.map(s => s.asset._id));
        return pool.filter(a => !stagedIds.has(a._id));
    }, [selectedAssets, allAvailableAssets, stagedAssignments]);

    const handleAddAssignment = () => {
        if (!formState.targetAssetId) {
            return toast({ variant: "destructive", title: "Wait!", description: "Please select an asset." });
        }
        if (!formState.assignedTo) {
            return toast({ variant: "destructive", title: "Wait!", description: "Please select an employee." });
        }
        if (formState.assignmentType === 'Temporary') {
            if (!formState.assignedDays) {
                return toast({ variant: "destructive", title: "Wait!", description: "Please specify duration." });
            }
            if (parseInt(formState.assignedDays) > 60) {
                return toast({ variant: "destructive", title: "Warning", description: "Temporary assignment cannot exceed 60 days." });
            }
        }

        const employee = employees.find(e => e._id === formState.assignedTo);
        const pool = allAvailableAssets.length > 0 ? allAvailableAssets : selectedAssets;
        const asset = pool.find(a => a._id === formState.targetAssetId);

        if (!asset) return;

        const newAssignment = {
            asset,
            employee,
            assignmentType: formState.assignmentType,
            assignedDays: formState.assignedDays,
            id: Math.random().toString(36).substr(2, 9) // Local UI ID
        };

        setStagedAssignments([...stagedAssignments, newAssignment]);
        setFormState({
            ...formState,
            targetAssetId: '',
            assignedTo: '',
            assignmentType: 'Permanent',
            assignedDays: ''
        });
    };

    const removeStaged = (id) => {
        setStagedAssignments(stagedAssignments.filter(s => s.id !== id));
    };

    const handleProcessAll = async () => {
        if (stagedAssignments.length === 0) {
            return toast({ variant: "destructive", title: "Error", description: "Your assignment list is empty." });
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
            // Group staged assignments by employee/type to optimize requests if the backend is standard
            // For now, we'll process them in groups that share the same configuration
            const groups = stagedAssignments.reduce((acc, curr) => {
                const key = `${curr.employee._id}-${curr.assignmentType}-${curr.assignedDays}`;
                if (!acc[key]) {
                    acc[key] = {
                        assetIds: [],
                        assignedTo: curr.employee._id,
                        assignmentType: curr.assignmentType,
                        assignedDays: curr.assignedDays
                    };
                }
                acc[key].assetIds.push(curr.asset._id);
                return acc;
            }, {});

            // Execute all grouped requests
            const promises = Object.values(groups).map(payload =>
                axiosInstance.put('/AssetItem/bulk/assign', payload)
            );

            await Promise.all(promises);

            toast({ title: "Success", description: `Successfully processed ${stagedAssignments.length} assignments.` });
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error('Processing failed:', error);
            const errMsg = error.response?.data?.message || "Failed to process some assignments.";
            toast({ variant: "destructive", title: "Error", description: errMsg });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                            <Table size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Bulk Assignment</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Assignment Form Section */}
                    <div className="bg-slate-50/50 rounded-[24px] p-6 border border-slate-100 space-y-6">

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
                            {/* Asset Selection */}
                            <div className="space-y-2 lg:col-span-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Select Asset</label>
                                <Select
                                    value={availableAssets.map(asset => ({ value: asset._id, label: `${asset.assetId} - ${asset.name}` })).find(opt => opt.value === formState.targetAssetId)}
                                    onChange={(selectedOption) => setFormState({ ...formState, targetAssetId: selectedOption?.value || '' })}
                                    options={availableAssets.map(asset => ({ value: asset._id, label: `${asset.assetId} - ${asset.name}` }))}
                                    className="basic-single"
                                    classNamePrefix="select"
                                    placeholder="Choose Asset..."
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

                            {/* Employee Selection */}
                            <div className="space-y-2 lg:col-span-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Assign To</label>
                                <Select
                                    value={employees.map(emp => ({ value: emp._id, label: `${emp.firstName} ${emp.lastName}` })).find(opt => opt.value === formState.assignedTo)}
                                    onChange={(selectedOption) => setFormState({ ...formState, assignedTo: selectedOption?.value || '' })}
                                    options={employees.map(emp => ({ value: emp._id, label: `${emp.firstName} ${emp.lastName}` }))}
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

                            {/* Duration Selection */}
                            <div className="space-y-2 lg:col-span-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">Duration</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFormState({ ...formState, assignmentType: 'Permanent', assignedDays: '' })}
                                        className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${formState.assignmentType === 'Permanent' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                    >
                                        Permanent
                                    </button>
                                    <button
                                        onClick={() => setFormState({ ...formState, assignmentType: 'Temporary' })}
                                        className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${formState.assignmentType === 'Temporary' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                    >
                                        Temp
                                    </button>
                                </div>
                                {formState.assignmentType === 'Temporary' && (
                                    <input
                                        type="number"
                                        placeholder="Max 60 Days"
                                        min="1"
                                        max="60"
                                        value={formState.assignedDays}
                                        onChange={(e) => setFormState({ ...formState, assignedDays: e.target.value })}
                                        className="w-full mt-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none animate-in slide-in-from-top-2 duration-200 focus:ring-2 focus:ring-amber-500/20"
                                    />
                                )}
                            </div>

                            {/* Add Button */}
                            <div className="lg:col-span-1">
                                <button
                                    onClick={handleAddAssignment}
                                    className="w-full bg-slate-900 text-white py-4 px-6 rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Batch Table Section */}
                    <div className="space-y-4">

                        <div className="border border-slate-100 rounded-[24px] overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/80 border-b border-slate-50 font-sans">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Details</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned To</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stagedAssignments.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <Package size={48} strokeWidth={1} />
                                                    <p className="text-xs font-black uppercase tracking-widest">No assignments staged</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        stagedAssignments.map((s) => (
                                            <tr key={s.id} className="group hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-sm text-slate-900">
                                                    <div>{s.asset.name}</div>
                                                    <div className="text-[10px] text-blue-600 font-mono tracking-tighter">{s.asset.assetId}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">{s.asset.type || 'Standard'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">{s.asset.category || 'Asset'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                            <User size={12} strokeWidth={2.5} />
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-800">{s.employee.firstName} {s.employee.lastName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${s.assignmentType === 'Permanent' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {s.assignmentType} {s.assignedDays ? `(${s.assignedDays}D)` : ''}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => removeStaged(s.id)}
                                                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-6 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleProcessAll}
                        disabled={loading || stagedAssignments.length === 0}
                        className="px-12 py-4 bg-blue-600 text-white rounded-[20px] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-3"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 size={18} strokeWidth={3} />
                                Add Asset ({stagedAssignments.length})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
