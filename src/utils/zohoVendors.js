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
        raw: vendor,
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
