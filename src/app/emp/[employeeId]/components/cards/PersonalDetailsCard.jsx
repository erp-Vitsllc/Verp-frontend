'use client';

export default function PersonalDetailsCard({
    employee,
    isAdmin,
    hasPermission,
    getCountryName,
    formatDate,
    onEdit
}) {
    // Show only if permission isActive is true
    if (!(isAdmin() || hasPermission('hrm_employees_view_personal', 'isView'))) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Personal Details</h3>
                {(isAdmin() || hasPermission('hrm_employees_view_personal', 'isEdit')) && (
                    <button
                        onClick={onEdit}
                        className="text-blue-600 hover:text-blue-700"
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
                    { label: 'Email Address', value: employee.email || employee.workEmail },
                    { label: 'Contact Number', value: employee.contactNumber },
                    {
                        label: 'Date of Birth',
                        value: employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null
                    },
                    {
                        label: 'Marital Status',
                        value: employee.maritalStatus
                            ? employee.maritalStatus.charAt(0).toUpperCase() + employee.maritalStatus.slice(1)
                            : null
                    },
                    ...(employee.maritalStatus === 'married' && employee.numberOfDependents ? [{ label: 'Number of Dependents', value: String(employee.numberOfDependents) }] : []),
                    { label: 'Father\'s Name', value: employee.fathersName },
                    {
                        label: 'Gender',
                        value: employee.gender
                            ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1)
                            : null
                    },
                    {
                        label: 'Nationality',
                        value: employee.nationality || employee.country
                            ? getCountryName(employee.nationality || employee.country)
                            : null
                    }
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




