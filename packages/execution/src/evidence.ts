export function missingEvidence(
  requiredKinds: readonly string[],
  evidence: ReadonlyArray<{ kind: string; verified: boolean }>
) {
  return requiredKinds.filter((kind) => {
    const match = evidence.find((item) => item.kind === kind);
    return !match || !match.verified;
  });
}
