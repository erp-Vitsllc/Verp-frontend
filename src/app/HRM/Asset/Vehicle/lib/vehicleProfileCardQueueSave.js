import { saveVehicleSectionOrQueue } from './vehicleProfileEditOps';
import { buildVehicleProfileEditSnapshots } from './vehicleProfileEditSnapshots';

/**
 * Save a vehicle profile card via HR queue when the profile is active (employee/company pattern).
 */
export async function saveVehicleProfileCardOrQueue({
    asset,
    assetId,
    sectionId,
    action = 'edit',
    steps,
    documentId = null,
    hrMayApplyDirectly = false,
    proposedRows = [],
    toast,
    queuedMessage = 'Change saved. Submit for HR approval when ready.',
    appliedMessage = 'Saved successfully.',
    onSuccess,
    onClose,
}) {
    const { previousRows, proposedRows: resolvedProposedRows } = buildVehicleProfileEditSnapshots({
        sectionId,
        asset,
        proposedRows,
    });

    const result = await saveVehicleSectionOrQueue({
        asset,
        assetId,
        sectionId,
        action,
        steps,
        documentId,
        hrMayApplyDirectly,
        previousRows,
        proposedRows: resolvedProposedRows,
    });

    if (result.queued) {
        toast?.({
            title: 'Saved',
            description: queuedMessage,
        });
    } else {
        toast?.({
            title: 'Saved',
            description: appliedMessage,
        });
    }

    onSuccess?.();
    onClose?.();
    return result;
}
