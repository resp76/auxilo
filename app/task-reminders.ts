export type Task = {
  id: number;
  title: string;
  meta: string;
  source: "GitHub" | "Gmail" | "Personal" | "Calendar";
  done: boolean;
  priority?: boolean;
  reminderAt?: string;
};

export function parseTasks(raw: string): Task[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every((task): task is Task =>
    task && Number.isSafeInteger(task.id) && typeof task.title === "string" &&
    typeof task.meta === "string" && ["GitHub", "Gmail", "Personal", "Calendar"].includes(task.source) &&
    typeof task.done === "boolean" && (task.priority === undefined || typeof task.priority === "boolean") &&
    (task.reminderAt === undefined || (typeof task.reminderAt === "string" && Number.isFinite(Date.parse(task.reminderAt))))
  ) || new Set(data.map(task => task.id)).size !== data.length) throw new Error("Invalid saved tasks");
  return data;
}

export function reminderInstant(value: string, now: number): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time <= now) throw new Error("Choose a future time for your reminder.");
  return new Date(time).toISOString();
}

export function dueReminders(tasks: Task[], alerted: Set<string>, now: number): Task[] {
  return tasks.filter(task => !task.done && task.reminderAt && Date.parse(task.reminderAt) <= now && !alerted.has(`${task.id}:${task.reminderAt}`));
}

export function filterTasks(tasks: Task[], filter: string, now: number): Task[] {
  const today = new Date(now).toDateString();
  return tasks.filter(task => filter === "All" || (task.reminderAt && (filter === "Today"
    ? new Date(task.reminderAt).toDateString() === today
    : !task.done && Date.parse(task.reminderAt) > now)));
}
