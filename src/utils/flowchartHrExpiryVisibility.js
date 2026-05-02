/**
 * Live document-expiry badges / merge rows are duties of the designated Flowchart HR only.
 */
export function isFlowchartHrForExpiryTasks(flowchartHrEmployeeObjectId, viewerEmployeeObjectId) {
    if (!flowchartHrEmployeeObjectId || !viewerEmployeeObjectId) return false;
    return String(flowchartHrEmployeeObjectId).trim() === String(viewerEmployeeObjectId).trim();
}

/** Prefer employeeObjectId, then Mongo _id from stored user JSON. */
export function getViewerEmployeeObjectIdFromStorage() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('employeeUser') || localStorage.getItem('user');
        if (!raw) return null;
        const u = JSON.parse(raw);
        const id = u?.employeeObjectId || u?._id;
        return id != null ? String(id) : null;
    } catch {
        return null;
    }
}
