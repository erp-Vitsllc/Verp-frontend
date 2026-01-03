'use client';

import { useState, useEffect } from 'react';
import axiosInstance from '@/utils/axios';

export default function AddDesignationModal({ isOpen, onClose, onDesignationAdded, initialDepartment }) {
    const [name, setName] = useState('');
    const [department, setDepartment] = useState(initialDepartment || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDepartment(initialDepartment || '');
            setName('');
            setError('');
        }
    }, [isOpen, initialDepartment]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Designation name is required');
            return;
        }

        if (!department.trim()) {
            setError('Department is required');
            return;
        }

        try {
            setLoading(true);
            const response = await axiosInstance.post('/Designation', { name: name.trim(), department: department.trim() });

            if (onDesignationAdded) {
                onDesignationAdded(response.data);
            }
            setName('');
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add designation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[500px] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Add Designation</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {/* Display Department as Read-only if passed, or editable if we want (but usually added in context of a department) */}
                    <div className="space-y-1">
                        <label className="text-[14px] font-medium text-[#555555]">
                            Department
                        </label>
                        <input
                            type="text"
                            value={department}
                            readOnly={!!initialDepartment}
                            onChange={(e) => setDepartment(e.target.value)}
                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none ${!initialDepartment ? 'focus:ring-2 focus:ring-blue-500' : 'cursor-not-allowed opacity-70'}`}
                            placeholder="Department Name"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[14px] font-medium text-[#555555]">
                            Designation Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter designation name"
                            className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-red-500 hover:text-red-600 font-semibold text-sm px-4 py-2"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-70 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                'Save'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
