import axiosInstance from '@/utils/axios';

export async function fetchUtilityConfigs() {
    const res = await axiosInstance.get('/UtilityBill/configs', { skipToast: true });
    return Array.isArray(res.data?.configs) ? res.data.configs : [];
}

export async function saveUtilityConfig(payload) {
    const res = await axiosInstance.post('/UtilityBill/configs', payload);
    return res.data?.config || null;
}

export async function deleteUtilityConfig(id) {
    await axiosInstance.delete(`/UtilityBill/configs/${encodeURIComponent(String(id))}`);
}

export async function fetchUtilityEntries(params = {}) {
    const res = await axiosInstance.get('/UtilityBill/entries', {
        params,
        skipToast: true,
    });
    return Array.isArray(res.data?.entries) ? res.data.entries : [];
}

export async function fetchUtilityEntry(id) {
    const res = await axiosInstance.get(`/UtilityBill/entries/${encodeURIComponent(String(id))}`, {
        skipToast: true,
    });
    return {
        entry: res.data?.entry || null,
        config: res.data?.config || null,
    };
}

export async function createUtilityEntryApi(payload, { skipToast = false } = {}) {
    const res = await axiosInstance.post('/UtilityBill/entries', payload, { skipToast });
    return res.data?.entry || null;
}

export async function updateUtilityEntryApi(id, patch) {
    const res = await axiosInstance.put(
        `/UtilityBill/entries/${encodeURIComponent(String(id))}`,
        patch,
    );
    return res.data?.entry || null;
}

export async function deleteUtilityEntryApi(id) {
    const res = await axiosInstance.delete(
        `/UtilityBill/entries/${encodeURIComponent(String(id))}`,
    );
    return res.data || { ok: true };
}

export async function deleteUtilityBillApi(id) {
    const res = await axiosInstance.delete(`/UtilityBill/${encodeURIComponent(String(id))}`);
    return res.data || { ok: true };
}

export async function fetchUtilityTypeNames() {
    const res = await axiosInstance.get('/UtilityBill/types', { skipToast: true });
    return Array.isArray(res.data?.types) ? res.data.types : [];
}

export async function addUtilityTypeNameApi(name) {
    const res = await axiosInstance.post('/UtilityBill/types', { name });
    return Array.isArray(res.data?.types) ? res.data.types : [];
}

export async function removeUtilityTypeNameApi(name) {
    const res = await axiosInstance.delete(
        `/UtilityBill/types/${encodeURIComponent(String(name))}`,
    );
    return Array.isArray(res.data?.types) ? res.data.types : [];
}

export async function fetchUtilityProvidersApi() {
    const res = await axiosInstance.get('/UtilityBill/providers', { skipToast: true });
    return Array.isArray(res.data?.providers) ? res.data.providers : [];
}

export async function addUtilityProviderApi(name) {
    const res = await axiosInstance.post('/UtilityBill/providers', { name });
    return {
        ok: true,
        providers: Array.isArray(res.data?.providers) ? res.data.providers : [],
    };
}

export async function removeUtilityProviderApi(name) {
    const res = await axiosInstance.delete(
        `/UtilityBill/providers/${encodeURIComponent(String(name))}`,
    );
    return {
        ok: true,
        providers: Array.isArray(res.data?.providers) ? res.data.providers : [],
    };
}
