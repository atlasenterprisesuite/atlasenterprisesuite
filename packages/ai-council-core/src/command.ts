export type CouncilProviderTarget = 'openai' | 'gemini' | 'all';

export type CouncilCommand =
  | { kind: 'ask'; provider: CouncilProviderTarget; prompt: string }
  | { kind: 'delegate'; target: 'copilot'; prompt: string }
  | { kind: 'consensus'; prompt: string }
  | { kind: 'status'; prompt: string }
  | { kind: 'implement'; prompt: string }
  | { kind: 'review'; prompt: string };

function trailingPrompt(input: string, matched: string): string {
  return input.slice(matched.length).trim();
}

export function parseCouncilCommand(raw: string): CouncilCommand | null {
  const input = raw.trim();
  if (!input.startsWith('/')) return null;

  const ask = input.match(/^\/ask\s+(openai|gemini|all)\b/i);
  if (ask) {
    return {
      kind: 'ask',
      provider: ask[1].toLowerCase() as CouncilProviderTarget,
      prompt: trailingPrompt(input, ask[0]),
    };
  }

  const delegate = input.match(/^\/delegate\s+copilot\b/i);
  if (delegate) {
    return { kind: 'delegate', target: 'copilot', prompt: trailingPrompt(input, delegate[0]) };
  }

  for (const kind of ['consensus', 'status', 'implement', 'review'] as const) {
    const match = input.match(new RegExp(`^/${kind}\\b`, 'i'));
    if (match) return { kind, prompt: trailingPrompt(input, match[0]) };
  }

  return null;
}
