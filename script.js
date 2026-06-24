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

if (donorWizard) {
  const track = donorWizard.querySelector('.donor-wizard-track');
  const steps = Array.from(donorWizard.querySelectorAll('.donor-step'));
  const stepLabel = donorWizard.querySelector('[data-step-label]');
  const stepTotal = donorWizard.querySelector('[data-step-total]');
  const stepTitle = donorWizard.querySelector('[data-step-title]');
  const backButton = donorWizard.querySelector('[data-step-action="back"]');
  const nextButton = donorWizard.querySelector('[data-step-action="next"]');
  const saveButton = donorWizard.querySelector('[data-step-action="save"]');

  let currentStep = 0;

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
    // helper to remove any existing tooltip and shake classes
    const removeTooltip = () => {
      const existing = document.getElementById('field-tooltip');
      if (existing) existing.remove();
      document.querySelectorAll('.input-error-shake').forEach((el) => el.classList.remove('input-error-shake'));
      document.querySelectorAll('[data-tooltip-listener]').forEach((el) => {
        const fn = el.dataset.tooltipListener && window[el.dataset.tooltipListener];
        if (fn) el.removeEventListener('input', fn);
        delete el.dataset.tooltipListener;
        el.removeAttribute('aria-describedby');
      });
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
        // show a single animated indicator pointing to this control
        removeTooltip();
        control.classList.add('input-error-shake');

        const msg = control.validationMessage || 'Please complete this field.';
        const tip = document.createElement('div');
        tip.id = 'field-tooltip';
        tip.className = 'field-tooltip';
        tip.textContent = msg;
        document.body.appendChild(tip);

        // position the tooltip to the right by default
        const rect = control.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        const top = window.scrollY + rect.top + (rect.height - tipRect.height) / 2;
        let left = window.scrollX + rect.right + 12;

        // if not enough space on the right, place above the field
        if (spaceRight < tipRect.width + 24) {
          left = window.scrollX + rect.left + (rect.width - tipRect.width) / 2;
          tip.style.left = `${Math.max(8, left)}px`;
          tip.style.top = `${Math.max(8, window.scrollY + rect.top - tipRect.height - 12)}px`;
          tip.classList.add('field-tooltip-above');
        } else {
          tip.style.left = `${left}px`;
          tip.style.top = `${Math.max(8, top)}px`;
          tip.classList.remove('field-tooltip-above');
        }

        // accessibility
        control.setAttribute('aria-describedby', 'field-tooltip');

        // focus the field so user can correct; ensure visible on small screens
        control.focus({preventScroll: false});
        control.scrollIntoView({behavior: 'smooth', block: 'center'});

        // add listener to clear when fixed
        const listener = () => {
          if (control.checkValidity()) {
            removeTooltip();
          }
        };

        // store a reference name on window so it can be removed reliably
        const listenerName = `tooltipListener_${Date.now()}_${Math.floor(Math.random()*10000)}`;
        window[listenerName] = listener;
        control.dataset.tooltipListener = listenerName;
        control.addEventListener('input', listener);

        return false;
      }
    }

    // password match check
    if (password && confirmPassword && password.value && confirmPassword.value && password.value !== confirmPassword.value) {
      removeTooltip();
      confirmPassword.classList.add('input-error-shake');

      const msg = 'Passwords do not match.';
      const tip = document.createElement('div');
      tip.id = 'field-tooltip';
      tip.className = 'field-tooltip';
      tip.textContent = msg;
      document.body.appendChild(tip);

      const rect = confirmPassword.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const left = window.scrollX + rect.right + 12;
      const top = window.scrollY + rect.top + (rect.height - tipRect.height) / 2;
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(8, top)}px`;

      confirmPassword.setAttribute('aria-describedby', 'field-tooltip');
      confirmPassword.focus({preventScroll: false});
      confirmPassword.scrollIntoView({behavior: 'smooth', block: 'center'});

      const listener = () => {
        if (confirmPassword.checkValidity() && password.value === confirmPassword.value) {
          removeTooltip();
        }
      };
      const listenerName = `tooltipListener_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      window[listenerName] = listener;
      confirmPassword.dataset.tooltipListener = listenerName;
      confirmPassword.addEventListener('input', listener);

      return false;
    }

    // all good
    // clear any lingering tooltip
    const existing = document.getElementById('field-tooltip');
    if (existing) existing.remove();
    document.querySelectorAll('.input-error-shake').forEach((el) => el.classList.remove('input-error-shake'));
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

