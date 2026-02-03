'use client';

import { memo, useMemo } from 'react';

function BasicDetailsCard({
    employee,
    isAdmin,
    hasPermission,
    getCountryName,
    formatDate,
    onEdit,
    isCompanyProfile
}) {
    // Memoize permission checks to prevent unnecessary re-renders
    const canView = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_basic', 'isView'),
        [isAdmin, hasPermission]
    );

    const canEdit = useMemo(() =>
        isAdmin() || hasPermission('hrm_employees_view_basic', 'isEdit'),
        [isAdmin, hasPermission]
    );

    // Memoize data rows to prevent recalculation on every render
    const dataRows = useMemo(() => {
        if (!employee) return [];

        if (isCompanyProfile) {
            return [
                { label: 'Company ID', value: employee.employeeId },
                { label: 'Company Name', value: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() },
                { label: 'Email', value: employee.email || employee.workEmail },
                { label: 'Contact Number', value: employee.contactNumber },
                { label: 'Location', value: getCountryName(employee.nationality || employee.country) }
            ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
        }

        const dateOfBirthValue = employee.dateOfBirth ? (() => {
            const date = new Date(employee.dateOfBirth);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        })() : null;

        return [
            { label: 'Employee ID ', value: employee.employeeId },
            { label: 'Full Name', value: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() },
            { label: 'Email', value: employee.email || employee.workEmail },
            { label: 'Contact Number', value: employee.contactNumber },

            { label: 'Date of Birth', value: dateOfBirthValue },
            {
                label: 'Marital Status',
                value: employee.maritalStatus
                    ? employee.maritalStatus.charAt(0).toUpperCase() + employee.maritalStatus.slice(1)
                    : null
            },
            ...(employee.maritalStatus === 'married' && employee.numberOfDependents ? [
                { label: 'Number of Dependents', value: String(employee.numberOfDependents) }
            ] : []),
            { label: "Father's Name", value: employee.fathersName },
            { label: 'Nationality', value: getCountryName(employee.nationality || employee.country) }
        ].filter(row => row.value && row.value !== '—' && row.value.trim() !== '');
    }, [employee, getCountryName, isCompanyProfile]);

    // Show only if permission isActive is true
    if (!canView) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Basic Details</h3>
                {canEdit && (
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
            </div>
            <div>
                {dataRows.map((row, index, arr) => (
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

// Memoize component to prevent unnecessary re-renders
export default memo(BasicDetailsCard);


