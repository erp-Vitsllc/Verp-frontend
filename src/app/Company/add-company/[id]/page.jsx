'use client';

import { useParams } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import { COMPANY_LIST_MODULE } from '@/utils/companyPermissionModules';
import CompanyForm from '../CompanyForm';

export default function EditCompanyPage() {
    const params = useParams();
    const companyId = params.id;

    return (
        <PermissionGuard moduleId={COMPANY_LIST_MODULE} redirectTo="/Company">
            <CompanyForm isEdit={true} companyId={companyId} />
        </PermissionGuard>
    );
}
