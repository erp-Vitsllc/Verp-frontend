'use client';

import { Fuel, Handshake, Receipt, Wrench, X } from 'lucide-react';
import { navHrefProps } from '@/utils/linkContextMenu';
import { vehicleAccessPath } from '@/app/HRM/Asset/Vehicle/utils/vehicleAccessNav';

const ACCESS_ACTIONS = [
    {
        id: 'service',
        label: 'Access Service',
        hint: 'Service lists across the fleet',
        Icon: Wrench,
    },
    {
        id: 'handover',
        label: 'Access Handover',
        hint: 'Handover status lists',
        Icon: Handshake,
    },
    {
        id: 'fine',
        label: 'Access Vehicle Fine',
        hint: 'Approved and completed vehicle fines',
        Icon: Receipt,
    },
    {
        id: 'fuel',
        label: 'Access Fuel',
        hint: 'Fleet fuel bills for the current month',
        Icon: Fuel,
    },
];

export default function VehicleAccessMenuModal({
    open,
    onClose,
    onSelect,
    activePanel = null,
    pendingServiceCount = 0,
    listHref = '/HRM/Asset/Vehicle',
    showFuel = true,
}) {
    if (!open) return null;

    const actions = showFuel ? ACCESS_ACTIONS : ACCESS_ACTIONS.filter((row) => row.id !== 'fuel');

    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/40">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">
                            Vehicle Details
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Access handover, fine, service, and fuel
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 grid grid-cols-1 gap-3">
                    {actions.map(({ id, label, hint, Icon }) => {
                        const isActive = activePanel === id;
                        const href = vehicleAccessPath(id, listHref);
                        return (
                            <a
                                key={id}
                                href={href}
                                onClick={(event) => {
                                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                                        return;
                                    }
                                    event.preventDefault();
                                    onSelect(id);
                                }}
                                className={`group flex items-start gap-3 rounded-2xl border p-4 text-left no-underline transition-colors ${
                                    isActive
                                        ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                                        : 'border-slate-200 bg-slate-50/70 hover:border-teal-300 hover:bg-teal-50/60'
                                }`}
                                {...navHrefProps(href)}
                            >
                                <span
                                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm shrink-0 ${
                                        isActive
                                            ? 'bg-teal-600 border-teal-600 text-white'
                                            : 'bg-white border-slate-200 text-teal-700'
                                    }`}
                                >
                                    <Icon size={20} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span
                                            className={`block text-sm font-black uppercase tracking-wide ${
                                                isActive ? 'text-teal-900' : 'text-slate-800 group-hover:text-teal-800'
                                            }`}
                                        >
                                            {label}
                                        </span>
                                        {id === 'service' && pendingServiceCount > 0 ? (
                                            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-600 tabular-nums">
                                                {pendingServiceCount}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="block text-xs text-slate-500 mt-1">{hint}</span>
                                </span>
                            </a>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
