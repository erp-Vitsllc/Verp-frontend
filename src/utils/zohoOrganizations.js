/**
 * Build VEGA / NNIT Zoho Books org options from /zoho/connections.
 */

function cleanText(value) {
    return String(value || '').trim();
}

function inferOrgBrand(label, companyName = '') {
    const hay = `${label} ${companyName}`.toLowerCase();
    if (/nnit|neoron|neuron|nexus/.test(hay)) return 'NNIT';
    if (/vega/.test(hay)) return 'VEGA';
    return '';
}

/**
 * @param {{
 *   defaultOrganizationId?: string,
 *   nnitOrganizationId?: string,
 *   organizations?: Array<{ organizationId?: string, name?: string, brand?: string, isDefault?: boolean }>,
 *   connections?: Array<{ organizationId?: string, connected?: boolean }>,
 *   companies?: Array<{
 *     id?: string,
 *     zohoOrganizationId?: string,
 *     zohoOrganizationLabel?: string,
 *     name?: string,
 *     nickName?: string,
 *   }>,
 * }} data
 */
export function mapZohoOrganizationOptions(data = {}) {
    const defaultOrganizationId = cleanText(data.defaultOrganizationId);
    const nnitOrganizationId = cleanText(data.nnitOrganizationId);
    const connections = Array.isArray(data.connections) ? data.connections : [];
    const companies = Array.isArray(data.companies) ? data.companies : [];
    const organizations = Array.isArray(data.organizations) ? data.organizations : [];

    const labelByOrg = new Map();
    const brandByOrg = new Map();
    const companyIdsByOrg = new Map();

    organizations.forEach((org) => {
        const orgId = cleanText(org.organizationId);
        if (!orgId) return;
        const name = cleanText(org.name);
        const brand = cleanText(org.brand) || inferOrgBrand(name);
        if (name) labelByOrg.set(orgId, name);
        if (brand) brandByOrg.set(orgId, brand);
    });

    if (defaultOrganizationId && !brandByOrg.has(defaultOrganizationId)) {
        brandByOrg.set(defaultOrganizationId, 'VEGA');
        if (!labelByOrg.has(defaultOrganizationId)) {
            labelByOrg.set(defaultOrganizationId, 'VEGADIGITAL IT SOLUTIONS LLC');
        }
    }
    if (nnitOrganizationId && !brandByOrg.has(nnitOrganizationId)) {
        brandByOrg.set(nnitOrganizationId, 'NNIT');
        if (!labelByOrg.has(nnitOrganizationId)) {
            labelByOrg.set(nnitOrganizationId, 'NEURON NEXUS INFORMATION TECHNOLOGY L.L.C');
        }
    }

    companies.forEach((company) => {
        const orgId = cleanText(company.zohoOrganizationId);
        if (!orgId) return;

        const companyLabel =
            cleanText(company.zohoOrganizationLabel) ||
            cleanText(company.nickName) ||
            cleanText(company.name);
        const brand = inferOrgBrand(companyLabel, company.name);
        const companyMongoId = cleanText(company.id);

        if (!labelByOrg.has(orgId) && companyLabel) {
            labelByOrg.set(orgId, companyLabel);
        }
        if (brand && !brandByOrg.has(orgId)) {
            brandByOrg.set(orgId, brand);
        }
        if (companyMongoId) {
            const list = companyIdsByOrg.get(orgId) || [];
            list.push(companyMongoId);
            companyIdsByOrg.set(orgId, list);
        }
    });

    const orgIds = new Set();
    organizations.forEach((row) => {
        const id = cleanText(row.organizationId);
        if (id) orgIds.add(id);
    });
    connections.forEach((row) => {
        const id = cleanText(row.organizationId);
        if (id) orgIds.add(id);
    });
    companies.forEach((company) => {
        const id = cleanText(company.zohoOrganizationId);
        if (id) orgIds.add(id);
    });
    if (defaultOrganizationId) orgIds.add(defaultOrganizationId);
    if (nnitOrganizationId) orgIds.add(nnitOrganizationId);

    const options = [...orgIds].map((organizationId) => {
        const connection = connections.find(
            (row) => cleanText(row.organizationId) === organizationId,
        );
        const brand = brandByOrg.get(organizationId) || '';
        const mappedLabel = labelByOrg.get(organizationId) || '';
        const shortId =
            organizationId.length > 8 ? `${organizationId.slice(0, 6)}…` : organizationId;

        const label =
            brand ||
            (mappedLabel
                ? mappedLabel.length > 28
                    ? `${mappedLabel.slice(0, 26)}…`
                    : mappedLabel
                : `Zoho ${shortId}`);

        const subtitle = mappedLabel && mappedLabel !== brand ? mappedLabel : '';

        // Same Zoho login can use shared OAuth for both orgs.
        const connected =
            Boolean(connection?.connected) ||
            Boolean(
                connections.some((row) => row.connected) &&
                    (organizationId === defaultOrganizationId ||
                        organizationId === nnitOrganizationId ||
                        brand === 'VEGA' ||
                        brand === 'NNIT'),
            );

        return {
            organizationId,
            label,
            brand: brand || label,
            subtitle,
            connected,
            isDefault: organizationId === defaultOrganizationId,
            companyIds: companyIdsByOrg.get(organizationId) || [],
        };
    });

    const brandRank = { VEGA: 0, NNIT: 1 };
    options.sort((a, b) => {
        const aRank = brandRank[a.brand] ?? 50;
        const bRank = brandRank[b.brand] ?? 50;
        if (aRank !== bRank) return aRank - bRank;
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.label.localeCompare(b.label);
    });

    return {
        defaultOrganizationId,
        nnitOrganizationId,
        options,
    };
}

export function resolveInitialZohoOrganizationId({
    preferredId = '',
    preferredCompanyId = '',
    defaultOrganizationId = '',
    options = [],
    storageKey = 'zohoActiveOrganizationId',
} = {}) {
    const preferred = cleanText(preferredId);
    if (preferred && options.some((opt) => opt.organizationId === preferred)) {
        return preferred;
    }

    const preferredCompany = cleanText(preferredCompanyId);
    if (preferredCompany) {
        const fromCompany = options.find((opt) =>
            (opt.companyIds || []).some((id) => String(id) === preferredCompany),
        );
        if (fromCompany?.organizationId) return fromCompany.organizationId;
    }

    let stored = '';
    try {
        if (typeof window !== 'undefined') {
            stored = cleanText(window.localStorage.getItem(storageKey));
        }
    } catch {
        stored = '';
    }
    if (stored && options.some((opt) => opt.organizationId === stored)) {
        return stored;
    }

    const defaultId = cleanText(defaultOrganizationId);
    if (defaultId && options.some((opt) => opt.organizationId === defaultId)) {
        return defaultId;
    }

    const vega = options.find((opt) => opt.brand === 'VEGA');
    if (vega?.organizationId) return vega.organizationId;

    const connected = options.find((opt) => opt.connected);
    return connected?.organizationId || options[0]?.organizationId || defaultId || '';
}

export function rememberZohoOrganizationId(
    organizationId,
    storageKey = 'zohoActiveOrganizationId',
) {
    const id = cleanText(organizationId);
    if (!id || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, id);
    } catch {
        /* ignore quota / private mode */
    }
}
