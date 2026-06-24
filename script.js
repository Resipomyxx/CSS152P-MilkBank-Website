const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const reveals = document.querySelectorAll('.reveal');
const programRows = document.querySelectorAll('.program-row[data-program-volume]');
const donorWizard = document.querySelector('[data-donor-wizard]');

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    siteNav.classList.toggle('is-open');
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 780px)').matches) {
        navToggle.setAttribute('aria-expanded', 'false');
        siteNav.classList.remove('is-open');
      }
    });
  });
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add('is-visible'));
}

if (programRows.length) {
  const volumes = Array.from(programRows)
    .map((row) => Number(row.dataset.programVolume || 0))
    .filter((volume) => Number.isFinite(volume) && volume > 0);

  const maxVolume = volumes.length ? Math.max(...volumes) : 1;

  programRows.forEach((row) => {
    const volume = Number(row.dataset.programVolume || 0);
    const fill = row.querySelector('.program-fill');
    const percent = maxVolume ? Math.max(0, Math.min(100, (volume / maxVolume) * 100)) : 0;

    if (fill) {
      fill.style.width = `${percent}%`;
      fill.setAttribute('aria-hidden', 'true');
    }

    row.setAttribute('aria-label', `${row.querySelector('.batch-id')?.textContent || 'Program'}: ${volume.toLocaleString()} mL`);
  });
}

if (donorWizard && typeof window.setupDonorWizard !== 'function') {
  const track = donorWizard.querySelector('.donor-wizard-track');
  const steps = Array.from(donorWizard.querySelectorAll('.donor-step'));
  const stepLabel = donorWizard.querySelector('[data-step-label]');
  const stepTotal = donorWizard.querySelector('[data-step-total]');
  const stepTitle = donorWizard.querySelector('[data-step-title]');
  const backButton = donorWizard.querySelector('[data-step-action="back"]');
  const nextButton = donorWizard.querySelector('[data-step-action="next"]');
  const saveButton = donorWizard.querySelector('[data-step-action="save"]');

  let currentStep = 0;
  let activeValidationControl = null;
  let activeValidationTooltip = null;
  let activeValidationHandler = null;

  const updateWizard = () => {
    steps.forEach((step, index) => {
      step.classList.toggle('is-active', index === currentStep);
    });

    if (track) {
      track.style.transform = `translateX(-${currentStep * 100}%)`;
    }

    if (stepLabel) {
      stepLabel.textContent = String(currentStep + 1);
    }

    if (stepTotal) {
      stepTotal.textContent = String(steps.length);
    }

    if (stepTitle) {
      stepTitle.textContent = steps[currentStep]?.dataset.stepTitle || '';
    }

    if (backButton) {
      backButton.disabled = currentStep === 0;
    }

    if (nextButton) {
      nextButton.textContent = currentStep === steps.length - 1 ? 'Submit Registration' : 'Next';
    }
  };

  const validateStep = (step) => {
    const clearValidationFeedback = () => {
      if (activeValidationControl && activeValidationHandler) {
        activeValidationControl.removeEventListener('input', activeValidationHandler);
        activeValidationControl.removeEventListener('change', activeValidationHandler);
        activeValidationControl.classList.remove('input-error-shake');
        activeValidationControl.removeAttribute('aria-describedby');
      }

      if (activeValidationTooltip) {
        activeValidationTooltip.remove();
      }

      activeValidationControl = null;
      activeValidationTooltip = null;
      activeValidationHandler = null;
      document.querySelectorAll('.input-error-shake').forEach((el) => el.classList.remove('input-error-shake'));
    };

    const showValidationFeedback = (control, message, isResolved = () => control.checkValidity()) => {
      clearValidationFeedback();

      control.classList.add('input-error-shake');
      control.setAttribute('aria-describedby', 'field-tooltip');

      const tip = document.createElement('div');
      tip.id = 'field-tooltip';
      tip.className = 'field-tooltip';
      tip.setAttribute('role', 'status');
      tip.setAttribute('aria-live', 'polite');
      tip.textContent = message;
      document.body.appendChild(tip);

      const rect = control.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const gap = 14;
      const viewportPadding = 10;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      let placement = 'right';
      let top = rect.top + (rect.height - tipRect.height) / 2;
      let left = rect.right + gap;

      if (spaceRight < tipRect.width + gap && spaceLeft > tipRect.width + gap) {
        placement = 'left';
        left = rect.left - tipRect.width - gap;
      } else if (spaceRight < tipRect.width + gap && spaceAbove > tipRect.height + gap) {
        placement = 'above';
        left = Math.max(viewportPadding, rect.left + (rect.width - tipRect.width) / 2);
        top = rect.top - tipRect.height - gap;
      } else if (spaceRight < tipRect.width + gap && spaceBelow > tipRect.height + gap) {
        placement = 'below';
        left = Math.max(viewportPadding, rect.left + (rect.width - tipRect.width) / 2);
        top = rect.bottom + gap;
      }

      tip.dataset.placement = placement;
      tip.style.position = 'fixed';
      tip.style.left = `${Math.max(viewportPadding, left)}px`;
      tip.style.top = `${Math.max(viewportPadding, top)}px`;
      tip.style.maxWidth = `${Math.min(280, window.innerWidth - viewportPadding * 2)}px`;

      activeValidationControl = control;
      activeValidationTooltip = tip;

      activeValidationHandler = () => {
        if (isResolved()) {
          clearValidationFeedback();
        }
      };

      control.addEventListener('input', activeValidationHandler);
      control.addEventListener('change', activeValidationHandler);
    };

    const controls = Array.from(step.querySelectorAll('input, select, textarea')).filter((control) => !control.disabled && control.offsetParent !== null);
    const password = step.querySelector('#password');
    const confirmPassword = step.querySelector('#confirm-password');

    // find first invalid control
    for (const control of controls) {
      // checkbox custom validity
      if (control.type === 'checkbox' && control.required && !control.checked) {
        control.setCustomValidity('Please check this box before continuing.');
      } else if (control.type === 'checkbox') {
        control.setCustomValidity('');
      }

      if (!control.checkValidity()) {
        showValidationFeedback(control, control.validationMessage || 'Please complete this field.');

        control.focus({preventScroll: false});
        control.scrollIntoView({behavior: 'smooth', block: 'center'});

        return false;
      }
    }

    // password match check
    if (password && confirmPassword && password.value && confirmPassword.value && password.value !== confirmPassword.value) {
      showValidationFeedback(confirmPassword, 'Passwords do not match.', () => {
        return confirmPassword.checkValidity() && password.value === confirmPassword.value;
      });
      confirmPassword.focus({preventScroll: false});
      confirmPassword.scrollIntoView({behavior: 'smooth', block: 'center'});

      return false;
    }

    clearValidationFeedback();
    return true;
  };

  // Expose validateStep globally so other scripts (donor.js) can call it before advancing
  window.validateStep = validateStep;

  if (backButton) {
    backButton.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep -= 1;
        updateWizard();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const activeStep = steps[currentStep];

      if (!validateStep(activeStep)) {
        return;
      }

      if (currentStep < steps.length - 1) {
        currentStep += 1;
        updateWizard();
        return;
      }

      // Final step: ensure EULA and terms were accepted
      const formEl = document.querySelector('[data-donor-wizard]');
      const termsBox = formEl ? formEl.querySelector('input[name="terms_acknowledged"]') : null;
      if (!termsBox || !termsBox.checked) {
        if (typeof window.showDonorEula === 'function') {
          window.showDonorEula();
          return;
        }
        alert('Please accept the registration terms before completing registration.');
        return;
      }

      alert('Registration successful! Redirecting to your dashboard...');
      window.location.href = 'history.html';
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      alert('Draft saved locally.');
    });
  }

  updateWizard();
}

const countUpObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const finalValue = parseInt(element.dataset.value, 10);
        const duration = 1500;
        const startTime = performance.now();

        const animateCount = (currentTime) => {
          const elapsedTime = currentTime - startTime;
          const progress = Math.min(elapsedTime / duration, 1);
          const currentValue = Math.floor(progress * finalValue);

          element.textContent = `${currentValue} ${element.textContent.split(' ')[1]}`;

          if (progress < 1) {
            requestAnimationFrame(animateCount);
          } else {
            element.textContent = `${finalValue} ${element.textContent.split(' ')[1]}`;
          }
        };

        requestAnimationFrame(animateCount);
        observer.unobserve(element);
      }
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll('.count-up').forEach((element) => {
  countUpObserver.observe(element);
});

const carousel = document.querySelector('.product-carousel-inner');
const prevButton = document.querySelector('.carousel-button.prev');
const nextButton = document.querySelector('.carousel-button.next');
const cards = Array.from(document.querySelectorAll('.product-carousel .product-card'));
let currentIndex = 0;
let autoRotateInterval;

function updateCarousel(manual = false) {
  if (cards.length === 0) return;
  const parent = document.querySelector('.product-carousel');
  const gap = parseInt(getComputedStyle(carousel).gap) || 0;
  const cardWidth = cards[0].offsetWidth + gap;
  const offset = (parent.offsetWidth / 2) - (cards[0].offsetWidth / 2);
  carousel.style.transform = `translateX(${offset - (currentIndex * cardWidth)}px)`;

  cards.forEach((card, index) => {
    card.classList.toggle('active', index === currentIndex);
  });

  if (manual) {
    stopAutoRotate();
    startAutoRotate();
  }
}

function startAutoRotate() {
  autoRotateInterval = setInterval(() => {
    currentIndex = (currentIndex < cards.length - 1) ? currentIndex + 1 : 0;
    updateCarousel();
  }, 3000);
}

function stopAutoRotate() {
  clearInterval(autoRotateInterval);
}

if (prevButton && nextButton) {
  prevButton.addEventListener('click', () => {
    currentIndex = (currentIndex > 0) ? currentIndex - 1 : cards.length - 1;
    updateCarousel(true);
  });

  nextButton.addEventListener('click', () => {
    currentIndex = (currentIndex < cards.length - 1) ? currentIndex + 1 : 0;
    updateCarousel(true);
  });

  if (cards.length > 0) {
    cards[0].classList.add('active');
    updateCarousel();
    startAutoRotate();
  }

  document.querySelectorAll('.product-like-button').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.toggle('liked');
    });
  });

  window.addEventListener('resize', () => updateCarousel());
}
