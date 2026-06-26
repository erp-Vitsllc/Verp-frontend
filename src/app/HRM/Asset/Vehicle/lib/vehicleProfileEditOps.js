import axiosInstance from '@/utils/axios';

export function isVehicleProfileActive(asset) {
    return String(asset?.vehicleProfileActivationStatus || '').toLowerCase() === 'active';
}

export function vehicleProfileEditPending(asset) {
    return String(asset?.vehicleProfileEditReviewStatus || '').toLowerCase() === 'pending_hr';
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

export async function saveVehicleSectionOrQueue({
    asset,
    assetId,
    sectionId,
    action = 'edit',
    steps,
    documentId = null,
}) {
    if (!requiresVehicleProfileEditApproval(asset)) {
        for (const step of steps) {
            await executeVehicleEditStep(assetId, step);
        }
        return { applied: true, queued: false };
    }

    await axiosInstance.post(`/AssetItem/${assetId}/submit-vehicle-profile-edit`, {
        sectionId,
        action,
        steps,
        documentId,
    });
    return { applied: false, queued: true };
}
