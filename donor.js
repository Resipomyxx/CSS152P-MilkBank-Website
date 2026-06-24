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

  // Delegate clicks inside the wizard for navigation buttons
  wizard.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-step-action]');
    if (!button || !wizard.contains(button)) return;

    const action = button.dataset.stepAction;

    if (action === 'back') {
      e.preventDefault();
      previousStep();
      return;
    }

    if (action === 'save') {
      e.preventDefault();
      // Save draft functionality could go here
      alert('Draft saved!');
      return;
    }

    if (action === 'next') {
      // For non-final steps, make sure next button is a button (not submit) to avoid form submit
      if (button.type === 'button') {
        e.preventDefault();
        nextStep();
        return;
      }
      // If button is submit, allow the form submit handler to run (handleDonorRegistration)
    }
  });

  // Ensure first active step is visible on load
  const active = wizard.querySelector('.donor-step.is-active');
  if (active) {
    active.scrollIntoView({behavior: 'auto', block: 'start'});
    updateStepLabel();

    // Ensure next button uses 'button' type on non-final steps to prevent accidental submit
    const wizardEl = document.querySelector('[data-donor-wizard]');
    const nextBtn = wizardEl.querySelector('button[data-step-action="next"]');
    const steps = Array.from(wizardEl.querySelectorAll('.donor-step'));
    const activeIndex = steps.indexOf(active) + 1;
    if (nextBtn) {
      nextBtn.type = (activeIndex === steps.length) ? 'submit' : 'button';
    }
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
  
  // Validate current step before moving on (uses global validator exposed by script.js)
  if (typeof window.validateStep === 'function') {
    const valid = window.validateStep(activeStep);
    if (!valid) return; // do not advance if validation fails
  }

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
      nextBtn.type = 'submit';
    } else {
      nextBtn.textContent = 'Next Step';
      nextBtn.type = 'button';
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
  // Verify authentication if required (guest flows allowed)
  const user = await window.supabase.getCurrentUser();
  // If EULA not accepted yet, show modal and defer submission
  const form = document.querySelector('[data-donor-wizard]');
  const termsCheckbox = form.querySelector('input[name="terms_acknowledged"]');
  const eulaAccepted = termsCheckbox && termsCheckbox.checked;
  if (!eulaAccepted) {
    // Show modal popup — window.showDonorEula is provided by donor.html inline script
    if (typeof window.showDonorEula === 'function') {
      window.showDonorEula();
      return;
    }
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

