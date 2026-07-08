export function formatZohoCustomerReceivables(customer) {
    const amount = Number(customer?.outstanding_receivable_amount);
    const currency = String(customer?.currency_code || 'AED').trim() || 'AED';

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

export function mapZohoCustomerListRow(customer) {
    if (!customer || typeof customer !== 'object') return null;

    return {
        id: String(customer.contact_id || customer.customer_id || ''),
        name: String(customer.contact_name || customer.customer_name || '').trim() || '—',
        companyName: String(customer.company_name || '').trim() || '—',
        email: String(customer.email || '').trim() || '—',
        workPhone: String(customer.phone || customer.mobile || '').trim() || '—',
        receivables: formatZohoCustomerReceivables(customer),
        receivablesAmount: Number(customer.outstanding_receivable_amount) || 0,
        currencyCode: customer.currency_code || 'AED',
        raw: customer,
    };
}

export function mapZohoCustomerListRows(customers) {
    if (!Array.isArray(customers)) return [];
    return customers.map(mapZohoCustomerListRow).filter(Boolean);
}
