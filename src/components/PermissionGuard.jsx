'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasAnyPermission, isAdmin } from '@/utils/permissions';
import {
    canAccessAssetModuleViaFlowchart,
    ensureAssetFlowchartRoleMeta,
    getCachedAssetFlowchartRoleMeta,
    isAssetModuleId,
} from '@/utils/assetFlowchartModuleAccess';

/**
 * Permission Guard Component
 * Redirects users who don't have permission to access a page
 * @param {string} moduleId - The module ID to check permission for
 * @param {string} permissionType - The permission type ('view', 'create', 'edit', 'delete', 'full')
 * @param {ReactNode} children - The content to render if user has permission
 */
export default function PermissionGuard({
    moduleId,
    moduleIds,
    permissionType = 'view',
    children,
    redirectTo = '/dashboard',
}) {
    const router = useRouter();
    const accessIds =
        Array.isArray(moduleIds) && moduleIds.length > 0
            ? moduleIds
            : [moduleId];
    const primaryModuleId = accessIds[0];
    const needsAssetFlowchart = accessIds.some((id) => isAssetModuleId(id));
    const [mounted, setMounted] = useState(false);
    // Don't blank the page while flowchart meta loads — use cache when present.
    const [flowchartReady, setFlowchartReady] = useState(() => {
        if (!needsAssetFlowchart) return true;
        if (typeof window === 'undefined') return true;
        return Boolean(getCachedAssetFlowchartRoleMeta()) || isAdmin();
    });

    // Handle client-side mounting to prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !needsAssetFlowchart) {
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
    }, [mounted, needsAssetFlowchart]);

    const hasAccess = (() => {
        if (accessIds.includes('dashboard')) return true;
        if (isAdmin()) return true;
        return accessIds.some((id) => {
            if (id === 'dashboard') return true;
            const groupAccess = hasAnyPermission(id);
            if (isAssetModuleId(id)) {
                return canAccessAssetModuleViaFlowchart(id, groupAccess);
            }
            return groupAccess;
        });
    })();

    useEffect(() => {
        if (!mounted || !flowchartReady) return;

        if (accessIds.includes('dashboard')) return;
        if (isAdmin()) return;

        if (!hasAccess) {
            router.replace(redirectTo);
        }
    }, [primaryModuleId, router, redirectTo, mounted, flowchartReady, hasAccess]);

    // During SSR or before mount, render children to prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    if (accessIds.includes('dashboard')) {
        return <>{children}</>;
    }

    if (isAdmin()) {
        return <>{children}</>;
    }

    // Optimistic paint: never return null for asset modules while meta loads —
    // notification → vehicle redirect felt stuck on a blank screen.
    if (needsAssetFlowchart && !flowchartReady) {
        return <>{children}</>;
    }

    if (!hasAccess) {
        return null;
    }

    return <>{children}</>;
}
