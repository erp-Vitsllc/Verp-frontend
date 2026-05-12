'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Plus, FileText, Trash2, CheckCircle, RotateCcw } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";

export default function CertificateModal({
    isOpen,
    onClose,
    onSuccess,
    targetType = 'company', // 'company' or 'employee'
    targetId,
    targetName
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    const [formData, setFormData] = useState({
        type: '',
        certificateType: '',
        otherType: '',
        issuedBy: '',
        description: '',
        issueDate: '',
        hasExpiry: 'no',
        expiryDate: '',
        issuedTo: '', // company or employee ID/name
        attachment: null,
        fileName: ''
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (targetType === 'company') {
                fetchEmployees();
            }
            // Default issuedTo to targetName if available
            setFormData({
                type: '',
                certificateType: '',
                otherType: '',
                issuedBy: '',
                description: '',
                issueDate: '',
                hasExpiry: 'no',
                expiryDate: '',
                issuedTo: targetName || '',
                attachment: null,
                fileName: ''
            });
            setErrors({});
        }
    }, [isOpen, targetName, targetType]);

    const fetchEmployees = async () => {
        try {
            setLoadingEmployees(true);
            const response = await axiosInstance.get('/Employee');
            const empData = Array.isArray(response.data) ? response.data : (response.data.employees || []);
            setEmployees(empData);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    attachment: reader.result,
                    fileName: file.name
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.type) newErrors.type = 'Type is required';
        if (!formData.issuedBy) newErrors.issuedBy = 'Issuer is required';
        if (!formData.issueDate) newErrors.issueDate = 'Issue date is required';
        if (formData.hasExpiry === 'yes' && !formData.expiryDate) {
            newErrors.expiryDate = 'Expiry date is required';
        }
        if (!formData.issuedTo) newErrors.issuedTo = 'Issued to is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            setLoading(true);
            
            let attachmentUrl = '';

            // 1. Upload file if exists
            if (formData.attachment) {
                const uploadEndpoint = targetType === 'company' 
                    ? `/Company/${targetId}/upload` 
                    : `/Employee/upload-document/${targetId}`;
                
                const uploadRes = await axiosInstance.post(uploadEndpoint, {
                    fileData: formData.attachment,
                    fileName: formData.fileName,
                    folder: targetType === 'company' ? `company-documents/certificates` : `employee-documents/certificates`
                });
                attachmentUrl = uploadRes.data.url;
            }

            // 2. Prepare the new document object
            const metaInfo = `Issued By: ${formData.issuedBy} | Issued To: ${formData.issuedTo} | ${formData.description}`;
            
            const hasFile = Boolean(formData.fileName && String(formData.fileName).trim());
            let mimeFromName = 'application/pdf';
            if (hasFile) {
                const lower = formData.fileName.toLowerCase();
                if (lower.endsWith('.pdf')) mimeFromName = 'application/pdf';
                else if (lower.endsWith('.png')) mimeFromName = 'image/png';
                else if (/\.jpe?g$/i.test(formData.fileName)) mimeFromName = 'image/jpeg';
                else if (lower.endsWith('.gif')) mimeFromName = 'image/gif';
                else if (lower.endsWith('.webp')) mimeFromName = 'image/webp';
            }
            const newDoc = {
                type: formData.type,
                description: metaInfo,
                context: 'Certificate',
                issueDate: formData.issueDate,
                expiryDate: formData.hasExpiry === 'yes' ? formData.expiryDate : '',
                ...(hasFile || attachmentUrl
                    ? {
                        document: {
                            url: attachmentUrl,
                            name: formData.fileName,
                            mimeType: mimeFromName,
                        },
                    }
                    : {}),
            };

            // 3. Update the target entity
            if (targetType === 'company') {
                const compRes = await axiosInstance.get(`/Company/${targetId}`);
                const currentCompany = compRes.data.company;
                const updatedDocs = [...(currentCompany.documents || []), newDoc];
                const updatedTabs = Array.from(new Set([...(currentCompany.customTabs || []), 'Certificate']));
                await axiosInstance.patch(`/Company/${targetId}`, { 
                    documents: updatedDocs,
                    customTabs: updatedTabs
                });
            } else {
                const empRes = await axiosInstance.get(`/Employee/${targetId}`);
                const currentEmployee = empRes.data;
                const updatedDocs = [...(currentEmployee.documents || []), newDoc];
                await axiosInstance.patch(`/Employee/${targetId}`, { 
                    documents: updatedDocs
                });
            }
            
            toast({
                title: "Success",
                description: "Certificate added successfully",
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error adding certificate:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.response?.data?.message || "Failed to add certificate",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[600px] overflow-hidden animate-in zoom-in duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Add Certificate</h3>
                        <p className="text-sm text-gray-500 mt-1">Fill in the details to add a new certificate</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
                    <div className="space-y-6 overflow-y-auto p-8 modal-scroll">
                        {/* Certificate Type */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Certificate Type</label>
                                <select
                                    value={formData.certificateType || ''}
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        certificateType: e.target.value,
                                        type: e.target.value === 'Others' ? (prev.otherType || '') : e.target.value 
                                    }))}
                                    className={`w-full h-11 px-4 rounded-xl border ${errors.type ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                                >
                                    <option value="">Select Certificate Type</option>
                                    <option value="Installer">Installer</option>
                                    <option value="Safety">Safety</option>
                                    <option value="Administration">Administration</option>
                                    <option value="Others">Others</option>
                                </select>
                                {errors.type && <p className="text-xs text-red-500 font-medium">{errors.type}</p>}
                            </div>

                            {formData.certificateType === 'Others' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-sm font-semibold text-gray-700">Specify Other Type</label>
                                    <input
                                        type="text"
                                        value={formData.otherType || ''}
                                        onChange={(e) => setFormData(prev => ({ 
                                            ...prev, 
                                            otherType: e.target.value,
                                            type: e.target.value 
                                        }))}
                                        placeholder="Enter certificate type"
                                        className={`w-full h-11 px-4 rounded-xl border ${errors.type ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Issued By */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Certificate Issued By</label>
                            <input
                                type="text"
                                value={formData.issuedBy}
                                onChange={(e) => setFormData(prev => ({ ...prev, issuedBy: e.target.value }))}
                                placeholder="Enter organization name"
                                className={`w-full h-11 px-4 rounded-xl border ${errors.issuedBy ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                            />
                            {errors.issuedBy && <p className="text-xs text-red-500 font-medium">{errors.issuedBy}</p>}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Certificate Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter any additional details"
                                className="w-full min-h-[100px] p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Issue Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Issue Date</label>
                                <DatePicker
                                    value={formData.issueDate}
                                    onChange={(date) => setFormData(prev => ({ ...prev, issueDate: date }))}
                                    placeholder="Select date"
                                    className="w-full h-11"
                                />
                                {errors.issueDate && <p className="text-xs text-red-500 font-medium">{errors.issueDate}</p>}
                            </div>

                            {/* Expiry Toggle */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Has Expiry?</label>
                                <div className="flex items-center gap-4 h-11">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="hasExpiry"
                                            value="yes"
                                            checked={formData.hasExpiry === 'yes'}
                                            onChange={(e) => setFormData(prev => ({ ...prev, hasExpiry: e.target.value }))}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="hasExpiry"
                                            value="no"
                                            checked={formData.hasExpiry === 'no'}
                                            onChange={(e) => setFormData(prev => ({ ...prev, hasExpiry: e.target.value }))}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">No</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Expiry Date (Conditional) */}
                        {formData.hasExpiry === 'yes' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                <label className="text-sm font-semibold text-gray-700">Expiry Date</label>
                                <DatePicker
                                    value={formData.expiryDate}
                                    onChange={(date) => setFormData(prev => ({ ...prev, expiryDate: date }))}
                                    placeholder="Select expiry date"
                                    className="w-full h-11"
                                />
                                {errors.expiryDate && <p className="text-xs text-red-500 font-medium">{errors.expiryDate}</p>}
                            </div>
                        )}

                        {/* Issued To */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Certificate Issued To</label>
                            <select
                                value={formData.issuedTo}
                                onChange={(e) => setFormData(prev => ({ ...prev, issuedTo: e.target.value }))}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.issuedTo ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all`}
                            >
                                <option value="">Select recipient</option>
                                {targetName ? (
                                    <optgroup label="Company">
                                        <option value={targetName}>{targetName}</option>
                                    </optgroup>
                                ) : null}
                                <optgroup label="Employees">
                                    {employees.map(emp => (
                                        <option key={emp._id || emp.id} value={`${emp.firstName} ${emp.lastName}`}>
                                            {emp.firstName} {emp.lastName} ({emp.employeeId})
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            {errors.issuedTo && <p className="text-xs text-red-500 font-medium">{errors.issuedTo}</p>}
                        </div>

                        {/* Attachment */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Certificate Attachment</label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className={`w-full h-24 border-2 border-dashed ${formData.attachment ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'} group-hover:border-blue-400 group-hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all`}>
                                    {formData.attachment ? (
                                        <>
                                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                <CheckCircle size={18} />
                                            </div>
                                            <span className="text-sm font-semibold text-green-700 truncate max-w-[250px]">{formData.fileName}</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                <Upload size={18} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-500">Upload Certificate File</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-4 border-t border-gray-100 bg-gray-50/50 p-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-11 rounded-xl px-6 text-sm font-bold text-gray-600 transition-all hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <RotateCcw className="animate-spin" size={18} />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Plus size={18} />
                                    Add Certificate
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
