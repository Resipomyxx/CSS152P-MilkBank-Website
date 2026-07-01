/**
 * Inventory Timeline Handler
 *
 * Loads the 30 most recent rows from the Supabase `inventory` table into the
 * inventory timeline and subscribes to live INSERT/UPDATE/DELETE events so
 * any change to inventory (new arrivals, status updates, expiry changes)
 * appears at the top of the list without a page refresh.
 *
 * Schema fields used from `inventory`:
 *   id              (uuid)
 *   batch_number    (uuid)
 *   donor_id        (uuid)
 *   program         (text)
 *   volume_available(numeric)
 *   expiry_date     (date)
 *   status          (text)
 *   created_at      (timestamp)
 *   updated_at      (timestamp)
 *
 * Reuses the .history-event / .history-marker / .history-status DOM pattern
 * already established on history.html / history.js so the visual matches the
 * donor donation timeline.
 */

// Graceful no-op if Supabase is not loaded (e.g. file:// without a server).
if (typeof supabaseClient === 'undefined') {
  console.warn('inventory.js: supabaseClient is not available; timeline will not load.');
} else {
  // Run on page load.
  document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialTimeline();
    subscribeToInventory();
  });
}

/**
 * Fetch the 30 most recent inventory rows and render them into the timeline.
 * Falls back to friendly empty states if the table is empty or inaccessible.
 */
async function loadInitialTimeline() {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  const { data, error } = await supabaseClient
    .from('inventory')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('inventory.js: failed to load inventory:', error);
    list.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No inventory activity yet. Add rows to the <code>inventory</code> table to see real-time updates here.
      </p>
    `;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No inventory recorded yet. New rows will appear here in real time.
      </p>
    `;
    return;
  }

  // Clear the loading placeholder, then render each inventory row.
  list.innerHTML = '';
  data.forEach((row, index) => {
    list.insertAdjacentHTML('beforeend', renderInventoryEvent(row, index));
  });
}

/**
 * Subscribe to live changes on the `inventory` table.
 * Channel name: 'inventory-changes'.
 * Listens for: any postgres_changes event (INSERT, UPDATE, DELETE).
 * On every event, the new/updated row is prepended to the timeline.
 */
function subscribeToInventory() {
  supabaseClient
    .channel('inventory-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory' },
      (payload) => {
        // payload.new is the new row for INSERT and UPDATE.
        // payload.old is the previous row for UPDATE and DELETE.
        // We only render when we have a "new" representation to display.
        const row = payload.new || payload.old;
        if (!row) return;
        prependInventoryEvent(row);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('inventory.js: inventory-changes channel error');
      }
    });
}

/**
 * Prepend a single inventory event to the top of the timeline.
 * Trims the list to 30 items so the feed stays bounded.
 */
function prependInventoryEvent(row) {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  // Remove the loading placeholder (or empty-state paragraph) if present.
  const placeholder = list.querySelector('p');
  if (placeholder) placeholder.remove();

  list.insertAdjacentHTML('afterbegin', renderInventoryEvent(row, 0));

  // Trim to 30 items max.
  while (list.children.length > 30) {
    list.removeChild(list.lastElementChild);
  }
}

/**
 * Produce the HTML for a single timeline event.
 * Mirrors the structure used by history.js (donor timeline) so the visuals
 * match exactly: .history-event > .history-marker + .history-event-body.
 *
 * @param {object} row - The row from the `inventory` table.
 * @param {number} index - Position in the list (used as a fallback ID).
 * @returns {string} HTML string for one <article class="history-event">.
 */
function renderInventoryEvent(row, index) {
  const { markerClass, markerSymbol, statusClass, statusText } = statusVisuals(row.status);

  // Inventory identifier — prefer batch_number, fall back to id, then a
  // synthetic ID like history.js does. The schema's batch_number is a uuid,
  // so we trim to a short suffix for readability.
  const rawBatchId = row.batch_number || row.id || String(1000 + index).slice(-3);
  const batchId = String(rawBatchId).length > 8
    ? `…${String(rawBatchId).slice(-8)}`
    : rawBatchId;
  const volume = Number(row.volume_available ?? 0);
  const program = row.program ? ` · ${row.program}` : '';
  const expiry = row.expiry_date
    ? ` · expires ${new Date(row.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  // Formatted date — prefer updated_at, fall back to created_at.
  let formattedDate = '';
  const sourceDate = row.updated_at || row.created_at;
  if (sourceDate) {
    const date = new Date(sourceDate);
    formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } else {
    formattedDate = 'Recently';
  }

  return `
    <article class="history-event">
      <div class="history-marker ${markerClass}">${markerSymbol}</div>
      <div class="history-event-body">
        <div class="history-event-title-row">
          <h3>Batch ${batchId} — ${volume} mL</h3>
          <span class="history-status ${statusClass}">${statusText}</span>
        </div>
        <p>${formattedDate}${program}${expiry}</p>
      </div>
    </article>
  `;
}

/**
 * Map an inventory.status string to the matching CSS classes and symbol
 * used by the donor timeline. Covers the full inventory lifecycle seen
 * across inventory.html, staff.html, and the status pills in styles.css.
 */
function statusVisuals(status) {
  const normalized = String(status || '').toLowerCase().trim();

  switch (normalized) {
    case 'collected':
    case 'received':
      return {
        markerClass: 'history-marker-blue',
        markerSymbol: '⬇',
        statusClass: 'history-status-warm',
        statusText: 'Collected',
      };
    case 'screened':
      return {
        markerClass: 'history-marker-orange',
        markerSymbol: '⏳',
        statusClass: 'history-status-warm',
        statusText: 'Screened',
      };
    case 'pasteurized':
    case 'pasteurising':
    case 'pasteurizing':
      return {
        markerClass: 'history-marker-orange',
        markerSymbol: '✓',
        statusClass: 'history-status-warm',
        statusText: 'Pasteurized',
      };
    case 'ready':
      return {
        markerClass: 'history-marker-teal',
        markerSymbol: '✓',
        statusClass: 'history-status-ready',
        statusText: 'Ready for release',
      };
    case 'dispensed':
    case 'distributed':
      return {
        markerClass: 'history-marker-teal',
        markerSymbol: '✓',
        statusClass: 'history-status-ready',
        statusText: 'Dispensed',
      };
    case 'expired':
      return {
        markerClass: 'history-marker-gray',
        markerSymbol: '✗',
        statusClass: 'history-status-warning',
        statusText: 'Expired',
      };
    case 'rejected':
      return {
        markerClass: 'history-marker-gray',
        markerSymbol: '✗',
        statusClass: 'history-status-warning',
        statusText: 'Rejected',
      };
    default:
      return {
        markerClass: 'history-marker-gray',
        markerSymbol: '●',
        statusClass: 'history-status-warm',
        statusText: normalized || 'Unknown',
      };
  }
}
