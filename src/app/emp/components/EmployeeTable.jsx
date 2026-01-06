'use client';

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { hasPermission, isAdmin } from '@/utils/permissions';

/**
 * Optimized Employee Table Row Component
 * Memoized to prevent unnecessary re-renders
 */
const EmployeeRow = memo(({ employee, index, canViewProfile }) => {
    const incomplete = employee._computed?.incomplete ?? false;
    const contractExpiry = employee._computed?.contractExpiry ?? null;
    const profileStatusValue = (employee.profileStatus || 'inactive').toLowerCase();
    const profileStatusLabel = profileStatusValue === 'active' ? 'Active' : 'Inactive';
    const profileStatusClass = profileStatusValue === 'active'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-gray-100 text-gray-500 border-gray-200';

    const statusColorClasses = {
        Probation: 'bg-[#3B82F6]/15 text-[#1D4ED8]',
        Permanent: 'bg-[#10B981]/15 text-[#065F46]',
        Temporary: 'bg-[#F59E0B]/15 text-[#92400E]',
        Notice: 'bg-[#EF4444]/15 text-[#991B1B]'
    };

    const statusClass = statusColorClasses[employee.status] || statusColorClasses.Probation;
    const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase();

    return (
        <tr className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-200">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {employee.profilePicture ? (
                        <Image
                            src={employee.profilePicture}
                            alt={`${employee.firstName} ${employee.lastName}`}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                            loading="lazy"
                            unoptimized={employee.profilePicture?.includes('cloudinary')}
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                            {initials || 'N/A'}
                        </div>
                    )}
                    <div>
                        <div className="font-medium text-gray-900">
                            {canViewProfile ? (
                                (() => {
                                    const nameSlug = `${employee.firstName || ''}-${employee.lastName || ''}`
                                        .toLowerCase()
                                        .replace(/\s+/g, '-')
                                        .replace(/[^a-z0-9-]/g, '');
                                    const displayId = employee.employeeId || employee._id;
                                    return (
                                        <Link
                                            href={`/emp/${displayId}.${nameSlug}`}
                                            className="hover:text-blue-600 transition-colors"
                                        >
                                            {employee.firstName} {employee.lastName}
                                        </Link>
                                    );
                                })()
                            ) : (
                                <span>{employee.firstName} {employee.lastName}</span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">{employee.employeeId}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">{employee.designation || employee.role || '-'}</td>
            <td className="px-6 py-4 text-sm text-gray-900">{employee.department || '-'}</td>
            <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                    {employee.status || 'Probation'}
                </span>
            </td>
            <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${profileStatusClass}`}>
                    {profileStatusLabel}
                </span>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
                {contractExpiry ? (
                    <span className={contractExpiry.daysUntilExpiry < 30 ? 'text-red-600 font-medium' : ''}>
                        {contractExpiry.formatted}
                    </span>
                ) : (
                    '-'
                )}
            </td>
            <td className="px-6 py-4">
                {incomplete && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Incomplete
                    </span>
                )}
            </td>
        </tr>
    );
});

EmployeeRow.displayName = 'EmployeeRow';

/**
 * Optimized Employee Table Component
 */
export default memo(function EmployeeTable({ employees, canViewProfile }) {
    if (!employees || employees.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <p>No employees found</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Employee
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Designation
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Department
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Profile
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contract Expiry
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {employees.map((employee, index) => (
                            <EmployeeRow
                                key={employee._id || employee.employeeId || index}
                                employee={employee}
                                index={index}
                                canViewProfile={canViewProfile}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});




