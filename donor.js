/**
 * Donor Registration Form Handler
 * Handles the multi-step donor wizard form submission
 */

window.REGISTRATION_DRAFT_KEY = window.REGISTRATION_DRAFT_KEY || 'lactocare.registrationDraft';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDonorForm();
  } finally {
    setupDonorWizard();
  }
});

function getRegistrationDraft() {
  try {
    const rawValue = sessionStorage.getItem(window.REGISTRATION_DRAFT_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.error('Read registration draft error:', error);
    return null;
  }
}

function saveRegistrationDraft(draftData) {
  try {
    sessionStorage.setItem(window.REGISTRATION_DRAFT_KEY, JSON.stringify(draftData));
  } catch (error) {
    console.error('Save registration draft error:', error);
  }
}

function clearRegistrationDraft() {
  try {
    sessionStorage.removeItem(window.REGISTRATION_DRAFT_KEY);
  } catch (error) {
    console.error('Clear registration draft error:', error);
  }
}

function buildRegistrationDraft() {
  const form = document.querySelector('[data-donor-wizard]');
  if (!form) return {};

  const formData = new FormData(form);
  return {
    first_name: String(formData.get('first_name') || '').trim(),
    last_name: String(formData.get('last_name') || '').trim(),
    date_of_birth: String(formData.get('date_of_birth') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    mobile_number: String(formData.get('mobile_number') || '').trim(),
    emergency_contact_name: String(formData.get('emergency_contact_name') || '').trim(),
    emergency_contact_number: String(formData.get('emergency_contact_number') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    province: String(formData.get('province') || '').trim(),
    preferred_contact_method: String(formData.get('preferred_contact_method') || '').trim(),
    program: String(formData.get('donation_program') || '').trim(),
    collection_type: String(formData.get('collection_type') || '').trim(),
    preferred_schedule: String(formData.get('preferred_schedule') || '').trim(),
    donation_frequency: String(formData.get('donation_frequency') || '').trim(),
    program_notes: String(formData.get('program_notes') || '').trim(),
    q_lactating: formData.get('q_lactating') || '',
    q_blood_test: formData.get('q_blood_test') || '',
    q_chronic: formData.get('q_chronic') || '',
    q_transfusion: formData.get('q_transfusion') || '',
    q_medications: formData.get('q_medications') || '',
    q_otc: formData.get('q_otc') || '',
    q_tobacco: formData.get('q_tobacco') || '',
    q_alcohol_drugs: formData.get('q_alcohol_drugs') || '',
    q_tattoo: formData.get('q_tattoo') || '',
    guidelines_acknowledged: formData.has('guidelines_acknowledged'),
    information_accuracy: formData.has('information_accuracy'),
    terms_acknowledged: formData.has('terms_acknowledged'),
    activeStepIndex: Array.from(form.querySelectorAll('.donor-step')).findIndex(step => step.classList.contains('is-active'))
  };
}

function restoreRegistrationDraft() {
  const draft = getRegistrationDraft();
  if (!draft) return;

  const setValue = (selector, value) => {
    const element = document.querySelector(selector);
    if (!element || value === undefined || value === null || value === '') return;
    element.value = value;
  };

  setValue('#first-name', draft.first_name);
  setValue('#last-name', draft.last_name);
  setValue('#dob', draft.date_of_birth);
  setValue('#email', draft.email);
  setValue('#phone', draft.mobile_number);
  setValue('#emergency-name', draft.emergency_contact_name);
  setValue('#emergency-phone', draft.emergency_contact_number);
  setValue('#address', draft.address);
  setValue('#city', draft.city);
  setValue('#province', draft.province);
  setValue('#preferred-contact', draft.preferred_contact_method);
  setValue('#program', draft.program);
  setValue('#collection-type', draft.collection_type);
  setValue('#schedule', draft.preferred_schedule);
  setValue('#frequency', draft.donation_frequency);
  setValue('#program-notes', draft.program_notes);

  const checkboxes = ['guidelines_acknowledged', 'information_accuracy', 'terms_acknowledged'];
  checkboxes.forEach((name) => {
    const checkbox = document.querySelector(`input[name="${name}"]`);
    if (checkbox) checkbox.checked = Boolean(draft[name]);
  });

  const radioFields = ['q_lactating', 'q_blood_test', 'q_chronic', 'q_transfusion', 'q_medications', 'q_otc', 'q_tobacco', 'q_alcohol_drugs', 'q_tattoo'];
  radioFields.forEach((name) => {
    if (!draft[name]) return;
    const radio = document.querySelector(`input[name="${name}"][value="${draft[name]}"]`);
    if (radio) radio.checked = true;
  });
}

/**
 * Initialize donor form - check login status and pre-fill if possible
 */
async function initDonorForm() {
  const user = await window.supabase.getCurrentUser();

  if (!user) {
    console.log('Guest user: donor registration available without prior login.');
    restoreRegistrationDraft();
    return;
  }

  const profile = await window.supabase.getUserProfile();
  if (profile && profile.user_type !== 'donor') {
    window.location.href = 'index.html';
    return;
  }

  // Already completed registration — send to donation history
  const donorRecord = await window.supabase.getCurrentUserDonor();
  if (profile && profile.user_type === 'donor' && donorRecord) {
    window.location.href = 'history.html';
    return;
  }

  const emailField = document.getElementById('email');
  if (emailField && user?.email) {
    emailField.value = user.email;
    emailField.disabled = true;
  }

  restoreRegistrationDraft();
}

/**
 * Setup wizard navigation (next/back buttons)
 */
function setupDonorWizard() {
  const wizard = document.querySelector('[data-donor-wizard]');
  if (!wizard) return;

  setupPhoneValidation();
  setupDobValidation();
  setupPasswordValidation();
  restoreRegistrationDraft();

  const persistDraft = () => saveRegistrationDraft(buildRegistrationDraft());

  wizard.addEventListener('input', persistDraft);
  wizard.addEventListener('change', persistDraft);

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
  const phoneFields = [document.getElementById('phone'), document.getElementById('emergency-phone')].filter(Boolean);
  const sanitizeDigits = (field) => {
    field.value = field.value.replace(/\D/g, '').slice(0, 11);
  };

  phoneFields.forEach((phoneField) => {
    phoneField.addEventListener('input', () => {
      sanitizeDigits(phoneField);
      phoneField.setCustomValidity('');
    });

    phoneField.addEventListener('blur', () => {
      sanitizeDigits(phoneField);
      const val = phoneField.value;

      if (val && val.length !== 11) {
        phoneField.setCustomValidity('Mobile number must be exactly 11 digits.');
      } else {
        phoneField.setCustomValidity('');
      }
    });
  });
}

/**
 * Validate the date of birth field so only real past dates are accepted.
 */
function setupDobValidation() {
  const dobField = document.getElementById('dob');
  if (!dobField) return;

  const minDate = '1900-01-01';
  const today = new Date().toISOString().slice(0, 10);
  dobField.min = minDate;
  dobField.max = today;

  const validateDob = () => {
    const value = dobField.value;

    if (!value) {
      dobField.setCustomValidity('');
      return;
    }

    if (value < minDate) {
      dobField.setCustomValidity('Please enter a valid date of birth after 1900.');
      return;
    }

    if (value > today) {
      dobField.setCustomValidity('Date of birth cannot be in the future.');
      return;
    }

    dobField.setCustomValidity('');
  };

  dobField.addEventListener('input', validateDob);
  dobField.addEventListener('change', validateDob);
  dobField.addEventListener('blur', validateDob);
}

/**
 * Validate password strength and confirm both password fields match.
 */
function setupPasswordValidation() {
  const passwordField = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirm-password');
  if (!passwordField || !confirmPasswordField) return;

  const strengthRules = [
    /[a-z]/,
    /[A-Z]/,
    /[0-9]/,
    /[^A-Za-z0-9]/,
  ];

  const getStrength = (value) => {
    if (!value || value.length < 8) {
      return { level: 'weak', message: 'Password is weak. Use at least 8 characters with upper and lower case letters, a number, and a symbol.' };
    }

    const matches = strengthRules.reduce((count, rule) => count + (rule.test(value) ? 1 : 0), 0);

    if (value.length >= 12 && matches === 4) {
      return { level: 'strong', message: 'Password strength: strong.' };
    }

    if (matches >= 3) {
      return { level: 'moderate', message: 'Password strength: moderate. Add one more character type to make it stronger.' };
    }

    return { level: 'weak', message: 'Password is weak. Use upper and lower case letters, a number, and a symbol.' };
  };

  const validatePasswords = () => {
    const strength = getStrength(passwordField.value);

    if (strength.level === 'weak') {
      passwordField.setCustomValidity(strength.message);
    } else if (strength.level === 'moderate') {
      passwordField.setCustomValidity(strength.message);
    } else {
      passwordField.setCustomValidity('');
    }

    if (confirmPasswordField.value && passwordField.value !== confirmPasswordField.value) {
      confirmPasswordField.setCustomValidity('Passwords do not match.');
    } else {
      confirmPasswordField.setCustomValidity('');
    }
  };

  passwordField.addEventListener('input', validatePasswords);
  passwordField.addEventListener('blur', validatePasswords);
  confirmPasswordField.addEventListener('input', validatePasswords);
  confirmPasswordField.addEventListener('blur', validatePasswords);
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
    const answered = wizard.querySelector(`select[name="${check.name}"]`);
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

const PROGRAM_DESCRIPTIONS = {
  'Supsup Todo': 'Best for mothers with a large daily surplus — ideal if you regularly produce more than 500 mL beyond your baby\'s needs.',
  'Milky Way': 'For consistent donors who can commit to weekly or bi-weekly drop-offs of at least 100 mL per session.',
  "Mom's Act": 'No commitment required — donate whenever you have milk to spare. Great for first-time or occasional donors.',
};

/**
 * Show a compact description below the program select when a program is chosen
 */
function showProgramDescription(value) {
  const descEl = document.getElementById('program-description');
  if (!descEl) return;
  const desc = PROGRAM_DESCRIPTIONS[value];
  if (desc) {
    descEl.textContent = desc;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }
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
  let user = await window.supabase.getCurrentUser();

  if (stepIndex < totalSteps - 1) {
    saveRegistrationDraft(buildRegistrationDraft());
    nextStep();
    return;
  }

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

  const formData = new FormData(form);

  try {
    if (!user) {
      const email = String(formData.get('email') || '').trim();
      const password = String(formData.get('password') || '');
      const firstName = String(formData.get('first_name') || '').trim();
      const lastName = String(formData.get('last_name') || '').trim();

      if (!email || !password) {
        throw new Error("Email and password are required to register.");
      }

      const authResult = await window.supabase.signUp(email, password, {
        full_name: `${firstName} ${lastName}`.trim(),
        user_type: 'donor'
      });

      if (!authResult.success) {
        throw new Error(authResult.error);
      }
      
    }

    const personalInformation = {
      first_name: String(formData.get('first_name') || '').trim(),
      last_name: String(formData.get('last_name') || '').trim(),
      birthdate: String(formData.get('date_of_birth') || '').trim(),
      email: String(formData.get('email') || '').trim(), 
      phone_number: String(formData.get('mobile_number') || '').trim(),
      emergency_contact: String(formData.get('emergency_contact_name') || '').trim(),
      street_address: String(formData.get('address') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      region: String(formData.get('province') || '').trim(),
      emergency_contact_number: String(formData.get('emergency_contact_number') || '').trim(),
    };

    const medicalHistory = {
      q_lactating: formData.get('q_lactating') === 'yes',
      q_blood_test: formData.get('q_blood_test') === 'yes',
      q_chronic: formData.get('q_chronic') === 'yes',
      q_transfusion: formData.get('q_transfusion') === 'yes',
      q_medications: formData.get('q_medications') === 'yes',
      q_otc: formData.get('q_otc') === 'yes',
      q_tobacco: formData.get('q_tobacco') === 'yes',
      q_alcohol_drugs: formData.get('q_alcohol_drugs') === 'yes',
      q_tattoo: formData.get('q_tattoo') === 'yes',
    };

    const result = await window.supabase.createDonorProfile({
      blood_type: '',
      status: 'active',
      personalInformation,
      medicalHistory,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    const programSelection = {
      program: String(formData.get('donation_program') || '').trim(),
      collection_type: String(formData.get('collection_type') || '').trim(),
      preferred_schedule: String(formData.get('preferred_schedule') || '').trim(),
      donation_frequency: String(formData.get('donation_frequency') || '').trim(),
      program_notes: String(formData.get('program_notes') || '').trim(),
    };

    const selectionResult = await window.supabase.saveDonorProgramSelection(programSelection);
    if (!selectionResult.success) {
      throw new Error(selectionResult.error);
    }

    clearRegistrationDraft();
    alert('Congratulations! Your donor profile has been created. You can now track your donations.');
    window.location.href = 'history.html';

  } catch (error) {
    console.error('Registration Error:', error);
    alert('Error completing registration: ' + error.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}
