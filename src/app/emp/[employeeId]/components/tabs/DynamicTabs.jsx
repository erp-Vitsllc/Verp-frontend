'use client';

import dynamic from 'next/dynamic';

// Dynamic imports for all tabs - loaded only when tab is active
// This reduces initial bundle size significantly

const BasicTab = dynamic(
    () => import('./BasicTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
            </div>
        ),
        ssr: false
    }
);

const WorkDetailsTab = dynamic(
    () => import('./WorkDetailsTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const SalaryTab = dynamic(
    () => import('./SalaryTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const PersonalTab = dynamic(
    () => import('./PersonalTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const DocumentsTab = dynamic(
    () => import('./DocumentsTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const TrainingTab = dynamic(
    () => import('./TrainingTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

export { BasicTab, WorkDetailsTab, SalaryTab, PersonalTab, DocumentsTab, TrainingTab };




import dynamic from 'next/dynamic';

// Dynamic imports for all tabs - loaded only when tab is active
// This reduces initial bundle size significantly

const BasicTab = dynamic(
    () => import('./BasicTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
            </div>
        ),
        ssr: false
    }
);

const WorkDetailsTab = dynamic(
    () => import('./WorkDetailsTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const SalaryTab = dynamic(
    () => import('./SalaryTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const PersonalTab = dynamic(
    () => import('./PersonalTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const DocumentsTab = dynamic(
    () => import('./DocumentsTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

const TrainingTab = dynamic(
    () => import('./TrainingTab').then(mod => mod.default),
    {
        loading: () => (
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            </div>
        ),
        ssr: false
    }
);

export { BasicTab, WorkDetailsTab, SalaryTab, PersonalTab, DocumentsTab, TrainingTab };



