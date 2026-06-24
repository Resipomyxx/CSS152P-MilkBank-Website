/**
 * Donation History Handler
 * Loads and displays real donor donation history from Supabase
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initDonationHistory();
});

/**
 * Initialize donation history page
 */
async function initDonationHistory() {
  try {
    // Require authentication
    const user = await requireAuth('login.html');
    if (!user) return;

    // Get user profile
    const profile = await window.supabase.getUserProfile();
    if (!profile) {
      // Silently redirect if profile not found
      window.location.href = 'index.html';
      return;
    }

    // Check if user is a donor - silently redirect if not
    if (profile.user_type !== 'donor') {
      window.location.href = 'index.html';
      return;
    }

    // Update navigation visibility
    updateNavVisibility(profile.user_type);

    // Update donor info
    updateDonorInfo(profile);

    // Get donation history
    const donations = await window.supabase.getUserDonationHistory();
    
    // Update stats
    updateDonationStats(donations);

    // Display timeline
    displayDonationTimeline(donations);

  } catch (error) {
    console.error('Error loading donation history:', error);
    // Silently redirect on error
    window.location.href = 'index.html';
  }
}

/**
 * Update donor name and join date
 */
function updateDonorInfo(profile) {
  const nameEl = document.getElementById('donor-name');
  const sinceEl = document.getElementById('donor-since');

  if (nameEl) {
    nameEl.textContent = profile.full_name || 'Donor';
  }

  if (sinceEl) {
    // Display month/year of account creation
    if (profile.created_at) {
      const date = new Date(profile.created_at);
      sinceEl.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } else {
      sinceEl.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
  }
}

/**
 * Update donation statistics
 */
function updateDonationStats(donations) {
  // Total donations
  const totalDonationsEl = document.getElementById('total-donations');
  if (totalDonationsEl) {
    totalDonationsEl.textContent = donations.length;
  }

  // Total volume
  const totalVolumeEl = document.getElementById('total-volume');
  if (totalVolumeEl) {
    const totalMl = donations.reduce((sum, d) => sum + (d.amount_ml || 0), 0);
    totalVolumeEl.textContent = `${totalMl} mL`;
  }

  // Batches distributed (approved donations)
  const distributedEl = document.getElementById('batches-distributed');
  if (distributedEl) {
    const distributed = donations.filter(d => d.status === 'approved').length;
    distributedEl.textContent = distributed;
  }

  // Processing (pending donations)
  const processingEl = document.getElementById('processing-count');
  if (processingEl) {
    const processing = donations.filter(d => d.status === 'pending').length;
    processingEl.textContent = processing;
  }
}

/**
 * Display donation timeline
 */
function displayDonationTimeline(donations) {
  const timelineList = document.getElementById('timeline-list');
  if (!timelineList) return;

  // Clear loading message
  timelineList.innerHTML = '';

  // If no donations, show empty state
  if (donations.length === 0) {
    timelineList.innerHTML = `
      <p style="padding: 2rem; text-align: center; color: var(--muted);">
        No donations yet. <a href="donor.html">Register as a donor</a> to schedule your first donation.
      </p>
    `;
    return;
  }

  // Display each donation
  donations.forEach((donation, index) => {
    const eventHtml = createDonationEventHTML(donation, index);
    timelineList.innerHTML += eventHtml;
  });
}

/**
 * Create HTML for a single donation event
 */
function createDonationEventHTML(donation, index) {
  // Determine marker and status styles
  let markerClass = 'history-marker-teal';
  let statusClass = 'history-status-warm';
  let statusText = 'Pending';
  let markerSymbol = '⏳';

  if (donation.status === 'approved') {
    markerClass = 'history-marker-teal';
    statusClass = 'history-status-ready';
    statusText = 'Distributed to infant';
    markerSymbol = '✓';
  } else if (donation.status === 'rejected') {
    markerClass = 'history-marker-gray';
    statusClass = 'history-status-warning';
    statusText = 'Not suitable';
    markerSymbol = '✗';
  }

  // Format date
  const donationDate = new Date(donation.donation_date);
  const formattedDate = donationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Create event HTML
  return `
    <article class="history-event">
      <div class="history-marker ${markerClass}">${markerSymbol}</div>
      <div class="history-event-body">
        <div class="history-event-title-row">
          <h3>Batch #${String(1000 + index).slice(-3)} - ${donation.amount_ml || 0} mL donation</h3>
          <span class="history-status ${statusClass}">${statusText}</span>
        </div>
        <p>${formattedDate} · ${donation.amount_ml || 0} mL${donation.notes ? ' · ' + donation.notes : ''}</p>
      </div>
    </article>
  `;
}

/**
 * Helper function to require authentication
 * (Duplicated from auth.js for safety)
 */
async function requireAuth(redirectUrl = 'login.html') {
  const user = await window.supabase.getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}

