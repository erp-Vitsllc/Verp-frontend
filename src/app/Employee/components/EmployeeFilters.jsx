'use client';

import { memo } from 'react';

const departmentOptions = [
    { value: 'admin', label: 'Administration' },
    { value: 'hr', label: 'Human Resources' },
    { value: 'it', label: 'IT' }
];

const designationOptions = [
    { value: 'manager', label: 'Manager' },
    { value: 'developer', label: 'Developer' },
    { value: 'hr-manager', label: 'HR Manager' }
];

function EmployeeFilters({
    department,
    setDepartment,
    designation,
    setDesignation,
    jobStatus,
    setJobStatus,
    profileStatus,
    setProfileStatus,
    sortByContractExpiry,
    setSortByContractExpiry,
}) {
    return (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium text-gray-700">Filter by</span>

                <div className="relative">
                    <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                    >
                        <option value="">Select Department</option>
                        {departmentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative">
                    <select
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                    >
                        <option value="">Select Designation</option>
                        {designationOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative">
                    <select
                        value={jobStatus}
                        onChange={(e) => setJobStatus(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                    >
                        <option value="">All Status</option>
                        <option value="Probation">Probation</option>
                        <option value="Permanent">Permanent</option>
                        <option value="Temporary">Temporary</option>
                        <option value="Notice">Notice</option>
                    </select>
                </div>

                <div className="relative">
                    <select
                        value={profileStatus}
                        onChange={(e) => setProfileStatus(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                    >
                        <option value="">All Profiles</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div className="relative">
                    <select
                        value={sortByContractExpiry}
                        onChange={(e) => setSortByContractExpiry(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white appearance-none pr-8 cursor-pointer"
                    >
                        <option value="">Sort by Contract</option>
                        <option value="asc">Expiring Soon</option>
                        <option value="desc">Expiring Later</option>
                    </select>
                </div>

                {(department || designation || jobStatus || profileStatus || sortByContractExpiry) && (
                    <button
                        onClick={() => {
                            setDepartment('');
                            setDesignation('');
                            setJobStatus('');
                            setProfileStatus('');
                            setSortByContractExpiry('');
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
                    >
                        Clear Filters
                    </button>
                )}
            </div>
        </div>
    );
}

export default memo(EmployeeFilters);




