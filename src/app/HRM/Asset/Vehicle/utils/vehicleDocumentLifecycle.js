import {
    isInsuranceInvoiceAttachmentLabel,
    normVehicleDocType,
    syncVehicleDocumentAttachmentBuckets,
} from './vehicleDocumentCardRows';

export function parseVehicleDocumentMeta(doc) {
    if (!doc?.description) return {};
    try {
        const parsed = JSON.parse(doc.description);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/** Human-readable document title from plain text or JSON description metadata. */
export function vehicleDocumentDescriptionLabel(doc, fallback = '') {
    const raw = doc?.description;
    if (raw == null || raw === '') return fallback;
    const meta = parseVehicleDocumentMeta(doc);
    if (Object.keys(meta).length > 0) {
        const label = String(meta.text || meta.label || meta.name || '').trim();
        return label || fallback;
    }
    return String(raw).trim() || fallback;
}

/** Whether a vehicle document row belongs in Old Documents (renewed, not renewed, or archived). */
export function isVehicleDocumentOld(doc) {
    const status = String(doc?.status || doc?.documentStatus || '').toLowerCase();
    if (['old', 'renewed', 'archived', 'inactive'].includes(status)) return true;

    const descriptionMeta = parseVehicleDocumentMeta(doc);
    const archiveReason = String(descriptionMeta.archiveReason || doc?.archiveReason || '');
    if (archiveReason === 'Replaced' || archiveReason === 'Not Renewed') return true;

    return Boolean(
        doc?.isRenewed ||
        descriptionMeta.isRenewed ||
        descriptionMeta.notRenewed,
    );
}

/** Employee-style reason label for Old Documents rows. */
export function vehicleDocumentArchiveReasonLabel(doc) {
    const meta = parseVehicleDocumentMeta(doc);
    const reason = String(meta.archiveReason || doc?.archiveReason || '').trim();
    if (reason === 'Replaced' || reason === 'Not Renewed') return reason;
    if (meta.notRenewed) return 'Not Renewed';
    if (meta.isRenewed || doc?.isRenewed) return 'Replaced';
    const status = String(doc?.status || '').toLowerCase();
    if (status === 'old' || status === 'renewed' || status === 'archived') return 'Replaced';
    return '';
}

function collectRenewedFromDocIds(docs) {
    const ids = new Set();
    for (const d of docs || []) {
        const meta = parseVehicleDocumentMeta(d);
        const from = String(meta?.renewedFrom || docTopLevelRenewedFrom(d) || '').trim();
        if (from) ids.add(from);
    }
    return ids;
}

function docTopLevelRenewedFrom(doc) {
    return doc?.renewedFrom ? String(doc.renewedFrom) : '';
}

function isOldByRenewLink(doc, renewedFromDocIds) {
    const id = String(doc?._id || '').trim();
    return id && renewedFromDocIds.has(id);
}

function docSortTime(d) {
    if (d?.issueDate) return new Date(d.issueDate).getTime();
    if (d?.expiryDate) return new Date(d.expiryDate).getTime();
    if (d?.createdAt) return new Date(d.createdAt).getTime();
    return 0;
}

function bucketizeDocumentList(list) {
    const basic = [];
    const registration = [];
    const insurance = [];
    const warranty = [];
    const permit = [];
    const petrol = [];
    const mortgage = [];
    const normType = normVehicleDocType;

    for (const d of list) {
        const t = normType(d.type);
        if (t === 'registration' || t === 'registration attachment') registration.push(d);
        else if (t === 'insurance' || t === 'insurance attachment') {
            if (!isInsuranceInvoiceAttachmentLabel(d)) insurance.push(d);
        } else if (t === 'warranty' || t === 'warranty attachment') warranty.push(d);
        else if (t === 'permit' || t === 'permit attachment') permit.push(d);
        else if (t === 'mortgage') mortgage.push(d);
        else if (t === 'petrol' || t === 'petrol attachment') petrol.push(d);
        else basic.push(d);
    }

    const byIssueDesc = (a, b) => {
        const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
        const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
        return tb - ta;
    };
    const regSort = (a, b) => {
        const ta = a.issueDate ? new Date(a.issueDate).getTime() : 0;
        const tb = b.issueDate ? new Date(b.issueDate).getTime() : 0;
        if (tb !== ta) return tb - ta;
        const ma = normType(a.type) === 'registration' ? 0 : 1;
        const mb = normType(b.type) === 'registration' ? 0 : 1;
        return ma - mb;
    };

    registration.sort(regSort);
    insurance.sort(byIssueDesc);
    warranty.sort(byIssueDesc);
    permit.sort(byIssueDesc);
    petrol.sort(byIssueDesc);
    mortgage.sort(byIssueDesc);
    basic.sort(byIssueDesc);

    return { basic, registration, insurance, warranty, permit, petrol, mortgage };
}

/**
 * Split asset.documents into live/old buckets for the Documents tab.
 * Registration and insurance keep only the latest active primary in Live; superseded rows go to Old.
 */
export function partitionVehicleDocuments(docs = []) {
    const normType = normVehicleDocType;
    const renewalTrackedTypes = new Set([
        'insurance',
        'insurance attachment',
        'registration',
        'registration attachment',
    ]);
    const renewedFromDocIds = collectRenewedFromDocIds(docs);
    const isDocOld = (doc) => isVehicleDocumentOld(doc) || isOldByRenewLink(doc, renewedFromDocIds);

    const live = [];
    const old = [];
    const handledIds = new Set();

    for (const type of renewalTrackedTypes) {
        const docsOfType = docs
            .filter((d) => normType(d.type) === type)
            .sort((a, b) => docSortTime(b) - docSortTime(a));
        if (!docsOfType.length) continue;

        const latestActive = docsOfType.find((d) => !isDocOld(d)) || null;

        for (const d of docsOfType) {
            const id = String(d?._id || '');
            if (id) handledIds.add(id);
            if (
                latestActive &&
                String(d?._id || '') === String(latestActive?._id || '') &&
                !isDocOld(d)
            ) {
                live.push(d);
            } else {
                old.push(d);
            }
        }
    }

    for (const d of docs) {
        const id = String(d?._id || '');
        if (id && handledIds.has(id)) continue;
        if (isDocOld(d)) old.push(d);
        else live.push(d);
    }

    const synced = syncVehicleDocumentAttachmentBuckets(live, old, docs);
    return {
        live: bucketizeDocumentList(synced.live),
        old: bucketizeDocumentList(synced.old),
    };
}
