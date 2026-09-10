import type { Task } from "./task-reminders";

type GitHubIssue = { id: number; number: number; title: string; html_url: string; pull_request?: unknown; repository?: { full_name?: string } };

const API = "https://api.github.com";

// Fine-grained (github_pat_…) or classic (ghp_/gho_/ghu_/ghs_/ghr_…) tokens.
export function isLikelyToken(token: string): boolean {
  return /^(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})$/.test(token);
}

export async function githubRequest<T>(token: string, url: string): Promise<T> {
  const endpoint = new URL(url);
  if (endpoint.hostname !== "api.github.com" || endpoint.protocol !== "https:") throw new Error("Invalid GitHub endpoint.");
  if (!token) throw new Error("Paste a GitHub personal access token to connect.");
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("GitHub rejected this token. Check it has not expired, then reconnect.");
    if (response.status === 403) throw new Error("GitHub denied access or rate-limited this token. Confirm it has read-only Issues access.");
    if (response.status === 429) throw new Error("GitHub is receiving too many requests. Try again shortly.");
    throw new Error(`GitHub request failed (${response.status}). Try again.`);
  }
  return response.json() as Promise<T>;
}

export function mapGitHubIssue(item: GitHubIssue): Task {
  const repo = item.repository?.full_name || item.html_url.replace("https://github.com/", "").split("/").slice(0, 2).join("/");
  const kind = item.pull_request ? "Pull request" : "Issue";
  return { id: item.id, title: item.title, meta: `${repo} #${item.number} · ${kind}`, source: "GitHub", done: false };
}

export async function readGitHubTasks(token: string): Promise<Task[]> {
  if (token && !isLikelyToken(token)) throw new Error("That does not look like a GitHub token. Create a fine-grained token with read-only Issues access.");
  const items = await githubRequest<GitHubIssue[]>(token, `${API}/issues?filter=assigned&state=open&per_page=50`);
  if (!Array.isArray(items)) return [];
  const seen = new Set<number>();
  return items.filter(i => i && typeof i.id === "number" && !seen.has(i.id) && seen.add(i.id)).map(mapGitHubIssue);
}
