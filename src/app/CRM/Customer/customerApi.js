import axiosInstance from '@/utils/axios';

function dataOf(response) {
    return response.data;
}

function text(value) {
    return String(value || '').trim();
}

export function isSavedCustomer(customer) {
    if (!customer) return false;
    if (customer.saved === true) return true;
    if (customer.saved === false) return false;
    return /^[a-f\d]{24}$/i.test(String(customer.id || ''));
}

export function normalizeZohoOption(option) {
    if (!option || typeof option !== 'object') return null;
    const id = text(option.contact_id || option.customer_id || option.id);
    const company = text(option.company_name);
    const contactName = text(option.contact_name || option.customer_name);
    const name = company || contactName;
    if (!id || !name) return null;
    const billing = option.billing_address || {};
    const location = [billing.city, billing.state, billing.country].map(text).filter(Boolean).join(', ')
        || text(option.place_of_contact).replace(/[_-]+/g, ' ');
    const terms = text(option.payment_terms_label)
        || (option.payment_terms === 0 || option.payment_terms === '0'
            ? 'Due on Receipt'
            : (option.payment_terms != null && text(option.payment_terms) !== '' ? `Net ${option.payment_terms}` : ''));
    return {
        id,
        name,
        location,
        contact: contactName && contactName !== name ? contactName : '',
        email: text(option.email),
        phone: text(option.phone || option.mobile),
        paymentTerms: terms,
        status: text(option.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
        outstandingPayment: Number(option.outstanding_receivable_amount) || 0,
        currencyCode: text(option.currency_code) || 'AED',
    };
}

function rowsOf(response) {
    const body = response?.data;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body)) return body;
    return [];
}

export function listZohoCustomerOptions() {
    const read = (sync) => axiosInstance.get('/zoho/customers', {
        skipToast: true,
        timeout: 120000,
        params: { sync: sync ? 'true' : 'false' },
    }).then(rowsOf);

    return read(false).then((cached) => (cached.length ? cached : read(true)));
}

function customersFromZohoOptions(options, params = {}) {
    const search = text(params.search).toLowerCase();
    const product = text(params.product);
    const brand = text(params.brand).toLowerCase();
    const paymentTerms = text(params.paymentTerms).toLowerCase();
    const mapped = (Array.isArray(options) ? options : []).map(normalizeZohoOption).filter(Boolean);
    const filters = {
        products: [],
        brands: [],
        paymentTerms: [...new Set(mapped.map((row) => row.paymentTerms).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    };
    const rows = mapped.filter((row) => {
        if (paymentTerms && row.paymentTerms.toLowerCase() !== paymentTerms) return false;
        if (brand) return false;
        if (product) return false;
        if (!search) return true;
        return [row.name, row.location, row.contact, row.email, row.phone, row.paymentTerms].join(' ').toLowerCase().includes(search);
    }).sort((left, right) => left.name.localeCompare(right.name));
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Number(params.limit);
    const size = Number.isFinite(limit) && limit > 0 ? limit : 0;
    return {
        customers: (size ? rows.slice((page - 1) * size, (page - 1) * size + size) : rows).map((row) => ({
            ...row,
            saved: false,
            code: '',
            zohoContactId: row.id,
            address: row.location,
            brands: [],
            listBrands: [],
            products: null,
        })),
        total: rows.length,
        page,
        limit: size,
        filters,
    };
}

export function listCustomers(params) {
    return axiosInstance.get('/CRM/customers', { params, skipToast: true, timeout: 120000 }).then(dataOf).catch((error) => {
        const status = error?.response?.status ?? error?.originalError?.response?.status;
        if (status !== 404) return Promise.reject(error);
        return listZohoCustomerOptions().then((options) => customersFromZohoOptions(options, params));
    });
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

export function customerApiMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
}
