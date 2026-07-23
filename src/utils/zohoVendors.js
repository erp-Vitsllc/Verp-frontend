export function mapZohoVendor(vendor) {
    if (!vendor || typeof vendor !== 'object') return null;

    const id = String(
        vendor.contact_id ||
            vendor.vendor_id ||
            vendor.zohoContactId ||
            vendor.zohoVendorId ||
            vendor.id ||
            '',
    ).trim();

    const label =
        String(
            vendor.contact_name ||
                vendor.vendor_name ||
                vendor.company_name ||
                vendor.contactName ||
                vendor.companyName ||
                '',
        ).trim() || 'Unnamed vendor';

    if (!id) return null;

    return {
        id,
        label,
        email: String(vendor.email || '').trim(),
        phone: String(vendor.phone || vendor.mobile || '').trim(),
        currencyCode: String(vendor.currency_code || vendor.currencyCode || 'AED').trim() || 'AED',
        locationId: String(vendor.location_id || vendor.locationId || '').trim(),
        locationName: String(vendor.location_name || vendor.locationName || '').trim(),
        outstandingPayableAmount:
            Number(vendor.outstanding_payable_amount ?? vendor.outstandingPayableAmount) || 0,
        raw: vendor,
    };
}

export function mapZohoVendors(vendors) {
    if (!Array.isArray(vendors)) return [];
    return vendors.map(mapZohoVendor).filter(Boolean);
}

export function formatZohoVendorPayables(vendor) {
    const amount = Number(vendor?.outstanding_payable_amount);
    const currency = String(vendor?.currency_code || 'AED').trim() || 'AED';

    if (!Number.isFinite(amount)) return '—';

    try {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

export function mapZohoVendorListRow(vendor) {
    if (!vendor || typeof vendor !== 'object') return null;

    return {
        id: String(vendor.contact_id || vendor.vendor_id || ''),
        name: String(vendor.contact_name || vendor.vendor_name || '').trim() || '—',
        companyName: String(vendor.company_name || '').trim() || '—',
        email: String(vendor.email || '').trim() || '—',
        workPhone: String(vendor.phone || vendor.mobile || '').trim() || '—',
        payables: formatZohoVendorPayables(vendor),
        payablesAmount: Number(vendor.outstanding_payable_amount) || 0,
        currencyCode: vendor.currency_code || 'AED',
    };
}

export function mapZohoVendorListRows(vendors) {
    if (!Array.isArray(vendors)) return [];
    return vendors.map(mapZohoVendorListRow).filter(Boolean);
}

export function mergeVendorOptionLabels(vendors, extraOptions = [], currentValue = '') {
    const labels = new Set();

    if (Array.isArray(vendors)) {
        vendors.forEach((vendor) => {
            const label = typeof vendor === 'string' ? vendor : vendor?.label;
            const trimmed = String(label || '').trim();
            if (trimmed) labels.add(trimmed);
        });
    }

    if (Array.isArray(extraOptions)) {
        extraOptions.forEach((option) => {
            const trimmed = String(option || '').trim();
            if (trimmed) labels.add(trimmed);
        });
    }

    const current = String(currentValue || '').trim();
    if (current) labels.add(current);

    return Array.from(labels).sort((a, b) => a.localeCompare(b));
}

/** Normalize vendor names for fuzzy match (case, &, whitespace). */
export function normalizeZohoVendorName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*&\s*/g, ' and ')
        .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Find a Zoho vendor by display name / company name.
 * Empty Zoho "Company Name" is fine — Name (contact_name) is enough.
 */
export function matchZohoVendorByName(vendors, hint) {
    const want = normalizeZohoVendorName(hint);
    if (!want || !Array.isArray(vendors) || vendors.length === 0) return null;

    const scored = [];
    for (const v of vendors) {
        if (!v) continue;
        const raw = v.raw || {};
        const candidates = [
            v.label,
            v.name,
            v.companyName,
            raw.contact_name,
            raw.vendor_name,
            raw.company_name,
            raw.contactName,
            raw.companyName,
        ]
            .map(normalizeZohoVendorName)
            .filter(Boolean);

        for (const name of candidates) {
            if (name === want) return v;
            if (name.includes(want) || want.includes(name)) {
                scored.push({ v, len: Math.abs(name.length - want.length) });
            }
        }
    }

    if (scored.length === 0) return null;
    scored.sort((a, b) => a.len - b.len);
    return scored[0].v;
}

