/**
 * Staff Dashboard Handler
 *
 * Drives the staff dashboard from Supabase Realtime subscriptions so every
 * metric card and list updates without a page refresh. Maps directly to the
 * canonical schema:
 *
 *   donors            → Active donors metric
 *   donations         → Pending screening metric, Screening queue list
 *   inventory         → Inventory (mL) metric, Recent batches list,
 *                       Inventory by program card, Expiry banner
 *
 * All subscriptions are registered after the first paint of the page, so the
 * dashboard hydrates with real data on load and then stays in sync forever
 * after.
 */

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initStaffDashboard();
});

/**
 * Initialize staff dashboard: auth, role-based UI, then start the live
 * data pipeline. All metric/list values come from real-time subscriptions
 * — no separate one-shot fetches.
 */
async function initStaffDashboard() {
  // Require staff authentication
  const user = await requireAuth('login.html');
  if (!user) return;

  // Get user profile
  const profile = await window.supabase.getUserProfile();
  if (!profile || (profile.user_type !== 'staff' && profile.user_type !== 'admin')) {
    window.location.href = 'index.html';
    return;
  }

  // Update navigation visibility
  updateNavVisibility(profile.user_type);

  // Update greeting
  const greeting = document.querySelector('.orange-highlight');
  if (greeting) {
    greeting.textContent = profile.full_name || (profile.user_type === 'admin' ? 'Administrator' : 'Staff Member');
  }

  // Role-based UI tweaks
  if (profile.user_type === 'admin') {
    const smallTitle = document.querySelector('.site-header small');
    if (smallTitle) smallTitle.textContent = 'Admin Dashboard';
    const eyebrow = document.querySelector('.dashboard-main .eyebrow');
    if (eyebrow) eyebrow.textContent = 'Admin Overview';
  } else {
    const adminSections = document.querySelectorAll('[data-role="admin"]');
    adminSections.forEach(el => el.style.display = 'none');
  }

  // Boot the live data pipeline. The single initial paint of every metric
  // and list happens here; subsequent updates flow in via Realtime.
  await bootRealtimeDashboard();
  setupNavigation();
}

// ============================================================
// Live data pipeline
// ============================================================
// Realtime channels:
//   • donors      — Active donors count (in-memory delta cache)
//   • donations   — Pending screening count, Screening queue list
//   • inventory   — Inventory (mL) total, Recent batches list,
//                   Inventory by program card, Expiry banner
// ============================================================

let realtimeClient = null; // shared supabaseClient reference (set on boot)

async function bootRealtimeDashboard() {
  if (typeof supabaseClient === 'undefined') {
    console.error('staff-dashboard.js: supabaseClient is not available; dashboard will not load.');
    return;
  }
  realtimeClient = supabaseClient;

  // First paint: load everything once concurrently, then start the subscriptions.
  await Promise.all([
    refreshActiveDonorsMetric(),
    refreshPendingScreeningMetric(),
    refreshInventoryMetricsAndLists(),
    refreshScreeningQueue(),
  ]);

  // Subscribe AFTER first paint so the UI never shows an empty state for long.
  subscribeActiveDonors();
  subscribePendingScreenings();
  subscribeInventory();
  subscribeScreeningQueue();
}

// ============================================================
// Active donors metric — in-memory delta cache
// ============================================================
// Schema: donors(id, user_id, bloodtype, last_donation_date,
//                donation_count, status, created_at)
// Filter: status = 'active'

let activeDonorsCount = 0;
let activeDonorsSubscriptionReady = false;

function applyActiveDonorsDelta(delta) {
  activeDonorsCount = Math.max(0, activeDonorsCount + delta);
  renderActiveDonorsMetric();
}

function renderActiveDonorsMetric() {
  const card = document.getElementById('metric-active-donors')
            || document.querySelector('.metric-card[data-metric="active-donors"]');
  if (!card) return;
  const strongEl = card.querySelector('strong');
  const pEl = card.querySelector('p');
  if (!strongEl || !pEl) return;
  strongEl.textContent = activeDonorsCount;
  pEl.textContent =
    activeDonorsCount === 1 ? '1 active donor' : `${activeDonorsCount} active donors`;
}

async function refreshActiveDonorsMetric() {
  if (!realtimeClient) return;

  const { count, error } = await realtimeClient
    .from('donors')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) {
    console.error('[active-donors] refresh failed:', error);
    return;
  }

  activeDonorsCount = count ?? 0;
  activeDonorsSubscriptionReady = true;
  renderActiveDonorsMetric();
}

function subscribeActiveDonors() {
  if (!realtimeClient) return;

  realtimeClient
    .channel('staff-dashboard-donors')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'donors' },
      (payload) => {
        if (!activeDonorsSubscriptionReady) return;
        const eventType = payload.eventType;
        if (eventType === 'INSERT') {
          if ((payload.new?.status || '').toLowerCase() === 'active') applyActiveDonorsDelta(+1);
        } else if (eventType === 'DELETE') {
          if ((payload.old?.status || '').toLowerCase() === 'active') applyActiveDonorsDelta(-1);
        } else if (eventType === 'UPDATE') {
          const wasActive = (payload.old?.status || '').toLowerCase() === 'active';
          const isActive  = (payload.new?.status || '').toLowerCase() === 'active';
          if (wasActive && !isActive) applyActiveDonorsDelta(-1);
          else if (!wasActive && isActive) applyActiveDonorsDelta(+1);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('staff-dashboard.js: staff-dashboard-donors channel error');
      } else if (status === 'SUBSCRIBED') {
        console.log('staff-dashboard.js: subscribed to donors');
      }
    });
}

// ============================================================
// Pending screening metric — in-memory delta cache
// ============================================================
// Schema: donations(id, donor_id, donation_date, amount_mi, status,
//                   notes, created_at, updated_at, program_id)
// Filter: status = 'pending' (or 'pending_screening')

let pendingScreeningCount = 0;
let pendingScreeningSubscriptionReady = false;

const PENDING_SCREENING_STATUSES = new Set(['pending', 'pending_screening']);

function isPendingScreeningStatus(status) {
  return PENDING_SCREENING_STATUSES.has(String(status || '').toLowerCase());
}

function applyPendingScreeningDelta(delta) {
  pendingScreeningCount = Math.max(0, pendingScreeningCount + delta);
  renderPendingScreeningMetric();
}

function renderPendingScreeningMetric() {
  const card = document.getElementById('metric-pending-screening')
            || document.querySelector('.metric-card[data-metric="pending-screening"]');
  if (!card) return;
  const strongEl = card.querySelector('strong');
  const pEl = card.querySelector('p');
  if (!strongEl || !pEl) return;
  strongEl.textContent = pendingScreeningCount;
  pEl.textContent =
    pendingScreeningCount === 1 ? 'Donation awaiting results' : 'Donations awaiting results';
}

async function refreshPendingScreeningMetric() {
  if (!realtimeClient) return;

  const { count, error } = await realtimeClient
    .from('donations')
    .select('id', { count: 'exact', head: true })
    .in('status', Array.from(PENDING_SCREENING_STATUSES));

  if (error) {
    console.error('[pending-screening] refresh failed:', error);
    return;
  }

  pendingScreeningCount = count ?? 0;
  pendingScreeningSubscriptionReady = true;
  renderPendingScreeningMetric();
}

function subscribePendingScreenings() {
  if (!realtimeClient) return;

  realtimeClient
    .channel('staff-dashboard-pending-screening')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'donations' },
      (payload) => {
        if (!pendingScreeningSubscriptionReady) return;
        const eventType = payload.eventType;
        if (eventType === 'INSERT') {
          if (isPendingScreeningStatus(payload.new?.status)) applyPendingScreeningDelta(+1);
        } else if (eventType === 'DELETE') {
          if (isPendingScreeningStatus(payload.old?.status)) applyPendingScreeningDelta(-1);
        } else if (eventType === 'UPDATE') {
          const wasPending = isPendingScreeningStatus(payload.old?.status);
          const isPending  = isPendingScreeningStatus(payload.new?.status);
          if (wasPending && !isPending) applyPendingScreeningDelta(-1);
          else if (!wasPending && isPending) applyPendingScreeningDelta(+1);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('staff-dashboard.js: staff-dashboard-pending-screening channel error');
      } else if (status === 'SUBSCRIBED') {
        console.log('staff-dashboard.js: subscribed to donations (pending screening)');
      }
    });
}

// ============================================================
// Inventory metric + recent batches + by-program + expiry banner
// ============================================================
// Schema: inventory(id, batch_number, donor_id, program,
//                   volume_available, expiry_date, status,
//                   created_at, updated_at)
// Inventory (mL) filter: status = 'available' (active stock)
// Recent batches: top 5 by created_at
// By program: top 3 by sum of volume_available
// Expiry banner: expiry_date within next 72h
//
// Cached in-memory; on any inventory change we re-fetch and re-render.
// (Delta-based updates are not worth the complexity here — the dataset is
// small and a single fetch is simpler and self-healing.)

let inventoryRowsCache = [];
let inventorySubscriptionReady = false;

async function refreshInventoryMetricsAndLists() {
  if (!realtimeClient) return;

  const { data, error } = await realtimeClient
    .from('inventory')
    .select('id, batch_number, donor_id, program, volume_available, expiry_date, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500); // plenty for the dashboard aggregations

  if (error) {
    console.error('[inventory] refresh failed:', error);
    return;
  }

  inventoryRowsCache = data || [];
  inventorySubscriptionReady = true;
  renderAllInventoryViews();
}

function renderAllInventoryViews() {
  const rows = inventoryRowsCache;

  // "Active stock" = anything that has been screened, pasteurized, or
  // explicitly marked available. Rows in earlier pipeline states
  // (collected, received) and terminal states (discarded, expired) are
  // excluded. Add more statuses to this set as the data model grows.
  const ACTIVE_STOCK_STATUSES = new Set(['screened', 'pasteurized', 'available']);

  const activeRows = rows.filter((r) => ACTIVE_STOCK_STATUSES.has(String(r.status || '').toLowerCase()));
  const totalMl = activeRows.reduce((sum, r) => sum + Number(r.volume_available || 0), 0);
  const totalBatches = activeRows.length;
  const inventoryCard = document.getElementById('metric-inventory-ml')
                     || document.querySelector('.metric-card[data-metric="inventory-ml"]');
  if (inventoryCard) {
    const strongEl = inventoryCard.querySelector('strong');
    const pEl = inventoryCard.querySelector('p');
    if (strongEl) strongEl.textContent = totalMl.toLocaleString();
    if (pEl) pEl.textContent = `Across ${totalBatches} batch${totalBatches === 1 ? '' : 'es'}`;
  }

  // ----- Recent batches list (top 5 by created_at) — show all rows so
  // staff can see the full pipeline, not just active stock. -----
  renderRecentBatches(rows.slice(0, 5));

  // ----- Inventory by program — only sum active stock per program. -----
  renderInventoryByProgram(activeRows);

  // ----- Expiry banner (72h) — across all rows. -----
  renderExpiryBanner(rows);
}

function subscribeInventory() {
  if (!realtimeClient) return;

  realtimeClient
    .channel('staff-dashboard-inventory')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory' },
      (payload) => {
        if (!inventorySubscriptionReady) return;
        // Self-healing approach: re-fetch on any change. The dataset is
        // small, and a refetch avoids the bookkeeping required to apply
        // every event to the in-memory aggregation correctly.
        refreshInventoryMetricsAndLists();
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('staff-dashboard.js: staff-dashboard-inventory channel error');
      } else if (status === 'SUBSCRIBED') {
        console.log('staff-dashboard.js: subscribed to inventory');
      }
    });
}

// ============================================================
// Screening queue list — donations.status = 'pending'
// ============================================================
// Schema path for donor name:
//   donations.donor_id → donors.id → donors.user_id → profiles.id → profiles.full_name
// We maintain a small in-memory cache of donor_id → full_name so each new
// donation only triggers a single lookup.

let screeningQueueRows = [];                 // donations rows where status = 'pending'
let screeningQueueSubscriptionReady = false;
const donorNameCache = new Map();            // donor_id (donors.id) → full_name

function renderScreeningQueue() {
  const list = document.getElementById('screening-queue-list');
  const pill = document.getElementById('screening-queue-count');
  if (pill) {
    pill.textContent = `${screeningQueueRows.length} awaiting review`;
  }
  if (!list) return;

  if (!screeningQueueRows.length) {
    list.innerHTML = `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">Queue is clear</div>
          <div class="batch-name">No donations pending screening right now.</div>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = screeningQueueRows.map((r) => {
    const status = String(r.status || 'pending').toLowerCase();
    const statusLabel = humanizeStatus(r.status || 'pending');
    const amount = Number(r.amount_mi || 0);
    const donorName = donorNameCache.get(r.donor_id) || `Donor #${shortenId(r.donor_id)}`;
    const submitted = formatDate(r.donation_date || r.created_at);

    return `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">Donation ${shortenId(r.id)}</div>
          <div class="batch-name">${escapeHtml(donorName)} · ${amount.toLocaleString()} mL · ${submitted}</div>
        </div>
        <span class="status-pill is-${status}">${statusLabel}</span>
      </div>
    `;
  }).join('');
}

async function refreshScreeningQueue() {
  if (!realtimeClient) return;

  const { data, error } = await realtimeClient
    .from('donations')
    .select('id, donor_id, donation_date, amount_mi, status, notes, created_at, updated_at, program_id')
    .in('status', Array.from(PENDING_SCREENING_STATUSES))
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[screening-queue] refresh failed:', error);
    return;
  }

  screeningQueueRows = data || [];
  screeningQueueSubscriptionReady = true;

  // Resolve donor names for any donor_id we haven't seen yet. One query
  // per batch of unseen ids keeps the per-event cost minimal.
  const unseen = [...new Set(screeningQueueRows.map((r) => r.donor_id).filter((id) => id && !donorNameCache.has(id)))];
  if (unseen.length) {
    await resolveDonorNames(unseen);
  }

  renderScreeningQueue();
}

/**
 * Look up full names for an array of donors.id values by walking
 * donations.donor_id → donors.id → donors.user_id → profiles.id.
 * Caches results in `donorNameCache` keyed by donors.id.
 */
async function resolveDonorNames(donorIds) {
  if (!realtimeClient || !donorIds.length) return;

  // Step 1: donors.id → donors.user_id
  const { data: donorRows, error: donorErr } = await realtimeClient
    .from('donors')
    .select('id, user_id')
    .in('id', donorIds);

  if (donorErr) {
    console.warn('[screening-queue] donor lookup failed:', donorErr);
    return;
  }

  const userIds = [...new Set((donorRows || []).map((d) => d.user_id).filter(Boolean))];
  if (!userIds.length) return;

  // Step 2: profiles.id → profiles.full_name
  const { data: profileRows, error: profileErr } = await realtimeClient
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (profileErr) {
    console.warn('[screening-queue] profile lookup failed:', profileErr);
    return;
  }

  const userIdToName = new Map();
  (profileRows || []).forEach((p) => userIdToName.set(p.id, p.full_name || `User ${shortenId(p.id)}`));

  (donorRows || []).forEach((d) => {
    donorNameCache.set(d.id, userIdToName.get(d.user_id) || `Donor #${shortenId(d.id)}`);
  });
}

function subscribeScreeningQueue() {
  if (!realtimeClient) return;

  realtimeClient
    .channel('staff-dashboard-screening-queue')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'donations' },
      async (payload) => {
        if (!screeningQueueSubscriptionReady) return;
        const eventType = payload.eventType;
        const wasPending = isPendingScreeningStatus(payload.old?.status);
        const isPending  = isPendingScreeningStatus(payload.new?.status);

        if (eventType === 'INSERT' && isPending) {
          screeningQueueRows.unshift(payload.new);
          if (payload.new.donor_id && !donorNameCache.has(payload.new.donor_id)) {
            await resolveDonorNames([payload.new.donor_id]);
          }
          renderScreeningQueue();
        } else if (eventType === 'DELETE' && wasPending) {
          const id = payload.old?.id;
          screeningQueueRows = screeningQueueRows.filter((r) => r.id !== id);
          renderScreeningQueue();
        } else if (eventType === 'UPDATE') {
          const id = payload.new?.id ?? payload.old?.id;
          const idx = screeningQueueRows.findIndex((r) => r.id === id);
          if (idx >= 0 && !isPending) {
            // No longer pending → drop from the queue.
            screeningQueueRows.splice(idx, 1);
            renderScreeningQueue();
          } else if (idx === -1 && isPending) {
            // Became pending → add to the top.
            screeningQueueRows.unshift(payload.new);
            if (payload.new.donor_id && !donorNameCache.has(payload.new.donor_id)) {
              await resolveDonorNames([payload.new.donor_id]);
            }
            renderScreeningQueue();
          } else if (idx >= 0 && isPending) {
            // Still pending, but other fields may have changed.
            screeningQueueRows[idx] = payload.new;
            renderScreeningQueue();
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('staff-dashboard.js: staff-dashboard-screening-queue channel error');
      } else if (status === 'SUBSCRIBED') {
        console.log('staff-dashboard.js: subscribed to donations (screening queue)');
      }
    });
}

// ============================================================
// Renderers (inventory lists + banner)
// ============================================================

/**
 * Render the "Recent batches" list into #recent-batches-list.
 * Mirrors the static markup structure so existing styles still apply.
 */
function renderRecentBatches(rows) {
  const list = document.getElementById('recent-batches-list');
  if (!list) return;

  if (!rows.length) {
    list.innerHTML = `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">No batches yet</div>
          <div class="batch-name">New inventory will appear here in real time.</div>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map((r, idx) => {
    const status = String(r.status || 'collected').toLowerCase();
    const statusLabel = r.status || 'Collected';
    const volume = Number(r.volume_available || 0);
    const batchId = shortBatchId(r, idx);

    return `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">${batchId}</div>
          <div class="batch-name">${formatProgram(r.program)}</div>
        </div>
        <div class="batch-volume">${volume.toLocaleString()} mL</div>
        <span class="status-pill is-${status}">${statusLabel}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render the expiry banner: count of rows whose expiry_date is within
 * the next 72 hours from now.
 */
function renderExpiryBanner(rows) {
  const banner = document.getElementById('expiry-banner');
  if (!banner) return;

  const now = Date.now();
  const cutoff = now + 72 * 60 * 60 * 1000;
  const expiring = rows.filter((r) => {
    if (!r.expiry_date) return false;
    const t = new Date(r.expiry_date).getTime();
    return t >= now && t <= cutoff;
  });

  const n = expiring.length;
  if (n === 0) {
    banner.textContent = 'No batches expiring in the next 72 hours.';
  } else if (n === 1) {
    banner.textContent = '1 batch is nearing expiry in the next 72 hours. Check inventory.';
  } else {
    banner.textContent = `${n} batches are nearing expiry in the next 72 hours. Check inventory.`;
  }
}

/**
 * Render the "Inventory by program" card. Groups all inventory rows by
 * `program`, sums volume_available per program, sorts descending, and
 * renders the top 3 program rows. The card header is preserved.
 */
function renderInventoryByProgram(rows) {
  const panel = document.querySelector('.inventory-panel');
  if (!panel) return;

  // Group and sum by program name.
  const totals = new Map();
  rows.forEach((r) => {
    const name = r.program || 'Unassigned';
    totals.set(name, (totals.get(name) || 0) + Number(r.volume_available || 0));
  });

  // Top 3 by volume.
  const programs = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Preserve the card head (h2 + "Open inventory" link).
  const head = panel.querySelector('.dashboard-card-head');
  panel.innerHTML = '';
  if (head) panel.appendChild(head);

  if (programs.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'padding: 1rem; color: var(--muted);';
    empty.textContent = 'No inventory data yet. Add inventory rows with a program to see live totals.';
    panel.appendChild(empty);
    return;
  }

  const fillColors = ['orange', 'teal', 'gold'];
  const maxVolume = Math.max(...programs.map((p) => p[1]), 1);

  const html = programs.map((p, i) => {
    const [name, volume] = p;
    const widthPct = Math.min((volume / maxVolume) * 100, 100);
    const color = fillColors[i % fillColors.length];
    return `
      <div class="program-row" data-program-volume="${volume}">
        <div class="batch-id">${escapeHtml(name)}</div>
        <div class="program-track"><div class="program-fill ${color}" style="width: ${widthPct}%;" aria-hidden="true"></div></div>
        <div class="program-value">${volume.toLocaleString()} mL</div>
      </div>
    `;
  }).join('');

  panel.insertAdjacentHTML('beforeend', html);
}

// ============================================================
// Formatting helpers
// ============================================================

/**
 * Tiny HTML escaper for user-controlled strings rendered into innerHTML.
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a batch id for display. inventory.batch_number is a uuid; show
 * the last 8 chars with a leading ellipsis when truncated.
 */
function shortBatchId(row, idx) {
  const raw = row.batch_number || row.id;
  if (!raw) return `B${String(1000 + idx).slice(-3)}`;
  const s = String(raw);
  return s.length > 8 ? `…${s.slice(-8)}` : s;
}

/** Last 8 chars of a uuid-style id, with a leading ellipsis when truncated. */
function shortenId(id) {
  if (!id) return '00000000';
  const s = String(id);
  return s.length > 8 ? s.slice(-8) : s;
}

/**
 * Display a program name with sensible fallbacks.
 */
function formatProgram(program) {
  return program || 'General program';
}

/**
 * Map a free-form status string to the friendly label used on the
 * screening queue rows.
 */
function humanizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'pending' || s === 'pending_screening') return 'Pending';
  if (s === 'pasteurising' || s === 'pasteurizing') return 'Pasteurizing';
  if (s === 'pasteurized') return 'Pasteurized';
  if (s === 'screened') return 'Screened';
  if (s === 'collected') return 'Collected';
  if (s === 'available') return 'Available';
  if (!s) return 'Pending';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format a timestamp as YYYY-MM-DD HH:MM (local). Falls back to '—' on null. */
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
// Sidebar navigation + auth helpers
// ============================================================

/**
 * Setup sidebar navigation (smooth scroll to anchor targets).
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav a');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      e.preventDefault();
      const targetId = href.slice(1);
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        navLinks.forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Helper function to require authentication.
 */
function requireAuth(redirectUrl = 'login.html') {
  const user = window.supabase.getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}
