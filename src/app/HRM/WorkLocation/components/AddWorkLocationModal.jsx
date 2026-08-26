'use client';

import { useState, useEffect } from 'react';
import axiosInstance from '@/utils/axios';

export default function AddWorkLocationModal({ isOpen, onClose, onWorkLocationAdded, initialName = '' }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(String(initialName || '').trim());
            setError('');
        }
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Work location name is required');
            return;
        }

        try {
            setLoading(true);
            const response = await axiosInstance.post('/WorkLocation', { name: name.trim() });
            if (onWorkLocationAdded) onWorkLocationAdded(response.data);
            setName('');
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add work location');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[500px] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Add Work Location</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[14px] font-medium text-[#555555]">
                            Location name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Warehouse, Head Office"
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
                            className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-70"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
