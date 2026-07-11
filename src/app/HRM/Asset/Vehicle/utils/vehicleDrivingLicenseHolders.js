import axiosInstance from '@/utils/axios';

/** Active employees who have a driving license card on their profile. */
export async function fetchDrivingLicenseHolders() {
    const { data } = await axiosInstance.get('/employee/driving-license-holders');
    return Array.isArray(data) ? data : data?.employees || [];
}

export function employeeOptionId(emp) {
    return String(emp?._id || emp?.id || '').trim();
}

/**
 * Keep a previously selected driver visible even if they no longer appear
 * in the licensed holders list (e.g. editing an older service).
 */
export function withPreservedEmployee(holders = [], preserveId, sourceEmployees = []) {
    const id = String(preserveId || '').trim();
    if (!id) return holders;
    if ((holders || []).some((emp) => employeeOptionId(emp) === id)) return holders;

    const found = (sourceEmployees || []).find((emp) => employeeOptionId(emp) === id);
    if (found) return [found, ...(holders || [])];
    return holders || [];
}
