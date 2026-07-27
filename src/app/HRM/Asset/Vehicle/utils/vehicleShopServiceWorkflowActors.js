import {
    nameFromFlowchartRow,
    pickFlowchartAccountsRow,
    pickFlowchartAdminRow,
    pickFlowchartHrRow,
} from './vehicleHandoverAssignWorkflow';

/** Live flowchart holders used on shop-service workflow tracking steps. */
export function resolveShopServiceFlowchartActors(flowchartRows = []) {
    return {
        hr: nameFromFlowchartRow(pickFlowchartHrRow(flowchartRows)) || 'HR',
        adminOfficer: nameFromFlowchartRow(pickFlowchartAdminRow(flowchartRows)) || 'Admin Officer',
        accounts: nameFromFlowchartRow(pickFlowchartAccountsRow(flowchartRows)) || 'Accounts',
    };
}

/**
 * Fill empty step actors from the flowchart so the pending / next approver
 * name shows dynamically (same idea as Fine + handover trackers).
 *
 * Shop steps: 4 = Quotation (HR), 5 = Garage (Admin Officer), 6 = Accounts.
 * Accident repair skips HR quotation → step 4 also uses Admin Officer.
 */
export function resolveShopServiceStepActor(
    stepId,
    {
        actor = '',
        flowchartActors = null,
        skipHrQuotation = false,
    } = {},
) {
    const existing = String(actor || '').trim();
    if (existing) return existing;
    if (!flowchartActors) return '';

    if (stepId === 4) {
        return skipHrQuotation ? flowchartActors.adminOfficer : flowchartActors.hr;
    }
    if (stepId === 5) return flowchartActors.adminOfficer;
    if (stepId === 6) return flowchartActors.accounts;
    return '';
}
