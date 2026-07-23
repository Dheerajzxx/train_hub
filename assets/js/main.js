/* ============================================================
   Training Institute - Main JavaScript
   Features: Sticky Header, Mobile Menu, Animations, etc.
   ============================================================ */

'use strict';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {

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
  // Counter Animation (triggered when in view)
  // ============================================================
  function animateCounter(element, target, suffix) {
    suffix = suffix || '';
    let current = 0;
    const increment = Math.ceil(target / 60);
    const timer = setInterval(function () {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      element.textContent = current.toLocaleString() + suffix;
    }, 25);
  }

  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length > 0) {
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
          animateCounter(el, target, suffix);
        });
      }
    }

    window.addEventListener('scroll', checkCounters);
    checkCounters(); // Check on load
  }

  // ============================================================
  // Navbar Background on Hero Transparency Toggle
  // ============================================================
  // Handled by the scroll listener above.
  // Add transparent class if nav is over hero
  const heroSection = document.querySelector('.hero-section');
  if (heroSection && navbar) {
    // Initial check - if we're at the top of the page
    if (window.scrollY < 50) {
      navbar.style.background = 'rgba(255, 255, 255, 0.1)';
      navbar.style.backdropFilter = 'blur(0px)';
      navbar.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

      // Make brand and links white when over hero
      const brand = navbar.querySelector('.navbar-brand');
      const navLinkEls = navbar.querySelectorAll('.nav-link');
      if (brand) brand.style.color = '#fff';
      navLinkEls.forEach(function (l) {
        if (!l.classList.contains('active')) {
          l.style.color = 'rgba(255,255,255,0.85)';
        } else {
          l.style.color = '#FFC107';
        }
      });
    }

    // Override on scroll to restore
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        navbar.style.background = '';
        navbar.style.backdropFilter = '';
        navbar.style.borderBottom = '';
        const brand = navbar.querySelector('.navbar-brand');
        const navLinkEls = navbar.querySelectorAll('.nav-link');
        if (brand) brand.style.color = '';
        navLinkEls.forEach(function (l) {
          l.style.color = '';
        });
      } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.1)';
        navbar.style.backdropFilter = 'blur(0px)';
        navbar.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        const brand = navbar.querySelector('.navbar-brand');
        const navLinkEls = navbar.querySelectorAll('.nav-link');
        if (brand) brand.style.color = '#fff';
        navLinkEls.forEach(function (l) {
          if (!l.classList.contains('active')) {
            l.style.color = 'rgba(255,255,255,0.85)';
          } else {
            l.style.color = '#FFC107';
          }
        });
      }
    });
  }

  // ============================================================
  // Initialize Swiper Sliders (if Swiper is loaded)
  // ============================================================
  if (typeof Swiper !== 'undefined') {
    // Hero Slider
    const heroSlider = document.querySelector('.hero-slider');
    if (heroSlider) {
      new Swiper(heroSlider, {
        loop: true,
        autoplay: { delay: 5000 },
        effect: 'fade',
        pagination: {
          el: '.hero-slider .swiper-pagination',
          clickable: true
        }
      });
    }

    // Testimonials Carousel
    const testimonialSlider = document.querySelector('.testimonial-slider');
    if (testimonialSlider) {
      new Swiper(testimonialSlider, {
        loop: true,
        autoplay: { delay: 4000 },
        slidesPerView: 1,
        spaceBetween: 24,
        pagination: {
          el: '.testimonial-slider .swiper-pagination',
          clickable: true
        },
        breakpoints: {
          768: { slidesPerView: 2 },
          992: { slidesPerView: 3 }
        }
      });
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
  // Navbar Transparency Toggle (for inner pages without hero)
  // ============================================================
  // If there's no hero section, ensure navbar has solid background
  if (!heroSection && navbar) {
    navbar.style.background = '';
    navbar.style.backdropFilter = '';
    navbar.classList.add('scrolled');
  }

  console.log('Training Institute — JS initialized');
});
