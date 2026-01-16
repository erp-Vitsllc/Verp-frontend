'use client';

import { useRef } from 'react';
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function SalaryModal({
    isOpen,
    onClose,
    salaryForm,
    setSalaryForm,
    salaryFormErrors,
    setSalaryFormErrors,
    savingSalary,
    uploadingDocument,
    editingSalaryIndex,
    hasSalaryDetails,
    monthOptions,
    employee,
    onSalaryChange,
    onOfferLetterFileChange,
    onSaveSalary,
    setViewingDocument,
    setShowDocumentViewer,
    mode = 'view' // 'view', 'add', 'edit', 'increment'
}) {
    const offerLetterFileRef = useRef(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {mode === 'increment' ? 'Increment Salary' : mode === 'edit' ? 'Edit Salary Details' : 'Add Salary Details'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                        disabled={savingSalary || uploadingDocument}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                    <div className="flex flex-col gap-3">
                        {/* From Date - Month/Year only */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                For Month <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <MonthYearPicker
                                    value={salaryForm.fromDate}
                                    onChange={(val) => {
                                        onSalaryChange('fromDate', val);
                                        // Also auto-set the month string if needed for legacy compatibility, 
                                        // or better yet, rely on fromDate. 
                                        // For now, let's just set the error to empty.
                                        if (salaryFormErrors.fromDate) {
                                            setSalaryFormErrors(prev => ({ ...prev, fromDate: '' }));
                                        }
                                    }}
                                    placeholder="Select Month & Year"
                                    className={`w-full ${salaryFormErrors.fromDate
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-[#E5E7EB]'
                                        }`}
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.fromDate && (
                                    <span className="text-xs text-red-500 mt-1">
                                        {salaryFormErrors.fromDate}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Basic Salary */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Basic Salary <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={salaryForm.basic}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/[^0-9.]/g, '');
                                        onSalaryChange('basic', value);
                                        if (salaryFormErrors.basic) {
                                            setSalaryFormErrors(prev => ({ ...prev, basic: '' }));
                                        }
                                    }}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.basic
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="Enter basic salary"
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.basic && (
                                    <span className="text-xs text-red-500 mt-1">
                                        {salaryFormErrors.basic}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* House Rent Allowance */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                House Rent Allowance
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={salaryForm.houseRentAllowance}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/[^0-9.]/g, '');
                                        onSalaryChange('houseRentAllowance', value);
                                        if (salaryFormErrors.houseRentAllowance) {
                                            setSalaryFormErrors(prev => ({ ...prev, houseRentAllowance: '' }));
                                        }
                                    }}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.houseRentAllowance
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="Enter house rent allowance"
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.houseRentAllowance && (
                                    <span className="text-xs text-red-500 mt-1">
                                        {salaryFormErrors.houseRentAllowance}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Vehicle Allowance */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Vehicle Allowance
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={salaryForm.vehicleAllowance}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/[^0-9.]/g, '');
                                        onSalaryChange('vehicleAllowance', value);
                                        if (salaryFormErrors.vehicleAllowance) {
                                            setSalaryFormErrors(prev => ({ ...prev, vehicleAllowance: '' }));
                                        }
                                    }}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.vehicleAllowance
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="Enter vehicle allowance"
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.vehicleAllowance && (
                                    <span className="text-xs text-red-500 mt-1">
                                        {salaryFormErrors.vehicleAllowance}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Fuel Allowance */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Fuel Allowance
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={salaryForm.fuelAllowance}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/[^0-9.]/g, '');
                                        onSalaryChange('fuelAllowance', value);
                                        if (salaryFormErrors.fuelAllowance) {
                                            setSalaryFormErrors(prev => ({ ...prev, fuelAllowance: '' }));
                                        }
                                    }}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.fuelAllowance
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="Enter fuel allowance"
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.fuelAllowance && (
                                    <span className="text-xs text-red-500 mt-1">
                                        {salaryFormErrors.fuelAllowance}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Other Allowance */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Other Allowance
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={salaryForm.otherAllowance}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/[^0-9.]/g, '');
                                        onSalaryChange('otherAllowance', value);
                                        if (salaryFormErrors.otherAllowance) {
                                            setSalaryFormErrors(prev => ({ ...prev, otherAllowance: '' }));
                                        }
                                    }}
                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.otherAllowance
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-[#E5E7EB]'
                                        }`}
                                    placeholder="Enter other allowance"
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.otherAllowance && (
                                    <span className="text-xs text-red-500 mt-1">
                                        {salaryFormErrors.otherAllowance}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Total Salary (Read-only) */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Total Salary
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                <input
                                    type="text"
                                    value={salaryForm.totalSalary || '0.00'}
                                    readOnly
                                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-gray-100 text-gray-800 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Offer Letter */}
                        <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                Salary Letter {!hasSalaryDetails && <span className="text-red-500">*</span>}
                            </label>
                            <div className="w-full md:flex-1 flex flex-col gap-2">
                                <input
                                    ref={offerLetterFileRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={onOfferLetterFileChange}
                                    className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${salaryFormErrors.offerLetter ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                    disabled={savingSalary || uploadingDocument}
                                />
                                {salaryFormErrors.offerLetter && (
                                    <p className="text-xs text-red-500">{salaryFormErrors.offerLetter}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Upload file in PDF format only (Max 5MB)</p>
                                {(() => {
                                    const hasOfferLetter = !!(salaryForm.offerLetterFile || salaryForm.offerLetterFileBase64 || salaryForm.offerLetterFileName);
                                    if (!hasOfferLetter) return null;

                                    return (
                                        <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20 6L9 17l-5-5"></path>
                                                </svg>
                                                <span>
                                                    {salaryForm.offerLetterFile ? salaryForm.offerLetterFile.name : salaryForm.offerLetterFileName || 'salary-letter.pdf'}
                                                </span>
                                            </div>
                                            {((salaryForm.offerLetterFileBase64 || salaryForm.offerLetterFile) && setViewingDocument) && (
                                                <button
                                                    onClick={() => {
                                                        if (salaryForm.offerLetterFileBase64) {
                                                            // Check if it's a Cloudinary URL or base64 data
                                                            if (salaryForm.offerLetterFileBase64.startsWith('http')) {
                                                                // Cloudinary URL - fetch from server
                                                                const fetchDocument = async () => {
                                                                    try {
                                                                        const axiosInstance = (await import('@/utils/axios')).default;
                                                                        const response = await axiosInstance.get(`/Employee/${employee.id || employee._id || employee.employeeId}/document`, {
                                                                            params: { type: 'offerLetter' }
                                                                        });

                                                                        if (response.data && response.data.data) {
                                                                            setViewingDocument({
                                                                                data: response.data.data,
                                                                                name: response.data.name || salaryForm.offerLetterFileName || 'Salary Letter.pdf',
                                                                                mimeType: response.data.mimeType || salaryForm.offerLetterFileMime || 'application/pdf'
                                                                            });
                                                                            setShowDocumentViewer(true);
                                                                        } else {
                                                                            alert('Failed to load document data');
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Error fetching document:', err);
                                                                        alert('Error fetching document. Please try again.');
                                                                    }
                                                                };
                                                                fetchDocument();
                                                            } else {
                                                                // Base64 data - use directly
                                                                setViewingDocument({
                                                                    data: salaryForm.offerLetterFileBase64,
                                                                    name: salaryForm.offerLetterFileName || 'Salary Letter.pdf',
                                                                    mimeType: salaryForm.offerLetterFileMime || 'application/pdf'
                                                                });
                                                                setShowDocumentViewer(true);
                                                            }
                                                        } else if (salaryForm.offerLetterFile) {
                                                            // New file selected - read it
                                                            const reader = new FileReader();
                                                            reader.onload = (e) => {
                                                                const base64 = e.target.result.split(',')[1];
                                                                setViewingDocument({
                                                                    data: base64,
                                                                    name: salaryForm.offerLetterFile.name,
                                                                    mimeType: salaryForm.offerLetterFile.type || 'application/pdf'
                                                                });
                                                                setShowDocumentViewer(true);
                                                            };
                                                            reader.readAsDataURL(salaryForm.offerLetterFile);
                                                        }
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium underline"
                                                    disabled={savingSalary || uploadingDocument}
                                                >
                                                    View
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-lg bg-white border border-white px-6 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                        disabled={savingSalary || uploadingDocument}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSaveSalary(mode)}
                        disabled={savingSalary || uploadingDocument}
                        className="rounded-lg bg-blue-600 border border-blue-600 px-6 py-2 text-sm font-semibold !text-white transition hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {uploadingDocument ? (
                            <>
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Uploading...</span>
                            </>
                        ) : savingSalary ? (
                            <>
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span className="text-white">
                                {mode === 'increment' ? 'Save Increment' : mode === 'edit' ? 'Save Changes' : 'Save Details'}
                            </span>
                        )}
                    </button>

                </div>
            </div>
        </div>
    );
}
