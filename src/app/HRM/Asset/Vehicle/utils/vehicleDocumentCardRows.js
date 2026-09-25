export const normVehicleDocType = (t) => String(t || '').toLowerCase().trim();

export const vehicleDocDateKey = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    const t = new Date(value);
    if (Number.isNaN(t.getTime())) return String(value).trim().slice(0, 10);
    const month = String(t.getMonth() + 1).padStart(2, '0');
    const day = String(t.getDate()).padStart(2, '0');
    return `${t.getFullYear()}-${month}-${day}`;
};

/** Same issue day. Blank expiry still belongs; a different expiry is another period. */
const sameDocPeriod = (doc, issueKey, expiryKey) => {
    const issue = vehicleDocDateKey(doc?.issueDate);
    const expiry = vehicleDocDateKey(doc?.expiryDate);
    if (issueKey) {
        if (issue !== issueKey) return false;
    } else if (issue) {
        return false;
    }
    if (expiryKey && expiry && expiry !== expiryKey) return false;
    return true;
};

/** Prefer description.text when description is JSON metadata (e.g. after renew). */
const descriptionDisplayLabel = (doc, fallback = '') => {
    const raw = doc?.description;
    if (raw == null || raw === '') return String(doc?.name || fallback || '').trim() || fallback;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return (
                        String(parsed.text || parsed.label || parsed.name || '').trim() ||
                        String(doc?.name || fallback || '').trim() ||
                        fallback
                    );
                }
            } catch {
                /* plain string */
            }
        }
        return trimmed || String(doc?.name || fallback || '').trim() || fallback;
    }
    return String(doc?.name || fallback || '').trim() || fallback;
};

export const isInsuranceInvoiceAttachmentLabel = (doc) =>
    descriptionDisplayLabel(doc, String(doc?.description || doc?.name || ''))
        .toLowerCase()
        .includes('invoice');

export const isInvoiceDocumentLabel = (labelOrDoc) =>
    isInsuranceInvoiceAttachmentLabel(
        typeof labelOrDoc === 'object' ? labelOrDoc : { description: labelOrDoc },
    );

export { ERP_PDF_ACCEPT as PDF_FILE_ACCEPT, isErpPdfFile as isPdfUploadFile } from '@/utils/uploadFileTypes';

export const registrationInvoiceAttachmentForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'registration') return null;
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).find((d) => {
        if (normVehicleDocType(d.type) !== 'registration attachment') return false;
        if (!isInvoiceDocumentLabel(d)) return false;
        return sameDocPeriod(d, issueKey, expiryKey);
    }) || null;
};

export const insuranceInvoiceAttachmentForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'insurance') return null;
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).find((d) => {
        if (normVehicleDocType(d.type) !== 'insurance attachment') return false;
        if (!isInvoiceDocumentLabel(d)) return false;
        return sameDocPeriod(d, issueKey, expiryKey);
    }) || null;
};

export const registrationAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'registration') return [];
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'registration attachment') return false;
        return sameDocPeriod(d, issueKey, expiryKey);
    });
};

export const insuranceAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'insurance') return [];
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'insurance attachment') return false;
        return sameDocPeriod(d, issueKey, expiryKey);
    });
};

export const warrantyAttachmentsForDoc = (mainDoc, list) => {
    if (!mainDoc || normVehicleDocType(mainDoc.type) !== 'warranty') return [];
    const primaryId = String(mainDoc._id || '').trim();
    const issueKey = vehicleDocDateKey(mainDoc.issueDate);
    const expiryKey = vehicleDocDateKey(mainDoc.expiryDate);

    const parseParentId = (doc) => {
        const raw = doc?.description;
        if (raw == null || raw === '') return '';
        if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return '';
        try {
            const parsed = JSON.parse(raw);
            return String(parsed?.parentDocumentId || parsed?.warrantyDocId || '').trim();
        } catch {
            return '';
        }
    };

    const linkedByParent = (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'warranty attachment') return false;
        const parentId = parseParentId(d);
        return primaryId && parentId && parentId === primaryId;
    });
    if (linkedByParent.length) return linkedByParent;

    // Fallback: same dates, but never treat another Warranty primary as an attachment.
    return (list || []).filter((d) => {
        if (normVehicleDocType(d.type) !== 'warranty attachment') return false;
        const parentId = parseParentId(d);
        if (parentId && primaryId && parentId !== primaryId) return false;
        return sameDocPeriod(d, issueKey, expiryKey);
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
    if (t === 'insurance attachment') {
        return descriptionDisplayLabel(doc, 'Insurance Attachment');
    }
    if (t === 'registration attachment') {
        return descriptionDisplayLabel(doc, 'Supporting');
    }
    if (t === 'warranty attachment') {
        return descriptionDisplayLabel(doc, 'Warranty Attachment');
    }
    if (t === 'permit attachment') {
        return descriptionDisplayLabel(doc, 'Permit Attachment');
    }
    return descriptionDisplayLabel(doc, String(doc?.type || fallback).trim() || fallback);
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
    const stillOrphan = [];
    for (const doc of orphans) {
        const isAttachment = normVehicleDocType(doc.type) === `${primaryType} attachment`;
        if (!isAttachment || !rows.length) {
            stillOrphan.push(doc);
            continue;
        }
        const issueKey = vehicleDocDateKey(doc.issueDate);
        const expiryKey = vehicleDocDateKey(doc.expiryDate);
        const target = rows.find((row) => sameDocPeriod(row.primary, issueKey, expiryKey));
        if (!target) {
            stillOrphan.push(doc);
            continue;
        }
        if (!target.attachments.some((a) => String(a._id) === String(doc._id))) {
            target.attachments = [...target.attachments, doc];
            target.allDocs = [...target.allDocs, doc];
            target.attachmentItems = buildDocumentAttachmentItems(target.primary, target.attachments);
        }
        used.add(String(doc._id));
    }

    const orphanGroups = new Map();
    for (const doc of stillOrphan) {
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

    return dedupeCopiedDocumentRows(rows);
};

function documentRowCopyKey(row) {
    const doc = row?.primary || {};
    const files = (row?.attachmentItems || [])
        .map((item) => String(item?.url || ''))
        .filter(Boolean)
        .sort()
        .join('|');
    return [
        normVehicleDocType(doc.type),
        vehicleDocDateKey(doc.issueDate),
        vehicleDocDateKey(doc.expiryDate),
        files,
    ].join('::');
}

/** Hide a repeated card that has the same type, dates, and files. Records stay stored. */
function dedupeCopiedDocumentRows(rows) {
    const seen = new Set();
    const out = [];
    for (const row of rows || []) {
        const key = documentRowCopyKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}

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
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'insurance' &&
                sameDocPeriod(doc, vehicleDocDateKey(d.issueDate), vehicleDocDateKey(d.expiryDate)),
        );
    }
    if (t === 'registration attachment') {
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'registration' &&
                sameDocPeriod(doc, vehicleDocDateKey(d.issueDate), vehicleDocDateKey(d.expiryDate)),
        );
    }
    if (t === 'warranty attachment') {
        return (allDocs || []).find(
            (d) =>
                normVehicleDocType(d.type) === 'warranty' &&
                sameDocPeriod(doc, vehicleDocDateKey(d.issueDate), vehicleDocDateKey(d.expiryDate)),
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
        const primaryId = String(primary?._id || '').trim();
        // Individual warranty only — never pull sibling Warranty primaries.
        const related = [primary, ...warrantyAttachmentsForDoc(primary, allDocs)].filter(Boolean);
        return related.filter((d) => {
            const id = String(d?._id || '').trim();
            if (primaryId && id === primaryId) return true;
            return normVehicleDocType(d?.type) === 'warranty attachment';
        });
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
