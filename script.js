(function () {
  'use strict';

  /* ---------- Year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Form load timestamp (anti-bot) ---------- */
  const formTs = document.getElementById('_form_loaded_at');
  if (formTs) formTs.value = Date.now();

  /* ---------- Obfuscated contact links (anti-scraping) ---------- */
  /* Phone/email are stored base64-encoded in data attributes rather than as
     plain tel:/mailto: hrefs, so bulk scrapers that only read static HTML
     (rather than execute JS) don't harvest them. */
  document.querySelectorAll('[data-contact-type]').forEach((el) => {
    const type  = el.getAttribute('data-contact-type');
    const value = atob(el.getAttribute('data-contact-value'));
    el.setAttribute('href', `${type}:${value}`);
    el.removeAttribute('data-contact-type');
    el.removeAttribute('data-contact-value');

    /* Icon links keep the display text in a nested span so the icon survives. */
    const displayEl = el.querySelector('[data-contact-display]') || el;
    displayEl.textContent = atob(displayEl.getAttribute('data-contact-display'));
    displayEl.removeAttribute('data-contact-display');
  });

  /* ---------- Nav toggle ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks  = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('nav-links--open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('nav-links--open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Theme toggle (light / dark) ---------- */
  (function () {
    const STORAGE_KEY = 'os-theme';
    const root        = document.documentElement;
    const toggle      = document.querySelector('.theme-toggle');
    const darkQuery   = window.matchMedia('(prefers-color-scheme: dark)');

    /* The effective theme = explicit choice if set, else the device preference. */
    function effectiveTheme() {
      const explicit = root.getAttribute('data-theme');
      if (explicit === 'light' || explicit === 'dark') return explicit;
      return darkQuery.matches ? 'dark' : 'light';
    }

    /* Keep the button's accessible label/state in sync with the current theme. */
    function syncToggle() {
      if (!toggle) return;
      const isLight = effectiveTheme() === 'light';
      toggle.setAttribute('aria-pressed', String(isLight));
      toggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    }

    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = effectiveTheme() === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage unavailable */ }
        syncToggle();
      });
    }

    /* While following the device (no explicit choice), reflect live OS changes. */
    darkQuery.addEventListener('change', () => {
      if (!root.getAttribute('data-theme')) syncToggle();
    });

    syncToggle();
  })();

  /* ---------- Back to top ---------- */
  const btt = document.querySelector('.back-to-top');
  if (btt) {
    window.addEventListener('scroll', () => {
      btt.classList.toggle('back-to-top--visible', window.scrollY > 400);
    }, { passive: true });

    /* The #top target is the sticky header, whose scroll anchor tracks the
       current scroll position, so a plain fragment jump goes nowhere. Scroll
       the window to the top explicitly instead. */
    btt.addEventListener('click', (e) => {
      e.preventDefault();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    window.addEventListener('scroll', () => {
      siteHeader.classList.toggle('site-header--scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const isOpen = item.classList.contains('faq-item--open');
      document.querySelectorAll('.faq-item--open').forEach(i => {
        i.classList.remove('faq-item--open');
        i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('faq-item--open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Scroll reveal ---------- */
  if ('IntersectionObserver' in window) {
    const targets = document.querySelectorAll(
      '.section-header, .service-card, .feature, .about-stat, ' +
      '.included-item, .process-step, .related-card, .pricing-card, ' +
      '.contact-item, .compare-card'
    );

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

    targets.forEach(el => {
      /* Only animate elements that start below the fold */
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('reveal');
        io.observe(el);
      }
    });
  }

  /* ---------- Contact form (AJAX via Web3Forms) ---------- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {

    /* The <form novalidate> attribute suppresses the browser's native error
       bubbles so we can show errors inline via .field-error spans instead,
       but the underlying constraint-validation API (input.validity) still
       works per-field even though the form itself won't auto-check it. */
    function fieldErrorEl(input) {
      return input.closest('.form-group')?.querySelector('.field-error') || null;
    }

    function showFieldError(input, message) {
      input.classList.add('invalid');
      const err = fieldErrorEl(input);
      if (err) err.textContent = message;
    }

    function clearFieldError(input) {
      input.classList.remove('invalid');
      const err = fieldErrorEl(input);
      if (err) err.textContent = '';
    }

    function validateField(input) {
      if (input.validity.valid) {
        clearFieldError(input);
        return true;
      }
      const message = input.validity.typeMismatch
        ? 'Please enter a valid email address.'
        : 'This field is required.';
      showFieldError(input, message);
      return false;
    }

    const requiredFields = contactForm.querySelectorAll('#name, #email, #message');
    requiredFields.forEach((field) => {
      field.addEventListener('blur', () => validateField(field));
      field.addEventListener('input', () => {
        if (field.classList.contains('invalid')) validateField(field);
      });
    });

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const submitBtn   = contactForm.querySelector('[type="submit"]');
      const successDiv  = document.getElementById('form-success');
      const errorDiv    = document.getElementById('form-error');
      const captchaErr  = document.getElementById('captcha-error');
      const originalTxt = submitBtn ? submitBtn.textContent : '';

      if (successDiv) successDiv.hidden = true;
      if (errorDiv)   errorDiv.hidden   = true;

      let firstInvalid = null;
      let formValid = true;
      requiredFields.forEach((field) => {
        if (!validateField(field) && !firstInvalid) firstInvalid = field;
        formValid = formValid && field.validity.valid;
      });

      /* hCaptcha (rendered by the Web3Forms client script) writes the
         solved challenge into this hidden field once the user completes it. */
      const captchaResponse = contactForm.querySelector(
        '[name="h-captcha-response"], [name="g-recaptcha-response"]'
      );
      const captchaSolved = !!(captchaResponse && captchaResponse.value.trim());
      if (captchaErr) captchaErr.textContent = captchaSolved ? '' : 'Please complete the captcha challenge.';
      if (!captchaSolved) {
        formValid = false;
        if (!firstInvalid) firstInvalid = contactForm.querySelector('.h-captcha');
      }

      if (!formValid) {
        if (firstInvalid && typeof firstInvalid.focus === 'function') firstInvalid.focus();
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(contactForm),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            contactForm.reset();
            if (successDiv) successDiv.hidden = false;
          } else {
            if (errorDiv) errorDiv.hidden = false;
          }
        })
        .catch(function () {
          if (errorDiv) errorDiv.hidden = false;
        })
        .finally(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalTxt; }
        });
    });
  }

})();
