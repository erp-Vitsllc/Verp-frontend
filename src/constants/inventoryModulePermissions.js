/**
 * Inventory permission tree for Settings → Groups (create/edit).
 * Keep in sync with VERP_backend/constants/inventoryModulePermissions.js.
 *
 * Create on Category, Sub Category, and Brand controls those Item Master buttons.
 * Create on Item Master controls Add Item.
 */

export const INVENTORY_MODULE = {
    id: 'inventory',
    label: 'Inventory',
    parent: null,
    hasDownload: false,
    children: [
        {
            id: 'inventory_item_master',
            label: 'Item Master',
            parent: 'inventory',
            hasDownload: false,
            children: [
                {
                    id: 'inventory_item_master_category',
                    label: 'Category',
                    parent: 'inventory_item_master',
                    hasDownload: false,
                },
                {
                    id: 'inventory_item_master_subcategory',
                    label: 'Sub Category',
                    parent: 'inventory_item_master',
                    hasDownload: false,
                },
                {
                    id: 'inventory_item_master_brand',
                    label: 'Brand',
                    parent: 'inventory_item_master',
                    hasDownload: false,
                },
            ],
        },
        {
            id: 'inventory_vendor',
            label: 'Vendor Management',
            parent: 'inventory',
            hasDownload: false,
        },
    ],
};
