'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Search, ChevronDown, Check } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddRewardModal({ isOpen, onClose, onSuccess, employees = [], initialData = null, isEditing = false, isResubmitting = false }) {
    const { toast } = useToast();
    const [selectedRewardType, setSelectedRewardType] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [formData, setFormData] = useState({
        amount: '',
        giftName: '',
        title: '',
        resubmitComment: ''
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Searchable dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredEmployees = employees.filter(emp =>
        emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedEmployee = employees.find(emp => emp.employeeId === selectedEmployeeId);

    // Populate form data when editing or resubmitting
    useEffect(() => {
        if (isOpen && initialData && (isEditing || isResubmitting)) {
            setSelectedRewardType(initialData.rewardType || '');
            setSelectedEmployeeId(initialData.employeeId || '');
            setFormData({
                amount: initialData.amount ? String(initialData.amount) : '',
                giftName: initialData.description?.replace('Gift: ', '') || '', // Extract gift name if possible
                title: initialData.title || '',
                resubmitComment: '' // Clear comment on open
            });
        } else if (isOpen && !isEditing && !isResubmitting) {
            // Reset if opening in add mode
            setSelectedRewardType('');
            setSelectedEmployeeId('');
            setFormData({ amount: '', giftName: '', title: '', resubmitComment: '' });
        }
    }, [isOpen, initialData, isEditing, isResubmitting]);

    if (!isOpen) return null;

    const validateForm = () => {
        const newErrors = {};

        if (!selectedEmployeeId) {
            newErrors.employeeId = 'Please select an employee';
        }

        if (!selectedRewardType) {
            newErrors.rewardType = 'Please select a reward type';
        }

        if (!formData.title || formData.title.trim() === '') {
            newErrors.title = 'Title is required';
        }

        if (selectedRewardType === 'Cash Reward') {
            if (!formData.amount || formData.amount.trim() === '') {
                newErrors.amount = 'Amount is required';
            } else if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
                newErrors.amount = 'Please enter a valid amount';
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
        }
        // Certificate type only needs Title now

        if (isResubmitting && (!formData.resubmitComment || formData.resubmitComment.trim() === '')) {
            newErrors.resubmitComment = 'Resubmission comment is required';
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
                title: formData.title
            };

            if (!isEditing) {
                payload.rewardStatus = 'Draft';
            }

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

            if (isResubmitting) {
                payload.resubmit = true;
                payload.remarks = formData.resubmitComment;
                // For resubmitting, we usually want to move it to 'Pending' overall
                payload.rewardStatus = 'Pending';
            }

            let response;
            if ((isEditing || isResubmitting) && initialData?._id) {
                // Update existing reward
                response = await axiosInstance.put(`/Reward/${initialData._id}`, payload);
                toast({
                    variant: "default",
                    title: "Success",
                    description: isResubmitting ? "Reward resubmitted successfully" : "Reward updated successfully"
                });
            } else {
                // Create new reward
                response = await axiosInstance.post('/Reward', payload);
                toast({
                    variant: "default",
                    title: "Success",
                    description: isResubmitting ? "Reward resubmitted successfully" : "Reward drafted successfully"
                });
            }

            // Reset form
            setSelectedRewardType('');
            setSelectedEmployeeId('');
            setFormData({
                amount: '',
                giftName: '',
                title: '',
                resubmitComment: ''
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
                title: ''
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
                    <h3 className="text-[22px] font-semibold text-gray-800">{isEditing ? 'Edit Reward' : 'Add Reward'}</h3>
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
                        <div className="w-full md:flex-1 flex flex-col gap-1 relative" ref={dropdownRef}>
                            <div
                                onClick={() => !submitting && setIsDropdownOpen(!isDropdownOpen)}
                                className={`w-full h-11 px-4 flex items-center justify-between rounded-xl border cursor-pointer transition-all ${errors.employeeId ? 'border-red-400 bg-red-50/10' : 'border-[#E5E7EB] bg-[#F7F9FC]'
                                    } ${isDropdownOpen ? 'ring-2 ring-blue-500/20 border-blue-400' : ''}`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {selectedEmployee ? (
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                {selectedEmployee.firstName?.[0]}
                                            </div>
                                            <span className="text-sm font-medium text-gray-800 truncate">
                                                {selectedEmployee.employeeId} - {selectedEmployee.firstName} {selectedEmployee.lastName}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-400">Search Employee...</span>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+5px)] left-0 right-0 z-[60] bg-white border border-gray-100 shadow-xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-3 border-b border-gray-50 flex items-center gap-2 bg-slate-50/50">
                                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Type name or ID to search..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-400"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>

                                    <div className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                        {filteredEmployees.length > 0 ? (
                                            filteredEmployees.map((emp) => {
                                                const isSelected = selectedEmployeeId === emp.employeeId;
                                                return (
                                                    <div
                                                        key={emp._id || emp.employeeId}
                                                        onClick={() => {
                                                            setSelectedEmployeeId(emp.employeeId);
                                                            setIsDropdownOpen(false);
                                                            setSearchQuery('');
                                                            if (errors.employeeId) {
                                                                setErrors(prev => ({ ...prev, employeeId: '' }));
                                                            }
                                                        }}
                                                        className={`px-4 py-3 flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50' : ''
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                                                                }`}>
                                                                {emp.firstName?.[0]}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                                                    {emp.firstName} {emp.lastName}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{emp.employeeId}</span>
                                                            </div>
                                                        </div>
                                                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-10 text-center flex flex-col items-center justify-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                                                    <Search className="w-5 h-5 text-slate-300" />
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">No results found for "{searchQuery}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {errors.employeeId && (
                                <p className="text-xs text-red-500 mt-1 pl-1">{errors.employeeId}</p>
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
                                        title: ''
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
                            {/* Title Field (Common for all) */}
                            <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, title: e.target.value }));
                                            if (errors.title) {
                                                setErrors(prev => ({ ...prev, title: '' }));
                                            }
                                        }}
                                        placeholder="Enter the title of the reward"
                                        className={`w-full h-10 px-3 rounded-xl border ${errors.title ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                        disabled={submitting}
                                    />
                                    {errors.title && (
                                        <p className="text-xs text-red-500">{errors.title}</p>
                                    )}
                                </div>
                            </div>

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
                                </>
                            )}
                            {/* Certificate doesn't need specific fields anymore as Title is common */}

                            {isResubmitting && (
                                <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                        Resubmit Comment <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <textarea
                                            value={formData.resubmitComment}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, resubmitComment: e.target.value }));
                                                if (errors.resubmitComment) {
                                                    setErrors(prev => ({ ...prev, resubmitComment: '' }));
                                                }
                                            }}
                                            placeholder="Explain changes or give context for resubmission..."
                                            className={`w-full min-h-[80px] p-3 rounded-xl border ${errors.resubmitComment ? 'border-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 text-sm`}
                                            disabled={submitting}
                                        />
                                        {errors.resubmitComment && (
                                            <p className="text-xs text-red-500">{errors.resubmitComment}</p>
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
                            {submitting ? 'Saving...' : (isResubmitting ? 'Resubmit' : (isEditing ? 'Save' : 'Add Reward'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

