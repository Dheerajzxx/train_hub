/* ============================================================
   Training Institute - Main JavaScript
   Features: Sticky Header, Mobile Menu, Animations, etc.
   ============================================================ */

'use strict';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {

  // ============================================================
  // Dark Mode Toggle
  // ============================================================
  const darkModeToggle = document.getElementById('darkModeToggle');
  const darkModeIcon = darkModeToggle ? darkModeToggle.querySelector('i') : null;

  // Apply saved preference on load
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark-mode');
    if (darkModeIcon) {
      darkModeIcon.className = 'fa-solid fa-sun';
    }
  }

  if (darkModeToggle) {
    // Create theme transition overlay
    var themeOverlay = document.getElementById('theme-overlay');
    if (!themeOverlay) {
      themeOverlay = document.createElement('div');
      themeOverlay.id = 'theme-overlay';
      document.body.appendChild(themeOverlay);
    }

    darkModeToggle.addEventListener('click', function () {
      var html = document.documentElement;
      var isCurrentlyDark = html.classList.contains('dark-mode');
      var goingDark = !isCurrentlyDark;

      // Set overlay color — a neutral mid-tone that works as a transition mask
      themeOverlay.style.background = goingDark ? '#0F172A' : '#FFFFFF';

      // Step 1: Fade overlay in (brief, to mask the color snap)
      themeOverlay.style.opacity = '0.8';

      setTimeout(function () {
        // Step 2: Toggle dark mode class (colors will transition)
        html.classList.toggle('dark-mode');

        // Update icon
        if (darkModeIcon) {
          darkModeIcon.className = goingDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }

        // Persist preference
        localStorage.setItem('theme', goingDark ? 'dark' : 'light');

        // Brief pause to let CSS transitions start
        setTimeout(function () {
          // Step 3: Fade overlay out, revealing the new theme
          themeOverlay.style.opacity = '0';
        }, 80);
      }, 120);
    });

  }

  // ============================================================
  // Preloader
  // ============================================================
  const preloader = document.querySelector('.loading-spinner');
  if (preloader) {
    window.addEventListener('load', function () {
      preloader.classList.add('hidden');
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 500);
    });
  }

  // ============================================================
  // Sticky Header
  // ============================================================
  const navbar = document.querySelector('.main-navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // ============================================================
  // Active Nav Link Highlighting
  // ============================================================
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.main-navbar .nav-link');
  navLinks.forEach(function (link) {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });

  // ============================================================
  // Mobile Menu - Collapse on Link Click
  // ============================================================
  const navbarCollapse = document.querySelector('.navbar-collapse');
  const navLinksMobile = document.querySelectorAll('.navbar-nav .nav-link');
  if (navbarCollapse) {
    navLinksMobile.forEach(function (link) {
      link.addEventListener('click', function () {
        const collapse = bootstrap.Collapse.getInstance(navbarCollapse);
        if (collapse && navbarCollapse.classList.contains('show')) {
          collapse.hide();
        }
      });
    });
  }

  // ============================================================
  // Scroll to Top Button
  // ============================================================
  const scrollTopBtn = document.querySelector('.scroll-top');
  if (scrollTopBtn) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) {
        scrollTopBtn.classList.add('visible');
      } else {
        scrollTopBtn.classList.remove('visible');
      }
    });

    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============================================================
  // Counter Animation (Animated Counters with easing)
  // ============================================================
  function animateCounter(element, target, suffix, duration) {
    suffix = suffix || '';
    duration = duration || 2000;
    const startTime = performance.now();

    // Add active class for entrance animation
    const parent = element.closest('.stat-card');
    if (parent) parent.classList.add('counter-active');

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const currentValue = Math.round(easedProgress * target);

      // Format with commas for large numbers
      element.textContent = currentValue.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = target.toLocaleString() + suffix;
        // Add completion animation
        if (parent) {
          parent.classList.remove('counter-active');
          parent.classList.add('counter-done');
          // Remove done class after animation
          setTimeout(function () {
            parent.classList.remove('counter-done');
          }, 500);
        }
      }
    }

    requestAnimationFrame(update);
  }

  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length > 0) {
    // Use IntersectionObserver for better performance
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const counter = entry.target;
            const target = parseInt(counter.getAttribute('data-target')) || 0;
            const suffix = counter.getAttribute('data-suffix') || '';
            const duration = parseInt(counter.getAttribute('data-duration')) || 2000;
            animateCounter(counter, target, suffix, duration);
            observer.unobserve(counter);
          }
        });
      }, {
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px'
      });

      statNumbers.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      // Fallback: scroll-based detection for older browsers
      let countersAnimated = false;

      function checkCounters() {
        if (countersAnimated) return;
        const statsSection = document.querySelector('.statistics-section');
        if (!statsSection) return;

        const rect = statsSection.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
          countersAnimated = true;
          statNumbers.forEach(function (el) {
            const target = parseInt(el.getAttribute('data-target')) || 0;
            const suffix = el.getAttribute('data-suffix') || '';
            const duration = parseInt(el.getAttribute('data-duration')) || 2000;
            animateCounter(el, target, suffix, duration);
          });
        }
      }

      window.addEventListener('scroll', checkCounters);
      checkCounters();
    }
  }

  // ============================================================
  // Navbar Background (consistent glass look on all pages)
  // ============================================================
  // The navbar keeps its default glass styling at all times so the
  // header looks identical whether the user is at the top of the
  // page or has scrolled down (matching about/courses/contact pages).

  const heroSection = document.querySelector('.hero-section');
  if (!heroSection && navbar) {
    navbar.classList.add('scrolled');
  }

  // ============================================================
  // Initialize Swiper Sliders (if Swiper is loaded)
  // ============================================================
  if (typeof Swiper !== 'undefined') {
    // Hero Slider - full-screen with navigation
    const heroSlider = document.querySelector('.hero-slider');
    if (heroSlider) {
      new Swiper(heroSlider, {
        loop: true,
        autoplay: {
          delay: 6000,
          disableOnInteraction: false
        },
        speed: 800,
        effect: 'fade',
        fadeEffect: {
          crossFade: true
        },
        pagination: {
          el: '.hero-slider .swiper-pagination',
          clickable: true
        },
        navigation: {
          nextEl: '.hero-slider .swiper-button-next',
          prevEl: '.hero-slider .swiper-button-prev'
        },
        // Pause on hover
        on: {
          init: function (swiper) {
            swiper.el.addEventListener('mouseenter', function () {
              swiper.autoplay.stop();
            });
            swiper.el.addEventListener('mouseleave', function () {
              swiper.autoplay.start();
            });
          }
        }
      });
    }

    // Testimonials Carousel - Enhanced
    const testimonialSlider = document.querySelector('.testimonial-slider');
    if (testimonialSlider) {
      const testimonialSwiper = new Swiper(testimonialSlider, {
        loop: true,
        autoplay: {
          delay: 4000,
          disableOnInteraction: false
        },
        speed: 600,
        slidesPerView: 1,
        spaceBetween: 24,
        pagination: {
          el: '.testimonial-slider .swiper-pagination',
          clickable: true
        },
        navigation: {
          nextEl: '.testimonial-slider .testimonial-next',
          prevEl: '.testimonial-slider .testimonial-prev'
        },
        breakpoints: {
          768: { slidesPerView: 2 },
          992: { slidesPerView: 3 }
        },
        // Reset progress bar on each slide change
        on: {
          init: function (swiper) {
            // Pause on hover
            swiper.el.addEventListener('mouseenter', function () {
              swiper.autoplay.stop();
            });
            swiper.el.addEventListener('mouseleave', function () {
              swiper.autoplay.start();
            });

            // Re-trigger progress bar animation
            reTriggerProgress(swiper);
          },
          slideChangeTransitionStart: function (swiper) {
            reTriggerProgress(swiper);
          }
        }
      });

      // Helper to re-trigger the progress bar fill animation
      function reTriggerProgress(swiper) {
        const fill = swiper.el.querySelector('.spb-fill');
        if (fill) {
          fill.style.animation = 'none';
          void fill.offsetWidth;
          fill.style.animation = '';
        }
      }
    }

    // Partners / Logo Scroll (using Swiper)
    const partnerSlider = document.querySelector('.partner-slider');
    if (partnerSlider) {
      new Swiper(partnerSlider, {
        loop: true,
        autoplay: { delay: 2000, disableOnInteraction: false },
        slidesPerView: 2,
        spaceBetween: 30,
        breakpoints: {
          576: { slidesPerView: 3 },
          768: { slidesPerView: 4 },
          992: { slidesPerView: 5 },
          1200: { slidesPerView: 6 }
        }
      });
    }

    // Gallery Slider (if used as slider instead of grid)
    const gallerySlider = document.querySelector('.gallery-slider');
    if (gallerySlider) {
      new Swiper(gallerySlider, {
        loop: true,
        autoplay: { delay: 3000 },
        slidesPerView: 1,
        spaceBetween: 16,
        pagination: {
          el: '.gallery-slider .swiper-pagination',
          clickable: true
        },
        breakpoints: {
          576: { slidesPerView: 2 },
          992: { slidesPerView: 3 }
        }
      });
    }
  }

  // ============================================================
  // Initialize AOS (Animate On Scroll)
  // ============================================================
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80
    });
  }

  // ============================================================
  // Gallery Lightbox
  // ============================================================
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (galleryItems.length > 0) {
    galleryItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const img = this.querySelector('img');
        if (!img) return;
        const src = img.getAttribute('src');
        const modalHtml = `
          <div class="modal fade" id="galleryModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
              <div class="modal-content border-0 bg-dark">
                <div class="modal-body p-0">
                  <img src="${src}" class="w-100" alt="Gallery Image">
                </div>
                <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3" data-bs-dismiss="modal"></button>
              </div>
            </div>
          </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('galleryModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('galleryModal'));
        modal.show();
      });
    });
  }

  // ============================================================
  // Form Validation (shared)
  // ============================================================
  const forms = document.querySelectorAll('.needs-validation');
  forms.forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });

  // ============================================================
  // Smooth Scroll for Anchor Links
  // ============================================================
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ============================================================
  // Course Filter (on courses page)
  // ============================================================
  const filterButtons = document.querySelectorAll('.filter-btn');
  const courseItems = document.querySelectorAll('.course-item');
  const noResults = document.getElementById('noResults');
  const filterStatus = document.getElementById('filterStatus');

  if (filterButtons.length > 0 && courseItems.length > 0) {
    let currentFilter = 'all';
    let animating = false;

    function filterCourses(filter) {
      if (animating || filter === currentFilter) return;
      animating = true;

      // Update button active states
      filterButtons.forEach(function (btn) {
        const isActive = btn.getAttribute('data-filter') === filter;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('btn-primary', isActive);
        btn.classList.toggle('btn-outline-primary', !isActive);
      });

      let visibleCount = 0;

      // First pass: hide non-matching items (instant, no grid gap)
      courseItems.forEach(function (item) {
        const category = item.getAttribute('data-category');
        const matches = filter === 'all' || category === filter;

        if (!matches) {
          item.style.display = 'none';
          item.classList.remove('filter-visible');
        }
      });

      // Second pass: show matching items with animation
      courseItems.forEach(function (item) {
        const category = item.getAttribute('data-category');
        const matches = filter === 'all' || category === filter;

        if (matches) {
          item.style.display = '';
          // Re-trigger animation by removing and re-adding the class
          item.classList.remove('filter-visible');
          // Force reflow so the animation re-triggers
          void item.offsetWidth;
          item.classList.add('filter-visible');
          visibleCount++;
        }
      });

      // Update status text
      if (filterStatus) {
        filterStatus.innerHTML = 'Showing <strong>' + visibleCount + '</strong> ' + (visibleCount === 1 ? 'course' : 'courses');
      }

      // Toggle no results message
      if (noResults) {
        if (visibleCount === 0) {
          noResults.classList.remove('d-none');
        } else {
          noResults.classList.add('d-none');
        }
      }

      currentFilter = filter;

      // Allow animation again after transition completes
      setTimeout(function () {
        animating = false;
      }, 450);
    }

    // Click handler on filter buttons
    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const filter = this.getAttribute('data-filter');
        filterCourses(filter);
      });
    });

    // Reset filter button (in no-results message)
    const resetBtn = document.querySelector('.reset-filter-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        filterCourses('all');
      });
    }
  }

  console.log('Training Institute — JS initialized');
});
