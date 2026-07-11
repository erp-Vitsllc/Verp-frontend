'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasAnyPermission, isAdmin } from '@/utils/permissions';
import {
    canAccessAssetModuleViaFlowchart,
    ensureAssetFlowchartRoleMeta,
    isAssetModuleId,
} from '@/utils/assetFlowchartModuleAccess';

/**
 * Permission Guard Component
 * Redirects users who don't have permission to access a page
 * @param {string} moduleId - The module ID to check permission for
 * @param {string} permissionType - The permission type ('view', 'create', 'edit', 'delete', 'full')
 * @param {ReactNode} children - The content to render if user has permission
 */
export default function PermissionGuard({ moduleId, permissionType = 'view', children, redirectTo = '/dashboard' }) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [flowchartReady, setFlowchartReady] = useState(() => !isAssetModuleId(moduleId));

    // Handle client-side mounting to prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !isAssetModuleId(moduleId)) {
            setFlowchartReady(true);
            return;
        }
        let cancelled = false;
        ensureAssetFlowchartRoleMeta()
            .catch(() => null)
            .finally(() => {
                if (!cancelled) setFlowchartReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [mounted, moduleId]);

    const hasAccess = (() => {
        if (moduleId === 'dashboard') return true;
        if (isAdmin()) return true;
        const groupAccess = hasAnyPermission(moduleId);
        if (isAssetModuleId(moduleId)) {
            return canAccessAssetModuleViaFlowchart(moduleId, groupAccess);
        }
        return groupAccess;
    })();

    useEffect(() => {
        if (!mounted || !flowchartReady) return;

        if (moduleId === 'dashboard') return;
        if (isAdmin()) return;

        if (!hasAccess) {
            router.replace(redirectTo);
        }
    }, [moduleId, router, redirectTo, mounted, flowchartReady, hasAccess]);

    // During SSR or before mount, render children to prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    if (moduleId === 'dashboard') {
        return <>{children}</>;
    }

    if (isAdmin()) {
        return <>{children}</>;
    }

    // Wait for flowchart role meta before blocking asset modules
    if (isAssetModuleId(moduleId) && !flowchartReady) {
        return null;
    }

    if (!hasAccess) {
        return null;
    }

    return <>{children}</>;
}
