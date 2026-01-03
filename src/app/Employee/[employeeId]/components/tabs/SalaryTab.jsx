'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isAdmin } from '@/utils/permissions';
// Import cards directly to test if DynamicCards re-exports are causing issues
import SalaryDetailsCard from '../cards/SalaryDetailsCard';
import BankAccountCard from '../cards/BankAccountCard';

export default function SalaryTab({
    employee,
    isAdmin,
    hasPermission,
    hasSalaryDetails,
    hasBankDetailsSection,
    formatDate,
    selectedSalaryAction,
    setSelectedSalaryAction,
    salaryHistoryPage,
    setSalaryHistoryPage,
    salaryHistoryItemsPerPage,
    setSalaryHistoryItemsPerPage,
    calculateTotalSalary,
    onOpenSalaryModal,
    onOpenBankModal,
    onViewDocument,
    onEditSalary,
    onDeleteSalary,
    editingSalaryIndex,
    setEditingSalaryIndex,
    setSalaryForm,
    setSalaryFormErrors,
    setShowSalaryModal,
    employeeId,
    fetchEmployee
}) {
    const { toast } = useToast();
    // Prepare salary history data
    let salaryHistoryData = employee?.salaryHistory || [];

    // Only add initial salary if it truly doesn't exist in history AND employee has basic/otherAllowance
    if (employee && (employee.basic || employee.otherAllowance) && salaryHistoryData.length === 0) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dateOfJoining = employee.dateOfJoining ? new Date(employee.dateOfJoining) : (employee.createdAt ? new Date(employee.createdAt) : new Date());
        const month = monthNames[dateOfJoining.getMonth()];
        const firstDayOfMonth = new Date(dateOfJoining.getFullYear(), dateOfJoining.getMonth(), 1);
        const initialBasic = employee.basic || 0;
        const initialOther = employee.otherAllowance || 0;
        const initialHRA = employee.houseRentAllowance || 0;
        const initialVehicle = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
        const initialFuel = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
        const initialTotal = initialBasic + initialOther + initialHRA + initialVehicle + initialFuel;

        const initialSalaryEntry = {
            month: month,
            fromDate: firstDayOfMonth,
            toDate: null,
            basic: initialBasic,
            houseRentAllowance: initialHRA,
            vehicleAllowance: initialVehicle,
            fuelAllowance: initialFuel,
            otherAllowance: initialOther,
            totalSalary: initialTotal,
            createdAt: dateOfJoining,
            isInitial: true
        };

        salaryHistoryData = [initialSalaryEntry];
    }

    // Display salary history in insertion order (latest first, no sorting)
    const sortedHistory = selectedSalaryAction === 'Salary History'
        ? [...salaryHistoryData]
        : [];
    const totalItems = sortedHistory.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / salaryHistoryItemsPerPage));
    const startIndex = (salaryHistoryPage - 1) * salaryHistoryItemsPerPage;
    const endIndex = startIndex + salaryHistoryItemsPerPage;
    const currentPageData = sortedHistory.slice(startIndex, endIndex);

    // Generate page numbers
    const getPageNumbers = () => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        if (pages.length === 0) {
            pages.push(1);
        }
        return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <SalaryDetailsCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    hasSalaryDetails={hasSalaryDetails}
                    onEdit={onOpenSalaryModal}
                    onViewOfferLetter={async () => {
                        // Quick check first
                        let offerLetter = null;
                        let offerLetterSource = null;

                        // Check salary history first
                        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory) && employee.salaryHistory.length > 0) {
                            const sortedHistory = [...employee.salaryHistory];
                            for (const entry of sortedHistory) {
                                if (entry.offerLetter) {
                                    offerLetter = entry.offerLetter;
                                    offerLetterSource = { type: 'salaryOfferLetter', docId: entry._id };
                                    break;
                                }
                            }
                        }

                        // Check main employee offer letter
                        if (!offerLetter && employee?.offerLetter) {
                            offerLetter = employee.offerLetter;
                            offerLetterSource = { type: 'offerLetter' };
                        }

                        if (!offerLetter) {
                            toast({
                                variant: "default",
                                title: "No salary letter found",
                                description: "No salary letter is available for this salary record."
                            });
                            return;
                        }

                        // Check if it's a Cloudinary URL or base64 data
                        const isCloudinaryUrl = offerLetter.url || (offerLetter.data && (offerLetter.data.startsWith('http://') || offerLetter.data.startsWith('https://')));
                        const documentData = offerLetter.url || offerLetter.data;

                        // If document is directly available (Cloudinary URL or base64), open immediately
                        if (documentData) {
                            if (isCloudinaryUrl) {
                                // Cloudinary URL - use directly (much faster!)
                                onViewDocument({
                                    data: documentData,
                                    name: offerLetter.name || 'Salary Letter.pdf',
                                    mimeType: offerLetter.mimeType || 'application/pdf',
                                    moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                });
                            } else {
                                // Base64 data - clean and use
                                let cleanData = documentData;
                                if (cleanData.includes(',')) {
                                    cleanData = cleanData.split(',')[1];
                                }

                                onViewDocument({
                                    data: cleanData,
                                    name: offerLetter.name || 'Salary Letter.pdf',
                                    mimeType: offerLetter.mimeType || 'application/pdf',
                                    moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                });
                            }
                        } else if (offerLetterSource && employeeId) {
                            // Open modal with loading state immediately
                            onViewDocument({
                                data: null, // Signal loading
                                name: offerLetter.name || 'Salary Letter.pdf',
                                mimeType: offerLetter.mimeType || 'application/pdf',
                                loading: true,
                                moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                            });

                            // Fetch in background
                            try {
                                const axiosInstance = (await import('@/utils/axios')).default;
                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                    params: offerLetterSource.docId
                                        ? { type: offerLetterSource.type, docId: offerLetterSource.docId }
                                        : { type: offerLetterSource.type }
                                });

                                if (response.data && response.data.data) {
                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                    if (isCloudinaryUrl) {
                                        // Cloudinary URL - use directly
                                        onViewDocument({
                                            data: response.data.data,
                                            name: response.data.name || offerLetter.name || 'Salary Letter.pdf',
                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                            moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                        });
                                    } else {
                                        // Base64 data - clean and use
                                        let cleanData = response.data.data;
                                        if (cleanData.includes(',')) {
                                            cleanData = cleanData.split(',')[1];
                                        }

                                        onViewDocument({
                                            data: cleanData,
                                            name: response.data.name || offerLetter.name || 'Salary Letter.pdf',
                                            mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                            moduleId: offerLetterSource?.type === 'salaryOfferLetter' ? 'hrm_employees_view_salary_history' : 'hrm_employees_view_salary'
                                        });
                                    }
                                } else {
                                    onViewDocument(null); // Close modal
                                    toast({
                                        variant: "destructive",
                                        title: "Failed to load salary letter",
                                        description: "Unable to load the salary letter. Please try again."
                                    });
                                }
                            } catch (err) {
                                console.error('Error fetching salary letter:', err);
                                onViewDocument(null); // Close modal
                                toast({
                                    variant: "destructive",
                                    title: "Error fetching salary letter",
                                    description: "Please try again."
                                });
                            }
                        } else {
                            toast({
                                title: "Salary letter data not available",
                                description: "The salary letter data is not available."
                            });
                        }
                    }}
                />

                <BankAccountCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    hasBankDetailsSection={hasBankDetailsSection}
                    onEdit={onOpenBankModal}
                    onViewDocument={async () => {
                        if (!employee.bankAttachment) {
                            toast({
                                title: "No bank attachment found",
                                description: "No bank attachment is available."
                            });
                            return;
                        }

                        // Check if it's a Cloudinary URL or base64 data
                        const isCloudinaryUrl = employee.bankAttachment.url ||
                            (employee.bankAttachment.data && (employee.bankAttachment.data.startsWith('http://') || employee.bankAttachment.data.startsWith('https://')));
                        const documentData = employee.bankAttachment.url || employee.bankAttachment.data;

                        // If document is directly available (Cloudinary URL or base64), open immediately
                        if (documentData) {
                            if (isCloudinaryUrl) {
                                // Cloudinary URL - use directly (much faster!)
                                onViewDocument({
                                    data: documentData,
                                    name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                    mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                    moduleId: 'hrm_employees_view_bank'
                                });
                            } else {
                                // Base64 data - clean and use
                                let cleanData = documentData;
                                if (cleanData.includes(',')) {
                                    cleanData = cleanData.split(',')[1];
                                }

                                onViewDocument({
                                    data: cleanData,
                                    name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                    mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                    moduleId: 'hrm_employees_view_bank'
                                });
                            }
                        } else if (employeeId) {
                            // Open modal with loading state immediately
                            onViewDocument({
                                data: null, // Signal loading
                                name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                mimeType: employee.bankAttachment.mimeType || 'application/pdf',
                                loading: true,
                                moduleId: 'hrm_employees_view_bank'
                            });

                            // Fetch in background
                            try {
                                const axiosInstance = (await import('@/utils/axios')).default;
                                const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                    params: { type: 'bankAttachment' }
                                });

                                if (response.data && response.data.data) {
                                    const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                        (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                    if (isCloudinaryUrl) {
                                        // Cloudinary URL - use directly
                                        onViewDocument({
                                            data: response.data.data,
                                            name: response.data.name || employee.bankAttachment.name || 'Bank Attachment.pdf',
                                            mimeType: response.data.mimeType || employee.bankAttachment.mimeType || 'application/pdf',
                                            moduleId: 'hrm_employees_view_bank'
                                        });
                                    } else {
                                        // Base64 data - clean and use
                                        let cleanData = response.data.data;
                                        if (cleanData.includes(',')) {
                                            cleanData = cleanData.split(',')[1];
                                        }

                                        onViewDocument({
                                            data: cleanData,
                                            name: response.data.name || employee.bankAttachment.name || 'Bank Attachment.pdf',
                                            mimeType: response.data.mimeType || employee.bankAttachment.mimeType || 'application/pdf',
                                            moduleId: 'hrm_employees_view_bank'
                                        });
                                    }
                                } else {
                                    onViewDocument(null); // Close modal
                                    toast({
                                        variant: "destructive",
                                        title: "Failed to load bank attachment",
                                        description: "Unable to load the bank attachment. Please try again."
                                    });
                                }
                            } catch (err) {
                                console.error('Error fetching bank attachment:', err);
                                onViewDocument(null); // Close modal
                                toast({
                                    variant: "destructive",
                                    title: "Error fetching bank attachment",
                                    description: "Please try again."
                                });
                            }
                        }
                    }}
                />
            </div>

            {/* Action Buttons - Tab Style */}
            <div className="flex flex-wrap gap-3 mt-6">
                {['Salary History', 'Fine', 'Rewards', 'NCR', 'Loans', 'CTC'].map((action) => {
                    if (action === 'Salary History' && !isAdmin() && !hasPermission('hrm_employees_view_salary_history', 'isView')) {
                        return null;
                    }
                    return (
                        <button
                            key={action}
                            onClick={() => {
                                setSelectedSalaryAction(action);
                                setSalaryHistoryPage(1);
                            }}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors border-2 ${selectedSalaryAction === action
                                ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                        >
                            {action}
                        </button>
                    );
                })}
            </div>

            {/* Salary Action Card */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">{selectedSalaryAction}</h3>
                    <div className="flex items-center gap-4">
                        {selectedSalaryAction !== 'Salary History' && (
                            <button
                                onClick={() => {
                                    console.log(`Add ${selectedSalaryAction}`);
                                }}
                                className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                            >
                                Add {selectedSalaryAction === 'Rewards' ? 'Reward' : selectedSalaryAction.slice(0, -1)}
                                <span className="text-lg leading-none">+</span>
                            </button>
                        )}
                        {selectedSalaryAction === 'Salary History' && (isAdmin() || hasPermission('hrm_employees_view_salary_history', 'isView')) && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">Items per page</span>
                                    <select
                                        value={salaryHistoryItemsPerPage}
                                        onChange={(e) => {
                                            setSalaryHistoryItemsPerPage(Number(e.target.value));
                                            setSalaryHistoryPage(1);
                                        }}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSalaryHistoryPage(prev => Math.max(1, prev - 1))}
                                        disabled={salaryHistoryPage === 1 || totalItems === 0}
                                        className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${salaryHistoryPage === 1 || totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                                            }`}
                                    >
                                        &lt;
                                    </button>
                                    {pageNumbers.map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => setSalaryHistoryPage(pageNum)}
                                            disabled={totalItems === 0}
                                            className={`px-3 py-1 rounded-lg text-sm bg-white border border-gray-300 text-gray-700 ${totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setSalaryHistoryPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={salaryHistoryPage === totalPages || totalItems === 0 || totalItems <= salaryHistoryItemsPerPage}
                                        className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${salaryHistoryPage === totalPages || totalItems === 0 || totalItems <= salaryHistoryItemsPerPage
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-gray-300'
                                            }`}
                                    >
                                        &gt;
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full min-w-0 table-auto">
                        <thead>
                            <tr className="border-b border-gray-200">
                                {selectedSalaryAction === 'Salary History' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">From Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">To Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic Salary</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Other Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Home Rent Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vehicle Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fuel Allowance</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Salary</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Salary Letter</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Rewards' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Fine' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'NCR' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'Loans' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Installment</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Balance</th>
                                    </>
                                )}
                                {selectedSalaryAction === 'CTC' && (
                                    <>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Year</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Allowances</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total CTC</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {selectedSalaryAction === 'Salary History' && currentPageData.length > 0 ? (
                                currentPageData.map((entry, index) => {
                                    const actualIndex = startIndex + index;
                                    return (
                                        <tr key={actualIndex} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-500">{entry.month || '—'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">{formatDate(entry.fromDate)}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">{formatDate(entry.toDate)}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">AED {entry.basic?.toFixed(2) || '0.00'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">AED {entry.otherAllowance?.toFixed(2) || '0.00'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">AED {entry.houseRentAllowance?.toFixed(2) || '0.00'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">AED {entry.vehicleAllowance?.toFixed(2) || '0.00'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">AED {(() => {
                                                if (entry.fuelAllowance !== undefined && entry.fuelAllowance !== null) {
                                                    return entry.fuelAllowance.toFixed(2);
                                                }
                                                const fuelFromAdditional = entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                                                return fuelFromAdditional.toFixed(2);
                                            })()}</td>
                                            <td className="py-3 px-4 text-sm font-semibold text-gray-500">AED {(() => {
                                                const basic = entry.basic || 0;
                                                const hra = entry.houseRentAllowance || 0;
                                                const vehicle = entry.vehicleAllowance || 0;
                                                const other = entry.otherAllowance || 0;
                                                const fuel = entry.fuelAllowance !== undefined && entry.fuelAllowance !== null
                                                    ? entry.fuelAllowance
                                                    : (entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);
                                                const recalculatedTotal = basic + hra + vehicle + fuel + other;
                                                return recalculatedTotal.toFixed(2);
                                            })()}</td>
                                            <td className="py-3 px-4 text-sm">
                                                {(() => {
                                                    // Check if offer letter exists and has viewable data (url or data) - not just name
                                                    // This ensures we only show the button when there's actually something to view
                                                    const hasOfferLetter = !!(entry.offerLetter &&
                                                        (entry.offerLetter.url || entry.offerLetter.data));

                                                    if (!hasOfferLetter) {
                                                        return <span className="text-gray-400">—</span>;
                                                    }

                                                    const offerLetterName = entry.offerLetter?.name || 'Salary Letter.pdf';

                                                    return (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();

                                                                const offerLetter = entry.offerLetter;

                                                                // Check if offerLetter exists and has data
                                                                if (!offerLetter) {
                                                                    toast({
                                                                        title: "No salary letter found",
                                                                        description: "No salary letter is available for this salary record."
                                                                    });
                                                                    return;
                                                                }

                                                                // Use local data first (URL or data) - this should be available after server fix
                                                                const documentData = offerLetter.url || offerLetter.data;

                                                                if (documentData) {
                                                                    // Check if it's a Cloudinary URL
                                                                    const isCloudinaryUrl = offerLetter.url ||
                                                                        (offerLetter.data && (offerLetter.data.startsWith('http://') || offerLetter.data.startsWith('https://')));

                                                                    if (isCloudinaryUrl) {
                                                                        // Cloudinary URL - pass to viewer (it will convert to blob URL to prevent download)
                                                                        onViewDocument({
                                                                            data: documentData,
                                                                            name: offerLetterName,
                                                                            mimeType: offerLetter.mimeType || 'application/pdf',
                                                                            moduleId: 'hrm_employees_view_salary_history'
                                                                        });
                                                                    } else {
                                                                        // Base64 data - clean and use
                                                                        let cleanData = documentData;
                                                                        if (cleanData.includes(',')) {
                                                                            cleanData = cleanData.split(',')[1];
                                                                        }
                                                                        onViewDocument({
                                                                            data: cleanData,
                                                                            name: offerLetterName,
                                                                            mimeType: offerLetter.mimeType || 'application/pdf',
                                                                            moduleId: 'hrm_employees_view_salary_history'
                                                                        });
                                                                    }
                                                                } else {
                                                                    // No local data available - try fetching from server as last resort
                                                                    if (entry._id && employeeId) {
                                                                        try {
                                                                            const axiosInstance = (await import('@/utils/axios')).default;
                                                                            const response = await axiosInstance.get(`/Employee/${employeeId}/document`, {
                                                                                params: { type: 'salaryOfferLetter', docId: entry._id }
                                                                            });

                                                                            if (response.data && response.data.data) {
                                                                                const isCloudinaryUrl = response.data.isCloudinaryUrl ||
                                                                                    (response.data.data && (response.data.data.startsWith('http://') || response.data.data.startsWith('https://')));

                                                                                if (isCloudinaryUrl) {
                                                                                    onViewDocument({
                                                                                        data: response.data.data,
                                                                                        name: response.data.name || offerLetterName,
                                                                                        mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                                                                        moduleId: 'hrm_employees_view_salary_history'
                                                                                    });
                                                                                } else {
                                                                                    let cleanData = response.data.data;
                                                                                    if (cleanData.includes(',')) {
                                                                                        cleanData = cleanData.split(',')[1];
                                                                                    }
                                                                                    onViewDocument({
                                                                                        data: cleanData,
                                                                                        name: response.data.name || offerLetterName,
                                                                                        mimeType: response.data.mimeType || offerLetter.mimeType || 'application/pdf',
                                                                                        moduleId: 'hrm_employees_view_salary_history'
                                                                                    });
                                                                                }
                                                                            } else {
                                                                                toast({
                                                                                    variant: "destructive",
                                                                                    title: "Failed to load salary letter",
                                                                                    description: "Unable to load the salary letter."
                                                                                });
                                                                            }
                                                                        } catch (err) {
                                                                            // Silently handle 404 - document might not exist for this entry
                                                                            if (err.response?.status === 404) {
                                                                                toast({
                                                                                    variant: "destructive",
                                                                                    title: "Salary letter not found",
                                                                                    description: "No salary letter is available for this salary record."
                                                                                });
                                                                            } else {
                                                                                toast({
                                                                                    variant: "destructive",
                                                                                    title: "Error loading salary letter",
                                                                                    description: "Please try again."
                                                                                });
                                                                            }
                                                                        }
                                                                    } else {
                                                                        toast({
                                                                            variant: "destructive",
                                                                            title: "Salary letter data not available",
                                                                            description: "The salary letter data is not available."
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5 font-medium"
                                                            title="View Salary Letter"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                <polyline points="10 9 9 9 8 9"></polyline>
                                                            </svg>
                                                            <span className="truncate max-w-[150px]" title={offerLetterName}>
                                                                {offerLetterName}
                                                            </span>
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    {/* Only show edit button if user has edit permission for salary */}
                                                    {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isEdit')) && (
                                                        <button
                                                            onClick={() => {
                                                                const entryToEdit = sortedHistory[actualIndex];
                                                                setEditingSalaryIndex(actualIndex);
                                                                const entryFuelAllowance = entryToEdit.fuelAllowance !== undefined && entryToEdit.fuelAllowance !== null
                                                                    ? entryToEdit.fuelAllowance
                                                                    : (entryToEdit.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);

                                                                setSalaryForm({
                                                                    month: entryToEdit.month || '',
                                                                    fromDate: entryToEdit.fromDate ? new Date(entryToEdit.fromDate).toISOString().split('T')[0] : '',
                                                                    basic: entryToEdit.basic ? String(entryToEdit.basic) : '',
                                                                    houseRentAllowance: entryToEdit.houseRentAllowance ? String(entryToEdit.houseRentAllowance) : '',
                                                                    vehicleAllowance: entryToEdit.vehicleAllowance ? String(entryToEdit.vehicleAllowance) : '',
                                                                    fuelAllowance: entryFuelAllowance ? String(entryFuelAllowance) : '',
                                                                    otherAllowance: entryToEdit.otherAllowance ? String(entryToEdit.otherAllowance) : '',
                                                                    totalSalary: entryToEdit.totalSalary ? String(entryToEdit.totalSalary) : calculateTotalSalary(
                                                                        entryToEdit.basic ? String(entryToEdit.basic) : '',
                                                                        entryToEdit.houseRentAllowance ? String(entryToEdit.houseRentAllowance) : '',
                                                                        entryToEdit.vehicleAllowance ? String(entryToEdit.vehicleAllowance) : '',
                                                                        entryFuelAllowance ? String(entryFuelAllowance) : '',
                                                                        entryToEdit.otherAllowance ? String(entryToEdit.otherAllowance) : ''
                                                                    ),
                                                                    offerLetterFile: null,
                                                                    offerLetterFileBase64: entryToEdit.offerLetter?.url || entryToEdit.offerLetter?.data || '',
                                                                    offerLetterFileName: entryToEdit.offerLetter?.name || '',
                                                                    offerLetterFileMime: entryToEdit.offerLetter?.mimeType || ''
                                                                });
                                                                setSalaryFormErrors({
                                                                    month: '',
                                                                    fromDate: '',
                                                                    basic: '',
                                                                    houseRentAllowance: '',
                                                                    vehicleAllowance: '',
                                                                    fuelAllowance: '',
                                                                    otherAllowance: '',
                                                                    offerLetter: ''
                                                                });
                                                                setShowSalaryModal(true);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-700"
                                                            title="Edit"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isDelete')) && (
                                                        <button
                                                            onClick={() => onDeleteSalary(actualIndex, sortedHistory)}
                                                            className="text-red-600 hover:text-red-700"
                                                            title="Delete"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : selectedSalaryAction === 'Salary History' ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-gray-400 text-sm">
                                        No Salary History
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                        No {selectedSalaryAction} data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


