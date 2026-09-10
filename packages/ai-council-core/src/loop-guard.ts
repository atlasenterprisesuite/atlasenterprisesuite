export const COUNCIL_GENERATED_MARKER = '<!-- atlas-ai-council:generated -->';

export function isCouncilGeneratedContent(body: string): boolean {
  return body.includes(COUNCIL_GENERATED_MARKER);
}

export function shouldAcceptCouncilEvent(input: {
  body: string;
  turnCount: number;
  maxTurns: number;
}): boolean {
  if (isCouncilGeneratedContent(input.body)) return false;
  if (input.turnCount >= input.maxTurns) return false;
  return true;
}
