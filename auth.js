/**
 * Authentication Form Handlers
 * 
 * Include this file along with supabase-config.js and supabase-client.js
 * Handles login and registration form submissions
 */

// ===================================
// REGISTRATION FORM HANDLER
// ===================================

async function handleRegister(event) {
  event.preventDefault();

  // Get form data
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;
  const firstName = document.getElementById('first-name').value.trim();
  const lastName = document.getElementById('last-name').value.trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const userType = document.getElementById('register-user-type').value; // 'donor', 'staff', or 'user'

  // Validation
  if (!email || !password) {
    showError('register-error', 'Email and password are required');
    return;
  }

  if (password !== passwordConfirm) {
    showError('register-error', 'Passwords do not match');
    return;
  }

  if (password.length < 6) {
    showError('register-error', 'Password must be at least 6 characters');
    return;
  }

  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const result = await window.supabase.signUp(email, password, {
      full_name: fullName,
      user_type: userType
    });

    if (!result.success) {
      showError('register-error', result.error);
      return;
    }

    // Success
    showSuccess('register-success', 'Registration successful! Check your email to confirm your account.');
    
    // Redirect after delay
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);

  } catch (error) {
    showError('register-error', 'An unexpected error occurred: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===================================
// LOGIN FORM HANDLER
// ===================================

async function handleLogin(event) {
  event.preventDefault();

  // Get form data
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  // Validation
  if (!email || !password) {
    showError('login-error', 'Email and password are required');
    return;
  }

  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const result = await window.supabase.signIn(email, password);

    if (!result.success) {
      showError('login-error', result.error);
      return;
    }

    // Get user profile to determine redirect
    const profile = await window.supabase.getUserProfile();
    
    // Redirect based on user type
    let redirectUrl = 'index.html';
    if (profile) {
      switch (profile.user_type) {
        case 'staff':
        case 'admin':
          redirectUrl = 'staff.html';
          break;
        case 'donor':
          redirectUrl = 'donor.html';
          break;
        default:
          redirectUrl = 'index.html';
      }
    }

    showSuccess('login-success', 'Login successful! Redirecting...');
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1000);

  } catch (error) {
    showError('login-error', 'An unexpected error occurred: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Display error message
 * @param {string} elementId - ID of error message container
 * @param {string} message - Error message to display
 */
function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.style.color = '#d32f2f';
    errorEl.style.marginBottom = '1rem';
  } else {
    alert('Error: ' + message);
  }
}

/**
 * Display success message
 * @param {string} elementId - ID of success message container
 * @param {string} message - Success message to display
 */
function showSuccess(elementId, message) {
  const successEl = document.getElementById(elementId);
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
    successEl.style.color = '#388e3c';
    successEl.style.marginBottom = '1rem';
  }
}

/**
 * Check if user is logged in and redirect if not
 * @param {string} redirectUrl - Where to redirect if not logged in
 */
async function requireAuth(redirectUrl = 'login.html') {
  const user = await window.supabase.getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
  }
  return user;
}

/**
 * Check if user is logged in and update UI
 * Shows/hides elements based on auth status and role
 */
async function updateAuthUI() {
  const user = await window.supabase.getCurrentUser();
  const profile = user ? await window.supabase.getUserProfile() : null;
  const userType = profile ? profile.user_type : 'guest';

  // Hide login/register links and show profile/logout if authenticated
  const authLinks = document.querySelectorAll('[data-auth="guest"]');
  const protectedLinks = document.querySelectorAll('[data-auth="protected"]');
  
  if (user) {
    authLinks.forEach(el => el.style.display = 'none');
    protectedLinks.forEach(el => el.style.display = 'block');
    
    // Update role-based navigation visibility
    updateNavVisibility(userType);
    
    // Special handling for staff dashboard title if admin
    if (userType === 'admin') {
      const staffDashLink = document.querySelector('a[href="staff.html"]');
      if (staffDashLink) staffDashLink.textContent = 'Admin Dashboard';
      
      const dashTitle = document.querySelector('.site-header small');
      if (dashTitle && window.location.pathname.includes('staff.html')) {
        dashTitle.textContent = 'Admin Dashboard';
      }
    }
  } else {
    authLinks.forEach(el => el.style.display = 'block');
    protectedLinks.forEach(el => el.style.display = 'none');
    updateNavVisibility('guest');
  }
}

/**
 * Update navigation visibility based on user type
 * Roles: guest, donor, staff, admin
 */
function updateNavVisibility(userType) {
  // Get all nav links
  const allNavLinks = document.querySelectorAll('.site-nav a');
  const donorLinks = document.querySelectorAll('a[href="donor.html"], a[href="donor-registration.html"], a[href="history.html"]');
  const staffLinks = document.querySelectorAll('a[href="staff.html"], a[href="inventory.html"]');
  const publicLinks = document.querySelectorAll('a[href="index.html"], a[href="about.html"], a[href="products.html"]');
  const guestLinks = document.querySelectorAll('a[href="login.html"], a[href="register.html"]');

  // Reset display
  allNavLinks.forEach(link => link.style.display = 'inline-block');

  if (userType === 'donor') {
    staffLinks.forEach(link => link.style.display = 'none');
    guestLinks.forEach(link => link.style.display = 'none');
  } else if (userType === 'staff' || userType === 'admin') {
    donorLinks.forEach(link => link.style.display = 'none');
    guestLinks.forEach(link => link.style.display = 'none');
    // Staff/Admin can see public links too
  } else {
    // Guest
    document.querySelectorAll('a[href="history.html"]').forEach(link => link.style.display = 'none');
    staffLinks.forEach(link => link.style.display = 'none');
    // Guests can see public links and login/register
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  const result = await window.supabase.signOut();
  if (result.success) {
    window.location.href = 'index.html';
  } else {
    alert('Error logging out: ' + result.error);
  }
}

// Initialize auth UI on page load
document.addEventListener('DOMContentLoaded', updateAuthUI);
