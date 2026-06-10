'use client';

import { employeeProfileCardCrudAccess, EMPLOYEE_SALARY_CARD_MODULES } from '@/utils/employeeProfileCardAccess';
import { getEffectiveSalaryFields, getActiveSalaryOfferLetter } from '../../utils/salaryDisplay';
import { isSalaryDetailsPending } from '@/utils/employeeActivationSections';

const SALARY_PERM = EMPLOYEE_SALARY_CARD_MODULES.salary;

export default function SalaryDetailsCard({
    employee,
    hasSalaryDetails,
    onEdit,
    onIncrement,
    onViewOfferLetter,
    onDelete,
    id
}) {
    const access = employeeProfileCardCrudAccess(SALARY_PERM);

    if (!access.view) {
        return null;
    }

    const { offerLetter } = getActiveSalaryOfferLetter(employee);

    const isPendingApproval = isSalaryDetailsPending(employee);

    const salaryFields = getEffectiveSalaryFields(employee);

    return (
        <div id={id} className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center">
                    <h3 className="text-xl font-semibold text-gray-800">Salary Details</h3>
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
                    {hasSalaryDetails ? (
                        access.edit && (
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
                        access.create && (
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
                            title="View salary letter"
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
                    { label: 'Basic Salary', value: salaryFields.basic ? `AED ${salaryFields.basic.toFixed(2)}` : 'AED 0.00' },
                    { label: 'Home Rent Allowance', value: salaryFields.houseRentAllowance ? `AED ${salaryFields.houseRentAllowance.toFixed(1)}` : 'AED 0.0' },
                    {
                        label: 'Vehicle Allowance',
                        value: salaryFields.vehicleAllowance
                            ? `AED ${salaryFields.vehicleAllowance.toFixed(2)}`
                            : 'AED 0.00'
                    },
                    {
                        label: 'Fuel Allowance',
                        value: salaryFields.fuelAllowance
                            ? `AED ${salaryFields.fuelAllowance.toFixed(2)}`
                            : 'AED 0.00'
                    },
                    { label: 'Other Allowance', value: salaryFields.otherAllowance ? `AED ${salaryFields.otherAllowance.toFixed(2)}` : 'AED 0.00' },
                    {
                        label: 'Total Salary',
                        value: (() => {
                            const basic = salaryFields.basic || 0;
                            const hra = salaryFields.houseRentAllowance || 0;
                            const other = salaryFields.otherAllowance || 0;
                            const vehicle = salaryFields.vehicleAllowance || 0;
                            const fuel = salaryFields.fuelAllowance || 0;
                            const otherAdditional = (salaryFields.additionalAllowances || [])
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
