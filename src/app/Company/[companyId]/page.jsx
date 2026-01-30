'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { Building, Mail, Phone, Globe, MapPin, Edit2, Plus, FileText, User, ChevronLeft, Calendar, Camera, X, Upload, Check } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
};

export default function CompanyProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const companyId = params.companyId;

    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('basic');
    const [imageError, setImageError] = useState(false);

    // Modal State
    const [modalType, setModalType] = useState(null); // 'tradeLicense' | 'establishmentCard'
    const [modalData, setModalData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

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

    const handleModalOpen = (type) => {
        setModalType(type);
        if (type === 'tradeLicense') {
            setModalData({
                number: company.tradeLicenseNumber || '',
                issueDate: company.tradeLicenseIssueDate ? new Date(company.tradeLicenseIssueDate).toISOString().split('T')[0] : (company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : ''),
                expiryDate: company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toISOString().split('T')[0] : '',
                ownerName: company.tradeLicenseOwnerName || '',
                attachment: company.tradeLicenseAttachment || null
            });
        } else if (type === 'establishmentCard') {
            setModalData({
                number: company.establishmentCardNumber || '',
                issueDate: company.establishmentCardIssueDate ? new Date(company.establishmentCardIssueDate).toISOString().split('T')[0] : (company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : ''),
                expiryDate: company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toISOString().split('T')[0] : '',
                attachment: company.establishmentCardAttachment || null
            });
        } else if (type === 'basicDetails') {
            setModalData({
                companyId: company.companyId || '',
                name: company.name || '',
                email: company.email || '',
                phone: company.phone || '',
                establishedDate: company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : ''
            });
        }
    };

    const handleModalClose = () => {
        setModalType(null);
        setModalData({});
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Verify size/type if needed
        if (file.size > 5 * 1024 * 1024) { // 5MB limit example
            toast({ title: "Error", description: "File too large (max 5MB)", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result;
            try {
                setIsSubmitting(true);
                // Upload immediately to get URL
                const response = await axiosInstance.post(`/Company/${company._id}/upload`, {
                    fileData: base64Data,
                    fileName: file.name,
                    folder: `company-documents/${company.companyId}`
                });

                setModalData(prev => ({
                    ...prev,
                    attachment: response.data.url,
                    fileName: file.name
                }));
                toast({ title: "Success", description: "File uploaded successfully" });
            } catch (error) {
                console.error("Upload error:", error);
                toast({ title: "Error", description: "File upload failed", variant: "destructive" });
            } finally {
                setIsSubmitting(false);
            }
        };
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const payload = {};
            if (modalType === 'tradeLicense') {
                payload.tradeLicenseNumber = modalData.number;
                payload.tradeLicenseIssueDate = modalData.issueDate;
                payload.tradeLicenseExpiry = modalData.expiryDate;
                payload.tradeLicenseOwnerName = modalData.ownerName;
                payload.tradeLicenseAttachment = modalData.attachment;
            } else if (modalType === 'establishmentCard') {
                payload.establishmentCardNumber = modalData.number;
                payload.establishmentCardIssueDate = modalData.issueDate;
                payload.establishmentCardExpiry = modalData.expiryDate;
                payload.establishmentCardAttachment = modalData.attachment;
            } else if (modalType === 'basicDetails') {
                payload.name = modalData.name;
                payload.email = modalData.email;
                payload.phone = modalData.phone;
                payload.establishedDate = modalData.establishedDate;
            }

            await axiosInstance.patch(`/Company/${company._id}`, payload);

            toast({ title: "Success", description: "Details updated successfully" });
            fetchCompany(); // Refresh data
            handleModalClose();
        } catch (error) {
            console.error("Update error:", error);
            toast({ title: "Error", description: "Failed to update details", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

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
            <div className="flex-1 flex flex-col min-w-0 relative">
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
                            <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
                                {/* Details Card */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                                        <h4 className="text-lg font-bold text-slate-800">Basic Details</h4>
                                        <button
                                            onClick={() => handleModalOpen('basicDetails')}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                            <span className="text-sm font-bold text-slate-500">Company ID</span>
                                            <span className="text-sm font-bold text-slate-700">{company.companyId}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                            <span className="text-sm font-bold text-slate-500">Company Name</span>
                                            <span className="text-sm font-bold text-slate-700">{company.name}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                            <span className="text-sm font-bold text-slate-500">Email Address</span>
                                            <span className="text-sm font-bold text-slate-700">{company.email}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                            <span className="text-sm font-bold text-slate-500">Contact Number</span>
                                            <span className="text-sm font-bold text-slate-700">{company.phone || '---'}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                            <span className="text-sm font-bold text-slate-500">Establishment Date</span>
                                            <span className="text-sm font-bold text-slate-700">
                                                {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Trade License Card */}
                                {company.tradeLicenseNumber && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                                            <h4 className="text-lg font-bold text-slate-800">Trade License Details</h4>
                                            <button
                                                onClick={() => handleModalOpen('tradeLicense')}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                <span className="text-sm font-bold text-slate-500">License Number</span>
                                                <span className="text-sm font-bold text-slate-700">{company.tradeLicenseNumber}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                <span className="text-sm font-bold text-slate-500">Issue Date</span>
                                                <span className="text-sm font-bold text-slate-700">
                                                    {company.tradeLicenseIssueDate ? new Date(company.tradeLicenseIssueDate).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                <span className="text-sm font-bold text-slate-500">Expiry Date</span>
                                                <span className="text-sm font-bold text-slate-700">
                                                    {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                <span className="text-sm font-bold text-slate-500">Owner Name</span>
                                                <span className="text-sm font-bold text-slate-700">{company.tradeLicenseOwnerName || '---'}</span>
                                            </div>
                                            {company.tradeLicenseAttachment && (
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                    <span className="text-sm font-bold text-slate-500">Attachment</span>
                                                    <a
                                                        href={company.tradeLicenseAttachment}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> View Document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Document Buttons */}
                                <div className="flex items-center gap-4 pt-2">
                                    {!company.tradeLicenseNumber && (
                                        <button
                                            onClick={() => handleModalOpen('tradeLicense')}
                                            className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                                        >
                                            Trade License <Plus size={16} strokeWidth={3} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleModalOpen('establishmentCard')}
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                                    >
                                        Establishment Card <Plus size={16} strokeWidth={3} />
                                    </button>
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

                {/* Modal Overlay */}
                {modalType && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-bold text-xl text-gray-800">
                                    {modalType === 'basicDetails' ? 'Edit Basic Details' : (modalType === 'tradeLicense' ? 'Trade License Details' : 'Establishment Card Details')}
                                </h3>
                                <button onClick={handleModalClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-8 overflow-y-auto">
                                <form id="documentForm" onSubmit={handleSave} className="space-y-6">
                                    {modalType === 'basicDetails' ? (
                                        <>
                                            {/* Company ID (Read-only) */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">Company ID</label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        value={modalData.companyId}
                                                        disabled
                                                        className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed"
                                                    />
                                                </div>
                                            </div>

                                            {/* Name */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">Company Name <span className="text-red-500">*</span></label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.name}
                                                        onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Email */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">Email <span className="text-red-500">*</span></label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="email"
                                                        required
                                                        value={modalData.email}
                                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Phone */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">Contact Number</label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        value={modalData.phone}
                                                        onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Established Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">Establishment Date</label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        value={modalData.establishedDate}
                                                        onChange={(e) => setModalData({ ...modalData, establishedDate: e.target.value })}
                                                        className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                    />
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Number Field */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    {modalType === 'tradeLicense' ? 'License Number' : 'Card Number'} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.number}
                                                        onChange={(e) => setModalData({ ...modalData, number: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder=""
                                                    />
                                                </div>
                                            </div>

                                            {/* Issue Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Issue Date <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        required
                                                        value={modalData.issueDate}
                                                        onChange={(e) => setModalData({ ...modalData, issueDate: e.target.value })}
                                                        className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                    />
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                                </div>
                                            </div>

                                            {/* Expiry Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Expiry Date <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        required
                                                        value={modalData.expiryDate}
                                                        onChange={(e) => setModalData({ ...modalData, expiryDate: e.target.value })}
                                                        className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                    />
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                                </div>
                                            </div>

                                            {/* Owner Name (Trade License Only) */}
                                            {modalType === 'tradeLicense' && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-bold text-gray-500">
                                                        Owner Name
                                                    </label>
                                                    <div className="w-2/3">
                                                        <input
                                                            type="text"
                                                            value={modalData.ownerName}
                                                            onChange={(e) => setModalData({ ...modalData, ownerName: e.target.value })}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                            placeholder=""
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* File Upload */}
                                            <div className="flex items-start gap-6 pt-2">
                                                <label className="w-1/3 text-sm font-bold text-gray-500 pt-3">
                                                    {modalType === 'tradeLicense' ? 'Trade License Copy' : 'Card Copy'} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3 space-y-3">
                                                    {/* Input Row */}
                                                    <div className="flex items-center gap-3 p-1.5 border border-gray-200 rounded-xl bg-white">
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="px-4 py-2 bg-white border border-blue-100 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                                                        >
                                                            Choose File
                                                        </button>
                                                        <span className="text-sm text-gray-700 font-medium truncate flex-1">
                                                            {modalData.fileName || 'No file chosen'}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            ref={fileInputRef}
                                                            className="hidden"
                                                            onChange={handleFileChange}
                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                        />
                                                    </div>

                                                    {/* Uploaded File Display (Blue Box) */}
                                                    {modalData.attachment && (
                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 animate-in fade-in slide-in-from-top-2">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                                                                    <Check size={12} strokeWidth={3} />
                                                                </div>
                                                                <span className="text-sm font-semibold truncate">
                                                                    {modalData.fileName || 'Document Uploaded'}
                                                                </span>
                                                            </div>
                                                            <a
                                                                href={modalData.attachment}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-bold underline hover:text-blue-800 ml-3 flex-shrink-0"
                                                            >
                                                                View
                                                            </a>
                                                        </div>
                                                    )}

                                                    <p className="text-[11px] text-gray-400 font-medium">Upload file in PDF format only (Max 5MB)</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-end gap-4">
                                <button
                                    onClick={handleModalClose}
                                    className="px-6 py-2.5 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    type="button"
                                >
                                    Cancel
                                </button>
                                <button
                                    form="documentForm"
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? 'Updating...' : 'Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
