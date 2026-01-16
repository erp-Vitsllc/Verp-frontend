'use client';

export default function SalaryDetailsCard({
    employee,
    isAdmin,
    hasPermission,
    hasSalaryDetails,
    onEdit,
    onIncrement,
    onViewOfferLetter
}) {
    // Show only if permission isActive is true
    if (!(isAdmin() || hasPermission('hrm_employees_view_salary', 'isView'))) {
        return null;
    }

    // Check for offer letter in latest salary history or main employee
    let offerLetter = null;
    if (employee?.salaryHistory && Array.isArray(employee.salaryHistory) && employee.salaryHistory.length > 0) {
        // Use history as-is (no sorting), latest entries are at the top
        const sortedHistory = [...employee.salaryHistory];
        for (const entry of sortedHistory) {
            if (entry.offerLetter && (entry.offerLetter.url || entry.offerLetter.data)) {
                offerLetter = entry.offerLetter;
                break;
            }
        }
    }
    if (!offerLetter && employee?.offerLetter && (employee.offerLetter.url || employee.offerLetter.data)) {
        offerLetter = employee.offerLetter;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Salary Details</h3>
                <div className="flex items-center gap-2">
                    {hasSalaryDetails ? (
                        (isAdmin() || hasPermission('hrm_employees_view_salary', 'isEdit')) && (
                            <>
                                <button
                                    onClick={onEdit}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Edit"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={onIncrement}
                                    className="text-teal-600 hover:text-teal-700"
                                    title="Increment Salary"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                        <polyline points="17 6 23 6 23 12"></polyline>
                                    </svg>
                                </button>
                            </>
                        )
                    ) : (
                        (isAdmin() || hasPermission('hrm_employees_view_salary', 'isCreate')) && (
                            <button
                                onClick={onEdit}
                                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                            >
                                Add Salary
                                <span className="text-sm leading-none">+</span>
                            </button>
                        )
                    )}
                    {offerLetter && (
                        <button
                            onClick={onViewOfferLetter}
                            className="text-green-600 hover:text-green-700 transition-colors"
                            title="Download Salary Letter"
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
                    { label: 'Basic Salary', value: employee.basic ? `AED ${employee.basic.toFixed(2)}` : 'AED 0.00' },
                    { label: 'Home Rent Allowance', value: employee.houseRentAllowance ? `AED ${employee.houseRentAllowance.toFixed(1)}` : 'AED 0.0' },
                    {
                        label: 'Vehicle Allowance',
                        value: employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount
                            ? `AED ${employee.additionalAllowances.find(a => a.type?.toLowerCase().includes('vehicle')).amount.toFixed(2)}`
                            : 'AED 0.00'
                    },
                    {
                        label: 'Fuel Allowance',
                        value: employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount
                            ? `AED ${employee.additionalAllowances.find(a => a.type?.toLowerCase().includes('fuel')).amount.toFixed(2)}`
                            : 'AED 0.00'
                    },
                    { label: 'Other Allowance', value: employee.otherAllowance ? `AED ${employee.otherAllowance.toFixed(2)}` : 'AED 0.00' },
                    {
                        label: 'Total Salary',
                        value: (() => {
                            const basic = employee.basic || 0;
                            const hra = employee.houseRentAllowance || 0;
                            const other = employee.otherAllowance || 0;
                            const vehicle = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
                            const fuel = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                            // Calculate other additional allowances (excluding vehicle and fuel)
                            const otherAdditional = (employee.additionalAllowances || [])
                                .filter(item => !item.type?.toLowerCase().includes('vehicle') && !item.type?.toLowerCase().includes('fuel'))
                                .reduce((sum, item) => sum + (item.amount || 0), 0);
                            const total = basic + hra + other + vehicle + fuel + otherAdditional;
                            return `AED ${total.toFixed(2)}`;
                        })(),
                        isTotal: true
                    }
                ]
                    .map((row, index, arr) => (
                        <div
                            key={row.label}
                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''} ${row.isTotal ? 'bg-gray-50 font-semibold' : ''}`}
                        >
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-500">{row.value}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
}


