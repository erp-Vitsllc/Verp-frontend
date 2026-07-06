import axiosInstance from '@/utils/axios';

export function isVehicleProfileActive(asset) {
    return String(asset?.vehicleProfileActivationStatus || '').toLowerCase() === 'active';
}

export function vehicleProfileEditPending(asset) {
    return String(asset?.vehicleProfileEditReviewStatus || '').toLowerCase() === 'pending_hr';
}

export function vehicleProfileEditDraft(asset) {
    const status = String(asset?.vehicleProfileEditReviewStatus || '').toLowerCase();
    return status === 'draft' || status === 'rejected';
}

export function hasVehicleProfileEditQueue(asset) {
    return (
        Array.isArray(asset?.vehiclePendingProfileEdits) && asset.vehiclePendingProfileEdits.length > 0
    );
}

export function requiresVehicleProfileEditApproval(asset) {
    return isVehicleProfileActive(asset);
}

export async function executeVehicleEditStep(assetId, step) {
    if (!step?.op) return;
    if (step.op === 'delete_document') {
        await axiosInstance.delete(`/AssetItem/${assetId}/document/${step.docId}`);
        return;
    }
    if (step.op === 'put_document') {
        await axiosInstance.put(`/AssetItem/${assetId}/document/${step.docId}`, step.body || {});
        return;
    }
    if (step.op === 'post_document') {
        await axiosInstance.post(`/AssetItem/${assetId}/document`, step.body || {});
        return;
    }
    if (step.op === 'put_asset_type') {
        await axiosInstance.put(`/AssetType/${assetId}`, step.body || {});
    }
}

async function applyVehicleSectionOnServer({ assetId, sectionId, action, steps, documentId }) {
    const { data } = await axiosInstance.post(`/AssetItem/${assetId}/apply-vehicle-profile-section`, {
        sectionId,
        action,
        steps,
        documentId,
    });
    return data;
}

export async function saveVehicleSectionOrQueue({
    asset,
    assetId,
    sectionId,
    action = 'edit',
    steps,
    documentId = null,
    hrMayApplyDirectly = false,
    previousRows = [],
    proposedRows = [],
}) {
    const profileActive = requiresVehicleProfileEditApproval(asset);

    if (!profileActive) {
        if (action === 'renew' || action === 'not_renew') {
            await applyVehicleSectionOnServer({ assetId, sectionId, action, steps, documentId });
        } else {
            for (const step of steps) {
                await executeVehicleEditStep(assetId, step);
            }
        }
        return { applied: true, queued: false };
    }

    if (hrMayApplyDirectly) {
        const data = await applyVehicleSectionOnServer({ assetId, sectionId, action, steps, documentId });
        return { applied: true, queued: false, data };
    }

    await axiosInstance.post(`/AssetItem/${assetId}/queue-vehicle-profile-edit`, {
        sectionId,
        action,
        steps,
        documentId,
        previousRows,
        proposedRows,
    });
    return { applied: false, queued: true, draft: true };
}

export async function sendVehicleProfileEditForApproval(assetId) {
    const { data } = await axiosInstance.post(`/AssetItem/${assetId}/submit-vehicle-profile-edit`);
    return data;
}
