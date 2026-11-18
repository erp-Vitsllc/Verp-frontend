import axiosInstance from '@/utils/axios';

export function listInventoryBills(vendorId) {
    return axiosInstance.get('/Inventory/bills', {
        skipToast: true,
        params: vendorId ? { vendorId } : {},
    }).then((response) => response.data);
}

export function billsApiMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
}
