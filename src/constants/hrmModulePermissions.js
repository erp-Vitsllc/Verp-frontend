/**
 * HRM permission tree for Settings → Groups (create/edit).
 * Keep in sync with VERP_backend/constants/hrmModulePermissions.js (used by permissionService MODULES_STRUCTURE).
 */

const ownerCompanyDocs = [
    {
        id: 'hrm_company_view_owner_details',
        label: 'Owner Details',
        parent: 'hrm_company_view_owner',
        hasDownload: false,
    },
    { id: 'hrm_company_view_owner_passport', label: 'Passport', parent: 'hrm_company_view_owner', hasDownload: true },
    { id: 'hrm_company_view_owner_visa', label: 'Visa', parent: 'hrm_company_view_owner', hasDownload: true },
    { id: 'hrm_company_view_owner_labour_card', label: 'Labour Card', parent: 'hrm_company_view_owner', hasDownload: true },
    { id: 'hrm_company_view_owner_emirates_id', label: 'Emirates ID', parent: 'hrm_company_view_owner', hasDownload: true },
    { id: 'hrm_company_view_owner_medical_insurance', label: 'Medical Insurance', parent: 'hrm_company_view_owner', hasDownload: true },
    { id: 'hrm_company_view_owner_driving_license', label: 'Driving License', parent: 'hrm_company_view_owner', hasDownload: true },
];

/** Company Documents → Live: granular rows (with / without expiry). Tab visibility uses these ids. */
export const COMPANY_DOCUMENTS_LIVE_GRANULAR_IDS = [
    'hrm_company_view_documents_live_with_expiry',
    'hrm_company_view_documents_live_without_expiry',
];

const companyDocumentsLiveChildren = [
    {
        id: 'hrm_company_view_documents_live_with_expiry',
        label: 'Document with expiry',
        parent: 'hrm_company_view_documents_live',
        hasDownload: true,
    },
    {
        id: 'hrm_company_view_documents_live_without_expiry',
        label: 'Document without expiry',
        parent: 'hrm_company_view_documents_live',
        hasDownload: true,
    },
];

const companyDocumentsChildren = [
    {
        id: 'hrm_company_view_documents_live',
        label: 'Live document',
        parent: 'hrm_company_view_documents',
        hasDownload: false,
        children: companyDocumentsLiveChildren,
    },
    { id: 'hrm_company_view_documents_moa', label: 'MOA', parent: 'hrm_company_view_documents', hasDownload: true },
    { id: 'hrm_company_view_documents_memo', label: 'Memo', parent: 'hrm_company_view_documents', hasDownload: true },
    { id: 'hrm_company_view_documents_certificate', label: 'Certificate', parent: 'hrm_company_view_documents', hasDownload: true },
    { id: 'hrm_company_view_documents_old', label: 'Old Documents', parent: 'hrm_company_view_documents', hasDownload: true },
];

const employeeBasicChildren = [
    { id: 'hrm_employees_view_basic', label: 'Basic details card', parent: 'hrm_employees_view_basic_details', hasDownload: false },
    { id: 'hrm_employees_view_passport', label: 'Passport', parent: 'hrm_employees_view_basic_details', hasDownload: true },
    { id: 'hrm_employees_view_visa', label: 'Visa', parent: 'hrm_employees_view_basic_details', hasDownload: true },
    { id: 'hrm_employees_view_emirates_id', label: 'Emirates ID', parent: 'hrm_employees_view_basic_details', hasDownload: true },
    { id: 'hrm_employees_view_labour_card', label: 'Labour Card', parent: 'hrm_employees_view_basic_details', hasDownload: true },
    { id: 'hrm_employees_view_driving_license', label: 'Driving License', parent: 'hrm_employees_view_basic_details', hasDownload: true },
    { id: 'hrm_employees_view_medical_insurance', label: 'Medical Insurance', parent: 'hrm_employees_view_basic_details', hasDownload: true },
];

/** Salary tab in profile: Reward/Fine/NCR/Loan/Advance/Asset use top-level HRM modules (hrm_*), not duplicate rows here. */
const employeeSalaryChildren = [
    { id: 'hrm_employees_view_salary', label: 'Salary', parent: 'hrm_employees_view_salary_section', hasDownload: true },
    { id: 'hrm_employees_view_bank', label: 'Bank Details', parent: 'hrm_employees_view_salary_section', hasDownload: true },
    { id: 'hrm_employees_view_salary_certificate', label: 'Certificate', parent: 'hrm_employees_view_salary_section', hasDownload: true },
];

const employeePersonalChildren = [
    { id: 'hrm_employees_view_personal', label: 'Personal Details', parent: 'hrm_employees_view_personal_details', hasDownload: false },
    { id: 'hrm_employees_view_permanent_address', label: 'Permanent Address', parent: 'hrm_employees_view_personal_details', hasDownload: false },
    { id: 'hrm_employees_view_current_address', label: 'Current Address', parent: 'hrm_employees_view_personal_details', hasDownload: false },
    { id: 'hrm_employees_view_emergency', label: 'Emergency Contacts', parent: 'hrm_employees_view_personal_details', hasDownload: false },
    { id: 'hrm_employees_view_education', label: 'Education', parent: 'hrm_employees_view_personal_details', hasDownload: true },
    { id: 'hrm_employees_view_experience', label: 'Experience', parent: 'hrm_employees_view_personal_details', hasDownload: true },
];

/** Expiry-type manual docs on employee Documents (Live + Old tabs). If neither id exists on the user's group payload, expiry rows follow Live/Old tab View only (legacy). */
export const EMPLOYEE_DOCUMENTS_LIVE_GRANULAR_IDS = [
    'hrm_employees_view_documents_live_with_expiry',
    'hrm_employees_view_documents_live_without_expiry',
];

const employeeDocumentsLiveChildren = [
    { id: 'hrm_employees_view_documents_live_with_expiry', label: 'Document with expiry', parent: 'hrm_employees_view_documents_live', hasDownload: true },
    { id: 'hrm_employees_view_documents_live_without_expiry', label: 'Document without expiry', parent: 'hrm_employees_view_documents_live', hasDownload: true },
];

const employeeDocumentsChildren = [
    {
        id: 'hrm_employees_view_documents_live',
        label: 'Live document',
        parent: 'hrm_employees_view_documents',
        hasDownload: false,
        children: employeeDocumentsLiveChildren,
    },
    { id: 'hrm_employees_view_documents_old', label: 'Old Documents', parent: 'hrm_employees_view_documents', hasDownload: true },
];

/** Vehicle Asset — hierarchical permissions (list, add, view tabs & cards). */
const vehicleBasicCardChildren = [
    {
        id: 'hrm_asset_vehicle_view_basic_vehicle',
        label: 'Vehicle details card',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: false,
    },
    {
        id: 'hrm_asset_vehicle_view_basic_insurance',
        label: 'Insurance',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: true,
    },
    {
        id: 'hrm_asset_vehicle_view_basic_mulkia',
        label: 'Mulkia (Registration)',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: true,
    },
    {
        id: 'hrm_asset_vehicle_view_basic_petrol',
        label: 'Petrol tag',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: true,
    },
    {
        id: 'hrm_asset_vehicle_view_basic_toll',
        label: 'Toll tag (Salik / Darb)',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: true,
    },
    {
        id: 'hrm_asset_vehicle_view_basic_warranty',
        label: 'Warranty',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: true,
    },
    {
        id: 'hrm_asset_vehicle_view_basic_mortgage',
        label: 'Mortgage',
        parent: 'hrm_asset_vehicle_view_basic',
        hasDownload: true,
    },
];

const vehicleDocumentsChildren = [
    {
        id: 'hrm_asset_vehicle_view_documents_live',
        label: 'Live Documents',
        parent: 'hrm_asset_vehicle_view_document',
        hasDownload: false,
    },
    {
        id: 'hrm_asset_vehicle_view_documents_old',
        label: 'Old Documents',
        parent: 'hrm_asset_vehicle_view_document',
        hasDownload: true,
    },
];

export const VEHICLE_ASSET_MODULE = {
    id: 'hrm_asset_vehicle',
    label: 'Vehicle Asset',
    parent: 'hrm_asset',
    hasDownload: false,
    children: [
        { id: 'hrm_asset_vehicle_list', label: 'Vehicle List', parent: 'hrm_asset_vehicle', hasDownload: true },
        { id: 'hrm_asset_vehicle_add', label: 'Add Vehicle', parent: 'hrm_asset_vehicle', hasDownload: false },
        {
            id: 'hrm_asset_vehicle_dashboard',
            label: 'Fleet Dashboard',
            parent: 'hrm_asset_vehicle',
            hasDownload: false,
        },
        {
            id: 'hrm_asset_vehicle_service_requests',
            label: 'Service Requests',
            parent: 'hrm_asset_vehicle',
            hasDownload: false,
        },
        {
            id: 'hrm_asset_vehicle_view',
            label: 'View Vehicle',
            parent: 'hrm_asset_vehicle',
            hasDownload: false,
            children: [
                {
                    id: 'hrm_asset_vehicle_view_basic',
                    label: 'Basic Details',
                    parent: 'hrm_asset_vehicle_view',
                    hasDownload: false,
                    children: vehicleBasicCardChildren,
                },
                {
                    id: 'hrm_asset_vehicle_view_permit',
                    label: 'Permit',
                    parent: 'hrm_asset_vehicle_view',
                    hasDownload: false,
                    children: [
                        {
                            id: 'hrm_asset_vehicle_view_permit_card',
                            label: 'Permit card',
                            parent: 'hrm_asset_vehicle_view_permit',
                            hasDownload: true,
                        },
                    ],
                },
                { id: 'hrm_asset_vehicle_view_fine', label: 'Fine', parent: 'hrm_asset_vehicle_view', hasDownload: true },
                { id: 'hrm_asset_vehicle_view_service', label: 'Service', parent: 'hrm_asset_vehicle_view', hasDownload: true },
                {
                    id: 'hrm_asset_vehicle_view_handover',
                    label: 'Handover',
                    parent: 'hrm_asset_vehicle_view',
                    hasDownload: false,
                },
                { id: 'hrm_asset_vehicle_view_history', label: 'History', parent: 'hrm_asset_vehicle_view', hasDownload: true },
                {
                    id: 'hrm_asset_vehicle_view_document',
                    label: 'Document',
                    parent: 'hrm_asset_vehicle_view',
                    hasDownload: false,
                    children: vehicleDocumentsChildren,
                },
                {
                    id: 'hrm_asset_vehicle_view_activation',
                    label: 'Profile activation',
                    parent: 'hrm_asset_vehicle_view',
                    hasDownload: false,
                },
            ],
        },
    ],
};

/** Asset permissions — child of HRM in group matrix. */
export const ASSET_MODULE = {
    id: 'hrm_asset',
    label: 'Asset',
    parent: 'hrm',
    hasDownload: true,
    children: [
        VEHICLE_ASSET_MODULE,
        { id: 'hrm_asset_tools', label: 'Tools Asset', parent: 'hrm_asset', hasDownload: true },
    ],
};

/** Full HRM node for group permission UI (merged into MODULES array). */
export const HRM_MODULE = {
    id: 'hrm',
    label: 'HRM',
    parent: null,
    hasDownload: false,
    children: [
        {
            id: 'hrm_company',
            label: 'Company',
            parent: 'hrm',
            hasDownload: false,
            children: [
                { id: 'hrm_company_list', label: 'Company List', parent: 'hrm_company', hasDownload: true },
                { id: 'hrm_company_add', label: 'Add Company', parent: 'hrm_company', hasDownload: false },
                {
                    id: 'hrm_company_view',
                    label: 'View Company',
                    parent: 'hrm_company',
                    hasDownload: false,
                    children: [
                        {
                            id: 'hrm_company_view_basic',
                            label: 'Basic Details',
                            parent: 'hrm_company_view',
                            hasDownload: true,
                            children: [
                                {
                                    id: 'hrm_company_view_basic_trade_license',
                                    label: 'Trade License',
                                    parent: 'hrm_company_view_basic',
                                    hasDownload: true,
                                },
                                {
                                    id: 'hrm_company_view_basic_establishment_card',
                                    label: 'Establishment Card',
                                    parent: 'hrm_company_view_basic',
                                    hasDownload: true,
                                },
                                { id: 'hrm_company_view_basic_ejari', label: 'Ejari', parent: 'hrm_company_view_basic', hasDownload: true },
                                {
                                    id: 'hrm_company_view_basic_address',
                                    label: 'Company Address',
                                    parent: 'hrm_company_view_basic',
                                    hasDownload: false,
                                },
                            ],
                        },
                        {
                            id: 'hrm_company_view_owner',
                            label: 'Owner Information',
                            parent: 'hrm_company_view',
                            hasDownload: false,
                            children: ownerCompanyDocs,
                        },
                        { id: 'hrm_company_view_assets', label: 'Assets', parent: 'hrm_company_view', hasDownload: false },
                        { id: 'hrm_company_view_fine', label: 'Fine', parent: 'hrm_company_view', hasDownload: false },
                        {
                            id: 'hrm_company_view_documents',
                            label: 'Documents',
                            parent: 'hrm_company_view',
                            hasDownload: false,
                            children: companyDocumentsChildren,
                        },
                    ],
                },
            ],
        },
        {
            id: 'hrm_employees',
            label: 'Employees',
            parent: 'hrm',
            hasDownload: false,
            children: [
                { id: 'hrm_employees_add', label: 'Add Employee', parent: 'hrm_employees', hasDownload: false },
                { id: 'hrm_employees_list', label: 'Employee List', parent: 'hrm_employees', hasDownload: false },
                {
                    id: 'hrm_employees_view',
                    label: 'View Employee',
                    parent: 'hrm_employees',
                    hasDownload: false,
                    children: [
                        {
                            id: 'hrm_employees_view_basic_details',
                            label: 'Basic Details',
                            parent: 'hrm_employees_view',
                            hasDownload: false,
                            children: employeeBasicChildren,
                        },
                        {
                            id: 'hrm_employees_view_work_details',
                            label: 'Work Details',
                            parent: 'hrm_employees_view',
                            hasDownload: false,
                            children: [
                                {
                                    id: 'hrm_employees_view_work',
                                    label: 'Digital Signature',
                                    parent: 'hrm_employees_view_work_details',
                                    hasDownload: false,
                                },
                                {
                                    id: 'hrm_employees_view_work_employee',
                                    label: 'Work Details',
                                    parent: 'hrm_employees_view_work_details',
                                    hasDownload: false,
                                },
                            ],
                        },
                        {
                            id: 'hrm_employees_view_salary_section',
                            label: 'Salary',
                            parent: 'hrm_employees_view',
                            hasDownload: false,
                            children: employeeSalaryChildren,
                        },
                        {
                            id: 'hrm_employees_view_personal_details',
                            label: 'Personal Details',
                            parent: 'hrm_employees_view',
                            hasDownload: false,
                            children: employeePersonalChildren,
                        },
                        {
                            id: 'hrm_employees_view_documents',
                            label: 'Documents',
                            parent: 'hrm_employees_view',
                            hasDownload: false,
                            children: employeeDocumentsChildren,
                        },
                        {
                            id: 'hrm_employees_view_activation',
                            label: 'Activation / Add',
                            parent: 'hrm_employees_view',
                            hasDownload: false,
                        },
                    ],
                },
            ],
        },
        { id: 'hrm_attendance', label: 'Attendance', parent: 'hrm', hasDownload: true },
        { id: 'hrm_leave', label: 'Leave', parent: 'hrm', hasDownload: true },
        { id: 'hrm_ncr', label: 'NCR', parent: 'hrm', hasDownload: true },
        { id: 'hrm_fine', label: 'Fine', parent: 'hrm', hasDownload: true },
        { id: 'hrm_loan', label: 'Loan / Advance', parent: 'hrm', hasDownload: true },
        { id: 'hrm_reward', label: 'Reward', parent: 'hrm', hasDownload: true },
        ASSET_MODULE,
    ],
};

/** Company profile main tabs: show tab if View on any listed module (or admin). */
export const COMPANY_MAIN_TAB_MODULES = {
    basic: [
        'hrm_company_view_basic',
        'hrm_company_view_basic_trade_license',
        'hrm_company_view_basic_establishment_card',
        'hrm_company_view_basic_ejari',
        'hrm_company_view_basic_address',
    ],
    owner: [
        'hrm_company_view_owner',
        'hrm_company_view_owner_details',
        'hrm_company_view_owner_passport',
        'hrm_company_view_owner_visa',
        'hrm_company_view_owner_labour_card',
        'hrm_company_view_owner_emirates_id',
        'hrm_company_view_owner_medical_insurance',
        'hrm_company_view_owner_driving_license',
    ],
    assets: ['hrm_company_view_assets'],
    fine: ['hrm_company_view_fine'],
    documents: [
        'hrm_company_view_documents',
        'hrm_company_view_documents_live',
        ...COMPANY_DOCUMENTS_LIVE_GRANULAR_IDS,
        'hrm_company_view_documents_moa',
        'hrm_company_view_documents_memo',
        'hrm_company_view_documents_certificate',
        'hrm_company_view_documents_old',
    ],
    /** Company profile reuses the employee shell; "Work Details" maps to owner cards. */
    'work-details': [
        'hrm_company_view_owner',
        'hrm_company_view_owner_details',
        'hrm_company_view_owner_passport',
        'hrm_company_view_owner_visa',
        'hrm_company_view_owner_labour_card',
        'hrm_company_view_owner_emirates_id',
        'hrm_company_view_owner_medical_insurance',
        'hrm_company_view_owner_driving_license',
    ],
};

/** Employee profile main tabs. */
export const EMPLOYEE_MAIN_TAB_MODULES = {
    basic: [
        'hrm_employees_view_basic_details',
        'hrm_employees_view_basic',
        'hrm_employees_view_passport',
        'hrm_employees_view_visa',
        'hrm_employees_view_emirates_id',
        'hrm_employees_view_labour_card',
        'hrm_employees_view_medical_insurance',
        'hrm_employees_view_driving_license',
    ],
    'work-details': ['hrm_employees_view_work_details', 'hrm_employees_view_work', 'hrm_employees_view_work_employee'],
    salary: [
        'hrm_employees_view_salary_section',
        'hrm_employees_view_salary',
        'hrm_employees_view_bank',
        'hrm_employees_view_salary_certificate',
        'hrm_reward',
        'hrm_fine',
        'hrm_ncr',
        'hrm_loan',
        'hrm_asset',
    ],
    personal: [
        'hrm_employees_view_personal_details',
        'hrm_employees_view_personal',
        'hrm_employees_view_permanent_address',
        'hrm_employees_view_current_address',
        'hrm_employees_view_emergency',
        'hrm_employees_view_education',
        'hrm_employees_view_experience',
    ],
    documents: [
        'hrm_employees_view_documents',
        'hrm_employees_view_documents_live',
        ...EMPLOYEE_DOCUMENTS_LIVE_GRANULAR_IDS,
        'hrm_employees_view_documents_old',
    ],
    /** Training is not a separate group permission; tab uses View Employee + list edit for actions. */
    training: ['hrm_employees_view', 'hrm_employees_list'],
};

/** Vehicle profile main tabs — show tab if View on any listed module (or admin). */
export const VEHICLE_MAIN_TAB_MODULES = {
    basic: [
        'hrm_asset_vehicle_view_basic',
        'hrm_asset_vehicle_view_basic_vehicle',
        'hrm_asset_vehicle_view_basic_insurance',
        'hrm_asset_vehicle_view_basic_mulkia',
        'hrm_asset_vehicle_view_basic_petrol',
        'hrm_asset_vehicle_view_basic_toll',
        'hrm_asset_vehicle_view_basic_warranty',
        'hrm_asset_vehicle_view_basic_mortgage',
    ],
    permit: ['hrm_asset_vehicle_view_permit', 'hrm_asset_vehicle_view_permit_card'],
    fine: ['hrm_asset_vehicle_view_fine'],
    service: ['hrm_asset_vehicle_view_service'],
    handover: ['hrm_asset_vehicle_view_handover'],
    history: ['hrm_asset_vehicle_view_history'],
    document: [
        'hrm_asset_vehicle_view_document',
        'hrm_asset_vehicle_view_documents_live',
        'hrm_asset_vehicle_view_documents_old',
    ],
};

/** Basic Details tab cards → permission module ids. */
export const VEHICLE_BASIC_CARD_MODULES = {
    vehicle: ['hrm_asset_vehicle_view_basic_vehicle', 'hrm_asset_vehicle_view_basic'],
    insurance: ['hrm_asset_vehicle_view_basic_insurance', 'hrm_asset_vehicle_view_basic'],
    mulkia: ['hrm_asset_vehicle_view_basic_mulkia', 'hrm_asset_vehicle_view_basic'],
    petrol: ['hrm_asset_vehicle_view_basic_petrol', 'hrm_asset_vehicle_view_basic'],
    toll: ['hrm_asset_vehicle_view_basic_toll', 'hrm_asset_vehicle_view_basic'],
    warranty: ['hrm_asset_vehicle_view_basic_warranty', 'hrm_asset_vehicle_view_basic'],
    mortgage: ['hrm_asset_vehicle_view_basic_mortgage', 'hrm_asset_vehicle_view_basic'],
};

/** Document tab inner tabs — View on row opens Live or Old tab only. */
export const VEHICLE_DOCUMENT_INNER_TAB_MODULES = {
    live: ['hrm_asset_vehicle_view_documents_live', 'hrm_asset_vehicle_view_document'],
    old: ['hrm_asset_vehicle_view_documents_old', 'hrm_asset_vehicle_view_document'],
};
