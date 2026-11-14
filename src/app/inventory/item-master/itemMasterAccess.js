'use client';

import { useEffect, useState } from 'react';
import { getUserPermissions, hasAnyPermission, hasPermission } from '@/utils/permissions';

export function useInventoryAccess() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true);
    }, []);

    const allow = (moduleId, type = 'isView') => ready && hasPermission(moduleId, type);
    // Groups saved before Contact existed keep using Vendor Management for those actions.
    const allowContact = (type) => {
        if (!ready) return false;
        const stored = getUserPermissions();
        if (stored && Object.prototype.hasOwnProperty.call(stored, 'inventory_vendor_contact')) {
            return hasPermission('inventory_vendor_contact', type);
        }
        return hasPermission('inventory_vendor', type);
    };

    return {
        ready,
        canOpenInventory: ready && hasAnyPermission('inventory'),
        canViewItems: allow('inventory_item_master'),
        canCreateItem: allow('inventory_item_master', 'isCreate'),
        canEditItem: allow('inventory_item_master', 'isEdit'),
        canDeleteItem: allow('inventory_item_master', 'isDelete'),
        canCreateCategory: allow('inventory_item_master_category', 'isCreate'),
        canEditCategory: allow('inventory_item_master_category', 'isEdit'),
        canDeleteCategory: allow('inventory_item_master_category', 'isDelete'),
        canCreateSubcategory: allow('inventory_item_master_subcategory', 'isCreate'),
        canEditSubcategory: allow('inventory_item_master_subcategory', 'isEdit'),
        canDeleteSubcategory: allow('inventory_item_master_subcategory', 'isDelete'),
        canCreateBrand: allow('inventory_item_master_brand', 'isCreate'),
        canEditBrand: allow('inventory_item_master_brand', 'isEdit'),
        canDeleteBrand: allow('inventory_item_master_brand', 'isDelete'),
        canViewVendors: allow('inventory_vendor'),
        canCreateVendor: allow('inventory_vendor', 'isCreate'),
        canEditVendor: allow('inventory_vendor', 'isEdit'),
        canDeleteVendor: allow('inventory_vendor', 'isDelete'),
        canCreateContact: allowContact('isCreate'),
        canEditContact: allowContact('isEdit'),
        canDeleteContact: allowContact('isDelete'),
    };
}
