'use client';

import { useState, useRef, useEffect } from 'react';

export default function TabNavigation({
    activeTab,
    setActiveTab,
    setActiveSubTab,
    hasDocuments = false,
    hasTraining = false,
    onTrainingClick = null,
    onDocumentsClick = null,
    isCompanyProfile = false,
    employee = null
}) {
    const isPending = (sections) => {
        const pendingChanges = employee?.pendingReactivationChanges || [];
        return pendingChanges.some(c => {
            const s = String(c?.section || '').toLowerCase();
            const cd = String(c?.card || '').toLowerCase();
            return sections.some(target => s.includes(target) || cd.includes(target));
        });
    };
    const [showAddMoreDropdown, setShowAddMoreDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowAddMoreDropdown(false);
            }
        };

        if (showAddMoreDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAddMoreDropdown]);

    const handleAddMoreOption = (option) => {
        setShowAddMoreDropdown(false);
        // Handle each option - switch to appropriate tab when clicked
        if (option === 'documents') {
            setActiveTab('documents');
            if (onDocumentsClick) {
                onDocumentsClick();
            }
        } else if (option === 'training') {
            // Switch to training tab first, then open modal
            setActiveTab('training');
            // Use setTimeout to ensure tab is rendered before opening modal
            setTimeout(() => {
                if (onTrainingClick) {
                    onTrainingClick();
                }
            }, 0);
        }
        // Handle other options here as needed
        console.log('Selected option:', option);
    };

    return (
        <>
            <div className="px-6 pt-4">
                <div className="rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between bg-transparent">
                    <div className="flex items-center gap-6 text-sm font-semibold">
                        <button
                            onClick={() => { setActiveTab('basic'); setActiveSubTab('basic-details'); }}
                            className={`relative pb-2 transition-colors flex items-center ${activeTab === 'basic'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Basic Details
                            {isPending(['basicdetails', 'passport', 'visa', 'emiratesid', 'labourcard', 'medicalinsurance', 'drivinglicense']) && (
                                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('work-details')}
                            className={`relative pb-2 transition-colors flex items-center ${activeTab === 'work-details'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Work Details
                            {isPending(['workdetails', 'signature']) && (
                                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                            )}
                        </button>
                        {!isCompanyProfile && (
                            <button
                                onClick={() => setActiveTab('salary')}
                                className={`relative pb-2 transition-colors flex items-center ${activeTab === 'salary'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Salary
                                {isPending(['salarydetails', 'bankdetails']) && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {!isCompanyProfile && (
                            <button
                                onClick={() => { setActiveTab('personal'); setActiveSubTab('personal-info'); }}
                                className={`relative pb-2 transition-colors flex items-center ${activeTab === 'personal'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Personal Information
                                {isPending(['personaldetails', 'emergencycontacts']) && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {!isCompanyProfile && (
                            <button
                                onClick={() => setActiveTab('documents')}
                                className={`relative pb-2 transition-colors flex items-center ${activeTab === 'documents'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Documents
                                {isPending(['document']) && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {(hasTraining || activeTab === 'training') && (
                            <button
                                onClick={() => setActiveTab('training')}
                                className={`relative pb-2 transition-colors ${activeTab === 'training'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Training
                            </button>
                        )}
                    </div>

                    {activeTab === 'training' && (
                        <button
                            onClick={onTrainingClick}
                            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-md flex items-center gap-2 shadow-sm"
                        >
                            <span>+</span> Add Training
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

