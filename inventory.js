/**
 * Inventory Timeline Handler
 *
 * Loads the 30 most recent rows from the Supabase `batches` table into the
 * inventory timeline and subscribes to live INSERT/UPDATE events so new
 * batches appear at the top of the list without a page refresh.
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
    subscribeToBatches();
  });
}

/**
 * Fetch the 30 most recent batches and render them into the timeline.
 * Falls back to friendly empty states if the table is empty or inaccessible.
 */
async function loadInitialTimeline() {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  const { data, error } = await supabaseClient
    .from('batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('inventory.js: failed to load batches:', error);
    list.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No batch activity yet. Add rows to the <code>batches</code> table to see real-time updates here.
      </p>
    `;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No batches recorded yet. New batches will appear here in real time.
      </p>
    `;
    return;
  }

  // Clear the loading placeholder, then render each batch.
  list.innerHTML = '';
  data.forEach((batch, index) => {
    list.insertAdjacentHTML('beforeend', renderBatchEvent(batch, index));
  });
}

/**
 * Subscribe to live changes on the `batches` table.
 * Channel name: 'batches-changes'.
 * Listens for: any postgres_changes event (INSERT, UPDATE, DELETE).
 * On every event, the new/updated row is prepended to the timeline.
 */
function subscribeToBatches() {
  supabaseClient
    .channel('batches-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'batches' },
      (payload) => {
        // payload.new is the new row for INSERT and UPDATE.
        // payload.old is the previous row for UPDATE and DELETE.
        // We only render when we have a "new" representation to display.
        const batch = payload.new || payload.old;
        if (!batch) return;
        prependBatchEvent(batch);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('inventory.js: batches-changes channel error');
      }
    });
}

/**
 * Prepend a single batch event to the top of the timeline.
 * Trims the list to 30 items so the feed stays bounded.
 */
function prependBatchEvent(batch) {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  // Remove the loading placeholder (or empty-state paragraph) if present.
  const placeholder = list.querySelector('p');
  if (placeholder) placeholder.remove();

  list.insertAdjacentHTML('afterbegin', renderBatchEvent(batch, 0));

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
 * @param {object} batch - The row from the `batches` table.
 * @param {number} index - Position in the list (used as a fallback ID).
 * @returns {string} HTML string for one <article class="history-event">.
 */
function renderBatchEvent(batch, index) {
  const { markerClass, markerSymbol, statusClass, statusText } = statusVisuals(batch.status);

  // Batch identifier — fall back to a synthetic ID like history.js does.
  const batchId = batch.batch_id || batch.id || String(1000 + index).slice(-3);
  const volume = batch.volume_ml || batch.amount_ml || 0;
  const donor = batch.donor_name ? ` · ${batch.donor_name}` : '';
  const program = batch.program ? ` · ${batch.program}` : '';

  // Formatted date — same locale format used on the donor timeline.
  let formattedDate = '';
  if (batch.created_at) {
    const date = new Date(batch.created_at);
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
          <h3>Batch ${batchId} — ${volume} mL${donor}</h3>
          <span class="history-status ${statusClass}">${statusText}</span>
        </div>
        <p>${formattedDate}${program}</p>
      </div>
    </article>
  `;
}

/**
 * Map a batch.status string to the matching CSS classes and symbol
 * used by the donor timeline. Covers the full batch lifecycle seen
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
