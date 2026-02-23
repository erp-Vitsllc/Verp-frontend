'use client';

import { useState, useEffect } from 'react';
import { X, Save, Settings, DollarSign, FileText, AlignLeft, StickyNote, Paperclip } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

const SERVICE_TYPES = [
    'Oil Service',
    'Taxi Charge',
    'Mechanical Work',
    'Body Work',
    'Accident Repair',
];

const input = (err) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm font-semibold outline-none transition-all focus:ring-4 focus:ring-teal-500/10 ${err ? 'border-red-300' : 'border-gray-200 focus:border-[#00B5AD]'
    }`;

export default function VehicleServiceModal({ isOpen, onClose, onSuccess, assetId }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        serviceType: '',
        description: '',
        value: '',
        remark: '',
        fileName: '',
        fileBase64: '',
        fileMime: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setFormData({ serviceType: '', description: '', value: '', remark: '', fileName: '', fileBase64: '', fileMime: '' });
            setErrors({});
        }
    }, [isOpen]);

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({ ...prev, fileName: file.name, fileBase64: base64, fileMime: file.type || 'application/pdf' }));
        };
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const e = {};
        if (!formData.serviceType) e.serviceType = 'Service type is required';
        if (!formData.description) e.description = 'Description is required';
        if (!formData.value) e.value = 'Service value is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            await axiosInstance.post(`/AssetItem/${assetId}/service`, {
                serviceType: formData.serviceType,
                date: new Date().toISOString(),
                description: formData.description,
                value: Number(formData.value),
                remark: formData.remark,
                invoice: formData.fileBase64
                    ? { name: formData.fileName, data: formData.fileBase64, mimeType: formData.fileMime }
                    : null,
            });
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-[#00B5AD]">
                            <Settings size={18} />
                        </div>
                        Add Service Record
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-8 py-7 max-h-[78vh] overflow-y-auto space-y-6">

                    {/* Row 1: Service Type + Service Value */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Settings size={11} /> Service Type
                            </label>
                            <select
                                value={formData.serviceType}
                                onChange={(e) => set('serviceType', e.target.value)}
                                className={input(errors.serviceType)}
                            >
                                <option value="">Select service type...</option>
                                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {errors.serviceType && <p className="text-[10px] text-red-500 font-bold">{errors.serviceType}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <DollarSign size={11} /> Service Value
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 select-none">AED</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.value}
                                    onChange={(e) => set('value', e.target.value)}
                                    placeholder="0.00"
                                    className={`${input(errors.value)} pl-14`}
                                />
                            </div>
                            {errors.value && <p className="text-[10px] text-red-500 font-bold">{errors.value}</p>}
                        </div>
                    </div>

                    {/* Row 2: Description + Remark */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <AlignLeft size={11} /> Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => set('description', e.target.value)}
                                placeholder="Describe the work done..."
                                rows={4}
                                className={`${input(errors.description)} resize-none`}
                            />
                            {errors.description && <p className="text-[10px] text-red-500 font-bold">{errors.description}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <StickyNote size={11} /> Remark
                            </label>
                            <textarea
                                value={formData.remark}
                                onChange={(e) => set('remark', e.target.value)}
                                placeholder="Optional notes..."
                                rows={4}
                                className={`${input()} resize-none`}
                            />
                        </div>
                    </div>

                    {/* Row 3: Invoice full width */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Paperclip size={11} /> Add Invoice (Attachment)
                        </label>
                        <div className={`relative flex items-center justify-center w-full h-32 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${formData.fileName ? 'border-teal-300 bg-teal-50/30' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                            <div className="text-center pointer-events-none">
                                {formData.fileName ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <FileText className="text-[#00B5AD]" size={26} />
                                        <p className="text-xs font-black text-gray-700 max-w-[300px] truncate mt-1">{formData.fileName}</p>
                                        <p className="text-[10px] text-[#00B5AD] font-bold uppercase tracking-widest">Click to change</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-gray-300 shadow-sm border border-gray-100">
                                            <Paperclip size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Upload Invoice</p>
                                            <p className="text-[10px] text-gray-300 text-center mt-0.5">PDF, JPG, PNG</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
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
                            {loading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={14} />
                            }
                            Save Service
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
