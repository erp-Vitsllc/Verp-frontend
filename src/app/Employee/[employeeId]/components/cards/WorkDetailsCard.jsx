'use client';

export default function WorkDetailsCard({
    employee,
    isAdmin,
    hasPermission,
    formatDate,
    departmentOptions,
    reportingAuthorityOptions,
    reportingAuthorityValueForDisplay,
    onEdit
}) {
    // Show only if permission isActive is true
    if (!(isAdmin() || hasPermission('hrm_employees_view_work', 'isView'))) {
        return null;
    }

    const remainingProbation = (() => {
        if (!employee.probationPeriod || !employee.dateOfJoining) return null;
        const joinDate = new Date(employee.dateOfJoining);
        const today = new Date();
        const years = today.getFullYear() - joinDate.getFullYear();
        const months = today.getMonth() - joinDate.getMonth();
        const totalMonthsElapsed = (years * 12) + months;
        return Math.max(0, employee.probationPeriod - totalMonthsElapsed);
    })();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Work Details</h3>
                {(isAdmin() || hasPermission('hrm_employees_view_work', 'isEdit')) && (
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
                {[
                    { label: 'Date of Joining', value: employee.dateOfJoining ? formatDate(employee.dateOfJoining) : null, show: !!employee.dateOfJoining },
                    { label: 'Contract Joining Date', value: employee.contractJoiningDate ? formatDate(employee.contractJoiningDate) : null, show: !!employee.contractJoiningDate },
                    { label: 'Role', value: employee.role, show: !!employee.role },
                    { label: 'Department', value: employee.department ? departmentOptions.find(opt => opt.value === employee.department)?.label || employee.department : null, show: !!employee.department },
                    { label: 'Designation', value: employee.designation, show: !!employee.designation },
                    {
                        label: 'Work Status',
                        value: employee.status,
                        show: !!employee.status
                    },
                    {
                        label: 'Remaining Probation',
                        value: remainingProbation !== null ? `${remainingProbation} Month${remainingProbation !== 1 ? 's' : ''}` : null,
                        show: employee.status === 'Probation' && remainingProbation !== null
                    },
                    { label: 'Overtime', value: employee.overtime !== undefined ? (employee.overtime ? 'Yes' : 'No') : null, show: employee.overtime !== undefined },
                    {
                        label: 'Reporting To',
                        value: (() => {
                            if (!employee?.reportingAuthority) return null;
                            // Handle populated object
                            if (typeof employee.reportingAuthority === 'object' && employee.reportingAuthority !== null) {
                                return `${employee.reportingAuthority.firstName || ''} ${employee.reportingAuthority.lastName || ''}`.trim() || employee.reportingAuthority.employeeId || '—';
                            }
                            // Handle string/ID
                            return reportingAuthorityValueForDisplay;
                        })(),
                        show: !!employee?.reportingAuthority
                    },
                    {
                        label: 'Primary Reportee',
                        value: (() => {
                            if (!employee?.primaryReportee) return null;
                            // Handle populated object (could be EmployeeBasic or User)
                            if (typeof employee.primaryReportee === 'object' && employee.primaryReportee !== null) {
                                // Check if it's a User object (has name field)
                                if (employee.primaryReportee.name) {
                                    return employee.primaryReportee.name || '—';
                                }
                                // Otherwise, it's an EmployeeBasic object (has firstName/lastName)
                                return `${employee.primaryReportee.firstName || ''} ${employee.primaryReportee.lastName || ''}`.trim() || employee.primaryReportee.employeeId || '—';
                            }
                            // Handle string/ID - lookup in reportingAuthorityOptions (now contains users)
                            const match = reportingAuthorityOptions.find(opt => opt.value === employee.primaryReportee);
                            return match?.label || employee.primaryReportee || null;
                        })(),
                        show: !!employee?.primaryReportee
                    },
                    {
                        label: 'Secondary Reportee',
                        value: (() => {
                            if (!employee?.secondaryReportee) return null;
                            // Handle populated object (could be EmployeeBasic or User)
                            if (typeof employee.secondaryReportee === 'object' && employee.secondaryReportee !== null) {
                                // Check if it's a User object (has name field)
                                if (employee.secondaryReportee.name) {
                                    return employee.secondaryReportee.name || '—';
                                }
                                // Otherwise, it's an EmployeeBasic object (has firstName/lastName)
                                return `${employee.secondaryReportee.firstName || ''} ${employee.secondaryReportee.lastName || ''}`.trim() || employee.secondaryReportee.employeeId || '—';
                            }
                            // Handle string/ID - lookup in reportingAuthorityOptions (now contains users)
                            const match = reportingAuthorityOptions.find(opt => opt.value === employee.secondaryReportee);
                            return match?.label || employee.secondaryReportee || null;
                        })(),
                        show: !!employee?.secondaryReportee
                    }
                ]
                    .filter(row => row.show && row.value !== null && row.value !== undefined && row.value !== '')
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




