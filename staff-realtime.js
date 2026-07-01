/**
 * Staff Dashboard Real-Time Subscriptions
 *
 * Adds Supabase Realtime listeners for the "Inventory visibility and donor
 * activity at a glance" section of the staff dashboard. Both cards read
 * from the same `inventory` table that the inventory.html and products.html
 * timelines read from, so the entire app sees a single source of truth.
 *
 *   1. Recent batches card (id="donors")  — listens to the `inventory`
 *      table; renders the 5 most recent rows as donor/batch activity.
 *   2. Inventory by program card (id="inventory") — listens to the
 *      `inventory` table and aggregates volumes by `program`.
 *
 * Both subscribers use the same postgres_changes pattern that
 * inventory.js and products-timeline.js use elsewhere in the app.
 *
 * Existing static markup in staff.html is preserved (so the page still looks
 * correct on first paint with no JS). On any DB change we re-render the
 * affected card in place.
 */

if (typeof supabaseClient === 'undefined') {
  console.warn('staff-realtime.js: supabaseClient is not available; live updates disabled.');
} else {
  document.addEventListener('DOMContentLoaded', () => {
    // Initial render of both cards from the database, so the live
    // numbers replace the static placeholders as soon as the page loads.
    refreshRecentBatches();
    refreshInventoryByProgram();

    // Single shared subscription on the `inventory` table that drives
    // BOTH cards. This keeps the dashboard in sync with the inventory
    // and products timelines, which read from the same table.
    supabaseClient
      .channel('staff-inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          refreshRecentBatches();
          refreshInventoryByProgram();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('staff-realtime.js: staff-inventory-changes channel error');
        }
      });
  });
}

/**
 * Re-render the "Recent batches" card with the 5 most recent inventory rows.
 * Falls back to the static markup if the table can't be read.
 */
async function refreshRecentBatches() {
  const list = document.querySelector('#donors .batch-list');
  if (!list) return;

  const { data, error } = await supabaseClient
    .from('inventory')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('staff-realtime.js: failed to load inventory:', error);
    return; // Keep existing static content.
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">No batches yet</div>
          <div class="batch-name">New donations will appear here in real time.</div>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = data.map((row, index) => {
    const status = String(row.status || 'collected').toLowerCase();
    const statusLabel = row.status || 'Collected';
    const volume = Number(row.volume_ml ?? row.quantity_in_stock ?? 0);
    const donor = row.donor_name || row.name || `Donor ${index + 1}`;
    const batchId = row.batch_id || row.sku || `B2025-${String(48 + index).slice(-3)}`;

    return `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">${batchId}</div>
          <div class="batch-name">${donor}</div>
        </div>
        <div class="batch-volume">${volume} mL</div>
        <span class="status-pill is-${status}">${statusLabel}</span>
      </div>
    `;
  }).join('');
}

/**
 * Re-render the "Inventory by program" card.
 * Reads the top 3 rows from the `inventory` table sorted by volume. If
 * the table is empty, renders an empty-state message. (No `batches`
 * fallback — by design, the staff dashboard is wired to the same
 * `inventory` table as the rest of the app.)
 */
async function refreshInventoryByProgram() {
  const panel = document.querySelector('.inventory-panel');
  if (!panel) return;

  const { data, error } = await supabaseClient
    .from('inventory')
    .select('*')
    .order('quantity_in_stock', { ascending: false })
    .limit(3);

  if (error || !data) {
    console.error('staff-realtime.js: failed to load inventory:', error);
    return; // Keep existing static content.
  }

  const programs = data.map(row => ({
    name: row.program || row.name || 'Program',
    volume: Number(row.quantity_in_stock ?? row.volume_ml ?? 0),
  }));

  if (programs.length === 0) {
    panel.innerHTML = `
      <div class="dashboard-card-head">
        <h2>Inventory by program</h2>
      </div>
      <p style="padding: 1rem; color: var(--muted);">
        No inventory data yet. Add inventory rows with a program to see live totals.
      </p>
    `;
    return;
  }

  // Map fill colour classes to the existing palette (orange / teal / gold).
  const fillColors = ['orange', 'teal', 'gold'];
  const maxVolume = Math.max(...programs.map(p => p.volume), 1);

  const rowsHtml = programs.map((p, i) => `
    <div class="program-row" data-program-volume="${p.volume}">
      <div class="batch-id">${p.name}</div>
      <div class="program-track"><div class="program-fill ${fillColors[i % fillColors.length]}" style="width: ${Math.min((p.volume / maxVolume) * 100, 100)}%;" aria-hidden="true"></div></div>
      <div class="program-value">${p.volume.toLocaleString()} mL</div>
    </div>
  `).join('');

  // Preserve the card header (h2 + "Open inventory" link) and replace rows.
  const head = panel.querySelector('.dashboard-card-head');
  panel.innerHTML = '';
  if (head) panel.appendChild(head);
  panel.insertAdjacentHTML('beforeend', rowsHtml);
}
