export function normalizeDnsTxtAnswer(value: string) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^(?:"[^"]*"\s*)+$/.test(trimmed)) {
    return [...trimmed.matchAll(/"([^"]*)"/g)].map((match) => match[1]).join('');
  }
  return trimmed;
}

export function verifyDnsTxt(expected: string, answers: string[]) {
  const normalizedAnswers = answers.map(normalizeDnsTxtAnswer);
  return {
    verified: normalizedAnswers.some((answer) => answer === expected),
    answers: normalizedAnswers
  };
}
