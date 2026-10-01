/**
 * Automation, Date Calculations, Status Rules, and Priority Engine
 * Less of Josh / 35/63 Media - Creator Business Operations System
 */

const SPONSORSHIP_STATUSES = [
  'Prospect',
  'Contacted',
  'Follow-up',
  'Interested',
  'Negotiating',
  'Product Only',
  'Contracted',
  'Content Due',
  'Posted',
  'Invoiced',
  'Paid',
  'Declined',
  'No Response'
];

const OUTREACH_ACTIVE_STATUSES = [
  'Prospect',
  'Contacted',
  'Follow-up',
  'Interested',
  'Negotiating'
];

const CLOSED_STATUSES = [
  'Paid',
  'Declined',
  'No Response'
];

const CONTENT_STAGES = [
  'Idea',
  'Planned',
  'Filming',
  'Editing',
  'Ready',
  'Scheduled',
  'Published'
];

const CONTENT_FORMATS = [
  'Short-form',
  'Long-form'
];

const FILMING_STATUSES = [
  'Not Started',
  'Outlined / Scripted',
  'In Progress',
  'B-Roll Needed',
  'Filmed'
];

const EDITING_STATUSES = [
  'Not Started',
  'Rough Cut',
  'In Progress',
  'Review',
  'Final / Exported'
];

const REVENUE_CATEGORIES = [
  'Sponsorships',
  'Affiliates',
  'Merch',
  'YouTube',
  'Facebook',
  'TikTok',
  'Instagram',
  'Other'
];

const DEFAULT_AFFILIATE_PROGRAMS = [
  'Amazon',
  'Goby Meds',
  'RØDE',
  'NEEWER'
];

const MEDIA_OUTREACH_STATUSES = [
  'Prospect',
  'Contacted',
  'Follow-up',
  'Interested',
  'Scheduled',
  'Published',
  'Declined',
  'No Response'
];

const MEDIA_OUTREACH_TYPES = [
  'Newspaper',
  'Local TV',
  'National Media',
  'Podcast',
  'TV / Casting',
  'Platform Spotlight',
  'Creator Collab',
  'Magazine / Digital',
  'Other'
];

const GOAL_STATUSES = [
  'On Track',
  'Behind',
  'At Risk',
  'Complete',
  'Paused'
];

const TASK_STATUSES = [
  'Not started',
  'In progress',
  'Done',
  'Archived'
];

/**
 * Returns YYYY-MM-DD in local time for a Date object (defaults to now).
 */
function getTodayISO(refDate = new Date()) {
  const d = refDate instanceof Date ? refDate : new Date(refDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string safely into a UTC-midnight Date for day math.
 */
function parseISODate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

/**
 * Adds `days` to a YYYY-MM-DD string and returns a new YYYY-MM-DD string.
 */
function addDaysISO(dateStr, days) {
  const dt = parseISODate(dateStr);
  if (!dt) return '';
  dt.setUTCDate(dt.getUTCDate() + Number(days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns integer number of days from dateA to dateB (dateB - dateA).
 */
function daysBetween(dateA, dateB) {
  const a = parseISODate(dateA);
  const b = parseISODate(dateB);
  if (!a || !b) return null;
  const diffMs = b.getTime() - a.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Automatically calculates a follow-up date when a lead is contacted/updated
 * without an explicit follow-up date.
 */
function calculateFollowUpDate(input, defaultFollowUpDays = 5) {
  const explicit = (input.follow_up_date || '').trim();
  if (explicit) return explicit;

  const status = input.status || 'Prospect';
  const baseDate = (input.last_contact_date || input.date_first_contacted || '').trim();

  if (
    baseDate &&
    ['Contacted', 'Follow-up', 'Interested', 'Negotiating'].includes(status)
  ) {
    return addDaysISO(baseDate, defaultFollowUpDays);
  }

  return '';
}

/**
 * Applies smart pipeline stage defaults to a content item when stage changes.
 */
function applyContentStageAutomation(item, previousStage = null, today = getTodayISO()) {
  const updated = { ...item };
  const stage = updated.stage || 'Idea';
  const stageChanged = previousStage && previousStage !== stage;

  if (stage === 'Filming') {
    if (!updated.filming_status || updated.filming_status === 'Not Started') {
      updated.filming_status = 'In Progress';
    }
  } else if (stage === 'Editing') {
    if (!updated.filming_status || updated.filming_status !== 'Filmed') {
      updated.filming_status = 'Filmed';
    }
    if (!updated.editing_status || updated.editing_status === 'Not Started') {
      updated.editing_status = 'In Progress';
    }
  } else if (stage === 'Ready' || stage === 'Scheduled') {
    updated.filming_status = 'Filmed';
    if (!updated.editing_status || stageChanged || updated.editing_status !== 'Final / Exported') {
      updated.editing_status = 'Final / Exported';
    }
  } else if (stage === 'Published') {
    updated.filming_status = 'Filmed';
    updated.editing_status = 'Final / Exported';
    if (!updated.published_date) {
      updated.published_date = today;
    }
  }

  return updated;
}

/**
 * Computes derived automation indicators for a Sponsorship record.
 */
function enrichSponsorship(row, today = getTodayISO()) {
  const cashOffered = row.cash_offered !== null && row.cash_offered !== '' ? Number(row.cash_offered) : 0;
  const agreedRate = row.agreed_rate !== null && row.agreed_rate !== '' ? Number(row.agreed_rate) : 0;
  const effectiveValue = agreedRate > 0 ? agreedRate : cashOffered;
  const usageRightsFee = row.usage_rights_fee !== null && row.usage_rights_fee !== undefined && row.usage_rights_fee !== ''
    ? Number(row.usage_rights_fee)
    : null;

  const pitchSent = Boolean(Number(row.pitch_sent));
  const contentPosted = Boolean(Number(row.content_posted));
  const invoiceSent = Boolean(Number(row.invoice_sent));
  const paymentReceived = Boolean(Number(row.payment_received));
  const contractSigned = Boolean(Number(row.contract_signed));
  const needsReview = Boolean(Number(row.needs_review));
  const status = row.status || 'Prospect';

  // Follow-up detection
  let needsFollowup = false;
  let followupOverdueDays = 0;
  let followupReason = '';

  const isOutreachStage = OUTREACH_ACTIVE_STATUSES.includes(status);
  const followUpDate = (row.follow_up_date || '').trim();
  const lastContact = (row.last_contact_date || row.date_first_contacted || '').trim();

  // Never pretend contact occurred on uncontacted Prospect/Researching rows flagged as stale needs_review
  const isUncontactedStaleProspect = status === 'Prospect' && !lastContact && !pitchSent && needsReview;

  if (!CLOSED_STATUSES.includes(status) && !isUncontactedStaleProspect) {
    if (followUpDate && isOutreachStage) {
      const diff = daysBetween(followUpDate, today);
      if (diff !== null && diff >= 0) {
        needsFollowup = true;
        followupOverdueDays = diff;
        followupReason = diff === 0
          ? `Follow-up due today (${followUpDate})`
          : `Follow-up overdue by ${diff}d (due ${followUpDate})`;
      }
    } else if (status === 'Follow-up') {
      needsFollowup = true;
      if (lastContact) {
        const sinceContact = daysBetween(lastContact, today) || 0;
        followupOverdueDays = Math.max(0, sinceContact);
        followupReason = `Status is Follow-up (last contact ${sinceContact}d ago)`;
      } else {
        followupReason = 'Marked as Follow-up';
      }
    } else if (isOutreachStage && status !== 'Prospect' && lastContact) {
      const sinceContact = daysBetween(lastContact, today);
      if (sinceContact !== null && sinceContact >= 5) {
        needsFollowup = true;
        followupOverdueDays = sinceContact - 5;
        followupReason = `No follow-up logged (${sinceContact}d since last contact)`;
      }
    }
  }

  // Deliverable deadline detection
  const dueDate = (row.due_date || '').trim();
  const deliverableActive = !contentPosted && !['Posted', 'Invoiced', 'Paid', 'Declined', 'No Response'].includes(status);
  let isOverdueDeliverable = false;
  let isUpcomingDeliverable = false;
  let deliverableDaysRemaining = null;

  if (dueDate && deliverableActive) {
    deliverableDaysRemaining = daysBetween(today, dueDate);
    if (deliverableDaysRemaining !== null) {
      if (deliverableDaysRemaining < 0) {
        isOverdueDeliverable = true;
      } else if (deliverableDaysRemaining <= 14) {
        isUpcomingDeliverable = true;
      }
    }
  } else if (status === 'Content Due' && deliverableActive) {
    isUpcomingDeliverable = true;
  }

  // Invoice & payment detection
  const isUnpaidInvoice = !paymentReceived &&
    status !== 'Paid' &&
    !['Declined', 'No Response'].includes(status) &&
    (invoiceSent || status === 'Invoiced');

  const isReadyToInvoice = !paymentReceived &&
    !invoiceSent &&
    status !== 'Paid' &&
    (contentPosted || status === 'Posted') &&
    effectiveValue > 0;

  const isExpectedIncome = !paymentReceived &&
    ['Contracted', 'Content Due', 'Posted', 'Invoiced'].includes(status) &&
    effectiveValue > 0;

  const isOverdueSponsorship = (needsFollowup && followupOverdueDays > 0) || isOverdueDeliverable;
  const isStaleHistorical = Boolean(needsReview && (!lastContact || lastContact < '2026-09-01'));

  return {
    ...row,
    cash_offered: cashOffered,
    agreed_rate: agreedRate,
    effective_value: effectiveValue,
    usage_rights_fee: usageRightsFee,
    pitch_sent: pitchSent ? 1 : 0,
    content_posted: contentPosted ? 1 : 0,
    invoice_sent: invoiceSent ? 1 : 0,
    payment_received: paymentReceived ? 1 : 0,
    contract_signed: contractSigned ? 1 : 0,
    needs_review: needsReview ? 1 : 0,
    is_stale_historical: isStaleHistorical,
    needs_followup: needsFollowup,
    followup_overdue_days: followupOverdueDays,
    followup_reason: followupReason,
    is_overdue_deliverable: isOverdueDeliverable,
    is_upcoming_deliverable: isUpcomingDeliverable,
    deliverable_days_remaining: deliverableDaysRemaining,
    is_unpaid_invoice: isUnpaidInvoice,
    is_ready_to_invoice: isReadyToInvoice,
    is_expected_income: isExpectedIncome,
    is_overdue_sponsorship: isOverdueSponsorship
  };
}

/**
 * Computes derived automation indicators for a Media Outreach record.
 */
function enrichMediaOutreach(row, today = getTodayISO()) {
  const status = row.status || 'Prospect';
  const followUpDate = (row.follow_up_date || '').trim();
  const lastContact = (row.last_contact_date || '').trim();
  const needsReview = Boolean(Number(row.needs_review));

  let needsFollowup = false;
  let followupOverdueDays = 0;
  let followupReason = '';

  const activeMediaStatuses = ['Contacted', 'Follow-up', 'Interested'];
  const isUncontactedStale = status === 'Prospect' && !lastContact && needsReview;

  if (activeMediaStatuses.includes(status) && !isUncontactedStale) {
    if (followUpDate) {
      const diff = daysBetween(followUpDate, today);
      if (diff !== null && diff >= 0) {
        needsFollowup = true;
        followupOverdueDays = diff;
        followupReason = diff === 0
          ? `Media follow-up due today (${followUpDate})`
          : `Media follow-up overdue by ${diff}d (due ${followUpDate})`;
      }
    } else if (status === 'Follow-up') {
      needsFollowup = true;
      if (lastContact) {
        const since = daysBetween(lastContact, today) || 0;
        followupOverdueDays = Math.max(0, since);
        followupReason = `Status is Follow-up (last contact ${since}d ago)`;
      } else {
        followupReason = 'Marked as Follow-up';
      }
    }
  }

  const isStaleHistorical = Boolean(needsReview && (!lastContact || lastContact < '2026-09-01'));

  return {
    ...row,
    needs_review: needsReview ? 1 : 0,
    is_stale_historical: isStaleHistorical,
    needs_followup: needsFollowup,
    followup_overdue_days: followupOverdueDays,
    followup_reason: followupReason
  };
}

/**
 * Builds the Weekly Priority Dashboard ("What should Josh work on next?")
 * and Weekly Operations Summary from live enriched data.
 * Prevents stale Notion follow-up dates or old historical tasks from flooding the dashboard.
 */
function buildWeeklyPriorityDashboard({
  sponsorships = [],
  mediaOutreach = [],
  contentItems = [],
  affiliates = [],
  goals = [],
  tasks = [],
  revenueSummary = null,
  growthLatest = null,
  today = getTodayISO()
}) {
  const enrichedSponsorships = sponsorships.map((s) =>
    s.needs_followup !== undefined ? s : enrichSponsorship(s, today)
  );
  const enrichedMedia = mediaOutreach.map((m) =>
    m.needs_followup !== undefined ? m : enrichMediaOutreach(m, today)
  );

  // Stale / Ambiguous Imported Records Needing Review
  const needsReviewSponsorships = enrichedSponsorships.filter((s) => s.needs_review === 1);
  const needsReviewMedia = enrichedMedia.filter((m) => m.needs_review === 1);
  const needsReviewTasks = tasks.filter((t) => Number(t.needs_review) === 1 && !Number(t.is_historical));

  // 1. Overdue & Due Today Sponsorship Follow-ups
  // Do NOT let stale historical Notion dates flood the active priority queue.
  // Surface non-stale follow-ups PLUS active Negotiating / Dream / High-value Cycle 2 follow-ups.
  const overdueFollowups = enrichedSponsorships
    .filter((s) => {
      if (!s.needs_followup) return false;
      if (!s.needs_review) return true;
      if (s.is_stale_historical) return false;
      return s.status === 'Negotiating' || (s.effective_value || 0) > 0 || s.priority === 'Dream' || s.priority === 'High';
    })
    .sort((a, b) => {
      if ((a.needs_review || 0) !== (b.needs_review || 0)) {
        return (a.needs_review || 0) - (b.needs_review || 0);
      }
      if ((b.effective_value || 0) !== (a.effective_value || 0)) {
        return (b.effective_value || 0) - (a.effective_value || 0);
      }
      return b.followup_overdue_days - a.followup_overdue_days;
    });

  // 2. Overdue Media Follow-ups (surfaced separately from sponsorship follow-ups)
  const overdueMediaFollowups = enrichedMedia
    .filter((m) => {
      if (!m.needs_followup) return false;
      if (!m.needs_review) return true;
      if (m.is_stale_historical) return false;
      return m.priority === 'High' || m.status === 'Interested';
    })
    .sort((a, b) => {
      if ((a.needs_review || 0) !== (b.needs_review || 0)) {
        return (a.needs_review || 0) - (b.needs_review || 0);
      }
      const pWeight = { High: 3, Medium: 2, Low: 1 };
      const pwDiff = (pWeight[b.priority] || 1) - (pWeight[a.priority] || 1);
      if (pwDiff !== 0) return pwDiff;
      return b.followup_overdue_days - a.followup_overdue_days;
    });

  // 3. Upcoming & Overdue Deliverables
  const upcomingDeliverables = enrichedSponsorships
    .filter((s) => s.is_overdue_deliverable || s.is_upcoming_deliverable || (s.status === 'Contracted' && !s.content_posted))
    .sort((a, b) => {
      const aDue = a.due_date || '9999-12-31';
      const bDue = b.due_date || '9999-12-31';
      return aDue.localeCompare(bDue);
    });

  // 4. Unpaid Invoices (plus Ready to Invoice)
  const unpaidInvoices = enrichedSponsorships
    .filter((s) => s.is_unpaid_invoice || s.is_ready_to_invoice)
    .sort((a, b) => (b.effective_value || 0) - (a.effective_value || 0));

  // 5. Content Ready to Edit
  const contentReadyToEdit = contentItems
    .filter((c) =>
      c.stage === 'Editing' ||
      (c.filming_status === 'Filmed' && !['Ready', 'Scheduled', 'Published'].includes(c.stage))
    )
    .sort((a, b) => {
      const aDate = a.scheduled_date || '9999-12-31';
      const bDate = b.scheduled_date || '9999-12-31';
      return aDate.localeCompare(bDate);
    });

  // 6. Content Ready to Publish
  const contentReadyToPublish = contentItems
    .filter((c) =>
      c.stage === 'Ready' ||
      c.stage === 'Scheduled' ||
      (c.editing_status === 'Final / Exported' && c.stage !== 'Published')
    )
    .sort((a, b) => {
      const aDate = a.scheduled_date || '9999-12-31';
      const bDate = b.scheduled_date || '9999-12-31';
      return aDate.localeCompare(bDate);
    });

  // 7. High-Value Open Opportunities
  const highValueOpportunities = enrichedSponsorships
    .filter((s) =>
      !CLOSED_STATUSES.includes(s.status) &&
      (s.effective_value > 0 || ['Interested', 'Negotiating', 'Contracted', 'Content Due'].includes(s.status) || s.priority === 'Dream')
    )
    .sort((a, b) => (b.effective_value || 0) - (a.effective_value || 0));

  // 8. Current Cycle 2 Goals That Need Action (never mix in historical Cycle 1 goals)
  const cycle2GoalsNeedingAction = goals
    .filter((g) => !Number(g.is_historical) && g.cycle === 'Cycle 2' && g.status !== 'Complete')
    .sort((a, b) => {
      const order = { 'At Risk': 1, 'Behind': 2, 'On Track': 3 };
      return (order[a.status] || 4) - (order[b.status] || 4);
    });

  // 9. Active Weekly Execution Tasks (exclude Done/Archived historical tasks and old Cycle 1 July tasks)
  const activeWeeklyTasks = tasks
    .filter((t) => {
      if (Number(t.is_historical)) return false;
      if (['Done', 'Archived'].includes(t.status)) return false;
      if (t.due_date && t.due_date < '2026-09-01') return false;
      return true;
    })
    .sort((a, b) => {
      if (a.status === 'In progress' && b.status !== 'In progress') return -1;
      if (b.status === 'In progress' && a.status !== 'In progress') return 1;
      const ad = a.due_date || '9999-12-31';
      const bd = b.due_date || '9999-12-31';
      return ad.localeCompare(bd);
    });

  // 10. Combined Upcoming Deadlines List (next 14 days + non-stale overdue items)
  const horizonDate = addDaysISO(today, 14);
  const upcomingDeadlines = [];

  for (const s of enrichedSponsorships) {
    if (s.due_date && !s.content_posted && !CLOSED_STATUSES.includes(s.status) && s.due_date <= horizonDate) {
      const days = daysBetween(today, s.due_date);
      upcomingDeadlines.push({
        type: 'deliverable',
        date: s.due_date,
        days_from_today: days,
        is_overdue: days < 0,
        title: `${s.brand} — Deliverable Due`,
        subtitle: s.deliverables || s.status,
        value: s.effective_value,
        entity_type: 'sponsorship',
        entity_id: s.id
      });
    }
    if (s.follow_up_date && s.needs_followup && !s.needs_review && s.follow_up_date <= horizonDate) {
      const days = daysBetween(today, s.follow_up_date);
      upcomingDeadlines.push({
        type: 'followup',
        date: s.follow_up_date,
        days_from_today: days,
        is_overdue: days < 0,
        title: `${s.brand} — Sponsorship Follow-up`,
        subtitle: s.contact_name ? `${s.contact_name} (${s.status})` : s.status,
        value: s.effective_value,
        entity_type: 'sponsorship',
        entity_id: s.id
      });
    }
  }

  for (const m of enrichedMedia) {
    if (m.follow_up_date && m.needs_followup && !m.needs_review && m.follow_up_date <= horizonDate) {
      const days = daysBetween(today, m.follow_up_date);
      upcomingDeadlines.push({
        type: 'media_followup',
        date: m.follow_up_date,
        days_from_today: days,
        is_overdue: days < 0,
        title: `${m.outlet} — Media Follow-up`,
        subtitle: m.type ? `${m.type} (${m.status})` : m.status,
        value: null,
        entity_type: 'media',
        entity_id: m.id
      });
    }
  }

  for (const c of contentItems) {
    if (c.scheduled_date && c.stage !== 'Published' && c.scheduled_date <= horizonDate) {
      const days = daysBetween(today, c.scheduled_date);
      upcomingDeadlines.push({
        type: 'content',
        date: c.scheduled_date,
        days_from_today: days,
        is_overdue: days < 0,
        title: `${c.title} (${c.platform || 'Content'})`,
        subtitle: `Stage: ${c.stage}${c.sponsor ? ` • Sponsor: ${c.sponsor}` : ''}`,
        value: null,
        entity_type: 'content',
        entity_id: c.id
      });
    }
  }

  upcomingDeadlines.sort((a, b) => a.date.localeCompare(b.date));

  // 11. Weekly Operations Summary
  const weekEnd = addDaysISO(today, 7);
  const deliverablesThisWeek = upcomingDeliverables.filter(
    (s) => s.due_date && s.due_date <= weekEnd
  );
  const contentScheduledThisWeek = contentItems.filter(
    (c) => c.scheduled_date && c.scheduled_date >= today && c.scheduled_date <= weekEnd && c.stage !== 'Published'
  );
  const openPipelineValue = highValueOpportunities.reduce((acc, s) => acc + (s.effective_value || 0), 0);
  const unpaidInvoiceTotal = unpaidInvoices
    .filter((s) => s.is_unpaid_invoice)
    .reduce((acc, s) => acc + (s.effective_value || 0), 0);
  const readyToInvoiceTotal = unpaidInvoices
    .filter((s) => s.is_ready_to_invoice)
    .reduce((acc, s) => acc + (s.effective_value || 0), 0);

  return {
    today,
    overdue_followups: overdueFollowups,
    overdue_media_followups: overdueMediaFollowups,
    upcoming_deliverables: upcomingDeliverables,
    unpaid_invoices: unpaidInvoices,
    content_ready_to_edit: contentReadyToEdit,
    content_ready_to_publish: contentReadyToPublish,
    upcoming_deadlines: upcomingDeadlines,
    high_value_opportunities: highValueOpportunities,
    cycle2_goals: cycle2GoalsNeedingAction,
    weekly_tasks: activeWeeklyTasks,
    needs_review: {
      total_count: needsReviewSponsorships.length + needsReviewMedia.length + needsReviewTasks.length,
      sponsorships: needsReviewSponsorships,
      media_outreach: needsReviewMedia,
      tasks: needsReviewTasks
    },
    growth_latest: growthLatest,
    weekly_summary: {
      followups_needed_count: overdueFollowups.length,
      media_followups_needed_count: overdueMediaFollowups.length,
      needs_review_count: needsReviewSponsorships.length + needsReviewMedia.length + needsReviewTasks.length,
      overdue_deliverables_count: upcomingDeliverables.filter((s) => s.is_overdue_deliverable).length,
      deliverables_this_week_count: deliverablesThisWeek.length,
      unpaid_invoices_count: unpaidInvoices.filter((s) => s.is_unpaid_invoice).length,
      unpaid_invoices_total: unpaidInvoiceTotal,
      ready_to_invoice_count: unpaidInvoices.filter((s) => s.is_ready_to_invoice).length,
      ready_to_invoice_total: readyToInvoiceTotal,
      content_to_edit_count: contentReadyToEdit.length,
      content_to_publish_count: contentReadyToPublish.length,
      content_scheduled_this_week_count: contentScheduledThisWeek.length,
      active_tasks_count: activeWeeklyTasks.length,
      cycle2_goals_count: cycle2GoalsNeedingAction.length,
      open_pipeline_value: openPipelineValue,
      current_month_revenue: revenueSummary ? revenueSummary.current_month : 0,
      expected_sponsorship_income: revenueSummary ? revenueSummary.expected_sponsorship_income : 0,
      combined_audience: growthLatest ? growthLatest.combined_audience : 0
    }
  };
}

export {
  SPONSORSHIP_STATUSES,
  OUTREACH_ACTIVE_STATUSES,
  CLOSED_STATUSES,
  CONTENT_STAGES,
  CONTENT_FORMATS,
  FILMING_STATUSES,
  EDITING_STATUSES,
  REVENUE_CATEGORIES,
  DEFAULT_AFFILIATE_PROGRAMS,
  MEDIA_OUTREACH_STATUSES,
  MEDIA_OUTREACH_TYPES,
  GOAL_STATUSES,
  TASK_STATUSES,
  getTodayISO,
  parseISODate,
  addDaysISO,
  daysBetween,
  calculateFollowUpDate,
  applyContentStageAutomation,
  enrichSponsorship,
  enrichMediaOutreach,
  buildWeeklyPriorityDashboard
};
