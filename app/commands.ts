export type Command = { id: string; label: string; group: string; hint?: string; run: () => void };

/**
 * Subsequence match, the behaviour people expect from a ⌘K palette: "tk"
 * finds "Go to Tasks". Falls back to plain substring for multi-word queries.
 */
export function matchesQuery(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = label.toLowerCase();
  if (haystack.includes(needle)) return true;
  if (/\s/.test(needle)) return false;
  let index = 0;
  for (const character of needle) {
    index = haystack.indexOf(character, index);
    if (index === -1) return false;
    index++;
  }
  return true;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  return commands.filter(command => matchesQuery(command.label, query) || matchesQuery(command.group, query));
}

/** Wraps selection so ↑ at the top lands on the last result. */
export function nextIndex(current: number, length: number, delta: number): number {
  if (length < 1) return 0;
  return (current + delta + length) % length;
}
