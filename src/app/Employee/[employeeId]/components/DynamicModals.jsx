'use client';

import dynamic from 'next/dynamic';

// Dynamic imports for all modals - loaded only when modals open
// This reduces initial bundle size by ~40-50%

export const WorkDetailsModal = dynamic(
    () => import('./modals/WorkDetailsModal').then(mod => mod.default),
    {
        loading: () => null, // Don't show skeleton until modal opens
        ssr: false
    }
);

export const PassportModal = dynamic(
    () => import('./modals/PassportModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const VisaModal = dynamic(
    () => import('./modals/VisaModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const BankDetailsModal = dynamic(
    () => import('./modals/BankDetailsModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const AddressModal = dynamic(
    () => import('./modals/AddressModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const ContactModal = dynamic(
    () => import('./modals/ContactModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const PersonalDetailsModal = dynamic(
    () => import('./modals/PersonalDetailsModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const EducationModal = dynamic(
    () => import('./modals/EducationModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const ExperienceModal = dynamic(
    () => import('./modals/ExperienceModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const SalaryModal = dynamic(
    () => import('./modals/SalaryModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const EmiratesIdModal = dynamic(
    () => import('./modals/EmiratesIdModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const LabourCardModal = dynamic(
    () => import('./modals/LabourCardModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const MedicalInsuranceModal = dynamic(
    () => import('./modals/MedicalInsuranceModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const DrivingLicenseModal = dynamic(
    () => import('./modals/DrivingLicenseModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const DocumentModal = dynamic(
    () => import('./modals/DocumentModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const TrainingModal = dynamic(
    () => import('./modals/TrainingModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const BasicDetailsModal = dynamic(
    () => import('./modals/BasicDetailsModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const ImageUploadModal = dynamic(
    () => import('./modals/ImageUploadModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const DocumentViewerModal = dynamic(
    () => import('./modals/DocumentViewerModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

import dynamic from 'next/dynamic';

// Dynamic imports for all modals - loaded only when modals open
// This reduces initial bundle size by ~40-50%

export const WorkDetailsModal = dynamic(
    () => import('./modals/WorkDetailsModal').then(mod => mod.default),
    {
        loading: () => null, // Don't show skeleton until modal opens
        ssr: false
    }
);

export const PassportModal = dynamic(
    () => import('./modals/PassportModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const VisaModal = dynamic(
    () => import('./modals/VisaModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const BankDetailsModal = dynamic(
    () => import('./modals/BankDetailsModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const AddressModal = dynamic(
    () => import('./modals/AddressModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const ContactModal = dynamic(
    () => import('./modals/ContactModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const PersonalDetailsModal = dynamic(
    () => import('./modals/PersonalDetailsModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const EducationModal = dynamic(
    () => import('./modals/EducationModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const ExperienceModal = dynamic(
    () => import('./modals/ExperienceModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const SalaryModal = dynamic(
    () => import('./modals/SalaryModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const EmiratesIdModal = dynamic(
    () => import('./modals/EmiratesIdModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const LabourCardModal = dynamic(
    () => import('./modals/LabourCardModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const MedicalInsuranceModal = dynamic(
    () => import('./modals/MedicalInsuranceModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const DrivingLicenseModal = dynamic(
    () => import('./modals/DrivingLicenseModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const DocumentModal = dynamic(
    () => import('./modals/DocumentModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const TrainingModal = dynamic(
    () => import('./modals/TrainingModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const BasicDetailsModal = dynamic(
    () => import('./modals/BasicDetailsModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const ImageUploadModal = dynamic(
    () => import('./modals/ImageUploadModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);

export const DocumentViewerModal = dynamic(
    () => import('./modals/DocumentViewerModal').then(mod => mod.default),
    {
        loading: () => null,
        ssr: false
    }
);
