'use client';

import { ClipboardList, Truck } from 'lucide-react';
import {
    DetailField,
    DetailGrid,
    FineFormCard,
    SectionDivider,
} from '../../../Fine/components/FineFormCardShared';
import {
    getHandoverByLabel,
    getHandoverDisplayStatus,
    getHandoverReason,
    getHandoverToLabel,
} from '../utils/vehicleHandoverHistory';
import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export default function VehicleHandoverAssignFormCards({ historyEntry, vehicle, slNo = 1 }) {
    if (!historyEntry) return null;

    const status = getHandoverDisplayStatus(historyEntry, vehicle);
    const assignmentReason = getHandoverReason(historyEntry, vehicle);
    const noteComments = String(historyEntry?.comments || '').trim();
    const showSeparateComments =
        Boolean(noteComments) &&
        noteComments !== assignmentReason &&
        assignmentReason !== '-';
    const snapshot = historyEntry?.details && typeof historyEntry.details === 'object'
        ? historyEntry.details
        : vehicle || {};
    const assignee = historyEntry?.assignedTo || snapshot?.assignedTo;
    const assigneeName = assignee
        ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.employeeId
        : getHandoverToLabel(historyEntry);

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard
                    icon={ClipboardList}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title="Handover Assignment Details"
                    subtitle="Assignment event and handover information"
                >
                    <DetailGrid>
                        <DetailField label="Sl No." value={slNo} />
                        <DetailField label="Handover Date" value={formatDate(historyEntry?.date || historyEntry?.createdAt)} />
                        <DetailField label="Handover By" value={getHandoverByLabel(historyEntry)} />
                        <DetailField label="Handover To" value={getHandoverToLabel(historyEntry)} />
                        <DetailField label="Action" value={historyEntry?.action || '—'} />
                        <DetailField
                            label="Status"
                            value={status.label}
                            valueClassName={`font-bold uppercase ${
                                status.key === 'pending'
                                    ? 'text-red-600'
                                    : status.key === 'accept'
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                            }`}
                        />
                    </DetailGrid>

                    <SectionDivider title="Reason & Notes" />
                    <DetailField
                        label="Reason"
                        value={assignmentReason}
                        valueClassName="font-medium text-gray-700 whitespace-pre-wrap leading-relaxed"
                    />
                    {showSeparateComments ? (
                        <div className="mt-4">
                            <DetailField
                                label="Comments"
                                value={noteComments}
                                valueClassName="font-medium text-gray-700 whitespace-pre-wrap leading-relaxed"
                            />
                        </div>
                    ) : null}
                </FineFormCard>
            </div>

            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard
                    icon={Truck}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    title="Vehicle At Handover"
                    subtitle="Vehicle and assignee snapshot for this event"
                >
                    <DetailGrid>
                        <DetailField label="Vehicle ID" value={snapshot?.assetId || vehicle?.assetId || '—'} />
                        <DetailField label="Plate Number" value={snapshot?.plateNumber || vehicle?.plateNumber || '—'} />
                        <DetailField label="Brand" value={getVehicleBrandLabel(snapshot) || getVehicleBrandLabel(vehicle) || '—'} />
                        <DetailField label="Model Year" value={snapshot?.modelYear || vehicle?.modelYear || '—'} />
                        <DetailField label="Assignee" value={assigneeName || '—'} />
                        <DetailField
                            label="Assignment Type"
                            value={snapshot?.assignmentType || historyEntry?.details?.assignmentType || '—'}
                        />
                        <DetailField
                            label="Acceptance"
                            value={snapshot?.acceptanceStatus || vehicle?.acceptanceStatus || '—'}
                        />
                        <DetailField label="Vehicle Status" value={snapshot?.status || vehicle?.status || '—'} />
                    </DetailGrid>

                    <SectionDivider title="Assignment Timeline" />
                    <DetailGrid>
                        <DetailField
                            label="Assigned Date"
                            value={formatDate(snapshot?.assignedDate || historyEntry?.date)}
                        />
                        <DetailField
                            label="Temporary End"
                            value={formatDate(snapshot?.temporaryEndDate)}
                        />
                    </DetailGrid>
                </FineFormCard>
            </div>
        </div>
    );
}
