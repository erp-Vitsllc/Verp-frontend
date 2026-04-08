'use client';

import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { X, UserPlus, CheckCircle2 } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const selectStyles = {
    control: (base) => ({
        ...base,
        borderColor: '#e2e8f0',
        borderRadius: '0.75rem',
        paddingTop: '4px',
        paddingBottom: '4px',
        '&:hover': { borderColor: '#3b82f6' }
    }),
    menu: (base) => ({ ...base, zIndex: 9999 })
};

export default function AssetCheckboxAssignModal({ isOpen, onClose, selectedAssets = [], onUpdate }) {
    const { toast } = useToast();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        assignedTo: '',
        assignmentType: 'Permanent',
        assignedDays: ''
    });

    useEffect(() => {
        if (!isOpen) return;
        setFormData({ assignedTo: '', assignmentType: 'Permanent', assignedDays: '' });
        (async () => {
            try {
                const res = await axiosInstance.get('/employee');
                setEmployees(res.data?.employees || []);
            } catch {
                setEmployees([]);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load employees.' });
            }
        })();
    }, [isOpen, toast]);

    const assignableAssets = useMemo(
        () => (selectedAssets || []).filter((a) => String(a?.status ?? '').trim() === 'Unassigned'),
        [selectedAssets]
    );

    const handleConfirm = async () => {
        if (assignableAssets.length === 0) {
            return toast({ variant: 'destructive', title: 'No assets', description: 'Select at least one unassigned asset.' });
        }
        if (!formData.assignedTo) {
            return toast({ variant: 'destructive', title: 'Select user', description: 'Please add/select a target employee.' });
        }
        if (formData.assignmentType === 'Temporary' && !formData.assignedDays) {
            return toast({ variant: 'destructive', title: 'Duration required', description: 'Enter temporary duration in days.' });
        }

        setLoading(true);
        try {
            await axiosInstance.put('/AssetItem/bulk/assign', {
                assetIds: assignableAssets.map((a) => a._id),
                assignedTo: formData.assignedTo,
                assignmentType: formData.assignmentType,
                assignedDays: formData.assignmentType === 'Temporary' ? formData.assignedDays : ''
            });

            toast({
                title: 'Assignment submitted',
                description: 'Assets assigned. Approval flow is sent to the targeted employee.'
            });
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Assignment failed',
                description: error?.response?.data?.message || 'Unable to assign selected assets.'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-3xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 bg-gray-50/40">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Assign Selected Assets</h2>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">
                            Selected: {assignableAssets.length} asset{assignableAssets.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-7 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                            Clicked Assets
                        </label>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2 text-[10px] uppercase text-slate-500 font-black">Asset</th>
                                        <th className="px-4 py-2 text-[10px] uppercase text-slate-500 font-black">Asset ID</th>
                                        <th className="px-4 py-2 text-[10px] uppercase text-slate-500 font-black">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignableAssets.map((asset) => (
                                        <tr key={asset._id} className="border-t border-slate-100">
                                            <td className="px-4 py-2 text-sm text-slate-700 font-semibold">{asset.name || '—'}</td>
                                            <td className="px-4 py-2 text-sm text-slate-600">{asset.assetId || '—'}</td>
                                            <td className="px-4 py-2 text-xs font-black uppercase text-emerald-700">Unassigned</td>
                                        </tr>
                                    ))}
                                    {assignableAssets.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                                                No unassigned assets selected.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Add User / Assign User</label>
                        <Select
                            value={employees
                                .map((emp) => ({ value: emp._id, label: `${emp.firstName} ${emp.lastName} (${emp.employeeId || '—'})` }))
                                .find((opt) => String(opt.value) === String(formData.assignedTo)) || null}
                            onChange={(opt) => setFormData((prev) => ({ ...prev, assignedTo: opt?.value || '' }))}
                            options={employees.map((emp) => ({
                                value: emp._id,
                                label: `${emp.firstName} ${emp.lastName} (${emp.employeeId || '—'})`
                            }))}
                            placeholder="Search and select employee..."
                            isClearable
                            isSearchable
                            styles={selectStyles}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, assignmentType: 'Permanent', assignedDays: '' }))}
                            className={`py-3 rounded-xl border text-xs font-black uppercase ${formData.assignmentType === 'Permanent' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
                        >
                            Permanent
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, assignmentType: 'Temporary' }))}
                            className={`py-3 rounded-xl border text-xs font-black uppercase ${formData.assignmentType === 'Temporary' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200'}`}
                        >
                            Temporary
                        </button>
                        {formData.assignmentType === 'Temporary' && (
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={formData.assignedDays}
                                onChange={(e) => setFormData((prev) => ({ ...prev, assignedDays: e.target.value }))}
                                placeholder="Days (1-60)"
                                className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold outline-none"
                            />
                        )}
                    </div>
                </div>

                <div className="px-7 py-5 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
                    <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || assignableAssets.length === 0}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wide disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={14} /><CheckCircle2 size={14} />Confirm Assign</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
