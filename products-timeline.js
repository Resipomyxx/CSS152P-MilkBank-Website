/**
 * Products Real-Time Timeline Handler
 *
 * Subscribes to live INSERT / UPDATE / DELETE events on the Supabase
 * `products` table (schema: 'public') and renders the 30 most recent rows
 * into the products-timeline container in products.html. Any change pushed
 * by Postgres is reflected in the UI without a page refresh.
 *
 * Schema fields read from `products` (per the canonical table definition):
 *   id                (uuid)
 *   name              (text)
 *   description       (text)
 *   sku               (text)
 *   quantity_in_stock (int4)
 *   unit_price        (numeric)
 *   category          (text)
 *   created_at        (timestamp)
 *   updated_at        (timestamp)
 *
 * The container element #products-timeline-list is rendered structurally
 * BELOW the products grid in products.html, so new events appear beneath
 * the catalog and prepend to the top of the list.
 */

// Graceful no-op if Supabase is not loaded (e.g. file:// without a server).
if (typeof supabaseClient === 'undefined') {
  console.warn('products-timeline.js: supabaseClient is not available; timeline will not load.');
} else {
  // Run on page load.
  document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialProductTimeline();
    subscribeToProducts();
  });
}

/**
 * Fetch the 30 most recent product rows and render them into the timeline.
 * Falls back to friendly empty states if the table is empty or inaccessible.
 */
async function loadInitialProductTimeline() {
  const list = document.getElementById('products-timeline-list');
  if (!list) return;

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('products-timeline.js: failed to load products:', error);
    list.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No product activity yet. Add rows to the <code>products</code> table to see real-time updates here.
      </p>
    `;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No products recorded yet. New products will appear here in real time.
      </p>
    `;
    return;
  }

  // Clear the loading placeholder, then render each product row.
  list.innerHTML = '';
  data.forEach((row, index) => {
    list.insertAdjacentHTML('beforeend', renderProductEvent(row, index));
  });
}

/**
 * Subscribe to live changes on the `products` table.
 * Channel name: 'products-changes' (distinct from inventory.js's
 * 'inventory-changes' channel so the two clients don't share state).
 * Listens for: any postgres_changes event (INSERT, UPDATE, DELETE).
 * On every event, the new/updated row is prepended to the timeline.
 */
function subscribeToProducts() {
  supabaseClient
    .channel('products-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        // payload.new is the new row for INSERT and UPDATE.
        // payload.old is the previous row for UPDATE and DELETE.
        // We only render when we have a "new" representation to display.
        const row = payload.new || payload.old;
        if (!row) return;
        prependProductEvent(row);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('products-timeline.js: products-changes channel error');
      }
    });
}

/**
 * Prepend a single product event to the top of the products timeline.
 * Trims the list to 30 items so the feed stays bounded.
 */
function prependProductEvent(row) {
  const list = document.getElementById('products-timeline-list');
  if (!list) return;

  // Remove the loading placeholder (or empty-state paragraph) if present.
  const placeholder = list.querySelector('p');
  if (placeholder) placeholder.remove();

  list.insertAdjacentHTML('afterbegin', renderProductEvent(row, 0));

  // Trim to 30 items max.
  while (list.children.length > 30) {
    list.removeChild(list.lastElementChild);
  }
}

/**
 * Produce the HTML for a single product timeline event.
 * Reads directly from the `products` schema fields:
 *   name, sku, category, quantity_in_stock, unit_price, updated_at / created_at.
 *
 * @param {object} row - The row from the `products` table.
 * @param {number} index - Position in the list (used as a fallback ID).
 * @returns {string} HTML string for one <article class="history-event">.
 */
function renderProductEvent(row, index) {
  const { markerClass, markerSymbol, statusClass, statusText } = productVisuals(row);

  // Identifier — prefer sku, fall back to id, then a synthetic ID.
  const productId = row.sku || row.id || String(2000 + index).slice(-3);
  const name = row.name || 'Untitled product';
  const category = row.category ? ` · ${row.category}` : '';
  const stock = Number(row.quantity_in_stock ?? 0);
  const price = Number(row.unit_price ?? 0);

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
          <h3>${name} (${productId}) — ₱${price.toLocaleString()}</h3>
          <span class="history-status ${statusClass}">${statusText}</span>
        </div>
        <p>${formattedDate}${category} · ${stock} in stock</p>
      </div>
    </article>
  `;
}

/**
 * Map a product row to the matching CSS classes and symbol used by the
 * donor and inventory timelines. Uses only fields that exist on the
 * `products` table: quantity_in_stock, category, name.
 */
function productVisuals(row) {
  const stock = Number(row.quantity_in_stock ?? 0);
  const category = String(row.category || '').toLowerCase().trim();

  // New arrivals / "new" category get a teal marker.
  if (category === 'new' || category === 'new arrivals') {
    return {
      markerClass: 'history-marker-teal',
      markerSymbol: '★',
      statusClass: 'history-status-ready',
      statusText: 'New arrival',
    };
  }

  // Sale items get an orange marker.
  if (category === 'sale' || category === 'on sale') {
    return {
      markerClass: 'history-marker-orange',
      markerSymbol: '%',
      statusClass: 'history-status-warm',
      statusText: 'On sale',
    };
  }

  // Popular items get a blue marker.
  if (category === 'popular' || category === 'most popular') {
    return {
      markerClass: 'history-marker-blue',
      markerSymbol: '♥',
      statusClass: 'history-status-ready',
      statusText: 'Most popular',
    };
  }

  // Stock-level fallback markers.
  if (stock <= 0) {
    return {
      markerClass: 'history-marker-gray',
      markerSymbol: '✗',
      statusClass: 'history-status-warning',
      statusText: 'Out of stock',
    };
  }

  if (stock < 10) {
    return {
      markerClass: 'history-marker-orange',
      markerSymbol: '!',
      statusClass: 'history-status-warm',
      statusText: 'Low stock',
    };
  }

  return {
    markerClass: 'history-marker-teal',
    markerSymbol: '●',
    statusClass: 'history-status-ready',
    statusText: 'In stock',
  };
}
