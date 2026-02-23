'use client';

import { useState, useEffect } from 'react';
import { X, Save, FileText, Calendar } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function VehicleDocumentModal({ isOpen, onClose, onSuccess, assetId, docType, existingDoc, isRenew }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        documentType: docType || '',
        issueAuthority: '',
        issueDate: '',
        expiryDate: '',
        description: '',
        file: null,
        fileName: '',
        fileBase64: '',
        fileMime: ''
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (existingDoc && !isRenew) {
                // EDIT mode: Pre-populate form with existing document data
                setFormData({
                    documentType: existingDoc.type || docType || '',
                    issueAuthority: existingDoc.issueAuthority || '',
                    issueDate: existingDoc.issueDate ? existingDoc.issueDate.substring(0, 10) : '',
                    expiryDate: existingDoc.expiryDate ? existingDoc.expiryDate.substring(0, 10) : '',
                    description: existingDoc.description || '',
                    file: null,
                    fileName: '',
                    fileBase64: '',
                    fileMime: ''
                });
            } else {
                // ADD or RENEW mode: blank form
                setFormData({
                    documentType: docType || '',
                    issueAuthority: '',
                    issueDate: '',
                    expiryDate: '',
                    description: '',
                    file: null,
                    fileName: '',
                    fileBase64: '',
                    fileMime: ''
                });
            }
            setErrors({});
        }
    }, [isOpen, existingDoc, isRenew]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({
                ...prev,
                file,
                fileName: file.name,
                fileBase64: base64,
                fileMime: file.type || 'application/pdf'
            }));
        };
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.documentType) newErrors.documentType = 'Document type is required';
        if (!formData.issueAuthority) newErrors.issueAuthority = 'Issue authority is required';
        if (!formData.issueDate) newErrors.issueDate = 'Issue date is required';
        if (!formData.expiryDate) newErrors.expiryDate = 'Expiry date is required';
        // File required when adding new doc OR renewing (fresh upload needed)
        if ((!existingDoc || isRenew) && !formData.fileBase64) newErrors.file = 'Document file is required';

        if (formData.issueDate && formData.expiryDate) {
            if (new Date(formData.expiryDate) <= new Date(formData.issueDate)) {
                newErrors.expiryDate = 'Expiry date must be after issue date';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const payload = {
                type: formData.documentType,
                issueAuthority: formData.issueAuthority,
                issueDate: formData.issueDate,
                expiryDate: formData.expiryDate,
                description: formData.description,
            };

            // Only include document file if a new one was selected
            if (formData.fileBase64) {
                payload.document = {
                    name: formData.fileName,
                    data: formData.fileBase64,
                    mimeType: formData.fileMime
                };
            }

            if (existingDoc) {
                // EDIT or RENEW: use PUT with MongoDB document _id to replace old data
                await axiosInstance.put(`/AssetItem/${assetId}/document/${existingDoc._id}`, payload);
                toast({ title: 'Success', description: isRenew ? `${formData.documentType} renewed successfully` : `${formData.documentType} updated successfully` });
            } else {
                // Add new document
                await axiosInstance.post(`/AssetItem/${assetId}/document`, payload);
                toast({ title: 'Success', description: `${formData.documentType} added successfully` });
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving document:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to save document'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[22px] shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <FileText size={20} className={isRenew ? 'text-teal-500' : 'text-blue-600'} />
                        {isRenew ? `Renew ${docType}` : existingDoc ? `Edit ${formData.documentType}` : `Add ${docType}`}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Document Type</label>
                        <input
                            type="text"
                            placeholder="Enter document type (e.g. Mulkia, Insurance, License)"
                            value={formData.documentType}
                            onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                            className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.documentType ? 'border-red-300' : 'border-gray-200'}`}
                        />
                        {errors.documentType && <p className="text-[10px] text-red-500 font-medium">{errors.documentType}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Issue Authority</label>
                        <input
                            type="text"
                            placeholder="Enter issuing authority"
                            value={formData.issueAuthority}
                            onChange={(e) => setFormData({ ...formData, issueAuthority: e.target.value })}
                            className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.issueAuthority ? 'border-red-300' : 'border-gray-200'}`}
                        />
                        {errors.issueAuthority && <p className="text-[10px] text-red-500 font-medium">{errors.issueAuthority}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                                <Calendar size={14} /> Issue Date
                            </label>
                            <input
                                type="date"
                                value={formData.issueDate}
                                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.issueDate ? 'border-red-300' : 'border-gray-200'}`}
                            />
                            {errors.issueDate && <p className="text-[10px] text-red-500 font-medium">{errors.issueDate}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                                <Calendar size={14} /> Expiry Date
                            </label>
                            <input
                                type="date"
                                value={formData.expiryDate}
                                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                className={`w-full p-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all ${errors.expiryDate ? 'border-red-300' : 'border-gray-200'}`}
                            />
                            {errors.expiryDate && <p className="text-[10px] text-red-500 font-medium">{errors.expiryDate}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Note (Description)</label>
                        <textarea
                            placeholder="Enter any additional details"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500">Document File</label>
                        <div className={`relative flex items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${errors.file ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                            <div className="text-center">
                                {formData.fileName ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <FileText className="text-blue-600" size={24} />
                                        <p className="text-xs font-medium text-gray-700 max-w-[200px] truncate">{formData.fileName}</p>
                                        <p className="text-[10px] text-gray-400">Click to change</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1">
                                            <FileText size={20} />
                                        </div>
                                        <p className="text-xs font-medium text-gray-600">Click to upload document</p>
                                        <p className="text-[10px] text-gray-400">PDF, JPG or PNG (Max 5MB)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {errors.file && <p className="text-[10px] text-red-500 font-medium">{errors.file}</p>}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`px-6 py-2 rounded-xl text-white font-semibold text-sm transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${isRenew
                                    ? 'bg-teal-500 hover:bg-teal-600 shadow-teal-100'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                                }`}
                            disabled={loading}
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                            {isRenew ? 'Save & Renew' : existingDoc ? 'Update Document' : 'Save Document'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
