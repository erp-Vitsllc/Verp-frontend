'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";

export default function VehiclePermitModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        permitType: '',
        startDate: '',
        endDate: '',
        isUnlimited: false,
    });

    useEffect(() => {
        if (!isOpen) return;
        setFormData({
            permitType: '',
            startDate: '',
            endDate: '',
            isUnlimited: false,
        });
        setErrors({});
    }, [isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const next = {};
        if (!formData.permitType.trim()) next.permitType = 'Permit type is required';
        if (!formData.startDate) next.startDate = 'Start date is required';
        if (!formData.isUnlimited && !formData.endDate) next.endDate = 'End date is required (or choose Unlimited)';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const payload = {
            type: 'Permit',
            issueAuthority: 'RTA',
            issueDate: formData.startDate,
            expiryDate: formData.isUnlimited ? null : formData.endDate,
            description: JSON.stringify({
                permitType: formData.permitType.trim(),
                unlimited: !!formData.isUnlimited,
            }),
        };

        try {
            setLoading(true);
            await axiosInstance.post(`/AssetItem/${assetId}/document`, payload);
            toast({ title: 'Saved', description: 'Permit added successfully.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving permit', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add permit.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Add Permit</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Permit Type <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="text"
                                value={formData.permitType}
                                onChange={(e) => setFormData((p) => ({ ...p, permitType: e.target.value }))}
                                placeholder="Enter permit type"
                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.permitType ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                disabled={loading}
                            />
                            {errors.permitType && <p className="text-xs text-red-500">{errors.permitType}</p>}
                        </div>
                    </div>

                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Start Date <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <DatePicker
                                value={formData.startDate || ''}
                                onChange={(date) => setFormData((p) => ({ ...p, startDate: date }))}
                                placeholder="Pick start date"
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg bg-white font-normal text-gray-900 hover:bg-gray-50/80 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                                disabled={loading}
                            />
                            {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
                        </div>
                    </div>

                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            End Date
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={formData.isUnlimited}
                                    onChange={(e) => setFormData((p) => ({ ...p, isUnlimited: e.target.checked }))}
                                    disabled={loading}
                                    className="w-4 h-4"
                                />
                                Unlimited
                            </label>

                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                                disabled={loading || formData.isUnlimited}
                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.endDate ? 'ring-2 ring-red-400 border-red-400' : ''} ${formData.isUnlimited ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            {errors.endDate && <p className="text-xs text-red-500">{errors.endDate}</p>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-3 border-t border-gray-200 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="text-sm font-medium text-red-500 hover:text-red-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-28 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition-colors disabled:opacity-60"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

