'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Country } from 'country-state-city';
import {
    getEmployeeInitials,
    getEmployeeProfilePictureSrc,
    toNextImageProfileSrc,
} from '@/utils/employeeProfileImage';

function formatNationalityDisplay(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const byCode = Country.getCountryByCode(trimmed.toUpperCase());
    if (byCode) return byCode.name;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function EmployeeAvatarImage({ src, alt, initials, unoptimized }) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                {initials || 'N/A'}
            </div>
        );
    }
    return (
        <Image
            src={src}
            alt={alt}
            width={40}
            height={40}
            className="rounded-full object-cover"
            loading="lazy"
            unoptimized={unoptimized}
            onError={() => setFailed(true)}
        />
    );
}

const statusColorClasses = {
    Probation: 'bg-[#3B82F6]/15 text-[#1D4ED8]',
    Permanent: 'bg-[#10B981]/15 text-[#065F46]',
    Temporary: 'bg-[#F59E0B]/15 text-[#92400E]',
    Notice: 'bg-[#EF4444]/15 text-[#991B1B]',
};

const EmployeeRow = memo(({ employee, serialNo, canViewProfile }) => {
    const incomplete = employee._computed?.incomplete ?? false;
    const contractExpiry = employee._computed?.contractExpiry ?? null;
    const profileStatusValue = (employee.profileStatus || 'inactive').toLowerCase();
    const profileStatusLabel = profileStatusValue === 'active' ? 'Active' : 'Inactive';
    const profileStatusClass =
        profileStatusValue === 'active'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-gray-100 text-gray-500 border-gray-200';

    const statusClass = statusColorClasses[employee.status] || statusColorClasses.Probation;
    const initials = getEmployeeInitials(employee.firstName, employee.lastName);
    const profileSrc = toNextImageProfileSrc(getEmployeeProfilePictureSrc(employee));

    const nameSlug = `${employee.firstName || ''}-${employee.lastName || ''}`
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    const displayId = employee.employeeId || employee._id;
    const employeeHref = `/emp/${displayId}.${nameSlug}`;

    return (
        <tr className="bg-white hover:bg-gray-50 transition-colors border-b border-gray-200">
            <td className="px-6 py-4 text-sm text-gray-700">{serialNo}</td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {profileSrc ? (
                        <EmployeeAvatarImage
                            src={profileSrc}
                            alt={`${employee.firstName} ${employee.lastName}`}
                            initials={initials}
                            unoptimized={profileSrc.includes('cloudinary')}
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                            {initials || 'N/A'}
                        </div>
                    )}
                    <div className="font-medium text-gray-900">
                        {canViewProfile ? (
                            <Link href={employeeHref} className="hover:text-blue-600 transition-colors">
                                {employee.firstName} {employee.lastName}
                            </Link>
                        ) : (
                            <span>
                                {employee.firstName} {employee.lastName}
                            </span>
                        )}
                        {incomplete ? (
                            <span className="ml-2 text-xs text-amber-600 font-semibold">Incomplete</span>
                        ) : null}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{employee.employeeId || '—'}</td>
            <td className="px-6 py-4 text-sm text-gray-900 capitalize">{employee.gender || '—'}</td>
            <td className="px-6 py-4 text-sm text-gray-900">
                {formatNationalityDisplay(employee.nationality || employee.country) || '—'}
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
                {employee.companyNickName || employee.companyName || '—'}
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">{contractExpiry || '—'}</td>
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
        </tr>
    );
});

EmployeeRow.displayName = 'EmployeeRow';

export default memo(function EmployeeTable({ employees, canViewProfile, startIndex = 0 }) {
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14">
                                Sl
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Employee Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                EMP ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Gender
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nationality
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Company
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contract Expiry
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Job Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Profile Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {employees.map((employee, index) => (
                            <EmployeeRow
                                key={employee._id || employee.employeeId || index}
                                employee={employee}
                                serialNo={startIndex + index + 1}
                                canViewProfile={canViewProfile}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});
