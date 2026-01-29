'use client';

// Import card directly to test if DynamicCards re-exports are causing issues
import WorkDetailsCard from '../cards/WorkDetailsCard';

export default function WorkDetailsTab({
    employee,
    isAdmin,
    hasPermission,
    formatDate,
    departmentOptions,
    reportingAuthorityOptions,
    reportingAuthorityValueForDisplay,
    onEdit,
    isCompanyProfile
}) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <WorkDetailsCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    formatDate={formatDate}
                    departmentOptions={departmentOptions}
                    reportingAuthorityOptions={reportingAuthorityOptions}
                    reportingAuthorityValueForDisplay={reportingAuthorityValueForDisplay}
                    onEdit={onEdit}
                    isCompanyProfile={isCompanyProfile}
                />
            </div>
        </div>
    );
}

