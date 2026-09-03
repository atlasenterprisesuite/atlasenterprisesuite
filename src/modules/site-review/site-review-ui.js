const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ width: 1440, height: 900 }),
  tablet: Object.freeze({ width: 834, height: 1112 }),
  mobile: Object.freeze({ width: 390, height: 844 })
});

export function viewportDimensions(viewport) {
  const dimensions = VIEWPORTS[viewport];
  if (!dimensions) throw new TypeError(`Unsupported viewport: ${viewport}`);
  return { ...dimensions };
}

export function summarizeIssues(issues) {
  return issues.reduce((summary, issue) => {
    summary.total += 1;
    if (issue.status === 'open') summary.open += 1;
    if (issue.status === 'in_progress') summary.inProgress += 1;
    if (issue.status === 'resolved') summary.resolved += 1;
    if (issue.status === 'rejected') summary.rejected += 1;
    if (issue.severity === 'critical') summary.critical += 1;
    return summary;
  }, { total: 0, open: 0, inProgress: 0, resolved: 0, rejected: 0, critical: 0 });
}

export function buildExportPayload({ session, issues, repliesByIssue, findings }) {
  return structuredClone({
    exportedAt: new Date().toISOString(),
    session,
    issues,
    repliesByIssue,
    findings
  });
}
