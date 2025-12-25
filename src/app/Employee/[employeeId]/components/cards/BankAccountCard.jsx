'use client';

export default function BankAccountCard({
    employee,
    isAdmin,
    hasPermission,
    hasBankDetailsSection,
    onEdit,
    onViewDocument
}) {
    // Show only if permission isActive is true
    if (!(isAdmin() || hasPermission('hrm_employees_view_bank', 'isView'))) {
        return null;
    }

    // If no bank details, show add button
    if (!hasBankDetailsSection()) {
        return (
            <div className="flex justify-start">
                {(isAdmin() || hasPermission('hrm_employees_view_bank', 'isCreate')) && (
                    <button
                        onClick={onEdit}
                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                    >
                        Add Bank Account
                        <span className="text-sm leading-none">+</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Salary Bank Account</h3>
                <div className="flex items-center gap-2">
                    {(isAdmin() || hasPermission('hrm_employees_view_bank', 'isEdit')) && (
                        <button
                            onClick={onEdit}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                            title="Edit"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    )}
                    {(employee.bankAttachment?.url || employee.bankAttachment?.data) && (
                        <button
                            onClick={onViewDocument}
                            className="text-green-600 hover:text-green-700 transition-colors"
                            title="View Bank Attachment"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            <div>
                {[
                    { label: 'Bank Name', value: employee.bankName || employee.bank },
                    { label: 'Account Name', value: employee.accountName || employee.bankAccountName },
                    { label: 'Account Number', value: employee.accountNumber || employee.bankAccountNumber },
                    { label: 'IBAN Number', value: employee.ibanNumber },
                    { label: 'SWIFT Code', value: employee.swiftCode || employee.ifscCode || employee.ifsc },
                    { label: 'Other Details (if any)', value: employee.bankOtherDetails || employee.otherBankDetails }
                ]
                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                    .map((row, index, arr) => (
                        <div
                            key={row.label}
                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-500">{row.value}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
}


