'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import { Building, Mail, Phone, Globe, MapPin, Edit2, Plus, FileText, User, ChevronLeft, ChevronRight, Calendar, Camera, X, Upload, Check, RotateCcw, Download, ChevronDown, Trash2, Search } from 'lucide-react';
import { Country } from 'country-state-city';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import DocumentViewerModal from '@/app/emp/[employeeId]/components/modals/DocumentViewerModal';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
};

const RESPONSIBILITY_CATEGORIES = [
    { id: 'hr', label: 'HR' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'assetcontroller', label: 'Asset Controller' },
    { id: 'management', label: 'Management' },
    { id: 'admincontroller', label: 'Admin Controller' }
];

export default function CompanyProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const companyId = params.companyId;

    const [company, setCompany] = useState(null);
    const [employeeCount, setEmployeeCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('basic');
    const [activeFlowTab, setActiveFlowTab] = useState('responsibilities');
    const [activeOwnerTabIndex, setActiveOwnerTabIndex] = useState(0);
    const [imageError, setImageError] = useState(false);
    const [allEmployees, setAllEmployees] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [responsibilities, setResponsibilities] = useState([]);

    // Modal State
    const [modalType, setModalType] = useState(null); // 'tradeLicense' | 'establishmentCard' | 'companyDocument'
    const [modalData, setModalData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [visaDropdownOpen, setVisaDropdownOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [viewingDocument, setViewingDocument] = useState(null);
    const [dynamicTabs, setDynamicTabs] = useState(['asset', 'insurance', 'ejari']);
    const [activeDynamicTabs, setActiveDynamicTabs] = useState([]);
    const [isAddMoreOpen, setIsAddMoreOpen] = useState(false);
    const [isAddingNewTab, setIsAddingNewTab] = useState(false);
    const [newTabInput, setNewTabInput] = useState('');
    const fileInputRef = useRef(null);
    const visaDropdownRef = useRef(null);
    const addMoreRef = useRef(null);
    const respDropdownRef = useRef(null);
    const [respDropdownOpen, setRespDropdownOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (visaDropdownRef.current && !visaDropdownRef.current.contains(event.target)) {
                setVisaDropdownOpen(false);
            }
            if (addMoreRef.current && !addMoreRef.current.contains(event.target)) {
                setIsAddMoreOpen(false);
            }
            if (respDropdownRef.current && !respDropdownRef.current.contains(event.target)) {
                setRespDropdownOpen(false);
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
            setEmployeeCount(response.data.employeeCount || 0);
        } catch (err) {
            console.error('Error fetching company:', err);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        if (companyId) fetchCompany();
    }, [fetchCompany, companyId]);

    useEffect(() => {
        if (company) {
            const baseTabs = ['asset', 'insurance', 'ejari'];
            const backendTabs = company.customTabs || [];
            const mergedTabs = Array.from(new Set([...baseTabs, ...backendTabs]));
            setDynamicTabs(mergedTabs);

            // Automatically activate tabs that have data
            const tabsToActivate = [];
            if (company.insurance?.length > 0) tabsToActivate.push('insurance');
            if (company.ejari?.length > 0) tabsToActivate.push('ejari');

            // Also activate any custom tabs that were created
            backendTabs.forEach(tab => {
                if (!tabsToActivate.includes(tab)) tabsToActivate.push(tab);
            });

            setActiveDynamicTabs(prev => {
                const uniqueTabs = new Set([...prev, ...tabsToActivate]);
                return Array.from(uniqueTabs);
            });

            if (company.responsibilities) {
                setResponsibilities(company.responsibilities);
            }
        }
    }, [company]);

    const fetchAllEmployees = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/Employee', { params: { limit: 1000 } });
            setAllEmployees(response.data.employees || response.data || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    }, []);

    useEffect(() => {
        fetchAllEmployees();
    }, [fetchAllEmployees]);

    const handleRemoveConfirm = async () => {
        if (itemToDelete === null) return;
        const updated = responsibilities.filter((_, i) => i !== itemToDelete);
        setResponsibilities(updated);
        try {
            await axiosInstance.patch(`/Company/${companyId}`, { responsibilities: updated });
            toast({ title: "Updated", description: "Responsibility removed successfully" });
            fetchCompany();
        } catch (err) {
            console.error('Error removing responsibility:', err);
            toast({ title: "Error", description: "Failed to remove responsibility", variant: "destructive" });
        } finally {
            setItemToDelete(null);
        }
    };

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
                number: company.establishmentCardNumber || '',
                issueDate: company.establishmentCardIssueDate ? new Date(company.establishmentCardIssueDate).toISOString().split('T')[0] : '',
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
        } else if (type === 'companyDocument') {
            let doc = {};
            if (editingIndex !== null) {
                if (activeTab === 'insurance') doc = company.insurance?.[editingIndex] || {};
                else if (activeTab === 'ejari') doc = company.ejari?.[editingIndex] || {};
                else doc = company.documents?.[editingIndex] || {};
            }
            setModalData({
                type: activeTab === 'insurance' || activeTab === 'ejari'
                    ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
                    : (editingIndex !== null ? doc.type : (activeDynamicTabs.includes(activeTab) ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : '')),
                provider: doc.provider || '',
                authority: doc.authority || '',
                issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString().split('T')[0] : '',
                startDate: doc.startDate ? new Date(doc.startDate).toISOString().split('T')[0] : '',
                value: doc.value || '',
                expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
                attachment: doc.document?.url || null,
                fileName: doc.document?.name || '',
                mimeType: doc.document?.mimeType || 'application/pdf'
            });
        } else if (type === 'addNewCategory') {
            setModalData({
                type: '',
                issueDate: '',
                expiryDate: '',
                authority: '',
                attachment: null
            });
        } else if (type === 'ownerDetails') {
            const owner = company.owners[activeOwnerTabIndex];
            setModalData({
                name: owner.name || '',
                email: owner.email || '',
                phone: owner.phone || '',
                nationality: owner.nationality || '',
                sharePercentage: owner.sharePercentage || ''
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
                provider: docData.provider || '',
                attachment: docData.attachment || null,
                lastUpdated: docData.lastUpdated ? new Date(docData.lastUpdated).toISOString().split('T')[0] : '',
                expiryDate: docData.expiryDate ? new Date(docData.expiryDate).toISOString().split('T')[0] : '',
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
                payload.establishmentCardNumber = modalData.number;
                payload.establishmentCardIssueDate = modalData.issueDate;
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
                    provider: modalData.provider,
                    authority: modalData.authority,
                    issueDate: modalData.issueDate,
                    startDate: modalData.startDate,
                    value: modalData.value,
                    expiryDate: modalData.expiryDate,
                    document: {
                        url: modalData.attachment,
                        name: modalData.fileName,
                        mimeType: modalData.mimeType || 'application/pdf'
                    }
                };

                if (activeTab === 'insurance') {
                    const updatedDocs = [...(company.insurance || [])];
                    if (editingIndex !== null) updatedDocs[editingIndex] = newDoc;
                    else updatedDocs.push(newDoc);
                    payload.insurance = updatedDocs;
                } else if (activeTab === 'ejari') {
                    const updatedDocs = [...(company.ejari || [])];
                    if (editingIndex !== null) updatedDocs[editingIndex] = newDoc;
                    else updatedDocs.push(newDoc);
                    payload.ejari = updatedDocs;
                } else {
                    const updatedDocs = [...(company.documents || [])];
                    if (editingIndex !== null) updatedDocs[editingIndex] = newDoc;
                    else updatedDocs.push(newDoc);
                    payload.documents = updatedDocs;
                }
            } else if (modalType === 'addNewCategory') {
                if (!modalData.type || !modalData.attachment) {
                    toast({ title: "Error", description: "Title and Attachment are mandatory", variant: "destructive" });
                    return;
                }
                const categoryName = modalData.type.trim().toLowerCase();
                const newDoc = {
                    type: modalData.type,
                    authority: modalData.authority,
                    issueDate: modalData.issueDate,
                    expiryDate: modalData.expiryDate,
                    document: {
                        url: modalData.attachment,
                        name: modalData.fileName,
                        mimeType: modalData.mimeType || 'application/pdf'
                    }
                };

                // Add to dynamicTabs if not exists
                const existingTabs = company.customTabs || [];
                if (!existingTabs.includes(categoryName) && !['asset', 'insurance', 'ejari'].includes(categoryName)) {
                    payload.customTabs = [...existingTabs, categoryName];
                }

                const updatedDocs = [...(company.documents || [])];
                updatedDocs.push(newDoc);
                payload.documents = updatedDocs;

                if (categoryName === 'insurance' || categoryName === 'ejari') {
                    const updatedTypeDocs = [...(company[categoryName] || [])];
                    updatedTypeDocs.push(newDoc);
                    payload[categoryName] = updatedTypeDocs;
                }

                // Switch to the new tab
                setActiveTab(categoryName);
                if (!activeDynamicTabs.includes(categoryName)) {
                    setActiveDynamicTabs(prev => [...prev, categoryName]);
                }
            } else if (modalType === 'ownerDetails') {
                const updatedOwners = [...company.owners];
                updatedOwners[activeOwnerTabIndex] = {
                    ...updatedOwners[activeOwnerTabIndex],
                    name: modalData.name,
                    email: modalData.email,
                    phone: modalData.phone,
                    nationality: modalData.nationality,
                    sharePercentage: modalData.sharePercentage
                };
                payload.owners = updatedOwners;
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
        setModalData(prev => {
            const currentOwners = prev.owners || [];
            const newCount = currentOwners.length + 1;
            const equalShare = (100 / newCount).toFixed(2);

            // Create new owner
            const newOwner = {
                name: '',
                email: '',
                phone: '',
                nationality: '',
                sharePercentage: equalShare,
                attachment: ''
            };

            // Redistribute existing
            const updatedOwners = currentOwners.map(o => ({
                ...o,
                sharePercentage: equalShare
            }));

            // Adjust last one for rounding errors if needed (e.g. 33.33 * 3 = 99.99)
            const list = [...updatedOwners, newOwner];

            return {
                ...prev,
                owners: list
            };
        });
    };

    const handleRemoveOwner = (index) => {
        setModalData(prev => {
            const temp = prev.owners.filter((_, i) => i !== index);
            if (temp.length === 0) return { ...prev, owners: [] };

            const equalShare = (100 / temp.length).toFixed(2);
            const updatedOwners = temp.map(o => ({
                ...o,
                sharePercentage: equalShare
            }));

            return {
                ...prev,
                owners: updatedOwners
            };
        });
    };

    const handleOwnerChange = (index, field, value) => {
        setModalData(prev => {
            const newOwners = [...prev.owners];

            if (field === 'sharePercentage') {
                const newValue = Math.min(100, Math.max(0, Number(value)));
                const oldValue = Number(newOwners[index].sharePercentage) || 0;

                newOwners[index] = { ...newOwners[index], sharePercentage: newValue };

                // If purely single owner, just set it (though usually 100)
                if (newOwners.length === 1) {
                    return { ...prev, owners: newOwners };
                }

                // Auto-balance others
                const remaining = 100 - newValue;
                const otherOwners = newOwners.filter((_, i) => i !== index);
                const currentSumOthers = otherOwners.reduce((sum, o) => sum + (Number(o.sharePercentage) || 0), 0);

                // Distribute remaining among others
                newOwners.forEach((owner, i) => {
                    if (i !== index) {
                        let newShare;
                        if (currentSumOthers === 0) {
                            // If others were 0, distribute equally
                            newShare = (remaining / otherOwners.length);
                        } else {
                            // Proportional distribution
                            const ratio = (Number(owner.sharePercentage) || 0) / currentSumOthers;
                            newShare = remaining * ratio;
                        }

                        // Avoid negative shares
                        if (newShare < 0) newShare = 0;

                        // Update
                        newOwners[i] = {
                            ...owner,
                            sharePercentage: Number.isInteger(newShare) ? newShare : newShare.toFixed(2)
                        };
                    }
                });
            } else {
                newOwners[index] = { ...newOwners[index], [field]: value };
            }

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
        { text: `Trade License Expiry: ${company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : 'N/A'}`, color: 'bg-white' },
        { text: `Established On: ${company.establishedDate ? new Date(company.establishedDate).toLocaleDateString('en-GB') : 'N/A'}`, color: 'bg-emerald-400' },
        { text: `Expires On: ${company.tradeLicenseExpiry ? new Date(company.tradeLicenseExpiry).toLocaleDateString('en-GB') : 'N/A'}`, color: 'bg-blue-300' },
        { text: `Established Expiry: ${company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toLocaleDateString('en-GB') : 'N/A'}`, color: 'bg-sky-200' },
        { text: `No. of Emps: ${employeeCount}`, color: 'bg-rose-400' }
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
                            onClick={() => setActiveTab('flow')}
                            className={`pb-3 text-sm font-semibold transition-all relative ${activeTab === 'flow' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Flow Chart
                            {activeTab === 'flow' ? (
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

                        {activeDynamicTabs.map((tab) => (
                            <div key={tab} className="group relative">
                                <button
                                    onClick={() => setActiveTab(tab)}
                                    className={`pb-3 text-sm font-semibold transition-all relative capitalize ${activeTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {tab}
                                    {activeTab === tab && (
                                        <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500" />
                                    )}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDynamicTabs(activeDynamicTabs.filter(t => t !== tab));
                                        if (activeTab === tab) setActiveTab('documents');
                                    }}
                                    className="absolute -top-1 -right-2 p-0.5 bg-gray-100 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200"
                                    title="Close Tab"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}

                        <div className="flex-1" />

                        <div className="relative" ref={addMoreRef}>
                            <div
                                onClick={() => setIsAddMoreOpen(!isAddMoreOpen)}
                                className="mb-3 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-md flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
                            >
                                Add More
                                <ChevronDown size={16} className={`transition-transform duration-200 ${isAddMoreOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isAddMoreOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {dynamicTabs.filter(t => !activeDynamicTabs.includes(t)).map((tab) => (
                                        <div key={tab} className="flex items-center justify-between px-4 py-2 hover:bg-blue-50 group/item">
                                            <button
                                                onClick={() => {
                                                    setActiveDynamicTabs([...activeDynamicTabs, tab]);
                                                    setActiveTab(tab);
                                                    setIsAddMoreOpen(false);
                                                }}
                                                className="flex-1 text-left text-sm font-medium text-gray-700 group-hover/item:text-blue-600 transition-colors capitalize"
                                            >
                                                {tab}
                                            </button>
                                            {!['asset', 'insurance', 'ejari'].includes(tab) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDynamicTabs(dynamicTabs.filter(t => t !== tab));
                                                    }}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Delete category"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="h-px bg-gray-100 my-1" />
                                    <button
                                        onClick={() => {
                                            handleModalOpen('addNewCategory');
                                            setIsAddMoreOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2 border-t border-gray-50"
                                    >
                                        <Plus size={16} /> Add New Tab
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Nested Tabs for Flow Chart */}
                    {activeTab === 'flow' && (
                        <div className="flex items-center gap-6 mb-8 px-6 bg-white/50 py-3 rounded-xl border border-gray-100 shadow-sm mx-6">
                            <button
                                onClick={() => setActiveFlowTab('responsibilities')}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeFlowTab === 'responsibilities'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                    : 'text-gray-500 hover:bg-white hover:text-blue-600'
                                    }`}
                            >
                                Responsibilities
                            </button>
                            <button
                                onClick={() => setActiveFlowTab('flowchart')}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeFlowTab === 'flowchart'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                    : 'text-gray-500 hover:bg-white hover:text-blue-600'
                                    }`}
                            >
                                Flow Chart
                            </button>
                        </div>
                    )}

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
                                                    <button
                                                        onClick={() => setViewingDocument({
                                                            data: company.tradeLicenseAttachment,
                                                            name: 'Trade License',
                                                            mimeType: 'application/pdf'
                                                        })}
                                                        className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> View Document
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {company.establishmentCardNumber && (
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
                                                <span className="text-sm font-medium text-gray-500">Card Number</span>
                                                <span className="text-sm font-medium text-gray-500">{company.establishmentCardNumber}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Issue Date</span>
                                                <span className="text-sm font-medium text-gray-500">
                                                    {company.establishmentCardIssueDate ? new Date(company.establishmentCardIssueDate).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Expiry Date</span>
                                                <span className="text-sm font-medium text-gray-500">
                                                    {company.establishmentCardExpiry ? new Date(company.establishmentCardExpiry).toLocaleDateString('en-GB') : '---'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors">
                                                <span className="text-sm font-medium text-gray-500">Company Name</span>
                                                <span className="text-sm font-medium text-gray-500">{company.name}</span>
                                            </div>
                                            {company.establishmentCardAttachment && (
                                                <div className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-gray-500">Attachment</span>
                                                    <button
                                                        onClick={() => setViewingDocument({
                                                            data: company.establishmentCardAttachment,
                                                            name: 'Establishment Card',
                                                            mimeType: 'application/pdf'
                                                        })}
                                                        className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> View Document
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Document Buttons */}
                                {/* Responsibilities Summary Card */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                                    <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-slate-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-4 ring-blue-50">
                                                <Check size={18} />
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-800 tracking-tight">Key Appointments</h4>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setActiveTab('flow');
                                                setActiveFlowTab('responsibilities');
                                            }}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            Manage Positions
                                        </button>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {RESPONSIBILITY_CATEGORIES.map((cat, idx) => {
                                            const resp = (company.responsibilities || []).find(r => r.category === cat.id);
                                            return (
                                                <div key={idx} className="flex items-center justify-between px-8 py-4 hover:bg-gray-50/50 transition-colors group">
                                                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider text-[11px]">{cat.label}</span>
                                                    <div className="flex items-center gap-3">
                                                        {resp ? (
                                                            <>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-sm font-bold text-gray-700">{resp.employeeName}</span>
                                                                    <span className="text-[10px] text-gray-400 font-medium">{resp.designation || 'N/A'}</span>
                                                                </div>
                                                                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold ring-2 ring-white shadow-sm border border-blue-200/50">
                                                                    {resp.employeeName?.charAt(0)}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-orange-400/80 bg-orange-50 px-3 py-1 rounded-full border border-orange-100/50 uppercase tracking-widest">Unassigned</span>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveTab('flow');
                                                                        setActiveFlowTab('responsibilities');
                                                                        setSelectedCategory(cat.id);
                                                                        setModalType('assignEmployee');
                                                                    }}
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-blue-100 bg-white"
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(company.responsibilities || []).filter(r => !RESPONSIBILITY_CATEGORIES.some(c => c.id === r.category)).map((resp, idx) => (
                                            <div key={`custom-${idx}`} className="flex items-center justify-between px-8 py-4 hover:bg-purple-50/30 transition-colors group">
                                                <span className="text-sm font-semibold text-purple-600/70 uppercase tracking-wider text-[11px]">{resp.category}</span>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-bold text-gray-700">{resp.employeeName}</span>
                                                        <span className="text-[10px] text-gray-400 font-medium">{resp.designation || 'N/A'}</span>
                                                    </div>
                                                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold ring-2 ring-white shadow-sm border border-purple-200/50">
                                                        {resp.employeeName?.charAt(0)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
                                                            onClick={() => handleModalOpen('ownerDetails')}
                                                            className="text-blue-500 hover:text-blue-600 transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </div>
                                                    <div className="p-8 space-y-0">
                                                        {[
                                                            { label: 'Full Name', value: company.owners[activeOwnerTabIndex]?.name },
                                                            { label: 'Email Address', value: company.owners[activeOwnerTabIndex]?.email || company.email, lowercase: true },
                                                            { label: 'Contact Number', value: company.owners[activeOwnerTabIndex]?.phone || company.phone },
                                                            { label: 'Nationality', value: company.owners[activeOwnerTabIndex]?.nationality },
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
                                                                <button onClick={() => handleModalOpen(doc.modal)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={18} /></button>
                                                                <button className="p-1.5 text-orange-400 hover:bg-orange-50 rounded-lg transition-all"><RotateCcw size={18} /></button>
                                                                {company.owners[activeOwnerTabIndex]?.[doc.id]?.attachment ? (
                                                                    <button
                                                                        onClick={() => setViewingDocument({
                                                                            data: company.owners[activeOwnerTabIndex][doc.id].attachment,
                                                                            name: doc.label,
                                                                            mimeType: 'application/pdf'
                                                                        })}
                                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                                                    >
                                                                        <Download size={14} />
                                                                    </button>
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

                        {activeTab === 'flow' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mx-6">
                                {activeFlowTab === 'responsibilities' ? (
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 min-h-[400px] flex flex-col items-center animate-in fade-in duration-500">
                                        <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                                            <div className="flex flex-col">
                                                <h3 className="text-xl font-bold text-gray-800">Responsibilities</h3>
                                                <p className="text-sm text-gray-500">Manage departmental responsibilities</p>
                                            </div>


                                        </div>

                                        <div className="w-full space-y-4">
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-separate border-spacing-y-3">
                                                    <thead>
                                                        <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                            <th className="px-6 py-2">Position / Category</th>
                                                            <th className="px-6 py-2">Assigned Employee</th>
                                                            <th className="px-6 py-2">Designation</th>
                                                            <th className="px-6 py-2 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {/* Default Categories (Slots) */}
                                                        {RESPONSIBILITY_CATEGORIES.map((cat, idx) => {
                                                            const resp = (company?.responsibilities || []).find(r => r.category === cat.id);
                                                            return (
                                                                <tr key={cat.id} className="bg-gray-50/50 hover:bg-blue-50/30 transition-all rounded-2xl group border border-transparent hover:border-blue-100">
                                                                    <td className="px-6 py-4">
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                                                                            {cat.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        {resp ? (
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                                                    {resp.employeeName?.charAt(0) || 'E'}
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-sm font-bold text-gray-700">{resp.employeeName}</span>
                                                                                    <span className="text-[10px] text-gray-400 font-medium">ID: {resp.employeeId}</span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-xs font-bold text-orange-400/80 italic">Not Assigned</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="text-sm text-gray-500 font-medium">{resp?.designation || '---'}</span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        {resp ? (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const realIndex = responsibilities.findIndex(r => r.category === cat.id);
                                                                                    setItemToDelete(realIndex);
                                                                                }}
                                                                                className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                            >
                                                                                <X size={16} />
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedCategory(cat.id);
                                                                                    setModalType('assignEmployee');
                                                                                }}
                                                                                className="px-4 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                                            >
                                                                                Assign Now
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}

                                                        {/* Custom Categories */}
                                                        {(company?.responsibilities || []).filter(r => !RESPONSIBILITY_CATEGORIES.some(c => c.id === r.category)).map((resp, idx) => (
                                                            <tr key={`custom-${idx}`} className="bg-purple-50/30 hover:bg-purple-50 transition-all rounded-2xl group border border-transparent hover:border-purple-100">
                                                                <td className="px-6 py-4">
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">
                                                                        {resp.category}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                                            {resp.employeeName?.charAt(0)}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-bold text-gray-700">{resp.employeeName}</span>
                                                                            <span className="text-[10px] text-gray-400 font-medium">ID: {resp.employeeId}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className="text-sm text-gray-500 font-medium">{resp.designation || '---'}</span>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        onClick={() => {
                                                                            const realIndex = responsibilities.findIndex(r => r.category === resp.category && r.employeeId === resp.employeeId);
                                                                            setItemToDelete(realIndex);
                                                                        }}
                                                                        className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 min-h-[500px] flex flex-col items-center animate-in fade-in duration-500 overflow-hidden relative">
                                        <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                                            <div className="flex flex-col">
                                                <h3 className="text-xl font-bold text-gray-800">Operational Flow</h3>
                                                <p className="text-sm text-gray-500">Organizational structure and workflow visualization</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    fetchCompany();
                                                    toast({ title: "Refreshed", description: "Operational data updated" });
                                                }}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                            >
                                                <RotateCcw size={14} /> Refresh Chart
                                            </button>
                                        </div>

                                        {/* Chart Canvas Area */}
                                        <div className="flex-1 w-full bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center p-12 min-h-[600px] overflow-y-auto custom-scrollbar">
                                            {/* Company Node */}
                                            <div className="relative group mb-16">
                                                <div className="absolute -inset-6 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-700 animate-pulse"></div>
                                                <div className="relative w-28 h-28 bg-white rounded-[2rem] shadow-2xl shadow-blue-100 flex flex-col items-center justify-center border border-blue-50 group-hover:scale-105 transition-transform duration-500">
                                                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-2 shadow-inner">
                                                        <Building size={32} />
                                                    </div>
                                                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest px-3 truncate max-w-full">{company.name}</span>
                                                </div>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 h-16 w-0.5 bg-gradient-to-b from-blue-200 to-transparent"></div>
                                            </div>

                                            {/* Hierarchy Tree */}
                                            <div className="w-full max-w-4xl relative">
                                                {(company.responsibilities || []).length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
                                                        {(company.responsibilities || []).map((resp, idx) => (
                                                            <div key={idx} className="relative group">
                                                                <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-gray-100/50 border border-gray-100 flex flex-col items-center text-center group-hover:border-blue-200 group-hover:shadow-blue-50 transition-all duration-500 animate-in zoom-in duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
                                                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 font-bold text-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm border border-slate-100">
                                                                        {resp.employeeName?.charAt(0)}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-1">{resp.category}</span>
                                                                    <h5 className="text-sm font-extrabold text-gray-800 mb-1">{resp.employeeName}</h5>
                                                                    <span className="text-[11px] text-gray-400 font-semibold">{resp.designation || 'Operations'}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-gray-100 border-dashed">
                                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                                                            <User size={40} />
                                                        </div>
                                                        <h4 className="text-lg font-bold text-gray-400 mb-2">No flow data available</h4>
                                                        <p className="text-sm text-gray-300 max-w-xs text-center">Assign responsibilities to employees to visualize the organizational flow chart.</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-20 text-center">
                                                <span className="bg-white/80 backdrop-blur px-6 py-3 rounded-2xl border border-gray-100 text-[11px] font-bold text-gray-400 shadow-xl flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                                                    Operational Structure Visualization
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(activeTab === 'documents' || activeDynamicTabs.includes(activeTab)) && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in duration-500 min-h-[400px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-semibold text-gray-800 capitalize">
                                        {activeTab === 'documents' ? 'Company Documents' : `${activeTab} Documents`}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setEditingIndex(null);
                                            handleModalOpen('companyDocument');
                                        }}
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
                                                {activeTab === 'insurance' && <th className="px-6 py-3">Provider</th>}
                                                <th className="px-6 py-3">
                                                    {(activeTab === 'insurance' || activeTab === 'ejari') ? 'Expiry Date' : 'Expiry Date'}
                                                </th>
                                                {(activeTab === 'insurance' || activeTab === 'ejari') && <th className="px-6 py-3">Value</th>}
                                                <th className="px-6 py-3">Attachment</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* System Documents (License & Establishment Card) - Only show on main documents tab */}
                                            {activeTab === 'documents' && company.tradeLicenseNumber && (
                                                <tr className="bg-blue-50/30 hover:bg-blue-50/50 transition-colors shadow-sm ring-1 ring-blue-100/50 rounded-xl group/row">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                                                <FileText size={20} />
                                                            </div>
                                                            <span className="font-semibold text-gray-700 text-sm">Trade License</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                        {formatDate(company.tradeLicenseExpiry)}
                                                    </td>
                                                    {activeTab === 'insurance' && <td className="px-6 py-4">-</td>}
                                                    {(activeTab === 'insurance' || activeTab === 'ejari') && <td className="px-6 py-4">-</td>}
                                                    <td className="px-6 py-4">
                                                        {company.tradeLicenseAttachment ? (
                                                            <button
                                                                onClick={() => setViewingDocument({
                                                                    data: company.tradeLicenseAttachment,
                                                                    name: 'Trade License',
                                                                    mimeType: 'application/pdf'
                                                                })}
                                                                className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2"
                                                            >
                                                                <Download size={14} /> View Document
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs italic">No document</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            <button onClick={() => handleModalOpen('tradeLicense')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                                <Edit2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {activeTab === 'documents' && company.establishmentCardNumber && (
                                                <tr className="bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors shadow-sm ring-1 ring-indigo-100/50 rounded-xl group/row">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                                                                <FileText size={20} />
                                                            </div>
                                                            <span className="font-semibold text-gray-700 text-sm">Establishment Card</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                        {formatDate(company.establishmentCardExpiry)}
                                                    </td>
                                                    {activeTab === 'insurance' && <td className="px-6 py-4">-</td>}
                                                    {(activeTab === 'insurance' || activeTab === 'ejari') && <td className="px-6 py-4">-</td>}
                                                    <td className="px-6 py-4">
                                                        {company.establishmentCardAttachment ? (
                                                            <button
                                                                onClick={() => setViewingDocument({
                                                                    data: company.establishmentCardAttachment,
                                                                    name: 'Establishment Card',
                                                                    mimeType: 'application/pdf'
                                                                })}
                                                                className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2"
                                                            >
                                                                <Download size={14} /> View Document
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs italic">No document</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            <button onClick={() => handleModalOpen('establishmentCard')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                                <Edit2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Additional Documents */}
                                            {(() => {
                                                let docs = [];
                                                if (activeTab === 'documents') docs = company.documents || [];
                                                else if (activeTab === 'insurance') docs = company.insurance || [];
                                                else if (activeTab === 'ejari') docs = company.ejari || [];
                                                else docs = (company.documents || []).filter(doc => doc.type?.toLowerCase().includes(activeTab.toLowerCase()));

                                                if (docs.length > 0) {
                                                    return docs.map((doc, idx) => (
                                                        <tr key={idx} className="bg-white hover:bg-gray-50/50 transition-colors shadow-sm ring-1 ring-gray-100 rounded-xl group/row">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
                                                                        <FileText size={20} />
                                                                    </div>
                                                                    <span className="font-semibold text-gray-700 text-sm">{doc.type || (activeTab === 'insurance' ? 'Insurance' : activeTab === 'ejari' ? 'Ejari' : 'Document')}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                                {formatDate(doc.expiryDate)}
                                                            </td>
                                                            {activeTab === 'insurance' && (
                                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                                                    {doc.provider || '-'}
                                                                </td>
                                                            )}
                                                            {(activeTab === 'insurance' || activeTab === 'ejari') && (
                                                                <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                                                                    {doc.value ? `${Number(doc.value).toLocaleString()} AED` : '-'}
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-4">
                                                                {doc.document?.url ? (
                                                                    <button
                                                                        onClick={() => setViewingDocument({
                                                                            data: doc.document.url,
                                                                            name: doc.type || activeTab,
                                                                            mimeType: doc.document.mimeType || 'application/pdf'
                                                                        })}
                                                                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-2"
                                                                    >
                                                                        <Download size={14} /> View Document
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs italic">No document</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingIndex(idx);
                                                                            handleModalOpen('companyDocument');
                                                                        }}
                                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteDocument(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                                        <X size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ));
                                                }
                                                // Fallback for empty state
                                                if (!(activeTab === 'documents' && (company.tradeLicenseNumber || company.establishmentCardNumber))) {
                                                    return (
                                                        <tr>
                                                            <td colSpan="6" className="py-20 text-center">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                                                        <Upload size={32} />
                                                                    </div>
                                                                    <h4 className="text-gray-500 font-medium">No documents uploaded yet</h4>
                                                                    <p className="text-sm text-gray-400">Keep all your {activeTab} records in one safe place.</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                                return null;
                                            })()}
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
                                                                        modalType === 'ownerDetails' ? 'Owner Basic Details' :
                                                                            modalType === 'companyDocument' ? (editingIndex !== null ? 'Edit Document' : 'Add Document') :
                                                                                modalType === 'addNewCategory' ? 'Add New Category' :
                                                                                    modalType === 'ownerLabourCard' ? 'Labour Card' :
                                                                                        modalType === 'assignEmployee' ? `Assign ${selectedCategory?.toUpperCase() || ''} Responsibility` : ''}
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
                                        <div className="space-y-6">
                                            {/* Card Number */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Card Number <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.number}
                                                        onChange={(e) => setModalData({ ...modalData, number: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder="e.g. 123456"
                                                    />
                                                </div>
                                            </div>

                                            {/* Issue Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Issue Date
                                                </label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
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

                                            {/* Attachment */}
                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-sm font-bold text-gray-500">Attachment</label>
                                                </div>
                                                {modalData.attachment ? (
                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">Document Attached</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, attachment: null })}
                                                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 rounded-full transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                                    >
                                                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <Upload size={18} className="text-gray-400 group-hover:text-blue-500" />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Upload Establishment Card</span>
                                                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {modalType === 'tradeLicense' && (
                                        <div className="space-y-6">
                                            {/* License Number */}
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

                                            {/* Issue Date */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Issue Date
                                                </label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="date"
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

                                            {/* Owners Section */}
                                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-bold text-gray-500">Owners</label>
                                                    <button
                                                        type="button"
                                                        onClick={handleAddOwner}
                                                        className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                    >
                                                        + Add Owner
                                                    </button>
                                                </div>
                                                {modalData.owners?.map((owner, index) => (
                                                    <div key={index} className="bg-gray-50 p-4 rounded-xl space-y-3 relative group">
                                                        {modalData.owners.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveOwner(index)}
                                                                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        )}
                                                        <input
                                                            type="text"
                                                            placeholder="Owner Name"
                                                            value={owner.name}
                                                            onChange={(e) => handleOwnerChange(index, 'name', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                                        />
                                                        <input
                                                            type="email"
                                                            placeholder="Email Address"
                                                            value={owner.email}
                                                            onChange={(e) => handleOwnerChange(index, 'email', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Contact Number"
                                                            value={owner.phone}
                                                            onChange={(e) => handleOwnerChange(index, 'phone', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                                        />
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                placeholder="Share %"
                                                                value={owner.sharePercentage}
                                                                onChange={(e) => handleOwnerChange(index, 'sharePercentage', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Attachment */}
                                            <div className="pt-4 border-t border-gray-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-sm font-bold text-gray-500">Attachment</label>
                                                </div>
                                                {modalData.attachment ? (
                                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">Document Attached</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalData({ ...modalData, attachment: null })}
                                                            className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-100 rounded-full transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                                    >
                                                        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <Upload size={18} className="text-gray-400 group-hover:text-blue-500" />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Upload License Document</span>
                                                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
                                                    </button>
                                                )}
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

                                    {modalType === 'ownerDetails' && (
                                        <div className="space-y-6">
                                            {/* Owner Name */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Full Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        required
                                                        value={modalData.name}
                                                        onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder="Enter owner full name"
                                                    />
                                                </div>
                                            </div>

                                            {/* Email Address */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Email Address
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="email"
                                                        value={modalData.email}
                                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder="Enter owner email"
                                                    />
                                                </div>
                                            </div>

                                            {/* Contact Number */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Contact Number
                                                </label>
                                                <div className="w-2/3">
                                                    <input
                                                        type="text"
                                                        value={modalData.phone}
                                                        onChange={(e) => setModalData({ ...modalData, phone: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder="Enter contact number"
                                                    />
                                                </div>
                                            </div>

                                            {/* Nationality */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Nationality
                                                </label>
                                                <div className="w-2/3">
                                                    <select
                                                        value={modalData.nationality}
                                                        onChange={(e) => setModalData({ ...modalData, nationality: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                    >
                                                        <option value="">Select Nationality</option>
                                                        {Country.getAllCountries().map(c => (
                                                            <option key={c.isoCode} value={c.name}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Share Percentage */}
                                            <div className="flex items-center gap-6">
                                                <label className="w-1/3 text-sm font-bold text-gray-500">
                                                    Share Percentage (%) <span className="text-red-500">*</span>
                                                </label>
                                                <div className="w-2/3 relative">
                                                    <input
                                                        type="number"
                                                        required
                                                        value={modalData.sharePercentage}
                                                        onChange={(e) => setModalData({ ...modalData, sharePercentage: e.target.value })}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        placeholder="e.g. 50"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
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

                                            {modalType === 'ownerVisa' && (
                                                <div className="flex items-center gap-6">
                                                    <label className="w-1/3 text-sm font-medium text-gray-500">Visa Type <span className="text-red-500">*</span></label>
                                                    <div className="w-2/3">
                                                        <select
                                                            value={modalData.type || 'Employment'}
                                                            onChange={(e) => setModalData({ ...modalData, type: e.target.value })}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-700"
                                                        >
                                                            <option value="Employment">Employment Visa</option>
                                                            <option value="Visiting">Visiting Visa</option>
                                                            <option value="Residence">Residence Visa</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

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

                                    {['companyDocument', 'addNewCategory'].includes(modalType) && (
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

                                            {(modalData.type?.toLowerCase() === 'insurance' || modalData.type?.toLowerCase() === 'ijary') && modalType !== 'addNewCategory' ? (
                                                <>
                                                    {modalData.type?.toLowerCase() === 'insurance' && (
                                                        <div className="flex items-center gap-6">
                                                            <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Provider</label>
                                                            <div className="w-2/3">
                                                                <input
                                                                    type="text"
                                                                    value={modalData.provider || ''}
                                                                    onChange={(e) => setModalData({ ...modalData, provider: e.target.value })}
                                                                    placeholder="e.g. AXA, Oman Insurance..."
                                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Start Date</label>
                                                        <div className="w-2/3 relative">
                                                            <input
                                                                type="date"
                                                                value={modalData.startDate || ''}
                                                                onChange={(e) => setModalData({ ...modalData, startDate: e.target.value })}
                                                                className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                            />
                                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase">Value (AED)</label>
                                                        <div className="w-2/3">
                                                            <input
                                                                type="number"
                                                                value={modalData.value || ''}
                                                                onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                                                                placeholder={`Enter ${modalData.type?.toLowerCase()} value`}
                                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">Issue Date</label>
                                                        <div className="w-2/3 relative">
                                                            <input
                                                                type="date"
                                                                value={modalData.issueDate || ''}
                                                                onChange={(e) => setModalData({ ...modalData, issueDate: e.target.value })}
                                                                className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                                                            />
                                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        <label className="w-1/3 text-sm font-bold text-gray-500 uppercase tracking-tight">Authority</label>
                                                        <div className="w-2/3">
                                                            <input
                                                                type="text"
                                                                value={modalData.authority || ''}
                                                                onChange={(e) => setModalData({ ...modalData, authority: e.target.value })}
                                                                placeholder="e.g. Dubai Municipality, DERA..."
                                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}


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

                                    {modalType === 'addCustomResponsibility' && (
                                        <div className="space-y-6">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-gray-500 uppercase">Category Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={modalData.category || ''}
                                                    onChange={(e) => setModalData({ ...modalData, category: e.target.value })}
                                                    placeholder="e.g. IT Manager, Safety Officer..."
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                />
                                            </div>
                                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                                    After defining the category, you will be prompted to assign an employee to it.
                                                </p>
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!modalData.category) {
                                                            toast({ title: "Required", description: "Please enter a category name", variant: "destructive" });
                                                            return;
                                                        }
                                                        setSelectedCategory(modalData.category);
                                                        setModalType('assignEmployee');
                                                        setModalData({});
                                                    }}
                                                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all"
                                                >
                                                    Next: Assign Employee <ArrowRight size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {modalType === 'assignEmployee' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm capitalize">
                                                    {selectedCategory?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Assigning for</span>
                                                    <span className="text-sm font-bold text-blue-700 capitalize">{selectedCategory?.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-gray-500">Search & Select Employee</label>
                                                <div className="relative">
                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search by name or ID..."
                                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700"
                                                        onChange={(e) => {
                                                            const query = e.target.value.toLowerCase();
                                                            const filtered = allEmployees.filter(emp =>
                                                                `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||
                                                                emp.employeeId?.toLowerCase().includes(query)
                                                            );
                                                            setModalData({ ...modalData, filteredEmployees: filtered });
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                {(modalData.filteredEmployees || allEmployees).map((emp) => {
                                                    const isAlreadyAssigned = (responsibilities || []).some(r => r.empObjectId === emp._id);
                                                    return (
                                                        <button
                                                            key={emp._id}
                                                            type="button"
                                                            disabled={isAlreadyAssigned || isSubmitting}
                                                            onClick={async () => {
                                                                if (isAlreadyAssigned) return;
                                                                const newResp = {
                                                                    category: selectedCategory,
                                                                    employeeId: emp.employeeId,
                                                                    employeeName: `${emp.firstName} ${emp.lastName}`,
                                                                    designation: emp.designation?.name || emp.designation || 'N/A',
                                                                    empObjectId: emp._id
                                                                };
                                                                const updatedResps = [...responsibilities, newResp];
                                                                setResponsibilities(updatedResps);
                                                                handleModalClose();

                                                                try {
                                                                    setIsSubmitting(true);
                                                                    await axiosInstance.patch(`/Company/${companyId}`, { responsibilities: updatedResps });
                                                                    toast({ title: "Success", description: `${emp.firstName} assigned to ${selectedCategory}` });
                                                                    fetchCompany();
                                                                } catch (err) {
                                                                    console.error('Error assigning responsibility:', err);
                                                                    toast({ title: "Error", description: "Failed to save responsibility", variant: "destructive" });
                                                                } finally {
                                                                    setIsSubmitting(false);
                                                                }
                                                            }}
                                                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group border ${isAlreadyAssigned
                                                                ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                                                                : 'bg-white border-gray-100 hover:bg-blue-50 hover:border-blue-200 shadow-sm'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm text-sm ${isAlreadyAssigned ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
                                                                    {emp.firstName?.charAt(0)}
                                                                </div>
                                                                <div className="flex flex-col text-left">
                                                                    <span className={`text-sm font-bold ${isAlreadyAssigned ? 'text-gray-400' : 'text-gray-700'}`}>{emp.firstName} {emp.lastName}</span>
                                                                    <span className="text-[11px] text-gray-400 font-medium">{emp.designation?.name || emp.designation || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                            {isAlreadyAssigned ? (
                                                                <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 uppercase tracking-wider">Already Assigned</span>
                                                            ) : (
                                                                <span className="text-xs font-bold text-gray-300 group-hover:text-blue-500">Select</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}


                                </form>
                            </div>

                            {/* Modal Footer */}
                            {modalType !== 'ownerVisaTypeSelection' && modalType !== 'assignEmployee' && (
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
                                        {isSubmitting ? 'Updating...' : (modalType.startsWith('owner') || modalType === 'addNewCategory' ? 'Save' : 'Update')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DocumentViewerModal
                    isOpen={!!viewingDocument}
                    onClose={() => setViewingDocument(null)}
                    viewingDocument={viewingDocument}
                />

                <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
                    <AlertDialogContent className="bg-white rounded-3xl border-gray-100 shadow-2xl p-8">
                        <AlertDialogHeader className="mb-4">
                            <AlertDialogTitle className="text-xl font-bold text-gray-800">Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-500 font-medium">
                                This will remove the assigned responsibility for this employee. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel className="rounded-xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all px-6">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRemoveConfirm}
                                className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-100 px-8"
                            >
                                Remove Responsibility
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
