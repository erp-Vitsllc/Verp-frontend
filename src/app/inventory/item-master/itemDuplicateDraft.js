const DRAFT_KEY = 'inventory-item-duplicate-draft';
const OBJECT_ID = /^[a-f\d]{24}$/i;

function text(value, max) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);
}

function objectId(value) {
    const id = String(value ?? '');
    return OBJECT_ID.test(id) ? id : '';
}

/** Only the fields the duplicate form is allowed to carry. Reserved stock stays on the original item. */
export function itemDuplicateDraftFrom(item) {
    const categoryId = objectId(item?.categoryId);
    const subcategoryId = objectId(item?.subcategoryId);
    const brandId = objectId(item?.brandId);
    if (!categoryId || !subcategoryId || !brandId) return null;
    const unit = text(item?.unitOfMeasure, 40);
    return {
        sourceId: objectId(item?.sourceId || item?._id),
        categoryId,
        subcategoryId,
        subcategoryName: text(item?.subcategoryName, 120),
        brandId,
        brandName: text(item?.brandName, 120),
        moreDescription: text(item?.moreDescription, 500),
        copyToDescription: item?.copyToDescription === true,
        modelNumber: text(item?.modelNumber, 120),
        unitOfMeasure: unit || 'None',
        manufacturerPartNumber: text(item?.manufacturerPartNumber, 120),
        hsCode: text(item?.hsCode, 40),
        countryOfOrigin: text(item?.countryOfOrigin, 80),
        reservationQuantity: 0,
        status: 'Active',
    };
}

export function saveItemDuplicateDraft(item) {
    const draft = itemDuplicateDraftFrom(item);
    if (!draft) return false;
    try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        return true;
    } catch {
        return false;
    }
}

export function readItemDuplicateDraft() {
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        return itemDuplicateDraftFrom(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function clearItemDuplicateDraft() {
    try {
        sessionStorage.removeItem(DRAFT_KEY);
    } catch {
        /* The copy is already gone if storage is blocked. */
    }
}
