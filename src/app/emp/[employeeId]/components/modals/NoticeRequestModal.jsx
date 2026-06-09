'use client';

import { useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";
import {
    formatExitDateFromNoticePeriod,
    formatNoticeDurationLabel,
} from '@/utils/employeeLabourCardValidation';
import { ENABLED_NOTICE_REASONS } from '@/utils/employeeWorkStatus';

export default function NoticeRequestModal({ isOpen, onClose, employeeId, employee, onSuccess }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        reason: ENABLED_NOTICE_REASONS[0] || 'Notice Period',
        attachment: null
    });

    const noticePeriodMonths = employee?.labourCardDetails?.noticePeriodMonths;
    const noticePeriodLabel = noticePeriodMonths
        ? formatNoticeDurationLabel(noticePeriodMonths)
        : '';
    const projectedExitDate = useMemo(() => {
        if (!noticePeriodMonths) return '';
        return formatExitDateFromNoticePeriod(new Date(), noticePeriodMonths);
    }, [noticePeriodMonths]);

    if (!isOpen) return null;

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast({ variant: "destructive", title: "File too large", description: "Max 5MB allowed" });
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                setFormData(prev => ({
                    ...prev,
                    attachment: {
                        data: reader.result,
                        name: file.name,
                        mimeType: file.type
                    }
                }));
            };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!noticePeriodMonths) {
            toast({
                variant: "destructive",
                title: "Notice period missing",
                description: "Please add the notice period on the Labour Card before submitting a notice request.",
            });
            return;
        }

        if (!formData.reason || !formData.attachment) {
            toast({ variant: "destructive", title: "Missing fields", description: "Reason and attachment are required" });
            return;
        }

        setIsLoading(true);

        try {
            let attachmentUrl = null;
            if (formData.attachment && formData.attachment.data) {
                const uploadRes = await axiosInstance.post(`/Employee/upload-document/${employeeId}`, {
                    document: formData.attachment.data,
                    folder: `employee-documents/${employeeId}/notice`,
                    fileName: formData.attachment.name,
                    resourceType: 'auto'
                });
                attachmentUrl = uploadRes.data.url;
            }

            await axiosInstance.post(`/Employee/${employeeId}/request-notice`, {
                reason: formData.reason,
                attachment: {
                    url: attachmentUrl,
                    name: formData.attachment.name,
                    mimeType: formData.attachment.mimeType
                }
            });

            toast({ title: "Success", description: "Notice request submitted successfully." });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to submit request"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-800">Request Notice Period</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2">
                        <div className="flex justify-between gap-4">
                            <span className="text-xs font-medium text-blue-900">Notice Period (from Labour Card)</span>
                            <span className="text-xs text-blue-800">
                                {noticePeriodLabel || 'Not configured'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-xs font-medium text-blue-900">Projected Exit Date</span>
                            <span className="text-xs text-blue-800">
                                {projectedExitDate || '—'}
                            </span>
                        </div>
                        <p className="text-[11px] text-blue-700">
                            Final exit date is set when your resignation is approved: approval date + selected notice period days.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                        <select
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                            required
                        >
                            <option value="Notice Period">Notice Period</option>
                            <option value="Termination" disabled>Termination (disabled)</option>
                            <option value="Resignation" disabled>Resignation (disabled)</option>
                        </select>
                        <p className="mt-1 text-[11px] text-gray-500">
                            Termination and Resignation reasons are disabled for now. Use Notice Period to submit a notice request.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Attachment <span className="text-red-500">*</span></label>
                        <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 text-center hover:bg-gray-100 transition-colors">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className="hidden"
                                id="notice-attachment"
                                required
                            />
                            <label htmlFor="notice-attachment" className="cursor-pointer flex flex-col items-center gap-2">
                                <span className="text-sm text-gray-600 font-medium">
                                    {formData.attachment ? formData.attachment.name : "Click to upload document"}
                                </span>
                                <span className="text-xs text-gray-400">PDF, JPG, PNG (Max 5MB)</span>
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Submitting...' : 'Send for Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
