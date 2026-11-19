import axiosInstance from '@/utils/axios';

const quiet = { skipToast: true };

export function listDeliveryCustomers() {
    return axiosInstance.get('/CRM/customers', { ...quiet, params: { limit: 'all', page: 1 } }).then((response) => response.data);
}

export function getDeliveryCustomer(id) {
    return axiosInstance.get(`/CRM/customers/${id}`, quiet).then((response) => response.data);
}

export function listDeliveryCategories() {
    return axiosInstance.get('/Inventory/categories', quiet).then((response) => response.data);
}

export function listDeliverySubcategories() {
    return axiosInstance.get('/Inventory/subcategories', quiet).then((response) => response.data);
}

export function listDeliveryItemOptions() {
    return axiosInstance.get('/Inventory/item-options', quiet).then((response) => response.data);
}

export function listDeliveryBrands() {
    return axiosInstance.get('/Inventory/brands', quiet).then((response) => response.data);
}

export function listDeliveryItems() {
    return axiosInstance.get('/Inventory/items', { ...quiet, params: { limit: 'all', status: 'All' } }).then((response) => response.data);
}

export function listDeliveryWorkOrders() {
    return axiosInstance.get('/WorkOrder', quiet).then((response) => response.data).catch(() => ({ workOrders: [] }));
}

export function listDeliveries() {
    return axiosInstance.get('/Inventory/deliveries', quiet).then((response) => response.data);
}

export function createDelivery(payload) {
    return axiosInstance.post('/Inventory/deliveries', payload, quiet).then((response) => response.data);
}

export function updateDelivery(id, payload) {
    return axiosInstance.put(`/Inventory/deliveries/${id}`, payload, quiet).then((response) => response.data);
}

export function approveDelivery(id) {
    return axiosInstance.post(`/Inventory/deliveries/${id}/approve`, {}, quiet).then((response) => response.data);
}

export function rejectDelivery(id) {
    return axiosInstance.post(`/Inventory/deliveries/${id}/reject`, {}, quiet).then((response) => response.data);
}

export function deleteDelivery(id) {
    return axiosInstance.delete(`/Inventory/deliveries/${id}`, quiet).then((response) => response.data);
}

export function deliveryApiMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
}
