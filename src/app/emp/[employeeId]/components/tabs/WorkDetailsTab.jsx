'use client';

// Import card directly to test if DynamicCards re-exports are causing issues
import WorkDetailsCard from '../cards/WorkDetailsCard';
import SignatureCard from '../cards/SignatureCard';
import { crudAccess, crudAccessUnion } from '@/utils/permissions';
import { COMPANY_MAIN_TAB_MODULES } from '@/constants/hrmModulePermissions';

export default function WorkDetailsTab({
    employee,
    formatDate,
    departmentOptions,
    reportingAuthorityOptions,
    reportingAuthorityValueForDisplay,
    onEdit,
    onDeleteWorkDetails,
    onDeleteSignature,
    isCompanyProfile,
    fetchEmployee,
    onViewDocument
}) {
    const workBlockVisible = isCompanyProfile
        ? crudAccessUnion(COMPANY_MAIN_TAB_MODULES['work-details'] || []).view
        : crudAccess('hrm_employees_view_work').view;

    if (!workBlockVisible) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <WorkDetailsCard
                    employee={employee}
                    formatDate={formatDate}
                    departmentOptions={departmentOptions}
                    reportingAuthorityOptions={reportingAuthorityOptions}
                    reportingAuthorityValueForDisplay={reportingAuthorityValueForDisplay}
                    onEdit={onEdit}
                    onDelete={onDeleteWorkDetails}
                    onViewDocument={onViewDocument}
                    isCompanyProfile={isCompanyProfile}
                    fetchEmployee={fetchEmployee}
                />
                {!isCompanyProfile && (
                    <SignatureCard
                        employee={employee}
                        formatDate={formatDate}
                        fetchEmployee={fetchEmployee}
                        onViewDocument={onViewDocument}
                        onDelete={onDeleteSignature}
                        isCompanyProfile={isCompanyProfile}
                    />
                )}
            </div>
        </div>
    );
}

