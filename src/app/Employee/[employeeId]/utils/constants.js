// Department options
export const departmentOptions = [
    { value: 'Human Resources (HR)', label: 'Human Resources (HR)' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Administration', label: 'Administration' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'IT', label: 'IT' },
    { value: 'Software Development', label: 'Software Development' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Customer Support', label: 'Customer Support' },
    { value: 'Procurement', label: 'Procurement' }
];

// Status options
export const statusOptions = [
    { value: 'Probation', label: 'Probation' },
    { value: 'Permanent', label: 'Permanent' },
    { value: 'Temporary', label: 'Temporary' },
    { value: 'Notice', label: 'Notice' }
];

// Get designation options based on selected department
export const getDesignationOptions = (department) => {
    const designationMap = {
        'Human Resources (HR)': [
            'HR Assistant',
            'HR Executive',
            'HR Manager',
            'HR Officer'
        ],
        'Finance': [
            'Accountant',
            'Senior Accountant',
            'Finance Executive',
            'Finance Manager'
        ],
        'Administration': [
            'Admin Assistant',
            'Admin Executive',
            'Admin Manager'
        ],
        'Sales': [
            'Sales Executive',
            'Senior Sales Executive',
            'Sales Supervisor',
            'Sales Manager'
        ],
        'Marketing': [
            'Marketing Executive',
            'Digital Marketer',
            'Marketing Coordinator',
            'Marketing Manager'
        ],
        'IT': [
            'IT Support',
            'IT Technician',
            'IT Administrator',
            'IT Manager'
        ],
        'Software Development': [
            'Junior Developer',
            'Software Developer',
            'Senior Developer',
            'Team Lead',
            'QA Tester'
        ],
        'Operations': [
            'Operations Assistant',
            'Operations Executive',
            'Operations Supervisor',
            'Operations Manager'
        ],
        'Customer Support': [
            'Customer Support Agent',
            'Senior Support Agent',
            'Support Supervisor'
        ],
        'Procurement': [
            'Procurement Assistant',
            'Procurement Executive',
            'Procurement Officer',
            'Procurement Manager'
        ]
    };
    return designationMap[department] || [];
};
















