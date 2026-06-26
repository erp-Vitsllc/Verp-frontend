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
 * Exact destination for asset / fleet dashboard notifications and pending inbox rows.
 * Returns '' when the item is not an asset workflow notification.
 */
export function buildAssetNotificationPath(rawItem) {
    const item = normalizeAssetNotificationItem(rawItem);
    const typeRaw = item.type;
    const type = typeRaw.toLowerCase();
    const meta = parseAssetNotificationMeta(item.extra3);
    const assetId = item.id ? String(item.id) : '';

    if (type.includes('vehicle service request')) {
        if (meta?.detailsPath) return meta.detailsPath;
        const vehicleId = meta?.vehicleId || assetId;
        const serviceRecordId = meta?.serviceRecordId || '';
        if (vehicleId && serviceRecordId) {
            return `/HRM/Asset/Vehicle/service-requests/details/${encodeURIComponent(String(vehicleId))}/${encodeURIComponent(String(serviceRecordId))}`;
        }
        return vehicleId
            ? appendAssetQueryParams(`/HRM/Asset/Vehicle/details/${encodeURIComponent(String(vehicleId))}`, { tab: 'service' })
            : '';
    }

    if (type.includes('vehicle profile activation') || type.includes('vehicle profile edit')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, { focusCard: 'pendingApproval' })
            : '';
    }

    if (type.includes('vehicle inspection')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, { tab: 'handover', inspectionReview: '1' })
            : '';
    }

    if (type.includes('vehicle mortgage close')) {
        const vehicleId = meta?.vehicleMongoId || assetId;
        return vehicleId
            ? buildVehicleDetailPath(vehicleId, { tab: 'basic', mortgageCloseReview: '1' })
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
        return buildAssetDetailPath(assetId, { tab: 'document', focusCard: 'pendingAssignment' });
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
