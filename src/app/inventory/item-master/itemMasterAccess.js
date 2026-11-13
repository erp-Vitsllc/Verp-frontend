'use client';

import { useEffect, useState } from 'react';
import { hasAnyPermission, hasPermission } from '@/utils/permissions';

export function useInventoryAccess() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true);
    }, []);

    const allow = (moduleId, type = 'isView') => ready && hasPermission(moduleId, type);

    return {
        ready,
        canOpenInventory: ready && hasAnyPermission('inventory'),
        canViewItems: allow('inventory_item_master'),
        canCreateItem: allow('inventory_item_master', 'isCreate'),
        canEditItem: allow('inventory_item_master', 'isEdit'),
        canCreateCategory: allow('inventory_item_master_category', 'isCreate'),
        canCreateSubcategory: allow('inventory_item_master_subcategory', 'isCreate'),
        canCreateBrand: allow('inventory_item_master_brand', 'isCreate'),
        canViewVendors: allow('inventory_vendor'),
        canCreateVendor: allow('inventory_vendor', 'isCreate'),
        canEditVendor: allow('inventory_vendor', 'isEdit'),
    };
}
