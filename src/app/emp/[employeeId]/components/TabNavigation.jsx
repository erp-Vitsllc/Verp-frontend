'use client';

import { useState, useRef, useEffect } from 'react';
import { EMPLOYEE_MAIN_TAB_MODULES, COMPANY_MAIN_TAB_MODULES } from '@/constants/hrmModulePermissions';
import { canViewAnyOf, isAdmin, employeeTrainingAccess } from '@/utils/permissions';
import {
    isBankDetailsPending,
    isEmergencyContactPending,
    isPersonalDetailsPending,
    isSalaryDetailsPending,
} from '@/utils/employeeActivationSections';

export default function TabNavigation({
    activeTab,
    onTabChange,
    hasDocuments = false,
    hasTraining = false,
    onTrainingClick = null,
    onDocumentsClick = null,
    isCompanyProfile = false,
    employee = null
}) {
    const tabPerm = (tabKey) => {
        if (isAdmin()) return true;
        const map = isCompanyProfile ? COMPANY_MAIN_TAB_MODULES : EMPLOYEE_MAIN_TAB_MODULES;
        return canViewAnyOf(map[tabKey] || []);
    };

    const trainingCreate = isCompanyProfile ? false : employeeTrainingAccess().create;

    const normKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const isSectionPending = (sections, { excludeCardIncludes = [] } = {}) => {
        const pendingChanges = employee?.pendingReactivationChanges || [];
        return pendingChanges.some((c) => {
            const s = normKey(c?.section);
            const cd = normKey(c?.card);
            if (excludeCardIncludes.some((ex) => cd.includes(normKey(ex)))) return false;
            return sections.some((target) => {
                const t = normKey(target);
                return s.includes(t) || cd.includes(t);
            });
        });
    };

    const isBasicTabPending =
        isSectionPending(
            ['passport', 'visa', 'emiratesid', 'labourcard', 'medicalinsurance', 'drivinglicense'],
        ) ||
        isSectionPending(['basicdetails'], { excludeCardIncludes: ['salary', 'bank'] });

    const isWorkTabPending = isSectionPending(['workdetails', 'signature']);

    const isSalaryTabPending = isSalaryDetailsPending(employee) || isBankDetailsPending(employee);

    const isPersonalTabPending =
        isPersonalDetailsPending(employee) || isEmergencyContactPending(employee);

    const isDocumentsTabPending = isSectionPending(['document']);
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
            onTabChange('documents');
            if (onDocumentsClick) {
                onDocumentsClick();
            }
        } else if (option === 'training') {
            // Switch to training tab first, then open modal
            onTabChange('training');
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
                        {tabPerm('basic') && (
                        <button
                            onClick={() => onTabChange('basic')}
                            className={`relative pb-2 transition-colors flex items-center ${activeTab === 'basic'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Basic Details
                            {isBasicTabPending && (
                                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                            )}
                        </button>
                        )}
                        {tabPerm('work-details') && (
                        <button
                            onClick={() => onTabChange('work-details')}
                            className={`relative pb-2 transition-colors flex items-center ${activeTab === 'work-details'
                                ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            Work Details
                            {isWorkTabPending && (
                                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                            )}
                        </button>
                        )}
                        {!isCompanyProfile && tabPerm('salary') && (
                            <button
                                onClick={() => onTabChange('salary')}
                                className={`relative pb-2 transition-colors flex items-center ${activeTab === 'salary'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Salary
                                {isSalaryTabPending && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {!isCompanyProfile && tabPerm('personal') && (
                            <button
                                onClick={() => onTabChange('personal', { subTab: 'personal-info' })}
                                className={`relative pb-2 transition-colors flex items-center ${activeTab === 'personal'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Personal Information
                                {isPersonalTabPending && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {!isCompanyProfile && tabPerm('documents') && (
                            <button
                                onClick={() => onTabChange('documents')}
                                className={`relative pb-2 transition-colors flex items-center ${activeTab === 'documents'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Documents
                                {isDocumentsTabPending && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {(hasTraining || activeTab === 'training') && tabPerm('training') && (
                            <button
                                onClick={() => onTabChange('training')}
                                className={`relative pb-2 transition-colors ${activeTab === 'training'
                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                Training
                            </button>
                        )}
                    </div>

                    {activeTab === 'training' && trainingCreate && (
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

