import axiosInstance from '@/utils/axios';

function dataOf(response) {
    return response.data;
}

export function listCustomers(params) {
    return axiosInstance.get('/CRM/customers', { params }).then(dataOf);
}

export function nextCustomerCode() {
    return axiosInstance.get('/CRM/customers/next-code', { skipToast: true }).then(dataOf);
}

export function previewZohoCustomer(zohoContactId) {
    return axiosInstance
        .get('/CRM/customers/zoho-preview', { params: { zohoContactId }, skipToast: true })
        .then(dataOf);
}

export function createCustomer(payload) {
    return axiosInstance.post('/CRM/customers', payload, { skipToast: true }).then(dataOf);
}

export function updateCustomer(id, payload) {
    return axiosInstance.put(`/CRM/customers/${id}`, payload, { skipToast: true }).then(dataOf);
}

export function getCustomer(id) {
    return axiosInstance.get(`/CRM/customers/${id}`, { skipToast: true }).then(dataOf);
}

export function syncCustomerFromZoho(id) {
    return axiosInstance.post(`/CRM/customers/${encodeURIComponent(id)}/sync`, {}, { skipToast: true, timeout: 120000 }).then(dataOf);
}

export function deleteCustomer(id) {
    return axiosInstance.delete(`/CRM/customers/${id}`, { skipToast: true }).then(dataOf);
}

export function listZohoCustomerOptions() {
    return axiosInstance.get('/zoho/customers', { skipToast: true, timeout: 120000 }).then((response) => {
        const rows = response?.data?.data;
        return Array.isArray(rows) ? rows : [];
    });
}

export function customerApiMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
}
