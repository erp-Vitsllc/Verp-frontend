'use client';

import { useEffect, useState } from 'react';
import { X, Save, Calendar, ShieldCheck, Eye, FileText } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";

export default function VehicleWarrantyModal({
    isOpen,
    onClose,
    onSuccess,
    assetId,
    existingDoc,
    isRenew = false,
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        startDate: '',
        km: '',
        endDate: '',
        certificateFile: null,
        certificateFileBase64: '',
        certificateFileName: '',
        certificateFileMime: '',
    });

    useEffect(() => {
        if (!isOpen) return;

        if (isRenew) {
            setFormData({
                startDate: '',
                km: '',
                endDate: '',
                certificateFile: null,
                certificateFileBase64: '',
                certificateFileName: '',
                certificateFileMime: '',
            });
            setErrors({});
            return;
        }

        if (existingDoc) {
            let parsed = {};
            if (existingDoc.description) {
                try {
                    parsed = JSON.parse(existingDoc.description);
                } catch {
                    parsed = {};
                }
            }

            setFormData({
                startDate: existingDoc.issueDate ? String(existingDoc.issueDate).substring(0, 10) : '',
                km: parsed?.km != null ? String(parsed.km) : '',
                endDate: existingDoc.expiryDate ? String(existingDoc.expiryDate).substring(0, 10) : '',
                certificateFile: null,
                certificateFileBase64: '',
                certificateFileName: '',
                certificateFileMime: '',
            });
        } else {
            setFormData({
                startDate: '',
                km: '',
                endDate: '',
                certificateFile: null,
                certificateFileBase64: '',
                certificateFileName: '',
                certificateFileMime: '',
            });
        }

        setErrors({});
    }, [isOpen, existingDoc, isRenew]);

    const handleCertificateChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setFormData((p) => ({
                ...p,
                certificateFile: null,
                certificateFileBase64: '',
                certificateFileName: '',
                certificateFileMime: '',
            }));
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            setFormData((p) => ({
                ...p,
                certificateFile: file,
                certificateFileBase64: base64,
                certificateFileName: file.name,
                certificateFileMime: file.type || 'application/pdf',
            }));
        };
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const next = {};
        if (!formData.startDate) next.startDate = 'Start date is required';
        if (!formData.endDate) next.endDate = 'End date is required';
        if (!formData.km) next.km = 'KM is required';

        const needFile = isRenew || !existingDoc;
        if (needFile && !formData.certificateFileBase64) next.certificate = 'Certificate attachment is required';

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const payload = {
            type: 'Warranty',
            issueAuthority: 'RTA',
            issueDate: formData.startDate,
            expiryDate: formData.endDate,
            description: JSON.stringify({
                km: formData.km ? Number(formData.km) : null,
            }),
        };

        if (formData.certificateFileBase64) {
            payload.document = {
                name: formData.certificateFileName || 'warranty-certificate',
                data: formData.certificateFileBase64,
                mimeType: formData.certificateFileMime || 'application/pdf',
            };
        }

        try {
            setLoading(true);
            const shouldUpdateExisting = existingDoc?._id && !isRenew;
            if (shouldUpdateExisting) {
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, payload);
            } else {
                await axiosInstance.post(`/AssetItem/${assetId}/document`, payload);
            }

            toast({ title: 'Saved', description: 'Warranty details saved successfully.' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving warranty', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save warranty details.',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isRenew ? 'Renew Warranty' : 'Warranty Details'}
                    </h3>
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
                    {/* Start Date (shadcn UI) */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Start Date <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <DatePicker
                                value={formData.startDate || ''}
                                onChange={(date) => setFormData((p) => ({ ...p, startDate: date }))}
                                placeholder="Pick warranty start date"
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg bg-white font-normal text-gray-900 hover:bg-gray-50/80 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                                disabled={loading}
                            />
                            {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
                        </div>
                    </div>

                    {/* KM */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            KM <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={formData.km}
                                onChange={(e) => setFormData((p) => ({ ...p, km: e.target.value }))}
                                placeholder="Enter km"
                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.km ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                disabled={loading}
                            />
                            {errors.km && <p className="text-xs text-red-500">{errors.km}</p>}
                        </div>
                    </div>

                    {/* End Date */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            End Date <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.endDate ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                disabled={loading}
                            />
                            {errors.endDate && <p className="text-xs text-red-500">{errors.endDate}</p>}
                        </div>
                    </div>

                    {/* Certificate */}
                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                            Certificate <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleCertificateChange}
                                disabled={loading}
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800"
                            />
                            {errors.certificate && <p className="text-xs text-red-500">{errors.certificate}</p>}
                            <p className="text-xs text-gray-400">Upload warranty certificate/attachment.</p>
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

