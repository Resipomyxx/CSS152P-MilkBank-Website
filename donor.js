/**
 * Donor Registration Form Handler
 * Handles the multi-step donor wizard form submission
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDonorForm();
  } finally {
    setupDonorWizard();
  }
});

/**
 * Initialize donor form - check login status and pre-fill if possible
 */
async function initDonorForm() {
  const user = await window.supabase.getCurrentUser();

  if (!user) {
    console.log('Guest user: donor registration available without prior login.');
  }

  const profile = await window.supabase.getUserProfile();
  if (profile && profile.user_type !== 'donor') {
    window.location.href = 'index.html';
    return;
  }

  const emailField = document.getElementById('email');
  if (emailField && user?.email) {
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

  setupPhoneValidation();

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
      alert('Draft saved!');
      return;
    }

    if (action === 'next') {
      if (button.type === 'button') {
        e.preventDefault();
        nextStep();
        return;
      }
    }
  });

  const active = wizard.querySelector('.donor-step.is-active');
  if (active) {
    active.scrollIntoView({behavior: 'auto', block: 'start'});
    updateStepLabel();

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
 * Strip non-digits and enforce 11-digit cap on the mobile number field
 */
function setupPhoneValidation() {
  const phoneField = document.getElementById('phone');
  if (!phoneField) return;
  phoneField.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
  });
  phoneField.addEventListener('blur', () => {
    const val = phoneField.value;
    if (val && val.length !== 11) {
      phoneField.setCustomValidity('Mobile number must be exactly 11 digits.');
    } else {
      phoneField.setCustomValidity('');
    }
  });
  phoneField.addEventListener('input', () => {
    phoneField.setCustomValidity('');
  });
}

/**
 * Navigate to next step using smooth vertical scroll
 */
function nextStep() {
  const wizard = document.querySelector('[data-donor-wizard]');
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const currentIndex = steps.indexOf(activeStep);

  if (typeof window.validateStep === 'function') {
    const valid = window.validateStep(activeStep);
    if (!valid) return;
  }

  if (currentIndex < steps.length - 1) {
    activeStep.classList.remove('is-active');
    const next = steps[currentIndex + 1];
    next.classList.add('is-active');
    updateStepLabel();

    if (next.dataset.stepTitle === 'Eligibility Review') {
      populateEligibilityReview();
    }

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
 * Update the step counter, title, and next button label/type
 */
function updateStepLabel() {
  const wizard = document.querySelector('[data-donor-wizard]');
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const currentIndex = steps.indexOf(activeStep) + 1;

  const stepLabel = wizard.querySelector('[data-step-label]');
  const stepTitle = wizard.querySelector('[data-step-title]');
  // Use data-step-action selector so it works regardless of current type attribute
  const nextBtn = wizard.querySelector('button[data-step-action="next"]');

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
 * Populate the eligibility review checklist based on Medical History answers
 */
function populateEligibilityReview() {
  const wizard = document.querySelector('[data-donor-wizard]');
  const list = wizard.querySelector('[data-eligibility-list]');
  if (!list) return;

  const checks = [
    {
      name: 'q_lactating',
      yesLabel: 'Currently lactating with excess milk — eligible',
      yesClass: 'is-eligible',
      noLabel: 'No excess milk production reported — not eligible',
      noClass: 'is-ineligible',
    },
    {
      name: 'q_blood_test',
      yesLabel: 'Willing to undergo mandatory blood test — eligible',
      yesClass: 'is-eligible',
      noLabel: 'Unwilling to undergo blood test — not eligible',
      noClass: 'is-ineligible',
    },
    {
      name: 'q_chronic',
      yesLabel: 'History of chronic conditions reported — requires medical review',
      yesClass: 'is-review',
      noLabel: 'No chronic medical conditions — eligible',
      noClass: 'is-eligible',
    },
    {
      name: 'q_transfusion',
      yesLabel: 'Recent blood transfusion or surgery — 12-month deferral applies',
      yesClass: 'is-review',
      noLabel: 'No recent transfusion or surgery — eligible',
      noClass: 'is-eligible',
    },
    {
      name: 'q_medications',
      yesLabel: 'Current medications reported — requires medical review',
      yesClass: 'is-review',
      noLabel: 'No current medications — eligible',
      noClass: 'is-eligible',
    },
    {
      name: 'q_otc',
      yesLabel: 'OTC supplements or herbal remedies reported — requires review',
      yesClass: 'is-review',
      noLabel: 'No OTC supplements or herbal remedies — eligible',
      noClass: 'is-eligible',
    },
    {
      name: 'q_tobacco',
      yesLabel: 'Tobacco or nicotine use reported — not eligible',
      yesClass: 'is-ineligible',
      noLabel: 'No tobacco or nicotine use — eligible',
      noClass: 'is-eligible',
    },
    {
      name: 'q_alcohol_drugs',
      yesLabel: 'Alcohol or recreational drug use reported — requires review',
      yesClass: 'is-review',
      noLabel: 'No alcohol or recreational drug use — eligible',
      noClass: 'is-eligible',
    },
    {
      name: 'q_tattoo',
      yesLabel: 'Tattoo or piercing in past 12 months — 12-month deferral applies',
      yesClass: 'is-review',
      noLabel: 'No recent tattoo or piercing — eligible',
      noClass: 'is-eligible',
    },
  ];

  list.innerHTML = '';
  checks.forEach((check) => {
    const answered = wizard.querySelector(`input[name="${check.name}"]:checked`);
    const li = document.createElement('li');
    if (answered && answered.value === 'yes') {
      li.className = check.yesClass;
      li.textContent = check.yesLabel;
    } else if (answered && answered.value === 'no') {
      li.className = check.noClass;
      li.textContent = check.noLabel;
    } else {
      li.className = 'is-review';
      li.textContent = 'Question not answered — please go back to complete Medical History';
    }
    list.appendChild(li);
  });
}

/**
 * Handle final form submission - creates donor profile in database
 */
async function handleDonorRegistration(event) {
  event.preventDefault();

  const wizard = document.querySelector('[data-donor-wizard]');
  const steps = Array.from(wizard.querySelectorAll('.donor-step'));
  const activeStep = wizard.querySelector('.donor-step.is-active');
  const stepIndex = steps.indexOf(activeStep);
  const totalSteps = steps.length;

  if (stepIndex < totalSteps - 1) {
    nextStep();
    return;
  }

  // Validate final step fields (checkboxes etc.) before submitting
  if (typeof window.validateStep === 'function') {
    const valid = window.validateStep(activeStep);
    if (!valid) return;
  }

  const form = document.querySelector('[data-donor-wizard]');
  const termsCheckbox = form.querySelector('input[name="terms_acknowledged"]');
  const eulaAccepted = termsCheckbox && termsCheckbox.checked;
  if (!eulaAccepted) {
    if (typeof window.showDonorEula === 'function') {
      window.showDonorEula();
      return;
    }
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Completing registration...';
  }

  try {
    const result = await window.supabase.createDonorProfile({
      blood_type: 'O+',
      status: 'active'
    });

    if (!result.success) {
      throw new Error(result.error);
    }

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
