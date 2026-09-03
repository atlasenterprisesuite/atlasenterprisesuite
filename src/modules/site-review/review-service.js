const VIEWPORTS = new Set(['desktop', 'tablet', 'mobile']);
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const ISSUE_STATUSES = new Set(['open', 'in_progress', 'resolved', 'rejected']);

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

function requireHttpUrl(value, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} must be a valid HTTP URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError(`${label} must be a valid HTTP URL`);
  }
  return parsed.toString();
}

function requireCoordinate(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new RangeError('Issue coordinates must be normalized between 0 and 1');
  }
  return value;
}

export function createReviewService({ store, now = () => new Date().toISOString(), id = (prefix) => `${prefix}-${crypto.randomUUID()}` }) {
  if (!store) throw new TypeError('store is required');

  function requireSession(sessionId) {
    const session = store.getSession(sessionId);
    if (!session) throw new Error(`Review session not found: ${sessionId}`);
    return session;
  }

  function requireIssue(issueId) {
    const issue = store.getIssue(issueId);
    if (!issue) throw new Error(`Review issue not found: ${issueId}`);
    return issue;
  }

  return {
    createSession({ siteUrl, title }) {
      const timestamp = now();
      const session = {
        id: id('session'),
        siteUrl: requireHttpUrl(siteUrl, 'Site URL'),
        title: requireText(title, 'Title'),
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'active'
      };
      return store.saveSession(session);
    },

    addIssue({ sessionId, pageUrl, viewport, x, y, message, severity, createdBy }) {
      requireSession(sessionId);
      if (!VIEWPORTS.has(viewport)) throw new TypeError(`Unsupported viewport: ${viewport}`);
      if (!SEVERITIES.has(severity)) throw new TypeError(`Unsupported severity: ${severity}`);
      const timestamp = now();
      const issue = {
        id: id('issue'),
        sessionId,
        pageUrl: requireHttpUrl(pageUrl, 'Page URL'),
        viewport,
        x: requireCoordinate(x),
        y: requireCoordinate(y),
        message: requireText(message, 'Message'),
        status: 'open',
        severity,
        assigneeId: null,
        createdBy: requireText(createdBy, 'Created by'),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      return store.saveIssue(issue);
    },

    assignIssue(issueId, assigneeId) {
      const issue = requireIssue(issueId);
      issue.assigneeId = requireText(assigneeId, 'Assignee');
      issue.updatedAt = now();
      return store.saveIssue(issue);
    },

    setIssueStatus(issueId, status) {
      if (!ISSUE_STATUSES.has(status)) throw new TypeError(`Unsupported issue status: ${status}`);
      const issue = requireIssue(issueId);
      issue.status = status;
      issue.updatedAt = now();
      return store.saveIssue(issue);
    },

    addReply(issueId, { message, createdBy }) {
      requireIssue(issueId);
      const reply = {
        id: id('reply'),
        issueId,
        message: requireText(message, 'Message'),
        createdBy: requireText(createdBy, 'Created by'),
        createdAt: now()
      };
      return store.saveReply(reply);
    },

    listIssues(sessionId, filters = {}) {
      requireSession(sessionId);
      const entries = store.listIssues(sessionId);
      return entries.filter((issue) => {
        if (filters.status && issue.status !== filters.status) return false;
        if (filters.severity && issue.severity !== filters.severity) return false;
        if (filters.viewport && issue.viewport !== filters.viewport) return false;
        if (filters.assigneeId && issue.assigneeId !== filters.assigneeId) return false;
        return true;
      });
    },

    listReplies(issueId) {
      requireIssue(issueId);
      return store.listReplies(issueId);
    }
  };
}
