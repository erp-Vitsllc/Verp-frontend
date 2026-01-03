'use client';

import { useState, useRef, useEffect } from 'react';

export default function TabNavigation({
    activeTab,
    setActiveTab,
    setActiveSubTab,
    hasDocuments = false,
    hasTraining = false,
    onTrainingClick = null,
    onDocumentsClick = null
}) {
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
                            className={`relative pb-2 transition-colors ${activeTab === 'basic'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Basic Details
                        </button>
                        <button
                            onClick={() => setActiveTab('work-details')}
                            className={`relative pb-2 transition-colors ${activeTab === 'work-details'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Work Details
                        </button>
                        <button
                            onClick={() => setActiveTab('salary')}
                            className={`relative pb-2 transition-colors ${activeTab === 'salary'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Salary
                        </button>
                        <button
                            onClick={() => { setActiveTab('personal'); setActiveSubTab('personal-info'); }}
                            className={`relative pb-2 transition-colors ${activeTab === 'personal'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Personal Information
                        </button>
                        {(hasDocuments || activeTab === 'documents') && (
                            <button
                                onClick={() => setActiveTab('documents')}
                                className={`relative pb-2 transition-colors ${activeTab === 'documents'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Documents
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
                    {activeTab === 'basic' && (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setShowAddMoreDropdown(!showAddMoreDropdown)}
                                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-md flex items-center gap-2 shadow-sm"
                            >
                                Add More
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {showAddMoreDropdown && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                    <button
                                        onClick={() => handleAddMoreOption('assets')}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                                    >
                                        Assets
                                    </button>
                                    <button
                                        onClick={() => handleAddMoreOption('leave-and-travel')}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                                    >
                                        Leave and Travel
                                    </button>
                                    {!hasDocuments && activeTab !== 'documents' && (
                                        <button
                                            onClick={() => handleAddMoreOption('documents')}
                                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                                        >
                                            Documents
                                        </button>
                                    )}
                                    {!hasTraining && activeTab !== 'training' && (
                                        <button
                                            onClick={() => handleAddMoreOption('training')}
                                            className={`w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 transition-colors ${!hasDocuments && activeTab !== 'documents' ? '' : 'rounded-b-lg'}`}
                                        >
                                            Training
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

