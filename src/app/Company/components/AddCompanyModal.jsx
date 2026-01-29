'use client';

import { useState } from 'react';
import { X, Upload, Building, Mail, Phone, Globe, MapPin, Hash } from 'lucide-react';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';

export default function AddCompanyModal({ isOpen, onClose, onSuccess }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        companyId: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        country: 'UAE',
        registrationNumber: '',
        vatNumber: '',
        logo: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axiosInstance.post('/Company', formData);
            toast({
                title: 'Success',
                description: 'Company added successfully',
            });
            onSuccess();
        } catch (err) {
            console.error('Error adding company:', err);
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to add company',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Add New Company</h2>
                        <p className="text-sm text-gray-500">Enter company detail information</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Company Name */}
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name *</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    required
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g. Acme Corporation"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                                />
                            </div>
                        </div>

                        {/* Company ID */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Company ID *</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    required
                                    name="companyId"
                                    value={formData.companyId}
                                    onChange={handleChange}
                                    placeholder="e.g. VEG-001"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    required
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="e.g. contact@acme.com"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="e.g. +971 50 123 4567"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                                />
                            </div>
                        </div>

                        {/* Website */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    name="website"
                                    value={formData.website}
                                    onChange={handleChange}
                                    placeholder="e.g. www.acme.com"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                                />
                            </div>
                        </div>

                        {/* Registration Number */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Registration No.</label>
                            <input
                                name="registrationNumber"
                                value={formData.registrationNumber}
                                onChange={handleChange}
                                placeholder="e.g. REG-123456"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                            />
                        </div>

                        {/* VAT Number */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">VAT Number</label>
                            <input
                                name="vatNumber"
                                value={formData.vatNumber}
                                onChange={handleChange}
                                placeholder="e.g. 100234567890003"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                            />
                        </div>

                        {/* Address */}
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Office Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="e.g. Business Bay, Dubai"
                                    rows="3"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                                ></textarea>
                            </div>
                        </div>

                        {/* City/Country */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                            <input
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="e.g. Dubai"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                            <input
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                placeholder="e.g. UAE"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-gray-50/50"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-10 flex items-center justify-end gap-4 bg-white sticky bottom-0 py-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : 'Save Company'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
