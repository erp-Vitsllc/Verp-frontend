'use client';

import PermissionGuard from '@/components/PermissionGuard';
import { COMPANY_ADD_MODULE } from '@/utils/companyPermissionModules';
import CompanyForm from './CompanyForm';

export default function AddCompanyPage() {
    return (
        <PermissionGuard moduleId={COMPANY_ADD_MODULE} redirectTo="/Company">
            <CompanyForm isEdit={false} />
        </PermissionGuard>
    );
}
