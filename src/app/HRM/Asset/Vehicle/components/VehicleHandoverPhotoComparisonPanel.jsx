'use client';

import { useMemo, useState } from 'react';
import { ClipboardCheck, Car } from 'lucide-react';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import {
    buildAssessmentComparisonRows,
    buildBodyConditionComparisonRows,
} from '../utils/vehicleHandoverPhotoComparison';
import {
    HANDOVER_ASSESSMENT_GRID_CLASS,
    HANDOVER_BODY_CONDITION_GRID_CLASS,
} from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoViewer from './VehicleHandoverAssessmentPhotoViewer';

function ComparisonPhotoBox({ label, photoUrl, tone, caption }) {
    const borderClass =
        tone === 'previous'
            ? 'border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-200'
            : 'border-red-400 bg-red-50/40 ring-1 ring-red-200';
    const labelClass = tone === 'previous' ? 'text-emerald-700' : 'text-red-700';

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <p className={`text-[9px] font-bold uppercase tracking-wider ${labelClass}`}>{caption}</p>
            <div
                className={`h-[100px] min-h-[100px] max-h-[100px] w-full shrink-0 overflow-hidden rounded-lg border-2 ${borderClass}`}
            >
                {photoUrl ? (
                    <img src={photoUrl} alt={`${label} ${caption}`} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-gray-400">No photo</div>
                )}
            </div>
        </div>
    );
}

function AssessmentComparisonCard({ row, onPreview }) {
    const yesNo = (value) => (value === true ? 'Yes' : value === false ? 'No' : '—');

    return (
        <div
            className={`rounded-xl border p-3 shadow-sm ${
                row.changed ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'
            }`}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <h5 className="truncate text-sm font-bold text-gray-900">{row.label}</h5>
                {row.changed ? (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700">
                        Changed
                    </span>
                ) : null}
            </div>
            <div className="mb-2 grid grid-cols-2 gap-2 text-[10px] text-gray-600">
                <div>
                    <span className="font-semibold text-emerald-700">Previous:</span> {yesNo(row.previous.present)}
                </div>
                <div>
                    <span className="font-semibold text-red-700">Current:</span> {yesNo(row.current.present)}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onPreview(row.previous.photoUrl)} className="text-left">
                    <ComparisonPhotoBox
                        label={row.label}
                        photoUrl={row.previous.photoUrl}
                        tone="previous"
                        caption="Previous"
                    />
                </button>
                <button type="button" onClick={() => onPreview(row.current.photoUrl)} className="text-left">
                    <ComparisonPhotoBox
                        label={row.label}
                        photoUrl={row.current.photoUrl}
                        tone="current"
                        caption="Current"
                    />
                </button>
            </div>
        </div>
    );
}

function BodyComparisonCard({ row, onPreview }) {
    return (
        <div
            className={`flex min-w-0 flex-col rounded-xl border p-2.5 shadow-sm ${
                row.changed ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'
            }`}
        >
            <div className="mb-1 flex items-center justify-between gap-1">
                <h5 className="truncate text-xs font-bold text-gray-900">{row.label}</h5>
                {row.changed ? (
                    <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-red-700">
                        Changed
                    </span>
                ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onPreview(row.previous.photoUrl)} className="text-left">
                    <ComparisonPhotoBox
                        label={row.label}
                        photoUrl={row.previous.photoUrl}
                        tone="previous"
                        caption="Previous"
                    />
                </button>
                <button type="button" onClick={() => onPreview(row.current.photoUrl)} className="text-left">
                    <ComparisonPhotoBox
                        label={row.label}
                        photoUrl={row.current.photoUrl}
                        tone="current"
                        caption="Current"
                    />
                </button>
            </div>
        </div>
    );
}

export default function VehicleHandoverPhotoComparisonPanel({
    historyEntry,
    assetHistory = [],
    className = '',
}) {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerStartIndex, setViewerStartIndex] = useState(0);

    const assessmentRows = useMemo(
        () => buildAssessmentComparisonRows(historyEntry, assetHistory),
        [historyEntry, assetHistory],
    );
    const bodyRows = useMemo(
        () => buildBodyConditionComparisonRows(historyEntry, assetHistory),
        [historyEntry, assetHistory],
    );

    const galleryItems = useMemo(() => {
        const items = [];
        assessmentRows.forEach((row) => {
            if (row.previous.photoUrl) {
                items.push({ key: `${row.key}-prev`, label: `${row.label} (Previous)`, url: row.previous.photoUrl });
            }
            if (row.current.photoUrl) {
                items.push({ key: `${row.key}-curr`, label: `${row.label} (Current)`, url: row.current.photoUrl });
            }
        });
        bodyRows.forEach((row) => {
            if (row.previous.photoUrl) {
                items.push({ key: `${row.key}-prev`, label: `${row.label} (Previous)`, url: row.previous.photoUrl });
            }
            if (row.current.photoUrl) {
                items.push({ key: `${row.key}-curr`, label: `${row.label} (Current)`, url: row.current.photoUrl });
            }
        });
        return items;
    }, [assessmentRows, bodyRows]);

    const openPreview = (url) => {
        if (!url) return;
        const index = galleryItems.findIndex((item) => item.url === url);
        setViewerStartIndex(index >= 0 ? index : 0);
        setViewerOpen(true);
    };

    const changedAssessment = assessmentRows.filter((row) => row.changed);
    const changedBody = bodyRows.filter((row) => row.changed);

    return (
        <>
            <div className={`space-y-6 ${className}`}>
                <FineFormCard
                    title="Accessories & Tools Comparison"
                    subtitle="Green = previous handover · Red = current handover"
                    icon={ClipboardCheck}
                    iconBg="bg-slate-50"
                    iconColor="text-slate-700"
                    className="w-full"
                >
                    {changedAssessment.length ? (
                        <div className={HANDOVER_ASSESSMENT_GRID_CLASS}>
                            {changedAssessment.map((row) => (
                                <AssessmentComparisonCard key={row.key} row={row} onPreview={openPreview} />
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                            No accessory or tool changes detected compared to the previous handover.
                        </p>
                    )}
                </FineFormCard>

                <FineFormCard
                    title="Body Condition Comparison"
                    subtitle="Green = previous photos · Red = new or changed photos"
                    icon={Car}
                    iconBg="bg-slate-50"
                    iconColor="text-slate-700"
                    className="w-full"
                >
                    {changedBody.length ? (
                        <div className={HANDOVER_BODY_CONDITION_GRID_CLASS}>
                            {changedBody.map((row) => (
                                <BodyComparisonCard key={row.key} row={row} onPreview={openPreview} />
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                            No body condition photo changes detected compared to the previous handover.
                        </p>
                    )}
                </FineFormCard>
            </div>

            <VehicleHandoverAssessmentPhotoViewer
                open={viewerOpen}
                items={galleryItems}
                startIndex={viewerStartIndex}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
}
