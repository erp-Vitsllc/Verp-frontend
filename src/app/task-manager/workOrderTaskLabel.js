/** Task number shown for a work order: WO-26-012-TSK-26-40 */
export function listedTaskNumber(task) {
    const number = String(task?.taskNumber || '').trim();
    const order = String(task?.workOrderNo || '').trim();
    if (!order || !number) return number;
    const upper = number.toUpperCase();
    if (upper === order || upper.startsWith(`${order}-`)) return number;
    return `${order}-${number}`;
}

/** Short lowercase note under that number. */
export function taskNumberCaption(task) {
    if (!String(task?.workOrderNo || '').trim()) return '';
    return String(task?.description || '').trim().toLowerCase();
}

function workOrderKey(task) {
    return String(task?.workOrderNo || '').trim();
}

/**
 * Two or more tasks from one work order become one header.
 * A single task from a work order stays its own row.
 * Group members keep the current sort order.
 */
export function clusterWorkOrderTasks(rows = []) {
    const counts = new Map();
    for (const row of rows) {
        const key = workOrderKey(row);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const placed = new Set();
    const blocks = [];
    for (const row of rows) {
        const key = workOrderKey(row);
        if (!key || (counts.get(key) || 0) < 2) {
            blocks.push({ type: 'task', task: row });
            continue;
        }
        if (placed.has(key)) continue;
        placed.add(key);
        blocks.push({
            type: 'group',
            workOrderNo: key,
            tasks: rows.filter((item) => workOrderKey(item) === key),
        });
    }
    return blocks;
}

function blockTaskCount(block) {
    return block?.type === 'group' ? block.tasks.length : 1;
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
    return blocks.flatMap((block) => (block.type === 'group' ? block.tasks : [block.task]));
}
