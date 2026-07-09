'use client';

import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { EMIRATES, EMIRATE_PLATE_IMAGE } from '../lib/vehiclePlateConfig';

export default function VehicleLocatorAddPlateModal({ isOpen, onClose, onSuccess, vehicle }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [plateEmirate, setPlateEmirate] = useState('Dubai');
    const [plateCode, setPlateCode] = useState('');
    const [plateDigits, setPlateDigits] = useState('');

    useEffect(() => {
        if (!isOpen || !vehicle) return;
        setPlateEmirate(vehicle.plateEmirate || 'Dubai');
        const digits = String(vehicle.plateNumber || '').replace(/\D/g, '');
        setPlateDigits(digits);
        setPlateCode('');
    }, [isOpen, vehicle]);

    if (!isOpen || !vehicle) return null;

    const handleSave = async () => {
        if (!plateDigits.trim()) {
            toast({ variant: 'destructive', title: 'Plate required', description: 'Enter the plate number.' });
            return;
        }

        try {
            setLoading(true);
            const response = await axiosInstance.post(
                '/locator/vehicle-plate',
                {
                    deviceId: vehicle.locator?.deviceId,
                    deviceName: vehicle.locator?.deviceName || vehicle.assetId,
                    erpVehicleId:
                        vehicle._id && !String(vehicle._id).startsWith('locator-')
                            ? vehicle._id
                            : undefined,
                    plateEmirate,
                    plateCode,
                    plateDigits,
                },
                { timeout: 20000, skipToast: true },
            );
            toast({ title: 'Plate saved', description: 'Vehicle plate saved in ERP and linked to Locator GPS.' });
            onSuccess?.({
                _id: response.data?.data?._id,
                assetId: response.data?.data?.assetId,
                plateEmirate: response.data?.data?.plateEmirate,
                plateNumber: response.data?.data?.plateNumber,
            });
            onClose();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Save failed',
                description: error?.response?.data?.message || 'Could not save plate.',
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
                        <h2 className="text-lg font-bold text-slate-800">Add plate</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {vehicle.locator?.deviceName || vehicle.assetId}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Plate number <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <select
                                value={plateEmirate}
                                onChange={(e) => setPlateEmirate(e.target.value)}
                                className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            >
                                {EMIRATES.map((emirate) => (
                                    <option key={emirate.value} value={emirate.value}>
                                        {emirate.value}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={plateCode}
                                onChange={(e) => setPlateCode(e.target.value.toUpperCase())}
                                placeholder="Code"
                                className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm uppercase"
                            />
                            <input
                                value={plateDigits}
                                onChange={(e) => setPlateDigits(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Number"
                                className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            Plate preview
                        </p>
                        {EMIRATE_PLATE_IMAGE[plateEmirate] ? (
                            <div className="relative max-w-sm rounded-xl overflow-hidden border border-slate-200">
                                <img
                                    src={EMIRATE_PLATE_IMAGE[plateEmirate]}
                                    alt={`${plateEmirate} plate`}
                                    className="w-full h-auto block"
                                />
                                {plateCode ? (
                                    <div
                                        className={`absolute left-[6%] ${plateEmirate === 'Dubai' ? 'top-[62%]' : 'top-1/2'} -translate-y-1/2 text-[min(4.5vw,44px)] font-black text-black`}
                                    >
                                        {plateCode}
                                    </div>
                                ) : null}
                                <div className="absolute right-[10%] top-1/2 -translate-y-1/2 text-[min(5.2vw,52px)] font-black text-black">
                                    {plateDigits || '—'}
                                </div>
                            </div>
                        ) : null}
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
                        onClick={handleSave}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60"
                    >
                        <Save size={16} />
                        {loading ? 'Saving…' : 'Save plate'}
                    </button>
                </div>
            </div>
        </div>
    );
}
