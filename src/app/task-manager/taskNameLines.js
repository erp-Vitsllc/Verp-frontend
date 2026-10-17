export function taskNameLines(task, title = "") {
    const head = String(title || task?.taskName || "").trim();
    const more = String(task?.taskSubject || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const lines = [];
    const push = (line) => {
        if (!line) return;
        if (lines.some((item) => item.toLowerCase() === line.toLowerCase())) return;
        lines.push(line);
    };
    push(head);
    more.forEach(push);
    return lines.length ? lines : ["Task"];
}
