import axiosInstance from '@/utils/axios';

const isMongoOid = (v) => {
    if (v == null) return false;
    return /^[a-f\d]{24}$/i.test(String(v).trim());
};

/**
 * Deletes a dashboard notification on the server. Prefer actionId; otherwise request-scoped delete for activation types.
 */
export async function deleteEmployeeDashboardNotification(item) {
    if (item?.actionId && isMongoOid(item.actionId)) {
        await axiosInstance.delete(`/Employee/dashboard/actions/${encodeURIComponent(String(item.actionId).trim())}`);
        return;
    }
    if (item?.type === 'Profile Activation' && isMongoOid(item?.id)) {
        await axiosInstance.delete(
            `/Employee/dashboard/profile-activation/${encodeURIComponent(String(item.id).trim())}`,
        );
        return;
    }
    if (item?.type === 'Company Activation' && isMongoOid(item?.id)) {
        await axiosInstance.delete(
            `/Employee/dashboard/company-activation/${encodeURIComponent(String(item.id).trim())}`,
        );
        return;
    }
    const err = new Error('NO_SERVER_DELETE_TARGET');
    err.code = 'NO_SERVER_DELETE_TARGET';
    throw err;
}
