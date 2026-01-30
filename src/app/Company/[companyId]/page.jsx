'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { Building, Mail, Phone, Globe, MapPin, Edit2, Plus, FileText, User, ChevronLeft, Calendar, Camera } from 'lucide-react';
import Image from 'next/image';

const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
};

export default function CompanyProfilePage() {
    const params = useParams();
    const router = useRouter();
    const companyId = params.companyId;

    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('basic');
    const [imageError, setImageError] = useState(false);

    const fetchCompany = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/Company/${companyId}`);
            setCompany(response.data.company);
        } catch (err) {
            console.error('Error fetching company:', err);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        if (companyId) fetchCompany();
    }, [fetchCompany, companyId]);

    if (loading) {
        return (
            <div className="flex min-h-screen bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="flex min-h-screen bg-[#F2F6F9]">
                <Sidebar />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-gray-500 font-medium">Company not found</div>
                </div>
            </div>
        );
    }

    const statusItems = [
        { text: `Company ID: ${company.companyId}`, color: 'bg-white' },
        { text: `Status: ${company.status || 'Active'}`, color: 'bg-emerald-400' },
        { text: `VAT: ${company.vatNumber || 'Verified'}`, color: 'bg-blue-300' },
        { text: `Established: ${company.establishedDate ? new Date(company.establishedDate).toLocaleDateString() : 'N/A'}`, color: 'bg-sky-200' }
    ];

    return (
        <div className="flex min-h-screen w-full bg-[#F2F6F9]">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <div className="p-8">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => router.push('/Company')}
                            className="bg-white p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <button className="bg-white px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all flex items-center gap-2">
                                <Edit2 size={16} className="text-gray-400" />
                                Edit Profile
                            </button>
                            <button className="bg-green-600 px-5 py-2.5 rounded-xl text-white text-sm font-bold hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-500/25">
                                <Plus size={18} />
                                Add Record
                            </button>
                        </div>
                    </div>

                    {/* Header Grid (Equal Width) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Profile Card (Left - col-span-1) */}
                        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-6 flex flex-col items-start gap-4 relative h-full">
                            <div className="flex items-start gap-6 w-full">
                                {/* Logo Section */}
                                <div className="relative group flex-shrink-0">
                                    <div className="w-32 h-36 rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-blue-500 relative">
                                        {company.logo && !imageError ? (
                                            <Image
                                                src={company.logo}
                                                alt={company.name}
                                                fill
                                                className="object-cover"
                                                onError={() => setImageError(true)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-semibold">
                                                {getInitials(company.name)}
                                            </div>
                                        )}
                                    </div>
                                    <button className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10 border-2 border-white">
                                        <Camera size={14} />
                                    </button>
                                </div>

                                {/* Name Section */}
                                <div className="flex-1 pt-2">
                                    <h1 className="text-2xl font-bold text-gray-800 leading-tight mb-1">{company.name}</h1>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider">
                                        Registered Company
                                    </span>
                                </div>
                            </div>

                            <div className="w-full space-y-2 mt-2 pt-4 border-t border-gray-100/50">
                                <div className="flex items-center gap-2 text-gray-600 text-[13px]">
                                    <Mail size={14} className="text-blue-500 flex-shrink-0" />
                                    <span className="truncate">{company.email}</span>
                                </div>
                                {company.phone && (
                                    <div className="flex items-center gap-2 text-gray-600 text-[13px]">
                                        <Phone size={14} className="text-blue-500 flex-shrink-0" />
                                        <span>{company.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Card (Right - col-span-1) */}
                        <div className="lg:col-span-1 relative rounded-lg overflow-hidden shadow-sm text-white flex flex-col h-full min-h-[300px]">
                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400"></div>
                            <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>
                            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>

                            <div className="relative p-8 flex-1 flex flex-col">
                                <h2 className="text-2xl font-semibold text-white mb-6">Company Summary</h2>
                                <div className="flex items-start gap-12 flex-1">
                                    {/* Icon Image */}
                                    <div className="relative flex-shrink-0 w-[114px] h-[177px]">
                                        <Image
                                            src="/assets/employee/tie-img.png"
                                            alt="Company Summary"
                                            width={114}
                                            height={177}
                                            className="object-contain"
                                        />
                                    </div>

                                    {/* Status List */}
                                    <div className="flex-1 space-y-3 pt-2">
                                        {statusItems.map((item, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <div className={`w-5 h-2 rounded-full ${item.color} shadow-sm`} />
                                                <p className="text-white text-sm font-medium">{item.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation (Matched to Employee Profile) */}
                    <div className="flex items-center gap-8 mb-6 border-b border-gray-200 px-6">
                        <button
                            onClick={() => setActiveTab('basic')}
                            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'basic' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Basic Details
                            {activeTab === 'basic' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>
                        <button
                            onClick={() => setActiveTab('owner')}
                            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'owner' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Owner Information
                            {activeTab === 'owner' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'documents' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Other Documents
                            {activeTab === 'documents' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>

                        <div className="flex-1" />

                        <div className="mb-3 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-md flex items-center gap-2 shadow-sm cursor-pointer transition-colors">
                            Add More
                            <ChevronLeft size={16} className="rotate-270" />
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="bg-transparent min-h-[400px]">
                        {activeTab === 'basic' && (
                            <div className="bg-white rounded-lg shadow-sm p-8 animate-in fade-in duration-500">
                                <h4 className="text-lg font-bold text-gray-800 mb-8 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-blue-500 rounded-full" />
                                    General Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Legal Company Name</label>
                                        <div className="text-sm font-semibold text-gray-700">{company.name}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Company ID</label>
                                        <div className="text-sm font-bold text-blue-600">{company.companyId}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Establishment Date</label>
                                        <div className="text-sm font-semibold text-gray-700">
                                            {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Email Address</label>
                                        <div className="text-sm font-semibold text-gray-700">{company.email}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Contact Number</label>
                                        <div className="text-sm font-semibold text-gray-700">{company.phone || '---'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Website</label>
                                        <div className="text-sm font-semibold text-blue-500 hover:underline cursor-pointer">{company.website || '---'}</div>
                                    </div>
                                    <div className="col-span-full md:col-span-2 space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Registered Address</label>
                                        <div className="text-sm font-semibold text-gray-700 leading-relaxed">
                                            {company.address || '---'}
                                            {(company.city || company.state || company.country) && (
                                                <div className="mt-1 text-gray-500">
                                                    {[company.city, company.state, company.country].filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'owner' && (
                            <div className="bg-white rounded-lg shadow-sm p-8 animate-in fade-in duration-500 flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 border border-gray-100">
                                    <User size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-gray-700">No Owner Records</h4>
                                <p className="text-sm text-gray-400 max-w-xs">Ownership and stakeholder information has not been added yet.</p>
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="bg-white rounded-lg shadow-sm p-8 animate-in fade-in duration-500">
                                <div className="flex items-center justify-between mb-8">
                                    <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-blue-500 rounded-full" />
                                        Compliance Documents
                                    </h4>
                                    <button className="text-blue-600 text-sm font-bold hover:underline">View All</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="border border-dashed border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center text-center group hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer">
                                        <FileText className="text-gray-300 group-hover:text-blue-500 transition-all mb-4" size={40} />
                                        <span className="text-sm font-bold text-gray-400 group-hover:text-blue-600">No Corporate Documents Uploaded</span>
                                        <p className="text-[11px] text-gray-400 mt-2">Upload Trade License, VAT Certs, etc.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
