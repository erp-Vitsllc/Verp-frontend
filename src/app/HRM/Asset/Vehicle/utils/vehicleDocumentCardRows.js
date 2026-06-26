export const normVehicleDocType = (t) => String(t || '').toLowerCase().trim();

export const vehicleDocDateKey = (value) => {
    if (!value) return '';
    const t = new Date(value);
    if (Number.isNaN(t.getTime())) return String(value).trim().slice(0, 10);
    return t.toISOString().slice(0, 10);
};

export const isInsuranceInvoiceAttachmentLabel = (doc) =>
    String(doc?.description || doc?.name || '').toLowerCase().includes('invoice');

export const registrationAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'registration') return [];
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'registration attachment') return false;
        return vehicleDocDateKey(d.issueDate) === issueKey && vehicleDocDateKey(d.expiryDate) === expiryKey;
    });
};

export const insuranceAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'insurance') return [];
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'insurance attachment') return false;
        if (isInsuranceInvoiceAttachmentLabel(d)) return false;
        return vehicleDocDateKey(d.issueDate) === issueKey && vehicleDocDateKey(d.expiryDate) === expiryKey;
    });
};

export const warrantyAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'warranty') return [];
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'warranty attachment') return false;
        return vehicleDocDateKey(d.issueDate) === issueKey && vehicleDocDateKey(d.expiryDate) === expiryKey;
    });
};

export const permitAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'permit') return [];
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'permit attachment') return false;
        return vehicleDocDateKey(d.issueDate) === issueKey;
    });
};

const attachmentLabelForDoc = (doc, fallback = 'Attachment') => {
    const t = normVehicleDocType(doc?.type);
    if (t === 'insurance') return 'Insurance';
    if (t === 'registration') return 'Registration';
    if (t === 'warranty') return 'Warranty';
    if (t === 'permit') return 'Permit';
    if (t === 'insurance attachment') return String(doc?.description || 'Insurance Attachment').trim() || 'Insurance Attachment';
    if (t === 'registration attachment') return String(doc?.description || 'Supporting').trim() || 'Supporting';
    if (t === 'warranty attachment') return String(doc?.description || 'Warranty Attachment').trim() || 'Warranty Attachment';
    if (t === 'permit attachment') return String(doc?.description || 'Permit Attachment').trim() || 'Permit Attachment';
    return String(doc?.description || doc?.type || fallback).trim() || fallback;
};

export const buildDocumentAttachmentItems = (primaryDoc, attachmentDocs = []) => {
    const items = [];
    const seen = new Set();

    const push = (doc) => {
        if (!doc?.attachment) return;
        const id = String(doc._id || doc.attachment);
        if (seen.has(id)) return;
        seen.add(id);
        items.push({
            url: doc.attachment,
            label: attachmentLabelForDoc(doc),
            docId: doc._id,
        });
    };

    push(primaryDoc);
    for (const att of attachmentDocs) push(att);
    return items;
};

const groupRowsByPrimary = (list, primaryType, attachmentsForDoc) => {
    const primaries = (list || []).filter((d) => normVehicleDocType(d.type) === primaryType);
    const used = new Set();
    const rows = primaries.map((primary) => {
        const attachments = attachmentsForDoc(primary, list);
        used.add(String(primary._id));
        attachments.forEach((a) => used.add(String(a._id)));
        return {
            primary,
            attachments,
            allDocs: [primary, ...attachments],
            attachmentItems: buildDocumentAttachmentItems(primary, attachments),
        };
    });

    const orphans = (list || []).filter((d) => !used.has(String(d._id)));
    const orphanGroups = new Map();
    for (const doc of orphans) {
        const issueKey = vehicleDocDateKey(doc.issueDate);
        const expiryKey = vehicleDocDateKey(doc.expiryDate);
        const groupKey = `${primaryType}|${issueKey}|${expiryKey}`;
        if (!orphanGroups.has(groupKey)) orphanGroups.set(groupKey, []);
        orphanGroups.get(groupKey).push(doc);
    }

    for (const group of orphanGroups.values()) {
        const primary =
            group.find((d) => normVehicleDocType(d.type) === primaryType) ||
            group.find((d) => d.attachment) ||
            group[0];
        const attachments = group.filter((d) => d !== primary);
        rows.push({
            primary,
            attachments,
            allDocs: group,
            attachmentItems: buildDocumentAttachmentItems(primary, attachments),
        });
    }

    return rows;
};

export const groupRegistrationDocumentRows = (list) =>
    groupRowsByPrimary(list, 'registration', registrationAttachmentsForDoc);

export const groupInsuranceDocumentRows = (list) =>
    groupRowsByPrimary(list, 'insurance', insuranceAttachmentsForDoc);

export const groupWarrantyDocumentRows = (list) =>
    groupRowsByPrimary(list, 'warranty', warrantyAttachmentsForDoc);

export const groupPermitDocumentRows = (list) =>
    groupRowsByPrimary(list, 'permit', permitAttachmentsForDoc);

export const resolveParentVehicleDocument = (doc, allDocs) => {
    if (!doc) return null;
    const t = normVehicleDocType(doc.type);
    if (t === 'insurance attachment') {
        const issueKey = vehicleDocDateKey(doc.issueDate);
        const expiryKey = vehicleDocDateKey(doc.expiryDate);
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'insurance' &&
                vehicleDocDateKey(d.issueDate) === issueKey &&
                vehicleDocDateKey(d.expiryDate) === expiryKey,
        );
    }
    if (t === 'registration attachment') {
        const issueKey = vehicleDocDateKey(doc.issueDate);
        const expiryKey = vehicleDocDateKey(doc.expiryDate);
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'registration' &&
                vehicleDocDateKey(d.issueDate) === issueKey &&
                vehicleDocDateKey(d.expiryDate) === expiryKey,
        );
    }
    if (t === 'warranty attachment') {
        const issueKey = vehicleDocDateKey(doc.issueDate);
        const expiryKey = vehicleDocDateKey(doc.expiryDate);
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'warranty' &&
                vehicleDocDateKey(d.issueDate) === issueKey &&
                vehicleDocDateKey(d.expiryDate) === expiryKey,
        );
    }
    if (t === 'permit attachment') {
        const issueKey = vehicleDocDateKey(doc.issueDate);
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'permit' && vehicleDocDateKey(d.issueDate) === issueKey,
        );
    }
    return null;
};

export const relatedVehicleDocumentsForCard = (doc, allDocs) => {
    if (!doc) return [];
    const t = normVehicleDocType(doc.type);
    if (t === 'insurance' || t === 'insurance attachment') {
        const primary = t === 'insurance' ? doc : resolveParentVehicleDocument(doc, allDocs) || doc;
        return [primary, ...insuranceAttachmentsForDoc(primary, allDocs)];
    }
    if (t === 'registration' || t === 'registration attachment') {
        const primary = t === 'registration' ? doc : resolveParentVehicleDocument(doc, allDocs) || doc;
        return [primary, ...registrationAttachmentsForDoc(primary, allDocs)];
    }
    if (t === 'warranty' || t === 'warranty attachment') {
        const primary = t === 'warranty' ? doc : resolveParentVehicleDocument(doc, allDocs) || doc;
        return [primary, ...warrantyAttachmentsForDoc(primary, allDocs)];
    }
    if (t === 'permit' || t === 'permit attachment') {
        const primary = t === 'permit' ? doc : resolveParentVehicleDocument(doc, allDocs) || doc;
        return [primary, ...permitAttachmentsForDoc(primary, allDocs)];
    }
    return [doc];
};

export const syncVehicleDocumentAttachmentBuckets = (liveList, oldList, allDocs) => {
    const live = [...liveList];
    const old = [...oldList];
    const liveIds = new Set(live.map((d) => String(d._id)));
    const oldIds = new Set(old.map((d) => String(d._id)));

    const move = (doc, from, to, fromIds, toIds) => {
        const id = String(doc._id);
        if (!fromIds.has(id) || toIds.has(id)) return;
        fromIds.delete(id);
        toIds.add(id);
        const idx = from.findIndex((d) => String(d._id) === id);
        if (idx >= 0) {
            const [item] = from.splice(idx, 1);
            to.push(item);
        }
    };

    for (const doc of allDocs || []) {
        const parent = resolveParentVehicleDocument(doc, allDocs);
        if (!parent) continue;
        const parentId = String(parent._id);
        const childId = String(doc._id);
        if (childId === parentId) continue;

        const parentInLive = liveIds.has(parentId);
        const childInLive = liveIds.has(childId);
        const childInOld = oldIds.has(childId);

        if (parentInLive && !childInLive && childInOld) {
            move(doc, old, live, oldIds, liveIds);
        } else if (!parentInLive && childInLive) {
            move(doc, live, old, liveIds, oldIds);
        }
    }

    return { live, old };
};
