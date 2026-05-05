import { resolveActivationSnapshot } from './pendingActivationSnapshotRows.js';

const toDateInput = (value) => {
    if (value == null || value === '') return '';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
};

const hasAnyKey = (obj, keys) =>
    obj && typeof obj === 'object' && keys.some((k) => Object.prototype.hasOwnProperty.call(obj, k));

/**
 * Prefer modal kind from HR-visible card label (may list multiple sections, e.g. "Basic Details, Trade License").
 */
export function inferHeldModalKindFromCardLabel(card) {
    const s = String(card || '').toLowerCase();
    if (s.includes('trade license')) return 'tradeLicense';
    if (s.includes('establishment')) return 'establishmentCard';
    if (s.includes('moa')) return { kind: 'companyDocument', context: 'moa' };
    if (s.includes('ejari')) return { kind: 'companyDocument', context: 'ejari' };
    if (s.includes('insurance')) return { kind: 'companyDocument', context: 'insurance' };
    if (s.includes('basic details')) return 'basicDetails';
    return null;
}

export function inferHeldModalKindFromProposed(proposed) {
    const pd = proposed && typeof proposed === 'object' ? proposed : null;
    if (!pd) return null;

    if (hasAnyKey(pd, ['name', 'nickName', 'email', 'phone', 'establishedDate', 'companyId'])) {
        return 'basicDetails';
    }
    if (hasAnyKey(pd, ['tradeLicenseNumber', 'tradeLicenseIssueDate', 'tradeLicenseExpiry', 'tradeLicenseAttachment', 'tradeLicenseOwnerName'])) {
        return 'tradeLicense';
    }
    if (hasAnyKey(pd, ['establishmentCardNumber', 'establishmentCardIssueDate', 'establishmentCardExpiry', 'establishmentCardAttachment'])) {
        return 'establishmentCard';
    }
    if (Array.isArray(pd.documents) && pd.documents.some((d) => String(d?.type || '').toLowerCase().includes('moa'))) {
        return { kind: 'companyDocument', context: 'moa' };
    }
    if (Array.isArray(pd.ejari) && pd.ejari.length) return { kind: 'companyDocument', context: 'ejari' };
    if (Array.isArray(pd.insurance) && pd.insurance.length) return { kind: 'companyDocument', context: 'insurance' };
    if (Array.isArray(pd.documents) && pd.documents.length) return { kind: 'companyDocument', context: 'documents' };

    return null;
}

function normalizeModalKind(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return { kind: raw, context: null };
    return { kind: raw.kind, context: raw.context || null };
}

function findMoaDocumentIndex(company, proposed) {
    const docs = company?.documents;
    if (!Array.isArray(docs) || !Array.isArray(proposed?.documents)) return null;
    const pendingMoa = proposed.documents.find((d) => String(d?.type || '').toLowerCase().includes('moa'));
    if (!pendingMoa) return null;
    if (pendingMoa._id) {
        const byId = docs.findIndex((d) => String(d?._id) === String(pendingMoa._id));
        if (byId >= 0) return byId;
    }
    const byType = docs.findIndex((d) => String(d?.type || '').toLowerCase().includes('moa'));
    return byType >= 0 ? byType : null;
}

function findListDocIndex(companyList, proposedItem) {
    if (!Array.isArray(companyList) || companyList.length === 0) return 0;
    if (proposedItem && proposedItem._id) {
        const i = companyList.findIndex((x) => String(x?._id) === String(proposedItem._id));
        if (i >= 0) return i;
    }
    return 0;
}

/**
 * Builds modalType + modalData + editingIndex for opening the correct company edit modal from a hold queue entry.
 */
export function buildHeldActivationEditState(company, entry) {
    const proposed = resolveActivationSnapshot(entry, 'proposed');
    if (!proposed || typeof proposed !== 'object' || Object.keys(proposed).length === 0) {
        return { ok: false, reason: 'empty-proposed' };
    }

    const c = company || {};
    const fromLabel = inferHeldModalKindFromCardLabel(entry?.card);
    const fromKeys = inferHeldModalKindFromProposed(proposed);
    const rawKind = fromLabel || fromKeys || 'basicDetails';
    const { kind, context } = normalizeModalKind(rawKind);

    if (kind === 'tradeLicense') {
        const ownersFromProposed = Array.isArray(proposed.owners) && proposed.owners.length > 0;
        const ownersFromCompany = Array.isArray(c.owners) && c.owners.length > 0;
        const owners = ownersFromProposed
            ? proposed.owners.map((o) => ({
                  ...o,
                  attachment: o?.attachment ?? '',
                  isNew: o?.isNew ?? false,
              }))
            : ownersFromCompany
              ? [...c.owners]
              : [
                    {
                        name: proposed.tradeLicenseOwnerName ?? c.tradeLicenseOwnerName ?? '',
                        sharePercentage: '',
                        attachment: '',
                        isNew: !(proposed.tradeLicenseOwnerName || c.tradeLicenseOwnerName),
                    },
                ];

        return {
            ok: true,
            modalType: 'tradeLicense',
            modalData: {
                number: proposed.tradeLicenseNumber ?? c.tradeLicenseNumber ?? '',
                issueDate: toDateInput(proposed.tradeLicenseIssueDate ?? c.tradeLicenseIssueDate ?? c.establishedDate),
                expiryDate: toDateInput(proposed.tradeLicenseExpiry ?? c.tradeLicenseExpiry),
                owners,
                attachment: proposed.tradeLicenseAttachment ?? c.tradeLicenseAttachment ?? null,
            },
            editingIndex: null,
            tabAfterOpen: null,
        };
    }

    if (kind === 'establishmentCard') {
        return {
            ok: true,
            modalType: 'establishmentCard',
            modalData: {
                companyName: proposed.name ?? c.name ?? '',
                number: proposed.establishmentCardNumber ?? c.establishmentCardNumber ?? '',
                expiryDate: toDateInput(proposed.establishmentCardExpiry ?? c.establishmentCardExpiry),
                attachment: proposed.establishmentCardAttachment ?? c.establishmentCardAttachment ?? null,
            },
            editingIndex: null,
            tabAfterOpen: null,
        };
    }

    if (kind === 'basicDetails') {
        return {
            ok: true,
            modalType: 'basicDetails',
            modalData: {
                companyId: proposed.companyId ?? c.companyId ?? '',
                name: proposed.name ?? c.name ?? '',
                nickName: proposed.nickName ?? c.nickName ?? '',
                email: proposed.email ?? c.email ?? '',
                phone: proposed.phone ?? c.phone ?? '',
                establishedDate: toDateInput(proposed.establishedDate ?? c.establishedDate),
                expiryDate: toDateInput(proposed.tradeLicenseExpiry ?? c.tradeLicenseExpiry),
            },
            editingIndex: null,
            tabAfterOpen: 'basic',
        };
    }

    if (kind === 'companyDocument') {
        const ctx = context || 'documents';
        let editingIndex = entry?.documentIndex ?? null;

        if (ctx === 'moa') {
            const moaIdx = findMoaDocumentIndex(c, proposed);
            if (moaIdx != null) editingIndex = moaIdx;
            else if (editingIndex == null && Array.isArray(c.documents)) {
                const t = c.documents.findIndex((d) => String(d?.type || '').toLowerCase().includes('moa'));
                if (t >= 0) editingIndex = t;
            }
        } else if (ctx === 'ejari') {
            const first = Array.isArray(proposed.ejari) ? proposed.ejari[0] : null;
            editingIndex = findListDocIndex(c.ejari || [], first);
        } else if (ctx === 'insurance') {
            const first = Array.isArray(proposed.insurance) ? proposed.insurance[0] : null;
            editingIndex = findListDocIndex(c.insurance || [], first);
        } else if (ctx === 'documents' && Array.isArray(proposed.documents) && proposed.documents[0]) {
            const first = proposed.documents[0];
            if (first._id && Array.isArray(c.documents)) {
                const ix = c.documents.findIndex((d) => String(d?._id) === String(first._id));
                if (ix >= 0) editingIndex = ix;
            }
            if (editingIndex == null && Array.isArray(c.documents)) editingIndex = 0;
        }

        const doc =
            editingIndex != null && Array.isArray(c.documents)
                ? ctx === 'moa' || ctx === 'documents'
                    ? c.documents[editingIndex] || {}
                    : {}
                : {};
        const ej = ctx === 'ejari' && Array.isArray(c.ejari) ? c.ejari[editingIndex ?? 0] || {} : {};
        const ins = ctx === 'insurance' && Array.isArray(c.insurance) ? c.insurance[editingIndex ?? 0] || {} : {};

        let source = doc;
        if (ctx === 'ejari') source = ej;
        if (ctx === 'insurance') source = ins;

        const proposedEj = ctx === 'ejari' && Array.isArray(proposed.ejari) ? proposed.ejari[editingIndex ?? 0] : null;
        const proposedIns = ctx === 'insurance' && Array.isArray(proposed.insurance) ? proposed.insurance[editingIndex ?? 0] : null;
        const proposedDoc =
            ctx === 'moa' || ctx === 'documents'
                ? Array.isArray(proposed.documents)
                    ? proposed.documents.find((d) => String(d?.type || '').toLowerCase().includes('moa')) ||
                      proposed.documents[editingIndex ?? 0]
                    : null
                : null;

        const overlay = proposedDoc || proposedEj || proposedIns || {};

        const rawIssue =
            overlay.issueDate ??
            overlay.startDate ??
            proposed.issueDate ??
            proposed.startDate ??
            source.issueDate ??
            source.startDate;
        const issueDate = toDateInput(rawIssue);
        const expiryDate = toDateInput(overlay.expiryDate ?? proposed.expiryDate ?? source.expiryDate);

        const typeVal =
            overlay.type ??
            proposed.type ??
            proposedDoc?.type ??
            (ctx === 'moa' ? 'MOA' : typeof source.type === 'string' ? source.type : '');

        return {
            ok: true,
            modalType: 'companyDocument',
            modalData: {
                type: typeVal,
                description: overlay.description ?? proposed.description ?? source.description ?? '',
                issueDate,
                startDate: issueDate,
                expiryDate,
                value: overlay.value ?? proposed.value ?? proposedDoc?.value ?? source.value ?? '',
                context: ctx,
                attachment:
                    overlay.document?.url ??
                    proposed.document?.url ??
                    proposed.attachment ??
                    proposedDoc?.document?.url ??
                    source.document?.url ??
                    null,
                fileName: overlay.document?.name ?? proposed.document?.name ?? proposedDoc?.document?.name ?? source.document?.name ?? '',
                mimeType:
                    overlay.document?.mimeType ??
                    proposed.document?.mimeType ??
                    proposedDoc?.document?.mimeType ??
                    source.document?.mimeType ??
                    'application/pdf',
                provider: overlay.provider ?? proposed.provider ?? source.provider ?? '',
                authority: overlay.authority ?? proposed.authority ?? source.authority ?? '',
            },
            editingIndex: editingIndex ?? 0,
            tabAfterOpen: ctx === 'moa' ? 'moa' : 'others',
        };
    }

    return { ok: false, reason: 'unknown-kind' };
}
