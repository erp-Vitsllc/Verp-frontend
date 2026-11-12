import axiosInstance from '@/utils/axios';

const base = '/Inventory';

function dataOf(response) {
    return response.data;
}

export function apiMessage(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
}

export const listCategories = () => axiosInstance.get(`${base}/categories`).then(dataOf);
export const createCategory = (payload) => axiosInstance.post(`${base}/categories`, payload).then(dataOf);

export const listSubcategories = (categoryId) => axiosInstance
    .get(`${base}/subcategories`, { params: categoryId ? { categoryId } : {} })
    .then(dataOf);
export const createSubcategory = (payload) => axiosInstance.post(`${base}/subcategories`, payload).then(dataOf);

export const listItemOptions = (subcategoryId) => axiosInstance
    .get(`${base}/item-options`, { params: subcategoryId ? { subcategoryId } : {} })
    .then(dataOf);
export const createItemOption = (payload) => axiosInstance.post(`${base}/item-options`, payload).then(dataOf);

export const listBrands = () => axiosInstance.get(`${base}/brands`).then(dataOf);
export const createBrand = (payload) => axiosInstance.post(`${base}/brands`, payload).then(dataOf);

export const listItems = (params) => axiosInstance.get(`${base}/items`, { params }).then(dataOf);
export const getItem = (id) => axiosInstance.get(`${base}/items/${id}`).then(dataOf);
export const createItem = (payload) => axiosInstance.post(`${base}/items`, payload).then(dataOf);
export const updateItem = (id, payload) => axiosInstance.put(`${base}/items/${id}`, payload).then(dataOf);

export function readImageFile(file, { required = false } = {}) {
    if (!file) {
        if (required) return Promise.reject(new Error('Image is required.'));
        return Promise.resolve(null);
    }
    if (!file.type.startsWith('image/')) {
        return Promise.reject(new Error('Choose an image file.'));
    }
    if (file.size > 1_500_000) {
        return Promise.reject(new Error('Image must be under 1.5 MB.'));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ data: String(reader.result || ''), name: file.name });
        reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.readAsDataURL(file);
    });
}

export function buildItemDescription({ brandName, subcategoryName, itemName, modelNumber, manufacturerPartNumber }) {
    return [brandName, subcategoryName, itemName, modelNumber, manufacturerPartNumber]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ');
}
