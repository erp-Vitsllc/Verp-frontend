export const WORK_ORDER_TAB_SLUGS = {
    overview: 'Overview',
    lpo: 'LPO',
    quotation: 'Quotation',
    invoices: 'Invoices',
    boq: 'BOQ',
    budget: 'Budget',
    mom: 'MOM',
    material: 'Material',
    delivery: 'Delivery',
    workflow: 'Workflow',
    history: 'History',
    'old-documents': 'Old documents',
};

export const QUOTATION_VIEWS = ['proposed', 'actual', 'mr', 'vendor-lpo'];

const LEGACY_SECTION = {
    lpo: ['lpo', ''],
    'actual-boq': ['quotation', 'actual'],
    actual: ['quotation', 'actual'],
    mr: ['quotation', 'mr'],
    'vendor-lpo': ['quotation', 'vendor-lpo'],
    quotation: ['quotation', 'proposed'],
};

export function workOrderTabSlug(label) {
    const found = Object.entries(WORK_ORDER_TAB_SLUGS).find(([, name]) => name === label);
    return found ? found[0] : 'overview';
}

function safeDecode(value) {
    const raw = String(value || '').trim();
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function workOrderDetailsHref(id, tab = 'overview', view = '') {
    const safeId = encodeURIComponent(safeDecode(id));
    const slug = WORK_ORDER_TAB_SLUGS[tab] ? tab : workOrderTabSlug(tab);
    let href = `/production/work-order/${safeId}/${slug}`;
    if (slug === 'quotation') {
        const nextView = QUOTATION_VIEWS.includes(view) ? view : 'proposed';
        if (nextView !== 'proposed') href += `/${nextView}`;
    }
    return href;
}

/** Old `?workOrder=&section=` links, including notification and email URLs. */
export function workOrderHrefFromLegacy(id, section = '') {
    const key = String(section || '').trim().toLowerCase();
    const [tab, view] = LEGACY_SECTION[key] || ['overview', ''];
    return workOrderDetailsHref(id, tab, view);
}
