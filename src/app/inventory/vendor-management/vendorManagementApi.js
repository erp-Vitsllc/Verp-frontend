import axiosInstance from '@/utils/axios';

function dataOf(response) {
    return response.data;
}

export function listVendors(params) {
    return axiosInstance.get('/Inventory/vendors', { params }).then(dataOf);
}

export function nextVendorCode() {
    return axiosInstance.get('/Inventory/vendors/next-code', { skipToast: true }).then(dataOf);
}

export function previewZohoVendor(zohoContactId) {
    return axiosInstance
        .get('/Inventory/vendors/zoho-preview', { params: { zohoContactId }, skipToast: true })
        .then(dataOf);
}

export function createVendor(payload) {
    return axiosInstance.post('/Inventory/vendors', payload, { skipToast: true }).then(dataOf);
}

export function updateVendor(id, payload) {
    return axiosInstance.put(`/Inventory/vendors/${id}`, payload, { skipToast: true }).then(dataOf);
}

export function getVendor(id) {
    return axiosInstance.get(`/Inventory/vendors/${id}`, { skipToast: true }).then(dataOf);
}

export function listVendorBills(id) {
    return axiosInstance.get(`/Inventory/vendors/${encodeURIComponent(id)}/bills`, { skipToast: true }).then(dataOf);
}

export function syncVendorFromZoho(id) {
    return axiosInstance.post(`/Inventory/vendors/${encodeURIComponent(id)}/sync`, {}, { skipToast: true, timeout: 120000 }).then(dataOf);
}

export function deleteVendor(id) {
    return axiosInstance.delete(`/Inventory/vendors/${id}`, { skipToast: true }).then(dataOf);
}

export function createVendorContact(vendorId, payload) {
    return axiosInstance.post(`/Inventory/vendors/${vendorId}/contacts`, payload, { skipToast: true }).then(dataOf);
}

function contactUrl(vendorId, contactId, suffix = '') {
    return `/Inventory/vendors/${encodeURIComponent(vendorId)}/contacts/${encodeURIComponent(contactId)}${suffix}`;
}

export function updateVendorContact(vendorId, contactId, payload) {
    return axiosInstance.put(contactUrl(vendorId, contactId), payload, { skipToast: true }).then(dataOf);
}

export function deleteVendorContact(vendorId, contactId) {
    return axiosInstance.delete(contactUrl(vendorId, contactId), { skipToast: true }).then(dataOf);
}

export function markVendorContactPrimary(vendorId, contactId) {
    return axiosInstance.post(contactUrl(vendorId, contactId, '/primary'), {}, { skipToast: true }).then(dataOf);
}

export function listZohoVendorOptions() {
    return axiosInstance.get('/zoho/vendors', { params: { sync: 'false' }, skipToast: true }).then((response) => {
        const rows = response?.data?.data;
        return Array.isArray(rows) ? rows : [];
    });
}

export function vendorApiMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
}
