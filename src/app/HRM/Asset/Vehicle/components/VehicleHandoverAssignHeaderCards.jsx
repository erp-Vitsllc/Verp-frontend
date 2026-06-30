'use client';

import { Car, User } from 'lucide-react';
import { HEADER_PAIR_CARD_FIXED } from '@/utils/headerPairLayout';
import {
    getHandoverByLabel,
    getHandoverDisplayStatus,
    getHandoverToLabel,
    isVehicleInspectionHandoverEntry,
} from '../utils/vehicleHandoverHistory';
import {
    getEffectiveHandoverStage,
    handoverStageLabel,
} from '../utils/vehicleHandoverAssignActions';
import { inspectionHandoverStageLabel } from '../utils/vehicleInspectionHandoverWorkflow';
import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';
import VehicleHandoverAssignActions from './VehicleHandoverAssignActions';
import VehicleInspectionHandoverActions from './VehicleInspectionHandoverActions';

const COMPACT_BOX =
    'p-2 rounded-lg border flex items-center justify-between px-4 min-h-[44px] transition-all break-words gap-2';

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

function formatPlate(vehicle) {
    const plate = `${vehicle?.plateEmirate || ''} ${vehicle?.plateNumber || ''}`.trim();
    return plate || '—';
}

function buildVehicleSummaryFields(vehicle, historyEntry) {
    return [
        { label: 'Vehicle', value: vehicle?.name || '—', tone: 'bg-blue-50 border-blue-100 text-blue-800' },
        { label: 'Plate', value: formatPlate(vehicle), tone: 'bg-slate-50 border-slate-100 text-slate-800' },
        { label: 'Asset No', value: vehicle?.assetId || '—', tone: 'bg-slate-50 border-slate-100 text-slate-800' },
        {
            label: 'Brand',
            value: getVehicleBrandLabel(vehicle) || '—',
            tone: 'bg-slate-50 border-slate-100 text-slate-800',
        },
        {
            label: 'Handover By',
            value: getHandoverByLabel(historyEntry),
            tone: 'bg-violet-50 border-violet-100 text-violet-800',
        },
        {
            label: 'Handover To',
            value: getHandoverToLabel(historyEntry),
            tone: 'bg-violet-50 border-violet-100 text-violet-800',
        },
    ];
}

export default function VehicleHandoverAssignHeaderCards({
    vehicle,
    historyEntry,
    onVehicleUpdated,
    onHistoryUpdated,
    canApprove = false,
    canReviewInspection = false,
    canSubmitInspectionForHr = false,
    onScrollToAssessment,
}) {
    if (!vehicle || !historyEntry) return null;

    const isInspection = isVehicleInspectionHandoverEntry(historyEntry, vehicle);
    const status = getHandoverDisplayStatus(historyEntry, vehicle);
    const stage = getEffectiveHandoverStage(vehicle, historyEntry);
    const stageLabel = isInspection
        ? inspectionHandoverStageLabel(vehicle, historyEntry)
        : handoverStageLabel(stage, vehicle, historyEntry);

    const statusBoxClass =
        status.key === 'pending'
            ? 'bg-red-50 border-red-100 text-red-700'
            : status.key === 'accepted'
              ? 'bg-amber-50 border-amber-100 text-amber-700'
              : status.key === 'rejected'
                ? 'bg-slate-50 border-slate-100 text-slate-600'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700';

    const vehicleSummaryFields = buildVehicleSummaryFields(vehicle, historyEntry);

    return (
        <div className="flex flex-row gap-6 w-full mb-8 print:hidden items-stretch">
            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                <div className="bg-white rounded-lg shadow-sm p-4 w-full h-full flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 shrink-0 min-h-[26px]">
                        <Car size={18} className="text-slate-500" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {isInspection ? 'Vehicle Inspection' : 'Vehicle Summary'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 flex-1 content-start">
                        {vehicleSummaryFields.map((field) => (
                            <div
                                key={field.label}
                                className={`${COMPACT_BOX} ${field.tone} !items-start !justify-start flex-col gap-1`}
                            >
                                <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                    {field.label}
                                </span>
                                <span className="text-sm font-bold leading-snug">{field.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                <div className="bg-white rounded-lg shadow-sm p-4 w-full h-full flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 shrink-0 min-h-[26px]">
                        <User size={18} className="text-slate-500" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Handover Summary
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 flex-1 content-start">
                        <div className={`${COMPACT_BOX} ${statusBoxClass} !items-start !justify-start gap-1`}>
                            <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                Current Status
                            </span>
                            <span className="text-sm font-bold">{status.label}</span>
                        </div>
                        <div className={`${COMPACT_BOX} bg-slate-50 border-slate-100`}>
                            <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wide truncate">
                                Handover Date
                            </span>
                            <span className="text-sm font-bold text-slate-800 tabular-nums ml-2">
                                {formatDate(historyEntry?.date || historyEntry?.createdAt)}
                            </span>
                        </div>
                        <div className={`${COMPACT_BOX} bg-slate-50 border-slate-100`}>
                            <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wide truncate">
                                Approval Stage
                            </span>
                            <span className="text-sm font-bold text-slate-800 ml-2 truncate">
                                {stageLabel}
                            </span>
                        </div>
                        <div className={`${COMPACT_BOX} bg-gray-50 border-gray-100 text-gray-500`}>
                            <span className="text-[10px] font-medium uppercase tracking-wide truncate">
                                Record ID
                            </span>
                            <span className="text-xs font-bold ml-2 truncate font-mono">
                                {String(historyEntry?._id || '').slice(-8) || '—'}
                            </span>
                        </div>

                        {isInspection ? (
                            <VehicleInspectionHandoverActions
                                vehicle={vehicle}
                                historyEntry={historyEntry}
                                onVehicleUpdated={onVehicleUpdated}
                                onHistoryUpdated={onHistoryUpdated}
                                canReview={canReviewInspection}
                                canSubmitForHr={canSubmitInspectionForHr}
                                className="col-span-2"
                            />
                        ) : (
                            <VehicleHandoverAssignActions
                                vehicle={vehicle}
                                historyEntry={historyEntry}
                                onVehicleUpdated={onVehicleUpdated}
                                onHistoryUpdated={onHistoryUpdated}
                                canApprove={canApprove}
                                onScrollToAssessment={onScrollToAssessment}
                                hideWhenInactive
                                className="col-span-2"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
