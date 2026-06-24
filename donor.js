/**
 * Donor Registration Form Handler
 * Handles the multi-step donor wizard form submission
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await initDonorForm();
  setupDonorWizard();
});

/**
 * Initialize donor form - check login status and pre-fill if possible
 */
async function initDonorForm() {
  const user = await window.supabase.getCurrentUser();
  
  if (!user) {
    // Allow guest access to the registration flow — account creation occurs in the Account Setup step.
    console.log('Guest user: donor registration available without prior login.');
    // do not redirect; return early only when strict auth is required elsewhere
  }
  
  // Get user profile to check if they're a donor
  const profile = await window.supabase.getUserProfile();
  if (profile && profile.user_type !== 'donor') {
    // Silently redirect if not a donor
    window.location.href = 'index.html';
    return;
  }

  // Update navigation visibility
  if (profile) {
    // updateNavVisibility(profile.user_type); // Now handled by auth.js
  }
  
  // Pre-fill email for logged-in users
  const emailField = document.getElementById('email');
  if (emailField) {
    emailField.value = user.email;
    emailField.disabled = true;
  }
}

/**
 * Setup wizard navigation (next/back buttons)
 */
function setupDonorWizard() {
  const wizard = document.querySelector('[data-donor-wizard]');
  if (!wizard) return;

  // Handle next/back button clicks WITHOUT submitting form
  const actionButtons = wizard.querySelectorAll('button[data-step-action]');
  actionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      if (button.dataset.stepAction === 'back') {
        e.preventDefault();
        previousStep();
      } else if (button.dataset.stepAction === 'next' && button.type === 'button') {
        // Only prevent default for navigation buttons, not submit buttons
        e.preventDefault();
        nextStep();
      } else if (button.dataset.stepAction === 'save') {
        e.preventDefault();
        // Save draft functionality could go here
        alert('Draft saved!');
      }
    });
  });

  // Ensure first active step is visible on load
  const active = wizard.querySelector('.donor-step.is-active');
  if (active) {
    active.scrollIntoView({behavior: 'auto', block: 'start'});
    updateStepLabel();
  }
}

/**
 * Navigate to next step using smooth vertical scroll
 */
function nextStep() {
  const wizard = document.querySelector('[data-donor-wizard]');
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const currentIndex = steps.indexOf(activeStep);
  
  if (currentIndex < steps.length - 1) {
    activeStep.classList.remove('is-active');
    const next = steps[currentIndex + 1];
    next.classList.add('is-active');
    updateStepLabel();
    // Smooth scroll the next step into view (vertical reveal)
    next.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}

/**
 * Navigate to previous step using smooth vertical scroll
 */
function previousStep() {
  const wizard = document.querySelector('[data-donor-wizard]');
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const currentIndex = steps.indexOf(activeStep);
  
  if (currentIndex > 0) {
    activeStep.classList.remove('is-active');
    const prev = steps[currentIndex - 1];
    prev.classList.add('is-active');
    updateStepLabel();
    prev.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}

/**
 * Update the track position for the current step
 * (No horizontal track used anymore for scroll reveal)
 */
function updateStepPosition() {
  // Intentionally left blank for scroll-based reveal
}

/**
 * Update the step counter and title
 */
function updateStepLabel() {
  const wizard = document.querySelector('[data-donor-wizard]');
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const currentIndex = steps.indexOf(activeStep) + 1;
  
  const stepLabel = wizard.querySelector('[data-step-label]');
  const stepTitle = wizard.querySelector('[data-step-title]');
  const nextBtn = wizard.querySelector('button[type="submit"]');
  
  if (stepLabel) stepLabel.textContent = currentIndex;
  if (stepTitle) stepTitle.textContent = activeStep.dataset.stepTitle || 'Step ' + currentIndex;
  
  if (nextBtn) {
    if (currentIndex === steps.length) {
      nextBtn.textContent = 'Complete Registration';
    } else {
      nextBtn.textContent = 'Next Step';
    }
  }
}

/**
 * Handle final form submission - creates donor profile in database
 */
async function handleDonorRegistration(event) {
  event.preventDefault();

  // Check which step we're on - only process on final step
  const wizard = document.querySelector('[data-donor-wizard]');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const stepIndex = steps.indexOf(activeStep);
  const totalSteps = steps.length;

  // If not on the last step, just navigate to next step
  if (stepIndex < totalSteps - 1) {
    nextStep();
    return;
  }

  // Only proceed with registration on the FINAL step
  // Verify authentication
  const user = await window.supabase.getCurrentUser();
  if (!user) {
    alert('You must be logged in to complete donor registration.');
    window.location.href = 'login.html';
    return;
  }

  // Get blood type from form if available
  const bloodTypeField = document.getElementById('hiv-status');
  const bloodType = 'O+'; // Default - you could make this selectable

  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Completing registration...';
  }

  try {
    // Create donor profile
    const result = await window.supabase.createDonorProfile({
      blood_type: bloodType,
      status: 'active'
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Success
    alert('Congratulations! Your donor profile has been created. You can now track your donations.');
    window.location.href = 'history.html';

  } catch (error) {
    console.error('Error:', error);
    alert('Error completing registration: ' + error.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

