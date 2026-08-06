/**
 * Sequential lock messages for shop services (Tire / Mechanical / Body),
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
            if (isTerminal(stage) && garageDone) {
                return { locked: true, message: 'Schedule locked — this service is complete or billed' };
            }
            // Oil-style: Schedule + HR open together after Initiate (pending_hr).
            if (
                stage === 'pending_hr' ||
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
                    active:
                        (stage === 'pending_hr' && !garageDone) ||
                        stage === 'pending_admin_officer' ||
                        (stage === 'pending_accounts' && !garageDone),
                    done: garageDone,
                };
            }
            return { locked: true, message: 'Complete Initiate Service and click Send first' };
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
            if (!garageDone || !accountsApproved) {
                return {
                    locked: true,
                    message: 'Complete Schedule/Reschedule and Accounts Approve first',
                };
            }
            if (stage === 'pending_admin_return' || stage === 'scheduled_service') {
                return { locked: false, message: '', active: true, done: false };
            }
            return {
                locked: true,
                message: 'Complete Schedule/Reschedule and Accounts Approve first',
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
