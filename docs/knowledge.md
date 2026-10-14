# Training Institute Website

A modern, responsive, multi-page static website for a computer training institute. Built with plain HTML5, CSS3, and JavaScript — no framework, no build step.

## Quickstart

- **No setup required** — this is a pure static site. Open any `.html` file in a browser to preview.
- **Folder structure:** Root-level `.html` pages + `assets/{css,js,images,vendor}/`
- **Live server (recommended for dev):** `npx serve .` or use VS Code Live Server extension on any HTML page.

## Tech Stack

| Layer    | Libraries                                                                 |
| -------- | ------------------------------------------------------------------------- |
| HTML     | Bootstrap 5.3 grid & components, Font Awesome 6 (icons)                   |
| CSS      | Custom `style.css` with glassmorphism, gradients, rounded cards           |
| JS       | Swiper (sliders), AOS (scroll animations), vanilla lightbox & form validation |

## Pages

Home, About, Courses, Course Details, Gallery, Placements, Testimonials, Blog, Contact.

## Architecture

- **Key files:** `assets/css/style.css` (all custom styles), `assets/js/main.js` (all custom JS)
- **Shared components:** Header (top bar + sticky navbar) and Footer are repeated across all HTML pages (no templating engine)
- **Vendor files:** Drop Bootstrap, Swiper, AOS, Font Awesome into `assets/vendor/`
- **Design tokens:** Colors (`#0057D9`, `#00B4D8`, `#FFC107`, `#F5F8FC`, `#1F2937`), font (Poppins via Google Fonts)

## Conventions

- Mobile-first, responsive (breakpoints: 576/768/992/1200px)
- Cards: border-radius 18px, soft shadows, hover lift
- Space sections at 80px padding
- All images go in `assets/images/`
- No package.json — this is a no-build-step project

## Phases

8 phases defined in `Training_Institute_Project_Plan.md` — Phase 1 is project setup (folder structure, header, footer, shared assets).

## Important Docs

- `Training_Institute_Master_Blueprint.md` — full design spec with all page layouts and sections
- `Training_Institute_Project_Plan.md` — detailed plan including colors, typography, responsive breakpoints, and component list
