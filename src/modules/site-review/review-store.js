function copy(value) {
  return value == null ? value : structuredClone(value);
}

export function createMemoryReviewStore() {
  const sessions = new Map();
  const issues = new Map();
  const replies = new Map();

  return {
    saveSession(session) {
      sessions.set(session.id, copy(session));
      return copy(session);
    },

    getSession(id) {
      return copy(sessions.get(id) ?? null);
    },

    listSessions() {
      return [...sessions.values()].map(copy);
    },

    saveIssue(issue) {
      issues.set(issue.id, copy(issue));
      return copy(issue);
    },

    getIssue(id) {
      return copy(issues.get(id) ?? null);
    },

    listIssues(sessionId) {
      return [...issues.values()]
        .filter((issue) => issue.sessionId === sessionId)
        .map(copy);
    },

    saveReply(reply) {
      replies.set(reply.id, copy(reply));
      return copy(reply);
    },

    listReplies(issueId) {
      return [...replies.values()]
        .filter((reply) => reply.issueId === issueId)
        .map(copy);
    }
  };
}
