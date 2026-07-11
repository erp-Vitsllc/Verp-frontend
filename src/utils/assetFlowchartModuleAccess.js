/**
 * Flowchart Asset Controller / Admin Officer override Vehicle + Tools module gates
 * even when group permissions for those modules are unchecked.
 */
import axiosInstance from '@/utils/axios';
import { isAdmin } from '@/utils/permissions';
import { ASSET_FLOWCHART_ROLE_META_KEY } from '@/utils/authSession';

const STORAGE_KEY = ASSET_FLOWCHART_ROLE_META_KEY;
const ASSET_MODULE_PREFIXES = ['hrm_asset_vehicle', 'hrm_asset_tools'];

let memoryCache = null;
let inflight = null;

function readStoredMeta() {
    if (typeof window === 'undefined') return null;
    if (memoryCache) return memoryCache;
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        memoryCache = parsed;
        return parsed;
    } catch {
        return null;
    }
}

export function getCachedAssetFlowchartRoleMeta() {
    return readStoredMeta();
}

export function setCachedAssetFlowchartRoleMeta(meta) {
    if (!meta || typeof meta !== 'object') return;
    const normalized = {
        isAdmin: meta.isAdmin === true,
        isAssetController: meta.isAssetController === true,
        isAdminOfficer: meta.isAdminOfficer === true || meta.isAdmin === true,
        canDirectAddAsset: meta.canDirectAddAsset === true,
        bypassAssetModules:
            meta.bypassAssetModules === true ||
            meta.isAdmin === true ||
            meta.isAssetController === true,
        fetchedAt: Date.now(),
    };
    memoryCache = normalized;
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch {
            /* ignore quota */
        }
    }
    return normalized;
}

export function clearCachedAssetFlowchartRoleMeta() {
    memoryCache = null;
    inflight = null;
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }
}

/** Flowchart AC or Admin Officer (or portal admin) — bypass Vehicle/Tools group perms. */
export function isFlowchartAssetModuleOverride(meta = null) {
    if (isAdmin()) return true;
    const m = meta || readStoredMeta();
    if (!m) return false;
    return (
        m.bypassAssetModules === true ||
        m.isAssetController === true ||
        m.isAdminOfficer === true ||
        m.isAdmin === true
    );
}

export function isAssetModuleId(moduleId) {
    const id = String(moduleId || '');
    return ASSET_MODULE_PREFIXES.some((prefix) => id === prefix || id.startsWith(`${prefix}_`));
}

/** True when group perm OR flowchart AC/Admin Officer override applies. */
export function canAccessAssetModuleViaFlowchart(moduleId, hasGroupAccess) {
    if (hasGroupAccess) return true;
    if (!isAssetModuleId(moduleId)) return false;
    return isFlowchartAssetModuleOverride();
}

export async function ensureAssetFlowchartRoleMeta({ force = false } = {}) {
    if (!force) {
        const cached = readStoredMeta();
        if (cached?.fetchedAt && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
            return cached;
        }
    }
    if (inflight) return inflight;

    inflight = axiosInstance
        .get('/AssetType/meta/role', { skipToast: true })
        .then((res) => {
            const data = res?.data || {};
            return setCachedAssetFlowchartRoleMeta({
                isAdmin: data.isAdmin === true,
                isAssetController: data.isAssetController === true,
                isAdminOfficer: data.isAdminOfficer === true || data.isAdmin === true,
                canDirectAddAsset: data.canDirectAddAsset === true,
                bypassAssetModules:
                    data.bypassAssetModules === true ||
                    data.isAdmin === true ||
                    data.isAssetController === true,
            });
        })
        .catch(() => readStoredMeta())
        .finally(() => {
            inflight = null;
        });

    return inflight;
}
