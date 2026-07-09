'use client';

import { useEffect, useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function VehicleLocatorAssignmentFixModal({ isOpen, onClose, onSuccess, vehicle }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    const candidates = vehicle?.matchedEmployees || [];
    const ownerName = vehicle?.locatorOwnerName || '';

    useEffect(() => {
        if (!isOpen) return;
        const list = vehicle?.matchedEmployees || [];
        const firstId = list[0]?._id ? String(list[0]._id) : '';
        setSelectedEmployeeId(firstId);
    }, [isOpen, vehicle?._id, vehicle?.matchedEmployees]);

    if (!isOpen || !ownerName || candidates.length === 0) return null;

    const selectedEmployee = candidates.find((employee) => String(employee._id) === String(selectedEmployeeId));

    const handleAssign = async () => {
        if (!selectedEmployee?._id) {
            toast({
                variant: 'destructive',
                title: 'Select employee',
                description: 'Choose the correct employee for this Locator owner.',
            });
            return;
        }

        try {
            setLoading(true);
            await axiosInstance.post('/locator/fix-assignment', {
                vehicleId: vehicle.isLocatorOnly ? undefined : vehicle._id,
                employeeId: selectedEmployee._id,
                deviceId: vehicle.locator?.deviceId,
                deviceName: vehicle.locator?.deviceName || vehicle.assetId,
            });
            toast({
                title: 'Assignment updated',
                description: `${vehicle.locator?.deviceName || 'Vehicle'} assigned to ${selectedEmployee.displayName}.`,
            });
            onSuccess?.();
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Assignment failed',
                description: error?.response?.data?.message || 'Could not update assignment.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Select Locator owner</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {vehicle.locator?.deviceName || vehicle.assetId}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-600">
                        Locator owner name: <strong className="text-slate-900">{ownerName}</strong>
                    </p>
                    <p className="text-xs text-slate-500">
                        {candidates.length === 1
                            ? '1 matching employee found. Confirm or choose another if needed.'
                            : `${candidates.length} matching employees found. Select the correct owner.`}
                    </p>

                    <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-slate-200 p-2">
                        {candidates.map((employee) => {
                            const id = String(employee._id);
                            const isSelected = id === String(selectedEmployeeId);

                            return (
                                <label
                                    key={id}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                                        isSelected ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="locator-owner-employee"
                                        value={id}
                                        checked={isSelected}
                                        onChange={() => setSelectedEmployeeId(id)}
                                        className="accent-red-600"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                            {employee.displayName}
                                        </p>
                                        {employee.employeeId ? (
                                            <p className="text-[11px] text-slate-500">{employee.employeeId}</p>
                                        ) : null}
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleAssign}
                        disabled={loading || !selectedEmployeeId}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                        <UserCheck size={16} />
                        {loading ? 'Assigning…' : 'OK — Assign'}
                    </button>
                </div>
            </div>
        </div>
    );
}
