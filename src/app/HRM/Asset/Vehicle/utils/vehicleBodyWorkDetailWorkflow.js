import { buildShopServiceDetailWorkflowEvents } from './vehicleShopServiceDetailWorkflow';

/** @deprecated Prefer SHOP_SERVICE_CASH_WORKFLOW_STEPS — kept for any imports. */
export const BODY_WORK_WORKFLOW_STEPS = [
    { id: 1, label: 'Initiate Service', role: 'Creator' },
    { id: 2, label: 'Schedule and Reschedule', role: 'Admin Officer' },
    { id: 3, label: 'HR Approval', role: 'HR' },
    { id: 4, label: 'Accounts Approve', role: 'Accounts' },
    { id: 5, label: 'On Service', role: 'Service' },
    { id: 6, label: 'Complete Service', role: 'Admin Officer' },
    { id: 7, label: 'Make Payment', role: 'Accounts' },
];

export function buildBodyWorkDetailWorkflowEvents(asset, service, flowchartRows = []) {
    return buildShopServiceDetailWorkflowEvents(asset, service, flowchartRows, {
        activityLogKey: 'bodyWorkActivityLog',
    });
}
