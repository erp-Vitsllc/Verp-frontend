'use client';

import { format } from 'date-fns';
import { Check, X, History } from 'lucide-react';

function buildRewardSteps(reward) {
    const type = (reward.rewardType || '').toLowerCase();
    const isCashOrGift = type.includes('cash') || type.includes('gift');
    const steps = [
        { id: 1, label: 'Created', role: 'Created' },
        { id: 2, label: 'Requester', role: 'Requester' },
        { id: 3, label: 'Reportee', role: 'Manager' },
        { id: 4, label: 'Management', role: 'Management' },
    ];
    // Cash/Gift: Accounts after Management (expense + paid-through → Zoho Expense)
    if (isCashOrGift) {
        steps.push({ id: 5, label: 'Accounts', role: 'Accounts' });
        steps.push({ id: 6, label: 'Payment', role: 'Payment' });
    }
    return { steps, isCashOrGift };
}

function getStepMeta(step, reward, employee, workflow, isCashOrGift, currentActive) {
    const isFullyPaid = reward.rewardStatus === 'Approved (Paid)';
    const isRejected = (reward.approvalStatus || reward.rewardStatus) === 'Rejected';
    const isCancelled = (reward.approvalStatus || reward.rewardStatus) === 'Cancelled';
    const isStepCurrent = currentActive === step.id && !isRejected && !isCancelled;

    const isGreen = (() => {
        if (isFullyPaid) return true;
        if (reward.rewardStatus === 'Approved' && step.role !== 'Payment') return true;
        if (step.id === 1) return true;
        if (step.id === 2) return (reward.rewardStatus || '').toLowerCase() !== 'draft';
        if (step.id === 3) return workflow.some((w) => w.role === 'Manager' && w.status === 'Approved');
        if (step.id === 4) {
            return (
                workflow.some(
                    (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
                ) ||
                (isCashOrGift
                    ? ['Pending Accounts', 'Approved', 'Approved (Paid)'].includes(reward.rewardStatus)
                    : ['Approved', 'Approved (Paid)'].includes(reward.rewardStatus))
            );
        }
        if (isCashOrGift && step.id === 5) {
            return (
                workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved') ||
                ['Approved', 'Approved (Paid)'].includes(reward.rewardStatus)
            );
        }
        if (isCashOrGift && step.role === 'Payment') return isFullyPaid;
        return false;
    })();

    const isNextGreen = (() => {
        if (isFullyPaid) return true;
        const nextId = step.id + 1;
        if (nextId === 2) return reward.rewardStatus !== 'Draft';
        if (nextId === 3) return workflow.some((w) => w.role === 'Manager' && w.status === 'Approved');
        if (nextId === 4) {
            return (
                workflow.some(
                    (w) => (w.role === 'Management' || w.role === 'CEO') && w.status === 'Approved'
                ) ||
                (isCashOrGift
                    ? ['Pending Accounts', 'Approved', 'Approved (Paid)'].includes(reward.rewardStatus)
                    : ['Approved', 'Approved (Paid)'].includes(reward.rewardStatus))
            );
        }
        if (isCashOrGift && nextId === 5) {
            return (
                workflow.some((w) => w.role === 'Accounts' && w.status === 'Approved') ||
                ['Approved', 'Approved (Paid)'].includes(reward.rewardStatus)
            );
        }
        if (isCashOrGift && nextId === 6) {
            return ['Approved', 'Approved (Paid)'].includes(reward.rewardStatus);
        }
        return false;
    })();

    let stepName = '';
    if (step.id === 1) stepName = 'System';
    else if (step.id === 2) {
        const creator = reward.createdBy;
        stepName = creator
            ? creator.name ||
              (creator.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : 'Requester')
            : 'Unknown';
    } else if (step.id === 3) {
        const managerStep = workflow.find((w) => w.role === 'Manager');
        if (managerStep?.assignedTo?.firstName) {
            stepName = `${managerStep.assignedTo.firstName} ${managerStep.assignedTo.lastName || ''}`.trim();
        } else if (managerStep?.assignedTo?.name) stepName = managerStep.assignedTo.name;
        else if (employee?.primaryReportee?.firstName) {
            stepName = `${employee.primaryReportee.firstName} ${employee.primaryReportee.lastName || ''}`.trim();
        } else stepName = 'Reportee';
    } else if (step.id === 4) {
        const managementStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
        if (managementStep?.assignedTo?.firstName) {
            stepName = `${managementStep.assignedTo.firstName} ${managementStep.assignedTo.lastName || ''}`.trim();
        } else if (reward.approvedBy) {
            stepName =
                reward.approvedBy.name ||
                (reward.approvedBy.firstName
                    ? `${reward.approvedBy.firstName} ${reward.approvedBy.lastName || ''}`.trim()
                    : '');
        } else if (reward.ceoName && reward.ceoName !== 'Unknown') stepName = reward.ceoName;
        else stepName = 'Management';
    } else if (isCashOrGift && step.id === 5) {
        const accountsStep = workflow.find((w) => w.role === 'Accounts');
        if (accountsStep?.assignedTo?.firstName) {
            stepName = `${accountsStep.assignedTo.firstName} ${accountsStep.assignedTo.lastName || ''}`.trim();
        } else if (accountsStep?.assignedTo?.name) stepName = accountsStep.assignedTo.name;
        else if (reward.accountsHODName && reward.accountsHODName !== 'Unknown') {
            stepName = reward.accountsHODName;
        } else stepName = 'Accounts HOD';
    } else if (isCashOrGift && step.role === 'Payment') {
        stepName = reward.rewardStatus === 'Approved (Paid)' ? 'Paid' : 'Accounts';
    }

    let dateValue = null;
    if (step.id <= 2) dateValue = reward.createdAt;
    else {
        const wfStep = workflow.find((w) => w.role === step.role && w.status === 'Approved');
        dateValue = wfStep?.actionedAt;
    }
    let stepDate = null;
    if (dateValue) {
        try {
            stepDate = format(new Date(dateValue), 'MMM d, yyyy');
        } catch {
            stepDate = null;
        }
    }

    let durationText = null;
    let isLive = false;
    {
        let start = null;
        let end = null;
        if (step.id === 1) {
            start = reward.createdAt;
            if (reward.rewardStatus !== 'Draft') end = reward.updatedAt;
            if (reward.rewardStatus === 'Draft') isLive = true;
        } else if (step.id === 2) {
            start = reward.rewardStatus !== 'Draft' ? reward.updatedAt : reward.createdAt;
            const managerStep = workflow.find((w) => w.role === 'Manager');
            end = managerStep?.actionedAt;
            if (start && !end && currentActive === 3) isLive = true;
        } else if (step.id === 3) {
            const managerStep = workflow.find((w) => w.role === 'Manager');
            start = managerStep?.actionedAt;
            const managementStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
            end = managementStep?.actionedAt;
            if (start && !end && currentActive === 4) isLive = true;
        } else if (step.id === 4 && isCashOrGift) {
            const managementStep = workflow.find((w) => w.role === 'Management' || w.role === 'CEO');
            start = managementStep?.actionedAt;
            const accountsStep = workflow.find((w) => w.role === 'Accounts');
            end = accountsStep?.actionedAt;
            if (start && !end && currentActive === 5) isLive = true;
        } else if (isCashOrGift && step.id === 5) {
            const accountsStep = workflow.find((w) => w.role === 'Accounts');
            start = accountsStep?.actionedAt;
            if (start && reward.rewardStatus === 'Approved') isLive = false;
            end =
                reward.rewardStatus === 'Approved' || reward.rewardStatus === 'Approved (Paid)'
                    ? accountsStep?.actionedAt || reward.approvedDate || reward.updatedAt
                    : null;
        }

        const effectiveEnd = end || (isLive ? new Date() : null);
        if (start && effectiveEnd) {
            const diff = Math.max(0, new Date(effectiveEnd) - new Date(start));
            const totalMinutes = Math.floor(diff / (1000 * 60));
            const days = Math.floor(totalMinutes / (60 * 24));
            const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
            const mins = totalMinutes % 60;
            if (days > 0) durationText = `${days}d ${hours}h`;
            else if (hours > 0) durationText = `${hours}h ${mins}m`;
            else if (mins > 0) durationText = `${mins}m`;
            else durationText = `< 1m`;
        }
    }

    return {
        isGreen,
        isNextGreen,
        isStepCurrent,
        isRejected,
        isCancelled,
        stepName,
        stepDate,
        durationText,
        isLive,
    };
}

/**
 * Reward workflow tracker.
 * @param {'horizontal'|'vertical'} orientation
 */
export default function RewardTrackerPanel({ reward, employee, orientation = 'horizontal', className = '' }) {
    if (!reward) return null;

    const workflow = reward.workflow || [];
    const { steps, isCashOrGift } = buildRewardSteps(reward);
    const internalStatus = reward.approvalStatus || reward.rewardStatus;
    // Cash/Gift: Created→Requester→Reportee→Management→Accounts→Payment
    // Certificate: Created→Requester→Reportee→Management
    const statusMap = {
        Draft: 2,
        Pending: 3,
        'Pending HR': 3,
        'Pending Authorization': 4,
        'Pending Accounts': isCashOrGift ? 5 : 4,
        Approved: isCashOrGift ? 6 : 5,
        'Approved (Paid)': isCashOrGift ? 7 : 5,
    };
    const currentActive = statusMap[internalStatus] || 1;
    const isVertical = orientation === 'vertical';

    return (
        <div
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 w-full h-full print:hidden flex flex-col ${className}`}
        >
            <div className={`flex items-center gap-3 border-b border-gray-100 pb-4 ${isVertical ? 'mb-5' : 'mb-8'}`}>
                <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 shrink-0">
                    <History size={isVertical ? 20 : 24} />
                </div>
                <div className="min-w-0">
                    <h4 className={`font-bold text-gray-800 ${isVertical ? 'text-base' : 'text-lg'}`}>
                        Reward Tracker
                    </h4>
                    <p className="text-xs text-gray-500">Approval workflow progress</p>
                </div>
            </div>

            {isVertical ? (
                <div className="flex flex-col flex-1 min-h-0 pt-1">
                    {steps.map((step, idx) => {
                        const isLast = idx === steps.length - 1;
                        const meta = getStepMeta(
                            step,
                            reward,
                            employee,
                            workflow,
                            isCashOrGift,
                            currentActive
                        );

                        const circle = (
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 z-10 transition-all
                                ${
                                    meta.isGreen
                                        ? 'bg-green-500 text-white shadow-md shadow-green-200'
                                        : 'bg-red-50 text-red-300 border-2 border-red-100'
                                }
                                ${meta.isStepCurrent ? '!bg-white !text-green-600 !border-2 !border-green-500 ring-4 ring-green-50' : ''}
                                ${meta.isRejected && meta.isStepCurrent ? '!bg-white !text-red-600 !border-red-500 !ring-red-50' : ''}
                            `}
                            >
                                {(meta.isRejected || meta.isCancelled) && meta.isStepCurrent ? (
                                    <X size={16} strokeWidth={3} />
                                ) : meta.isGreen ? (
                                    <Check size={16} strokeWidth={3} />
                                ) : (
                                    step.id
                                )}
                            </div>
                        );

                        return (
                            <div key={step.id} className="flex gap-3 min-w-0">
                                <div className="flex flex-col items-center">
                                    {circle}
                                    {!isLast ? (
                                        <div
                                            className={`w-[2px] flex-1 min-h-[28px] my-1 ${
                                                meta.isNextGreen ? 'bg-green-500' : 'bg-red-50'
                                            }`}
                                        />
                                    ) : null}
                                </div>
                                <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                                    <p
                                        className={`text-[10px] font-black uppercase tracking-wide ${
                                            meta.isGreen ? 'text-green-600' : 'text-gray-400'
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    {meta.stepName ? (
                                        <p className="text-xs font-semibold text-gray-700 truncate mt-0.5">
                                            {meta.stepName}
                                        </p>
                                    ) : null}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                        {meta.stepDate ? (
                                            <span className="text-[10px] text-gray-400">{meta.stepDate}</span>
                                        ) : null}
                                        {meta.durationText && !isLast ? (
                                            <span
                                                className={`text-[10px] font-bold uppercase ${
                                                    meta.isLive ? 'text-green-600 animate-pulse' : 'text-gray-400'
                                                }`}
                                            >
                                                {meta.isLive ? '• ' : ''}
                                                {meta.durationText}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex items-center w-full px-2 sm:px-6 pb-14 pt-4 overflow-x-auto">
                    {steps.map((step, idx) => {
                        const isLast = idx === steps.length - 1;
                        const meta = getStepMeta(
                            step,
                            reward,
                            employee,
                            workflow,
                            isCashOrGift,
                            currentActive
                        );

                        return (
                            <div
                                key={step.id}
                                className={`flex items-center ${isLast ? 'flex-none' : 'flex-1'}`}
                            >
                                <div className="relative flex flex-col items-center">
                                    <div
                                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base font-black transition-all duration-500 shadow-[0_4px_10px_rgba(0,0,0,0.15)] z-10
                                        ${
                                            meta.isGreen
                                                ? 'bg-green-500 text-white shadow-md shadow-green-200'
                                                : 'bg-red-50 text-red-300 border-2 border-red-100'
                                        }
                                        ${meta.isStepCurrent ? '!bg-white !text-green-600 !border-2 !border-green-500 shadow-none scale-110 ring-4 ring-green-50' : ''}
                                        ${meta.isRejected && meta.isStepCurrent ? '!bg-white !text-red-600 !border-red-500 !ring-red-50' : ''}
                                    `}
                                    >
                                        {(meta.isRejected || meta.isCancelled) && meta.isStepCurrent ? (
                                            <X size={20} strokeWidth={3} />
                                        ) : meta.isGreen ? (
                                            <Check size={20} strokeWidth={3} />
                                        ) : (
                                            step.id
                                        )}
                                    </div>
                                    <div className="absolute top-[36px] md:top-[44px] flex flex-col items-center min-w-[70px] text-center">
                                        <span
                                            className={`text-[9px] font-black uppercase tracking-[0.05em] mb-0.5 whitespace-nowrap ${
                                                meta.isGreen ? 'text-green-600' : 'text-gray-400'
                                            }`}
                                        >
                                            {step.label}
                                        </span>
                                        {meta.stepName ? (
                                            <span className="text-[8px] md:text-[9px] text-gray-500 font-bold max-w-[65px] truncate leading-tight opacity-80">
                                                {meta.stepName}
                                            </span>
                                        ) : null}
                                        {meta.stepDate ? (
                                            <span className="text-[8px] md:text-[9px] text-gray-400 font-medium max-w-[65px] truncate leading-tight mt-0.5">
                                                {meta.stepDate}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                {!isLast ? (
                                    <div className="flex-1 relative flex items-center">
                                        <div
                                            className={`h-[2px] w-full transition-all duration-500 z-0 shadow-sm ${
                                                meta.isNextGreen ? 'bg-green-500' : 'bg-red-50'
                                            }`}
                                        />
                                        {meta.durationText ? (
                                            <div
                                                className={`absolute left-1/2 -translate-x-1/2 bottom-3 z-20 flex items-center gap-1 ${
                                                    meta.isLive ? 'animate-pulse' : ''
                                                }`}
                                            >
                                                {meta.isLive ? (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                ) : null}
                                                <span
                                                    className={`text-[9px] md:text-[10px] font-black whitespace-nowrap uppercase tracking-tight ${
                                                        meta.isLive ? 'text-green-600' : 'text-gray-500'
                                                    }`}
                                                >
                                                    {meta.durationText}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
