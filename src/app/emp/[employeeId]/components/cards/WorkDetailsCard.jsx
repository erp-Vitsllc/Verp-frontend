'use client';
import { useState, useEffect } from 'react';
import NoticeApprovalModal from '../modals/NoticeApprovalModal';

export default function WorkDetailsCard({
    employee,
    isAdmin,
    hasPermission,
    formatDate,
    departmentOptions,
    reportingAuthorityOptions,
    reportingAuthorityValueForDisplay,
    onEdit,
    onViewDocument,
    isCompanyProfile,
    fetchEmployee
}) {
    if (!(isAdmin() || hasPermission('hrm_employees_view_work', 'isView'))) {
        return null;
    }

    const probationInfo = (() => {
        const startRef = employee.contractJoiningDate || employee.dateOfJoining;
        if (!employee.probationPeriod || !startRef || employee.status !== 'Probation') return null;

        const startDate = new Date(startRef);
        const probationEndDate = new Date(startDate);
        probationEndDate.setMonth(startDate.getMonth() + employee.probationPeriod);

        const today = new Date();

        if (today >= probationEndDate) return { months: 0, days: 0, isOver: true };

        let diffMonths = (probationEndDate.getFullYear() - today.getFullYear()) * 12 + (probationEndDate.getMonth() - today.getMonth());
        let diffDays = probationEndDate.getDate() - today.getDate();

        if (diffDays < 0) {
            diffMonths -= 1;
            // Get last day of previous month
            const prevMonth = new Date(probationEndDate.getFullYear(), probationEndDate.getMonth(), 0);
            diffDays += prevMonth.getDate();
        }

        return { months: diffMonths, days: diffDays, isOver: false };
    })();

    const probationDisplay = (() => {
        if (!probationInfo) return null;
        if (probationInfo.isOver) return "Completed";

        const parts = [];
        if (probationInfo.months > 0) parts.push(`${probationInfo.months} Month${probationInfo.months !== 1 ? 's' : ''}`);
        if (probationInfo.days > 0) parts.push(`${probationInfo.days} Day${probationInfo.days !== 1 ? 's' : ''}`);

        return parts.length > 0 ? parts.join(' and ') : "0 Days";
    })();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Work Details</h3>
                <div className="flex gap-2">

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
            </div>
            <div>
                {[
                    { label: 'Date of Joining', value: employee.dateOfJoining ? formatDate(employee.dateOfJoining) : null, show: !isCompanyProfile && !!employee.dateOfJoining },
                    { label: 'Contract Joining Date', value: employee.contractJoiningDate ? formatDate(employee.contractJoiningDate) : null, show: !isCompanyProfile && !!employee.contractJoiningDate },
                    { label: 'Company', value: typeof employee.company === 'object' ? employee.company.name : (employee.company || '—'), show: !isCompanyProfile && !!employee.company },
                    { label: 'Department', value: employee.department ? departmentOptions.find(opt => opt.value === employee.department)?.label || employee.department : null, show: !!employee.department },
                    { label: 'Designation', value: employee.designation, show: !!employee.designation },
                    { label: 'Entity Role', value: employee.role, show: !!employee.role },
                    {
                        label: 'Work Status',
                        value: employee.status === 'Notice' ? (employee.noticeRequest?.reason || 'Notice') : employee.status,
                        show: !isCompanyProfile && !!employee.status
                    },
                    {
                        label: 'Remaining Probation',
                        value: probationDisplay,
                        show: !isCompanyProfile && employee.status === 'Probation' && !!probationDisplay
                    },
                    { label: 'Company Email ID', value: employee.companyEmail || '—', show: !!employee.companyEmail },
                    { label: 'Work Email', value: employee.workEmail || '—', show: !!employee.workEmail },
                    { label: 'Overtime', value: employee.overtime !== undefined ? (employee.overtime ? 'Yes' : 'No') : null, show: !isCompanyProfile && employee.overtime !== undefined },
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
                        show: !isCompanyProfile && !!employee?.reportingAuthority
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
                        show: !isCompanyProfile && !!employee?.primaryReportee
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
                        show: !isCompanyProfile && !!employee?.secondaryReportee
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

        </div >
    );
}




