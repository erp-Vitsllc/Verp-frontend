'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function CertificateEditModal({ isOpen, onClose, onSuccess, initialData, employees = [] }) {
    const { toast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    // Signer 1 (Reportee) State
    const [signer1Id, setSigner1Id] = useState('');
    const [signer1Name, setSigner1Name] = useState('');
    const [signer1Title, setSigner1Title] = useState('');

    // Signer 2 is STATIC as per request: Raseel Muhammad / CEO

    useEffect(() => {
        if (isOpen && initialData) {
            const existingName = initialData.certSigner1Name || 'Nivil Ali';
            const existingTitle = initialData.certSigner1Title || 'Managing Director';

            setSigner1Name(existingName);
            setSigner1Title(existingTitle);

            // We verify if existing name matches an employee to pre-select dropdown (optional but nice)
            // For now, we just set the text values.
        }
    }, [isOpen, initialData]);

    const handleEmployeeChange = (e) => {
        const empId = e.target.value;
        setSigner1Id(empId);

        if (empId) {
            const emp = employees.find(e => e.employeeId === empId);
            if (emp) {
                setSigner1Name(`${emp.firstName} ${emp.lastName}`);
                setSigner1Title(emp.designation || emp.role || '');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload = {
                ...initialData,
                certSigner1Name: signer1Name,
                certSigner1Title: signer1Title,
                certSigner2Name: 'Raseel Muhammad', // Forced Static
                certSigner2Title: 'CEO'             // Forced Static
            };

            await axiosInstance.put(`/Reward/${initialData._id}`, payload);

            toast({
                title: "Success",
                description: "Certificate details updated successfully"
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Failed to update certificate details"
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[600px] p-6 md:p-8 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Edit Certificate Signers</h3>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Signer 1 Section */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Select Employee</label>
                            <select
                                value={signer1Id}
                                onChange={handleEmployeeChange}
                                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            >
                                <option value="">-- Select Employee --</option>
                                {employees.map(emp => (
                                    <option key={emp.employeeId} value={emp.employeeId}>
                                        {emp.firstName} {emp.lastName} - {emp.designation || 'No Designation'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Name</label>
                                <input
                                    type="text"
                                    value={signer1Name}
                                    onChange={(e) => setSigner1Name(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Designation</label>
                                <input
                                    type="text"
                                    value={signer1Title}
                                    onChange={(e) => setSigner1Title(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Signer 2 Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 opacity-75">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Name</label>
                                <input
                                    type="text"
                                    value="Raseel Muhammad"
                                    disabled
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-100 text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Designation</label>
                                <input
                                    type="text"
                                    value="CEO"
                                    disabled
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-100 text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
