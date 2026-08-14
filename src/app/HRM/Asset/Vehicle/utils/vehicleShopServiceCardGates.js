/**
 * Sequential lock messages for shop services (Tire / Mechanical / Body / Accident),
 * matching Oil Service always-visible locked card shells.
 *
 * Page order matches Oil naming: Initiate → Schedule + HR (together) → Accounts → Complete → Make Payment
 * (Cash oil parallel: Schedule and HR unlock together after Initiate).
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

function isServiceCompletedLive(service) {
    const remark = parseVehicleServiceRemark(service) || {};
    return String(remark.vehicleServiceCompleted || '').toLowerCase() === 'live';
}

/**
 * Schedule/Reschedule stays editable after Initiate until Complete Service finishes.
 * Accounts Approve must NOT close Schedule.
 */
export function isShopScheduleOpenForAdmin(workflowStage = '', service = null) {
    const stage = stageOf(workflowStage);
    if (!stage || stage === 'pending' || stage === 'draft' || stage === 'rejected') {
        return false;
    }
    if (stage === 'complete' || stage === 'billed' || stage === 'pending_billing') {
        return false;
    }
    if (isServiceCompletedLive(service)) {
        return false;
    }
    return (
        stage === 'pending_hr' ||
        stage === 'pending_admin_officer' ||
        stage === 'pending_accounts' ||
        stage === 'scheduled_service' ||
        stage === 'pending_admin_return'
    );
}

/** Admin Officer (or super user via canManage) may edit Schedule while it is open. */
export function canEditShopServiceSchedule(workflowStage, canManageAsAdmin, { service } = {}) {
    if (!canManageAsAdmin) return false;
    return isShopScheduleOpenForAdmin(workflowStage, service);
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
    const skipHrAccounts =
        remark.hrApprovalNotRequired === true ||
        remark.accountsApprovalNotRequired === true ||
        String(remark.accidentOwnerType || '').trim().toLowerCase() === 'thirdparty';
    const returnDone =
        stage === 'pending_billing' ||
        stage === 'billed' ||
        stage === 'complete' ||
        isServiceCompletedLive(service);

    if (assignmentPending) {
        if (cardKey === SHOP_SERVICE_CARD.HR || cardKey === SHOP_SERVICE_CARD.ACCOUNTS) {
            return {
                locked: true,
                message: skipHrAccounts
                    ? 'Not required — other party damage'
                    : 'Complete Initiate Service and click Send first',
            };
        }
        if (cardKey === SHOP_SERVICE_CARD.SCHEDULE) {
            return {
                locked: true,
                message: 'Complete Initiate Service and click Send first',
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
            // Only Complete Service (or billed/rejected) locks Schedule — never Accounts Approve.
            if (isShopScheduleOpenForAdmin(stage, service)) {
                return {
                    locked: false,
                    message: '',
                    active: true,
                    done: garageDone,
                };
            }
            if (returnDone || stage === 'pending_billing' || stage === 'billed' || stage === 'complete') {
                return {
                    locked: true,
                    message: 'Schedule locked — Complete Service is done (or billed)',
                };
            }
            if (stage === 'rejected') {
                return { locked: true, message: 'Schedule locked — request rejected' };
            }
            return {
                locked: true,
                message: 'Complete Initiate Service and click Send first',
            };
        }
        case SHOP_SERVICE_CARD.HR: {
            if (skipHrAccounts) {
                return {
                    locked: true,
                    message: 'Not required — other party damage',
                    done: !assignmentPending,
                };
            }
            if (stage === 'pending_hr') {
                return { locked: false, message: '', active: true, done: false };
            }
            if (!assignmentPending) {
                return { locked: false, message: '', active: false, done: true };
            }
            return { locked: true, message: 'Complete Initiate Service and click Send first' };
        }
        case SHOP_SERVICE_CARD.ACCOUNTS: {
            if (skipHrAccounts) {
                return {
                    locked: true,
                    message: 'Not required — other party damage',
                    done: !assignmentPending,
                };
            }
            const accountsApproved = Boolean(
                String(remark.accountsQuoteApprovedAt || '').trim() ||
                    String(remark.accountsGarageApprovedAt || '').trim() ||
                    String(remark.accountsApprovedAt || '').trim(),
            );
            const pastAccountsByStage = [
                'pending_admin_return',
                'pending_billing',
                'billed',
                'complete',
                'scheduled_service',
            ].includes(stage);
            const done = accountsApproved || pastAccountsByStage;

            if (stage === 'pending_hr') {
                return { locked: true, message: 'Complete HR Approval first (HR once)' };
            }
            if (done) {
                return { locked: false, message: '', active: false, done: true };
            }
            if (stage === 'pending_accounts' || stage === 'pending_admin_officer') {
                return {
                    locked: false,
                    message: '',
                    active: stage === 'pending_accounts',
                    done: false,
                };
            }
            return { locked: true, message: 'Complete HR Approval first (HR once)' };
        }
        case SHOP_SERVICE_CARD.COMPLETE: {
            const accountsApproved = Boolean(
                String(remark.accountsQuoteApprovedAt || '').trim() ||
                    String(remark.accountsGarageApprovedAt || '').trim() ||
                    String(remark.accountsApprovedAt || '').trim(),
            );
            if (returnDone || stage === 'pending_billing' || stage === 'billed' || stage === 'complete') {
                return { locked: false, message: '', active: false, done: true };
            }
            if (!garageDone || (!skipHrAccounts && !accountsApproved)) {
                return {
                    locked: true,
                    message: skipHrAccounts
                        ? 'Complete Schedule/Reschedule first'
                        : 'Complete Schedule/Reschedule and Accounts Approve first',
                };
            }
            if (stage === 'pending_admin_return' || stage === 'scheduled_service') {
                return { locked: false, message: '', active: true, done: false };
            }
            return {
                locked: true,
                message: skipHrAccounts
                    ? 'Complete Schedule/Reschedule first'
                    : 'Complete Schedule/Reschedule and Accounts Approve first',
            };
        }
        case SHOP_SERVICE_CARD.PAYMENT: {
            const billingStatus = String(remark.billingStatus || '').toLowerCase();
            const otherParty =
                String(remark.accidentOwnerType || '').trim().toLowerCase() === 'thirdparty';
            if (billingStatus === 'not_required' || (otherParty && returnDone)) {
                return {
                    locked: true,
                    message: 'Zoho bill not required — other party damage',
                    done: true,
                };
            }
            if (otherParty) {
                return {
                    locked: true,
                    message: 'Zoho bill not required — other party damage',
                };
            }
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
