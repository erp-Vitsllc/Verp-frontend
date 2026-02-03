'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { Building, Mail, Phone, Globe, MapPin, Edit2, Plus, FileText, User, ChevronLeft, ChevronRight, Calendar, Camera, X, Upload, Check, RotateCcw, Download, ChevronDown } from 'lucide-react';
import { Country } from 'country-state-city';
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
    const [activeOwnerTabIndex, setActiveOwnerTabIndex] = useState(0);
    const [imageError, setImageError] = useState(false);

    // Modal State
    const [modalType, setModalType] = useState(null); // 'tradeLicense' | 'establishmentCard' | 'companyDocument'
    const [modalData, setModalData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [visaDropdownOpen, setVisaDropdownOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [viewingDocument, setViewingDocument] = useState(null);
    const fileInputRef = useRef(null);
    const visaDropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (visaDropdownRef.current && !visaDropdownRef.current.contains(event.target)) {
                setVisaDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                owners: company.owners && company.owners.length > 0 ? [...company.owners] : [{ name: company.tradeLicenseOwnerName || '', sharePercentage: '', attachment: '' }],
                attachment: company.tradeLicenseAttachment || null
            });
        } else if (type === 'establishmentCard') {
            setModalData({
                companyName: company.name || '',
                expiryDate: company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toISOString().split('T')[0] : '',
                attachment: company.establishmentCardAttachment || null
            });
        } else if (type === 'basicDetails') {
            setModalData({
                companyId: company.companyId || '',
                name: company.name || '',
                email: company.email || '',
                phone: company.phone || '',
                establishedDate: company.establishedDate ? new Date(company.establishedDate).toISOString().split('T')[0] : '',
                expiryDate: company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toISOString().split('T')[0] : ''
            });
        } else if (['ownerPassport', 'ownerVisa', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense', 'ownerLabourCard'].includes(type)) {
            const owner = company.owners[activeOwnerTabIndex];
            const fieldMap = {
                ownerPassport: 'passport',
                ownerVisa: 'visa',
                ownerEmiratesId: 'emiratesId',
                ownerMedical: 'medical',
                ownerDrivingLicense: 'drivingLicense',
                ownerLabourCard: 'labourCard'
            };
            const docField = fieldMap[type];
            const docData = owner[docField] || {};
            setModalData({
                number: docData.number || '',
                nationality: docData.nationality || '',
                type: docData.type || '',
                issueDate: docData.issueDate ? new Date(docData.issueDate).toISOString().split('T')[0] : '',
                placeOfIssue: docData.placeOfIssue || '',
                countryOfIssue: docData.countryOfIssue || '',
                sponsor: docData.sponsor || '',
                lastUpdated: docData.lastUpdated ? new Date(docData.lastUpdated).toISOString().split('T')[0] : '',
                expiryDate: docData.expiryDate ? new Date(docData.expiryDate).toISOString().split('T')[0] : '',
            });
        } else if (type === 'companyDocument') {
            const doc = company.documents?.[editingIndex] || {};
            setModalData({
                type: doc.type || '',
                description: doc.description || '',
                expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
                attachment: doc.document?.url || null,
                fileName: doc.document?.name || ''
            });
        }
    };

    const handleModalClose = () => {
        setModalType(null);
        setModalData({});
        setEditingIndex(null);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: "Error", description: "File size exceeds 5MB limit", variant: "destructive" });
            return;
        }

        try {
            setIsSubmitting(true);

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result;

                try {
                    const response = await axiosInstance.post(`/Company/${company._id}/upload`, {
                        fileData: base64Data,
                        fileName: file.name,
                        folder: `company-documents/${company.companyId}`
                    });

                    setModalData(prev => ({
                        ...prev,
                        attachment: response.data.url,
                        publicId: response.data.key,
                        fileName: file.name,
                        mimeType: file.type
                    }));

                    toast({ title: "Success", description: "File uploaded successfully" });
                } catch (error) {
                    console.error('Error uploading file:', error);
                    toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
                } finally {
                    setIsSubmitting(false);
                }
            };
            reader.onerror = () => {
                toast({ title: "Error", description: "Failed to read file", variant: "destructive" });
                setIsSubmitting(false);
            };
        } catch (error) {
            console.error('File operation error:', error);
            setIsSubmitting(false);
        }
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
                payload.owners = modalData.owners;
                payload.tradeLicenseAttachment = modalData.attachment;
                if (modalData.owners && modalData.owners.length > 0) {
                    payload.tradeLicenseOwnerName = modalData.owners[0].name;
                }
            } else if (modalType === 'establishmentCard') {
                payload.name = modalData.companyName;
                payload.tradeLicenseExpiry = modalData.expiryDate;
                payload.establishmentCardExpiry = modalData.expiryDate;
                payload.establishmentCardAttachment = modalData.attachment;
            } else if (modalType === 'basicDetails') {
                payload.name = modalData.name;
                payload.email = modalData.email;
                payload.phone = modalData.phone;
                payload.establishedDate = modalData.establishedDate;
                payload.tradeLicenseExpiry = modalData.expiryDate;
            } else if (['ownerPassport', 'ownerVisa', 'ownerEmiratesId', 'ownerMedical', 'ownerDrivingLicense', 'ownerLabourCard'].includes(modalType)) {
                const fieldMap = {
                    ownerPassport: 'passport',
                    ownerVisa: 'visa',
                    ownerEmiratesId: 'emiratesId',
                    ownerMedical: 'medical',
                    ownerDrivingLicense: 'drivingLicense',
                    ownerLabourCard: 'labourCard'
                };
                const docField = fieldMap[modalType];
                const updatedOwners = [...company.owners];
                updatedOwners[activeOwnerTabIndex] = {
                    ...updatedOwners[activeOwnerTabIndex],
                    [docField]: {
                        provider: modalData.provider,
                        number: modalData.number,
                        nationality: modalData.nationality,
                        type: modalData.type,
                        issueDate: modalData.issueDate,
                        placeOfIssue: modalData.placeOfIssue,
                        countryOfIssue: modalData.countryOfIssue,
                        sponsor: modalData.sponsor,
                        lastUpdated: modalData.lastUpdated,
                        expiryDate: modalData.expiryDate,
                        attachment: modalData.attachment
                    }
                };
                payload.owners = updatedOwners;
            } else if (modalType === 'companyDocument') {
                const newDoc = {
                    type: modalData.type,
                    description: modalData.description,
                    expiryDate: modalData.expiryDate,
                    document: {
                        url: modalData.attachment,
                        name: modalData.fileName,
                        mimeType: modalData.mimeType || 'application/pdf'
                    }
                };
                const updatedDocs = [...(company.documents || [])];
                if (editingIndex !== null) {
                    updatedDocs[editingIndex] = newDoc;
                } else {
                    updatedDocs.push(newDoc);
                }
                payload.documents = updatedDocs;
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

    const handleAddOwner = () => {
        setModalData(prev => ({
            ...prev,
            owners: [...(prev.owners || []), { name: '', sharePercentage: '', attachment: '' }]
        }));
    };

    const handleRemoveOwner = (index) => {
        setModalData(prev => ({
            ...prev,
            owners: prev.owners.filter((_, i) => i !== index)
        }));
    };

    const handleOwnerChange = (index, field, value) => {
        setModalData(prev => {
            const newOwners = [...prev.owners];
            newOwners[index] = { ...newOwners[index], [field]: value };
            return { ...prev, owners: newOwners };
        });
    };

    const handleDeleteDocument = async (index) => {
        try {
            if (!confirm('Are you sure you want to delete this document?')) return;
            const updatedDocs = company.documents.filter((_, i) => i !== index);
            await axiosInstance.patch(`/Company/${company._id}`, { documents: updatedDocs });
            toast({ title: "Success", description: "Document deleted successfully" });
            fetchCompany();
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
        }
    };



    const formatDate = (dateString) => {
        if (!dateString) return '---';
        return new Date(dateString).toLocaleDateString('en-GB');
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
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'owner' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Owner Information
                            {activeTab === 'owner' ? (
                                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                            ) : null}
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'documents' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500 w-full"                                                                                                                                                               >
                                {/* Details Card */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                                    <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                                        <h4 className="text-xl font-semibold text-gray-800">Basic Details</h4>
                                        <button
                                            onClick={() => handleModalOpen('basicDetails')}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-sm font-medium text-gray-500">Company ID</span>
                                            <span className="text-sm font-medium text-gray-500">{company.companyId}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-sm font-medium text-gray-500">Company Name</span>
                                            <span className="text-sm font-medium text-gray-500">{company.name}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-sm font-medium text-gray-500">Email Address</span>
                                            <span className="text-sm font-medium text-gray-500">{company.email}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-sm font-medium text-gray-500">Contact Number</span>
                                            <span className="text-sm font-medium text-gray-500">{company.phone || '---'}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-sm font-medium text-gray-500">Establishment Date</span>
                                            <span className="text-sm font-medium text-gray-500">
                                                {company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : '---'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                                            <span className="text-sm font-medium text-gray-500">
                                                {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Trade License Card */}
                                {company.tradeLicenseNumber && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                                        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                                            <h4 className="text-xl font-semibold text-gray-800">Trade License Details</h4>
                                            <button
                                                onClick={() => handleModalOpen('tradeLicense')}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">License Number</span>
                                                <span className="text-sm font-medium text-gray-500">{company.tradeLicenseNumber}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Issue Date</span>
                                                <span className="text-sm font-medium text-gray-500">
                                                    {company.tradeLicenseIssueDate ? new Date(company.tradeLicenseIssueDate).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                                                <span className="text-sm font-medium text-gray-500">
                                                    {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            <div className="px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                <span className="text-sm font-bold text-slate-500 block mb-2">Owners</span>
                                                <div className="space-y-2">
                                                    {company.owners && company.owners.length > 0 ? (
                                                        company.owners.map((owner, idx) => (
                                                            <div key={idx} className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-gray-700">{owner.name}</span>
                                                                <span className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                                                    {owner.sharePercentage || '0'}%
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm font-medium text-gray-700">{company.tradeLicenseOwnerName || '---'}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {company.tradeLicenseAttachment && (
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">Attachment</span>
                                                    <a
                                                        href={company.tradeLicenseAttachment}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> View Document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Establishment Card */}
                                {(company.establishmentCardExpiry || company.establishmentCardAttachment) && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                                        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
                                            <h4 className="text-xl font-semibold text-gray-800">Establishment Card Details</h4>
                                            <button
                                                onClick={() => handleModalOpen('establishmentCard')}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Company Name</span>
                                                <span className="text-sm font-medium text-gray-500">{company.name}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                                                <span className="text-sm font-medium text-gray-500">
                                                    {company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            {company.establishmentCardAttachment && (
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">Attachment</span>
                                                    <a
                                                        href={company.establishmentCardAttachment}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> View Document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Document Buttons */}
                                <div className="lg:col-span-2 flex items-center gap-4 pt-2">
                                    {!company.tradeLicenseNumber && (
                                        <button
                                            onClick={() => handleModalOpen('tradeLicense')}
                                            className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                                        >
                                            Trade License <Plus size={16} strokeWidth={3} />
                                        </button>
                                    )}
                                    {!(company.establishmentCardExpiry || company.establishmentCardAttachment) && (
                                        <button
                                            onClick={() => handleModalOpen('establishmentCard')}
                                            className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                                        >
                                            Establishment Card <Plus size={16} strokeWidth={3} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'owner' && (
                            <div className="animate-in fade-in duration-500 space-y-6">
                                {company.owners && company.owners.length > 0 ? (
                                    <>
                                        {/* Owner Sub-tabs Header */}
                                        <div className="flex items-center justify-between gap-4 pb-2 border-b border-gray-100">
                                            <div className="flex flex-wrap gap-8">
                                                {company.owners.map((owner, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => setActiveOwnerTabIndex(index)}
                                                        className={`pb-3 text-sm font-semibold tracking-tight transition-all relative ${activeOwnerTabIndex === index
                                                            ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                                            : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                    >
                                                        {owner.name || `Owner ${index + 1}`}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => handleModalOpen('tradeLicense')}
                                                className="bg-[#00B894] hover:bg-[#00A383] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
                                            >
                                                Add More <ChevronDown size={16} />
                                            </button>
                                        </div>

                                        {/* Owner Details Layout */}
                                        <div className="pt-6 space-y-8">
                                            {/* Top Grid: Personal Details and Filled Cards */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                                {/* Card 1: Personal Details (Always First) */}
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                                                        <h4 className="text-xl font-semibold text-gray-800">Owner Details</h4>
                                                        <button
                                                            onClick={() => handleModalOpen('tradeLicense')}
                                                            className="text-blue-500 hover:text-blue-600 transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </div>
                                                    <div className="p-8 space-y-0">
                                                        {[
                                                            { label: 'Full Name', value: company.owners[activeOwnerTabIndex]?.name },
                                                            { label: 'Email Address', value: company.email, lowercase: true },
                                                            { label: 'Contact Number', value: company.phone },
                                                            { label: 'Share Percentage', value: company.owners[activeOwnerTabIndex]?.sharePercentage ? `${company.owners[activeOwnerTabIndex].sharePercentage}%` : null },
                                                        ].map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 px-2 -mx-2 rounded-lg transition-colors">
                                                                <span className="text-sm font-medium text-gray-500">{item.label}</span>
                                                                <span className={`text-sm font-medium text-gray-500 ${item.lowercase ? 'lowercase' : ''}`}>{item.value || '---'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Map through docs and show cards if filled */}
                                                {[
                                                    { id: 'passport', label: 'Passport', fields: [{ key: 'number', label: 'Number' }, { key: 'nationality', label: 'Nationality' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Expiry date', isDate: true }, { key: 'countryOfIssue', label: 'Country of issue' }], modal: 'ownerPassport' },
                                                    { id: 'visa', label: 'Visa', fields: [{ key: 'type', label: 'Visa Type' }, { key: 'number', label: 'Number' }, { key: 'issueDate', label: 'Issue date', isDate: true }, { key: 'expiryDate', label: 'Date of Expiry', isDate: true }, { key: 'sponsor', label: 'Sponsor' }], modal: 'ownerVisa' },
                                                    { id: 'labourCard', label: 'Labour Card', fields: [{ key: 'number', label: 'Number' }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }, { key: 'lastUpdated', label: 'Last Updated', isDate: true }], modal: 'ownerLabourCard' },
                                                    { id: 'emiratesId', label: 'Emirates ID', fields: [{ key: 'number', label: 'Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerEmiratesId' },
                                                    { id: 'medical', label: 'Medical Insurance', fields: [{ key: 'provider', label: 'Provider' }, { key: 'number', label: 'Policy Number' }, { key: 'issueDate', label: 'Issue Date', isDate: true }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerMedical' },
                                                    { id: 'drivingLicense', label: 'Driving License', fields: [{ key: 'number', label: 'Number' }, { key: 'expiryDate', label: 'Expiry Date', isDate: true }], modal: 'ownerDrivingLicense' }
                                                ].filter(doc => company.owners[activeOwnerTabIndex]?.[doc.id]?.number).map((doc, idx) => (
                                                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/20">
                                                            <h4 className="text-sm font-semibold text-gray-800">{doc.label}</h4>
                                                            <div className="flex items-center gap-1.5">
                                                                <button onClick={() => handleModalOpen(doc.modal)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={14} /></button>
                                                                <button className="p-1.5 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"><RotateCcw size={14} /></button>
                                                                {company.owners[activeOwnerTabIndex]?.[doc.id]?.attachment ? (
                                                                    <a href={company.owners[activeOwnerTabIndex][doc.id].attachment} target="_blank" rel="noopener noreferrer" className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                                                                        <Download size={14} />
                                                                    </a>
                                                                ) : (
                                                                    <button className="p-1.5 text-gray-300 cursor-not-allowed"><Download size={14} /></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="p-6 space-y-5">
                                                            {doc.fields.map((field, fIdx) => (
                                                                <div key={fIdx} className="flex justify-between items-center group">
                                                                    <span className="text-sm font-medium text-gray-500">{field.label}</span>
                                                                    <span className="text-sm font-medium text-gray-500">
                                                                        {field.isDate
                                                                            ? (company.owners[activeOwnerTabIndex]?.[doc.id]?.[field.key]
                                                                                ? new Date(company.owners[activeOwnerTabIndex][doc.id][field.key]).toLocaleDateString('en-GB')
                                                                                : '---')
                                                                            : (company.owners[activeOwnerTabIndex]?.[doc.id]?.[field.key] || '---')
                                                                        }
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Bottom Row: Missing Documents Buttons */}
                                            <div className="flex flex-wrap gap-4 pt-4">
                                                {[
                                                    { id: 'passport', label: 'Passport', modal: 'ownerPassport' },
                                                    { id: 'visa', label: 'Visa', isDropdown: true },
                                                    { id: 'labourCard', label: 'Labour Card', modal: 'ownerLabourCard' },
                                                    { id: 'emiratesId', label: 'Emirates ID', modal: 'ownerEmiratesId' },
                                                    { id: 'medical', label: 'Medical Insurance', modal: 'ownerMedical' },
                                                    { id: 'drivingLicense', label: 'Driving License', modal: 'ownerDrivingLicense' }
                                                ].filter(doc => !company.owners[activeOwnerTabIndex]?.[doc.id]?.number).map((btn, idx) => (
                                                    <div key={idx} className="relative" ref={btn.isDropdown ? visaDropdownRef : null}>
                                                        <button
                                                            onClick={() => btn.isDropdown ? setVisaDropdownOpen(!visaDropdownOpen) : handleModalOpen(btn.modal)}
                                                            className="bg-[#00B894] hover:bg-[#00A383] text-white px-6 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"
                                                        >
                                                            {btn.label} <Plus size={16} strokeWidth={3} />
                                                        </button>
                                                        {btn.isDropdown && visaDropdownOpen && (
                                                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                                {['Visit', 'Employment', 'Spouse'].map((type) => (
                                                                    <button
                                                                        key={type}
                                                                        onClick={() => {
                                                                            setModalData({ ...modalData, type: type });
                                                                            setModalType('ownerVisa');
                                                                            setVisaDropdownOpen(false);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                    >
                                                                        {type} Visa
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center py-24 text-center border border-gray-100">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 border border-gray-100">
                                            <User size={32} />
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-700">No Owner Records Found</h4>
                                        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">Ownership and stakeholder information has not been added to the trade license yet.</p>
                                        <button
                                            onClick={() => handleModalOpen('tradeLicense')}
                                            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                                        >
                                            Add Owner Info
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in duration-500 min-h-[400px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-semibold text-gray-800">Additional Documents</h3>
                                    <button
                                        onClick={() => handleModalOpen('companyDocument')}
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                                    >
                                        <Plus size={16} /> Add Document
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full border-separate border-spacing-y-2">
                                        <thead>
                                            <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                <th className="px-6 py-3">Document Type</th>
                                                <th className="px-6 py-3">Description</th>
                                                <th className="px-6 py-3">Expiry Date</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {company.documents && company.documents.length > 0 ? (
                                                company.documents.map((doc, idx) => (
                                                    <tr key={idx} className="bg-white hover:bg-gray-50/50 transition-colors shadow-sm ring-1 ring-gray-100 rounded-xl group/row">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                                                    <FileText size={20} />
                                                                </div>
                                                                <span className="font-semibold text-gray-700">{doc.type}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">
                                                            {doc.description || '---'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                            {formatDate(doc.expiryDate)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                {doc.document?.url && (
                                                                    <a
                                                                        href={doc.document.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                    >
                                                                        <Download size={16} />
                                                                    </a>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingIndex(idx);
                                                                        handleModalOpen('companyDocument');
                                                                    }}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteDocument(idx)}
                                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                                                <Upload size={32} />
                                                            </div>
                                                            <h4 className="text-gray-500 font-medium">No documents uploaded yet</h4>
                                                            <p className="text-sm text-gray-400">Keep all your company records in one safe place.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}


                    </div>
                </div>

                {/* Modal Overlay */}
                {modalType && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className={`px-8 py-6 border-b border-gray-100 flex items-center ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'justify-center relative' : 'justify-between'} flex-shrink-0`}>
                                <div className={`flex flex-col ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'items-center' : ''}`}>
                                    <h3 className="font-semibold text-xl text-gray-800 tracking-tight">
                                        {modalType === 'basicDetails' ? 'Edit Basic Details' :
                                            modalType === 'tradeLicense' ? 'Trade License Details' :
                                                modalType === 'establishmentCard' ? 'Establishment Card Details' :
                                                    modalType === 'ownerPassport' ? 'Passport Details' :
                                                        modalType === 'ownerVisa' ? 'Visa Requirements' :
                                                            modalType === 'ownerEmiratesId' ? 'Owner Emirates ID' :
                                                                modalType === 'ownerMedical' ? 'Medical Insurance' :
                                                                    modalType === 'ownerDrivingLicense' ? 'Owner Driving License' :
                                                                        modalType === 'companyDocument' ? (editingIndex !== null ? 'Edit Document' : 'Add Document') :

                                                                            modalType === 'ownerLabourCard' ? 'Labour Card' : ''}
                                    </h3>
                                    {modalType === 'ownerVisa' && (
                                        <p className="text-xs font-semibold text-gray-400 capitalize">{modalData.type || 'Employment'} Visa details</p>
                                    )}
                                </div>
                                <button onClick={handleModalClose} className={`text-gray-400 hover:text-gray-600 transition-colors ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'absolute right-8' : ''}`}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-8 overflow-y-auto flex-1">
                                <form id="documentForm" onSubmit={handleSave} className="space-y-6">
                                    {modalType === 'basicDetails' && (
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
                                                <label className="w-1/3 text-sm font-medium text-gray-500">Company Name <span className="text-red-500">*</span></label>
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
                                                <label className="w-1/3 text-sm font-medium text-gray-500">Email <span className="text-red-500">*</span></label>
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
                                                <label className="w-1/3 text-sm font-medium text-gray-500">Contact Number</label>
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
                                                <label className="w-1/3 text-sm font-medium text-gray-500">Establishment Date</label>
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

                                            {/* Expiry Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">Expiry Date</label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        value={modalData.expiryDate}
                                                        onChange={(e) => setModalData({ ...modalData, expiryDate: e.target.value })}
                                                        className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                    />
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {modalType === 'establishmentCard' && (
                                        <div className="flex items-center gap-6">
                                            <label className="w-1/3 text-sm font-bold text-gray-500">
                                                Company Name
                                            </label>
                                            <div className="w-2/3">
                                                <input
                                                    type="text"
                                                    value={modalData.companyName}
                                                    onChange={(e) => setModalData({ ...modalData, companyName: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {modalType === 'tradeLicense' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    License Number <span className="text-red-500">*</span>
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
                                        </div>
                                    )}


                                    {['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) && (
                                        <div className="space-y-4">
                                            {/* Provider Row (Medical only) */}
                                            {modalType === 'ownerMedical' && (
                                                <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">
                                                    <label className="text-sm font-medium text-gray-700">Provider <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="text"
                                                        value={modalData.provider || ''}
                                                        onChange={(e) => setModalData({ ...modalData, provider: e.target.value })}
                                                        className="w-2/3 px-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                            )}

                                            {/* Number Box (Policy Number for Medical) */}
                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">
                                                <label className="text-sm font-medium text-gray-700">{modalType === 'ownerMedical' ? 'Policy Number' : 'Number'} <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={modalData.number || ''}
                                                    onChange={(e) => setModalData({ ...modalData, number: e.target.value })}
                                                    className="w-2/3 px-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                />
                                            </div>

                                            {/* Issue Date Box (EID and Medical only) */}
                                            {['ownerEmiratesId', 'ownerMedical'].includes(modalType) && (
                                                <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">
                                                    <label className="text-sm font-medium text-gray-700">Issue Date <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3 relative">
                                                        <input
                                                            type="date"
                                                            value={modalData.issueDate || ''}
                                                            placeholder="Pick a date"
                                                            onChange={(e) => setModalData({ ...modalData, issueDate: e.target.value })}
                                                            className="w-full px-4 py-2.5 pl-10 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                        />
                                                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Expiry Date Box */}
                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-between">
                                                <label className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        value={modalData.expiryDate || ''}
                                                        placeholder="Pick a date"
                                                        onChange={(e) => setModalData({ ...modalData, expiryDate: e.target.value })}
                                                        className="w-full px-4 py-2.5 pl-10 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                    />
                                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                </div>
                                            </div>

                                            {/* Document Box */}
                                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="text-sm font-medium text-gray-700">Document <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3">
                                                        {modalData.attachment ? (
                                                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                                                                <span className="text-xs font-semibold text-blue-700 truncate max-w-[150px]">Document Attached</span>
                                                                <button onClick={() => setModalData({ ...modalData, attachment: null })} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="w-full flex items-center border border-gray-100 bg-gray-50/50 rounded-xl overflow-hidden group"
                                                            >
                                                                <span className="bg-white px-4 py-2.5 text-blue-500 text-sm font-semibold border-r border-gray-100 hover:bg-gray-50 transition-colors">Choose File</span>
                                                                <span className="px-4 text-xs text-gray-400 truncate flex-1 text-left">No file chosen</span>
                                                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-center w-full">
                                                    <p className="text-[10px] text-gray-400 font-medium tracking-tight">Upload file in PDF format only (Max 5MB)</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {['ownerPassport', 'ownerVisa', 'ownerDrivingLicense'].includes(modalType) && (
                                        <div className="space-y-6">
                                            {/* Document Number */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">
                                                    {modalType === 'ownerPassport' ? 'Passport Number' : (modalType === 'ownerVisa' ? 'Visa Number' : 'Doc Number')} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        value={modalData.number || ''}
                                                        onChange={(e) => setModalData({ ...modalData, number: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder={`Enter ${modalType === 'ownerPassport' ? 'passport' : 'document'} number`}
                                                    />
                                                </div>
                                            </div>

                                            {modalType === 'ownerPassport' && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Passport Nationality <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3">
                                                        <select
                                                            value={modalData.nationality || ''}
                                                            onChange={(e) => setModalData({ ...modalData, nationality: e.target.value })}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                        >
                                                            <option value="">Select Nationality</option>
                                                            {Country.getAllCountries().map(c => (
                                                                <option key={c.isoCode} value={c.name}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {['ownerPassport', 'ownerVisa'].includes(modalType) && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Issue Date <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3 relative">
                                                        <input
                                                            type="date"
                                                            value={modalData.issueDate || ''}
                                                            onChange={(e) => setModalData({ ...modalData, issueDate: e.target.value })}
                                                            className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                        />
                                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Expiry Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-medium text-gray-500">Expiry Date <span className="text-red-500">*</span></label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        value={modalData.expiryDate || ''}
                                                        onChange={(e) => setModalData({ ...modalData, expiryDate: e.target.value })}
                                                        className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                    />
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                </div>
                                            </div>

                                            {modalType === 'ownerPassport' && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Country of Issue <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3">
                                                        <select
                                                            value={modalData.countryOfIssue || ''}
                                                            onChange={(e) => setModalData({ ...modalData, countryOfIssue: e.target.value })}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                        >
                                                            <option value="">Select Country</option>
                                                            {Country.getAllCountries().map(c => (
                                                                <option key={c.isoCode} value={c.name}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {modalType === 'ownerVisa' && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Visa Sponsor <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3">
                                                        <input
                                                            type="text"
                                                            value={modalData.sponsor || ''}
                                                            onChange={(e) => setModalData({ ...modalData, sponsor: e.target.value })}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                            placeholder="Enter sponsor name"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Attachment */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">{modalType === 'ownerPassport' ? 'Passport Copy' : 'Attachment'}</label>
                                                <div className="w-2/3">
                                                    {modalData.attachment ? (
                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <FileText size={16} className="text-blue-500 shrink-0" />
                                                                <span className="text-sm font-semibold text-blue-700 truncate">Document Attached</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, attachment: null })}
                                                                className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-all"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/20 transition-all group"
                                                        >
                                                            <Upload className="text-gray-300 group-hover:text-blue-500 transition-all" />
                                                            <span className="text-sm font-semibold text-gray-400 group-hover:text-blue-600">Click to upload document</span>
                                                            <input
                                                                ref={fileInputRef}
                                                                type="file"
                                                                className="hidden"
                                                                onChange={handleFileChange}
                                                            />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalType === 'companyDocument' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Document Type</label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.type || ''}
                                                        onChange={(e) => setModalData({ ...modalData, type: e.target.value })}
                                                        placeholder="e.g. VAT Certificate, Rental Agreement..."
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Description</label>
                                                <div className="w-2/3">
                                                    <textarea
                                                        value={modalData.description || ''}
                                                        onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                                                        placeholder="Brief description of the document..."
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[100px] text-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Expiry Date</label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
                                                        value={modalData.expiryDate || ''}
                                                        onChange={(e) => setModalData({ ...modalData, expiryDate: e.target.value })}
                                                        className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                    />
                                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">Attachment</label>
                                                <div className="w-2/3">
                                                    {modalData.attachment ? (
                                                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <FileText size={16} className="text-blue-500 shrink-0" />
                                                                <span className="text-sm font-semibold text-blue-700 truncate">Document Attached</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setModalData({ ...modalData, attachment: null })}
                                                                className="p-1 hover:bg-blue-100 rounded-lg text-blue-500 transition-all"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50/20 transition-all group"
                                                        >
                                                            <Upload className="text-gray-300 group-hover:text-blue-500 transition-all" />
                                                            <span className="text-sm font-semibold text-gray-400 group-hover:text-blue-600">Click to upload document</span>
                                                            <input
                                                                ref={fileInputRef}
                                                                type="file"
                                                                className="hidden"
                                                                onChange={handleFileChange}
                                                            />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                </form>
                            </div>

                            {/* Modal Footer */}
                            {modalType !== 'ownerVisaTypeSelection' && (
                                <div className={`px-8 py-6 border-t border-gray-100 flex items-center ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'justify-end' : 'justify-end'} gap-4`}>
                                    <button
                                        onClick={handleModalClose}
                                        className={`px-6 py-2.5 text-sm font-semibold ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'text-red-500 hover:text-red-600' : 'text-red-500 hover:text-red-600 hover:bg-red-50'} rounded-xl transition-all`}
                                        type="button"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        form="documentForm"
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`px-12 py-2.5 ${['ownerLabourCard', 'ownerEmiratesId', 'ownerMedical'].includes(modalType) ? 'bg-[#5174FF] hover:bg-[#4063FF] rounded-xl' : 'bg-blue-600 hover:bg-blue-700 rounded-xl'} text-white text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2`}
                                    >
                                        {isSubmitting ? 'Updating...' : (modalType.startsWith('owner') ? 'Save' : 'Update')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
