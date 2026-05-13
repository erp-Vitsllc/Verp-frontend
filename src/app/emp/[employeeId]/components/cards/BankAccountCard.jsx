'use client';

import { crudAccess } from '@/utils/permissions';

const BANK_PERM = 'hrm_employees_view_bank';

export default function BankAccountCard({
    employee,
    hasBankDetailsSection,
    onEdit,
    onRenew,
    onViewDocument,
    onDelete
}) {
    const access = crudAccess(BANK_PERM);

    if (!access.view) {
        return null;
    }

    const bankRows = [
        { label: 'Bank Name', value: employee.bankName || employee.bank },
        { label: 'Account Name', value: employee.accountName || employee.bankAccountName },
        { label: 'Account Number', value: employee.accountNumber || employee.bankAccountNumber },
        { label: 'IBAN Number', value: employee.ibanNumber },
        { label: 'SWIFT Code', value: employee.swiftCode || employee.ifscCode || employee.ifsc },
        { label: 'Other Details (if any)', value: employee.bankOtherDetails || employee.otherBankDetails }
    ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    const hasBankRows = bankRows.length > 0;

    const isPendingApproval = (employee?.pendingReactivationChanges || []).some((change) => {
        const section = String(change?.section || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const card = String(change?.card || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return section.includes('bank') || card.includes('bank');
    });

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center">
                    <h3 className="text-xl font-semibold text-gray-800">Salary Bank Account</h3>
                    {isPendingApproval && (
                        <span
                            className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full cursor-help animate-pulse"
                            title="waiting for hr approval"
                        >
                            !
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {access.edit && (
                        <button
                            onClick={onRenew || onEdit}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Update Bank Details"
                        >
                            Update
                        </button>
                    )}
                    {!hasBankRows && access.create && (
                        <button
                            onClick={onEdit}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors"
                            title="Add Bank Details"
                        >
                            Add Bank Details
                        </button>
                    )}
                    {access.edit && (
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
                    {access.delete && hasBankDetailsSection() && onDelete && (
                        <button
                            onClick={onDelete}
                            className="text-red-600 hover:text-red-700 transition-colors"
                            title="Delete Bank Details"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                <path d="M10 11v6"></path>
                                <path d="M14 11v6"></path>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            <div>
                {hasBankRows ? (
                    bankRows.map((row, index, arr) => (
                        <div
                            key={row.label}
                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-500">{row.value}</span>
                        </div>
                    ))
                ) : (
                    <div className="px-6 py-5 text-sm text-gray-500">
                        {!access.create && !access.edit ? (
                            'No bank details on file.'
                        ) : (
                            <>
                                Bank details are not added yet. Use{' '}
                                <span className="font-semibold text-gray-700">Add Bank Details</span> to complete this section.
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
