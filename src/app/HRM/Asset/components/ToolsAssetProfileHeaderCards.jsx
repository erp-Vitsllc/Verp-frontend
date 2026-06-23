'use client';

import { User } from 'lucide-react';
import { HEADER_PAIR_CARD, HEADER_PAIR_CARD_BODY, HEADER_PAIR_GRID } from '@/utils/headerPairLayout';

const ACTION_BTN_BASE =
    'min-h-[52px] rounded-2xl px-3 py-3 text-[11px] font-black uppercase tracking-wide text-center leading-snug transition-all break-words';

/**
 * Tools asset detail header — reference layout: profile card + blue Asset History action panel.
 */
export default function ToolsAssetProfileHeaderCards({
    asset,
    assetAge,
    warrantyRemaining,
    assignedSince,
    isTerminalAssetStatus,
    isAssetActivelyAssigned,
    isActiveCompanyAllocationUi,
    getAssetDetailsPrimaryStatusLabel,
    isOnServiceFlagActive,
    isOnLeaveFlagActive,
    accessoriesVisibleOnAssetPage = [],
    temporaryAssignmentEndsInfo,
    getAssetApproverDisplayName,
    userHistoryCount = 0,
    serviceHistoryCount = 0,
    primaryActionButtons = [],
    onOpenOtherActions,
    otherActionsCount = 0,
}) {
    const accessoryTotal = (accessoriesVisibleOnAssetPage || []).reduce(
        (sum, acc) => sum + (Number(acc.amount) || 0),
        0,
    );
    const totalValue = (Number(asset?.assetValue) || 0) + accessoryTotal;

    return (
        <div className={`${HEADER_PAIR_GRID} gap-5`}>
            {/* Left — asset summary (reference card) */}
            <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 ${HEADER_PAIR_CARD}`}>
                <div className={`p-4 sm:p-5 flex flex-col ${HEADER_PAIR_CARD_BODY}`}>
                    <div className="flex flex-row gap-5 flex-1 min-h-0">
                        <div className="flex flex-col items-center shrink-0 w-[148px] sm:w-[156px]">
                            <div className="w-full aspect-square max-w-[156px] rounded-2xl bg-sky-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                                {asset?.assetPhoto ? (
                                    <img src={asset.assetPhoto} alt={asset.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-blue-400 font-black text-4xl uppercase">
                                        {asset?.name?.substring(0, 1) || 'A'}
                                    </span>
                                )}
                            </div>
                            <p className="mt-3 text-[13px] font-black text-red-500 tracking-[0.15em] uppercase text-center leading-tight">
                                {asset?.assetId}
                            </p>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col break-words">
                            <h1 className="text-xl sm:text-[22px] font-black text-slate-900 leading-tight tracking-tight mb-2 break-words">
                                {asset?.name}
                            </h1>

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span
                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isTerminalAssetStatus(asset)
                                            ? 'bg-rose-100 text-rose-800'
                                            : asset?.pendingAction
                                                ? 'bg-amber-100 text-amber-800'
                                                : isAssetActivelyAssigned(asset)
                                                    ? 'bg-[#5CD1FF] text-white'
                                                    : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                >
                                    {getAssetDetailsPrimaryStatusLabel(asset)}
                                </span>
                                {isOnServiceFlagActive(asset) && (
                                    <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest">
                                        On Service
                                    </span>
                                )}
                                {isOnLeaveFlagActive(asset) && (
                                    <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-widest">
                                        On Leave
                                    </span>
                                )}
                                <span className="px-3 py-1 rounded-full bg-[#5CD1FF] text-white text-[10px] font-black uppercase tracking-widest">
                                    {assetAge}
                                </span>
                            </div>

                            <p className="text-[13px] font-black text-slate-800 uppercase tracking-wide">
                                {asset?.categoryId?.name || 'Generic category'}
                            </p>
                            <p className="text-[12px] font-semibold text-slate-500 mt-1 leading-relaxed break-words">
                                {asset?.description || 'No description provided'}
                            </p>
                            <p className="text-[14px] font-black text-emerald-700 mt-3">
                                {new Intl.NumberFormat().format(totalValue)} AED
                            </p>
                            <p className="text-[12px] font-bold text-slate-500 mt-1">{warrantyRemaining}</p>

                            {isAssetActivelyAssigned(asset) && (
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                                    <User size={13} className="text-blue-500 shrink-0" />
                                    <span className="truncate">
                                        {isActiveCompanyAllocationUi
                                            ? asset?.assignedCompany?.name
                                            : `${asset?.assignedTo?.firstName || ''} ${asset?.assignedTo?.lastName || ''}`.trim()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[14px] font-black text-slate-900 uppercase tracking-tight truncate">
                                {isTerminalAssetStatus(asset)
                                    ? String(asset?.status || 'Lost')
                                    : isActiveCompanyAllocationUi
                                        ? asset?.assignedCompany?.name || 'Company assigned'
                                        : isAssetActivelyAssigned(asset)
                                            ? `${asset?.assignedTo?.firstName || ''} ${asset?.assignedTo?.lastName || ''}`.trim()
                                            : asset?.pendingAction
                                                ? `Pending — ${asset.pendingAction}`
                                                : 'Unassigned'}
                            </p>
                            <p className="text-[12px] font-bold text-slate-500 mt-1">
                                {isTerminalAssetStatus(asset)
                                    ? 'No longer assigned — see history for prior holders'
                                    : isActiveCompanyAllocationUi || isAssetActivelyAssigned(asset)
                                        ? `Since ${isActiveCompanyAllocationUi && asset?.assignedDate ? assignedSince : assignedSince}`
                                        : asset?.pendingAction
                                            ? 'Awaiting Asset Controller action'
                                            : 'Available for assignment'}
                            </p>
                            {temporaryAssignmentEndsInfo &&
                                (asset?.status === 'Assigned' ||
                                    asset?.acceptanceStatus === 'Accepted' ||
                                    asset?.acceptanceStatus === 'Approved') && (
                                    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                                        <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">
                                            Assignment ends {temporaryAssignmentEndsInfo.endTxt}
                                        </p>
                                        <p className="text-[11px] font-semibold text-amber-900/80 mt-0.5">
                                            {temporaryAssignmentEndsInfo.label}
                                        </p>
                                    </div>
                                )}
                        </div>

                        {(asset?.status === 'Pending' ||
                            asset?.status === 'Draft' ||
                            asset?.acceptanceStatus === 'Pending') && (
                                <div className="px-4 py-2 bg-rose-50 rounded-2xl border border-rose-200 shrink-0">
                                    <span className="text-[11px] font-black text-rose-600 uppercase tracking-wide flex items-center gap-2">
                                        <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                                        {asset?.status === 'Draft' && !asset?.actionRequiredBy
                                            ? 'Waiting for submission'
                                            : `Waiting ${getAssetApproverDisplayName(asset) || (asset?.status === 'Draft' ? 'approval' : 'acknowledgment')}`}
                                    </span>
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* Right — Asset History + actions (reference blue panel) */}
            <div
                className={`rounded-2xl overflow-hidden shadow-md text-white border-2 border-white/30 ${HEADER_PAIR_CARD}`}
                style={{ backgroundColor: '#29b6f6' }}
            >
                <div className={`flex flex-row p-4 sm:p-5 gap-4 sm:gap-5 ${HEADER_PAIR_CARD_BODY}`}>
                    <div className="flex flex-col justify-evenly gap-6 shrink-0 w-[40%] min-w-[130px] py-2">
                        <h3 className="text-[28px] sm:text-[34px] font-black text-white leading-none tracking-tight">
                            Asset History
                        </h3>
                        <div className="flex flex-col gap-6 sm:gap-7">
                            <p className="text-[17px] sm:text-[19px] font-bold text-white leading-snug">
                                Number of User = {userHistoryCount}
                            </p>
                            <p className="text-[17px] sm:text-[19px] font-bold text-white leading-snug">
                                Number of Service = {serviceHistoryCount}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
                        <div className="grid grid-cols-2 gap-3">
                            {primaryActionButtons.map((action) => (
                                <button
                                    key={action.key || action.label}
                                    type="button"
                                    disabled={action.disabled}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!action.disabled) action.onClick?.();
                                    }}
                                    className={`${ACTION_BTN_BASE} ${action.disabled
                                            ? 'opacity-50 cursor-not-allowed bg-slate-200/90 text-slate-500'
                                            : 'hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700'
                                        }`}
                                    style={{
                                        backgroundColor: action.disabled ? undefined : action.bgColor || '#dde5c8',
                                    }}
                                >
                                    {action.loading ? 'Please wait…' : action.displayLabel || action.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={onOpenOtherActions}
                                className={`${ACTION_BTN_BASE} hover:opacity-95 hover:shadow-lg active:scale-[0.98] text-slate-700 bg-[#dde5c8]`}
                            >
                                OTHERS{otherActionsCount > 0 ? ` (${otherActionsCount})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
