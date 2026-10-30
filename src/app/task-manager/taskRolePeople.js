export function personKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Workflow titles and system actors were stored in requester/assignee fields. They are not employees. */
export function isTaskTitleName(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return true;
    const lower = text.toLowerCase();
    if ([
        'system',
        'unassigned',
        'task manager',
        'system monitor',
        'asset system',
        'hr',
        'accounts',
        'locator',
        'workflow task',
        'employee',
    ].includes(lower)) return true;
    if (/\bsystem\b/i.test(text) || /\bpending with\b/i.test(text) || /[—–]/.test(text)) return true;
    if (/\b(overdue|make payment|ready to service|on service|accounts approve|hr approval|complete service)\b/i.test(lower)) return true;
    return /^(oil service|mechanical work|tire change|tyre change|body work|accident repair|car wash|vehicle service)\b/i.test(lower);
}

export function basePersonName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** First name, then the first letter of the second name. "VISHNU PRASAD" is "VISHNU P". */
export function employeeListName(value) {
    const name = basePersonName(value);
    const parts = name.split(' ').filter(Boolean);
    if (parts.length < 2) return name;
    const letter = parts[1].replace(/[^A-Za-z]/g, '').charAt(0);
    if (!letter) return parts[0];
    return `${parts[0]} ${letter.toUpperCase()}`;
}

const TASK_PERSON_FIELDS = [
    'subjectName',
    'requesterBaseName',
    'requesterName',
    'assigneeName',
    'mainAssigneeName',
    'originalAssigneeName',
    'reassignedAssigneeName',
];

/** Shorten an employee name inside the task title lines. Dates, codes, and other lines stay as they are. */
export function listedTaskNameLines(task, lines) {
    const people = new Set(
        TASK_PERSON_FIELDS
            .map((field) => personKey(basePersonName(task?.[field])))
            .filter(Boolean),
    );
    return (lines || []).map((line) => (
        people.has(personKey(basePersonName(line))) ? employeeListName(line) : line
    ));
}

export function requesterEmployeeName(task) {
    const base = basePersonName(task?.requesterBaseName);
    if (base) return base;
    const raw = String(task?.requesterName || '').trim();
    const inner = raw.match(/\(([^)]+)\)\s*$/);
    if (inner) return basePersonName(inner[1]);
    return basePersonName(raw);
}

/** Employees who have at least one task in this role. System labels and workflow titles stay out. */
export function taskRolePeople(tasks, role, titleOf = () => '') {
    const titleKeys = new Set();
    tasks.forEach((task) => {
        titleKeys.add(personKey(task?.taskName));
        titleKeys.add(personKey(titleOf(task)));
    });
    const people = new Map();
    const add = (raw) => {
        const label = basePersonName(raw);
        const key = personKey(label);
        if (!key || titleKeys.has(key) || isTaskTitleName(label) || people.has(key)) return;
        people.set(key, label);
    };
    tasks.forEach((task) => {
        if (role === 'assignee') {
            add(task.assigneeName);
            add(task.mainAssigneeName);
            add(task.originalAssigneeName);
            add(task.reassignedAssigneeName);
            return;
        }
        add(requesterEmployeeName(task));
    });
    return [...people.entries()]
        .map(([key, name]) => ({ key, name }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
