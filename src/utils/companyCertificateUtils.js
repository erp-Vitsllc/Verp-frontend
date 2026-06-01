export const CERTIFICATE_TYPE_OPTIONS = ['Installer', 'Safety', 'Administration', 'Others'];

export function parseCertificateStoredDescription(raw) {
    const text = String(raw ?? '');
    const m = text.match(/^\s*Issued By:\s*(.+?)\s*\|\s*Issued To:\s*(.+?)\s*\|\s*([\s\S]*)$/i);
    if (m) {
        return {
            issuedBy: m[1].trim() || '—',
            issuedTo: m[2].trim() || '—',
            userDescription: m[3].trim() || '—',
        };
    }
    return {
        issuedBy: '—',
        issuedTo: '—',
        userDescription: text.trim() || '—',
    };
}

export function buildCertificateDescription({ issuedBy, issuedToLabel, description }) {
    return `Issued By: ${issuedBy} | Issued To: ${issuedToLabel} | ${description || ''}`;
}

export function formatCertificateIssuedToLabel(recipientKey, { companyId, companyName, employees = [] } = {}) {
    const key = String(recipientKey || '').trim();
    if (!key) return '';
    if (key.startsWith('company:')) {
        const id = key.slice('company:'.length).trim();
        const name = String(companyName || '').trim();
        return name ? `${name} (${id})` : id;
    }
    if (key.startsWith('employee:')) {
        const id = key.slice('employee:'.length).trim();
        const emp = (employees || []).find(
            (e) => String(e?.employeeId || '').toLowerCase() === id.toLowerCase(),
        );
        if (emp) {
            const full = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            return full ? `${full} (${id})` : id;
        }
        return id;
    }
    return key.slice(0, 150);
}

export function resolveCertificateIssuedToKey(label, { companyId, companyName, employees = [] } = {}) {
    const text = String(label || '').trim();
    if (!text) return '';
    const paren = text.match(/\(([^)]+)\)\s*$/);
    if (paren) {
        const id = paren[1].trim();
        if (companyId && id.toLowerCase() === String(companyId).toLowerCase()) {
            return `company:${companyId}`;
        }
        const emp = (employees || []).find(
            (e) => String(e?.employeeId || '').toLowerCase() === id.toLowerCase(),
        );
        if (emp) return `employee:${emp.employeeId}`;
    }
    if (companyName && text.toLowerCase() === String(companyName).trim().toLowerCase()) {
        return companyId ? `company:${companyId}` : text;
    }
    const empByName = (employees || []).find((e) => {
        const full = `${e.firstName || ''} ${e.lastName || ''}`.trim();
        return full && full.toLowerCase() === text.toLowerCase();
    });
    if (empByName?.employeeId) return `employee:${empByName.employeeId}`;
    return text;
}

export function certificateTypeSectionId(typeName) {
    const t = String(typeName || '').trim().toLowerCase();
    if (t === 'installer') return 'Installer';
    if (t === 'safety') return 'Safety';
    if (t === 'administration') return 'Administration';
    return 'Others';
}
