(function () {
  'use strict';

  /* ---------- GA4 conversion event helper ---------- */
  /* Fires the conversion event and, if a URL is supplied, navigates after
     the event is acknowledged (or after a 2-second safety timeout). */
  function gtagSendEvent(url) {
    var callback = function () {
      if (typeof url === 'string') { window.location = url; }
    };
    if (typeof gtag === 'function') {
      gtag('event', 'conversion_event_submit_lead_form', {
        'event_callback': callback,
        'event_timeout': 2000,
      });
    } else {
      /* gtag not yet loaded – fire callback immediately so nothing blocks */
      callback();
    }
    return false;
  }

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

    /* Batch all DOM reads first, then do all writes – avoids forced reflow */
    const vh = window.innerHeight;
    const belowFold = Array.from(targets).filter(el => el.getBoundingClientRect().top > vh);
    belowFold.forEach(el => {
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  /* ---------- Lazy-load hCaptcha / web3forms script ---------- */
  /* Injected only when the contact form becomes visible in the viewport,
     keeping it off the critical path and reducing Total Blocking Time. */
  (function () {
    const hcForm = document.querySelector('.contact-form, #contact-form');
    if (!hcForm) return;
    var w3Loaded = false;
    function loadWeb3Forms() {
      if (w3Loaded) return;
      w3Loaded = true;
      var s = document.createElement('script');
      s.src = 'https://web3forms.com/client/script.js';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    if ('IntersectionObserver' in window) {
      var formObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) { loadWeb3Forms(); formObs.disconnect(); }
        });
      }, { rootMargin: '200px' });
      formObs.observe(hcForm);
    } else {
      /* Fallback for older browsers */
      loadWeb3Forms();
    }
  })();

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

    /* #company/#phone are only marked required on the cybersecurity audit landing page;
       elsewhere they lack the required attribute so validity.valid is trivially true. */
    const requiredFields = contactForm.querySelectorAll('#name, #email, #message, #phone, #company');
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
            gtagSendEvent();
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

  /* ---------- Landing-page support finder ---------- */
  const supportFinder = document.getElementById('support-finder');
  if (supportFinder) {
    const stages = {
      audience: supportFinder.querySelector('[data-support-stage="audience"]'),
      issue: supportFinder.querySelector('[data-support-stage="issue"]'),
      result: supportFinder.querySelector('[data-support-stage="result"]'),
    };
    const stepLabel = document.getElementById('support-step-label');
    const progress = document.getElementById('support-progress');
    const issueOptions = document.getElementById('support-issue-options');
    const resultTitle = document.getElementById('support-result-title');
    const resultCopy = document.getElementById('support-result-copy');
    const resultLink = document.getElementById('support-result-link');
    const contactLink = document.getElementById('support-contact-link');
    const backButton = document.getElementById('support-back');
    const restartButton = document.getElementById('support-restart');
    let selectedAudience = '';
    let selectedIssue = null;

    const recommendations = {
      business: [
        {
          label: 'Something is broken right now',
          title: 'Business IT support',
          copy: 'For faults, downtime and day-to-day technical problems, start with our responsive remote helpdesk. We will diagnose the issue and explain the next step clearly.',
          href: '/services/business/it-support',
          cta: 'Explore IT support',
          formService: 'business-services',
          message: 'I need help with an IT problem affecting my business.'
        },
        {
          label: 'Microsoft 365, email or Teams',
          title: 'Microsoft Modern Workplace',
          copy: 'For Microsoft 365 setup, migrations, Teams, SharePoint, Copilot or account security, our Modern Workplace service is the best starting point.',
          href: '/services/business/modern-workplace',
          cta: 'Explore Microsoft 365',
          formService: 'business-services',
          message: 'I need help with Microsoft 365, email or Teams.'
        },
        {
          label: 'A security concern or cyber risk',
          title: 'Business cybersecurity',
          copy: 'Start with a practical security review. We can help with email protection, endpoint security, threat monitoring and a clear plan to reduce risk.',
          href: '/services/business/cybersecurity',
          cta: 'Explore cybersecurity',
          formService: 'business-services',
          message: 'I would like help with a cybersecurity concern or security review.'
        },
        {
          label: 'New laptops or device problems',
          title: 'Device support',
          copy: 'We can source, configure and support business devices, or diagnose problems with the hardware your team already uses.',
          href: '/services/business/device-support',
          cta: 'Explore device support',
          formService: 'business-services',
          message: 'I need help with business devices or new laptops.'
        },
        {
          label: 'Ongoing cover for our team',
          title: 'Managed IT for business',
          copy: 'For reliable ongoing support, monitoring, security and Microsoft 365 management, compare our business support options.',
          href: '/services/business',
          cta: 'View business services',
          formService: 'business-services',
          message: 'I am looking for ongoing managed IT support for my business.'
        },
        {
          label: 'I am not sure yet',
          title: 'A short, no-pressure conversation',
          copy: 'You do not need to diagnose the problem before contacting us. Tell us what is happening and we will point you in the right direction.',
          href: '#contact',
          cta: 'Tell us what is happening',
          formService: 'business-services',
          message: 'I am not sure which business IT service I need and would like some guidance.'
        }
      ],
      home: [
        {
          label: 'A computer or device is not working',
          title: 'Remote help for home tech',
          copy: 'We can securely connect to diagnose slow computers, software errors and everyday device problems without waiting for a site visit.',
          href: '/services/home',
          cta: 'View home support',
          formService: 'home-services',
          message: 'I need help with a computer or device at home.'
        },
        {
          label: 'Wi-Fi, printer or home network',
          title: 'Home setup and troubleshooting',
          copy: 'For unreliable Wi-Fi, printer trouble or devices that will not connect, start with our home support service.',
          href: '/services/home',
          cta: 'View home support',
          formService: 'home-services',
          message: 'I need help with Wi-Fi, a printer or my home network.'
        },
        {
          label: 'A new device needs setting up',
          title: 'New device setup',
          copy: 'We can set up your new computer properly, move your files, configure accounts and make sure the essentials are secure.',
          href: '/services/home',
          cta: 'View home support',
          formService: 'home-services',
          message: 'I would like help setting up a new device at home.'
        },
        {
          label: 'I am worried about security',
          title: 'Home cybersecurity support',
          copy: 'If something feels wrong, we can check the device, remove threats and help you put sensible protection in place.',
          href: '/services/home',
          cta: 'View home security help',
          formService: 'home-services',
          message: 'I am worried about the security of a home device or account.'
        },
        {
          label: 'I am not sure yet',
          title: 'Friendly guidance from a real person',
          copy: 'Describe the problem in your own words. We will work out what kind of help you need and explain the options before any work starts.',
          href: '#contact',
          cta: 'Tell us what is happening',
          formService: 'home-services',
          message: 'I am not sure which home IT service I need and would like some guidance.'
        }
      ]
    };

    function refreshIcons() {
      if (window.lucide) window.lucide.createIcons();
    }

    function showSupportStage(name) {
      Object.entries(stages).forEach(([stageName, element]) => {
        const active = stageName === name;
        element.hidden = !active;
        element.classList.toggle('support-stage--active', active);
      });
      if (name === 'audience') {
        stepLabel.textContent = 'Step 1 of 2';
        progress.style.width = '50%';
      } else if (name === 'issue') {
        stepLabel.textContent = 'Step 2 of 2';
        progress.style.width = '100%';
      } else {
        stepLabel.textContent = 'Your recommendation';
        progress.style.width = '100%';
      }
      refreshIcons();
    }

    function renderIssues() {
      issueOptions.replaceChildren();
      recommendations[selectedAudience].forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'support-issue';
        button.textContent = item.label;
        button.addEventListener('click', () => showRecommendation(item));
        issueOptions.appendChild(button);
      });
    }

    function showRecommendation(item) {
      selectedIssue = item;
      resultTitle.textContent = item.title;
      resultCopy.textContent = item.copy;
      resultLink.href = item.href;
      resultLink.innerHTML = `${item.cta} <i data-lucide="arrow-right" aria-hidden="true"></i>`;
      showSupportStage('result');
    }

    supportFinder.querySelectorAll('input[name="support-audience"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        selectedAudience = radio.value;
        renderIssues();
        showSupportStage('issue');
      });
    });

    backButton.addEventListener('click', () => {
      selectedAudience = '';
      supportFinder.querySelectorAll('input[name="support-audience"]').forEach((radio) => { radio.checked = false; });
      showSupportStage('audience');
    });
    restartButton.addEventListener('click', () => {
      selectedAudience = '';
      selectedIssue = null;
      supportFinder.querySelectorAll('input[name="support-audience"]').forEach((radio) => { radio.checked = false; });
      showSupportStage('audience');
    });

    function prefillContactForm() {
      if (!selectedIssue) return;
      const serviceSelect = document.getElementById('service');
      const messageInput = document.getElementById('message');
      if (serviceSelect) serviceSelect.value = selectedIssue.formService;
      if (messageInput && !messageInput.value.trim()) messageInput.value = selectedIssue.message;
    }

    contactLink.addEventListener('click', prefillContactForm);
    resultLink.addEventListener('click', () => {
      if (selectedIssue && selectedIssue.href === '#contact') prefillContactForm();
    });
  }

})();
