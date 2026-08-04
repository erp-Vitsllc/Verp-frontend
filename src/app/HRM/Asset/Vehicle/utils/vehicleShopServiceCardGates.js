/**
 * Sequential lock messages for shop services (Tire / Mechanical / Body),
 * matching Oil Service always-visible locked card shells.
 *
 * Page order matches Oil naming: Initiate → Schedule → HR|Accounts → Complete → Make Payment
 * with locks reflecting shop stage readiness (HR before Schedule edit).
 */

import { parseVehicleServiceRemark } from '../components/vehicleServiceUtils';

export const SHOP_SERVICE_CARD = {
    SCHEDULE: 'schedule',
    HR: 'hr',
    ACCOUNTS: 'accounts',
    COMPLETE: 'complete',
    PAYMENT: 'payment',
};

function stageOf(workflowStage) {
    return String(workflowStage || '').toLowerCase().trim();
}

function isTerminal(stage) {
    return stage === 'complete' || stage === 'billed' || stage === 'rejected';
}

export function resolveShopServiceCardGate({
    assignmentPending = false,
    workflowStage = '',
    service = null,
    cardKey,
}) {
    const stage = stageOf(workflowStage);
    const remark = parseVehicleServiceRemark(service) || {};
    const garageDone = Boolean(
        String(remark.garageSubmittedByName || '').trim() || remark.garageSubmittedAt,
    );
    const returnDone =
        stage === 'pending_billing' ||
        stage === 'billed' ||
        stage === 'complete' ||
        String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';

    if (assignmentPending) {
        if (cardKey === SHOP_SERVICE_CARD.HR || cardKey === SHOP_SERVICE_CARD.ACCOUNTS) {
            return {
                locked: true,
                message: 'Complete Initiate Service and click Send first',
            };
        }
        if (cardKey === SHOP_SERVICE_CARD.SCHEDULE) {
            return {
                locked: true,
                message: 'Complete Initiate Service and HR Approval first',
            };
        }
        if (cardKey === SHOP_SERVICE_CARD.COMPLETE) {
            return {
                locked: true,
                message: 'Complete Initiate Service, HR, and Schedule first',
            };
        }
        if (cardKey === SHOP_SERVICE_CARD.PAYMENT) {
            return {
                locked: true,
                message: 'Complete Service first — then Make Payment unlocks',
            };
        }
    }

    switch (cardKey) {
        case SHOP_SERVICE_CARD.SCHEDULE: {
            if (stage === 'pending_hr') {
                return { locked: true, message: 'Complete HR Approval first' };
            }
            if (isTerminal(stage) && garageDone) {
                return { locked: true, message: 'Schedule locked — this service is complete or billed' };
            }
            if (
                stage === 'pending_admin_officer' ||
                stage === 'pending_accounts' ||
                stage === 'scheduled_service' ||
                stage === 'pending_admin_return' ||
                stage === 'pending_billing' ||
                garageDone
            ) {
                return {
                    locked: false,
                    message: '',
                    active: stage === 'pending_admin_officer',
                    done: garageDone,
                };
            }
            return { locked: true, message: 'Complete HR Approval first' };
        }
        case SHOP_SERVICE_CARD.HR: {
            if (stage === 'pending_hr') {
                return { locked: false, message: '', active: true, done: false };
            }
            if (!assignmentPending) {
                return { locked: false, message: '', active: false, done: true };
            }
            return { locked: true, message: 'Complete Initiate Service and click Send first' };
        }
        case SHOP_SERVICE_CARD.ACCOUNTS: {
            if (stage === 'pending_hr') {
                return { locked: true, message: 'Complete HR Approval first (HR once)' };
            }
            if (stage === 'pending_accounts') {
                return { locked: false, message: '', active: true, done: false };
            }
            if (
                stage === 'scheduled_service' ||
                stage === 'pending_admin_return' ||
                stage === 'pending_billing' ||
                stage === 'billed' ||
                stage === 'complete'
            ) {
                return { locked: false, message: '', active: false, done: true };
            }
            if (stage === 'pending_admin_officer') {
                return {
                    locked: false,
                    message: '',
                    active: false,
                    done: false,
                };
            }
            return { locked: true, message: 'Complete HR Approval first (HR once)' };
        }
        case SHOP_SERVICE_CARD.COMPLETE: {
            if (returnDone || stage === 'pending_billing' || stage === 'billed' || stage === 'complete') {
                return { locked: false, message: '', active: false, done: true };
            }
            if (stage === 'pending_admin_return' || stage === 'scheduled_service') {
                return { locked: false, message: '', active: true, done: false };
            }
            return {
                locked: true,
                message: 'Complete Schedule and Reschedule Service first',
            };
        }
        case SHOP_SERVICE_CARD.PAYMENT: {
            if (stage === 'billed') {
                return { locked: true, message: 'Zoho bill already created — payment done' };
            }
            if (stage === 'pending_billing') {
                return { locked: false, message: '', active: true, done: false };
            }
            return {
                locked: true,
                message: 'Complete Service first — then Make Payment unlocks',
            };
        }
        default:
            return { locked: true, message: 'Unavailable' };
    }
}
