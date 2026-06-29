import { HRM_MODULE } from '@/constants/hrmModulePermissions';

function flattenModulesTree(modules) {
    let flat = [];
    modules.forEach((m) => {
        flat.push(m);
        if (m.children) {
            flat = flat.concat(flattenModulesTree(m.children));
        }
    });
    return flat;
}

const emptyPerm = () => ({
    isView: false,
    isCreate: false,
    isEdit: false,
    isDelete: false,
    isDownload: false,
});

const E_ONLY_VIEW = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];
const E_VIEW_CREATE = ['isEdit', 'isDelete', 'isDownload'];
const E_VIEW_EDIT_DELETE = ['isCreate', 'isDownload'];
const E_VIEW_EDIT = ['isCreate', 'isDelete', 'isDownload'];
const E_VIEW_DOWNLOAD = ['isCreate', 'isEdit', 'isDelete'];
/** Identity / policy cards: full CRUD + download (renew = edit; inactive delete). */
const E_DOC_CARD = [];

const VEHICLE_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_asset_vehicle: E_ONLY_VIEW,
    hrm_asset_vehicle_list: ['isCreate'],
    hrm_asset_vehicle_add: E_VIEW_CREATE,
    hrm_asset_vehicle_dashboard: E_ONLY_VIEW,
    hrm_asset_vehicle_service_requests: ['isCreate', 'isDelete', 'isDownload'],
    hrm_asset_vehicle_view: E_ONLY_VIEW,
    hrm_asset_vehicle_view_basic: E_ONLY_VIEW,
    hrm_asset_vehicle_view_permit: E_ONLY_VIEW,
    hrm_asset_vehicle_view_document: E_ONLY_VIEW,
    hrm_asset_vehicle_view_documents_live: E_ONLY_VIEW,
    hrm_asset_vehicle_view_basic_vehicle: ['isCreate', 'isDelete', 'isDownload'],
    hrm_asset_vehicle_view_basic_insurance: E_DOC_CARD,
    hrm_asset_vehicle_view_basic_mulkia: E_DOC_CARD,
    hrm_asset_vehicle_view_basic_petrol: ['isCreate'],
    hrm_asset_vehicle_view_basic_toll: ['isCreate'],
    hrm_asset_vehicle_view_basic_warranty: E_DOC_CARD,
    hrm_asset_vehicle_view_basic_mortgage: ['isCreate'],
    hrm_asset_vehicle_view_permit_card: E_DOC_CARD,
    hrm_asset_vehicle_view_fine: ['isDelete'],
    hrm_asset_vehicle_view_service: ['isDelete'],
    hrm_asset_vehicle_view_handover: E_ONLY_VIEW,
    hrm_asset_vehicle_view_history: E_VIEW_DOWNLOAD,
    hrm_asset_vehicle_view_activation: E_VIEW_CREATE,
    hrm_asset_vehicle_view_documents_old: ['isCreate', 'isEdit'],
};

export function getVehicleBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_asset_vehicle')) return null;
    if (Object.prototype.hasOwnProperty.call(VEHICLE_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return VEHICLE_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    if (module.children?.length) return E_ONLY_VIEW;
    return E_ONLY_VIEW;
}

export function applyVehiclePermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) =>
        String(m.id).startsWith('hrm_asset_vehicle'),
    );
    flat.forEach((m) => {
        const disabledList = getVehicleBranchDisabledPermTypes(m);
        if (disabledList == null) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
}
