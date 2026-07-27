/** True when the viewer is the Active HR row assigned in Settings > FlowChart. */
export function isActiveFlowchartHrUser(user, flowchartRows = []) {
    if (!user || !Array.isArray(flowchartRows) || flowchartRows.length === 0) return false;

    const actualId = user._id || user.id || user.employeeObjectId;
    const empCode = user.employeeId != null ? String(user.employeeId) : '';
    const empObjectId =
        user.employeeObjectId != null ? String(user.employeeObjectId) : '';

    return flowchartRows.some((row) => {
        const cat = String(row?.category || '')
            .toLowerCase()
            .replace(/\s+/g, '');
        const status = String(row?.status || '').toLowerCase();
        if (cat !== 'hr' || status !== 'active') return false;

        const rowObjectId = row?.empObjectId?._id ?? row?.empObjectId;
        return (
            (actualId && String(rowObjectId) === String(actualId)) ||
            (empCode && String(row?.employeeId) === empCode) ||
            (empObjectId && String(row?.employeeId) === empObjectId)
        );
    });
}

export function getStoredUser() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('employeeUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
