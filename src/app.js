import { resolveRoute } from './core/routes.js';
import { hasCapability } from './core/permissions.js';
import { createMemoryReviewStore } from './modules/site-review/review-store.js';
import { createReviewService } from './modules/site-review/review-service.js';
import { auditDocument, providerDependentFindings } from './modules/site-review/audit-engine.js';
import { buildExportPayload, summarizeIssues, viewportDimensions } from './modules/site-review/site-review-ui.js';

const route = resolveRoute(window.location.pathname);
if (route.id !== 'site-review') {
  document.body.innerHTML = '<main class="panel-empty"><h1>404</h1><p>ATLAS route not found.</p></main>';
  throw new Error(`Unsupported route: ${window.location.pathname}`);
}

const store = createMemoryReviewStore();
const service = createReviewService({ store });
const state = {
  session: null,
  viewport: 'desktop',
  pendingPin: null,
  role: 'owner',
  findings: []
};

const byId = (id) => document.getElementById(id);
const elements = {
  sessionForm: byId('session-form'),
  siteUrl: byId('site-url'),
  sessionTitle: byId('session-title'),
  sessionMessage: byId('session-message'),
  browserUrl: byId('browser-url'),
  frame: byId('site-frame'),
  emptyCanvas: byId('empty-canvas'),
  pinLayer: byId('pin-layer'),
  pinMode: byId('pin-mode'),
  pinComposer: byId('pin-composer'),
  pinLocation: byId('pin-location'),
  issueSeverity: byId('issue-severity'),
  issueMessage: byId('issue-message'),
  cancelPin: byId('cancel-pin'),
  viewportShell: byId('viewport-shell'),
  issueList: byId('issue-list'),
  filterStatus: byId('filter-status'),
  filterSeverity: byId('filter-severity'),
  summaryTotal: byId('summary-total'),
  summaryOpen: byId('summary-open'),
  summaryResolved: byId('summary-resolved'),
  summaryCritical: byId('summary-critical'),
  roleSelect: byId('role-select'),
  exportButton: byId('export-button'),
  reviewTab: byId('review-tab'),
  auditTab: byId('audit-tab'),
  reviewPanel: byId('review-panel'),
  auditPanel: byId('audit-panel'),
  auditMarkup: byId('audit-markup'),
  runAudit: byId('run-audit'),
  auditStatus: byId('audit-status'),
  findingList: byId('finding-list')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setMessage(message, kind = '') {
  elements.sessionMessage.className = `session-message${kind ? ` ${kind}` : ''}`;
  elements.sessionMessage.textContent = message;
}

function can(capability) {
  return hasCapability(state.role, capability);
}

function currentFilters() {
  return {
    status: elements.filterStatus.value || undefined,
    severity: elements.filterSeverity.value || undefined
  };
}

function allIssues() {
  if (!state.session) return [];
  return service.listIssues(state.session.id);
}

function renderSummary() {
  const summary = summarizeIssues(allIssues());
  elements.summaryTotal.textContent = summary.total;
  elements.summaryOpen.textContent = summary.open;
  elements.summaryResolved.textContent = summary.resolved;
  elements.summaryCritical.textContent = summary.critical;
}

function renderPins() {
  if (!state.session) {
    elements.pinLayer.innerHTML = '';
    return;
  }

  const visibleIssues = allIssues().filter((issue) => issue.viewport === state.viewport);
  elements.pinLayer.innerHTML = visibleIssues.map((issue, index) => {
    const classes = ['review-pin'];
    if (issue.status === 'resolved') classes.push('resolved');
    if (issue.severity === 'critical') classes.push('critical');
    return `<button type="button" class="${classes.join(' ')}" data-issue-pin="${escapeHtml(issue.id)}" style="left:${issue.x * 100}%;top:${issue.y * 100}%" title="${escapeHtml(issue.message)}">${index + 1}</button>`;
  }).join('');

  if (state.pendingPin) {
    elements.pinLayer.insertAdjacentHTML('beforeend', `<span class="review-pin pending-pin" style="left:${state.pendingPin.x * 100}%;top:${state.pendingPin.y * 100}%">+</span>`);
  }
}

function statusOptions(selected) {
  const labels = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', rejected: 'Rejected' };
  return Object.entries(labels).map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`).join('');
}

function renderIssues() {
  if (!state.session) {
    elements.issueList.innerHTML = '<div class="panel-empty">No active review session.</div>';
    renderSummary();
    renderPins();
    return;
  }

  const issues = service.listIssues(state.session.id, currentFilters());
  if (issues.length === 0) {
    elements.issueList.innerHTML = '<div class="panel-empty">No issues match the current filters.</div>';
  } else {
    elements.issueList.innerHTML = issues.map((issue) => {
      const replies = service.listReplies(issue.id);
      const replyMarkup = replies.length
        ? `<div class="reply-list">${replies.map((reply) => `<div class="reply"><strong>${escapeHtml(reply.createdBy)}</strong><br>${escapeHtml(reply.message)}</div>`).join('')}</div>`
        : '';
      const assignment = can('review.assign')
        ? `<div class="inline-actions"><input data-assignee-input="${escapeHtml(issue.id)}" value="${escapeHtml(issue.assigneeId ?? '')}" placeholder="Assignee ID"><button type="button" class="ghost-button" data-action="assign" data-issue-id="${escapeHtml(issue.id)}">Assign</button></div>`
        : `<small>Assignee: ${escapeHtml(issue.assigneeId ?? 'Unassigned')}</small>`;
      const reply = can('review.comment')
        ? `<div class="inline-actions"><input data-reply-input="${escapeHtml(issue.id)}" placeholder="Reply to thread"><button type="button" class="ghost-button" data-action="reply" data-issue-id="${escapeHtml(issue.id)}">Reply</button></div>`
        : '';
      return `<article class="issue-card" data-issue-card="${escapeHtml(issue.id)}">
        <div class="issue-head"><strong>${escapeHtml(issue.message)}</strong><span class="badge ${escapeHtml(issue.status)}">${escapeHtml(issue.status.replace('_', ' '))}</span></div>
        <div class="issue-meta"><span class="badge ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span><span class="badge">${escapeHtml(issue.viewport)}</span><span class="badge">${Math.round(issue.x * 100)}%, ${Math.round(issue.y * 100)}%</span></div>
        <div class="issue-actions">
          <button type="button" class="ghost-button" data-action="locate" data-issue-id="${escapeHtml(issue.id)}">Locate pin</button>
          <label>Status<select data-action="status" data-issue-id="${escapeHtml(issue.id)}" ${can('review.resolve') ? '' : 'disabled'}>${statusOptions(issue.status)}</select></label>
          ${assignment}
          ${reply}
          ${replyMarkup}
        </div>
      </article>`;
    }).join('');
  }
  renderSummary();
  renderPins();
}

function renderFindings() {
  if (state.findings.length === 0) {
    elements.findingList.innerHTML = '';
    return;
  }
  elements.findingList.innerHTML = state.findings.map((finding) => `<article class="finding-card">
    <div class="finding-head"><strong>${escapeHtml(finding.ruleId)}</strong><span class="badge ${escapeHtml(finding.status)}">${escapeHtml(finding.status.replace('_', ' '))}</span></div>
    <p>${escapeHtml(finding.message)}</p>
    <small>${escapeHtml(finding.category)} · ${escapeHtml(finding.severity)}</small>
  </article>`).join('');
}

function applyPermissions() {
  const hasSession = Boolean(state.session);
  elements.exportButton.disabled = !hasSession || !can('audit.export');
  elements.runAudit.disabled = !hasSession || !can('audit.run');
  elements.pinMode.disabled = !hasSession || !can('review.comment');
  const pinActive = hasSession && can('review.comment') && elements.pinMode.checked;
  elements.pinLayer.classList.toggle('pin-mode', pinActive);
  renderIssues();
}

function setViewport(viewport) {
  const dimensions = viewportDimensions(viewport);
  state.viewport = viewport;
  elements.viewportShell.dataset.viewport = viewport;
  elements.viewportShell.setAttribute('aria-label', `${viewport} review viewport, reference ${dimensions.width} by ${dimensions.height}`);
  document.querySelectorAll('.viewport-button').forEach((button) => button.classList.toggle('active', button.dataset.viewport === viewport));
  renderPins();
}

function clearPendingPin() {
  state.pendingPin = null;
  elements.issueMessage.value = '';
  elements.pinComposer.hidden = true;
  renderPins();
}

function switchTab(tab) {
  const reviewActive = tab === 'review';
  elements.reviewTab.classList.toggle('active', reviewActive);
  elements.auditTab.classList.toggle('active', !reviewActive);
  elements.reviewTab.setAttribute('aria-selected', String(reviewActive));
  elements.auditTab.setAttribute('aria-selected', String(!reviewActive));
  elements.reviewPanel.hidden = !reviewActive;
  elements.auditPanel.hidden = reviewActive;
}

elements.sessionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    state.session = service.createSession({ siteUrl: elements.siteUrl.value, title: elements.sessionTitle.value });
    state.pendingPin = null;
    state.findings = [];
    elements.frame.src = state.session.siteUrl;
    elements.frame.hidden = false;
    elements.emptyCanvas.hidden = true;
    elements.pinLayer.hidden = false;
    elements.browserUrl.textContent = state.session.siteUrl;
    elements.auditStatus.textContent = 'No audit has been run.';
    elements.findingList.innerHTML = '';
    setMessage('Review session created. Embedding depends on the target site policy; ATLAS does not claim a live connection if the site blocks framing.', 'success');
    applyPermissions();
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

document.querySelectorAll('.viewport-button').forEach((button) => button.addEventListener('click', () => setViewport(button.dataset.viewport)));

elements.pinMode.addEventListener('change', applyPermissions);

elements.pinLayer.addEventListener('click', (event) => {
  const pinButton = event.target.closest('[data-issue-pin]');
  if (pinButton) {
    const card = elements.issueList.querySelector(`[data-issue-card="${CSS.escape(pinButton.dataset.issuePin)}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  if (!state.session || !elements.pinMode.checked || !can('review.comment')) return;
  const rect = elements.pinLayer.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  state.pendingPin = { x, y };
  elements.pinLocation.textContent = `${state.viewport} · ${Math.round(x * 100)}%, ${Math.round(y * 100)}%`;
  elements.pinComposer.hidden = false;
  renderPins();
  elements.issueMessage.focus();
});

elements.pinComposer.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.session || !state.pendingPin || !can('review.comment')) return;
  try {
    service.addIssue({
      sessionId: state.session.id,
      pageUrl: state.session.siteUrl,
      viewport: state.viewport,
      x: state.pendingPin.x,
      y: state.pendingPin.y,
      message: elements.issueMessage.value,
      severity: elements.issueSeverity.value,
      createdBy: `local:${state.role}`
    });
    clearPendingPin();
    renderIssues();
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

elements.cancelPin.addEventListener('click', clearPendingPin);
elements.filterStatus.addEventListener('change', renderIssues);
elements.filterSeverity.addEventListener('change', renderIssues);

elements.issueList.addEventListener('change', (event) => {
  const control = event.target.closest('[data-action="status"]');
  if (!control || !can('review.resolve')) return;
  try {
    service.setIssueStatus(control.dataset.issueId, control.value);
    renderIssues();
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

elements.issueList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const issueId = button.dataset.issueId;
  const issue = allIssues().find((entry) => entry.id === issueId);
  if (!issue) return;

  try {
    if (button.dataset.action === 'locate') {
      setViewport(issue.viewport);
      elements.viewportShell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (button.dataset.action === 'assign' && can('review.assign')) {
      const input = elements.issueList.querySelector(`[data-assignee-input="${CSS.escape(issueId)}"]`);
      service.assignIssue(issueId, input.value);
      renderIssues();
    }
    if (button.dataset.action === 'reply' && can('review.comment')) {
      const input = elements.issueList.querySelector(`[data-reply-input="${CSS.escape(issueId)}"]`);
      service.addReply(issueId, { message: input.value, createdBy: `local:${state.role}` });
      renderIssues();
    }
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

elements.roleSelect.addEventListener('change', () => {
  state.role = elements.roleSelect.value;
  clearPendingPin();
  applyPermissions();
});

elements.reviewTab.addEventListener('click', () => switchTab('review'));
elements.auditTab.addEventListener('click', () => switchTab('audit'));

elements.runAudit.addEventListener('click', () => {
  if (!state.session || !can('audit.run')) return;
  const markup = elements.auditMarkup.value.trim();
  if (!markup) {
    elements.auditStatus.textContent = 'Paste actual HTML before running the deterministic audit.';
    elements.auditStatus.className = 'session-message error';
    return;
  }
  try {
    state.findings = [...auditDocument(markup, state.session.siteUrl), ...providerDependentFindings()];
    const detected = state.findings.filter((finding) => finding.status === 'detected').length;
    const passed = state.findings.filter((finding) => finding.status === 'passed').length;
    const notConfigured = state.findings.filter((finding) => finding.status === 'not_configured').length;
    elements.auditStatus.textContent = `${passed} passed · ${detected} detected · ${notConfigured} not configured`;
    elements.auditStatus.className = 'session-message';
    renderFindings();
  } catch (error) {
    elements.auditStatus.textContent = error.message;
    elements.auditStatus.className = 'session-message error';
  }
});

elements.exportButton.addEventListener('click', () => {
  if (!state.session || !can('audit.export')) return;
  const issues = allIssues();
  const repliesByIssue = Object.fromEntries(issues.map((issue) => [issue.id, service.listReplies(issue.id)]));
  const payload = buildExportPayload({ session: state.session, issues, repliesByIssue, findings: state.findings });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `atlas-site-review-${state.session.id}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

setViewport('desktop');
applyPermissions();
