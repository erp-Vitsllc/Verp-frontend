'use client';

import { Car, Settings } from 'lucide-react';
import { HEADER_PAIR_CARD_FIXED } from '@/utils/headerPairLayout';
import { getVehicleBrandLabel } from '../lib/vehicleProfileCompletion';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import { formatVehicleServiceReqNo } from '../utils/vehicleServiceReqNo';
import {
    resolveShopWorkApprovalStageLabel,
    resolveShopWorkHeaderStatus,
} from '../utils/vehicleShopWorkStatus';

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

export default function VehicleBodyWorkDetailHeaderCards({
    vehicle,
    service,
    isDraft = false,
    canRequest = false,
    canEditAssignment = false,
    requesting = false,
    onRequested,
}) {
    if (!vehicle || !service) return null;

    const status = resolveShopWorkHeaderStatus(service, vehicle);
    const stageLabel = resolveShopWorkApprovalStageLabel(service, vehicle);
    const remark = parseVehicleServiceRemark(service) || {};

    const vehicleSummaryFields = [
        { label: 'Vehicle', value: vehicle?.name || '—', tone: 'bg-blue-50 border-blue-100 text-blue-800' },
        { label: 'Plate', value: formatPlate(vehicle), tone: 'bg-slate-50 border-slate-100 text-slate-800' },
        { label: 'Asset No', value: vehicle?.assetId || '—', tone: 'bg-slate-50 border-slate-100 text-slate-800' },
        { label: 'Brand', value: getVehicleBrandLabel(vehicle) || '—', tone: 'bg-slate-50 border-slate-100 text-slate-800' },
    ];

    if (remark.currentKm) {
        vehicleSummaryFields.push({
            label: 'Current KM',
            value: String(remark.currentKm),
            tone: 'bg-slate-50 border-slate-100 text-slate-800',
        });
    }

    return (
        <div className="flex flex-row gap-6 w-full mb-8 print:hidden items-stretch">
            <div className={`flex-1 min-w-0 ${HEADER_PAIR_CARD_FIXED}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 w-full h-full flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 shrink-0 min-h-[26px]">
                        <Car size={18} className="text-slate-500" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Vehicle Summary
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 w-full h-full flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-3 shrink-0 min-h-[26px]">
                        <div className="flex items-center gap-2 min-w-0">
                            <Settings size={18} className="text-slate-500 shrink-0" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Body Work Summary
                            </p>
                        </div>
                        {isDraft && canEditAssignment ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof onRequested === 'function') onRequested();
                                }}
                                disabled={!canRequest || requesting}
                                className="shrink-0 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {requesting ? 'Sending...' : 'Send'}
                            </button>
                        ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 flex-1 content-start">
                        <div className={`${COMPACT_BOX} ${status.boxClass} !items-start !justify-start gap-1`}>
                            <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                                Current Status
                            </span>
                            <span className="text-sm font-bold">{status.label}</span>
                        </div>
                        <div className={`${COMPACT_BOX} bg-slate-50 border-slate-100`}>
                            <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wide truncate">
                                Request Date
                            </span>
                            <span className="text-sm font-bold text-slate-800 tabular-nums ml-2">
                                {formatDate(service?.date || service?.createdAt)}
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
                                {formatVehicleServiceReqNo(service, vehicle)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
