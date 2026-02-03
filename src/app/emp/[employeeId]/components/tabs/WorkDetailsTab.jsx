'use client';

// Import card directly to test if DynamicCards re-exports are causing issues
import WorkDetailsCard from '../cards/WorkDetailsCard';
import SignatureCard from '../cards/SignatureCard';

export default function WorkDetailsTab({
    employee,
    isAdmin,
    hasPermission,
    formatDate,
    departmentOptions,
    reportingAuthorityOptions,
    reportingAuthorityValueForDisplay,
    onEdit,
    isCompanyProfile,
    fetchEmployee,
    onViewDocument
}) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <WorkDetailsCard
                    employee={employee}
                    isAdmin={isAdmin}
                    hasPermission={hasPermission}
                    formatDate={formatDate}
                    departmentOptions={departmentOptions}
                    reportingAuthorityOptions={reportingAuthorityOptions}
                    reportingAuthorityValueForDisplay={reportingAuthorityValueForDisplay}
                    onEdit={onEdit}
                    onViewDocument={onViewDocument}
                    isCompanyProfile={isCompanyProfile}
                    fetchEmployee={fetchEmployee}
                />
                {!isCompanyProfile && (
                    <SignatureCard
                        employee={employee}
                        formatDate={formatDate}
                        fetchEmployee={fetchEmployee}
                        isAdmin={isAdmin}
                        hasPermission={hasPermission}
                        onViewDocument={onViewDocument}
                    />
                )}
            </div>
        </div>
    );
}

