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

  /* ============================================================
     INTERACTIVE IT PLANNER WIDGET LOGIC (Lead Gen Funnel)
     ============================================================ */
  const plannerEl = document.getElementById('it-planner');
  if (plannerEl) {
    const configForm = document.getElementById('configurator-form');
    const prevBtn = document.getElementById('config-prev');
    const nextBtn = document.getElementById('config-next');
    const progressFill = document.getElementById('config-progress-fill');
    const stepNumEl = document.getElementById('current-step-num');
    const needsContainer = document.getElementById('needs-options-container');
    const scaleRange = document.getElementById('scale-range');
    const sliderLabels = document.getElementById('slider-labels-container');
    const planDisplayName = document.getElementById('plan-display-name');
    const estimatePlanBox = document.getElementById('estimate-plan-box');
    const estimateBoxLabel = document.getElementById('estimate-box-label');
    const estimatePlanTitle = document.getElementById('estimate-plan-title');
    const estimateDescText = document.getElementById('estimate-desc-text');
    const planNotSure = document.getElementById('plan-not-sure');
    const scaleSelectorContainer = document.getElementById('scale-selector-container');
    
    const step4Title = document.getElementById('step-4-title');
    const step4Subtitle = document.getElementById('step-4-subtitle');
    const successTitle = document.getElementById('success-overlay-title');
    const successDesc = document.getElementById('success-overlay-desc');
    
    const successOverlay = document.getElementById('config-success-overlay');
    const resetBtn = document.getElementById('config-reset-btn');
    
    let currentStep = 1;
    
    const serviceDatabase = {
      business: [
        { id: 'm365', label: 'Set up our secure professional business emails (Microsoft 365)', checked: true },
        { id: 'helpdesk', label: 'Provide ongoing IT helpdesk support for our day-to-day needs', checked: true },
        { id: 'security', label: 'Audit & protect our business from cybersecurity threats', checked: false },
        { id: 'devices', label: 'Sourcing & configuration of new team devices (Laptops)', checked: false },
        { id: 'cloud', label: 'Deploy Nextcloud private secure cloud storage for our team', checked: false }
      ],
      home: [
        { id: 'monitoring', label: 'Keep my computer healthy, updated, and scanned for threats 24/7', checked: true },
        { id: 'support', label: 'Include 1 hour of remote tech assistance every month', checked: true },
        { id: 'security_home', label: 'Install business-grade antivirus & safe browsing tools', checked: true },
        { id: 'setup', label: 'Help me set up a new laptop, home Wi-Fi, or printer', checked: false }
      ]
    };

    const plansDatabase = {
      business: [
        { id: 'starter', name: 'Starter Plan', desc: 'Built for startups & 1-3 person businesses. Friendly, proactive cover: 24/7 monitoring, automated patching, business antivirus, and pay-as-you-go remote support to help you get going.', icon: 'monitor', checked: false },
        { id: 'standard', name: 'Standard Plan (Most Popular)', desc: 'Our complete cover for established teams. Includes UNLIMITED remote support, advanced threat antivirus, email protection, Office 365 security audit, and quarterly review calls.', icon: 'zap', checked: true },
        { id: 'premium', name: 'Premium Plan', desc: 'Everything in Standard, enhanced across the board. Adds Managed Detection & Response (MDR), extended 8am-6pm support hours, monthly reporting, and dedicated response times.', icon: 'award', checked: false },
        { id: 'not_sure_biz', name: "I'm not sure / Let's discuss", desc: 'We will assess your needs and recommend the best plan for your business during our free consultation.', icon: 'help-circle', checked: false }
      ],
      home: [
        { id: 'personal', name: 'Personal Plan', desc: 'Perfect for one computer. Includes 24/7 health monitoring, auto security patching, business-grade antivirus, and 1 hour of remote support included every month.', icon: 'monitor', checked: true },
        { id: 'family', name: 'Family Plan', desc: 'Covers up to 3 computers. Includes full monitoring, updates, and business antivirus on all devices, and 1 hour of remote support included every month.', icon: 'users', checked: false },
        { id: 'family_plus', name: 'Family Plus Plan', desc: 'Covers 4 or more household computers. Includes same full monitoring, updates, and business antivirus on all devices, and 1 hour of remote support included every month.', icon: 'server', checked: false },
        { id: 'not_sure_home', name: "I'm not sure / Let's discuss", desc: "Tell us what tech challenges you're experiencing, and we'll suggest the most cost-effective and friendly way to get them sorted.", icon: 'help-circle', checked: false }
      ]
    };

    function getSelectedProfile() {
      const radio = configForm.querySelector('input[name="profile_type"]:checked');
      return radio ? radio.value : 'business';
    }

    function renderStep2Options() {
      const profile = getSelectedProfile();
      const options = serviceDatabase[profile];
      needsContainer.innerHTML = '';
      
      options.forEach(opt => {
        const optionLabel = document.createElement('label');
        optionLabel.className = 'need-checkbox-option';
        
        const isCheckedAttr = opt.checked ? 'checked' : '';
        
        optionLabel.innerHTML = `
          <input type="checkbox" name="needs" value="${opt.id}" ${isCheckedAttr} style="position: absolute; opacity: 0; pointer-events: none;" />
          <div class="need-checkbox-content">
            <div class="need-checkbox-bullet"></div>
            <div class="need-checkbox-label">${opt.label}</div>
          </div>
        `;
        
        const checkbox = optionLabel.querySelector('input');
        checkbox.addEventListener('change', () => {
          opt.checked = checkbox.checked;
        });
        
        needsContainer.appendChild(optionLabel);
      });
    }

    function renderStep3Plans() {
      const profile = getSelectedProfile();
      const plans = plansDatabase[profile];
      const bizSelector = document.getElementById('business-plan-selector');

      if (!planDisplayName || !estimatePlanTitle || !estimateDescText || !planNotSure || !scaleSelectorContainer) return;

      // Helper: mark a plan checked by id and mirror it into the estimate box
      function selectPlanById(id) {
        const sel = plans.find(p => p.id === id) || plans[0];
        plans.forEach(p => { p.checked = (p.id === sel.id); });
        planDisplayName.textContent = sel.name;
        estimatePlanTitle.textContent = sel.name;
        estimateDescText.textContent = sel.desc;
        if (estimateBoxLabel) {
          estimateBoxLabel.textContent = profile === 'business' ? 'Recommended Plan' : 'Selected Plan';
        }
      }

      // Helper: mark the last ("not sure") plan and show the custom-assessment copy
      function selectNotSure() {
        const notSureIndex = plans.length - 1;
        plans.forEach((p, idx) => { p.checked = (idx === notSureIndex); });
        const notSurePlan = plans[notSureIndex];
        planDisplayName.textContent = "Let's discuss!";
        estimatePlanTitle.textContent = notSurePlan ? notSurePlan.name : "Custom IT Assessment";
        estimateDescText.textContent = notSurePlan ? notSurePlan.desc : "We will assess your needs and recommend the best plan for you during our free consultation.";
        if (estimateBoxLabel) {
          estimateBoxLabel.textContent = 'Custom Assessment';
        }
      }

      if (profile === 'business') {
        // Business: team-size gate, then Standard/Premium choice for larger teams.
        if (scaleSelectorContainer) scaleSelectorContainer.style.display = 'none';
        if (!bizSelector) return;
        bizSelector.style.display = 'block';

        const tierChoice = document.getElementById('biz-tier-choice');
        const sizeRadios = bizSelector.querySelectorAll('input[name="biz_size"]');
        const tierRadios = bizSelector.querySelectorAll('input[name="biz_tier"]');

        function applyBusinessSelection() {
          const sizeInput = bizSelector.querySelector('input[name="biz_size"]:checked');
          const sizeVal = sizeInput ? sizeInput.value : 'large';
          if (sizeVal === 'small') {
            // 1-3 employees → Starter, hide the tier choice
            if (tierChoice) tierChoice.style.display = 'none';
            selectPlanById('starter');
          } else {
            // 4+ employees → let them choose Standard or Premium
            if (tierChoice) tierChoice.style.display = 'block';
            const tierInput = bizSelector.querySelector('input[name="biz_tier"]:checked');
            selectPlanById(tierInput ? tierInput.value : 'standard');
          }
        }

        function syncNotSureState() {
          if (planNotSure.checked) {
            bizSelector.style.opacity = '0.35';
            bizSelector.style.pointerEvents = 'none';
            selectNotSure();
          } else {
            bizSelector.style.opacity = '1';
            bizSelector.style.pointerEvents = 'auto';
            applyBusinessSelection();
          }
        }

        sizeRadios.forEach(r => { r.onchange = applyBusinessSelection; });
        tierRadios.forEach(r => { r.onchange = applyBusinessSelection; });
        planNotSure.onchange = syncNotSureState;

        planNotSure.checked = false;
        syncNotSureState();
        return;
      }

      // Home: original slider behaviour (Personal / Family / Family Plus).
      if (bizSelector) bizSelector.style.display = 'none';
      if (!scaleRange || !sliderLabels) return;
      scaleSelectorContainer.style.display = 'block';
      scaleRange.min = '1';
      scaleRange.max = '3';
      scaleRange.value = '1'; // Default to Personal
      sliderLabels.innerHTML = '<span>Personal (1)</span><span>Family (2-3)</span><span>Family Plus (4+)</span>';

      function updatePlanFromSlider() {
        const val = parseInt(scaleRange.value) - 1;
        const selectedPlan = plans[val];
        if (selectedPlan) {
          plans.forEach((p, idx) => { p.checked = (idx === val); });
          planDisplayName.textContent = selectedPlan.name;
          estimatePlanTitle.textContent = selectedPlan.name;
          estimateDescText.textContent = selectedPlan.desc;
          if (estimateBoxLabel) estimateBoxLabel.textContent = 'Selected Plan';
        }
      }

      function syncNotSureState() {
        if (planNotSure.checked) {
          scaleSelectorContainer.style.opacity = '0.35';
          scaleSelectorContainer.style.pointerEvents = 'none';
          selectNotSure();
        } else {
          scaleSelectorContainer.style.opacity = '1';
          scaleSelectorContainer.style.pointerEvents = 'auto';
          updatePlanFromSlider();
        }
      }

      scaleRange.oninput = updatePlanFromSlider;
      planNotSure.onchange = syncNotSureState;

      planNotSure.checked = false;
      syncNotSureState();
    }

    function showStep(step) {
      plannerEl.querySelectorAll('.config-step').forEach(el => {
        el.classList.remove('active');
      });
      
      const nextStepEl = plannerEl.querySelector(`.config-step[data-step="${step}"]`);
      if (nextStepEl) {
        nextStepEl.classList.add('active');
      }
      
      currentStep = step;
      stepNumEl.textContent = currentStep;
      
      const percent = (currentStep / 4) * 100;
      progressFill.style.width = `${percent}%`;
      
      prevBtn.disabled = currentStep === 1;
      
      if (currentStep === 4) {
        const profile = getSelectedProfile();
        if (profile === 'business') {
          if (step4Title) step4Title.textContent = "Let's review your custom IT plan!";
          if (step4Subtitle) step4Subtitle.textContent = "Provide your contact info to receive an official proposal and schedule your free strategy call.";
          nextBtn.innerHTML = 'Request Callback <i data-lucide="send"></i>';
        } else {
          if (step4Title) step4Title.textContent = "Let's get your tech sorted!";
          if (step4Subtitle) step4Subtitle.textContent = "Enter your details below. A friendly technician will contact you within 2 hours to help sort your tech.";
          nextBtn.innerHTML = 'Get Help Now <i data-lucide="zap"></i>';
        }
      } else {
        nextBtn.innerHTML = 'Continue <i data-lucide="arrow-right"></i>';
      }
      
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    nextBtn.addEventListener('click', (e) => {
      if (currentStep < 4) {
        if (currentStep === 1) {
          renderStep2Options();
        } else if (currentStep === 2) {
          renderStep3Plans();
        }
        showStep(currentStep + 1);
      } else {
        const nameInput = document.getElementById('config-name');
        const emailInput = document.getElementById('config-email');
        const phoneInput = document.getElementById('config-phone');
        
        let valid = true;
        
        [nameInput, emailInput, phoneInput].forEach(inp => {
          if (!inp.value.trim() || (inp.type === 'email' && !inp.validity.valid)) {
            inp.classList.add('invalid');
            const err = inp.closest('.form-group')?.querySelector('.field-error');
            if (err) err.textContent = inp.type === 'email' ? 'Please enter a valid email address.' : 'This field is required.';
            valid = false;
          } else {
            inp.classList.remove('invalid');
            const err = inp.closest('.form-group')?.querySelector('.field-error');
            if (err) err.textContent = '';
          }
        });
        
        if (!valid) return;
        
        nextBtn.disabled = true;
        nextBtn.textContent = 'Sending...';
        
        const profile = getSelectedProfile();
        const checkedServices = serviceDatabase[profile]
          .filter(opt => opt.checked)
          .map(opt => opt.label)
          .join(', ');
        
        const selectedPlanObj = plansDatabase[profile].find(p => p.checked) || plansDatabase[profile][0];
        const selectedPlanName = selectedPlanObj ? selectedPlanObj.name : 'None selected';
        
        const messageBody = `
Interactive Solution Configurator Lead:
------------------------------------------
Profile Type: ${profile.toUpperCase()}
Requested Cover Level / Plan: ${selectedPlanName}
Selected Services: ${checkedServices || 'None selected'}

Contact Information:
Name: ${nameInput.value}
Email: ${emailInput.value}
Phone: ${phoneInput.value}
        `;
        
        const formData = new FormData();
        formData.append('access_key', '2a16637d-d967-4413-9f4f-a87205271ec3');
        formData.append('subject', `New Interactive IT Lead [${profile.toUpperCase()}] – OS Technology`);
        formData.append('name', nameInput.value);
        formData.append('email', emailInput.value);
        formData.append('phone', phoneInput.value);
        formData.append('message', messageBody);
        
        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: formData
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              const currentProfile = getSelectedProfile();
              if (currentProfile === 'business') {
                if (successTitle) successTitle.textContent = "Request Received!";
                if (successDesc) successDesc.textContent = "Thank you! We have received your custom plan preferences. We will be in touch ASAP!";
              } else {
                if (successTitle) successTitle.textContent = "Request Received!";
                if (successDesc) successDesc.textContent = "Thank you! We have received your request. We will be in touch ASAP!";
              }
              successOverlay.style.display = 'flex';
              gtagSendEvent();
              configForm.reset();
              // Reset databases
              serviceDatabase.business.forEach(s => s.checked = (s.id === 'm365' || s.id === 'helpdesk'));
              serviceDatabase.home.forEach(s => s.checked = (s.id === 'monitoring' || s.id === 'support' || s.id === 'security_home'));
              plansDatabase.business.forEach(p => p.checked = (p.id === 'standard'));
              plansDatabase.home.forEach((p, idx) => p.checked = (idx === 0));
            } else {
              alert('Something went wrong. Please check your network and try again, or use the direct contact form below.');
            }
          })
          .catch(() => {
            alert('Something went wrong. Please check your network and try again, or use the direct contact form below.');
          })
          .finally(() => {
            nextBtn.disabled = false;
            const currentProfile = getSelectedProfile();
            if (currentProfile === 'business') {
              nextBtn.innerHTML = 'Request Callback <i data-lucide="send"></i>';
            } else {
              nextBtn.innerHTML = 'Get Help Now <i data-lucide="zap"></i>';
            }
          });
      }
    });

    prevBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        showStep(currentStep - 1);
      }
    });

    resetBtn.addEventListener('click', () => {
      successOverlay.style.display = 'none';
      currentStep = 1;
      showStep(1);
    });

    const profileRadios = configForm.querySelectorAll('input[name="profile_type"]');
    profileRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        configForm.querySelectorAll('input').forEach(inp => inp.classList.remove('invalid'));
      });
    });
  }

  /* ============================================================
     MOUSE-RESPONSIVE VISUAL EFFECTS
     (hero cursor glow + grid parallax, cursor spotlight on cards)
     ============================================================ */
  (function () {
    /* Purely decorative — skip entirely for reduced-motion users and
       for touch/coarse pointers (no hover, and no point in paying the
       listener cost on devices that can't benefit). */
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer  = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion || !finePointer) return;

    const hero = document.querySelector('.hero');
    const SPOT_SELECTOR = '.service-card, .pricing-card, .feature, ' +
      '.related-card, .included-item, .compare-card, .process-step';

    const HERO_SHIFT_MAX = 14; /* px – max grid parallax shift */

    let lastEvent = null;
    let ticking = false;

    function updateHero(clientX, clientY) {
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right &&
                     clientY >= rect.top && clientY <= rect.bottom;
      if (!inside) return;

      const mx = ((clientX - rect.left) / rect.width) * 100;
      const my = ((clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty('--hero-mx', mx.toFixed(2) + '%');
      hero.style.setProperty('--hero-my', my.toFixed(2) + '%');

      const relX = Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
      const relY = Math.max(-1, Math.min(1, (clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
      hero.style.setProperty('--grid-x', (relX * HERO_SHIFT_MAX).toFixed(1) + 'px');
      hero.style.setProperty('--grid-y', (relY * HERO_SHIFT_MAX).toFixed(1) + 'px');
    }

    function updateSpotlight(target, clientX, clientY) {
      const card = target instanceof Element ? target.closest(SPOT_SELECTOR) : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', (clientX - rect.left) + 'px');
      card.style.setProperty('--spot-y', (clientY - rect.top) + 'px');
    }

    function onFrame() {
      ticking = false;
      if (!lastEvent) return;
      updateHero(lastEvent.clientX, lastEvent.clientY);
      updateSpotlight(lastEvent.target, lastEvent.clientX, lastEvent.clientY);
    }

    window.addEventListener('pointermove', (e) => {
      lastEvent = e;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onFrame);
      }
    }, { passive: true });

    if (hero) {
      hero.addEventListener('pointerleave', () => {
        hero.style.removeProperty('--hero-mx');
        hero.style.removeProperty('--hero-my');
        hero.style.removeProperty('--grid-x');
        hero.style.removeProperty('--grid-y');
      });
    }
  })();

})();
