function taskKey(task) {
    return String(task?.actionId || task?.taskNumber || '');
}

const WORK_ORDER_NO = /\bWO-(\d{2}|\d{4})-(\d+)\b/i;

/** WO-26-4 and WO-2026-004 are the same number as WO-26-004. */
export function normalizeWorkOrderNo(value) {
    const match = String(value || '').trim().match(WORK_ORDER_NO);
    if (!match) return '';
    const year = match[1].slice(-2);
    const sequence = String(Number(match[2])).padStart(3, '0');
    if (!Number(sequence)) return '';
    return `WO-${year}-${sequence}`;
}

/** The work order on the task, or the number written on a work-order task. */
export function workOrderNoOf(task) {
    const direct = normalizeWorkOrderNo(task?.workOrderNo);
    if (direct) return direct;
    const type = String(task?.requestType || '');
    const category = String(task?.taskCategory || '');
    if (!/^Work Order\b/i.test(type) && category !== 'Project Task') return '';
    const text = [
        task?.taskNumber,
        task?.displayTaskNumber,
        task?.taskName,
        task?.description,
        task?.extra1,
        task?.extra2,
    ].join(' ');
    return normalizeWorkOrderNo(text);
}

/** Last four digits of the task sequence. TSK-26-1105 is 1105. TSK-26-40 is 0040. */
export function taskLastFour(task) {
    const number = String(task?.taskNumber || '').trim();
    const parsed = /^TSK-\d{2}-(\d+)$/i.exec(number);
    const raw = parsed?.[1] || (number.match(/(\d+)\s*$/)?.[1] || '');
    if (!raw) return '';
    return raw.length > 4 ? raw.slice(-4) : raw.padStart(4, '0');
}

/** Created task: WO-26-004-1105. A child number such as WO-26-004-1105-001 is kept. */
export function listedTaskNumber(task) {
    const stamped = String(task?.displayTaskNumber || '').trim();
    if (stamped && !/TSK-/i.test(stamped)) return stamped;
    const number = String(task?.taskNumber || '').trim();
    const order = workOrderNoOf(task);
    if (!order) return number;
    const tail = taskLastFour(task);
    if (tail) return `${order}-${tail}`;
    if (!number || number.toUpperCase() === order.toUpperCase()) return order;
    return number;
}

/**
 * Created project task: work order number plus that task's last four digits.
 * Each later task under it is that number, then -001, -002, and so on.
 */
function byCreatedOrder(left, right) {
    const gap = taskTime(left) - taskTime(right);
    if (gap) return gap;
    return taskKey(left).localeCompare(taskKey(right));
}

export function workOrderDisplayNumbers(rows = []) {
    const groups = new Map();
    for (const row of rows) {
        const key = workOrderKey(row);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    const numbers = new Map();
    for (const [order, group] of groups) {
        const root = group.find(isProjectRootTask) || [...group].sort(byCreatedOrder)[0];
        const tail = taskLastFour(root);
        const base = tail ? `${order}-${tail}` : order;
        const rootKey = taskKey(root);
        if (rootKey) numbers.set(rootKey, base);
        const ordered = group.filter((task) => task !== root).sort(byCreatedOrder);
        const leaves = visibleWorkOrderLeaves(ordered, group.some((task) => !taskIsClosed(task)));
        leaves.forEach((task, index) => {
            const key = taskKey(task);
            if (key) numbers.set(key, `${base}-${String(index + 1).padStart(3, '0')}`);
        });
    }
    return numbers;
}

const CHECKLIST_SECTION_BY_TYPE = {
    'Work Order Project': 'Work order create',
    'Work Order LPO': 'Sales kick off',
    'Work Order LPO Attachment': 'Work order create',
    'Work Order LPO Approval': 'LPO to vendor',
    'Work Order Actual BOQ': 'Actual BOQ',
    'Work Order Actual BOQ Update': 'Actual BOQ',
    'Work Order MOM': 'MOM',
};

/** Checklist section added onto a work-order task name. Checklist rows already use the section as the name. */
export function taskNameWithChecklistSection(task, title = '') {
    const name = String(title || task?.taskName || '').trim();
    const type = String(task?.requestType || '').trim();
    if (type === 'Work Order Checklist') return name;
    const section = CHECKLIST_SECTION_BY_TYPE[type] || '';
    if (!section) return name;
    if (name.toLowerCase().includes(section.toLowerCase())) return name;
    return name ? `${name} — ${section}` : section;
}

export function isProjectRootTask(task) {
    return String(task?.requestType || '').trim() === 'Work Order Project';
}

const PENDING_STEP = {
    'Work Order LPO': 'LPO',
    'Work Order LPO Attachment': 'LPO attachment',
    'Work Order LPO Approval': 'LPO approval',
    'Work Order Actual BOQ': 'BOQ',
    'Work Order Actual BOQ Update': 'BOQ update',
    'Work Order MOM': 'MOM',
};

const CLOSED_TASK = new Set(['Completed', 'Closed', 'Rejected', 'Cancelled', 'Dismissed']);

function taskIsClosed(task) {
    const shown = String(task?.displayStatus || '').trim();
    const raw = String(task?.status || '').trim();
    return CLOSED_TASK.has(shown) || CLOSED_TASK.has(raw);
}

/**
 * Under a work order, list the steps that are still pending.
 * Finished steps stay out while the list still has an open task for that work order.
 * A list that is only finished tasks keeps those rows, so a Cancelled filter still works.
 */
export function visibleWorkOrderLeaves(leaves = [], listHasOpenTask = true) {
    const openLeaves = leaves.filter((task) => !taskIsClosed(task));
    if (!listHasOpenTask) return leaves;
    return openLeaves;
}

function pendingStepLabel(task) {
    const type = String(task?.requestType || '').trim();
    if (PENDING_STEP[type]) return PENDING_STEP[type];
    if (/^Work Order MR\b/i.test(type)) return 'MR';
    if (type === 'Work Order Checklist') {
        return String(task?.taskName || '').split(/\s+[—–]\s+/)[0].trim();
    }
    return '';
}

/**
 * An open step under the created task: "LPO pending with Raseel M".
 * The created project task keeps its own name.
 */
export function workOrderPendingTitle(task, assigneeLabel = '') {
    if (isProjectRootTask(task)) return '';
    const type = String(task?.requestType || '').trim();
    if (!workOrderNoOf(task) && !/^Work Order\b/i.test(type)) return '';
    const status = String(task?.displayStatus || task?.status || '').trim();
    if (CLOSED_TASK.has(status)) return '';
    const step = pendingStepLabel(task);
    if (!step) return '';
    const who = String(assigneeLabel || '').trim();
    return who ? `${step} pending with ${who}` : `${step} pending`;
}

function workOrderKey(task) {
    return workOrderNoOf(task);
}

function taskTime(task) {
    const value = Date.parse(task?.requestDate || task?.createdAt || '');
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/**
 * The work order's created project task is the root.
 * Later approvals and pending steps are leaves under it.
 * A work order with one task stays a single row.
 * catalog is the unfiltered list, so the created task stays the root when a filter hides it.
 */
export function clusterWorkOrderTasks(rows = [], catalog = rows) {
    const groups = new Map();
    const blocks = [];
    for (const row of rows) {
        const key = workOrderKey(row);
        if (!key) {
            blocks.push({ type: 'task', task: row });
            continue;
        }
        if (!groups.has(key)) {
            groups.set(key, []);
            blocks.push({ type: 'slot', workOrderNo: key });
        }
        groups.get(key).push(row);
    }
    const roots = new Map();
    for (const row of catalog || []) {
        const key = workOrderKey(row);
        if (!key || !isProjectRootTask(row) || roots.has(key)) continue;
        roots.set(key, row);
    }
    return blocks.map((block) => {
        if (block.type !== 'slot') return block;
        const tasks = groups.get(block.workOrderNo) || [];
        const created = roots.get(block.workOrderNo) || null;
        const root = tasks.find(isProjectRootTask) || created || [...tasks].sort(byCreatedOrder)[0];
        const leaves = visibleWorkOrderLeaves(
            tasks
                .filter((task) => taskKey(task) !== taskKey(root))
                .sort(byCreatedOrder),
            tasks.some((task) => !taskIsClosed(task)),
        );
        if (!leaves.length) return { type: 'task', task: root };
        return {
            type: 'tree',
            workOrderNo: block.workOrderNo,
            root,
            leaves,
        };
    });
}

function blockTaskCount(block) {
    if (block?.type === 'tree') return 1 + (block.leaves?.length || 0);
    if (block?.type === 'group') return block.tasks.length;
    return 1;
}

/** Pages of blocks. A work order group stays on one page. */
export function paginateWorkOrderBlocks(blocks = [], pageSize = 10) {
    const total = blocks.reduce((sum, block) => sum + blockTaskCount(block), 0);
    const size = Number(pageSize);
    if (!blocks.length) return [];
    if (!Number.isFinite(size) || size <= 0 || size >= total) return [blocks];
    const pages = [];
    let current = [];
    let count = 0;
    for (const block of blocks) {
        const next = blockTaskCount(block);
        if (current.length && count + next > size) {
            pages.push(current);
            current = [];
            count = 0;
        }
        current.push(block);
        count += next;
    }
    if (current.length) pages.push(current);
    return pages;
}

export function tasksInBlocks(blocks = []) {
    return blocks.flatMap((block) => {
        if (block.type === 'tree') return [block.root, ...(block.leaves || [])];
        if (block.type === 'group') return block.tasks;
        return [block.task];
    });
}
