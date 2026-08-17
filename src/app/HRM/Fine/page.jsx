'use client';

import { Suspense } from 'react';
import PermissionGuard from '@/components/PermissionGuard';
import FineManagementContent from './components/FineManagementContent';

export default function FinePage() {
    return (
        <PermissionGuard moduleId="hrm_fine" permissionType="view">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <FineManagementContent />
            </Suspense>
        </PermissionGuard>
    );
}
