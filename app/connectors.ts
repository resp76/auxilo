import type { Task } from "./task-reminders";
import { apiUrl } from "./api-base.ts";

export type ConnectorId = "linear" | "notion" | "slack";

// Paste-a-key connectors. Keys live in tab memory only and are never stored.
const KEY_SHAPES: Record<ConnectorId, RegExp> = {
  linear: /^lin_api_[A-Za-z0-9]{20,}$/,
  notion: /^(ntn_|secret_)[A-Za-z0-9]{20,}$/,
  slack: /^xoxp-[A-Za-z0-9-]{10,}$/,
};

export function isLikelyKey(id: ConnectorId, key: string): boolean {
  return KEY_SHAPES[id].test(key);
}

// ponytail: 32-bit FNV-1a namespaced per source; collisions are negligible at
// task-list scale. Swap for a 53-bit hash if a workspace ever nears 2^16 items.
export function stableId(raw: string): number {
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index++) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function failure(provider: string, status: number): Error {
  if (status === 401) return new Error(`${provider} rejected this key. Check it has not expired, then reconnect.`);
  if (status === 403) return new Error(`${provider} denied access. Confirm the key's scopes and try again.`);
  if (status === 429) return new Error(`${provider} is receiving too many requests. Try again shortly.`);
  return new Error(`${provider} request failed (${status}). Try again.`);
}

/** Linear allows browser origins, so this calls the API directly — no proxy. */
export async function linearRequest<T>(key: string, query: string): Promise<T> {
  if (!key) throw new Error("Paste a Linear personal API key to connect.");
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw failure("Linear", response.status);
  const payload = await response.json() as { data?: T; errors?: { message: string }[] };
  if (payload.errors?.length) throw new Error(`Linear: ${payload.errors[0].message}`);
  if (!payload.data) throw new Error("Linear returned no data.");
  return payload.data;
}

/**
 * Notion and Slack block browser calls (Notion sends no CORS headers; Slack
 * refuses an Authorization header), so these route through the same-origin
 * worker proxy, which forwards to an allowlisted upstream and stores nothing.
 */
export async function proxyRequest<T>(provider: "notion" | "slack", path: string, key: string, body: unknown): Promise<T> {
  if (!key) throw new Error(`Paste a ${provider} key to connect.`);
  const response = await fetch(apiUrl("/api/connector"), {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    headers: { "Content-Type": "application/json", "x-auxilo-provider": provider, "x-auxilo-path": path, "x-auxilo-key": key },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw failure(provider === "notion" ? "Notion" : "Slack", response.status);
  return response.json() as Promise<T>;
}

type LinearIssue = { id: string; identifier: string; title: string };
type NotionPage = { id: string; url?: string; properties?: Record<string, { type: string; title?: { plain_text: string }[] }> };
type SlackMatch = { ts: string; text: string; channel?: { name?: string } };

export function mapLinearIssue(issue: LinearIssue): Task {
  return { id: stableId(`linear:${issue.id}`), title: issue.title || "Untitled issue", meta: `${issue.identifier} · Linear`, source: "Linear", done: false };
}

export function notionTitle(page: NotionPage): string {
  const title = Object.values(page.properties || {}).find(property => property?.type === "title");
  return title?.title?.map(part => part.plain_text).join("").trim() || "Untitled page";
}

export function mapNotionPage(page: NotionPage): Task {
  return { id: stableId(`notion:${page.id}`), title: notionTitle(page), meta: "Notion page", source: "Notion", done: false };
}

export function mapSlackMatch(match: SlackMatch): Task {
  const text = match.text.replace(/\s+/g, " ").trim();
  return { id: stableId(`slack:${match.ts}`), title: text.length > 120 ? `${text.slice(0, 117)}…` : text || "Slack message", meta: `${match.channel?.name ? `#${match.channel.name}` : "Direct message"} · Slack`, source: "Slack", done: false };
}

function dedupe(tasks: Task[]): Task[] {
  const seen = new Set<number>();
  return tasks.filter(task => !seen.has(task.id) && seen.add(task.id));
}

export async function readLinearTasks(key: string): Promise<Task[]> {
  if (key && !isLikelyKey("linear", key)) throw new Error("That does not look like a Linear personal API key (lin_api_…).");
  const data = await linearRequest<{ viewer?: { assignedIssues?: { nodes?: LinearIssue[] } } }>(
    key,
    `{ viewer { assignedIssues(first: 50, filter: { state: { type: { nin: ["completed", "canceled"] } } }) { nodes { id identifier title } } } }`,
  );
  const nodes = data.viewer?.assignedIssues?.nodes;
  return Array.isArray(nodes) ? dedupe(nodes.filter(node => node && typeof node.id === "string").map(mapLinearIssue)) : [];
}

export async function readNotionTasks(key: string): Promise<Task[]> {
  if (key && !isLikelyKey("notion", key)) throw new Error("That does not look like a Notion integration token (ntn_… or secret_…).");
  const data = await proxyRequest<{ results?: NotionPage[] }>("notion", "/v1/search", key, {
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: 25,
  });
  return Array.isArray(data.results) ? dedupe(data.results.filter(page => page && typeof page.id === "string").map(mapNotionPage)) : [];
}

export async function readSlackTasks(key: string): Promise<Task[]> {
  if (key && !isLikelyKey("slack", key)) throw new Error("That does not look like a Slack user token (xoxp-…).");
  const data = await proxyRequest<{ ok?: boolean; error?: string; messages?: { matches?: SlackMatch[] } }>("slack", "/api/search.messages", key, { query: "to:me", count: 25 });
  if (data.ok === false) throw new Error(`Slack: ${data.error || "request was rejected"}.`);
  const matches = data.messages?.matches;
  return Array.isArray(matches) ? dedupe(matches.filter(match => match && typeof match.ts === "string").map(mapSlackMatch)) : [];
}
