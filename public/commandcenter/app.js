/**
 * Frontend Application Controller
 * Less of Josh // 35/63 Media — Creator Business Operations Command Center
 */

const state = {
  activeView: 'dashboard',
  today: '',
  csrfToken: '',
  enums: {
    sponsorship_statuses: [],
    media_statuses: [],
    media_categories: [],
    content_stages: [],
    content_formats: ['Short-form', 'Long-form'],
    filming_statuses: [],
    editing_statuses: [],
    revenue_categories: [],
    goal_cycles: ['Cycle 2', 'Cycle 1'],
    goal_statuses: ['On Track', 'At Risk', 'Completed', 'Paused', 'Missed'],
    task_statuses: ['Not started', 'In progress', 'Done', 'Archived']
  },
  dashboard: null,
  sponsorships: [],
  mediaOutreach: [],
  affiliates: [],
  contentItems: [],
  revenueEntries: [],
  revenueSummary: null,
  growthSnapshots: [],
  growthSummary: null,
  goals: [],
  tasks: [],
  projects: [],
  cookbookRecipes: [],
  printingProjects: [],
  referenceDocs: [],
  activeReferenceDocId: null,
  healthRecords: [],
  importLogs: [],

  sponsorshipQuickFilter: 'all',
  mediaQuickFilter: 'all',
  affiliateQuickFilter: 'all',
  contentStageFilter: 'all',
  contentViewMode: 'table', // 'table' | 'board'
  goalCycleFilter: 'Cycle 2',
  taskQuickFilter: 'all',
  referenceCategoryFilter: 'all'
};

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(val, showDashIfNull = false) {
  if (showDashIfNull && (val === null || val === undefined || val === '')) {
    return '—';
  }
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatNum(val, showDashIfNull = true) {
  if (val === null || val === undefined || val === '') {
    return showDashIfNull ? '—' : '0';
  }
  return Number(val).toLocaleString('en-US');
}

function formatDelta(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(val);
  if (n > 0) return `<span class="badge badge-success">+${n.toLocaleString('en-US')}</span>`;
  if (n < 0) return `<span class="badge badge-danger">${n.toLocaleString('en-US')}</span>`;
  return `<span class="badge badge-muted">0</span>`;
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3000);
}

async function api(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const opts = { ...options, method, headers };
  if (opts.body && typeof opts.body === 'object') {
    headers.set('Content-Type', 'application/json');
    opts.body = JSON.stringify(opts.body);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && state.csrfToken) {
    headers.set('X-Dashboard-Csrf', state.csrfToken);
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.assign('/auth/login?redirect=/commandcenter');
    throw new Error('Session expired. Redirecting to sign in.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Paid':
    case 'Posted':
    case 'Published':
    case 'Ready':
    case 'Completed':
    case 'Done':
    case 'Active':
    case 'On Track':
    case 'Submitted — Store Review Pending':
      return 'badge-success';
    case 'Contracted':
    case 'Invoiced':
    case 'Scheduled':
    case 'Booked':
    case 'Recorded':
    case 'In Progress':
    case 'In progress':
    case 'In Development':
      return 'badge-info';
    case 'Interested':
    case 'Negotiating':
    case 'Editing':
    case 'Filming':
    case 'Responded':
      return 'badge-purple';
    case 'Follow-up':
    case 'Follow-Up Sent':
    case 'Content Due':
    case 'Planned':
    case 'Pitched':
    case 'Contacted':
    case 'Not started':
    case 'At Risk':
      return 'badge-warning';
    case 'Declined':
    case 'No Response':
    case 'Missed':
    case 'Archived':
      return 'badge-danger';
    default:
      return 'badge-muted';
  }
}

// ============================================================================
// INITIALIZATION & NAVIGATION
// ============================================================================

const VIEW_TITLES = {
  dashboard: 'What Should Josh Work On Next?',
  sponsorships: 'Sponsorship CRM',
  media: 'Media & Podcast Outreach CRM',
  affiliates: 'Affiliate Tracking',
  revenue: 'Revenue Dashboard',
  content: 'Content Pipeline',
  growth: 'Audience & Growth Tracker',
  goals: '90-Day Goals (Cycle 2 & Cycle 1)',
  projects: 'Projects, Cookbook & 3D Printing',
  tasks: 'Weekly Execution & Tasks',
  reference: 'Local Reference Library (Playbooks, Rate Card & Rules)',
  health: 'Health & Transformation Log',
  backups: 'Notion Sync, CSV Exports & Backups'
};

async function initApp() {
  try {
    const meta = await api('/api/commandcenter/meta');
    state.today = meta.today;
    state.csrfToken = meta.csrf_token;
    state.enums = { ...state.enums, ...meta.enums };
    document.getElementById('topbar-today-date').textContent = meta.today;

    populateStaticSelects();
    bindEventListeners();
    await refreshAllData();
  } catch (err) {
    showToast(`Error initializing: ${err.message}`);
  }
}

function populateStaticSelects() {
  // Sponsorship statuses
  const spStatusFilter = document.getElementById('sponsorship-status-filter');
  const spStatusForm = document.getElementById('sp-status');
  spStatusFilter.innerHTML = '<option value="all">All Statuses</option>' +
    state.enums.sponsorship_statuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  spStatusForm.innerHTML = state.enums.sponsorship_statuses
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  // Media statuses & categories
  const mdStatuses = state.enums.media_statuses || ['Prospect', 'Contacted', 'Follow-up', 'Interested', 'Booked', 'Published', 'Declined', 'No Response'];
  const mdCategories = state.enums.media_categories || ['Podcast', 'Local News', 'TV', 'National Media', 'Print / Online', 'Radio', 'Creator Collab'];
  document.getElementById('media-status-filter').innerHTML = '<option value="all">All Statuses</option>' +
    mdStatuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  document.getElementById('md-status').innerHTML = mdStatuses
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  document.getElementById('media-category-filter').innerHTML = '<option value="all">All Categories</option>' +
    mdCategories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  document.getElementById('md-category').innerHTML = mdCategories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  // Content stages & statuses
  document.getElementById('ct-stage').innerHTML = state.enums.content_stages
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  document.getElementById('ct-filming-status').innerHTML = state.enums.filming_statuses
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  document.getElementById('ct-editing-status').innerHTML = state.enums.editing_statuses
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  // Revenue categories
  const revCatFilter = document.getElementById('revenue-category-filter');
  const revCatForm = document.getElementById('rv-category');
  revCatFilter.innerHTML = '<option value="all">All Categories</option>' +
    state.enums.revenue_categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  revCatForm.innerHTML = state.enums.revenue_categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function switchView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  state.activeView = viewName;
  document.getElementById('current-view-title').textContent = VIEW_TITLES[viewName];

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.classList.toggle('hidden', sec.id !== `view-${viewName}`);
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  if (viewName === 'backups') {
    loadBackupSnapshots();
    loadImportLogs();
  }
}

async function refreshAllData() {
  const [dashboard] = await Promise.all([
    api('/api/commandcenter/dashboard'),
    loadSponsorships(),
    loadMedia(),
    loadAffiliates(),
    loadContent(),
    loadRevenue(),
    loadGrowth(),
    loadGoals(),
    loadTasks(),
    loadProjectsAndCookbook(),
    loadReference(),
    loadHealth()
  ]);

  state.dashboard = dashboard;
  renderDashboard(dashboard);
  updateNavBadges(dashboard);
  updateSuggestionsDatalists();
}

function updateNavBadges(dashboard) {
  if (!dashboard) return;
  const ws = dashboard.weekly_summary || {};
  const counts = dashboard.counts || {};
  const priorityActions =
    (ws.followups_needed_count || 0) +
    (ws.media_followups_needed_count || 0) +
    (ws.overdue_deliverables_count || 0) +
    (ws.unpaid_invoices_count || 0) +
    (ws.ready_to_invoice_count || 0) +
    (ws.content_to_edit_count || 0) +
    (ws.content_to_publish_count || 0);

  document.getElementById('nav-badge-priority').textContent = priorityActions;
  document.getElementById('nav-badge-sponsorships').textContent = counts.sponsorships || 0;
  document.getElementById('nav-badge-media').textContent = counts.media_outreach || 0;
  document.getElementById('nav-badge-affiliates').textContent = counts.affiliates || 0;
  document.getElementById('nav-badge-content').textContent = counts.content_items || 0;
  document.getElementById('nav-badge-growth').textContent = counts.growth_snapshots || 0;
  document.getElementById('nav-badge-goals').textContent = counts.goals || 0;
  document.getElementById('nav-badge-projects').textContent =
    (counts.business_projects || 0) + (counts.cookbook_recipes || 0) + (counts.printing_projects || 0);
  document.getElementById('nav-badge-tasks').textContent = counts.tasks || 0;
  document.getElementById('nav-badge-reference').textContent = counts.reference_documents || 0;
}

function updateSuggestionsDatalists() {
  const sponsorDl = document.getElementById('sponsor-suggestions');
  if (sponsorDl) {
    const brands = [...new Set(state.sponsorships.map((s) => s.brand).filter(Boolean))];
    sponsorDl.innerHTML = brands.map((b) => `<option value="${escapeHtml(b)}"></option>`).join('');
  }
  const affDl = document.getElementById('affiliate-suggestions');
  if (affDl) {
    const progs = [...new Set(state.affiliates.map((a) => a.program).filter(Boolean))];
    affDl.innerHTML = progs.map((p) => `<option value="${escapeHtml(p)}"></option>`).join('');
  }
}

// ============================================================================
// VIEW 1: WEEKLY PRIORITY DASHBOARD
// ============================================================================

function renderDashboard(data) {
  if (!data) return;
  const ws = data.weekly_summary || {};
  const latestGrowth = data.growth_summary?.latest || {};

  // Top Weekly Summary Strip
  const strip = document.getElementById('weekly-summary-strip');
  strip.innerHTML = `
    <div class="stat-card ${(ws.followups_needed_count + (ws.media_followups_needed_count || 0)) > 0 ? 'highlight' : ''}">
      <div class="stat-label">Active Follow-ups</div>
      <div class="stat-value">${(ws.followups_needed_count || 0) + (ws.media_followups_needed_count || 0)}</div>
      <div class="stat-sub">${ws.followups_needed_count || 0} brand • ${ws.media_followups_needed_count || 0} media</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Combined Audience</div>
      <div class="stat-value">${formatNum(latestGrowth.combined_audience || 57465)}</div>
      <div class="stat-sub">Cycle 2 target: 87,500</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pipeline Queue</div>
      <div class="stat-value">${(ws.content_to_edit_count || 0) + (ws.content_to_publish_count || 0)}</div>
      <div class="stat-sub">${ws.content_to_edit_count || 0} to edit • ${ws.content_to_publish_count || 0} to publish</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Cycle 2 Goals Active</div>
      <div class="stat-value">${(data.goals_needing_action || []).length}</div>
      <div class="stat-sub">Sept 1 – Nov 30, 2026</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Current Month Revenue</div>
      <div class="stat-value">${formatMoney(ws.current_month_revenue || 0)}</div>
      <div class="stat-sub">YTD / All-Time: ${formatMoney(data.revenue_summary?.all_time || 0)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Historical Review Queue</div>
      <div class="stat-value">${(data.needs_review_queue || []).length}</div>
      <div class="stat-sub">Held back from active alarms</div>
    </div>
  `;

  // 1. Overdue Brand Follow-ups
  document.getElementById('count-overdue-followups').textContent = data.overdue_followups.length;
  const followupsEl = document.getElementById('list-overdue-followups');
  if (data.overdue_followups.length === 0) {
    followupsEl.innerHTML = `<div class="empty-state">No active brand follow-ups due today.</div>`;
  } else {
    followupsEl.innerHTML = data.overdue_followups.map((s) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(s.brand)}</span>
            <span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span>
            ${s.effective_value > 0 ? `<span class="badge badge-info">${formatMoney(s.effective_value)}</span>` : ''}
          </div>
          <div class="action-card-meta">
            ${escapeHtml(s.followup_reason)}
            ${s.contact_name ? ` • ${escapeHtml(s.contact_name)}` : ''}
            ${s.contact_email ? ` (${escapeHtml(s.contact_email)})` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-secondary btn-xs" onclick="quickFollowUp(${s.id}, 5)" title="Log contact today & schedule next follow-up in 5 days">Log +5d</button>
          <button class="btn btn-ghost btn-xs" onclick="openSponsorshipModal(${s.id})">Open</button>
        </div>
      </div>
    `).join('');
  }

  // 2. Overdue Media Follow-ups
  const mediaFollowups = data.overdue_media_followups || [];
  document.getElementById('count-media-followups').textContent = mediaFollowups.length;
  const mediaFollowupsEl = document.getElementById('list-media-followups');
  if (mediaFollowups.length === 0) {
    mediaFollowupsEl.innerHTML = `<div class="empty-state">No active media outreach follow-ups due today.</div>`;
  } else {
    mediaFollowupsEl.innerHTML = mediaFollowups.map((m) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(m.outlet)}</span>
            <span class="badge ${statusBadgeClass(m.status)}">${escapeHtml(m.status)}</span>
            <span class="badge badge-muted">${escapeHtml(m.type)}</span>
          </div>
          <div class="action-card-meta">
            Follow-up: ${escapeHtml(m.follow_up_date || 'Due')}
            ${m.contact_name ? ` • ${escapeHtml(m.contact_name)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-ghost btn-xs" onclick="openMediaModal(${m.id})">Open</button>
        </div>
      </div>
    `).join('');
  }

  // 3. Upcoming & Overdue Deliverables
  document.getElementById('count-upcoming-deliverables').textContent = data.upcoming_deliverables.length;
  const delivEl = document.getElementById('list-upcoming-deliverables');
  if (data.upcoming_deliverables.length === 0) {
    delivEl.innerHTML = `<div class="empty-state">No active deliverables due right now.</div>`;
  } else {
    delivEl.innerHTML = data.upcoming_deliverables.map((s) => {
      const badge = s.is_overdue_deliverable
        ? `<span class="badge badge-danger">Overdue (${escapeHtml(s.due_date)})</span>`
        : `<span class="badge badge-warning">Due ${escapeHtml(s.due_date || 'TBD')}</span>`;
      return `
        <div class="action-card">
          <div class="action-card-main">
            <div class="action-card-title">
              <span>${escapeHtml(s.brand)}</span>
              ${badge}
              ${s.effective_value > 0 ? `<span class="badge badge-info">${formatMoney(s.effective_value)}</span>` : ''}
            </div>
            <div class="action-card-meta">${escapeHtml(s.deliverables || 'Deliverables not specified')}</div>
          </div>
          <div class="action-card-buttons">
            <button class="btn btn-secondary btn-xs" onclick="quickUpdateSponsorship(${s.id}, { status: 'Posted', content_posted: 1 })">Mark Posted</button>
            <button class="btn btn-ghost btn-xs" onclick="openSponsorshipModal(${s.id})">Open</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Unpaid Invoices & Ready to Invoice
  document.getElementById('count-unpaid-invoices').textContent = data.unpaid_invoices.length;
  const invEl = document.getElementById('list-unpaid-invoices');
  if (data.unpaid_invoices.length === 0) {
    invEl.innerHTML = `<div class="empty-state">No unpaid invoices or uninvoiced posted deals.</div>`;
  } else {
    invEl.innerHTML = data.unpaid_invoices.map((s) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(s.brand)}</span>
            <span class="badge ${s.is_unpaid_invoice ? 'badge-warning' : 'badge-purple'}">
              ${s.is_unpaid_invoice ? 'Invoice Unpaid' : 'Ready to Invoice'}
            </span>
            <span class="badge badge-success">${formatMoney(s.effective_value)}</span>
          </div>
          <div class="action-card-meta">
            Status: ${escapeHtml(s.status)} ${s.deliverables ? `• ${escapeHtml(s.deliverables)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          ${s.is_ready_to_invoice
            ? `<button class="btn btn-secondary btn-xs" onclick="quickUpdateSponsorship(${s.id}, { status: 'Invoiced', invoice_sent: 1 })">Mark Invoiced</button>`
            : `<button class="btn btn-primary btn-xs" onclick="quickUpdateSponsorship(${s.id}, { status: 'Paid', payment_received: 1 })">Mark Paid</button>`
          }
          <button class="btn btn-ghost btn-xs" onclick="openSponsorshipModal(${s.id})">Open</button>
        </div>
      </div>
    `).join('');
  }

  // 5. Content Ready to Edit
  document.getElementById('count-content-edit').textContent = data.content_ready_to_edit.length;
  const editEl = document.getElementById('list-content-edit');
  if (data.content_ready_to_edit.length === 0) {
    editEl.innerHTML = `<div class="empty-state">No filmed content waiting for editing.</div>`;
  } else {
    editEl.innerHTML = data.content_ready_to_edit.map((c) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(c.title)}</span>
            <span class="badge badge-info">${escapeHtml(c.platform || c.format)}</span>
            <span class="badge badge-purple">${escapeHtml(c.editing_status)}</span>
          </div>
          <div class="action-card-meta">
            ${c.content_pillar ? `${escapeHtml(c.content_pillar)} • ` : ''}
            ${c.scheduled_date ? `Target: ${escapeHtml(c.scheduled_date)}` : 'No target date'}
            ${c.sponsor ? ` • Sponsor: ${escapeHtml(c.sponsor)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-secondary btn-xs" onclick="quickUpdateContent(${c.id}, { stage: 'Ready' })">Mark Ready</button>
          <button class="btn btn-ghost btn-xs" onclick="openContentModal(${c.id})">Open</button>
        </div>
      </div>
    `).join('');
  }

  // 6. Content Ready to Publish
  document.getElementById('count-content-publish').textContent = data.content_ready_to_publish.length;
  const pubEl = document.getElementById('list-content-publish');
  if (data.content_ready_to_publish.length === 0) {
    pubEl.innerHTML = `<div class="empty-state">No content currently queued as Ready or Scheduled.</div>`;
  } else {
    pubEl.innerHTML = data.content_ready_to_publish.map((c) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(c.title)}</span>
            <span class="badge badge-info">${escapeHtml(c.platform || c.format)}</span>
            <span class="badge badge-success">${escapeHtml(c.stage)}</span>
          </div>
          <div class="action-card-meta">
            ${c.scheduled_date ? `Scheduled: ${escapeHtml(c.scheduled_date)}` : 'Ready for upload'}
            ${c.sponsor ? ` • Sponsor: ${escapeHtml(c.sponsor)}` : ''}
            ${c.affiliate_connection ? ` • Affiliate: ${escapeHtml(c.affiliate_connection)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-primary btn-xs" onclick="quickUpdateContent(${c.id}, { stage: 'Published' })">Mark Published</button>
          <button class="btn btn-ghost btn-xs" onclick="openContentModal(${c.id})">Open</button>
        </div>
      </div>
    `).join('');
  }

  // 7. Cycle 2 Goals Needing Action
  const goalsAction = data.goals_needing_action || [];
  document.getElementById('count-goals-action').textContent = goalsAction.length;
  const goalsActionEl = document.getElementById('list-goals-action');
  if (goalsAction.length === 0) {
    goalsActionEl.innerHTML = `<div class="empty-state">All current Cycle 2 goals are completed.</div>`;
  } else {
    goalsActionEl.innerHTML = goalsAction.map((g) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(g.goal)}</span>
            <span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(g.status)} (${Math.round(g.progress_pct || 0)}%)</span>
          </div>
          <div class="action-card-meta">
            Target: ${formatNum(g.target_value)} • Current: ${formatNum(g.current_value)}
            ${g.deadline ? ` • Due: ${escapeHtml(g.deadline)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-ghost btn-xs" onclick="openGoalModal(${g.id})">Update</button>
        </div>
      </div>
    `).join('');
  }

  // 8. Active Weekly Execution Tasks
  const activeTasks = data.active_tasks || [];
  document.getElementById('count-active-tasks').textContent = activeTasks.length;
  const activeTasksEl = document.getElementById('list-active-tasks');
  if (activeTasks.length === 0) {
    activeTasksEl.innerHTML = `<div class="empty-state">No uncompleted active tasks right now. Historical Notion tasks are held in the Review queue below.</div>`;
  } else {
    activeTasksEl.innerHTML = activeTasks.map((t) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(t.task_name)}</span>
            <span class="badge badge-info">${escapeHtml(t.category)}</span>
          </div>
          <div class="action-card-meta">
            ${t.due_date ? `Due: ${escapeHtml(t.due_date)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-secondary btn-xs" onclick="quickUpdateTask(${t.id}, { status: 'Done', is_historical: 1, needs_review: 0 })">Done</button>
          <button class="btn btn-ghost btn-xs" onclick="openTaskModal(${t.id})">Open</button>
        </div>
      </div>
    `).join('');
  }

  // 9. Upcoming Deadlines
  document.getElementById('count-upcoming-deadlines').textContent = data.upcoming_deadlines.length;
  const deadlinesEl = document.getElementById('list-upcoming-deadlines');
  if (data.upcoming_deadlines.length === 0) {
    deadlinesEl.innerHTML = `<div class="empty-state">No deadlines in the next 14 days.</div>`;
  } else {
    deadlinesEl.innerHTML = data.upcoming_deadlines.map((d) => {
      const badgeCls = d.is_overdue ? 'badge-danger' : (d.days_from_today === 0 ? 'badge-warning' : 'badge-muted');
      const dayLabel = d.is_overdue
        ? `${Math.abs(d.days_from_today)}d overdue`
        : (d.days_from_today === 0 ? 'Today' : `In ${d.days_from_today}d`);
      let openFn = `openSponsorshipModal(${d.entity_id})`;
      if (d.entity_type === 'content') openFn = `openContentModal(${d.entity_id})`;
      else if (d.entity_type === 'media') openFn = `openMediaModal(${d.entity_id})`;
      return `
        <div class="action-card">
          <div class="action-card-main">
            <div class="action-card-title">
              <span class="badge ${badgeCls}">${escapeHtml(d.date)} (${dayLabel})</span>
              <span>${escapeHtml(d.title)}</span>
            </div>
            <div class="action-card-meta">${escapeHtml(d.subtitle || '')}</div>
          </div>
          <div class="action-card-buttons">
            <button class="btn btn-ghost btn-xs" onclick="${openFn}">Open</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 10. High-Value Open Opportunities
  document.getElementById('count-high-value').textContent = data.high_value_opportunities.length;
  const hvEl = document.getElementById('list-high-value');
  if (data.high_value_opportunities.length === 0) {
    hvEl.innerHTML = `<div class="empty-state">No open sponsorship opportunities with dollar values logged right now.</div>`;
  } else {
    hvEl.innerHTML = data.high_value_opportunities.map((s) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(s.brand)}</span>
            <span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span>
            <span class="badge badge-success">${formatMoney(s.effective_value)}</span>
            ${s.category ? `<span class="badge badge-muted">${escapeHtml(s.category)}</span>` : ''}
          </div>
          <div class="action-card-meta">
            ${s.deliverables ? `Deliverables: ${escapeHtml(s.deliverables)} • ` : ''}
            ${s.contact_name ? `Contact: ${escapeHtml(s.contact_name)} • ` : ''}
            ${s.follow_up_date ? `Follow-up: ${escapeHtml(s.follow_up_date)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-ghost btn-xs" onclick="openSponsorshipModal(${s.id})">Edit Deal</button>
        </div>
      </div>
    `).join('');
  }

  // 11. Needs Review Triage Queue
  const nrQueue = data.needs_review_queue || [];
  document.getElementById('count-needs-review').textContent = nrQueue.length;
  const nrEl = document.getElementById('list-needs-review');
  if (nrQueue.length === 0) {
    nrEl.innerHTML = `<div class="empty-state">No historical items awaiting date review.</div>`;
  } else {
    const spCount = nrQueue.filter((i) => i.entity_type === 'sponsorship').length;
    const mdCount = nrQueue.filter((i) => i.entity_type === 'media').length;
    const tkCount = nrQueue.filter((i) => i.entity_type === 'task').length;
    nrEl.innerHTML = `
      <div class="button-row" style="justify-content:space-between;padding:4px 2px 10px;">
        <div class="text-sm">
          <strong>${spCount} Brand Deals</strong> (historical July–Aug follow-up dates),
          <strong>${mdCount} Media Outlets</strong> (historical July–Aug follow-up dates), and
          <strong>${tkCount} Weekly Execution Tasks</strong> (historical Cycle 1 dates) are safely flagged with <code>Needs Review</code> so they don't flood your daily alarms.
        </div>
        <div class="button-row">
          <button class="btn btn-secondary btn-xs" onclick="switchView('sponsorships'); document.querySelector('#sponsorship-quick-tabs [data-qf=needs_review]').click();">Review Brands (${spCount})</button>
          <button class="btn btn-secondary btn-xs" onclick="switchView('media'); document.querySelector('#media-quick-tabs [data-mqf=needs_review]').click();">Review Media (${mdCount})</button>
          <button class="btn btn-secondary btn-xs" onclick="switchView('tasks'); document.querySelector('#tasks-quick-tabs [data-tqf=needs_review]').click();">Review Tasks (${tkCount})</button>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// VIEW 2: SPONSORSHIP CRM
// ============================================================================

async function loadSponsorships() {
  const search = document.getElementById('sponsorship-search').value;
  const status = document.getElementById('sponsorship-status-filter').value;
  const category = document.getElementById('sponsorship-category-filter').value;
  const [sort_by, sort_dir] = document.getElementById('sponsorship-sort').value.split(':');

  const params = new URLSearchParams({ sort_by, sort_dir });
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (category) params.set('category', category);

  if (state.sponsorshipQuickFilter === 'followup') params.set('needs_followup', 'true');
  if (state.sponsorshipQuickFilter === 'needs_review') params.set('needs_review', 'true');
  if (state.sponsorshipQuickFilter === 'deliverables') params.set('overdue_deliverables', 'true');
  if (state.sponsorshipQuickFilter === 'unpaid') params.set('unpaid_invoices', 'true');

  state.sponsorships = await api(`/api/commandcenter/sponsorships?${params.toString()}`);
  renderSponsorshipsTable();
}

function renderSponsorshipsTable() {
  const tbody = document.getElementById('sponsorships-tbody');
  if (state.sponsorships.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No sponsorships match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.sponsorships.map((s) => {
    const statusOptions = state.enums.sponsorship_statuses.map((st) =>
      `<option value="${escapeHtml(st)}" ${s.status === st ? 'selected' : ''}>${escapeHtml(st)}</option>`
    ).join('');

    return `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(s.brand)}</div>
          <div class="cell-sub">
            ${s.category ? `<span class="badge badge-muted">${escapeHtml(s.category)}</span>` : ''}
            ${s.priority ? `<span class="badge badge-info">${escapeHtml(s.priority)}</span>` : ''}
          </div>
        </td>
        <td>
          <div>${escapeHtml(s.contact_name || '—')}</div>
          <div class="cell-sub">${escapeHtml(s.contact_email || '')}</div>
        </td>
        <td>
          <select class="inline-select" onchange="quickUpdateSponsorship(${s.id}, { status: this.value })">
            ${statusOptions}
          </select>
          ${s.needs_followup ? `<div class="mt-4"><span class="badge badge-danger" title="${escapeHtml(s.followup_reason)}">Follow-up Needed</span></div>` : ''}
          ${s.needs_review ? `<div class="mt-4"><span class="badge badge-warning" title="Historical Notion follow-up date">Needs Review</span></div>` : ''}
        </td>
        <td>
          <div class="text-xs">1st: ${escapeHtml(s.date_first_contacted || '—')}</div>
          <div class="text-xs">Last: ${escapeHtml(s.last_contact_date || '—')}</div>
          <div class="text-xs"><strong>Next: ${escapeHtml(s.follow_up_date || '—')}</strong></div>
        </td>
        <td class="num">
          <div class="cell-primary">${s.agreed_rate > 0 ? formatMoney(s.agreed_rate) : '—'}</div>
          <div class="cell-sub">Offered: ${s.cash_offered > 0 ? formatMoney(s.cash_offered) : '—'}</div>
          ${s.product_offered ? `<div class="cell-sub">Prod: ${escapeHtml(s.product_offered)}</div>` : ''}
        </td>
        <td>
          <div>${escapeHtml(s.deliverables || s.products_requested || '—')}</div>
          ${s.due_date ? `<div class="cell-sub ${s.is_overdue_deliverable ? 'badge badge-danger' : ''}">Due: ${escapeHtml(s.due_date)}</div>` : ''}
        </td>
        <td>
          <div class="checklist-mini">
            <span class="check-tag ${s.pitch_sent ? 'done' : ''}" onclick="quickUpdateSponsorship(${s.id}, { pitch_sent: ${s.pitch_sent ? 0 : 1} })">Pitch</span>
            <span class="check-tag ${s.content_posted ? 'done' : ''}" onclick="quickUpdateSponsorship(${s.id}, { content_posted: ${s.content_posted ? 0 : 1} })">Posted</span>
            <span class="check-tag ${s.invoice_sent ? 'done' : ''}" onclick="quickUpdateSponsorship(${s.id}, { invoice_sent: ${s.invoice_sent ? 0 : 1} })">Invoiced</span>
            <span class="check-tag ${s.payment_received ? 'done' : ''}" onclick="quickUpdateSponsorship(${s.id}, { payment_received: ${s.payment_received ? 0 : 1} })">Paid</span>
          </div>
        </td>
        <td>
          ${s.response ? `<div class="text-xs"><strong>Reply:</strong> ${escapeHtml(s.response)}</div>` : ''}
          ${s.notes ? `<div class="cell-sub">${escapeHtml(s.notes)}</div>` : ''}
        </td>
        <td class="text-right">
          <div class="action-card-buttons" style="justify-content:flex-end;">
            ${s.needs_review ? `<button class="btn btn-warning btn-xs" onclick="quickUpdateSponsorship(${s.id}, { needs_review: 0 })" title="Clear Needs Review flag">Reviewed</button>` : ''}
            <button class="btn btn-secondary btn-xs" onclick="quickFollowUp(${s.id}, 5)" title="Log contact today & set follow-up +5d">+5d</button>
            <button class="btn btn-ghost btn-xs" onclick="openSponsorshipModal(${s.id})">Edit</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function quickUpdateSponsorship(id, patch) {
  try {
    await api(`/api/commandcenter/sponsorships/${id}`, { method: 'PUT', body: patch });
    showToast('Sponsorship updated');
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  }
}

async function quickFollowUp(id, days = 5) {
  try {
    await api(`/api/commandcenter/sponsorships/${id}/followup`, {
      method: 'POST',
      body: { followUpDays: days }
    });
    showToast(`Logged contact today & scheduled follow-up (+${days}d)`);
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  }
}

function openSponsorshipModal(id = null) {
  const modal = document.getElementById('modal-sponsorship');
  const form = document.getElementById('form-sponsorship');
  form.reset();

  const delBtn = document.getElementById('btn-delete-sponsorship');
  if (id) {
    const item = state.sponsorships.find((s) => s.id === Number(id)) ||
      state.dashboard?.overdue_followups?.find((s) => s.id === Number(id)) ||
      state.dashboard?.high_value_opportunities?.find((s) => s.id === Number(id));

    if (!item) {
      api(`/api/commandcenter/sponsorships/${id}`).then((fetched) => fillSponsorshipModal(fetched));
    } else {
      fillSponsorshipModal(item);
    }
    document.getElementById('modal-sponsorship-title').textContent = 'Edit Sponsorship';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('sp-id').value = '';
    document.getElementById('sp-status').value = 'Prospect';
    document.getElementById('sp-date-first').value = state.today;
    document.getElementById('modal-sponsorship-title').textContent = 'New Sponsorship Lead';
    delBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.getElementById('sp-brand').focus();
}

function fillSponsorshipModal(item) {
  document.getElementById('sp-id').value = item.id;
  document.getElementById('sp-brand').value = item.brand || '';
  document.getElementById('sp-category').value = item.category || '';
  document.getElementById('sp-status').value = item.status || 'Prospect';
  document.getElementById('sp-contact-name').value = item.contact_name || '';
  document.getElementById('sp-contact-email').value = item.contact_email || '';
  document.getElementById('sp-website').value = item.website || '';
  document.getElementById('sp-date-first').value = item.date_first_contacted || '';
  document.getElementById('sp-date-last').value = item.last_contact_date || '';
  document.getElementById('sp-date-followup').value = item.follow_up_date || '';
  document.getElementById('sp-product-offered').value = item.product_offered || '';
  document.getElementById('sp-cash-offered').value = item.cash_offered || '';
  document.getElementById('sp-agreed-rate').value = item.agreed_rate || '';
  document.getElementById('sp-deliverables').value = item.deliverables || '';
  document.getElementById('sp-due-date').value = item.due_date || '';
  document.getElementById('sp-priority').value = item.priority || '';
  document.getElementById('sp-deal-type').value = item.products_requested || '';
  document.getElementById('sp-next-action').value = item.original_status || '';
  document.getElementById('sp-pitch-sent').checked = Boolean(item.pitch_sent);
  document.getElementById('sp-content-posted').checked = Boolean(item.content_posted);
  document.getElementById('sp-invoice-sent').checked = Boolean(item.invoice_sent);
  document.getElementById('sp-payment-received').checked = Boolean(item.payment_received);
  document.getElementById('sp-needs-review').checked = Boolean(item.needs_review);
  document.getElementById('sp-response').value = item.response || '';
  document.getElementById('sp-notes').value = item.notes || '';
}

// ============================================================================
// VIEW 3: MEDIA OUTREACH CRM
// ============================================================================

async function loadMedia() {
  const search = document.getElementById('media-search').value;
  const status = document.getElementById('media-status-filter').value;
  const type = document.getElementById('media-category-filter').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (type && type !== 'all') params.set('type', type);

  if (state.mediaQuickFilter === 'followup') params.set('needs_followup', 'true');
  if (state.mediaQuickFilter === 'needs_review') params.set('needs_review', 'true');
  if (state.mediaQuickFilter === 'published') params.set('status', 'Published');

  state.mediaOutreach = await api(`/api/commandcenter/media?${params.toString()}`);
  renderMediaTable();
}

function renderMediaTable() {
  const tbody = document.getElementById('media-tbody');
  if (state.mediaOutreach.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No media outreach records match your filter.</td></tr>`;
    return;
  }

  const mdStatuses = state.enums.media_statuses || ['Prospect', 'Contacted', 'Follow-up', 'Interested', 'Booked', 'Published', 'Declined', 'No Response'];

  tbody.innerHTML = state.mediaOutreach.map((m) => {
    const statusOpts = mdStatuses.map((st) =>
      `<option value="${escapeHtml(st)}" ${m.status === st ? 'selected' : ''}>${escapeHtml(st)}</option>`
    ).join('');

    return `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(m.outlet)}</div>
          <div class="cell-sub">${escapeHtml(m.pitch_subject || '')}</div>
        </td>
        <td>
          <div><span class="badge badge-muted">${escapeHtml(m.type)}</span></div>
          ${m.priority ? `<div class="mt-4"><span class="badge badge-info">${escapeHtml(m.priority)}</span></div>` : ''}
        </td>
        <td>
          <div>${escapeHtml(m.contact_name || '—')}</div>
          <div class="cell-sub">${escapeHtml(m.contact_email || '')}</div>
        </td>
        <td>
          <select class="inline-select" onchange="quickUpdateMedia(${m.id}, { status: this.value })">
            ${statusOpts}
          </select>
          ${m.needs_followup ? `<div class="mt-4"><span class="badge badge-danger">Follow-up Due</span></div>` : ''}
          ${m.needs_review ? `<div class="mt-4"><span class="badge badge-warning">Needs Review</span></div>` : ''}
        </td>
        <td>
          <div class="text-xs">Last Contact: ${escapeHtml(m.last_contact_date || '—')}</div>
          <div class="text-xs"><strong>Follow-up: ${escapeHtml(m.follow_up_date || '—')}</strong></div>
        </td>
        <td><div class="cell-sub">${escapeHtml(m.story_angle || '—')}</div></td>
        <td>
          ${m.website ? `<div class="text-xs"><a href="${escapeHtml(m.website)}" target="_blank" rel="noopener" style="color:var(--info);">Outlet Link ↗</a></div>` : ''}
          <div class="cell-sub">${escapeHtml(m.notes || '')}</div>
        </td>
        <td class="text-right">
          <div class="action-card-buttons" style="justify-content:flex-end;">
            ${m.needs_review ? `<button class="btn btn-warning btn-xs" onclick="quickUpdateMedia(${m.id}, { needs_review: 0 })">Reviewed</button>` : ''}
            <button class="btn btn-ghost btn-xs" onclick="openMediaModal(${m.id})">Edit</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function quickUpdateMedia(id, patch) {
  try {
    await api(`/api/commandcenter/media/${id}`, { method: 'PUT', body: patch });
    showToast('Media outreach updated');
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  }
}

function openMediaModal(id = null) {
  const modal = document.getElementById('modal-media');
  const form = document.getElementById('form-media');
  form.reset();
  const delBtn = document.getElementById('btn-delete-media');

  if (id) {
    const item = state.mediaOutreach.find((m) => m.id === Number(id)) ||
      state.dashboard?.overdue_media_followups?.find((m) => m.id === Number(id));
    if (item) {
      fillMediaModal(item);
    } else {
      api(`/api/commandcenter/media/${id}`).then(fillMediaModal);
    }
    document.getElementById('modal-media-title').textContent = 'Edit Media Outreach Pitch';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('md-id').value = '';
    document.getElementById('md-status').value = 'Prospect';
    document.getElementById('md-pitch-date').value = state.today;
    document.getElementById('modal-media-title').textContent = 'New Media Outreach Pitch';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('md-name').focus();
}

function fillMediaModal(item) {
  document.getElementById('md-id').value = item.id;
  document.getElementById('md-name').value = item.outlet || '';
  document.getElementById('md-category').value = item.type || 'Podcast';
  document.getElementById('md-status').value = item.status || 'Prospect';
  document.getElementById('md-host').value = item.contact_name || '';
  document.getElementById('md-email').value = item.contact_email || '';
  document.getElementById('md-priority').value = item.priority || 'Medium';
  document.getElementById('md-pitch-date').value = item.last_contact_date || '';
  document.getElementById('md-followup-date').value = item.follow_up_date || '';
  document.getElementById('md-location').value = item.pitch_subject || '';
  document.getElementById('md-website').value = item.website || '';
  document.getElementById('md-episode-link').value = item.cc_alternate || '';
  document.getElementById('md-followup-sent').checked = item.status === 'Follow-up';
  document.getElementById('md-needs-review').checked = Boolean(item.needs_review);
  document.getElementById('md-story-angle').value = item.story_angle || '';
  document.getElementById('md-notes').value = item.notes || '';
}

// ============================================================================
// VIEW 4: AFFILIATE TRACKING
// ============================================================================

async function loadAffiliates() {
  const search = document.getElementById('affiliate-search').value;
  const [sort_by, sort_dir] = document.getElementById('affiliate-sort').value.split(':');
  const params = new URLSearchParams({ sort_by, sort_dir });
  if (search) params.set('search', search);
  if (state.affiliateQuickFilter === 'has_code') params.set('has_code', 'true');
  if (state.affiliateQuickFilter === 'has_revenue') params.set('has_revenue', 'true');

  state.affiliates = await api(`/api/commandcenter/affiliates?${params.toString()}`);
  renderAffiliatesTable();
}

function renderAffiliatesTable() {
  const tbody = document.getElementById('affiliates-tbody');
  if (state.affiliates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No affiliate partnerships match your filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.affiliates.map((a) => `
    <tr>
      <td>
        <div class="cell-primary">${escapeHtml(a.program)}</div>
        <div class="cell-sub"><span class="badge ${statusBadgeClass(a.status || 'Active')}">${escapeHtml(a.status || 'Active')}</span></div>
      </td>
      <td>
        ${a.affiliate_url
          ? `<div class="button-row">
              <a href="${escapeHtml(a.affiliate_url)}" target="_blank" rel="noopener" class="text-sm" style="color:var(--info);max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(a.affiliate_url)}</a>
              <button class="btn btn-ghost btn-xs" onclick="copyText('${escapeHtml(a.affiliate_url)}', 'Affiliate URL')">Copy</button>
             </div>`
          : '<span class="text-muted">—</span>'}
      </td>
      <td>
        ${a.coupon_code
          ? `<div class="button-row">
              <span class="badge badge-warning">${escapeHtml(a.coupon_code)}</span>
              <button class="btn btn-ghost btn-xs" onclick="copyText('${escapeHtml(a.coupon_code)}', 'Coupon code')">Copy</button>
             </div>`
          : '<span class="text-muted">—</span>'}
      </td>
      <td>${escapeHtml(a.commission || '—')}</td>
      <td class="num"><span class="cell-primary">${formatMoney(a.revenue, true)}</span></td>
      <td class="num">${a.clicks !== null && a.clicks !== undefined ? Number(a.clicks).toLocaleString() : '—'}</td>
      <td>
        <div>${escapeHtml(a.conversion_info || '—')}</div>
        ${a.products_promoted ? `<div class="cell-sub">${escapeHtml(a.products_promoted)}</div>` : ''}
      </td>
      <td><div class="cell-sub">${escapeHtml(a.notes || '—')}</div></td>
      <td><span class="text-xs text-muted">${escapeHtml(a.last_updated || '—')}</span></td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="openAffiliateModal(${a.id})">Edit</button>
      </td>
    </tr>
  `).join('');
}

function copyText(text, label) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
  showToast(`${label} copied to clipboard`);
}

function openAffiliateModal(id = null) {
  const modal = document.getElementById('modal-affiliate');
  const form = document.getElementById('form-affiliate');
  form.reset();

  const delBtn = document.getElementById('btn-delete-affiliate');
  if (id) {
    const item = state.affiliates.find((a) => a.id === Number(id));
    if (item) {
      document.getElementById('af-id').value = item.id;
      document.getElementById('af-program').value = item.program || '';
      document.getElementById('af-status').value = item.status || 'Active';
      document.getElementById('af-commission').value = item.commission || '';
      document.getElementById('af-url').value = item.affiliate_url || '';
      document.getElementById('af-code').value = item.coupon_code || '';
      document.getElementById('af-revenue').value = item.revenue !== null && item.revenue !== undefined ? item.revenue : '';
      document.getElementById('af-clicks').value = item.clicks !== null && item.clicks !== undefined ? item.clicks : '';
      document.getElementById('af-conversions').value = item.conversion_info || '';
      document.getElementById('af-updated').value = item.last_updated || state.today;
      document.getElementById('af-products').value = item.products_promoted || '';
      document.getElementById('af-notes').value = item.notes || '';
    }
    document.getElementById('modal-affiliate-title').textContent = 'Edit Affiliate Partnership';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('af-id').value = '';
    document.getElementById('af-status').value = 'Active';
    document.getElementById('af-updated').value = state.today;
    document.getElementById('modal-affiliate-title').textContent = 'New Affiliate Partnership';
    delBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.getElementById('af-program').focus();
}

// ============================================================================
// VIEW 5: REVENUE DASHBOARD
// ============================================================================

async function loadRevenue() {
  const search = document.getElementById('revenue-search').value;
  const category = document.getElementById('revenue-category-filter').value;
  const status = document.getElementById('revenue-status-filter').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category && category !== 'all') params.set('category', category);
  if (status && status !== 'all') params.set('status', status);

  const [summary, entries] = await Promise.all([
    api('/api/commandcenter/revenue/summary'),
    api(`/api/commandcenter/revenue?${params.toString()}`)
  ]);

  state.revenueSummary = summary;
  state.revenueEntries = entries;
  renderRevenueDashboard(summary, entries);
}

function renderRevenueDashboard(summary, entries) {
  if (!summary) return;

  const kpiGrid = document.getElementById('revenue-kpi-grid');
  kpiGrid.innerHTML = `
    <div class="stat-card highlight">
      <div class="stat-label">Current Month (${escapeHtml(summary.current_month_label)})</div>
      <div class="stat-value">${formatMoney(summary.current_month)}</div>
      <div class="stat-sub">Cycle 2 checkpoint ($1.08 FB)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Previous Month (${escapeHtml(summary.previous_month_label)})</div>
      <div class="stat-value">${formatMoney(summary.previous_month)}</div>
      <div class="stat-sub">Received revenue</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">YTD (${escapeHtml(summary.current_year)})</div>
      <div class="stat-value">${formatMoney(summary.ytd)}</div>
      <div class="stat-sub">All-Time: ${formatMoney(summary.all_time)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Outstanding Invoices</div>
      <div class="stat-value">${formatMoney(summary.outstanding_invoices)}</div>
      <div class="stat-sub">${summary.outstanding_invoices_count} unpaid invoice(s)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Expected Sponsorship Income</div>
      <div class="stat-value">${formatMoney(summary.expected_sponsorship_income)}</div>
      <div class="stat-sub">${summary.expected_sponsorship_count} contracted/active deal(s)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Affiliate Income (YTD)</div>
      <div class="stat-value">${formatMoney(summary.affiliate_income)}</div>
      <div class="stat-sub">Tracker Total: ${formatMoney(summary.affiliate_tracker_total)}</div>
    </div>
  `;

  const catTbody = document.getElementById('revenue-category-tbody');
  const cats = Object.values(summary.by_category || {});
  catTbody.innerHTML = cats.map((c) => `
    <tr>
      <td><strong>${escapeHtml(c.category)}</strong></td>
      <td class="num">${formatMoney(c.current_month)}</td>
      <td class="num">${formatMoney(c.previous_month)}</td>
      <td class="num"><strong>${formatMoney(c.ytd)}</strong></td>
      <td class="num">${formatMoney(c.all_time)}</td>
    </tr>
  `).join('') + `
    <tr style="background:var(--bg-surface-2);font-weight:700;">
      <td>TOTAL RECEIVED</td>
      <td class="num">${formatMoney(summary.current_month)}</td>
      <td class="num">${formatMoney(summary.previous_month)}</td>
      <td class="num">${formatMoney(summary.ytd)}</td>
      <td class="num">${formatMoney(summary.all_time)}</td>
    </tr>
  `;

  const expList = document.getElementById('revenue-expected-list');
  const expectedItems = summary.expected_sponsorship_items || [];
  if (expectedItems.length === 0) {
    expList.innerHTML = `<div class="empty-state">No unpaid contracted, due, posted, or invoiced sponsorships right now.</div>`;
  } else {
    expList.innerHTML = expectedItems.map((s) => `
      <div class="action-card">
        <div class="action-card-main">
          <div class="action-card-title">
            <span>${escapeHtml(s.brand)}</span>
            <span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span>
            <span class="badge badge-success">${formatMoney(s.effective_value)}</span>
          </div>
          <div class="action-card-meta">
            ${s.deliverables ? `${escapeHtml(s.deliverables)} • ` : ''}
            ${s.due_date ? `Due: ${escapeHtml(s.due_date)}` : ''}
          </div>
        </div>
        <div class="action-card-buttons">
          <button class="btn btn-primary btn-xs" onclick="quickUpdateSponsorship(${s.id}, { status: 'Paid', payment_received: 1 })">Mark Paid</button>
        </div>
      </div>
    `).join('');
  }

  const ledgerTbody = document.getElementById('revenue-ledger-tbody');
  if (entries.length === 0) {
    ledgerTbody.innerHTML = `<tr><td colspan="7" class="empty-state">No revenue entries logged yet.</td></tr>`;
  } else {
    ledgerTbody.innerHTML = entries.map((r) => `
      <tr>
        <td><span class="text-xs">${escapeHtml(r.entry_date)}</span></td>
        <td><span class="badge badge-info">${escapeHtml(r.category)}</span></td>
        <td><div class="cell-primary">${escapeHtml(r.source_name || '—')}</div></td>
        <td><span class="badge ${r.status === 'Received' ? 'badge-success' : 'badge-warning'}">${escapeHtml(r.status)}</span></td>
        <td class="num"><span class="cell-primary">${formatMoney(r.amount)}</span></td>
        <td><div class="cell-sub">${escapeHtml(r.notes || '—')}</div></td>
        <td class="text-right">
          <button class="btn btn-ghost btn-xs" onclick="openRevenueModal(${r.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  }
}

function openRevenueModal(id = null) {
  const modal = document.getElementById('modal-revenue');
  const form = document.getElementById('form-revenue');
  form.reset();

  const delBtn = document.getElementById('btn-delete-revenue');
  if (id) {
    const item = state.revenueEntries.find((r) => r.id === Number(id));
    if (item) {
      document.getElementById('rv-id').value = item.id;
      document.getElementById('rv-category').value = item.category || 'Sponsorships';
      document.getElementById('rv-amount').value = item.amount ?? '';
      document.getElementById('rv-source').value = item.source_name || '';
      document.getElementById('rv-date').value = item.entry_date || state.today;
      document.getElementById('rv-status').value = item.status || 'Received';
      document.getElementById('rv-notes').value = item.notes || '';
    }
    document.getElementById('modal-revenue-title').textContent = 'Edit Revenue Entry';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('rv-id').value = '';
    document.getElementById('rv-category').value = 'Sponsorships';
    document.getElementById('rv-date').value = state.today;
    document.getElementById('rv-status').value = 'Received';
    document.getElementById('modal-revenue-title').textContent = 'Log Revenue Entry';
    delBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.getElementById('rv-amount').focus();
}

// ============================================================================
// VIEW 6: CONTENT PIPELINE
// ============================================================================

async function loadContent() {
  const search = document.getElementById('content-search').value;
  const platform = document.getElementById('content-platform-filter').value;
  const format = document.getElementById('content-format-filter').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (platform && platform !== 'all') params.set('platform', platform);
  if (format && format !== 'all') params.set('format', format);
  if (state.contentStageFilter !== 'all') params.set('stage', state.contentStageFilter);

  state.contentItems = await api(`/api/commandcenter/content?${params.toString()}`);
  renderContentTable();
  renderContentBoard();
}

function renderContentTable() {
  const tbody = document.getElementById('content-tbody');
  if (state.contentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No content items in this pipeline view.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.contentItems.map((c) => {
    const stageOptions = state.enums.content_stages.map((st) =>
      `<option value="${escapeHtml(st)}" ${c.stage === st ? 'selected' : ''}>${escapeHtml(st)}</option>`
    ).join('');

    const siblingCount = Array.isArray(c.platform_outputs) ? c.platform_outputs.length : 1;
    const siblingBadge = siblingCount > 1
      ? `<span class="badge badge-purple" title="Linked platform outputs for this idea">${siblingCount} platform outputs</span>`
      : '';

    return `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(c.title)}</div>
          <div class="cell-sub">
            ${c.content_pillar ? `<span class="badge badge-muted">${escapeHtml(c.content_pillar)}</span>` : ''}
            ${siblingBadge}
          </div>
        </td>
        <td>
          <div><span class="badge badge-info">${escapeHtml(c.platform || '—')}</span></div>
          <div class="cell-sub">${escapeHtml(c.format)}</div>
        </td>
        <td>
          <select class="inline-select" onchange="quickUpdateContent(${c.id}, { stage: this.value })">
            ${stageOptions}
          </select>
        </td>
        <td><span class="badge ${c.filming_status === 'Filmed' ? 'badge-success' : 'badge-muted'}">${escapeHtml(c.filming_status)}</span></td>
        <td><span class="badge ${c.editing_status === 'Final / Exported' ? 'badge-success' : 'badge-muted'}">${escapeHtml(c.editing_status)}</span></td>
        <td>
          <div class="text-xs">Sched: ${escapeHtml(c.scheduled_date || '—')}</div>
          <div class="text-xs">Pub: ${escapeHtml(c.published_date || '—')}</div>
          ${c.url ? `<div class="text-xs"><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener" style="color:var(--info);">View Post ↗</a></div>` : ''}
        </td>
        <td>
          ${c.sponsor ? `<div class="text-xs"><strong>Sponsor:</strong> ${escapeHtml(c.sponsor)}</div>` : ''}
          ${c.affiliate_connection ? `<div class="text-xs"><strong>Affiliate:</strong> ${escapeHtml(c.affiliate_connection)}</div>` : ''}
          ${!c.sponsor && !c.affiliate_connection ? '<span class="text-muted">—</span>' : ''}
        </td>
        <td>
          ${c.views ? `<div><span class="badge badge-success">${formatNum(c.views)} views</span></div>` : ''}
          ${c.hook ? `<div class="text-xs"><strong>Hook:</strong> ${escapeHtml(c.hook)}</div>` : ''}
          <div class="cell-sub">${escapeHtml(c.notes || '—')}</div>
        </td>
        <td class="text-right">
          <div class="action-card-buttons" style="justify-content:flex-end;">
            <button class="btn btn-secondary btn-xs" onclick="promptAddPlatformOutput(${c.id})" title="Add another platform output for this idea">+ Platform</button>
            <button class="btn btn-ghost btn-xs" onclick="openContentModal(${c.id})">Edit</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderContentBoard() {
  const board = document.getElementById('content-board-wrapper');
  board.innerHTML = state.enums.content_stages.map((stage, idx) => {
    const items = state.contentItems.filter((c) => c.stage === stage);
    const nextStage = state.enums.content_stages[idx + 1] || null;

    return `
      <div class="board-column">
        <div class="board-col-header">
          <span>${escapeHtml(stage)}</span>
          <span class="count-pill neutral">${items.length}</span>
        </div>
        <div class="board-col-body">
          ${items.map((c) => `
            <div class="board-card">
              <div class="board-card-title">${escapeHtml(c.title)}</div>
              <div class="button-row">
                <span class="badge badge-info">${escapeHtml(c.platform || c.format)}</span>
                ${c.sponsor ? `<span class="badge badge-warning">${escapeHtml(c.sponsor)}</span>` : ''}
              </div>
              ${c.scheduled_date ? `<div class="text-xs text-muted">Scheduled: ${escapeHtml(c.scheduled_date)}</div>` : ''}
              <div class="board-card-footer">
                <button class="btn btn-ghost btn-xs" onclick="openContentModal(${c.id})">Edit</button>
                ${nextStage ? `<button class="btn btn-secondary btn-xs" onclick="quickUpdateContent(${c.id}, { stage: '${escapeHtml(nextStage)}' })">→ ${escapeHtml(nextStage)}</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function quickUpdateContent(id, patch) {
  try {
    await api(`/api/commandcenter/content/${id}`, { method: 'PUT', body: patch });
    showToast('Content item updated');
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  }
}

async function promptAddPlatformOutput(contentId) {
  const item = state.contentItems.find((c) => c.id === Number(contentId));
  if (!item) return;
  openContentModal(null, item);
}

function openContentModal(id = null, cloneFromParent = null) {
  const modal = document.getElementById('modal-content');
  const form = document.getElementById('form-content');
  form.reset();
  document.querySelectorAll('.ct-extra-platform').forEach((cb) => { cb.checked = false; });

  const delBtn = document.getElementById('btn-delete-content');
  const multiBox = document.getElementById('ct-multi-platform-box');

  if (id) {
    const item = state.contentItems.find((c) => c.id === Number(id)) ||
      state.dashboard?.content_ready_to_edit?.find((c) => c.id === Number(id)) ||
      state.dashboard?.content_ready_to_publish?.find((c) => c.id === Number(id));

    if (item) {
      fillContentModal(item);
    } else {
      api(`/api/commandcenter/content/${id}`).then(fillContentModal);
    }
    document.getElementById('modal-content-title').textContent = 'Edit Content Item';
    delBtn.classList.remove('hidden');
    multiBox.classList.add('hidden');
  } else if (cloneFromParent) {
    document.getElementById('ct-id').value = '';
    document.getElementById('ct-parent-id').value = cloneFromParent.parent_idea_id || cloneFromParent.id;
    document.getElementById('ct-title').value = cloneFromParent.title || '';
    document.getElementById('ct-pillar').value = cloneFromParent.content_pillar || '';
    document.getElementById('ct-platform').value = 'TikTok';
    document.getElementById('ct-format').value = 'Short-form';
    document.getElementById('ct-stage').value = cloneFromParent.stage || 'Idea';
    document.getElementById('ct-filming-status').value = cloneFromParent.filming_status || 'Not Started';
    document.getElementById('ct-editing-status').value = cloneFromParent.editing_status || 'Not Started';
    document.getElementById('ct-scheduled-date').value = cloneFromParent.scheduled_date || '';
    document.getElementById('ct-sponsor').value = cloneFromParent.sponsor || '';
    document.getElementById('ct-affiliate').value = cloneFromParent.affiliate_connection || '';
    document.getElementById('ct-performance').value = cloneFromParent.views || '';
    document.getElementById('ct-hook').value = cloneFromParent.hook || '';
    document.getElementById('ct-notes').value = cloneFromParent.notes || '';
    document.getElementById('modal-content-title').textContent = `Add Platform Output for "${cloneFromParent.title}"`;
    delBtn.classList.add('hidden');
    multiBox.classList.add('hidden');
  } else {
    document.getElementById('ct-id').value = '';
    document.getElementById('ct-parent-id').value = '';
    document.getElementById('ct-stage').value = 'Idea';
    document.getElementById('ct-filming-status').value = 'Not Started';
    document.getElementById('ct-editing-status').value = 'Not Started';
    document.getElementById('modal-content-title').textContent = 'New Content Idea';
    delBtn.classList.add('hidden');
    multiBox.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
  document.getElementById('ct-title').focus();
}

function fillContentModal(item) {
  document.getElementById('ct-id').value = item.id;
  document.getElementById('ct-parent-id').value = item.parent_idea_id || '';
  document.getElementById('ct-title').value = item.title || '';
  document.getElementById('ct-pillar').value = item.content_pillar || '';
  document.getElementById('ct-platform').value = item.platform || 'YouTube';
  document.getElementById('ct-format').value = item.format || 'Short-form';
  document.getElementById('ct-stage').value = item.stage || 'Idea';
  document.getElementById('ct-filming-status').value = item.filming_status || 'Not Started';
  document.getElementById('ct-editing-status').value = item.editing_status || 'Not Started';
  document.getElementById('ct-scheduled-date').value = item.scheduled_date || '';
  document.getElementById('ct-published-date').value = item.published_date || '';
  document.getElementById('ct-url').value = item.url || '';
  document.getElementById('ct-sponsor').value = item.sponsor || '';
  document.getElementById('ct-affiliate').value = item.affiliate_connection || '';
  document.getElementById('ct-performance').value = item.views || '';
  document.getElementById('ct-hook').value = item.hook || '';
  document.getElementById('ct-notes').value = item.notes || '';
}

// ============================================================================
// VIEW 7: AUDIENCE / GROWTH TRACKER
// ============================================================================

async function loadGrowth() {
  const [snapshots, summary] = await Promise.all([
    api('/api/commandcenter/growth'),
    api('/api/commandcenter/growth/summary')
  ]);
  state.growthSnapshots = snapshots;
  state.growthSummary = summary;
  renderGrowthView(snapshots, summary);
}

function renderGrowthView(snapshots, summary) {
  const kpiGrid = document.getElementById('growth-kpi-grid');
  const latest = summary?.latest || {};
  const deltaC2 = latest.delta_cycle2_baseline || {};

  kpiGrid.innerHTML = `
    <div class="stat-card highlight">
      <div class="stat-label">Combined Audience (${escapeHtml(latest.snapshot_date || 'Current')})</div>
      <div class="stat-value">${formatNum(latest.combined_audience)}</div>
      <div class="stat-sub">Cycle 2 Delta: +${formatNum(deltaC2.combined)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">TikTok</div>
      <div class="stat-value">${formatNum(latest.tiktok)}</div>
      <div class="stat-sub">Cycle 2 Delta: +${formatNum(deltaC2.tiktok)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Instagram</div>
      <div class="stat-value">${formatNum(latest.instagram)}</div>
      <div class="stat-sub">Cycle 2 Delta: +${formatNum(deltaC2.instagram)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Facebook</div>
      <div class="stat-value">${formatNum(latest.facebook)}</div>
      <div class="stat-sub">Cycle 2 Delta: +${formatNum(deltaC2.facebook)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">YouTube</div>
      <div class="stat-value">${formatNum(latest.youtube)}</div>
      <div class="stat-sub">Cycle 2 Delta: +${formatNum(deltaC2.youtube)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Snapshots Logged</div>
      <div class="stat-value">${snapshots.length}</div>
      <div class="stat-sub">Time-series history preserved</div>
    </div>
  `;

  const tbody = document.getElementById('growth-tbody');
  if (snapshots.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">No growth snapshots logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = snapshots.map((g) => `
    <tr>
      <td>
        <div class="cell-primary">${escapeHtml(g.label)}</div>
        <div class="cell-sub"><span class="badge badge-muted">${escapeHtml(g.cycle || '')}</span></div>
      </td>
      <td><span class="text-xs">${escapeHtml(g.snapshot_date)}</span></td>
      <td class="num">
        <div>${formatNum(g.facebook)}</div>
        <div class="text-xs">${formatDelta(g.delta_prev?.facebook)}</div>
      </td>
      <td class="num">
        <div>${formatNum(g.instagram)}</div>
        <div class="text-xs">${formatDelta(g.delta_prev?.instagram)}</div>
      </td>
      <td class="num">
        <div>${formatNum(g.tiktok)}</div>
        <div class="text-xs">${formatDelta(g.delta_prev?.tiktok)}</div>
      </td>
      <td class="num">
        <div>${formatNum(g.youtube)}</div>
        <div class="text-xs">${formatDelta(g.delta_prev?.youtube)}</div>
      </td>
      <td class="num"><span class="cell-primary">${formatNum(g.combined_audience)}</span></td>
      <td class="num">${formatDelta(g.delta_prev?.combined)}</td>
      <td class="num">${formatNum(g.youtube_watch_hours)}</td>
      <td>
        ${g.revenue !== null && g.revenue !== undefined ? `<div class="text-xs"><strong>Rev:</strong> ${formatMoney(g.revenue)}</div>` : ''}
        <div class="cell-sub">${escapeHtml(g.notes || '—')}</div>
      </td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="openGrowthModal(${g.id})">Edit</button>
      </td>
    </tr>
  `).join('');
}

function openGrowthModal(id = null) {
  const modal = document.getElementById('modal-growth');
  const form = document.getElementById('form-growth');
  form.reset();
  const delBtn = document.getElementById('btn-delete-growth');

  if (id) {
    const item = state.growthSnapshots.find((g) => g.id === Number(id));
    if (item) {
      document.getElementById('gr-id').value = item.id;
      document.getElementById('gr-label').value = item.label || '';
      document.getElementById('gr-date').value = item.snapshot_date || '';
      document.getElementById('gr-fb').value = item.facebook ?? '';
      document.getElementById('gr-ig').value = item.instagram ?? '';
      document.getElementById('gr-tt').value = item.tiktok ?? '';
      document.getElementById('gr-yt').value = item.youtube ?? '';
      document.getElementById('gr-views').value = item.youtube_watch_hours ?? '';
      document.getElementById('gr-weight').value = item.threads ?? '';
      document.getElementById('gr-revenue').value = item.revenue ?? '';
      document.getElementById('gr-posts').value = '';
      document.getElementById('gr-notes').value = item.notes || '';
    }
    document.getElementById('modal-growth-title').textContent = 'Edit Audience Snapshot';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('gr-id').value = '';
    document.getElementById('gr-date').value = state.today;
    document.getElementById('modal-growth-title').textContent = 'Log Audience Snapshot';
    delBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.getElementById('gr-label').focus();
}

// ============================================================================
// VIEW 8: 90-DAY GOALS
// ============================================================================

async function loadGoals() {
  const search = document.getElementById('goals-search').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (state.goalCycleFilter && state.goalCycleFilter !== 'all') {
    params.set('cycle', state.goalCycleFilter);
  }
  state.goals = await api(`/api/commandcenter/goals?${params.toString()}`);
  renderGoalsTable();
}

function renderGoalsTable() {
  const tbody = document.getElementById('goals-tbody');
  if (state.goals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No goals match the selected cycle filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.goals.map((g) => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(g.progress_pct) || 0)));
    return `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(g.goal)}</div>
          <div class="cell-sub"><span class="badge ${g.cycle.includes('Cycle 2') ? 'badge-info' : 'badge-muted'}">${escapeHtml(g.cycle)}</span></div>
        </td>
        <td><span class="badge badge-muted">${escapeHtml(g.area || '—')}</span></td>
        <td><span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(g.status)}</span></td>
        <td>
          <div class="text-xs"><strong>${pct}%</strong></div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        </td>
        <td>${formatNum(g.target_value)}</td>
        <td><strong>${formatNum(g.current_value)}</strong></td>
        <td><span class="text-xs">${escapeHtml(g.deadline || '—')}</span></td>
        <td>
          ${g.weekly_action ? `<div class="text-xs"><strong>Action:</strong> ${escapeHtml(g.weekly_action)}</div>` : ''}
          <div class="cell-sub">${escapeHtml(g.notes || '—')}</div>
        </td>
        <td class="text-right">
          <button class="btn btn-ghost btn-xs" onclick="openGoalModal(${g.id})">Edit</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openGoalModal(id = null) {
  const modal = document.getElementById('modal-goal');
  const form = document.getElementById('form-goal');
  form.reset();
  const delBtn = document.getElementById('btn-delete-goal');

  if (id) {
    const item = state.goals.find((g) => g.id === Number(id)) ||
      state.dashboard?.goals_needing_action?.find((g) => g.id === Number(id));
    if (item) {
      fillGoalModal(item);
    } else {
      api(`/api/commandcenter/goals/${id}`).then(fillGoalModal);
    }
    document.getElementById('modal-goal-title').textContent = 'Edit 90-Day Goal';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('gl-id').value = '';
    document.getElementById('gl-cycle').value = 'Cycle 2';
    document.getElementById('gl-status').value = 'On Track';
    document.getElementById('modal-goal-title').textContent = 'New 90-Day Goal';
    delBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.getElementById('gl-title').focus();
}

function fillGoalModal(item) {
  document.getElementById('gl-id').value = item.id;
  document.getElementById('gl-title').value = item.goal || '';
  document.getElementById('gl-cycle').value = item.cycle || 'Cycle 2';
  document.getElementById('gl-category').value = item.area || '';
  document.getElementById('gl-status').value = item.status || 'On Track';
  document.getElementById('gl-priority').value = item.weekly_action || '';
  document.getElementById('gl-progress').value = item.progress_pct ?? 0;
  document.getElementById('gl-target-date').value = item.deadline || '';
  document.getElementById('gl-target-metric').value = item.target_value ?? '';
  document.getElementById('gl-current-value').value = item.current_value ?? '';
  document.getElementById('gl-notes').value = item.notes || '';
}

// ============================================================================
// VIEW 9: PROJECTS, COOKBOOK & 3D PRINTING
// ============================================================================

async function loadProjectsAndCookbook() {
  const [projects, recipes, printing] = await Promise.all([
    api('/api/commandcenter/projects'),
    api('/api/commandcenter/cookbook'),
    api('/api/commandcenter/printing')
  ]);
  state.projects = projects;
  state.cookbookRecipes = recipes;
  state.printingProjects = printing;
  renderProjectsAndCookbook();
}

function renderProjectsAndCookbook() {
  const projTbody = document.getElementById('projects-tbody');
  if (state.projects.length === 0) {
    projTbody.innerHTML = `<tr><td colspan="8" class="empty-state">No business projects logged yet.</td></tr>`;
  } else {
    projTbody.innerHTML = state.projects.map((p) => `
      <tr>
        <td><div class="cell-primary">${escapeHtml(p.name)}</div></td>
        <td><span class="badge badge-muted">${escapeHtml(p.category)}</span></td>
        <td><span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span></td>
        <td><strong>${escapeHtml(p.pricing_model || '—')}</strong></td>
        <td>${escapeHtml(p.platforms || '—')}</td>
        <td><div class="text-xs">${escapeHtml(p.next_milestone || '—')}</div></td>
        <td><div class="cell-sub">${escapeHtml(p.notes || p.description || '—')}</div></td>
        <td class="text-right">
          <button class="btn btn-ghost btn-xs" onclick="openProjectModal(${p.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  }

  const cookTbody = document.getElementById('cookbook-tbody');
  if (state.cookbookRecipes.length === 0) {
    cookTbody.innerHTML = `<tr><td colspan="6" class="empty-state">No recipes logged yet.</td></tr>`;
  } else {
    cookTbody.innerHTML = state.cookbookRecipes.map((r) => `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(r.recipe)}</div>
          <div class="cell-sub">${escapeHtml(r.notes || '')}</div>
        </td>
        <td><span class="badge badge-muted">${escapeHtml(r.category)}</span></td>
        <td><span class="badge badge-info">${escapeHtml(r.status)}</span></td>
        <td><div class="cell-sub">${escapeHtml(r.ingredients || '—')}</div></td>
        <td>
          ${r.recipe_card_ready ? '<span class="badge badge-success">Card Ready</span> ' : ''}
          ${r.photo_ready ? '<span class="badge badge-info">Photo Ready</span>' : '<span class="badge badge-muted">In Prep</span>'}
        </td>
        <td class="text-right">
          <button class="btn btn-ghost btn-xs" onclick="openRecipeModal(${r.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  }

  const printTbody = document.getElementById('printing-tbody');
  if (state.printingProjects.length === 0) {
    printTbody.innerHTML = `<tr><td colspan="6" class="empty-state">No 3D printing projects logged yet.</td></tr>`;
  } else {
    printTbody.innerHTML = state.printingProjects.map((p) => `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(p.project)}</div>
          <div class="cell-sub">${escapeHtml(p.notes || '')}</div>
        </td>
        <td><span class="badge badge-muted">${escapeHtml(p.category)}</span></td>
        <td><span class="badge badge-info">${escapeHtml(p.status)}</span></td>
        <td><div class="text-xs">${escapeHtml(p.material || '—')} • ${escapeHtml(p.printer || '')}</div></td>
        <td><div class="cell-sub">${escapeHtml(p.next_step || '—')}</div></td>
        <td class="text-right">
          <button class="btn btn-ghost btn-xs" onclick="openPrintingModal(${p.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  }
}

function openProjectModal(id = null) {
  const modal = document.getElementById('modal-project');
  const form = document.getElementById('form-project');
  form.reset();
  const delBtn = document.getElementById('btn-delete-project');
  if (id) {
    const item = state.projects.find((p) => p.id === Number(id));
    if (item) {
      document.getElementById('pj-id').value = item.id;
      document.getElementById('pj-name').value = item.name || '';
      document.getElementById('pj-category').value = item.category || '';
      document.getElementById('pj-status').value = item.status || '';
      document.getElementById('pj-pricing').value = item.pricing_model || '';
      document.getElementById('pj-platform').value = item.platforms || '';
      document.getElementById('pj-milestone').value = item.next_milestone || '';
      document.getElementById('pj-notes').value = item.notes || item.description || '';
    }
    document.getElementById('modal-project-title').textContent = 'Edit Business Project';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('pj-id').value = '';
    document.getElementById('pj-status').value = 'In Development';
    document.getElementById('modal-project-title').textContent = 'New Business Project';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('pj-name').focus();
}

function openRecipeModal(id = null) {
  const modal = document.getElementById('modal-recipe');
  const form = document.getElementById('form-recipe');
  form.reset();
  const delBtn = document.getElementById('btn-delete-recipe');
  if (id) {
    const item = state.cookbookRecipes.find((r) => r.id === Number(id));
    if (item) {
      document.getElementById('rc-id').value = item.id;
      document.getElementById('rc-name').value = item.recipe || '';
      document.getElementById('rc-category').value = item.category || '';
      document.getElementById('rc-status').value = item.status || '';
      document.getElementById('rc-video').value = item.source_post || '';
      document.getElementById('rc-in-cookbook').checked = Boolean(item.recipe_card_ready);
      document.getElementById('rc-photo-taken').checked = Boolean(item.photo_ready);
      document.getElementById('rc-ingredients').value = item.ingredients || '';
      document.getElementById('rc-instructions').value = item.cooking_instructions || item.body || '';
    }
    document.getElementById('modal-recipe-title').textContent = 'Edit Cookbook Recipe';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('rc-id').value = '';
    document.getElementById('rc-status').value = 'Idea';
    document.getElementById('rc-in-cookbook').checked = true;
    document.getElementById('modal-recipe-title').textContent = 'New Cookbook Recipe';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('rc-name').focus();
}

function openPrintingModal(id = null) {
  const modal = document.getElementById('modal-printing');
  const form = document.getElementById('form-printing');
  form.reset();
  const delBtn = document.getElementById('btn-delete-printing');
  if (id) {
    const item = state.printingProjects.find((p) => p.id === Number(id));
    if (item) {
      document.getElementById('pr-id').value = item.id;
      document.getElementById('pr-name').value = item.project || '';
      document.getElementById('pr-category').value = item.category || '';
      document.getElementById('pr-status').value = item.status || '';
      document.getElementById('pr-material').value = item.material || '';
      document.getElementById('pr-notes').value = item.notes || item.next_step || '';
    }
    document.getElementById('modal-printing-title').textContent = 'Edit 3D Printing Project';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('pr-id').value = '';
    document.getElementById('pr-status').value = 'Idea';
    document.getElementById('modal-printing-title').textContent = 'New 3D Printing Project';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('pr-name').focus();
}

// ============================================================================
// VIEW 10: TASKS / WEEKLY EXECUTION
// ============================================================================

async function loadTasks() {
  const search = document.getElementById('tasks-search').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  if (state.taskQuickFilter === 'active') {
    params.set('is_historical', 'false');
    params.set('needs_review', 'false');
  } else if (state.taskQuickFilter === 'needs_review') {
    params.set('needs_review', 'true');
  } else if (state.taskQuickFilter === 'done') {
    params.set('is_historical', 'true');
  }

  state.tasks = await api(`/api/commandcenter/tasks?${params.toString()}`);
  renderTasksTable();
}

function renderTasksTable() {
  const tbody = document.getElementById('tasks-tbody');
  if (state.tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No tasks match the current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.tasks.map((t) => {
    const isDone = ['Done', 'Archived'].includes(t.status);
    return `
      <tr>
        <td>
          <div class="cell-primary">${escapeHtml(t.task_name)}</div>
          ${t.needs_review ? `<div class="mt-4"><span class="badge badge-warning">Needs Review (Historical Date)</span></div>` : ''}
        </td>
        <td><span class="badge badge-muted">${escapeHtml(t.category || 'Execution')}</span></td>
        <td><span class="text-xs">${escapeHtml(t.assignee || 'Josh Greenway')}</span></td>
        <td><span class="badge ${statusBadgeClass(t.status)}">${escapeHtml(t.status)}</span></td>
        <td><span class="text-xs">${escapeHtml(t.due_date || '—')}</span></td>
        <td>
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="quickUpdateTask(${t.id}, { status: this.checked ? 'Done' : 'Not started', is_historical: this.checked ? 1 : 0, needs_review: 0 })" />
        </td>
        <td><div class="cell-sub">${escapeHtml(t.notes || '—')}</div></td>
        <td class="text-right">
          <div class="action-card-buttons" style="justify-content:flex-end;">
            ${t.needs_review ? `<button class="btn btn-warning btn-xs" onclick="quickUpdateTask(${t.id}, { needs_review: 0 })">Activate</button>` : ''}
            <button class="btn btn-ghost btn-xs" onclick="openTaskModal(${t.id})">Edit</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function quickUpdateTask(id, patch) {
  try {
    await api(`/api/commandcenter/tasks/${id}`, { method: 'PUT', body: patch });
    showToast('Task updated');
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  }
}

function openTaskModal(id = null) {
  const modal = document.getElementById('modal-task');
  const form = document.getElementById('form-task');
  form.reset();
  const delBtn = document.getElementById('btn-delete-task');

  if (id) {
    const item = state.tasks.find((t) => t.id === Number(id)) ||
      state.dashboard?.active_tasks?.find((t) => t.id === Number(id));
    if (item) {
      fillTaskModal(item);
    } else {
      api(`/api/commandcenter/tasks/${id}`).then(fillTaskModal);
    }
    document.getElementById('modal-task-title').textContent = 'Edit Task';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('tk-id').value = '';
    document.getElementById('tk-status').value = 'To Do';
    document.getElementById('tk-due-date').value = state.today;
    document.getElementById('modal-task-title').textContent = 'New Execution Task';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('tk-title').focus();
}

function fillTaskModal(item) {
  document.getElementById('tk-id').value = item.id;
  document.getElementById('tk-title').value = item.task_name || '';
  document.getElementById('tk-category').value = item.category || 'Content';
  document.getElementById('tk-status').value = item.status === 'Done' ? 'Done' : 'To Do';
  document.getElementById('tk-due-date').value = item.due_date || '';
  document.getElementById('tk-completed').checked = ['Done', 'Archived'].includes(item.status);
  document.getElementById('tk-needs-review').checked = Boolean(item.needs_review);
  document.getElementById('tk-notes').value = item.notes || '';
}

// ============================================================================
// VIEW 11: LOCAL REFERENCE LIBRARY
// ============================================================================

async function loadReference() {
  const search = document.getElementById('reference-search').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (state.referenceCategoryFilter !== 'all') params.set('category', state.referenceCategoryFilter);

  state.referenceDocs = await api(`/api/commandcenter/reference?${params.toString()}`);
  if (!state.activeReferenceDocId && state.referenceDocs.length > 0) {
    state.activeReferenceDocId = state.referenceDocs[0].id;
  }
  renderReferenceLibrary();
}

function renderReferenceLibrary() {
  const listEl = document.getElementById('reference-list');
  const readerEl = document.getElementById('reference-reader-panel');

  if (state.referenceDocs.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No reference documents match your filter.</div>`;
    readerEl.innerHTML = `<div class="empty-state">No document selected.</div>`;
    return;
  }

  listEl.innerHTML = state.referenceDocs.map((d) => `
    <div class="reference-doc-item ${d.id === state.activeReferenceDocId ? 'active' : ''}" onclick="selectReferenceDoc(${d.id})">
      <div class="button-row" style="justify-content:space-between;">
        <strong class="text-sm">${escapeHtml(d.title)}</strong>
        <span class="badge badge-muted">${escapeHtml(d.category)}</span>
      </div>
    </div>
  `).join('');

  const activeDoc = state.referenceDocs.find((d) => d.id === state.activeReferenceDocId) || state.referenceDocs[0];
  if (activeDoc) {
    readerEl.innerHTML = `
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${escapeHtml(activeDoc.title)}</h2>
          <p class="panel-subtitle">${escapeHtml(activeDoc.category)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openReferenceModal(${activeDoc.id})">Edit Document</button>
      </div>
      <div class="reference-markdown-body">${escapeHtml(activeDoc.content)}</div>
    `;
  }
}

function selectReferenceDoc(id) {
  state.activeReferenceDocId = Number(id);
  renderReferenceLibrary();
}

function openReferenceModal(id = null) {
  const modal = document.getElementById('modal-reference');
  const form = document.getElementById('form-reference');
  form.reset();
  const delBtn = document.getElementById('btn-delete-reference');

  if (id) {
    const item = state.referenceDocs.find((d) => d.id === Number(id));
    if (item) {
      document.getElementById('rf-id').value = item.id;
      document.getElementById('rf-title').value = item.title || '';
      document.getElementById('rf-category').value = item.category || 'SOP';
      document.getElementById('rf-content').value = item.content || '';
    }
    document.getElementById('modal-reference-title').textContent = 'Edit Reference Document';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('rf-id').value = '';
    document.getElementById('rf-category').value = 'SOP';
    document.getElementById('modal-reference-title').textContent = 'New Reference Document';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('rf-title').focus();
}

// ============================================================================
// VIEW 12: HEALTH & TRANSFORMATION LOG
// ============================================================================

async function loadHealth() {
  state.healthRecords = await api('/api/commandcenter/health');
  renderHealthTable();
}

function renderHealthTable() {
  const tbody = document.getElementById('health-tbody');
  if (state.healthRecords.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No health records logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.healthRecords.map((h) => `
    <tr>
      <td><div class="cell-primary">${escapeHtml(h.entry)}</div></td>
      <td><span class="text-xs">${escapeHtml(h.entry_date || '—')}</span></td>
      <td class="num"><strong>${formatNum(h.weight)}</strong></td>
      <td class="num"><span class="badge badge-success">${formatNum(h.change_lbs)} lbs</span></td>
      <td class="num">—</td>
      <td><div class="text-xs">${escapeHtml(h.workout || '—')}</div></td>
      <td>${escapeHtml(h.milestone || '—')}</td>
      <td><div class="cell-sub">${escapeHtml(h.mobility_win || h.medication_notes || h.notes || '—')}</div></td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="openHealthModal(${h.id})">Edit</button>
      </td>
    </tr>
  `).join('');
}

function openHealthModal(id = null) {
  const modal = document.getElementById('modal-health');
  const form = document.getElementById('form-health');
  form.reset();
  const delBtn = document.getElementById('btn-delete-health');

  if (id) {
    const item = state.healthRecords.find((h) => h.id === Number(id));
    if (item) {
      document.getElementById('hl-id').value = item.id;
      document.getElementById('hl-title').value = item.entry || '';
      document.getElementById('hl-date').value = item.entry_date || '';
      document.getElementById('hl-weight').value = item.weight ?? '';
      document.getElementById('hl-lost').value = item.change_lbs ?? '';
      document.getElementById('hl-milestone').value = item.milestone || '';
      document.getElementById('hl-notes').value = item.notes || item.mobility_win || '';
    }
    document.getElementById('modal-health-title').textContent = 'Edit Health Entry';
    delBtn.classList.remove('hidden');
  } else {
    document.getElementById('hl-id').value = '';
    document.getElementById('hl-date').value = state.today;
    document.getElementById('modal-health-title').textContent = 'Log Health Entry';
    delBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  document.getElementById('hl-title').focus();
}

// ============================================================================
// VIEW 13: IMPORT, EXPORT & BACKUPS
// ============================================================================

async function loadImportLogs() {
  try {
    state.importLogs = await api('/api/commandcenter/import/logs');
    const container = document.getElementById('import-logs-list');
    if (state.importLogs.length === 0) {
      container.innerHTML = `<div class="empty-state">No import runs logged yet.</div>`;
      return;
    }
    container.innerHTML = state.importLogs.slice(0, 6).map((l) => `
      <div class="export-row">
        <div>
          <div class="cell-primary">Run #${l.id} — ${escapeHtml(l.source)}</div>
          <div class="text-xs text-muted">
            ${escapeHtml(l.run_at)} • Found: ${l.records_found} • Inserted: ${l.inserted} • Updated: ${l.updated} • Skipped: ${l.skipped}
          </div>
        </div>
        <span class="badge ${l.failures === 0 ? 'badge-success' : 'badge-warning'}">${l.failures === 0 ? 'Success' : 'Warnings'}</span>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message);
  }
}

async function runNotionImport() {
  try {
    const res = await api('/api/commandcenter/import/run', { method: 'POST' });
    const totals = res.totals || res;
    showToast(`Sync complete: ${totals.inserted} inserted, ${totals.updated} updated, ${totals.skipped} skipped`);
    await refreshAllData();
    await loadImportLogs();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadBackupSnapshots() {
  try {
    const snaps = await api('/api/commandcenter/backup/snapshots');
    const container = document.getElementById('snapshots-list');
    if (snaps.length === 0) {
      container.innerHTML = `<div class="empty-state">No disk snapshots saved yet. Click "Save Snapshot to Disk" above.</div>`;
      return;
    }
    container.innerHTML = snaps.map((s) => `
      <div class="export-row">
        <div>
          <div class="cell-primary">${escapeHtml(s.filename)}</div>
          <div class="text-xs text-muted">${escapeHtml(s.created_at)} • ${(s.size_bytes / 1024).toFixed(1)} KB</div>
        </div>
        <button class="btn btn-secondary btn-xs" onclick="restoreFromSnapshot('${escapeHtml(s.filename)}')">Restore Snapshot</button>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message);
  }
}

async function createDiskSnapshot() {
  try {
    const snap = await api('/api/commandcenter/backup/snapshot', { method: 'POST' });
    showToast(`Saved backup snapshot: ${snap.filename}`);
    if (state.activeView === 'backups') {
      await loadBackupSnapshots();
    }
  } catch (err) {
    showToast(err.message);
  }
}

async function restoreFromSnapshot(filename) {
  try {
    const res = await api('/api/commandcenter/backup/restore', {
      method: 'POST',
      body: { snapshotFilename: filename, mode: 'replace' }
    });
    showToast(`Restored ${res.counts.sponsorships} sponsorships, ${res.counts.content_items} content items`);
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  }
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

let searchDebounce = null;
function handleGlobalSearchInput(e) {
  const q = e.target.value.trim();
  const dropdown = document.getElementById('global-search-dropdown');
  if (!q) {
    dropdown.classList.add('hidden');
    return;
  }
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    try {
      const results = await api(`/api/commandcenter/search?q=${encodeURIComponent(q)}`);
      renderGlobalSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  }, 120);
}

function renderGlobalSearchResults(results) {
  const dropdown = document.getElementById('global-search-dropdown');
  if (results.total === 0) {
    dropdown.innerHTML = `<div class="empty-state">No matches found for "${escapeHtml(results.query)}"</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = '';
  if (results.sponsorships?.length > 0) {
    html += `<div class="search-result-group-title">Sponsorships (${results.sponsorships.length})</div>`;
    html += results.sponsorships.slice(0, 5).map((s) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('sponsorships'); openSponsorshipModal(${s.id});">
        <div>
          <strong>${escapeHtml(s.brand)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(s.contact_name || s.category || '')}</span>
        </div>
        <span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span>
      </div>
    `).join('');
  }

  if (results.media_outreach?.length > 0) {
    html += `<div class="search-result-group-title">Media Outreach (${results.media_outreach.length})</div>`;
    html += results.media_outreach.slice(0, 5).map((m) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('media'); openMediaModal(${m.id});">
        <div>
          <strong>${escapeHtml(m.outlet)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(m.type || '')}</span>
        </div>
        <span class="badge ${statusBadgeClass(m.status)}">${escapeHtml(m.status)}</span>
      </div>
    `).join('');
  }

  if (results.content?.length > 0) {
    html += `<div class="search-result-group-title">Content Pipeline (${results.content.length})</div>`;
    html += results.content.slice(0, 5).map((c) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('content'); openContentModal(${c.id});">
        <div>
          <strong>${escapeHtml(c.title)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(c.platform || '')}</span>
        </div>
        <span class="badge ${statusBadgeClass(c.stage)}">${escapeHtml(c.stage)}</span>
      </div>
    `).join('');
  }

  if (results.affiliates?.length > 0) {
    html += `<div class="search-result-group-title">Affiliates (${results.affiliates.length})</div>`;
    html += results.affiliates.slice(0, 5).map((a) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('affiliates'); openAffiliateModal(${a.id});">
        <div>
          <strong>${escapeHtml(a.program)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(a.coupon_code || a.commission || '')}</span>
        </div>
        <span class="badge badge-info">Affiliate</span>
      </div>
    `).join('');
  }

  if (results.goals?.length > 0) {
    html += `<div class="search-result-group-title">90-Day Goals (${results.goals.length})</div>`;
    html += results.goals.slice(0, 4).map((g) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('goals'); openGoalModal(${g.id});">
        <div>
          <strong>${escapeHtml(g.goal)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(g.cycle)}</span>
        </div>
        <span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(g.status)}</span>
      </div>
    `).join('');
  }

  if (results.tasks?.length > 0) {
    html += `<div class="search-result-group-title">Tasks (${results.tasks.length})</div>`;
    html += results.tasks.slice(0, 4).map((t) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('tasks'); openTaskModal(${t.id});">
        <div>
          <strong>${escapeHtml(t.task_name)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(t.category)}</span>
        </div>
        <span class="badge ${statusBadgeClass(t.status)}">${escapeHtml(t.status)}</span>
      </div>
    `).join('');
  }

  if (results.projects?.length > 0) {
    html += `<div class="search-result-group-title">Business Projects (${results.projects.length})</div>`;
    html += results.projects.slice(0, 4).map((p) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('projects'); openProjectModal(${p.id});">
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(p.pricing_model || p.category)}</span>
        </div>
        <span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>
      </div>
    `).join('');
  }

  if (results.reference_documents?.length > 0) {
    html += `<div class="search-result-group-title">Reference Library (${results.reference_documents.length})</div>`;
    html += results.reference_documents.slice(0, 4).map((d) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('reference'); selectReferenceDoc(${d.id});">
        <div>
          <strong>${escapeHtml(d.title)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(d.category)}</span>
        </div>
        <span class="badge badge-muted">Doc</span>
      </div>
    `).join('');
  }

  if (results.revenue?.length > 0) {
    html += `<div class="search-result-group-title">Revenue Ledger (${results.revenue.length})</div>`;
    html += results.revenue.slice(0, 4).map((r) => `
      <div class="search-result-item" onclick="closeSearchDropdown(); switchView('revenue'); openRevenueModal(${r.id});">
        <div>
          <strong>${escapeHtml(r.source_name || r.category)}</strong>
          <span class="text-xs text-muted"> • ${escapeHtml(r.entry_date)}</span>
        </div>
        <span class="badge badge-success">${formatMoney(r.amount)}</span>
      </div>
    `).join('');
  }

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function closeSearchDropdown() {
  document.getElementById('global-search-dropdown').classList.add('hidden');
}

// ============================================================================
// EVENT LISTENERS & KEYBOARD SHORTCUTS
// ============================================================================

function bindEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Quick sidebar buttons
  document.getElementById('btn-quick-sponsorship').addEventListener('click', () => openSponsorshipModal());
  document.getElementById('btn-quick-media').addEventListener('click', () => openMediaModal());
  document.getElementById('btn-quick-content').addEventListener('click', () => openContentModal());
  document.getElementById('btn-quick-task').addEventListener('click', () => openTaskModal());
  document.getElementById('btn-quick-revenue').addEventListener('click', () => openRevenueModal());

  // Topbar buttons
  document.getElementById('btn-topbar-import-csv').addEventListener('click', () => {
    document.getElementById('modal-csv-import').classList.remove('hidden');
  });
  document.getElementById('btn-sponsorship-import-csv').addEventListener('click', () => {
    document.getElementById('modal-csv-import').classList.remove('hidden');
  });
  document.getElementById('btn-topbar-snapshot').addEventListener('click', createDiskSnapshot);
  document.getElementById('btn-create-disk-snapshot').addEventListener('click', createDiskSnapshot);
  document.getElementById('btn-run-notion-import').addEventListener('click', runNotionImport);

  // View "New" buttons
  document.getElementById('btn-new-sponsorship').addEventListener('click', () => openSponsorshipModal());
  document.getElementById('btn-new-media').addEventListener('click', () => openMediaModal());
  document.getElementById('btn-new-affiliate').addEventListener('click', () => openAffiliateModal());
  document.getElementById('btn-new-content').addEventListener('click', () => openContentModal());
  document.getElementById('btn-new-revenue').addEventListener('click', () => openRevenueModal());
  document.getElementById('btn-new-growth').addEventListener('click', () => openGrowthModal());
  document.getElementById('btn-new-goal').addEventListener('click', () => openGoalModal());
  document.getElementById('btn-new-project').addEventListener('click', () => openProjectModal());
  document.getElementById('btn-new-recipe').addEventListener('click', () => openRecipeModal());
  document.getElementById('btn-new-printing').addEventListener('click', () => openPrintingModal());
  document.getElementById('btn-new-task').addEventListener('click', () => openTaskModal());
  document.getElementById('btn-new-reference').addEventListener('click', () => openReferenceModal());
  document.getElementById('btn-new-health').addEventListener('click', () => openHealthModal());

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.close).classList.add('hidden');
    });
  });

  // Sponsorship filters
  document.querySelectorAll('#sponsorship-quick-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#sponsorship-quick-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.sponsorshipQuickFilter = pill.dataset.qf;
      loadSponsorships();
    });
  });
  ['sponsorship-search', 'sponsorship-status-filter', 'sponsorship-category-filter', 'sponsorship-sort'].forEach((id) => {
    document.getElementById(id).addEventListener('input', loadSponsorships);
    document.getElementById(id).addEventListener('change', loadSponsorships);
  });

  // Media filters
  document.querySelectorAll('#media-quick-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#media-quick-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.mediaQuickFilter = pill.dataset.mqf;
      loadMedia();
    });
  });
  ['media-search', 'media-status-filter', 'media-category-filter'].forEach((id) => {
    document.getElementById(id).addEventListener('input', loadMedia);
    document.getElementById(id).addEventListener('change', loadMedia);
  });

  // Affiliate filters
  document.querySelectorAll('#affiliate-quick-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#affiliate-quick-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.affiliateQuickFilter = pill.dataset.af;
      loadAffiliates();
    });
  });
  ['affiliate-search', 'affiliate-sort'].forEach((id) => {
    document.getElementById(id).addEventListener('input', loadAffiliates);
    document.getElementById(id).addEventListener('change', loadAffiliates);
  });

  // Content filters & view toggle
  document.querySelectorAll('#content-stage-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#content-stage-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.contentStageFilter = pill.dataset.stage;
      loadContent();
    });
  });
  ['content-search', 'content-platform-filter', 'content-format-filter'].forEach((id) => {
    document.getElementById(id).addEventListener('input', loadContent);
    document.getElementById(id).addEventListener('change', loadContent);
  });
  document.getElementById('btn-content-view-table').addEventListener('click', () => {
    state.contentViewMode = 'table';
    document.getElementById('btn-content-view-table').classList.add('active');
    document.getElementById('btn-content-view-board').classList.remove('active');
    document.getElementById('content-table-wrapper').classList.remove('hidden');
    document.getElementById('content-board-wrapper').classList.add('hidden');
  });
  document.getElementById('btn-content-view-board').addEventListener('click', () => {
    state.contentViewMode = 'board';
    document.getElementById('btn-content-view-board').classList.add('active');
    document.getElementById('btn-content-view-table').classList.remove('active');
    document.getElementById('content-board-wrapper').classList.remove('hidden');
    document.getElementById('content-table-wrapper').classList.add('hidden');
  });

  // Revenue filters
  ['revenue-search', 'revenue-category-filter', 'revenue-status-filter'].forEach((id) => {
    document.getElementById(id).addEventListener('input', loadRevenue);
    document.getElementById(id).addEventListener('change', loadRevenue);
  });

  // Goals filters
  document.querySelectorAll('#goals-cycle-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#goals-cycle-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.goalCycleFilter = pill.dataset.cycle;
      loadGoals();
    });
  });
  document.getElementById('goals-search').addEventListener('input', loadGoals);

  // Tasks filters
  document.querySelectorAll('#tasks-quick-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#tasks-quick-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.taskQuickFilter = pill.dataset.tqf;
      loadTasks();
    });
  });
  document.getElementById('tasks-search').addEventListener('input', loadTasks);

  // Reference filters
  document.querySelectorAll('#reference-category-tabs .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#reference-category-tabs .pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.referenceCategoryFilter = pill.dataset.rcat;
      loadReference();
    });
  });
  document.getElementById('reference-search').addEventListener('input', loadReference);

  // ==========================================================================
  // FORM SUBMISSIONS
  // ==========================================================================

  // 1. Sponsorship Form
  document.getElementById('form-sponsorship').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('sp-id').value;
    const payload = {
      brand: document.getElementById('sp-brand').value,
      category: document.getElementById('sp-category').value,
      status: document.getElementById('sp-status').value,
      contact_name: document.getElementById('sp-contact-name').value,
      contact_email: document.getElementById('sp-contact-email').value,
      website: document.getElementById('sp-website').value,
      date_first_contacted: document.getElementById('sp-date-first').value,
      last_contact_date: document.getElementById('sp-date-last').value,
      follow_up_date: document.getElementById('sp-date-followup').value,
      product_offered: document.getElementById('sp-product-offered').value,
      cash_offered: document.getElementById('sp-cash-offered').value,
      agreed_rate: document.getElementById('sp-agreed-rate').value,
      deliverables: document.getElementById('sp-deliverables').value,
      due_date: document.getElementById('sp-due-date').value,
      priority: document.getElementById('sp-priority').value,
      products_requested: document.getElementById('sp-deal-type').value,
      original_status: document.getElementById('sp-next-action').value,
      pitch_sent: document.getElementById('sp-pitch-sent').checked ? 1 : 0,
      content_posted: document.getElementById('sp-content-posted').checked ? 1 : 0,
      invoice_sent: document.getElementById('sp-invoice-sent').checked ? 1 : 0,
      payment_received: document.getElementById('sp-payment-received').checked ? 1 : 0,
      needs_review: document.getElementById('sp-needs-review').checked ? 1 : 0,
      response: document.getElementById('sp-response').value,
      notes: document.getElementById('sp-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/sponsorships/${id}`, { method: 'PUT', body: payload });
        showToast('Sponsorship updated');
      } else {
        await api('/api/commandcenter/sponsorships', { method: 'POST', body: payload });
        showToast('Sponsorship created');
      }
      document.getElementById('modal-sponsorship').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-sponsorship').addEventListener('click', async () => {
    const id = document.getElementById('sp-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/sponsorships/${id}`, { method: 'DELETE' });
      document.getElementById('modal-sponsorship').classList.add('hidden');
      showToast('Sponsorship deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 2. Media Form
  document.getElementById('form-media').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('md-id').value;
    const payload = {
      outlet: document.getElementById('md-name').value,
      type: document.getElementById('md-category').value,
      status: document.getElementById('md-status').value,
      contact_name: document.getElementById('md-host').value,
      contact_email: document.getElementById('md-email').value,
      priority: document.getElementById('md-priority').value,
      last_contact_date: document.getElementById('md-pitch-date').value,
      follow_up_date: document.getElementById('md-followup-date').value,
      pitch_subject: document.getElementById('md-location').value,
      website: document.getElementById('md-website').value,
      cc_alternate: document.getElementById('md-episode-link').value,
      needs_review: document.getElementById('md-needs-review').checked ? 1 : 0,
      story_angle: document.getElementById('md-story-angle').value,
      notes: document.getElementById('md-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/media/${id}`, { method: 'PUT', body: payload });
        showToast('Media outreach updated');
      } else {
        await api('/api/commandcenter/media', { method: 'POST', body: payload });
        showToast('Media outreach added');
      }
      document.getElementById('modal-media').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-media').addEventListener('click', async () => {
    const id = document.getElementById('md-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/media/${id}`, { method: 'DELETE' });
      document.getElementById('modal-media').classList.add('hidden');
      showToast('Media pitch deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 3. Affiliate Form
  document.getElementById('form-affiliate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('af-id').value;
    const payload = {
      program: document.getElementById('af-program').value,
      status: document.getElementById('af-status').value,
      commission: document.getElementById('af-commission').value,
      affiliate_url: document.getElementById('af-url').value,
      coupon_code: document.getElementById('af-code').value,
      revenue: document.getElementById('af-revenue').value,
      clicks: document.getElementById('af-clicks').value,
      conversion_info: document.getElementById('af-conversions').value,
      last_updated: document.getElementById('af-updated').value,
      products_promoted: document.getElementById('af-products').value,
      notes: document.getElementById('af-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/affiliates/${id}`, { method: 'PUT', body: payload });
        showToast('Affiliate updated');
      } else {
        await api('/api/commandcenter/affiliates', { method: 'POST', body: payload });
        showToast('Affiliate program added');
      }
      document.getElementById('modal-affiliate').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-affiliate').addEventListener('click', async () => {
    const id = document.getElementById('af-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/affiliates/${id}`, { method: 'DELETE' });
      document.getElementById('modal-affiliate').classList.add('hidden');
      showToast('Affiliate program deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 4. Content Form
  document.getElementById('form-content').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ct-id').value;
    const primaryPlatform = document.getElementById('ct-platform').value;
    const primaryFormat = document.getElementById('ct-format').value;

    const checkedExtras = Array.from(document.querySelectorAll('.ct-extra-platform:checked'))
      .map((cb) => {
        const [platform, format] = cb.value.split(':');
        return { platform, format };
      })
      .filter((p) => p.platform !== primaryPlatform);

    const payload = {
      parent_idea_id: document.getElementById('ct-parent-id').value || null,
      title: document.getElementById('ct-title').value,
      content_pillar: document.getElementById('ct-pillar').value,
      platform: primaryPlatform,
      format: primaryFormat,
      stage: document.getElementById('ct-stage').value,
      filming_status: document.getElementById('ct-filming-status').value,
      editing_status: document.getElementById('ct-editing-status').value,
      scheduled_date: document.getElementById('ct-scheduled-date').value,
      published_date: document.getElementById('ct-published-date').value,
      url: document.getElementById('ct-url').value,
      sponsor: document.getElementById('ct-sponsor').value,
      affiliate_connection: document.getElementById('ct-affiliate').value,
      views: document.getElementById('ct-performance').value,
      hook: document.getElementById('ct-hook').value,
      notes: document.getElementById('ct-notes').value
    };

    if (!id && checkedExtras.length > 0) {
      payload.platforms = [{ platform: primaryPlatform, format: primaryFormat }, ...checkedExtras];
    }

    try {
      if (id) {
        await api(`/api/commandcenter/content/${id}`, { method: 'PUT', body: payload });
        showToast('Content item updated');
      } else {
        await api('/api/commandcenter/content', { method: 'POST', body: payload });
        showToast(payload.platforms ? `Created idea across ${payload.platforms.length} platforms` : 'Content item added');
      }
      document.getElementById('modal-content').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-content').addEventListener('click', async () => {
    const id = document.getElementById('ct-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/content/${id}`, { method: 'DELETE' });
      document.getElementById('modal-content').classList.add('hidden');
      showToast('Content item deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 5. Revenue Form
  document.getElementById('form-revenue').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rv-id').value;
    const payload = {
      category: document.getElementById('rv-category').value,
      amount: document.getElementById('rv-amount').value,
      source_name: document.getElementById('rv-source').value,
      entry_date: document.getElementById('rv-date').value,
      status: document.getElementById('rv-status').value,
      notes: document.getElementById('rv-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/revenue/${id}`, { method: 'PUT', body: payload });
        showToast('Revenue entry updated');
      } else {
        await api('/api/commandcenter/revenue', { method: 'POST', body: payload });
        showToast('Revenue entry logged');
      }
      document.getElementById('modal-revenue').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-revenue').addEventListener('click', async () => {
    const id = document.getElementById('rv-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/revenue/${id}`, { method: 'DELETE' });
      document.getElementById('modal-revenue').classList.add('hidden');
      showToast('Revenue entry deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 6. Growth Form
  document.getElementById('form-growth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('gr-id').value;
    const payload = {
      label: document.getElementById('gr-label').value,
      snapshot_date: document.getElementById('gr-date').value,
      facebook: document.getElementById('gr-fb').value,
      instagram: document.getElementById('gr-ig').value,
      tiktok: document.getElementById('gr-tt').value,
      youtube: document.getElementById('gr-yt').value,
      youtube_watch_hours: document.getElementById('gr-views').value,
      threads: document.getElementById('gr-weight').value,
      revenue: document.getElementById('gr-revenue').value,
      notes: document.getElementById('gr-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/growth/${id}`, { method: 'PUT', body: payload });
        showToast('Audience snapshot updated');
      } else {
        await api('/api/commandcenter/growth', { method: 'POST', body: payload });
        showToast('Audience snapshot logged');
      }
      document.getElementById('modal-growth').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-growth').addEventListener('click', async () => {
    const id = document.getElementById('gr-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/growth/${id}`, { method: 'DELETE' });
      document.getElementById('modal-growth').classList.add('hidden');
      showToast('Audience snapshot deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 7. Goal Form
  document.getElementById('form-goal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('gl-id').value;
    const payload = {
      goal: document.getElementById('gl-title').value,
      cycle: document.getElementById('gl-cycle').value.includes('Cycle 1') ? 'Cycle 1' : 'Cycle 2',
      area: document.getElementById('gl-category').value,
      status: document.getElementById('gl-status').value === 'In Progress' ? 'On Track' : document.getElementById('gl-status').value,
      weekly_action: document.getElementById('gl-priority').value,
      deadline: document.getElementById('gl-target-date').value,
      target_value: document.getElementById('gl-target-metric').value,
      current_value: document.getElementById('gl-current-value').value,
      notes: document.getElementById('gl-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/goals/${id}`, { method: 'PUT', body: payload });
        showToast('Goal updated');
      } else {
        await api('/api/commandcenter/goals', { method: 'POST', body: payload });
        showToast('Goal added');
      }
      document.getElementById('modal-goal').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-goal').addEventListener('click', async () => {
    const id = document.getElementById('gl-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/goals/${id}`, { method: 'DELETE' });
      document.getElementById('modal-goal').classList.add('hidden');
      showToast('Goal deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 8. Task Form
  document.getElementById('form-task').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tk-id').value;
    const isCompleted = document.getElementById('tk-completed').checked || document.getElementById('tk-status').value === 'Done';
    const payload = {
      task_name: document.getElementById('tk-title').value,
      category: document.getElementById('tk-category').value,
      status: isCompleted ? 'Done' : 'Not started',
      due_date: document.getElementById('tk-due-date').value,
      is_historical: isCompleted ? 1 : 0,
      needs_review: document.getElementById('tk-needs-review').checked ? 1 : 0,
      notes: document.getElementById('tk-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/tasks/${id}`, { method: 'PUT', body: payload });
        showToast('Task updated');
      } else {
        await api('/api/commandcenter/tasks', { method: 'POST', body: payload });
        showToast('Task added');
      }
      document.getElementById('modal-task').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-task').addEventListener('click', async () => {
    const id = document.getElementById('tk-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/tasks/${id}`, { method: 'DELETE' });
      document.getElementById('modal-task').classList.add('hidden');
      showToast('Task deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 9. Business Project Form
  document.getElementById('form-project').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('pj-id').value;
    const payload = {
      name: document.getElementById('pj-name').value,
      category: document.getElementById('pj-category').value,
      status: document.getElementById('pj-status').value,
      pricing_model: document.getElementById('pj-pricing').value,
      platforms: document.getElementById('pj-platform').value,
      next_milestone: document.getElementById('pj-milestone').value,
      notes: document.getElementById('pj-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/projects/${id}`, { method: 'PUT', body: payload });
        showToast('Project updated');
      } else {
        await api('/api/commandcenter/projects', { method: 'POST', body: payload });
        showToast('Project created');
      }
      document.getElementById('modal-project').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-project').addEventListener('click', async () => {
    const id = document.getElementById('pj-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/projects/${id}`, { method: 'DELETE' });
      document.getElementById('modal-project').classList.add('hidden');
      showToast('Project deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 10. Cookbook Recipe Form
  document.getElementById('form-recipe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rc-id').value;
    const payload = {
      recipe: document.getElementById('rc-name').value,
      category: document.getElementById('rc-category').value,
      status: document.getElementById('rc-status').value,
      source_post: document.getElementById('rc-video').value,
      recipe_card_ready: document.getElementById('rc-in-cookbook').checked ? 1 : 0,
      photo_ready: document.getElementById('rc-photo-taken').checked ? 1 : 0,
      ingredients: document.getElementById('rc-ingredients').value,
      cooking_instructions: document.getElementById('rc-instructions').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/cookbook/${id}`, { method: 'PUT', body: payload });
        showToast('Recipe updated');
      } else {
        await api('/api/commandcenter/cookbook', { method: 'POST', body: payload });
        showToast('Recipe added');
      }
      document.getElementById('modal-recipe').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-recipe').addEventListener('click', async () => {
    const id = document.getElementById('rc-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/cookbook/${id}`, { method: 'DELETE' });
      document.getElementById('modal-recipe').classList.add('hidden');
      showToast('Recipe deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 11. 3D Printing Form
  document.getElementById('form-printing').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('pr-id').value;
    const payload = {
      project: document.getElementById('pr-name').value,
      category: document.getElementById('pr-category').value,
      status: document.getElementById('pr-status').value,
      material: document.getElementById('pr-material').value,
      notes: document.getElementById('pr-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/printing/${id}`, { method: 'PUT', body: payload });
        showToast('3D print project updated');
      } else {
        await api('/api/commandcenter/printing', { method: 'POST', body: payload });
        showToast('3D print project added');
      }
      document.getElementById('modal-printing').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-printing').addEventListener('click', async () => {
    const id = document.getElementById('pr-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/printing/${id}`, { method: 'DELETE' });
      document.getElementById('modal-printing').classList.add('hidden');
      showToast('3D print project deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 12. Reference Document Form
  document.getElementById('form-reference').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rf-id').value;
    const payload = {
      title: document.getElementById('rf-title').value,
      category: document.getElementById('rf-category').value,
      content: document.getElementById('rf-content').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/reference/${id}`, { method: 'PUT', body: payload });
        showToast('Reference document updated');
      } else {
        const created = await api('/api/commandcenter/reference', { method: 'POST', body: payload });
        state.activeReferenceDocId = created.id;
        showToast('Reference document created');
      }
      document.getElementById('modal-reference').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-reference').addEventListener('click', async () => {
    const id = document.getElementById('rf-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/reference/${id}`, { method: 'DELETE' });
      state.activeReferenceDocId = null;
      document.getElementById('modal-reference').classList.add('hidden');
      showToast('Reference document deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // 13. Health Form
  document.getElementById('form-health').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('hl-id').value;
    const payload = {
      entry: document.getElementById('hl-title').value,
      entry_date: document.getElementById('hl-date').value,
      weight: document.getElementById('hl-weight').value,
      change_lbs: document.getElementById('hl-lost').value,
      milestone: document.getElementById('hl-milestone').value,
      notes: document.getElementById('hl-notes').value
    };
    try {
      if (id) {
        await api(`/api/commandcenter/health/${id}`, { method: 'PUT', body: payload });
        showToast('Health entry updated');
      } else {
        await api('/api/commandcenter/health', { method: 'POST', body: payload });
        showToast('Health entry logged');
      }
      document.getElementById('modal-health').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-delete-health').addEventListener('click', async () => {
    const id = document.getElementById('hl-id').value;
    if (!id) return;
    try {
      await api(`/api/commandcenter/health/${id}`, { method: 'DELETE' });
      document.getElementById('modal-health').classList.add('hidden');
      showToast('Health entry deleted');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // CSV Import File & Preview
  document.getElementById('csv-file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('csv-paste-textarea').value = String(reader.result || '');
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-preview-csv').addEventListener('click', async () => {
    const csvText = document.getElementById('csv-paste-textarea').value;
    if (!csvText.trim()) {
      showToast('Paste CSV content or choose a file first');
      return;
    }
    try {
      const preview = await api('/api/commandcenter/sponsorships/import-csv', {
        method: 'POST',
        body: { csvText, preview: true }
      });
      const box = document.getElementById('csv-preview-box');
      box.classList.remove('hidden');
      box.innerHTML = `
        <div><strong>Detected ${preview.total_rows} row(s)</strong> • Columns: ${preview.headers.map(escapeHtml).join(', ')}</div>
        <div class="mt-4">Sample Mapped Leads:</div>
        <ul style="margin:4px 0 0 18px;padding:0;">
          ${preview.sample_mapped.map((m) =>
            `<li><strong>${escapeHtml(m.brand)}</strong> (${escapeHtml(m.status)}) — Contact: ${escapeHtml(m.contact_name || 'N/A')} — Rate: ${formatMoney(m.agreed_rate || m.cash_offered)} — Follow-up: ${escapeHtml(m.follow_up_date || 'N/A')}</li>`
          ).join('')}
        </ul>
      `;
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('btn-confirm-csv-import').addEventListener('click', async () => {
    const csvText = document.getElementById('csv-paste-textarea').value;
    if (!csvText.trim()) {
      showToast('Paste CSV content or choose a file first');
      return;
    }
    try {
      const res = await api('/api/commandcenter/sponsorships/import-csv', {
        method: 'POST',
        body: { csvText }
      });
      document.getElementById('modal-csv-import').classList.add('hidden');
      document.getElementById('csv-paste-textarea').value = '';
      document.getElementById('csv-preview-box').classList.add('hidden');
      showToast(`Imported ${res.imported_count} sponsorship(s) (${res.skipped_count} skipped)`);
      switchView('sponsorships');
      await refreshAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // JSON Backup File Restore
  document.getElementById('btn-restore-json-file').addEventListener('click', () => {
    const file = document.getElementById('restore-file-input').files?.[0];
    const mode = document.getElementById('restore-mode-select').value;
    if (!file) {
      showToast('Select a .json backup file to restore');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(String(reader.result || '{}'));
        const res = await api('/api/commandcenter/backup/restore', {
          method: 'POST',
          body: { backup, mode }
        });
        showToast(`Backup restored (${res.counts.sponsorships} sponsorships, ${res.counts.content_items} content items)`);
        await refreshAllData();
        await loadBackupSnapshots();
      } catch (err) {
        showToast(`Restore failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  });

  // Global search
  const searchInput = document.getElementById('global-search-input');
  searchInput.addEventListener('input', handleGlobalSearchInput);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search-wrapper')) {
      closeSearchDropdown();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (e.key === 'Escape') {
      closeSearchDropdown();
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
      return;
    }

    if (isTyping) return;

    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (state.activeView === 'media') openMediaModal();
      else if (state.activeView === 'affiliates') openAffiliateModal();
      else if (state.activeView === 'content') openContentModal();
      else if (state.activeView === 'revenue') openRevenueModal();
      else if (state.activeView === 'growth') openGrowthModal();
      else if (state.activeView === 'goals') openGoalModal();
      else if (state.activeView === 'projects') openProjectModal();
      else if (state.activeView === 'tasks') openTaskModal();
      else if (state.activeView === 'reference') openReferenceModal();
      else if (state.activeView === 'health') openHealthModal();
      else openSponsorshipModal();
    } else if (e.key === '1') switchView('dashboard');
    else if (e.key === '2') switchView('sponsorships');
    else if (e.key === '3') switchView('media');
    else if (e.key === '4') switchView('affiliates');
    else if (e.key === '5') switchView('revenue');
    else if (e.key === '6') switchView('content');
    else if (e.key === '7') switchView('growth');
    else if (e.key === '8') switchView('goals');
    else if (e.key === '9') switchView('projects');
  });
}

window.addEventListener('DOMContentLoaded', initApp);
