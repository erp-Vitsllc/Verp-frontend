import { buildEmployeeHubDashboardPath, isEmployeeHubRequestItem } from '@/utils/employeeHubRequest';

/** DOM id prefix for asset list rows and detail banners/cards. */
export const ASSET_FOCUS_PREFIX = 'asset-focus-';

const appendQuery = (path, key, value) => {
    if (!path || value == null || value === '') return path;
    const [base, hash = ''] = String(path).split('#');
    const sep = base.includes('?') ? '&' : '?';
    const withQuery = `${base}${sep}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    return hash ? `${withQuery}#${hash}` : withQuery;
};

export const appendAssetQueryParams = (path, params = {}) => {
    let out = String(path || '');
    Object.entries(params).forEach(([key, value]) => {
        if (value != null && value !== '') {
            out = appendQuery(out, key, value);
        }
    });
    return out;
};

export function slugifyAccessoryFocusKey(name = '') {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');
}

export function buildAssetFocusElementId({ assetId = '', focusCard = '', accessoryKey = '' } = {}) {
    const card = String(focusCard || '').trim();
    if (card) return `${ASSET_FOCUS_PREFIX}${card}`;
    const id = String(assetId || '').trim();
    if (!id) return '';
    const base = `${ASSET_FOCUS_PREFIX}${id}`;
    const acc = String(accessoryKey || '').trim();
    return acc ? `${base}-acc-${acc}` : base;
}

export function resolveAccessoryFocusCard(accessory = null, accessoryName = '') {
    const name = String(accessoryName || accessory?.name || '').trim();
    const key = accessory?._id || accessory?.accessoryId;
    if (key) return `accessory-${String(key)}`;
    if (name) return `accessory-${slugifyAccessoryFocusKey(name)}`;
    return 'accessory';
}

export function parseAssetNotificationMeta(extra3) {
    if (!extra3) return null;
    try {
        return typeof extra3 === 'string' ? JSON.parse(extra3) : extra3;
    } catch {
        return null;
    }
}

/** Normalize bill month to YYYY-MM from meta, query, or "15/08/2026". */
export function normalizeUtilityNotificationBillMonth(raw) {
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
    const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}`;
    }
    const nested = s.match(/\((\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\)/);
    if (nested) return normalizeUtilityNotificationBillMonth(nested[1]);
    return '';
}

export function buildUtilityPaymentDayAddBillPath(entryId, billMonth = '') {
    const id = String(entryId || '').trim();
    if (!id) return '';
    return appendAssetQueryParams(`/HRM/Asset/UtilityBills/details/${encodeURIComponent(id)}`, {
        addBill: '1',
        ...(billMonth ? { billMonth } : {}),
    });
}

/** Bulk AC assignment group id from a dashboard / pending-inbox row, or ''. */
export function resolveBulkAssignmentGroupId(rawItem = {}) {
    const item = normalizeAssetNotificationItem(rawItem);
    const meta = parseAssetNotificationMeta(item.extra3);
    if (meta?.isBulkAssignment && meta?.bulkAssignmentGroupId) {
        return String(meta.bulkAssignmentGroupId);
    }
    if (rawItem?.bulkKind === 'assignment' && meta?.bulkAssignmentGroupId) {
        return String(meta.bulkAssignmentGroupId);
    }
    const fromRow =
        rawItem?.bulkAssignmentGroupId ||
        rawItem?.groupId ||
        meta?.bulkAssignmentGroupId ||
        rawItem?.asset?.bulkAssignmentGroupId ||
        rawItem?.primaryAsset?.bulkAssignmentGroupId ||
        rawItem?.raw?.bulkAssignmentGroupId ||
        rawItem?.raw?.asset?.bulkAssignmentGroupId;
    if (fromRow) return String(fromRow);

    // Fallback: bulk assignment wording in extra1 + multi asset ids on the row.
    const extra1 = String(rawItem?.extra1 || item.extra1 || '').toLowerCase();
    const bulkIds = rawItem?.bulkAssetIds || meta?.bulkAssetIds || [];
    if (
        Array.isArray(bulkIds) &&
        bulkIds.length > 1 &&
        (extra1.includes('bulk assignment') || meta?.isBulkAssignment === true)
    ) {
        // No stable group id — still signal bulk via empty string is wrong; callers need a real id.
        // Prefer first pendingActionDetails group if present on asset.
        const nested =
            rawItem?.asset?.pendingActionDetails?.bulkAssignment?.groupId ||
            rawItem?.primaryAsset?.pendingActionDetails?.bulkAssignment?.groupId;
        if (nested) return String(nested);
    }
    return '';
}

/** True when this inbox row is an AC bulk-assignment batch (open acknowledge modal, never single-asset page). */
export function isBulkAssignmentInboxRow(rawItem = {}) {
    if (resolveBulkAssignmentGroupId(rawItem)) return true;
    const meta = parseAssetNotificationMeta(
        normalizeAssetNotificationItem(rawItem).extra3 || rawItem?.extra3,
    );
    if (meta?.isBulkAssignment === true) return true;
    if (rawItem?.bulkKind === 'assignment' && rawItem?.isBulk) return true;
    const extra1 = String(rawItem?.extra1 || '').toLowerCase();
    const type = String(rawItem?.requestType || rawItem?.type || '').trim();
    if (
        extra1.includes('bulk assignment') &&
        (type === 'Asset' || type === 'Asset Assignment' || rawItem?.isBulk)
    ) {
        return true;
    }
    return false;
}

const BULK_ACTION_REQUEST_TYPES = new Set([
    'Asset Leave',
    'Asset Return',
    'Asset End of Life',
    'Asset Loss Damage',
    'Asset Transfer',
    'Asset Reassign',
    'Asset Approval',
    'Asset Bulk Action',
]);

function resolveBulkActionAssetIds(rawItem = {}) {
    const meta = parseAssetNotificationMeta(
        normalizeAssetNotificationItem(rawItem).extra3 || rawItem?.extra3,
    );
    const fromRow = Array.isArray(rawItem?.bulkAssetIds) ? rawItem.bulkAssetIds : [];
    const fromBulkAssets = Array.isArray(rawItem?.bulkAssets)
        ? rawItem.bulkAssets.map((a) => a?._id || a?.id).filter(Boolean)
        : [];
    const fromMeta = Array.isArray(meta?.assetIds)
        ? meta.assetIds
        : Array.isArray(meta?.bulkAssetIds)
          ? meta.bulkAssetIds
          : [];
    const fromAsset = Array.isArray(rawItem?.asset?.pendingActionDetails?.bulkAssetIds)
        ? rawItem.asset.pendingActionDetails.bulkAssetIds
        : [];
    return [
        ...new Set(
            [...fromRow, ...fromBulkAssets, ...fromMeta, ...fromAsset]
                .map((id) => String(id).trim())
                .filter(Boolean),
        ),
    ];
}

function looksLikeBulkActionLabel(rawItem = {}) {
    const extra1 = String(rawItem?.extra1 || '').toLowerCase();
    if (!extra1) return false;
    if (/^bulk\s+/.test(extra1)) return true;
    return (
        extra1.includes('bulk leave') ||
        extra1.includes('bulk return') ||
        extra1.includes('bulk end of life') ||
        extra1.includes('bulk end of services') ||
        extra1.includes('bulk loss') ||
        extra1.includes('bulk transfer') ||
        extra1.includes('bulk reassign') ||
        extra1.includes('bulk approval') ||
        /\(\s*\d+\s+assets?\s*\)/.test(extra1)
    );
}

/**
 * Bulk leave / return / EOL / L&D / transfer / creation — open BulkPendingResolveModal (list + checkboxes).
 * Never navigate to a single asset detail page for these.
 */
export function isBulkActionInboxRow(rawItem = {}) {
    if (!rawItem || isBulkAssignmentInboxRow(rawItem)) return false;
    const type = String(rawItem?.requestType || rawItem?.type || '').trim();
    const meta = parseAssetNotificationMeta(
        normalizeAssetNotificationItem(rawItem).extra3 || rawItem?.extra3,
    );
    const ids = resolveBulkActionAssetIds(rawItem);
    const bulkAssetsLen = Array.isArray(rawItem?.bulkAssets) ? rawItem.bulkAssets.length : 0;
    const totalAssets = Number(meta?.totalAssets) || 0;
    const multi =
        ids.length > 1 || bulkAssetsLen > 1 || totalAssets > 1 || looksLikeBulkActionLabel(rawItem);
    if (!multi) return false;

    if (rawItem?.isBulk || meta?.isBulk === true || meta?.isBulkCreation === true) return true;
    if (BULK_ACTION_REQUEST_TYPES.has(type)) return true;
    if (looksLikeBulkActionLabel(rawItem)) return true;
    if (rawItem?.bulkKind && rawItem.bulkKind !== 'assignment') return true;
    return false;
}

/** Normalize a bulk-action inbox row so the resolve modal always has bulkAssetIds. */
export function withBulkActionAssetIds(rawItem = {}) {
    const ids = resolveBulkActionAssetIds(rawItem);
    const requestType = String(rawItem?.requestType || rawItem?.type || '').trim();
    const base = {
        ...rawItem,
        requestType: requestType || rawItem?.requestType,
        type: rawItem?.type || requestType,
    };
    if (!ids.length) return base;
    return {
        ...base,
        isBulk: true,
        bulkKind:
            rawItem?.bulkKind && rawItem.bulkKind !== 'assignment'
                ? rawItem.bulkKind
                : requestType === 'Asset Approval' ||
                    parseAssetNotificationMeta(rawItem?.extra3)?.isBulkCreation
                  ? 'creation'
                  : requestType === 'Asset Return'
                    ? 'return'
                    : 'action',
        bulkAssetIds: ids,
    };
}

/** Dashboard extra3 may store a full frontend URL — router needs an app-relative path. */
export function normalizeNotificationDestinationPath(path = '') {
    if (!path || typeof path !== 'string') return '';
    let trimmed = path.trim();
    if (!trimmed) return '';

    if (/^\/https?:\/?/i.test(trimmed)) {
        trimmed = trimmed.replace(/^\/+/, '').replace(/^http:\/?\/?/i, 'http://');
    }

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch {
            return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        }
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function normalizeAssetNotificationItem(item = {}) {
    return {
        id: item?.id || item?.primaryAssetId || item?.requestObjectId || item?.asset?._id || '',
        type: String(item?.type || item?.requestType || '').trim(),
        extra1: item?.extra1 || '',
        extra2: item?.extra2 || '',
        extra3: item?.extra3 || '',
        dashboardActionId: item?.dashboardActionId || '',
    };
}

export function parseAccessoryNameFromExtra1(extra1 = '') {
    const match = String(extra1 || '').match(/Accessory:\s*(.+)$/i);
    return match ? match[1].trim() : '';
}

export function isAccessoryAssetNotification(item = {}) {
    const type = String(item.type || item.requestType || '').toLowerCase();
    if (type.includes('accessory')) return true;
    return String(item.extra1 || '').includes('Accessory:');
}

function tabForAssetRequestType(typeRaw = '', item = {}) {
    if (isAccessoryAssetNotification({ type: typeRaw, extra1: item.extra1 })) return 'accessories';
    return 'document';
}

function resolveAssetDetailFocusCard(typeRaw = '', item = {}, meta = null) {
    const tl = String(typeRaw || '').toLowerCase();
    const extra2 = String(item.extra2 || '').trim().toLowerCase();

    if (tl === 'asset approval' || tl === 'vehicle profile activation') return 'pendingApproval';
    if (tl === 'asset assignment') return 'pendingAssignment';
    if (isAccessoryAssetNotification({ type: typeRaw, extra1: item.extra1 })) {
        const accName = parseAccessoryNameFromExtra1(item.extra1);
        return resolveAccessoryFocusCard(null, accName);
    }
    if (
        tl.includes('loss') ||
        tl.includes('damage') ||
        extra2.includes('loss and damage') ||
        tl.includes('end of life') ||
        tl.includes('transfer') ||
        tl.includes('return') ||
        tl.includes('retention') ||
        tl === 'asset bulk action'
    ) {
        return 'pendingAction';
    }
    if (tl === 'asset overdue' || (tl === 'asset leave' && extra2.includes('on leave'))) {
        return 'operationalExpiry';
    }
    if (tl.includes('leave')) {
        return 'pendingAction';
    }
    if (tl === 'vehicle disposition request') return 'dispositionReview';
    return 'pendingAction';
}

export function buildAssetListPath(params = {}) {
    return appendAssetQueryParams('/HRM/Asset', params);
}

export function buildAssetDetailPath(assetId, params = {}) {
    if (!assetId) return '/HRM/Asset';
    return appendAssetQueryParams(`/HRM/Asset/details/${encodeURIComponent(String(assetId))}`, params);
}

export function buildVehicleDetailPath(vehicleId, params = {}) {
    if (!vehicleId) return '';
    return appendAssetQueryParams(`/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}`, params);
}

/**
 * Path for pending-inbox / Vehicle bell rows.
 * Always returns a usable vehicle destination when the row has an asset id —
 * never hide a counted badge item because detailsPath meta is missing.
 */
export function resolvePendingInboxRowPath(rawItem = {}) {
    const normalized = normalizeAssetNotificationItem(rawItem);
    const primaryPath = buildAssetNotificationPath(normalized);
    if (primaryPath) return primaryPath;

    const assetId = String(
        rawItem?.primaryAssetId ||
            rawItem?.requestObjectId ||
            rawItem?.asset?._id ||
            normalized.id ||
            '',
    ).trim();
    if (!assetId) return '';

    const type = String(rawItem?.requestType || rawItem?.type || normalized.type || '').trim();
    const low = type.toLowerCase();

    if (low === 'vehicle service request' || low.includes('service request')) {
        return buildVehicleDetailPath(assetId, { tab: 'service' });
    }
    if (low.startsWith('vehicle') || low === 'asset approval' || low === 'asset assignment' || low === 'asset return') {
        return buildVehicleDetailPath(assetId);
    }
    return '';
}

/** True when a pending-inbox row should appear in Vehicle/Tools modal (matches bell count). */
export function isDisplayableAssetPendingInboxRow(row = {}) {
    if (!row) return false;
    if (resolveBulkAssignmentGroupId(row) || isBulkAssignmentInboxRow(row) || isBulkActionInboxRow(row)) {
        return true;
    }
    if (row?.isBulk && Array.isArray(row.bulkAssetIds) && row.bulkAssetIds.length > 1) return true;
    if (String(row?.requestType || '').trim() === 'Asset Owner On Duty') return true;
    return Boolean(resolvePendingInboxRowPath(row));
}

function parseVehicleServiceTypeFromNotification(item = {}, meta = null) {
    const fromMeta = String(meta?.serviceType || '').trim();
    if (fromMeta) return fromMeta;
    const extra1 = String(item.extra1 || '');
    // Match em dash, en dash, mojibake "â€”", or plain hyphen separators.
    const match = extra1.match(/(?:—|–|â€”|-)\s*([^—–\-\n]+)$/);
    return match ? match[1].trim() : '';
}

function buildOilServiceNotificationPath(vehicleId, serviceRecordId, { focus = '', oilStage = '' } = {}) {
    if (!vehicleId || !serviceRecordId) return '';
    const base = `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}/oil-service/${encodeURIComponent(String(serviceRecordId))}`;
    const focusKey = String(focus || oilStage || '')
        .trim()
        .toLowerCase();
    if (focusKey === 'payment' || focusKey === 'accounts_payment') {
        return `${base}?focus=payment`;
    }
    return base;
}

function buildTireChangeNotificationPath(vehicleId, serviceRecordId) {
    if (!vehicleId || !serviceRecordId) return '';
    return `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}/tire-change/${encodeURIComponent(String(serviceRecordId))}`;
}

function buildShopServiceNotificationPath(vehicleId, serviceRecordId, serviceType) {
    if (!vehicleId || !serviceRecordId) return '';
    const type = String(serviceType || '').trim();
    const slug =
        type === 'Mechanical Work'
            ? 'mechanical-work'
            : type === 'Body Work'
              ? 'body-work'
              : type === 'Accident Repair'
                ? 'accident-repair'
                : '';
    if (!slug) return '';
    return `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}/${slug}/${encodeURIComponent(String(serviceRecordId))}`;
}

export function resolveVehicleExpiryFocusFromLabel(label = '') {
    const l = String(label || '').trim().toLowerCase();
    if (l.includes('mulkia') || l.includes('registration')) return 'vehicleRegistration';
    if (l.includes('insurance')) return 'vehicleInsurance';
    if (l.includes('warranty')) return 'vehicleWarranty';
    if (l.includes('permit')) return 'vehiclePermit';
    if (l.includes('petrol')) return 'vehiclePetrol';
    if (l.includes('toll')) return 'vehicleToll';
    if (l.includes('mortgage')) return 'vehicleMortgage';
    if (l.includes('service') || l.includes('gear oil')) return 'vehicleService';
    return 'vehicleRegistration';
}

export function resolveVehicleExpiryTabFromLabel(label = '') {
    const l = String(label || '').trim().toLowerCase();
    if (l.includes('permit')) return 'permit';
    if (l.includes('service') || l.includes('gear oil')) return 'service';
    if (l.includes('petrol') || l.includes('toll') || l.includes('mortgage')) return 'document';
    return 'basic';
}

/**
 * Exact destination for asset / fleet dashboard notifications and pending inbox rows.
 * Returns '' when the item is not an asset workflow notification.
 */
export function buildAssetNotificationPath(rawItem) {
    if (isEmployeeHubRequestItem(rawItem)) {
        return buildEmployeeHubDashboardPath(rawItem);
    }
    const item = normalizeAssetNotificationItem(rawItem);
    const typeRaw = item.type;
    const type = typeRaw.toLowerCase();
    const meta = parseAssetNotificationMeta(item.extra3);
    const assetId = item.id ? String(item.id) : '';

    // Bulk leave / transfer / EOL / return / L&D / creation → modal only (no detail page).
    if (isBulkActionInboxRow(rawItem) || isBulkAssignmentInboxRow(rawItem)) {
        return '';
    }

    if (
        type.includes('utility bill') ||
        type.includes('utility entry status') ||
        type.includes('utility contract')
    ) {
        const isPaymentDayReminder =
            type.includes('utility bill payment reminder') || typeRaw === 'Utility Bill Payment Reminder';
        if (isPaymentDayReminder) {
            const entryId = String(meta?.entryId || '').trim();
            const billMonth =
                normalizeUtilityNotificationBillMonth(
                    meta?.yearMonth || meta?.billMonth || meta?.dueDateKey,
                ) || normalizeUtilityNotificationBillMonth(item.extra2);
            const addBillPath = buildUtilityPaymentDayAddBillPath(entryId, billMonth);
            if (addBillPath) return addBillPath;
            if (meta?.detailsPath) {
                return appendAssetQueryParams(normalizeNotificationDestinationPath(meta.detailsPath), {
                    addBill: '1',
                    ...(billMonth ? { billMonth } : {}),
                });
            }
        }
        if (meta?.reviewPath) return normalizeNotificationDestinationPath(meta.reviewPath);
        if (meta?.detailsPath) return normalizeNotificationDestinationPath(meta.detailsPath);
        if (meta?.statusChangeId) {
            return `/HRM/Asset/UtilityBills?statusChangeId=${encodeURIComponent(String(meta.statusChangeId))}&review=1`;
        }
        // requestId on DashboardAction is the batchId for Utility Bill Payment
        const batchId = String(meta?.batchId || item.id || '').trim();
        if (batchId && type.includes('utility bill payment') && !type.includes('reminder') && !type.includes('contract')) {
            const q = new URLSearchParams({ batchId, review: '1' });
            if (meta?.utilityType) q.set('type', String(meta.utilityType));
            if (meta?.billMonth) q.set('billMonth', String(meta.billMonth));
            return `/HRM/Asset/UtilityBills?${q.toString()}`;
        }
        if (meta?.entryId) {
            const billQ = meta.billId ? `?billId=${encodeURIComponent(String(meta.billId))}` : '';
            return `/HRM/Asset/UtilityBills/details/${encodeURIComponent(String(meta.entryId))}${billQ}`;
        }
        return '/HRM/Asset/UtilityBills';
    }

    if (type.includes('vehicle document expiry') && assetId) {
        const label = String(item.extra1 || '')
            .replace(/^Expiry follow-up required:\s*/i, '')
            .replace(/\s*\(Exp:[^)]+\)\s*$/i, '')
            .trim();
        const tab = meta?.vehicleTab || resolveVehicleExpiryTabFromLabel(label);
        const focusCard = meta?.focusCard || resolveVehicleExpiryFocusFromLabel(label);
        return buildVehicleDetailPath(assetId, { tab, focusCard });
    }

    if (type.includes('vehicle service request')) {
        const vehicleId = meta?.vehicleId || assetId;
        const serviceRecordId = meta?.serviceRecordId || '';
        const serviceType = parseVehicleServiceTypeFromNotification(item, meta);

        if (meta?.detailsPath) {
            const normalized = normalizeNotificationDestinationPath(meta.detailsPath);
            if (
                serviceType === 'Oil Service' &&
                vehicleId &&
                serviceRecordId &&
                normalized.includes('/service-requests/details/')
            ) {
                return buildOilServiceNotificationPath(vehicleId, serviceRecordId, {
                    focus: meta?.focus,
                    oilStage: meta?.oilStage,
                });
            }
            if (
                serviceType === 'Tire Change' &&
                vehicleId &&
                serviceRecordId &&
                (normalized.includes('/service-requests/details/') ||
                    normalized.includes('/tire-change/'))
            ) {
                return buildTireChangeNotificationPath(vehicleId, serviceRecordId);
            }
            const shopPath = buildShopServiceNotificationPath(vehicleId, serviceRecordId, serviceType);
            if (
                shopPath &&
                (normalized.includes('/service-requests/details/') ||
                    normalized.includes('/mechanical-work/') ||
                    normalized.includes('/body-work/') ||
                    normalized.includes('/accident-repair/'))
            ) {
                return shopPath;
            }
            // Ensure Accounts Make Payment inbox rows land on Zoho Make Payment card.
            if (
                serviceType === 'Oil Service' &&
                vehicleId &&
                serviceRecordId &&
                (String(meta?.oilStage || '').toLowerCase() === 'accounts_payment' ||
                    String(meta?.focus || '').toLowerCase() === 'payment') &&
                !normalized.includes('focus=payment')
            ) {
                return buildOilServiceNotificationPath(vehicleId, serviceRecordId, {
                    focus: 'payment',
                    oilStage: 'accounts_payment',
                });
            }
            return normalized;
        }

        if (vehicleId && serviceRecordId) {
            if (serviceType === 'Car Wash') {
                return buildVehicleDetailPath(vehicleId, {
                    tab: 'service',
                    carWashServiceId: String(serviceRecordId),
                });
            }
            if (serviceType === 'Oil Service') {
                return buildOilServiceNotificationPath(vehicleId, serviceRecordId, {
                    focus: meta?.focus,
                    oilStage: meta?.oilStage,
                });
            }
            if (serviceType === 'Tire Change') {
                return buildTireChangeNotificationPath(vehicleId, serviceRecordId);
            }
            const shopPath = buildShopServiceNotificationPath(vehicleId, serviceRecordId, serviceType);
            if (shopPath) return shopPath;
            return `/HRM/Asset/Vehicle/service-requests/details/${encodeURIComponent(String(vehicleId))}/${encodeURIComponent(String(serviceRecordId))}`;
        }
        return vehicleId
            ? appendAssetQueryParams(`/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}`, { tab: 'service' })
            : '';
    }

    if (type.includes('vehicle profile incomplete')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        const tab = meta?.vehicleTab || 'basic';
        const focusCard = meta?.focusCard || 'basicDetails';
        return vehicleId ? buildVehicleDetailPath(vehicleId, { tab, focusCard }) : '';
    }

    if (type.includes('vehicle profile activation') || type.includes('vehicle profile edit')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, { focusCard: 'pendingApproval' })
            : '';
    }

    if (type.includes('vehicle assignment photo review')) {
        if (meta?.detailsPath) return normalizeNotificationDestinationPath(meta.detailsPath);
        const vehicleId = meta?.vehicleMongoId || meta?.vehicleId || assetId;
        const historyId = meta?.historyId;
        if (vehicleId && historyId) {
            return `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}/assign/${encodeURIComponent(String(historyId))}`;
        }
        return vehicleId ? buildVehicleDetailPath(vehicleId, { tab: 'handover' }) : '';
    }

    if (type.includes('vehicle inspection')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        if (meta?.detailsPath) return normalizeNotificationDestinationPath(meta.detailsPath);
        const historyId = meta?.historyId;
        if (vehicleId && historyId) {
            return `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}/assign/${encodeURIComponent(String(historyId))}`;
        }
        const wantsHrReview =
            meta?.inspectionReview === true ||
            meta?.inspectionReview === '1' ||
            meta?.inspectionReview === 1;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, {
                  tab: meta?.vehicleTab || 'handover',
                  ...(wantsHrReview ? { inspectionReview: '1' } : {}),
              })
            : '';
    }

    if (type.includes('vehicle mortgage close')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, { tab: 'basic', mortgageCloseReview: '1' })
            : '';
    }

    if (type.includes('vehicle delete')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, { tab: 'basic', vehicleDeleteReview: '1' })
            : '';
    }

    if (type.includes('vehicle disposition')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        if (!vehicleId) return '';
        const params = { dispositionReview: '1', focusCard: 'dispositionReview' };
        if (meta?.dispositionViewerRole) params.dispositionRole = String(meta.dispositionViewerRole);
        return buildVehicleDetailPath(vehicleId, params);
    }

    if (typeRaw === 'Asset Overdue' && assetId) {
        return buildAssetDetailPath(assetId, { focusCard: 'operationalExpiry', tab: 'document' });
    }

    if (typeRaw === 'Asset Leave' && assetId) {
        const extra2 = String(item.extra2 || '').toLowerCase();
        if (extra2.includes('on leave') || extra2.includes('extend') || extra2.includes('on duty')) {
            return buildAssetDetailPath(assetId, { focusCard: 'operationalExpiry', tab: 'document' });
        }
    }

    if (type.includes('owner on duty')) {
        const reviewId = rawItem?.dashboardActionId || item.dashboardActionId;
        if (reviewId) {
            return buildAssetListPath({ ownerOnDutyReview: String(reviewId) });
        }
        return buildAssetListPath({});
    }

    if (!type.startsWith('asset') && typeRaw !== 'Asset Overdue') return '';

    if (meta?.isBulkAssignment && meta?.bulkAssignmentGroupId) {
        const params = { bulkAssignmentGroup: String(meta.bulkAssignmentGroupId) };
        if (assetId) params.focusAsset = assetId;
        return buildAssetListPath(params);
    }

    // Bare requestType "Asset" bulk rows (legacy) — never send to a single asset detail page.
    if (
        (typeRaw === 'Asset' || typeRaw === 'Asset Assignment') &&
        meta?.isBulkAssignment === true &&
        Array.isArray(meta?.bulkAssetIds) &&
        meta.bulkAssetIds.length > 1
    ) {
        const gid = meta?.bulkAssignmentGroupId;
        if (gid) {
            return buildAssetListPath({
                bulkAssignmentGroup: String(gid),
                ...(assetId ? { focusAsset: assetId } : {}),
            });
        }
    }

    const vehicleId = meta?.vehicleMongoId || (meta?.isFleetVehicle ? assetId : null);
    if (typeRaw === 'Asset Approval' && meta?.isFleetVehicle && vehicleId) {
        return buildVehicleDetailPath(vehicleId, { focusCard: 'pendingApproval' });
    }

    const assetDoc = rawItem?.asset;
    const assetLooksLikeVehicle =
        !!(assetDoc?.plateNumber && String(assetDoc.plateNumber).trim()) ||
        /vehicle|car|fleet|truck/i.test(String(assetDoc?.typeId?.name || assetDoc?.type || ''));
    if (typeRaw === 'Asset Approval' && assetLooksLikeVehicle && assetId) {
        return buildVehicleDetailPath(assetId, { focusCard: 'pendingApproval' });
    }

    const bulkIds = Array.isArray(meta?.bulkAssetIds) ? meta.bulkAssetIds.filter(Boolean).map(String) : [];
    if (typeRaw === 'Asset Approval' && meta?.isBulkCreation && bulkIds.length > 0 && assetId) {
        return buildAssetDetailPath(assetId, {
            bulkCreation: '1',
            bulkAssetIds: bulkIds.join(','),
            tab: 'document',
            focusCard: 'pendingApproval',
        });
    }

    if (!assetId) return '/HRM/Asset';

    if (isAccessoryAssetNotification(item)) {
        const accName = parseAccessoryNameFromExtra1(item.extra1);
        const focusCard = resolveAccessoryFocusCard(null, accName);
        const params = {
            tab: 'accessories',
            focusCard,
            authAction: 'accessory',
        };
        if (accName) params.focusAccessory = accName;
        return buildAssetDetailPath(assetId, params);
    }

    if (typeRaw === 'Asset Approval') {
        return buildAssetDetailPath(assetId, { tab: 'document', focusCard: 'pendingApproval' });
    }

    if (typeRaw === 'Asset Assignment') {
        // Bulk batch must never fall through to a single-asset Accept page.
        if (meta?.isBulkAssignment && meta?.bulkAssignmentGroupId) {
            return buildAssetListPath({
                bulkAssignmentGroup: String(meta.bulkAssignmentGroupId),
                ...(assetId ? { focusAsset: assetId } : {}),
            });
        }
        const historyId = meta?.historyId;
        const vehicleId = meta?.vehicleMongoId || assetId;
        if (meta?.assignmentOutcome) {
            return buildAssetDetailPath(assetId, { tab: 'document' });
        }
        if (meta?.detailsPath) return normalizeNotificationDestinationPath(meta.detailsPath);
        if (meta?.isFleetVehicle && vehicleId && historyId) {
            return `/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}/assign/${encodeURIComponent(String(historyId))}`;
        }
        return buildAssetDetailPath(assetId, { tab: 'document', focusCard: 'pendingAssignment' });
    }

    if (typeRaw === 'Asset' && meta?.isBulkAssignment && meta?.bulkAssignmentGroupId) {
        return buildAssetListPath({
            bulkAssignmentGroup: String(meta.bulkAssignmentGroupId),
            ...(assetId ? { focusAsset: assetId } : {}),
        });
    }

    if (typeRaw === 'Asset' && String(item.extra2 || '').toLowerCase().includes('assign')) {
        return buildAssetDetailPath(assetId, { tab: 'document', focusCard: 'pendingAssignment' });
    }

    if (typeRaw === 'Asset Loss Damage' || String(item.extra2 || '').includes('Loss and Damage')) {
        return buildAssetDetailPath(assetId, {
            tab: 'document',
            focusCard: 'pendingAction',
            authAction: 'damage',
        });
    }

    const tab = tabForAssetRequestType(typeRaw, item);
    const focusCard = resolveAssetDetailFocusCard(typeRaw, item, meta);
    const params = { tab, focusCard };

    if (typeRaw === 'Asset End of Life') params.authAction = 'eol';

    return buildAssetDetailPath(assetId, params);
}
