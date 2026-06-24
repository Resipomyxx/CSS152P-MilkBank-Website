/**
 * Staff Dashboard Handler
 * Loads and displays staff dashboard data from Supabase
 */

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initStaffDashboard();
});

/**
 * Initialize staff dashboard
 * Check authentication and load data
 */
async function initStaffDashboard() {
  // Require staff authentication
  const user = await requireAuth('login.html');
  if (!user) return;

  // Get user profile
  const profile = await window.supabase.getUserProfile();
  if (!profile || (profile.user_type !== 'staff' && profile.user_type !== 'admin')) {
    // Silently redirect if not staff/admin
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

  // Handle Role-based restrictions
  if (profile.user_type === 'admin') {
    const smallTitle = document.querySelector('.site-header small');
    if (smallTitle) smallTitle.textContent = 'Admin Dashboard';
    
    // Also update the sidebar label or breadcrumb if it exists
    const eyebrow = document.querySelector('.dashboard-main .eyebrow');
    if (eyebrow) eyebrow.textContent = 'Admin Overview';
  } else {
    // Staff member - hide admin-only features
    const adminSections = document.querySelectorAll('[data-role="admin"]');
    adminSections.forEach(el => el.style.display = 'none');
  }

  // Load dashboard data
  await loadDashboardData();
  setupNavigation();
}

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
  try {
    // Load donors
    const donors = await window.supabase.getActiveDonors();
    const donorCount = donors.length;
    const newDonors = Math.floor(Math.random() * 5); // This week (simulated)

    // Load donations
    const donations = await window.supabase.getAllDonations();
    const pendingDonations = donations.filter(d => d.status === 'pending').length;

    // Load products (inventory)
    const products = await window.supabase.getProducts();
    let totalInventory = 0;
    products.forEach(p => {
      totalInventory += (p.quantity_in_stock || 0) * (p.unit_price || 1);
    });

    // Update stats
    updateMetricCard(0, donorCount, `+${newDonors} this week`);
    updateMetricCard(1, pendingDonations, 'Batches awaiting results');
    updateMetricCard(2, Math.floor(totalInventory), `Across ${products.length} batches`);
    updateMetricCard(3, Math.floor(Math.random() * 10), '2 urgent pending'); // Simulated requests

    // Load donation list
    await loadRecentDonations(donations);

    // Load donor list
    await loadDonorList(donors);

    // Load inventory
    await loadInventory(products);

  } catch (error) {
    console.error('Error loading dashboard:', error);
    alert('Error loading dashboard data: ' + error.message);
  }
}

/**
 * Update a metric card value
 */
function updateMetricCard(index, value, subtitle) {
  const cards = document.querySelectorAll('.metric-card');
  if (cards[index]) {
    cards[index].querySelector('strong').textContent = value;
    if (cards[index].querySelector('p')) {
      cards[index].querySelector('p').textContent = subtitle;
    }
  }
}

/**
 * Load and display recent donations
 */
async function loadRecentDonations(donations) {
  const batchList = document.querySelector('.batch-list');
  if (!batchList || donations.length === 0) return;

  // Clear existing items
  batchList.innerHTML = '';

  // Show top 5
  donations.slice(0, 5).forEach((donation, idx) => {
    const statusClass = donation.status === 'approved' 
      ? 'is-ready' 
      : donation.status === 'pending' 
      ? 'is-screened' 
      : 'is-collected';

    const batchHtml = `
      <div class="batch-row">
        <div class="batch-meta">
          <div class="batch-id">B2025-${String(1000 + idx).slice(-3)}</div>
          <div class="batch-name">Donation ${donation.id.slice(0, 8)}</div>
        </div>
        <div class="batch-volume">${donation.amount_ml || 0} mL</div>
        <span class="status-pill ${statusClass}">${donation.status || 'Pending'}</span>
      </div>
    `;
    batchList.innerHTML += batchHtml;
  });
}

/**
 * Load and display donor list
 */
async function loadDonorList(donors) {
  // This would populate a donors section if it exists
  // For now, the data is just used for the count
  console.log(`Loaded ${donors.length} active donors`);
}

/**
 * Load and display inventory
 */
async function loadInventory(products) {
  const inventoryPanel = document.querySelector('.inventory-panel');
  if (!inventoryPanel || products.length === 0) return;

  // Find program rows
  const programRows = inventoryPanel.querySelectorAll('.program-row');
  
  // Distribute products across programs (simulated grouping)
  const programNames = ['Program A', 'Program B', 'Program C'];
  let rowIndex = 0;
  let accumulatedVolume = 0;

  products.forEach((product, idx) => {
    accumulatedVolume += (product.quantity_in_stock || 0) * 100; // Simulate volume

    if (rowIndex < programRows.length) {
      const row = programRows[rowIndex];
      const nameEl = row.querySelector('.batch-id');
      const valueEl = row.querySelector('.program-value');
      const fillEl = row.querySelector('.program-fill');

      if (nameEl) nameEl.textContent = product.category || `Item ${idx + 1}`;
      if (valueEl) valueEl.textContent = `${product.quantity_in_stock || 0} units`;
      if (fillEl) fillEl.style.width = `${Math.min(accumulatedVolume / 5000 * 100, 100)}%`;

      rowIndex++;
    }
  });
}

/**
 * Setup sidebar navigation
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  const sections = document.querySelectorAll('[id]');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        // Remove active from all links
        navLinks.forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');

        // Scroll to section
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Add logout button functionality
 */
function setupLogoutButton() {
  const logoutBtn = document.querySelector('[data-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const result = await window.supabase.signOut();
      if (result.success) {
        window.location.href = 'index.html';
      }
    });
  }
}

/**
 * Helper function to require authentication
 */
function requireAuth(redirectUrl = 'login.html') {
  const user = window.supabase.getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}

