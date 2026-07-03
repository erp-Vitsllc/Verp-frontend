import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';
import { resolveShopServiceEndDate } from './vehicleShopWorkStatus';
import { isOilServiceAssignmentPending } from './vehicleOilServiceAccess';

export function resolveServiceExtendDate(service, asset) {
    return resolveShopServiceEndDate(service, asset);
}

export function canEditServiceExtendDate({
    assignmentPending,
    isComplete = false,
    stage = '',
    canManage = false,
} = {}) {
    if (!canManage || assignmentPending || isComplete) return false;
    const normalizedStage = String(stage || '').toLowerCase();
    if (!normalizedStage || normalizedStage === 'rejected') return false;
    return true;
}

export function shouldShowServiceCompletedCard(service, assignmentPending, stage) {
    if (assignmentPending) return false;
    const normalizedStage = String(stage || '').toLowerCase();
    if (!normalizedStage || normalizedStage === 'rejected') return false;
    const remark = parseVehicleServiceRemark(service) || {};
    if (isOilServiceAssignmentPending(remark)) return false;
    return true;
}
