/**
 * PORTFOLIO HERO — main.js
 * ─────────────────────────────────────────────────────────────────
 * • Lenis smooth scroll (desktop only)
 * • GSAP + ScrollTrigger for hero parallax & section reveals
 * • Letter-by-letter name animation on load
 * • Mouse-tracking radial glow (GPU-accelerated transform)
 * • Staggered entrance for badge, subtitle, corner labels
 * ─────────────────────────────────────────────────────────────────
 */

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initHeroBgShader }  from './shader-bg.js';

import './analytics.js'; // Initialize Vercel Analytics and Speed Insights

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────────────────────────
// Touch / mobile detection — gate heavy GPU features
// IS_TOUCH: true on phones/tablets (no hover capability)
// IS_MOBILE: true also on ≤768px desktop windows
// ─────────────────────────────────────────────────────────────────
const IS_TOUCH  = window.matchMedia('(hover: none)').matches;
const IS_MOBILE = IS_TOUCH || window.innerWidth <= 768;

// ─────────────────────────────────────────────────────────────────
// Hero background shader (ring-wave GLSL, behind all hero content)
// Skip on touch devices — WebGL is expensive on mobile GPUs.
// ─────────────────────────────────────────────────────────────────
if (!IS_TOUCH) {
  initHeroBgShader(document.getElementById('heroShaderBg'));
}

// ─────────────────────────────────────────────────────────────────
// Mobile nav pill — tap on logo area → go home
// Excludes: hamburger button, register CTA, any link/button inside
// ─────────────────────────────────────────────────────────────────
(function initMobileNavPillHome() {
  const pill    = document.getElementById('mobileNavPill');
  if (!pill) return;

  pill.addEventListener('click', (e) => {
    // Let any real link/button inside handle itself
    const interactive = e.target.closest('a, button');
    if (interactive) return;
    // Clicking blank space on the pill → go home
    window.location.href = '/';
  });
})();

// ─────────────────────────────────────────────────────────────────
// Custom cursor — arrow-shaped, auto black/white via mix-blend-mode
// Disabled on touch devices (CSS hides it; JS skips listeners too).
// ─────────────────────────────────────────────────────────────────
(function initCursor() {
  if (IS_TOUCH) return; // no mouse on touch devices
  const arrow = document.getElementById('cursorArrow');
  if (!arrow) return;

  // Track mouse — center dot on pointer
  document.addEventListener('mousemove', (e) => {
    arrow.style.left = e.clientX + 'px';
    arrow.style.top  = e.clientY + 'px';
  });

  // Grow on hover over interactive elements
  const targets = 'a, button, [role="button"], .nav-link, .btn-cta, .nav-menu-btn, .icon-btn, .dropdown-item';
  document.querySelectorAll(targets).forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (!arrow.classList.contains('is-name-hover')) arrow.classList.add('is-hovering');
    });
    el.addEventListener('mouseleave', () => arrow.classList.remove('is-hovering'));
  });

  // Large invert circle when hovering hero name
  const heroHeading = document.getElementById('heroHeading');
  if (heroHeading) {
    heroHeading.addEventListener('mouseenter', () => {
      arrow.classList.remove('is-hovering');
      arrow.classList.add('is-name-hover');
    });
    heroHeading.addEventListener('mouseleave', () => {
      arrow.classList.remove('is-name-hover');
    });
  }

  // Fade out when cursor leaves the window
  document.addEventListener('mouseleave', () => { arrow.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { arrow.style.opacity = '1'; });
})();



// ─────────────────────────────────────────────────────────────────
// Lenis smooth scroll — skip on touch (native momentum scroll is better)
// ─────────────────────────────────────────────────────────────────
const lenis = IS_TOUCH ? null : new Lenis({ autoRaf: false });

// Keep ScrollTrigger in sync with Lenis
if (lenis) lenis.on('scroll', ScrollTrigger.update);

// ─────────────────────────────────────────────────────────────────
// Dissolve shader REMOVED — was hidden (display:none) but the
// WebGL renderer still ran every frame, wasting GPU. Fully gutted.
// ─────────────────────────────────────────────────────────────────

// Hide the canvas1 overlay (no longer needed)
const _canvas1 = document.querySelector('.canvas1');
if (_canvas1) { _canvas1.style.display = 'none'; _canvas1.style.pointerEvents = 'none'; }

// ── Resize handler — just refresh ScrollTrigger ─────────────────
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
});

// ─────────────────────────────────────────────────────────────────
// Mouse glow — lerped radial gradient (desktop only)
// Uses GPU-accelerated transform instead of layout-thrashing left/top
// ─────────────────────────────────────────────────────────────────
const glow = document.getElementById('mouseGlow');
let mouseX = window.innerWidth  / 2;
let mouseY = window.innerHeight / 2;
let glowX  = mouseX;
let glowY  = mouseY;

if (!IS_TOUCH && glow) {
  // Position glow at center initially with transform (no left/top)
  glow.style.left = '0';
  glow.style.top  = '0';
  glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}

// Smooth glow follow — only runs on desktop
function tickGlow() {
  if (IS_TOUCH || !glow) return;
  glowX += (mouseX - glowX) * 0.08;
  glowY += (mouseY - glowY) * 0.08;
  // GPU-accelerated: uses transform instead of left/top (no layout recalc)
  glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;
}

// ─────────────────────────────────────────────────────────────────
// Unified ticker — Lenis on GSAP's ticker (single RAF, no double-pump)
// ─────────────────────────────────────────────────────────────────
if (lenis) {
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000); // GSAP ticker time is in seconds, Lenis expects ms
  });
  gsap.ticker.lagSmoothing(0); // prevent GSAP from trying to catch up on lag
}

// Glow follows mouse on its own lightweight RAF (only on desktop)
if (!IS_TOUCH && glow) {
  function glowLoop() {
    tickGlow();
    requestAnimationFrame(glowLoop);
  }
  requestAnimationFrame(glowLoop);
}

// ─────────────────────────────────────────────────────────────────
// Letter-split hero name
// ─────────────────────────────────────────────────────────────────
const NAME     = "UDBHAV'26";
const heroName = document.getElementById('heroHeading');
heroName.setAttribute('aria-label', NAME);

NAME.split('').forEach((char) => {
  const span = document.createElement('span');
  span.className   = 'letter';
  span.textContent = char;
  heroName.appendChild(span);
});

const letters = heroName.querySelectorAll('.letter');

// ─────────────────────────────────────────────────────────────────
// Entrance animation timeline (CSS transitions via JS)
// Chain: letters → subtitle → corners
// ─────────────────────────────────────────────────────────────────
const subtitleSans  = document.querySelector('.subtitle-sans');
const subtitleSerif = document.querySelector('.subtitle-serif');
const heroEyebrow   = document.querySelector('.hero-eyebrow');
const cornerLeft    = document.getElementById('cornerLeft');
const cornerRight   = document.getElementById('cornerRight');

/** Fade + slide up — standard (corners/labels) */
function revealEl(el, delay = 0, yStart = 20) {
  if (!el) return;
  el.style.opacity    = '0';
  el.style.transform  = `translateY(${yStart}px)`;
  el.style.transition = 'none';

  setTimeout(() => {
    el.style.transition = 'opacity 0.72s ease, transform 0.72s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.opacity    = '1';
    el.style.transform  = 'translateY(0)';
  }, delay);
}

/** Fade + slide up + blur-in — used for subtitle lines */
function revealElBlur(el, delay = 0, yStart = 32) {
  if (!el) return;
  el.style.opacity    = '0';
  el.style.transform  = `translateY(${yStart}px)`;
  el.style.filter     = 'blur(10px)';
  el.style.transition = 'none';

  setTimeout(() => {
    el.style.transition =
      'opacity 0.9s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), filter 0.9s ease';
    el.style.opacity    = '1';
    el.style.transform  = 'translateY(0)';
    el.style.filter     = 'blur(0px)';
  }, delay);
}

// Cat wrap — on desktop: blur-in entrance; on mobile: instant show
const heroCatWrap = document.getElementById('heroCatWrap');
if (heroCatWrap) {
  if (IS_MOBILE) {
    heroCatWrap.style.opacity   = '1';
    heroCatWrap.style.transform = '';
    heroCatWrap.style.filter    = '';
  } else {
    heroCatWrap.style.opacity    = '0';
    heroCatWrap.style.transform  = 'translateY(40px)';
    heroCatWrap.style.filter     = 'blur(12px)';
    heroCatWrap.style.transition = 'none';

    setTimeout(() => {
      heroCatWrap.style.transition =
        'opacity 1s ease, transform 1s cubic-bezier(0.16, 1, 0.3, 1), filter 1s ease';
      heroCatWrap.style.opacity   = '1';
      heroCatWrap.style.transform = 'translateY(0)';
      heroCatWrap.style.filter    = 'blur(0px)';
    }, 100);
  }
}

// ── Cat eye tracking + blinking (desktop only — no mouse on touch) ─────────────
(function initCatEyes() {
  if (IS_TOUCH) return; // skip mouse-tracking on touch devices
  const eyeLeft   = document.getElementById('eyeLeft');
  const eyeRight  = document.getElementById('eyeRight');
  const pupilLeft = document.getElementById('pupilLeft');
  const pupilRight= document.getElementById('pupilRight');
  if (!eyeLeft || !eyeRight) return;

  const eyes   = [eyeLeft,   eyeRight];
  const pupils = [pupilLeft, pupilRight];
  const MAX_PX = 6; // max pupil travel from centre

  // Track mouse → move pupils ──────────────────────────────────────
  document.addEventListener('mousemove', (e) => {
    eyes.forEach((eye, i) => {
      const r  = eye.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      const ratio = Math.min(dist, 80) / 80; // normalise 0→1 within 80px
      const px = (dx / (dist || 1)) * MAX_PX * ratio;
      const py = (dy / (dist || 1)) * MAX_PX * ratio;
      pupils[i].style.transform = `translate(${px}px, ${py}px)`;
    });
  });

  // Blinking — random interval between 2.5s and 5s ─────────────────
  function blink() {
    eyes.forEach(eye => {
      eye.classList.add('is-blinking');
      setTimeout(() => eye.classList.remove('is-blinking'), 140);
    });
    setTimeout(blink, 2500 + Math.random() * 2500);
  }
  setTimeout(blink, 1800 + Math.random() * 1500); // first blink after ~2-3s
})();


// Letters — staggered entrance on desktop, instant fade on mobile ──────────────
const LETTER_DUR   = 800;   // ms transition per letter
const LETTER_STAG  = 55;    // ms stagger offset
const LETTERS_START= 400;   // ms — cat appears at 100ms, letters follow at 400ms

if (IS_MOBILE) {
  // Mobile: skip complex stagger — show all letters immediately
  // CSS !important in mobile-perf.css Section F handles this via opacity:1 on .hero-name .letter
  letters.forEach(l => {
    l.style.opacity   = '1';
    l.style.transform = '';
    l.style.filter    = '';
  });
  // Simple fade for subtitle and eyebrow
  setTimeout(() => {
    if (heroEyebrow) { heroEyebrow.style.opacity = '1'; heroEyebrow.style.transform = ''; }
    if (subtitleSans)  { subtitleSans.style.opacity  = '1'; subtitleSans.style.transform  = ''; }
    if (subtitleSerif) { subtitleSerif.style.opacity = '1'; subtitleSerif.style.transform = ''; }
  }, 100);
} else {
  // Desktop: full staggered letter entrance
  letters.forEach((letter, i) => {
    letter.style.opacity    = '0';
    letter.style.transform  = 'translateY(80px) rotate(2deg)';
    letter.style.filter     = 'blur(4px)';
    letter.style.transition = 'none';

    const delay = LETTERS_START + i * LETTER_STAG;
    setTimeout(() => {
      letter.style.transition = `opacity ${LETTER_DUR}ms cubic-bezier(0.16,1,0.3,1),
                                 transform ${LETTER_DUR}ms cubic-bezier(0.16,1,0.3,1),
                                 filter ${LETTER_DUR}ms ease`;
      letter.style.opacity    = '1';
      letter.style.transform  = 'translateY(0) rotate(0deg)';
      letter.style.filter     = 'blur(0px)';
    }, delay);
  });

  // Subtitle lines (blur-in, 500ms after last letter)
  const subtitleStart = LETTERS_START + letters.length * LETTER_STAG + 500;
  if (heroEyebrow) revealElBlur(heroEyebrow,   subtitleStart - 200,  14);
  revealElBlur(subtitleSans,  subtitleStart,       32);
  revealElBlur(subtitleSerif, subtitleStart + 160, 32);

  // Corner labels (last)
  const cornersStart = subtitleStart + 600;
  revealEl(cornerLeft,  cornersStart,      18);
  revealEl(cornerRight, cornersStart + 90, 18);
}

// Dissolve shader fully removed — see import section comment.
if (!IS_TOUCH) heroName.addEventListener('mousemove', (e) => {
  const rect  = heroName.getBoundingClientRect();
  const dx    = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2); // -1 to +1
  const dy    = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);

  letters.forEach((letter, i) => {
    const depth  = ((i / (letters.length - 1)) - 0.5) * 2; // -1→+1
    const shiftX = dx * depth * 7;
    const shiftY = dy * 4;
    letter.style.transition = 'transform 0.15s ease';
    letter.style.transform  = `translate(${shiftX}px, ${shiftY}px)`;
  });
});

if (!IS_TOUCH) heroName.addEventListener('mouseleave', () => {
  letters.forEach(letter => {
    letter.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    letter.style.transform  = 'translate(0, 0)';
  });
});

// ─────────────────────────────────────────────────────────────────
// Navbar — GSAP scroll light theme (fires at 3px scroll)
// Navbar bg stays TRANSPARENT. Only the floating pill + menu
// button animate: dark glass → white frosted glass.
// '.is-light' class on pill flips active/hover fills to black.
// Logo PNG: white → black via brightness filter.
// ─────────────────────────────────────────────────────────────────
const navbar  = document.getElementById('navbar');
const navPill = document.getElementById('navPill');

(function initNavScrollLight() {
  const logoImg = document.getElementById('logoImg');
  const menuBtn = document.getElementById('menuBtn');

  if (!navPill || !logoImg || !menuBtn) return;

  function toLight() {
    // 1. Pill → white frosted glass + elevated shadow
    navPill.classList.add('is-light');
    gsap.to(navPill, {
      backgroundColor: 'rgba(255, 255, 255, 0.90)',
      borderColor: 'rgba(0, 0, 0, 0.06)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
      duration: 0.5,
      ease: 'power3.out',
      overwrite: 'auto',
    });

    // 2. Logo PNG: white → black
    gsap.to(logoImg, {
      filter: 'brightness(0)',
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    // 3. Menu button → white + shadow
    gsap.to(menuBtn, {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(0, 0, 0, 0.07)',
      color: '#111111',
      boxShadow: '0 6px 28px rgba(0,0,0,0.16), 0 1.5px 6px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
      duration: 0.45,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }

  function toDark() {
    // 1. Pill → dark glass
    navPill.classList.remove('is-light');
    gsap.to(navPill, {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderColor: 'rgba(255, 255, 255, 0.10)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.28), 0 1px 6px rgba(0,0,0,0.15)',
      duration: 0.5,
      ease: 'power3.out',
      overwrite: 'auto',
    });

    // 2. Logo → white
    gsap.to(logoImg, {
      filter: 'brightness(1)',
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    // 3. Menu button → dark glass
    gsap.to(menuBtn, {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderColor: 'rgba(255, 255, 255, 0.18)',
      color: '#888888',
      boxShadow: '0 4px 20px rgba(0,0,0,0.28), 0 1px 5px rgba(0,0,0,0.15)',
      duration: 0.45,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }

  // Fire at 3px of scroll → light pill
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top-=3',
    onEnter:     toLight,
    onLeaveBack: toDark,
  });

  // ── About Udbhav + FAQ → keep navbar dark ──
  const aboutEl = document.getElementById('udbhavAbout');
  const faqEl   = document.getElementById('faqSection');

  if (aboutEl) {
    ScrollTrigger.create({
      trigger: aboutEl,
      start: 'top 5%',
      end: 'bottom 5%',
      onEnter: toDark,
      onLeaveBack: toLight,
      onEnterBack: toDark,
      onLeave: toDark
    });
  }

  if (faqEl) {
    ScrollTrigger.create({
      trigger: faqEl,
      start: 'top 5%',
      end: 'bottom 5%',
      onEnter: toDark,
      onLeaveBack: toDark,
      onEnterBack: toDark,
      onLeave: toDark
    });
  }
})();

// ─────────────────────────────────────────────────────────────────
// Navbar scroll transformation (GSAP)
// On first scroll: tagline section wipes right→left (fast),
//                  nav-pill slides smoothly to viewport center.
// Reverses on scroll back to top.
// ───────────────────────────────────────────────────────────────��─
(function initNavScrollTransform() {
  const navDivider  = document.querySelector('.logo-divider');   // ← correct class
  const taglineDot  = document.querySelector('.tagline-dot');
  const logoTagline = document.querySelector('.logo-tagline');
  if (!navbar || !navPill) return;
  if (window.innerWidth <= 768) return; // skip on mobile — pill is already centered

  // Elements that will wipe out (right → left)
  const wipeEls = [logoTagline, taglineDot, navDivider].filter(Boolean);

  // Set starting clipPath so GSAP can animate it smoothly
  gsap.set(wipeEls, { clipPath: 'inset(0 0% 0 0 round 2px)' });

  let transformed = false;

  function transformIn() {
    if (transformed) return;
    transformed = true;

    // 1. Wipe out logo tagline section right→left (fast stagger)
    gsap.to(wipeEls, {
      clipPath: 'inset(0 100% 0 0 round 2px)',
      duration: 0.22,
      ease: 'power3.in',
      stagger: { each: 0.06, from: 'start' }, // divider hits first → tagline last
    });

    // 2. Pill slides to center (after short delay so wipe has started)
    const navRect  = navbar.getBoundingClientRect();
    const pillRect = navPill.getBoundingClientRect();
    const targetX  = (navRect.left + navRect.width / 2)
                   - (pillRect.left + pillRect.width / 2);

    gsap.to(navPill, {
      x: targetX,
      duration: 0.7,
      ease: 'power3.out',
      delay: 0.1,
    });
  }

  function transformOut() {
    if (!transformed) return;
    transformed = false;

    // Pill slides back to its original right position
    gsap.to(navPill, {
      x: 0,
      duration: 0.6,
      ease: 'power3.inOut',
    });

    // Reveal logo tagline section left→right (after pill is moving back)
    gsap.to(wipeEls, {
      clipPath: 'inset(0 0% 0 0 round 2px)',
      duration: 0.3,
      ease: 'power2.out',
      stagger: { each: 0.07, from: 'end' }, // tagline reveals first → divider last
      delay: 0.25,
    });
  }

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top-=80',   // fires after 80px of scroll
    onEnter:     transformIn,
    onLeaveBack: transformOut,
  });
})();



// Active nav link (click)
// Only preventDefault for same-page hash links — let real hrefs navigate freely.
// Skip the nav-more trigger — it's handled by initMoreDropdown below.
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    if (link.classList.contains('nav-more')) return; // handled separately
    const href = link.getAttribute('href') || '';
    const isSamePage = !href || href === '#' || href.startsWith('#');
    if (isSamePage) e.preventDefault();

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

// ─────────────────────────────────────────────────────────────────
// More Dropdown — Radix-style click-to-open with zoom+fade animation
// ─────────────────────────────────────────────────────────────────
(function initMoreDropdown() {
  const trigger  = document.getElementById('nav-more');
  const dropdown = document.getElementById('moreDropdown');
  const wrap     = document.getElementById('navMoreWrap');
  if (!trigger || !dropdown) return;

  let closeTimer = null;

  function openDropdown() {
    clearTimeout(closeTimer);
    dropdown.classList.remove('closing');
    dropdown.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    dropdown.querySelectorAll('.dropdown-item').forEach(i => i.setAttribute('tabindex', '0'));
  }

  function closeDropdown() {
    if (!dropdown.classList.contains('open')) return;
    dropdown.classList.add('closing');
    trigger.setAttribute('aria-expanded', 'false');
    dropdown.querySelectorAll('.dropdown-item').forEach(i => i.setAttribute('tabindex', '-1'));
    closeTimer = setTimeout(() => {
      dropdown.classList.remove('open', 'closing');
    }, 160);
  }

  function toggleDropdown(e) {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  }

  trigger.addEventListener('click', toggleDropdown);

  // Radio selection: mark chosen item, close dropdown
  dropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      dropdown.querySelectorAll('.dropdown-item').forEach(i => i.setAttribute('aria-checked', 'false'));
      item.setAttribute('aria-checked', 'true');
      closeDropdown();
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (wrap && !wrap.contains(e.target)) closeDropdown();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      closeDropdown();
      trigger.focus();
    }
  });

  // Keyboard navigation inside dropdown
  dropdown.addEventListener('keydown', (e) => {
    const items = [...dropdown.querySelectorAll('.dropdown-item')];
    const idx   = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
  });
})();



// ────────────────────────────────────────────────────────────���────
// Menu Overlay — ActionSearchBar (ported from React component)
// Menu button opens a full-screen panel with debounced command search
// ─────────────────────────────────────────────────────────────────
(function initMenuOverlay() {
  const btn      = document.getElementById('menuBtn');
  const overlay  = document.getElementById('menuOverlay');
  const input    = document.getElementById('actionSearchInput');
  const results  = document.getElementById('actionSearchResults');
  const iconEl   = document.getElementById('actionSearchIcon');
  const svg      = btn?.querySelector('.menu-toggle-icon');
  if (!btn || !overlay) return;

  // ── Actions list (portfolio-specific) ──────────────────────────
  const ACTIONS = [
    { id:'1',  label:'Home',              icon:'home',      description:'Back to start',              short:'',   end:'Page',  href:'/',                color:'#60a5fa', external:false },
    { id:'2',  label:'About',             icon:'user',      description:'My story & journey',          short:'',   end:'Page',  href:'/about.html',      color:'#fb923c', external:false },
    { id:'3',  label:'Schedule',          icon:'briefcase', description:'Event schedule',               short:'',   end:'Page',  href:'/work.html',       color:'#a78bfa', external:false },
    { id:'4',  label:'Problem Statement', icon:'pencil',    description:'Hackathon problems',           short:'',   end:'Page',  href:'/blog.html',       color:'#34d399', external:false },
    { id:'5',  label:'Winner',            icon:'grid',      description:'Hackathon winners',            short:'',   end:'Page',  href:'/playground.html', color:'#f59e0b', external:false },
    { id:'6',  label:'Code of Conduct',   icon:'link',      description:'Rules & Guidelines',           short:'',   end:'Page',  href:'/links.html',      color:'#22d3ee', external:false },
    { id:'7',  label:'Uses & Gear',       icon:'monitor',   description:'My setup & tools',             short:'',   end:'Page',  href:'/uses.html',       color:'#e2e8f0', external:false },
    { id:'8',  label:'Sponsors',          icon:'music',     description:'Our partners & supporters',    short:'',   end:'Page',  href:'/jamify.html',     color:'#f59e0b', external:false },
    { id:'9',  label:'Register Now',      icon:'calendar',  description:'Register for UDBHAV\'26',     short:'⌘K', end:'Page',  href:'/register.html',   color:'#8b5cf6', external:false },
  ];

  const SVGS = {
    home:      (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    briefcase: (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    calendar:  (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    github:    (c) => `<svg viewBox="0 0 24 24" fill="${c}"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>`,
    user:      (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    file:      (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    music:     (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    pencil:    (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    grid:      (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    link:      (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    monitor:   (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  };

  const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const ICON_SEND   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  let debounceTimer = null;

  // ── Render helpers ─────────────────────────────────────────────
  function renderActions(list, query) {
    if (!results) return;
    if (list.length === 0) {
      results.innerHTML = `<div class="action-search__empty">No results for "<em>${query}</em>"</div>`;
      return;
    }
    results.innerHTML = `
      <ul class="action-search__list">
        ${list.map((a) => `
          <li class="action-item" data-href="${a.href}" data-ext="${a.external}">
            <div class="action-item__left">
              <div class="action-item__icon">${SVGS[a.icon]?.(a.color) ?? ''}</div>
              <div>
                <div class="action-item__name">${a.label}</div>
                <div class="action-item__desc">${a.description}</div>
              </div>
            </div>
            <div class="action-item__right">
              ${a.short ? `<span class="action-item__short">${a.short}</span>` : ''}
              <span class="action-item__end">${a.end}</span>
            </div>
          </li>`).join('')}
      </ul>
      <div class="action-search__footer">
        <span>Press ⌘K to open</span>
        <span>ESC to close</span>
      </div>`;

    results.querySelectorAll('.action-item').forEach(item => {
      item.addEventListener('click', () => {
        const href = item.dataset.href;
        closeOverlay();
        if (item.dataset.ext === 'true') window.open(href, '_blank', 'noopener');
        else window.location.href = href;
      });
    });
  }

  function filterAndRender(query) {
    const q = query.toLowerCase().trim();
    const list = q ? ACTIONS.filter(a => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) : ACTIONS;
    renderActions(list, query);
  }

  function setIcon(isTyping) {
    if (!iconEl) return;
    iconEl.innerHTML = isTyping ? ICON_SEND : ICON_SEARCH;
  }

  // ── Open / Close ───────────────────────────────────────────────
  function openOverlay() {
    overlay.classList.add('open');
    overlay.removeAttribute('aria-hidden');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close menu');
    svg?.classList.add('open');
    setIcon(false);
    filterAndRender('');
    setTimeout(() => input?.focus(), 250);
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
    svg?.classList.remove('open');
    if (input) input.value = '';
    if (results) results.innerHTML = '';
  }

  btn.addEventListener('click', () => {
    overlay.classList.contains('open') ? closeOverlay() : openOverlay();
  });

  // Mobile menu button also triggers overlay
  const btnMobile = document.getElementById('menuBtnMobile');
  btnMobile?.addEventListener('click', () => {
    overlay.classList.contains('open') ? closeOverlay() : openOverlay();
  });

  // ── Search input ───────────────────────────────────────────────
  input?.addEventListener('input', () => {
    const q = input.value;
    setIcon(q.length > 0);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => filterAndRender(q), 200);
  });

  // ── Keyboard ───────────────────────────────────────────────────
  // Close when clicking outside the popover panel or the button
  document.addEventListener('click', (e) => {
    if (overlay.classList.contains('open') && !overlay.contains(e.target) && !btn.contains(e.target) && !btnMobile?.contains(e.target)) {
      closeOverlay();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) { closeOverlay(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      overlay.classList.contains('open') ? closeOverlay() : openOverlay();
    }
  });

  results?.addEventListener('keydown', (e) => {
    const items = [...(results?.querySelectorAll('.action-item') ?? [])];
    const idx   = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] ?? items[0])?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); (items[idx - 1] ?? items[items.length - 1])?.focus(); }
    if (e.key === 'Enter' && document.activeElement?.classList.contains('action-item')) {
      document.activeElement.click();
    }
  });
})();

// Bento reveal is now owned by the dissolve ScrollTrigger (onLeave / onEnterBack).
// No separate scroll trigger needed here.



// ─────────────────────────────────────────────────────────────────
// WORK SECTION — Infinite-loop GSAP drag slider
// Architecture: 3 identical sets of cards [pre-clones | originals | post-clones]
// We start at x = -(width of pre-clone set) so originals are visible.
// Dragging left → slides into post-clones (same visual) → teleport back.
// Dragging right → slides into pre-clones (same visual) → teleport forward.
// normalise() keeps x in the valid band. nearestSnap() snaps to card edges.
// ─────────────────────────────────────────────────────────────────
(function initWorkSlider() {
  const wrap  = document.getElementById('workSliderWrap');
  const track = document.getElementById('workTrack');
  if (!wrap || !track) return;

  // ── Clone cards for infinite loop ────────────────────────────────
  const origCards = Array.from(track.children);
  const n = origCards.length; // 6

  // Append clones (post-set)
  const postFrag = document.createDocumentFragment();
  origCards.forEach(card => {
    const cl = card.cloneNode(true);
    cl.setAttribute('aria-hidden', 'true');
    cl.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    postFrag.appendChild(cl);
  });
  track.appendChild(postFrag);

  // Prepend clones (pre-set) — insert in same order at the front
  const preFrag = document.createDocumentFragment();
  origCards.forEach(card => {
    const cl = card.cloneNode(true);
    cl.setAttribute('aria-hidden', 'true');
    cl.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    preFrag.appendChild(cl);
  });
  track.insertBefore(preFrag, track.firstChild);

  // Track now has 3n children:
  //   [0..n-1]   = pre-clones
  //   [n..2n-1]  = originals  ← we start here
  //   [2n..3n-1] = post-clones

  let setWidth   = 0;  // pixel width of one set (n cards + gaps)
  let snapPoints = []; // x values where each original card aligns to left of wrap
  let x          = 0; // current translateX
  let isDragging = false;
  let pointerStartX  = 0;
  let trackStartX    = 0;
  let vel            = 0;
  let lastPtrX       = 0;
  let lastPtrTime    = 0;

  // ── Measurement (called after layout, and on resize) ─────────────
  function measure() {
    // setWidth = distance from start of pre-set to start of original set
    const preStart  = track.children[0].offsetLeft;
    const origStart = track.children[n].offsetLeft;
    setWidth = origStart - preStart;
    if (setWidth <= 0) { requestAnimationFrame(measure); return; }

    // Build snap points: x value where each original card's left edge
    // aligns with wrap's left edge (meaning track is shifted -cardLeft).
    snapPoints = [];
    for (let i = n; i < 2 * n; i++) {
      snapPoints.push(-(track.children[i].offsetLeft - preStart));
    }
    // snapPoints are in range [-2*setWidth, -setWidth]

    // Start position: first original card at left edge
    x = snapPoints[0];
    gsap.set(track, { x });
  }

  // ── Keep x in the looping band ───────────────────────────────────
  function normalise(val) {
    while (val > 0)             val -= setWidth;
    while (val < -2 * setWidth) val += setWidth;
    return val;
  }

  // ── Snap to the nearest card position accounting for momentum ────
  function nearestSnap(targetX) {
    // Expand snap points across 3 periods for robust nearest-finding
    const allPts = [];
    snapPoints.forEach(s => {
      allPts.push(s - setWidth, s, s + setWidth);
    });
    let best = allPts[0], bestDist = Infinity;
    allPts.forEach(pt => {
      const d = Math.abs(targetX - pt);
      if (d < bestDist) { bestDist = d; best = pt; }
    });
    return normalise(best);
  }

  // ── Pointer helpers ───────────────────────────────────────────────
  function onDown(cx) {
    isDragging = true;
    gsap.killTweensOf(track);
    pointerStartX = cx;
    trackStartX   = gsap.getProperty(track, 'x');
    vel           = 0;
    lastPtrX      = cx;
    lastPtrTime   = performance.now();
    wrap.classList.add('is-dragging');
  }

  function onMove(cx) {
    if (!isDragging) return;
    const now = performance.now();
    const dt  = Math.max(now - lastPtrTime, 1);
    vel       = (cx - lastPtrX) / dt * 16; // pixels per frame ~16ms
    lastPtrX      = cx;
    lastPtrTime   = now;
    x = normalise(trackStartX + (cx - pointerStartX));
    gsap.set(track, { x });
  }

  function onUp() {
    if (!isDragging) return;
    isDragging = false;
    wrap.classList.remove('is-dragging');

    // Momentum: project forward by vel * ~10 frames, then snap
    const target = nearestSnap(x + vel * 10);
    gsap.to(track, {
      x: target,
      duration: 0.75,
      ease: 'power3.out',
      onUpdate: () => { x = gsap.getProperty(track, 'x'); },
      onComplete: () => { x = target; },
    });
  }

  // ── Mouse events ──────────────────────────────────────────────────
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    onDown(e.clientX);
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => onMove(e.clientX));
  window.addEventListener('mouseup', onUp);

  // ── Touch events ──────────────────────────────────────────────────
  wrap.addEventListener('touchstart', e => {
    onDown(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (isDragging) {
      onMove(e.touches[0].clientX);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('touchend', onUp);

  // ── Prevent accidental link clicks after a drag ───────────────────
  wrap.addEventListener('click', e => {
    if (Math.abs(gsap.getProperty(track, 'x') - trackStartX) > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ── Fade hint out after first drag ───────────────────────────────
  const hint = document.getElementById('workSliderHint');
  wrap.addEventListener('mousedown', () => {
    if (hint) gsap.to(hint, { opacity: 0, duration: 0.4, pointerEvents: 'none' });
  }, { once: true });

  // ── Resize ───────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    gsap.killTweensOf(track);
    requestAnimationFrame(measure);
  });

  // ── Init after two rAF passes (ensures flex layout has settled) ───
  requestAnimationFrame(() => requestAnimationFrame(measure));
})();

// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// CINEMATIC FOOTER — GSAP ScrollTrigger animations + Magnetic pills
// ─────────────────────────────────────────────────────────────────
(function initCinematicFooter() {
  const wrapper  = document.getElementById('cinematicFooterWrapper');
  const giantTxt = document.getElementById('cfGiantText');
  const center   = document.getElementById('cfCenter');

  if (!wrapper || !giantTxt || !center) return;

  // 1. Giant background text parallax ──────────────────────────────────
  gsap.fromTo(
    giantTxt,
    { y: '15vh', scale: 0.85, opacity: 0 },
    {
      y: '0vh',
      scale: 1,
      opacity: 1,
      ease: 'power1.out',
      scrollTrigger: {
        trigger: wrapper,
        start: 'top bottom',
        end:   'top 0%',
        scrub: 1.5,
      },
    }
  );

  // 2. Centre content (heading + links) scroll reveal ───────────────────
  gsap.fromTo(
    center,
    { y: 70, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: wrapper,
        start: 'top 60%',
        end:   'top -20%',
        scrub: 1,
      },
    }
  );

  // 3. Back to top button ───────────────────────────────────────────
  const backToTopBtn = document.getElementById('cfBackToTop');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 4. Magnetic pill effect (GSAP 3D tilt) ─────────────────────────
  //    Applied to every element with class .js-magnetic inside the footer.
  document.querySelectorAll('#cinematicFooter .js-magnetic').forEach((el) => {
    const handleMove = (e) => {
      const rect = el.getBoundingClientRect();
      const halfW = rect.width  / 2;
      const halfH = rect.height / 2;
      const x = e.clientX - rect.left  - halfW;
      const y = e.clientY - rect.top   - halfH;

      gsap.to(el, {
        x: x * 0.38,
        y: y * 0.38,
        rotationX: -y * 0.14,
        rotationY:  x * 0.14,
        scale: 1.06,
        ease: 'power2.out',
        duration: 0.4,
        overwrite: 'auto',
      });
    };

    const handleLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        ease: 'elastic.out(1, 0.3)',
        duration: 1.2,
        overwrite: 'auto',
      });
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
  });

  // 5. Load 'Plus Jakarta Sans' for footer font ─────────────────────
  //    (Injected lazily so it doesn't block the initial page render)
  if (!document.getElementById('cf-jakarta-font')) {
    const link = document.createElement('link');
    link.id   = 'cf-jakarta-font';
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }
})();

// ─────────────────────────────────────────────────────────────────
// Marquee — slow on hover, restart from start on leave + tooltip
// ─────────────────────────────────────────────────────────────────
(function initMarqueeTooltip() {
  const section = document.getElementById('marqueeSection');
  const tooltip = document.getElementById('marqueeTooltip');
  const wrap    = section && section.querySelector('.marquee-track-wrap');
  if (!section || !tooltip || !wrap) return;

  const normalSpeed = '28s';
  const slowSpeed   = '90s';   // slows on hover

  let mx = 0, my = 0;
  let tx = 0, ty = 0;
  let rafId = null;
  const maxRot = 8;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tickTooltip() {
    tx = lerp(tx, mx, 0.12);
    ty = lerp(ty, my, 0.12);
    const mid  = window.innerWidth / 2;
    const dist = (tx - mid) / mid;
    const rot  = dist * maxRot;
    tooltip.style.left      = `${tx}px`;
    tooltip.style.top       = `${ty}px`;
    tooltip.style.transform = `translate(-50%, -160%) rotate(${rot}deg)`;
    rafId = requestAnimationFrame(tickTooltip);
  }

  section.addEventListener('mouseenter', () => {
    // Slow the loop
    wrap.style.animationDuration = slowSpeed;
    // Show tooltip
    tooltip.classList.add('visible');
    rafId = requestAnimationFrame(tickTooltip);
  });

  section.addEventListener('mouseleave', () => {
    // Hide tooltip
    tooltip.classList.remove('visible');
    cancelAnimationFrame(rafId);

    // Reset animation to start from beginning at normal speed
    wrap.style.animation = 'none';
    wrap.offsetHeight;   // force reflow — flushes the removal
    wrap.style.animation = `marqueeScroll ${normalSpeed} linear infinite`;
  });

  section.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  });
})();

// ─────────────────────────────────────────────────────────────────
// LOOPING WORDS — About section top-right corner (v2)
// Container shows 3 words: prev (blurred/faded) | CURRENT | next (blurred/faded)
// Selector brackets resize to match current word's pixel width.
// yPercent formula: -(wordHeight * (idx-1)) keeps idx in CENTER slot.
// ─────────────────────────────────────────────────────────────────
(function initLoopingWords() {
  const wordList = document.getElementById('ulwList');
  const sel      = document.getElementById('ulwSel');
  if (!wordList || !sel || typeof gsap === 'undefined') return;

  const totalWords = wordList.children.length;
  const wordHeight = 100 / totalWords; // % of list height per word

  // Start at index 1 so word[0] peeks above, word[1] is centered, word[2] peeks below
  let currentIdx = 1;

  // ── Resize selector brackets to match current center word ────────
  function updateSel() {
    const centered = wordList.children[currentIdx];
    if (!centered) return;
    const wordEl  = centered.querySelector('.ulw-word') || centered;
    const wordPx  = wordEl.getBoundingClientRect().width;
    gsap.to(sel, { width: wordPx + 'px', duration: 0.5, ease: 'expo.out' });
  }

  // ── Scroll list so currentIdx sits in center slot ────────────────
  // yPercent = -(wordHeight * (currentIdx - 1))
  // When idx=1: yPercent=0       → items [0,1,2] → center = item 1 ✓
  // When idx=2: yPercent=-wh     → items [1,2,3] → center = item 2 ✓
  // When idx=3: yPercent=-2*wh   → items [2,3,4] → center = item 3 ✓
  function moveWords() {
    currentIdx++;
    gsap.to(wordList, {
      yPercent: -(wordHeight * (currentIdx - 1)),
      duration: 1.2,
      ease: 'elastic.out(1, 0.85)',
      onStart: updateSel,
      onComplete() {
        // Infinite loop: when near the end, append first child & snap back
        if (currentIdx >= totalWords - 2) {
          wordList.appendChild(wordList.children[0]);
          currentIdx--;
          gsap.set(wordList, { yPercent: -(wordHeight * (currentIdx - 1)) });
        }
      },
    });
  }

  // Set initial selector width and kick off the loop
  gsap.set(wordList, { yPercent: 0 }); // start showing items [0,1,2]
  // Wait for layout to settle before measuring word width
  requestAnimationFrame(() => {
    updateSel();
    gsap.timeline({ repeat: -1, delay: 1.8 })
      .call(moveWords)
      .to({}, { duration: 2.2 });
  });
})();

// ─────────────────────────────────────────────────────────────────
// About section — ethereal hue-rotate
// REPLACED: Was using requestAnimationFrame to mutate SVG attribute
// 60×/sec (very expensive). Now driven by CSS @keyframes animation
// on .ua-ethereal-inner (see style.css) — runs on compositor thread.
// The JS IntersectionObserver pause is no longer needed since CSS
// animations are automatically paused by the browser when off-screen
// via content-visibility: auto on the section.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// FAQ section — Accordion logic
// ─────────────────────────────────────────────────────────────────
(function initFaq() {
  const questions = document.querySelectorAll('.faq-question');
  if (!questions.length) return;

  questions.forEach(btn => {
    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      
      // Close all other accordions first (optional but keeps things clean)
      questions.forEach(q => q.setAttribute('aria-expanded', 'false'));
      
      // Toggle the clicked one
      btn.setAttribute('aria-expanded', !isExpanded);
    });
  });
})();
// -----------------------------------------------------------------
// PROBLEM DOMAINS — Interactive Track Selector
// Left sidebar track buttons → center image + right description
// Smooth GSAP transitions on click, 3D tilt on image hover
// -----------------------------------------------------------------
(function initTrackSelector() {
  const sidebar  = document.getElementById('pdtSidebar');
  const imgEl    = document.getElementById('pdtImage');
  const titleEl  = document.getElementById('pdtImageTitle');
  const descEl   = document.getElementById('pdtInfoDesc');
  const tagsEl   = document.getElementById('pdtInfoTags');
  const frameEl  = document.getElementById('pdtImageFrame');
  const infoEl   = document.getElementById('pdtInfo');
  if (!sidebar || !imgEl) return;

  const DOMAINS = [
    {
      label: 'HealthTech', title: 'HEALTHTECH',
      image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=640&h=640&fit=crop&auto=format',
      desc: 'Tackle real challenges in healthcare delivery, remote diagnostics, patient monitoring, and medical data management.',
      tags: ['Remote Health', 'Diagnostics', 'Wearables'],
      clr: '#f43f5e',
    },
    {
      label: 'AI / ML', title: 'AI / ML',
      image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=640&h=640&fit=crop&auto=format',
      desc: 'Build intelligent systems that learn, predict and automate — from NLP to computer vision and predictive analytics.',
      tags: ['NLP', 'Computer Vision', 'Neural Nets'],
      clr: '#a855f7',
    },
    {
      label: 'Smart Cities', title: 'SMART CITIES',
      image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=640&h=640&fit=crop&auto=format',
      desc: 'Design connected solutions for urban infrastructure — smart traffic, energy grids, and public safety systems.',
      tags: ['IoT Sensors', 'Traffic AI', 'Energy Grid'],
      clr: '#22d3ee',
    },
    {
      label: 'GreenTech', title: 'GREENTECH',
      image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=640&h=640&fit=crop&auto=format',
      desc: 'Engineer eco-friendly solutions targeting climate change, carbon tracking, clean energy, and sustainable agriculture.',
      tags: ['Carbon Track', 'Clean Energy', 'AgriTech'],
      clr: '#22c55e',
    },
    {
      label: 'EdTech', title: 'EDTECH',
      image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=640&h=640&fit=crop&auto=format',
      desc: 'Reimagine how people learn — adaptive platforms, vernacular tools, and AI-powered career guidance for the next billion.',
      tags: ['Adaptive Learn', 'Vernacular AI', 'AR / VR'],
      clr: '#f59e0b',
    },
    {
      label: 'FinTech', title: 'FINTECH',
      image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=640&h=640&fit=crop&auto=format',
      desc: 'Build the future of finance — DeFi apps, smart contracts, digital wallets, fraud detection, and financial inclusion.',
      tags: ['DeFi', 'Smart Contracts', 'Fraud AI'],
      clr: '#3b82f6',
    },
    {
      label: 'CyberSec', title: 'CYBERSEC',
      image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=640&h=640&fit=crop&auto=format',
      desc: 'Defend digital systems against evolving threats — zero-trust architectures, threat intelligence, and privacy-first tools.',
      tags: ['Zero Trust', 'Threat Intel', 'Privacy Tools'],
      clr: '#f97316',
    },
    {
      label: 'Social Impact', title: 'SOCIAL IMPACT',
      image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=640&h=640&fit=crop&auto=format',
      desc: 'Bridge the urban-rural divide — digital governance, farmer tech, women safety systems, and accessibility solutions.',
      tags: ['Digital Gov', 'AgriTech', 'Accessibility'],
      clr: '#ec4899',
    },
  ];

  let activeIdx = 0;
  let isAnimating = false;
  const btns = sidebar.querySelectorAll('.pdt-track-btn');

  function switchTrack(newIdx) {
    if (newIdx === activeIdx || isAnimating) return;
    isAnimating = true;
    const domain = DOMAINS[newIdx];

    // Deactivate old button
    btns[activeIdx].classList.remove('is-active');
    // Activate new button
    btns[newIdx].classList.add('is-active');

    // Animate image & text out, swap content, animate in
    const tl = gsap.timeline({
      onComplete: () => {
        activeIdx = newIdx;
        isAnimating = false;
      }
    });

    // 1. Fade out image + info
    tl.to(imgEl, {
      opacity: 0,
      scale: 0.92,
      duration: 0.3,
      ease: 'power2.in',
    }, 0);

    tl.to(titleEl, {
      opacity: 0,
      y: -15,
      duration: 0.25,
      ease: 'power2.in',
    }, 0);

    tl.to(descEl, {
      opacity: 0,
      x: 20,
      duration: 0.25,
      ease: 'power2.in',
    }, 0.05);

    tl.to(tagsEl, {
      opacity: 0,
      y: 10,
      duration: 0.2,
      ease: 'power2.in',
    }, 0.1);

    // 2. Swap content (at midpoint)
    tl.call(() => {
      imgEl.src = domain.image;
      imgEl.alt = domain.label;
      titleEl.textContent = domain.title;
      descEl.textContent = domain.desc;
      tagsEl.innerHTML = domain.tags.map(t => `<span>${t}</span>`).join('');

      // Update image frame border color
      frameEl.style.borderColor = `color-mix(in srgb, ${domain.clr} 25%, transparent)`;
    }, null, '+=0');

    // 3. Fade in image + info
    tl.fromTo(imgEl, {
      opacity: 0,
      scale: 1.06,
    }, {
      opacity: 1,
      scale: 1,
      duration: 0.45,
      ease: 'power2.out',
    });

    tl.fromTo(titleEl, {
      opacity: 0,
      y: 15,
    }, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: 'power3.out',
    }, '<+=0.1');

    tl.fromTo(descEl, {
      opacity: 0,
      x: -20,
    }, {
      opacity: 1,
      x: 0,
      duration: 0.45,
      ease: 'power3.out',
    }, '<+=0.05');

    tl.fromTo(tagsEl, {
      opacity: 0,
      y: 12,
    }, {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: 'power3.out',
    }, '<+=0.05');
  }

  // Bind click events
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.pdtIdx, 10);
      switchTrack(idx);
    });
  });

  // 3D tilt effect on image frame hover
  if (frameEl) {
    const wrapEl = document.getElementById('pdtImageWrap');
    if (wrapEl) {
      wrapEl.addEventListener('mousemove', (e) => {
        const rect = frameEl.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(frameEl, {
          rotationY: x * 12,
          rotationX: -y * 8,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });

      wrapEl.addEventListener('mouseleave', () => {
        gsap.to(frameEl, {
          rotationY: 0,
          rotationX: 0,
          duration: 0.8,
          ease: 'elastic.out(1, 0.4)',
          overwrite: 'auto',
        });
      });
    }
  }
})();


(function initScheduleGSAP() {
  const section = document.getElementById('scheduleSection');
  if (!section) return;

  // Animate each timeline row — left rows from left, right rows from right
  const rows = section.querySelectorAll('.schtl-row');
  rows.forEach((row, i) => {
    const isLeft = row.classList.contains('schtl-row--left');
    const fromX = isLeft ? -50 : 50;

    gsap.fromTo(row,
      { opacity: 0, x: fromX },
      {
        opacity: 1,
        x: 0,
        duration: 0.85,
        ease: 'power3.out',
        delay: i * 0.05,
        scrollTrigger: {
          trigger: row,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        }
      }
    );
  });

  // Fallback: also animate any old sch-phase-block elements if they exist (mobile might reuse them)
  const phaseBlocks = section.querySelectorAll('.sch-phase-block');
  phaseBlocks.forEach((block) => {
    const label = block.querySelector('.sch-phase-label');
    if (!label) return;

    gsap.fromTo(label,
      { opacity: 0, x: -40 },
      {
        opacity: 1,
        x: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: block,
          start: 'top 82%',
          toggleActions: 'play none none reverse',
        }
      }
    );
  });

  const items = section.querySelectorAll('[data-sch-item]:not(.schtl-row)');
  items.forEach((item, i) => {
    const delay = (i % 5) * 0.05;

    gsap.fromTo(item,
      { opacity: 0, x: -28, y: 6 },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: 0.65,
        ease: 'power2.out',
        delay,
        scrollTrigger: {
          trigger: item,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        }
      }
    );
  });
})();

// ─────────────────────────────────────────────────────────────────
// GEMINI SVG LINES — scroll-driven path-drawing effect
//
// How it works (same mechanism as framer-motion's pathLength):
//   • Each <path> has pathLength="1" which normalises its length to 1 unit
//   • CSS sets stroke-dasharray: 1  →  one dash = the full path
//   • stroke-dashoffset controls how much is hidden:
//       offset  1.0 = fully hidden
//       offset  0.0 = fully drawn
//       offset -0.2 = overdrawing 20% past the end (ensures clean finish)
//   • GSAP ScrollTrigger with scrub animates from per-path initial offset
//     to -0.2 as the section scrolls through the viewport
// ─────────────────────────────────────────────────────────────────
(function initGeminiEffect() {
  const section = document.getElementById('geminiSection');
  if (!section) return;

  const paths = section.querySelectorAll('.gemini-path');

  // Set initial dashoffset values from data attributes BEFORE first paint
  // so there's no flash of fully-drawn paths
  paths.forEach(path => {
    const init = parseFloat(path.dataset.init ?? '1');
    path.style.strokeDashoffset = init;
  });

  // Single pinned timeline — section stays fixed in viewport while scroll
  // accumulates in the pinSpacing spacer (the "ghost scroll" effect).
  // All paths animate in parallel (position 0) driven by one ScrollTrigger.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',      // pin fires when section reaches viewport top
      end: '+=2500',         // 2500px of ghost scroll = animation distance
      pin: true,             // freeze section in place while scrolling
      pinSpacing: true,      // GSAP inserts a spacer to keep page flow intact
      scrub: 0.6,            // smooth scrub feel
      anticipatePin: 1,      // prevents jitter when pin engages
    }
  });

  paths.forEach(path => {
    const init = parseFloat(path.dataset.init ?? '1');
    tl.fromTo(
      path,
      { strokeDashoffset: init },
      { strokeDashoffset: -0.2, ease: 'none' },
      0  // all paths start at the same moment in the timeline
    );
  });
})();

// ─────────────────────────────────────────────────────────────────
// HERO — Countdown Timer (counts to 25 Apr 2026 11:00 AM IST)
// IST = UTC+5:30  →  target UTC = 2026-04-25T05:30:00Z
// When event is live / elapsed: shows "LIVE 🚀" in all digits.
// ─────────────────────────────────────────────────────────────────
(function initCountdown() {
  const TARGET   = new Date('2026-04-25T05:30:00Z'); // 11:00 AM IST
  const daysEl   = document.getElementById('hcdDays');
  const hoursEl  = document.getElementById('hcdHours');
  const minsEl   = document.getElementById('hcdMins');
  const secsEl   = document.getElementById('hcdSecs');
  const timerEl  = document.getElementById('hcdTimer');
  if (!daysEl) return;

  function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

  function tick() {
    const diff = TARGET - Date.now();
    if (diff <= 0) {
      // Event is live / over
      daysEl.textContent = hoursEl.textContent = minsEl.textContent = secsEl.textContent = '00';
      timerEl?.classList.add('is-live');
      return; // stop ticking
    }

    const totalSecs = Math.floor(diff / 1000);
    const days  = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins  = Math.floor((totalSecs % 3600)  / 60);
    const secs  = totalSecs % 60;

    daysEl.textContent  = pad(days);
    hoursEl.textContent = pad(hours);
    minsEl.textContent  = pad(mins);
    secsEl.textContent  = pad(secs);

    setTimeout(tick, 1000);
  }

  tick();
})();

// ─────────────────────────────────────────────────────────────────
// Prize Cards — Scroll-triggered height expand + text reveal
// ─────────────────────────────────────────────────────────────────
(function initPrizeReveal() {
  const cards = document.querySelectorAll('.prz-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // All cards expand at the same time
        cards.forEach((card) => {
          card.classList.add('prz-revealed');
        });
        observer.disconnect();
      }
    });
  }, { threshold: 0.6, rootMargin: '0px 0px -150px 0px' });

  // Observe the podium container
  const podium = document.querySelector('.prz-podium');
  if (podium) observer.observe(podium);
})();
