'use client';

import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import {
    OIL_SERVICE_DETAIL_GRID_ACCENTS,
    OIL_SERVICE_DETAIL_GRID_LAYOUT,
} from '../utils/vehicleOilServiceDetailGrid';

const fieldInput =
    'w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed';
const datePickerClass = `${fieldInput} h-auto justify-start font-normal`;
const actionBtn =
    'inline-flex items-center justify-center gap-1.5 min-w-[72px] px-3 py-2 rounded-lg border text-xs font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed';
const addBtn = `${actionBtn} border-blue-200 bg-white text-blue-700 hover:bg-blue-50`;
const viewBtn = `${actionBtn} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`;

const EMPTY_FILE = { name: '', data: '', mime: '' };

function toMonthValue(dateValue) {
    if (!dateValue) return '';
    const raw = String(dateValue).trim();
    if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function monthToDateInput(monthValue) {
    if (!monthValue) return '';
    const raw = String(monthValue).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
    return '';
}

async function readUploadFile(file) {
    if (!file) return EMPTY_FILE;
    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    return {
        name: file.name,
        data,
        mime: file.type || 'application/pdf',
    };
}

function buildInitialForm(service, workflow = null) {
    const remark = parseVehicleServiceRemark(service) || {};
    const savedCharge =
        remark.totalServiceCharge != null && remark.totalServiceCharge !== ''
            ? String(remark.totalServiceCharge)
            : service?.value != null && service?.value !== ''
              ? String(service.value)
              : '';
    return {
        garageInvoice: { ...EMPTY_FILE },
        otherDocument: { ...EMPTY_FILE },
        totalServiceCharge: savedCharge,
        serviceStartDate: monthToDateInput(
            remark.serviceStartDate || remark.scheduledServiceDate || workflow?.scheduledServiceDate || '',
        ),
        serviceEndDate: monthToDateInput(
            remark.serviceEndDate ||
                remark.nextChangeMonth ||
                workflow?.serviceWindowEndDate ||
                '',
        ),
        returnDate: remark.returnDate || '',
        nextServiceKm: remark.nextChangeKm != null ? String(remark.nextChangeKm) : '',
        nextServiceDate: monthToDateInput(remark.nextChangeMonth || remark.nextServiceDate || ''),
        handOverDate: remark.handOverDate || '',
    };
}

function FieldCard({ label, children, accentClass, minHeightPx }) {
    return (
        <div
            className={`flex flex-col justify-center rounded-lg border px-3 py-2.5 ${accentClass}`}
            style={{ minHeight: `${minHeightPx}px` }}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
            <div className="mt-1.5 min-w-0">{children}</div>
        </div>
    );
}

function isServiceDetailsComplete(form) {
    const charge = Number(form.totalServiceCharge);
    return (
        Number.isFinite(charge) &&
        charge > 0 &&
        String(form.returnDate || '').trim() !== '' &&
        String(form.nextServiceKm ?? '').trim() !== '' &&
        String(form.nextServiceDate || '').trim() !== '' &&
        String(form.handOverDate || '').trim() !== ''
    );
}

function getServiceDetailsMissingFields(form) {
    const missing = [];
    const charge = Number(form.totalServiceCharge);
    if (!Number.isFinite(charge) || charge <= 0) missing.push('Total service charge');
    if (!String(form.returnDate || '').trim()) missing.push('Return date');
    if (!String(form.nextServiceKm ?? '').trim()) missing.push('Next service KM');
    if (!String(form.nextServiceDate || '').trim()) missing.push('Next service date');
    if (!String(form.handOverDate || '').trim()) missing.push('Hand over date');
    return missing;
}

export default function VehicleOilServiceDetailsForm({
    service,
    workflow = null,
    saving = false,
    submitting = false,
    locked = false,
    canAct = false,
    onSave,
    onSubmit,
}) {
    const remark = useMemo(() => parseVehicleServiceRemark(service) || {}, [service]);
    const [form, setForm] = useState(() => buildInitialForm(service, workflow));

    useEffect(() => {
        setForm(buildInitialForm(service, workflow));
    }, [service?._id, service?.updatedAt, service?.remark, workflow?.scheduledServiceDate, workflow?.serviceWindowEndDate]);

    const hasPersistedGarageInvoice =
        !!String(service?.shopInvoice || '').trim() || !!String(remark.garageInvoiceUrl || '').trim();
    const hasPersistedOtherDoc =
        !!String(service?.invoice || '').trim() || !!String(remark.returnOtherDocUrl || '').trim();

    const fieldsDisabled = locked || saving || submitting;
    const showActions = !locked && canAct;
    const { fieldMinHeightPx, gapClass } = OIL_SERVICE_DETAIL_GRID_LAYOUT;
    const accent = (index) => OIL_SERVICE_DETAIL_GRID_ACCENTS[index % OIL_SERVICE_DETAIL_GRID_ACCENTS.length];
    const formComplete = isServiceDetailsComplete(form);
    const missingFields = getServiceDetailsMissingFields(form);
    const canSaveDraft = showActions && !saving && !submitting;
    const canSend = showActions && !saving && !submitting && formComplete;

    const handleFileChange = async (file, key) => {
        if (!file || fieldsDisabled || !canAct) return;
        const uploaded = await readUploadFile(file);
        setForm((prev) => ({ ...prev, [key]: uploaded }));
    };

    const handleSave = () => {
        if (!canSaveDraft || typeof onSave !== 'function') return;
        onSave({
            ...form,
            nextServiceMonth: toMonthValue(form.nextServiceDate),
        });
    };

    const handleSubmit = () => {
        if (!canSend || typeof onSubmit !== 'function') return;
        onSubmit({
            ...form,
            nextServiceMonth: toMonthValue(form.nextServiceDate),
        });
    };

    const { toast } = useToast();
    const [viewingKey, setViewingKey] = useState('');

    const handleViewAttachment = async (attachmentRef, label, viewKey) => {
        if (!attachmentRef || viewingKey) return;
        setViewingKey(viewKey);
        try {
            const result = await openAttachmentInNewTab(attachmentRef, {
                name: label || 'Document.pdf',
                mimeType: 'application/pdf',
            });
            if (!result.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot open file',
                    description: result.error || 'Attachment is unavailable.',
                });
            }
        } catch {
            toast({
                variant: 'destructive',
                title: 'Cannot open file',
                description: 'Attachment is unavailable.',
            });
        } finally {
            setViewingKey('');
        }
    };

    const renderUploadField = (key, persisted, url, fileState) => {
        const viewRef = url || fileState?.data || null;
        const viewLabel = fileState?.name || 'Document.pdf';
        const canView = Boolean((persisted && url) || fileState?.data);

        return (
        <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
            {canView ? (
                <button
                    type="button"
                    onClick={() => void handleViewAttachment(viewRef, viewLabel, key)}
                    disabled={!!viewingKey}
                    className={viewBtn}
                >
                    {viewingKey === key ? 'Opening…' : 'View'}
                </button>
            ) : null}
            {canAct && !locked ? (
                <label className={`${addBtn} ${fieldsDisabled ? 'pointer-events-none' : 'cursor-pointer'}`}>
                    <Upload size={14} />
                    {fileState?.name ? 'Change' : 'Add'}
                    <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,application/pdf"
                        disabled={fieldsDisabled}
                        onChange={(e) => void handleFileChange(e.target.files?.[0], key)}
                    />
                </label>
            ) : null}
            {locked && !persisted && !fileState?.name ? (
                <span className="text-sm font-medium text-gray-400">No document</span>
            ) : null}
        </div>
        );
    };

    return (
        <div className="flex flex-col gap-2.5">
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                <FieldCard label="Garage Invoice (optional)" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                    {renderUploadField(
                        'garageInvoice',
                        hasPersistedGarageInvoice,
                        service?.shopInvoice,
                        form.garageInvoice,
                    )}
                </FieldCard>
                <FieldCard label="Other Document (optional)" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                    {renderUploadField(
                        'otherDocument',
                        hasPersistedOtherDoc,
                        service?.invoice,
                        form.otherDocument,
                    )}
                </FieldCard>
                <FieldCard label="Total Service Charge" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                            AED
                        </span>
                        <input
                            className={`${fieldInput} pl-11`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.totalServiceCharge}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, totalServiceCharge: e.target.value }))
                            }
                            disabled={fieldsDisabled || !canAct}
                            placeholder="0.00"
                        />
                    </div>
                </FieldCard>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                <FieldCard label="Start Date" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                    <DatePicker
                        value={form.serviceStartDate}
                        onChange={() => {}}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled
                    />
                </FieldCard>
                <FieldCard label="End Date" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                    <DatePicker
                        value={form.serviceEndDate}
                        onChange={() => {}}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled
                    />
                </FieldCard>
                <FieldCard label="Hand Over Date" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                    <DatePicker
                        value={form.handOverDate}
                        onChange={(value) => setForm((prev) => ({ ...prev, handOverDate: value || '' }))}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled={fieldsDisabled || !canAct}
                    />
                </FieldCard>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass}`}>
                <FieldCard label="Return Date" accentClass={accent(2)} minHeightPx={fieldMinHeightPx}>
                    <DatePicker
                        value={form.returnDate}
                        onChange={(value) => setForm((prev) => ({ ...prev, returnDate: value || '' }))}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled={fieldsDisabled || !canAct}
                    />
                </FieldCard>
                <FieldCard label="Next Service KM" accentClass={accent(0)} minHeightPx={fieldMinHeightPx}>
                    <input
                        className={fieldInput}
                        type="number"
                        min="0"
                        value={form.nextServiceKm}
                        onChange={(e) => setForm((prev) => ({ ...prev, nextServiceKm: e.target.value }))}
                        disabled={fieldsDisabled || !canAct}
                    />
                </FieldCard>
                <FieldCard label="Next Service Date" accentClass={accent(1)} minHeightPx={fieldMinHeightPx}>
                    <DatePicker
                        value={form.nextServiceDate}
                        onChange={(value) => setForm((prev) => ({ ...prev, nextServiceDate: value || '' }))}
                        placeholder="dd/mm/yyyy"
                        className={datePickerClass}
                        disabled={fieldsDisabled || !canAct}
                    />
                </FieldCard>
            </div>

            {showActions ? (
                <div className="mt-6 flex flex-col items-center gap-3">
                    {missingFields.length > 0 ? (
                        <p className="text-xs text-amber-700">
                            Still required: {missingFields.join(', ')}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        className="min-w-[140px] px-6 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={handleSave}
                        disabled={!canSaveDraft}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        type="button"
                        className="min-w-[140px] px-6 py-2.5 rounded-lg bg-emerald-600 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={handleSubmit}
                        disabled={!canSend}
                        title={
                            missingFields.length
                                ? `Missing: ${missingFields.join(', ')}`
                                : ''
                        }
                    >
                        {submitting ? 'Sending...' : 'Send'}
                    </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
