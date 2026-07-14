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
import { navHrefProps } from '@/utils/linkContextMenu';

export default function TabNavigation({
    activeTab,
    onTabChange,
    getTabHref,
    hasDocuments = false,
    hasTraining = false,
    onTrainingClick = null,
    onDocumentsClick = null,
    isCompanyProfile = false,
    employee = null,
    viewerCanSeePendingActivationQueue = false,
}) {
    const tabPerm = (tabKey) => {
        if (isAdmin()) return true;
        const map = isCompanyProfile ? COMPANY_MAIN_TAB_MODULES : EMPLOYEE_MAIN_TAB_MODULES;
        return canViewAnyOf(map[tabKey] || []);
    };

    const trainingCreate = isCompanyProfile ? false : employeeTrainingAccess().create;

    const normKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const isSectionPending = (sections, { excludeCardIncludes = [] } = {}) => {
        if (!viewerCanSeePendingActivationQueue) return false;
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

    const isSalaryTabPending =
        isSalaryDetailsPending(employee, viewerCanSeePendingActivationQueue) ||
        isBankDetailsPending(employee, viewerCanSeePendingActivationQueue);

    const isPersonalTabPending =
        isPersonalDetailsPending(employee, viewerCanSeePendingActivationQueue) ||
        isEmergencyContactPending(employee, viewerCanSeePendingActivationQueue);

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

    const tabBtn = (isActive) =>
        `relative pb-2 transition-colors flex items-center whitespace-nowrap text-xs sm:text-sm ${
            isActive
                ? "text-blue-600 after:content-[''] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500"
                : 'text-gray-400 hover:text-gray-600'
        }`;

    return (
        <>
            <div className="px-2 sm:px-4 lg:px-6 pt-3 sm:pt-4">
                <div className="rounded-2xl shadow-sm px-2 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-transparent">
                    <div
                        role="tablist"
                        className="flex items-center gap-3 sm:gap-4 lg:gap-6 font-semibold overflow-x-auto w-full pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {tabPerm('basic') && (
                        <button
                            type="button"
                            {...navHrefProps(typeof getTabHref === 'function' ? getTabHref('basic') : '')}
                            onClick={() => onTabChange('basic')}
                            className={tabBtn(activeTab === 'basic')}
                        >
                            Basic Details
                            {isBasicTabPending && (
                                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                            )}
                        </button>
                        )}
                        {tabPerm('work-details') && (
                        <button
                            type="button"
                            {...navHrefProps(typeof getTabHref === 'function' ? getTabHref('work-details') : '')}
                            onClick={() => onTabChange('work-details')}
                            className={tabBtn(activeTab === 'work-details')}
                        >
                            Work Details
                            {isWorkTabPending && (
                                <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                            )}
                        </button>
                        )}
                        {!isCompanyProfile && tabPerm('salary') && (
                            <button
                                type="button"
                                {...navHrefProps(typeof getTabHref === 'function' ? getTabHref('salary') : '')}
                                onClick={() => onTabChange('salary')}
                                className={tabBtn(activeTab === 'salary')}
                            >
                                Salary
                                {isSalaryTabPending && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {!isCompanyProfile && tabPerm('personal') && (
                            <button
                                type="button"
                                {...navHrefProps(
                                    typeof getTabHref === 'function'
                                        ? getTabHref('personal', { subTab: 'personal-info' })
                                        : '',
                                )}
                                onClick={() => onTabChange('personal', { subTab: 'personal-info' })}
                                className={tabBtn(activeTab === 'personal')}
                            >
                                Personal Information
                                {isPersonalTabPending && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {!isCompanyProfile && tabPerm('documents') && (
                            <button
                                type="button"
                                {...navHrefProps(typeof getTabHref === 'function' ? getTabHref('documents') : '')}
                                onClick={() => onTabChange('documents')}
                                className={tabBtn(activeTab === 'documents')}
                            >
                                Documents
                                {isDocumentsTabPending && (
                                    <span className="ml-2 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse" title="pending changes in this tab">!</span>
                                )}
                            </button>
                        )}
                        {(hasTraining || activeTab === 'training') && tabPerm('training') && (
                            <button
                                type="button"
                                {...navHrefProps(typeof getTabHref === 'function' ? getTabHref('training') : '')}
                                onClick={() => onTabChange('training')}
                                className={tabBtn(activeTab === 'training')}
                            >
                                Training
                            </button>
                        )}
                    </div>

                    {activeTab === 'training' && trainingCreate && (
                        <button
                            onClick={onTrainingClick}
                            className="px-3 sm:px-5 py-1.5 sm:py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-md flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
                        >
                            <span>+</span> Add Training
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
