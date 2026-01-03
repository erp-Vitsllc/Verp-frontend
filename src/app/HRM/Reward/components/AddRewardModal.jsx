'use client';

import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddRewardModal({ isOpen, onClose, onSuccess, employees = [] }) {
    const { toast } = useToast();
    const [selectedRewardType, setSelectedRewardType] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [formData, setFormData] = useState({
        amount: '',
        giftName: '',
        attachment: null,
        attachmentBase64: '',
        attachmentName: '',
        attachmentMime: ''
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setFormData(prev => ({
                ...prev,
                attachment: null,
                attachmentBase64: '',
                attachmentName: '',
                attachmentMime: ''
            }));
            if (errors.attachment) {
                setErrors(prev => ({ ...prev, attachment: '' }));
            }
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setErrors(prev => ({ ...prev, attachment: 'Only PDF, JPEG, or PNG file formats are allowed' }));
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setFormData(prev => ({
                ...prev,
                attachment: file,
                attachmentBase64: base64,
                attachmentName: file.name,
                attachmentMime: file.type || 'application/pdf'
            }));
        };
        reader.readAsDataURL(file);

        if (errors.attachment) {
            setErrors(prev => ({ ...prev, attachment: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!selectedEmployeeId) {
            newErrors.employeeId = 'Please select an employee';
        }

        if (!selectedRewardType) {
            newErrors.rewardType = 'Please select a reward type';
        }

        if (selectedRewardType === 'Cash Reward') {
            if (!formData.amount || formData.amount.trim() === '') {
                newErrors.amount = 'Amount is required';
            } else if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
                newErrors.amount = 'Please enter a valid amount';
            }
            if (!formData.attachment) {
                newErrors.attachment = 'Attachment is required';
            }
        } else if (selectedRewardType === 'Gift Reward') {
            if (!formData.giftName || formData.giftName.trim() === '') {
                newErrors.giftName = 'Gift name is required';
            }
            if (!formData.amount || formData.amount.trim() === '') {
                newErrors.amount = 'Amount is required';
            } else if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
                newErrors.amount = 'Please enter a valid amount';
            }
            if (!formData.attachment) {
                newErrors.attachment = 'Attachment is required';
            }
        } else if (selectedRewardType === 'Certificate') {
            if (!formData.attachment) {
                newErrors.attachment = 'Attachment is required';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setSubmitting(true);

            // Find selected employee
            const selectedEmployee = employees.find(emp => emp.employeeId === selectedEmployeeId);
            if (!selectedEmployee) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Selected employee not found"
                });
                return;
            }

            // Validate selected reward type
            if (!selectedRewardType) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Please select a reward type"
                });
                return;
            }

            // Map reward type to backend format
            const rewardTypeMap = {
                'Cash Reward': 'Cash Reward',
                'Gift Reward': 'Gift Reward',
                'Certificate': 'Certificate'
            };

            // Build payload based on reward type
            const payload = {
                employeeId: selectedEmployeeId,
                rewardType: rewardTypeMap[selectedRewardType] || selectedRewardType,
                rewardStatus: 'Pending'
            };

            console.log('Frontend - selectedRewardType:', selectedRewardType);
            console.log('Frontend - payload.rewardType:', payload.rewardType);
            console.log('Frontend - payload.employeeId:', payload.employeeId);
            console.log('Frontend - Full payload:', JSON.stringify(payload, null, 2));

            // Add amount only for Cash Reward and Gift Reward
            if (selectedRewardType === 'Cash Reward' || selectedRewardType === 'Gift Reward') {
                const parsedAmount = parseFloat(formData.amount);
                if (!isNaN(parsedAmount) && parsedAmount > 0) {
                    payload.amount = parsedAmount;
                }
            }

            // Add description only for Gift Reward
            if (selectedRewardType === 'Gift Reward' && formData.giftName) {
                payload.description = `Gift: ${formData.giftName}`;
            }

            // Add attachment if provided (required for all reward types)
            if (formData.attachmentBase64) {
                payload.attachment = {
                    data: formData.attachmentBase64,
                    name: formData.attachmentName || 'reward-attachment.pdf',
                    mimeType: formData.attachmentMime || 'application/pdf'
                };
            } else {
                // Attachment is required but missing - this should be caught by validation
                console.error('Attachment is missing from form data');
            }

            console.log('Frontend - Full payload with attachment check:', {
                ...payload,
                attachment: payload.attachment ? 'present' : 'MISSING'
            });

            const response = await axiosInstance.post('/Reward', payload);

            toast({
                variant: "default",
                title: "Success",
                description: "Reward submitted for approval successfully"
            });

            // Reset form
            setSelectedRewardType('');
            setSelectedEmployeeId('');
            setFormData({
                amount: '',
                giftName: '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: '',
                attachmentMime: ''
            });
            setErrors({});

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "Failed to submit reward";
            toast({
                variant: "destructive",
                title: "Error",
                description: errorMessage
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!submitting) {
            setSelectedRewardType('');
            setSelectedEmployeeId('');
            setFormData({
                amount: '',
                giftName: '',
                attachment: null,
                attachmentBase64: '',
                attachmentName: '',
                attachmentMime: ''
            });
            setErrors({});
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[85vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Add Reward</h3>
                    <button
                        onClick={handleClose}
                        disabled={submitting}
                        className="absolute right-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-2 space-y-4 mt-4">
                    {/* Employee Selection */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Employee <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => {
                                    setSelectedEmployeeId(e.target.value);
                                    if (errors.employeeId) {
                                        setErrors(prev => ({ ...prev, employeeId: '' }));
                                    }
                                }}
                                className={`w-full h-10 px-3 rounded-xl border ${errors.employeeId ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                disabled={submitting}
                            >
                                <option value="">Select Employee</option>
                                {employees.map((emp) => (
                                    <option key={emp._id || emp.employeeId} value={emp.employeeId}>
                                        {emp.employeeId} - {emp.firstName} {emp.lastName}
                                    </option>
                                ))}
                            </select>
                            {errors.employeeId && (
                                <p className="text-xs text-red-500">{errors.employeeId}</p>
                            )}
                        </div>
                    </div>

                    {/* Reward Type Selection */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                            Reward Type <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full md:flex-1 flex flex-col gap-1">
                            <select
                                value={selectedRewardType}
                                onChange={(e) => {
                                    setSelectedRewardType(e.target.value);
                                    // Reset form data when type changes
                                    setFormData({
                                        amount: '',
                                        giftName: '',
                                        attachment: null,
                                        attachmentBase64: '',
                                        attachmentName: '',
                                        attachmentMime: ''
                                    });
                                    setErrors({});
                                }}
                                className={`w-full h-10 px-3 rounded-xl border ${errors.rewardType ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                disabled={submitting}
                            >
                                <option value="">Select Reward Type</option>
                                <option value="Cash Reward">Cash Reward</option>
                                <option value="Gift Reward">Gift Reward</option>
                                <option value="Certificate">Certificate</option>
                            </select>
                            {errors.rewardType && (
                                <p className="text-xs text-red-500">{errors.rewardType}</p>
                            )}
                        </div>
                    </div>

                    {/* Conditional Form Fields */}
                    {selectedRewardType && (
                        <div className="bg-gray-50 rounded-xl p-6 space-y-4 border border-gray-200">
                            {selectedRewardType === 'Cash Reward' && (
                                <>
                                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                            Amount <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-1">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.amount}
                                                onChange={(e) => {
                                                    setFormData(prev => ({ ...prev, amount: e.target.value }));
                                                    if (errors.amount) {
                                                        setErrors(prev => ({ ...prev, amount: '' }));
                                                    }
                                                }}
                                                placeholder="Enter the reward amount"
                                                className={`w-full h-10 px-3 rounded-xl border ${errors.amount ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                disabled={submitting}
                                            />
                                            {errors.amount && (
                                                <p className="text-xs text-red-500">{errors.amount}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            Attachment <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleFileChange}
                                                className={`w-full h-10 px-3 rounded-xl border ${errors.attachment ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2`}
                                                disabled={submitting}
                                            />
                                            {errors.attachment && (
                                                <p className="text-xs text-red-500">{errors.attachment}</p>
                                            )}
                                            {formData.attachment && (
                                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                    <span>{formData.attachmentName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {selectedRewardType === 'Gift Reward' && (
                                <>
                                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                            Gift Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-1">
                                            <input
                                                type="text"
                                                value={formData.giftName}
                                                onChange={(e) => {
                                                    setFormData(prev => ({ ...prev, giftName: e.target.value }));
                                                    if (errors.giftName) {
                                                        setErrors(prev => ({ ...prev, giftName: '' }));
                                                    }
                                                }}
                                                placeholder="Enter the name of the gift"
                                                className={`w-full h-10 px-3 rounded-xl border ${errors.giftName ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                disabled={submitting}
                                            />
                                            {errors.giftName && (
                                                <p className="text-xs text-red-500">{errors.giftName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                            Amount <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-1">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.amount}
                                                onChange={(e) => {
                                                    setFormData(prev => ({ ...prev, amount: e.target.value }));
                                                    if (errors.amount) {
                                                        setErrors(prev => ({ ...prev, amount: '' }));
                                                    }
                                                }}
                                                placeholder="Enter the monetary value of the gift"
                                                className={`w-full h-10 px-3 rounded-xl border ${errors.amount ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                disabled={submitting}
                                            />
                                            {errors.amount && (
                                                <p className="text-xs text-red-500">{errors.amount}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            Attachment <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleFileChange}
                                                className={`w-full h-10 px-3 rounded-xl border ${errors.attachment ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2`}
                                                disabled={submitting}
                                            />
                                            {errors.attachment && (
                                                <p className="text-xs text-red-500">{errors.attachment}</p>
                                            )}
                                            {formData.attachment && (
                                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                    <span>{formData.attachmentName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {selectedRewardType === 'Certificate' && (
                                <div className="flex flex-col md:flex-row md:items-start gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Attachment <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border ${errors.attachment ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2`}
                                            disabled={submitting}
                                        />
                                        {errors.attachment && (
                                            <p className="text-xs text-red-500">{errors.attachment}</p>
                                        )}
                                        {formData.attachment && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>{formData.attachmentName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={submitting}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !selectedRewardType}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

