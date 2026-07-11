import { buildVehicleHandoverAssignGridFields } from './vehicleHandoverAssignGrid';
import { buildBodyConditionDisplayPairs } from './vehicleHandoverBodyCondition';
import { buildReceiverAssessmentRows } from './vehicleHandoverReceiverAssessment';
import {
    getHandoverByLabel,
    getHandoverReason,
    getHandoverToLabel,
    fmtHandoverPerson,
} from './vehicleHandoverHistory';
import { formatEmployeeName } from './vehicleHandoverAssignWorkflow';

export const VEHICLE_USAGE_POLICY_PARAGRAPHS = [
    'This Vehicle Usage Policy outlines the guidelines and responsibilities for employees using company vehicles, especially when they are used for personal purposes outside of office hours. The policy also addresses the procedures to be followed in case of accidents and the driver\'s financial responsibility during garage downtime.',
    'Vehicle Assignment: Vehicles are provided solely for business purposes.',
    'Personal Use: Employees may use company vehicles for personal purposes which includes picking and dropping off at the airport or any other personal errands outside office hours only after informing HR Personal use of vehicle is a privilege not an entitlement. Misuse may result in disciplinary action.',
    'Accident: In the event of any accident outside office hours, assigned employee / driver must report it to HR providing all relevant information and documents.',
    'Financial Responsibility during garage time: If the unavailability of vehicle is due to an accident caused by driver\'s negligence, the driver is responsible for any repair or rental car costs incurred during the garage time.',
    'Premium Adjustments/ Total Loss: If an employee\'s driving record leads to increased insurance premiums for the company or reduces the amount recoverable in the event of a total loss, the employee may be required to contribute to these costs. The contribution amount will be determined based on the increase in premiums directly attributed to the employee\'s driving record',
    'Liability Caps: Employees will be financially responsible for all damages resulting from accidents where their negligence is proven. This applies to both company vehicle and third-party claims',
    'Usage Fees: For employees with a history of frequent accidents (2 and above in a year), a nominal usage fee of AED 1000 will be deducted from their salary. This fee is intended to contribute towards maintenance and operational costs associated with their use of company vehicles.',
    'Repair Costs: If an employee is found at fault for an accident, they may be required to cover the full amount of vehicle repair costs. This will be assessed based on the extent of the damage and repair needs.',
    'Maintenance & Cleanliness: Assigned employee is responsible for ensuring the cleanliness and proper maintenance of the Vehicle they use at all times. Vehicles used for picking and dropping employees at the site must be washed twice while other vehicles should be washed once. Company will reimburse the bill once it is submitted.',
    'By signing below, I acknowledge that I have read, understood, and agree to comply with the terms and conditions outlined in the policy.',
    'Important Note : -Please be advised that if evidence of any scratches or damages is not provided during the handover process, and such damages are not recorded in our previous handover history, the current damages will be attributed to your responsibility. Therefore, we strongly recommend updating the vehicle condition thoroughly during the handover. ensure a smooth and transparent vehicle handover or takeover process, please provide photos of the car from all sides, both exterior and interior, at the time of handover. Kindly mark all relevant details in the vehicle condition report.',
];

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function resolveAssignee(historyEntry, vehicle) {
    const snapshot =
        historyEntry?.details && typeof historyEntry.details === 'object'
            ? historyEntry.details
            : vehicle || {};
    return (
        historyEntry?.assignedTo ||
        snapshot?.assignedTo ||
        vehicle?.assignedTo ||
        null
    );
}

function resolveAssigner(historyEntry, vehicle) {
    return (
        historyEntry?.performedBy ||
        vehicle?.assignedBy ||
        null
    );
}

function resolveWorkflowStage(historyEntry, stageKey) {
    const stage = historyEntry?.details?.vehicleHandoverWorkflow?.stages?.[stageKey];
    if (!stage) return { name: '—', date: null, time: null, signature: null };
    return {
        name: stage.actorName || '—',
        date: stage.date || null,
        time: stage.date || null,
        signature: stage.actorSignature || null,
    };
}

function pickSignature(...candidates) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate === 'string') return candidate;
        if (typeof candidate !== 'object') continue;
        if (candidate.signature) return candidate.signature;
        if (candidate.url || candidate.data || candidate.path) return candidate;
    }
    return null;
}

function gridFieldsToMap(fields) {
    return Object.fromEntries(fields.map((f) => [f.label, f.value || '—']));
}

export function buildVehicleHandoverFormData(historyEntry, vehicle) {
    if (!historyEntry) return null;

    const fields = buildVehicleHandoverAssignGridFields(historyEntry, vehicle, {
        assetHistory: Array.isArray(vehicle?.assetHistory) ? vehicle.assetHistory : [],
    });
    const fieldMap = gridFieldsToMap(fields);
    const assignee = resolveAssignee(historyEntry, vehicle);
    const assigner = resolveAssigner(historyEntry, vehicle);
    const workflowMeta = historyEntry?.details?.vehicleHandoverWorkflow;

    const handoverDate =
        historyEntry?.date ||
        historyEntry?.createdAt ||
        vehicle?.assignedDate ||
        null;

    const acceptanceDate =
        vehicle?.acceptedDate ||
        historyEntry?.details?.acceptedDate ||
        (String(historyEntry?.action || '') === 'Accepted' ? historyEntry?.date : null);

    const hodPerson = assignee?.primaryReportee;
    const hodFromWorkflow = resolveWorkflowStage(historyEntry, 'hod');
    const hrFromWorkflow = resolveWorkflowStage(historyEntry, 'hr');
    const assignerFromWorkflow = resolveWorkflowStage(historyEntry, 'assigner');
    const targetFromWorkflow = resolveWorkflowStage(historyEntry, 'target');

    const handoverByLabel = getHandoverByLabel(historyEntry, vehicle);
    const handoverToLabel = getHandoverToLabel(historyEntry, vehicle);

    return {
        headerTable: {
            vehicleNo: fieldMap['Vehicle NO'],
            model: fieldMap.Model,
            year: fieldMap.Year,
            assetNo: fieldMap['Asset No'],
            brand: fieldMap.Brand,
            regExpiry: fieldMap['Reg Expiry'],
            handoverBy: handoverByLabel,
            handoverTo: handoverToLabel,
            warranty: fieldMap.Warranty,
            currentUsage: fieldMap['Current KM'] || fieldMap['Current Usage'],
            currentKm: fieldMap['Current KM'] || fieldMap['Current Usage'],
            handoverDate: fieldMap['Hand Over Date'] || formatDate(handoverDate),
            drivingLicenseAge: fieldMap['Driving License Age'],
            vehicleValue: fieldMap['Vehicle Value'],
            insuranceBy: fieldMap['Insurance by'],
            insuranceExpiry: fieldMap['Insurance Expiry'],
        },
        signatures: {
            handoverByName: handoverByLabel,
            handoverToName: handoverToLabel,
            handoverByPerson: assigner,
            handoverToPerson: assignee,
            handoverBySignature: pickSignature(
                assignerFromWorkflow.signature,
                assigner,
                vehicle?.assignedBy,
            ),
            handoverToSignature: pickSignature(
                targetFromWorkflow.signature,
                assignee,
                vehicle?.assignedTo,
                vehicle?.acceptedBy,
            ),
            handoverDate: formatDate(handoverDate),
            receiverDate: formatDate(acceptanceDate || handoverDate),
            receiverTime: formatTime(acceptanceDate || handoverDate),
        },
        accessories: buildReceiverAssessmentRows(historyEntry, vehicle),
        bodyConditionPairs: buildBodyConditionDisplayPairs(historyEntry),
        officeUse: {
            preparedBy: {
                name: assignerFromWorkflow.name !== '—'
                    ? assignerFromWorkflow.name
                    : fmtHandoverPerson(assigner) || getHandoverByLabel(historyEntry),
                date: formatDate(assignerFromWorkflow.date || handoverDate),
                time: formatTime(assignerFromWorkflow.date || handoverDate),
                signature: pickSignature(
                    assignerFromWorkflow.signature,
                    assigner,
                    vehicle?.assignedBy,
                ),
            },
            hod: {
                name: hodFromWorkflow.name !== '—'
                    ? hodFromWorkflow.name
                    : formatEmployeeName(hodPerson) || '—',
                date: formatDate(hodFromWorkflow.date),
                time: formatTime(hodFromWorkflow.date),
                signature: pickSignature(
                    hodFromWorkflow.signature,
                    hodPerson,
                    vehicle?.assignedTo?.primaryReportee,
                ),
            },
            hr: {
                name: hrFromWorkflow.name !== '—' ? hrFromWorkflow.name : '—',
                date: formatDate(hrFromWorkflow.date),
                time: formatTime(hrFromWorkflow.date),
                signature: pickSignature(hrFromWorkflow.signature),
            },
        },
        receiver: {
            name: targetFromWorkflow.name !== '—'
                ? targetFromWorkflow.name
                : getHandoverToLabel(historyEntry),
            date: formatDate(targetFromWorkflow.date || acceptanceDate || handoverDate),
            time: formatTime(targetFromWorkflow.date || acceptanceDate || handoverDate),
            person: assignee,
            signature: pickSignature(
                targetFromWorkflow.signature,
                assignee,
                vehicle?.assignedTo,
                vehicle?.acceptedBy,
            ),
        },
        workflowMeta,
        additionalInfo: (() => {
            const reason = getHandoverReason(historyEntry, vehicle);
            return reason !== '-' ? reason : '';
        })(),
    };
}
