/** Policy copy blocks for handover PDF page 1 → page 2 overflow. */

export const VEHICLE_HANDOVER_POLICY_BLOCKS = [
    {
        id: 'intro',
        type: 'paragraph',
        text:
            "This Vehicle Usage Policy outlines the guidelines and responsibilities for employees using company vehicles, especially when they are used for personal purposes outside of office hours. The policy also addresses the procedures to be followed in case of accidents and the driver's financial responsibility during garage downtime.",
    },
    {
        id: 'assignment',
        type: 'section',
        heading: 'Vehicle Assignment:',
        text: ' Vehicles are provided solely for business purposes.',
    },
    {
        id: 'personalUse',
        type: 'section',
        heading: 'Personal Use:',
        text:
            ' Employees may use company vehicles for personal purposes which includes picking and dropping off at the airport or any other personal errands outside office hours only after informing HR Personal use of vehicle is a privilege not an entitlement. Misuse may result in disciplinary action.',
    },
    {
        id: 'accident',
        type: 'section',
        heading: 'Accident:',
        text:
            ' In the event of any accident outside office hours, assigned employee / driver must report it to HR providing all relevant information and documents.',
    },
    {
        id: 'financial',
        type: 'section',
        heading: 'Financial Responsibility during garage time:',
        text:
            " If the unavailability of vehicle is due to an accident caused by driver's negligence, the driver is responsible for any repair or rental car costs incurred during the garage time.",
    },
    {
        id: 'premium',
        type: 'section',
        heading: 'Premium Adjustments/ Total Loss:',
        text:
            " If an employee's driving record leads to increased insurance premiums for the company or reduces the amount recoverable in the event of a total loss, the employee may be required to contribute to these costs. The contribution amount will be determined based on the increase in premiums directly attributed to the employee's driving record",
    },
    {
        id: 'liability',
        type: 'section',
        heading: 'Liability Caps:',
        text:
            ' Employees will be financially responsible for all damages resulting from accidents where their negligence is proven. This applies to both company vehicle and third- party claims',
    },
    {
        id: 'usageFees',
        type: 'section',
        heading: 'Usage Fees:',
        text:
            ' For employees with a history of frequent accidents (2 and above in a year), a nominal usage fee of AED 1000 will be deducted from their salary. This fee is intended to contribute towards maintenance and operational costs associated with their use of company vehicles.',
    },
    {
        id: 'repairCosts',
        type: 'section',
        heading: 'Repair Costs:',
        text:
            ' If an employee is found at fault for an accident, they may be required to cover the full amount of vehicle repair costs. This will be assessed based on the extent of the damage and repair needs.',
    },
    {
        id: 'maintenance',
        type: 'section',
        heading: 'Maintenance & Cleanliness:',
        text:
            ' Assigned employee is responsible for ensuring the cleanliness and proper maintenance of the Vehicle they use at all times. Vehicles used for picking and dropping employees at the site must be washed twice while other vehicles should be washed once. Company will reimburse the bill once it is submitted.',
    },
];

/**
 * Pack policy blocks into page 1 until available height is used.
 * Remaining blocks continue on page 2 (above the signing acknowledgment).
 */
export function splitPolicyBlocksByHeight(blockHeights, availableForBlocks) {
    const heights = Array.isArray(blockHeights)
        ? blockHeights.map((h) => Math.max(0, Number(h) || 0))
        : [];
    const limit = Math.max(0, Number(availableForBlocks) || 0);
    const gap = 8; // matches space-y-2 (~0.5rem)

    let used = 0;
    let splitAt = heights.length;

    for (let i = 0; i < heights.length; i += 1) {
        const next = heights[i] + (i > 0 ? gap : 0);
        if (used + next > limit && i > 0) {
            splitAt = i;
            break;
        }
        used += next;
    }

    return {
        page1Ids: VEHICLE_HANDOVER_POLICY_BLOCKS.slice(0, splitAt).map((b) => b.id),
        page2Ids: VEHICLE_HANDOVER_POLICY_BLOCKS.slice(splitAt).map((b) => b.id),
    };
}
