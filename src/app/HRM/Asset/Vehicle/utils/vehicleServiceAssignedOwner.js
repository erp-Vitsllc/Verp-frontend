import {
    formatEmployeeName,
    nameFromFlowchartRow,
    pickFlowchartAdminRow,
} from './vehicleHandoverAssignWorkflow';

/** Flowchart Admin Officer employee ref used as Vehicle Assigned fallback. */
export function resolveFlowchartAdminEmployeeRef(flowchartRows = []) {
    const row = pickFlowchartAdminRow(flowchartRows);
    if (!row) {
        return { id: '', code: '', label: 'Admin Officer', row: null };
    }
    const empRef = row.empObjectId;
    let id = '';
    if (typeof empRef === 'object' && empRef) {
        id = String(empRef._id || empRef.id || '').trim();
    } else {
        id = String(empRef || '').trim();
    }
    const code = String(row.employeeId || (typeof empRef === 'object' && empRef?.employeeId) || '').trim();
    const label = nameFromFlowchartRow(row) || 'Admin Officer';
    return { id, code, label, row };
}

/** Vehicle assignee Mongo id when the fleet vehicle is assigned to an employee. */
export function resolveVehicleAssigneeEmployeeId(asset) {
    const assignee = asset?.assignedTo;
    if (!assignee) return '';
    if (typeof assignee === 'object') {
        return String(assignee._id || assignee.id || '').trim();
    }
    return String(assignee).trim();
}

/**
 * Vehicle Assigned default: assigned user when present, otherwise flowchart Admin Officer.
 */
export function resolveDefaultVehicleServiceAssignedOwnerId(asset, flowchartRows = []) {
    const assigneeId = resolveVehicleAssigneeEmployeeId(asset);
    if (assigneeId) return assigneeId;
    return resolveFlowchartAdminEmployeeRef(flowchartRows).id;
}

/** Display label for Vehicle Assigned (assignee name, else Admin Officer). */
export function resolveDefaultVehicleServiceAssignedOwnerLabel(asset, flowchartRows = []) {
    const assignee = asset?.assignedTo;
    if (assignee) {
        const name = formatEmployeeName(assignee);
        if (name) return name;
        if (typeof assignee === 'object') {
            const code = String(assignee.employeeId || '').trim();
            if (code) return code;
        }
    }
    return resolveFlowchartAdminEmployeeRef(flowchartRows).label || 'Admin Officer';
}

/**
 * Prefer saved remark owner; else assigned user; else Admin Officer.
 * @param {string} [savedOwnerId]
 */
export function resolveVehicleServiceAssignedOwnerId(asset, flowchartRows = [], savedOwnerId = '') {
    const saved = String(savedOwnerId || '').trim();
    if (saved && saved !== '__asset_controller__') return saved;
    return resolveDefaultVehicleServiceAssignedOwnerId(asset, flowchartRows);
}
