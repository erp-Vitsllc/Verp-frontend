'use client';

import { useState } from 'react';
import axiosInstance from '@/utils/axios';
import { useToast } from "@/hooks/use-toast";

export default function NoticeRequestModal({ isOpen, onClose, employeeId, onSuccess }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        duration: '',
        reason: '',
        attachment: null
    });

    if (!isOpen) return null;

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size/type if needed
            if (file.size > 5 * 1024 * 1024) {
                toast({ variant: "destructive", title: "File too large", description: "Max 5MB allowed" });
                return;
            }

            // Convert to base64 for upload
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

        if (!formData.duration || !formData.reason || !formData.attachment) {
            toast({ variant: "destructive", title: "Missing fields", description: "All fields are required" });
            return;
        }

        setIsLoading(true);

        try {
            // First upload document if needed, or send as base64 to controller which handles it
            // Assuming controller can handle base64 or we upload to cloudinary here first.
            // For consistency with other parts, usually we upload to Cloudinary.
            // But to save time and complexity, if the backend supports it or we use existing upload endpoint...
            // Let's use the existing upload-document endpoint if possible, but for now I'll send base64 to `requestNotice` 
            // and let the controller logic I wrote (which just saves it to the object) handle it. 
            // Wait, my controller schema `attachment` has `url`, `data` etc. 
            // Ideally we should upload to text/cloudinary. 
            // Since I didn't write cloudinary logic in `requestNotice`, I'll implement Cloudinary upload HERE first.

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

            // Now send request
            await axiosInstance.post(`/Employee/${employeeId}/request-notice`, {
                duration: formData.duration,
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

                    {/* Employee Name Display */}
                    {employeeName && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Employee Name</p>
                            <p className="text-sm font-semibold text-blue-900">{employeeName}</p>
                        </div>
                    )}

                    {/* Duration */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Duration <span className="text-red-500">*</span></label>
                        <select
                            value={formData.duration}
                            onChange={e => setFormData({ ...formData, duration: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            required
                        >
                            <option value="">Select Duration</option>
                            <option value="1 Month">1 Month</option>
                            <option value="2 Months">2 Months</option>
                            <option value="3 Months">3 Months</option>
                        </select>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
                        <select
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            required
                        >
                            <option value="">Select Reason</option>
                            <option value="Termination">Termination</option>
                            <option value="Resignation">Resignation</option>
                        </select>
                    </div>

                    {/* Attachment */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Attachment <span className="text-red-500">*</span></label>
                        <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 text-center hover:bg-gray-100 transition-colors">
                            <input
                                type="file"
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
