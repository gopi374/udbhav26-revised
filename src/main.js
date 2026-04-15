/**
 * PORTFOLIO HERO — main.js
 * ─────────────────────────────────────────────────────────────────
 * Merge of:
 *   • Original: Three.js dissolve shader (black→transparent on scroll)
 *   • Original: Lenis smooth scroll → drives uDissolve uniform
 *   • New:      GSAP + ScrollTrigger for hero parallax
 *   • New:      Letter-by-letter name animation on load
 *   • New:      Mouse-tracking radial glow (lerped RAF)
 *   • New:      Staggered entrance for badge, subtitle, corner labels
 * ─────────────────────────────────────────────────────────────────
 */

import Lenis from 'lenis';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initHeroBgShader }  from './shader-bg.js';
import './analytics.js'; // Initialize Vercel Analytics and Speed Insights

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────────────────────────
// Hero background shader (ring-wave GLSL, behind all hero content)
// ─────────────────────────────────────────────────────────────────
initHeroBgShader(document.getElementById('heroShaderBg'));

// ─────────────────────────────────────────────────────────────────
// Mobile nav pill — tap anywhere (except menu btn) → go home
// ─────────────────────────────────────────────────────────────────
(function initMobileNavPillHome() {
  const pill    = document.getElementById('mobileNavPill');
  const menuBtn = document.getElementById('menuBtnMobile');
  if (!pill) return;

  pill.style.cursor = 'pointer';
  pill.addEventListener('click', (e) => {
    // Don't intercept clicks on the menu toggle button
    if (menuBtn && (e.target === menuBtn || menuBtn.contains(e.target))) return;
    window.location.href = '/';
  });
})();

// ─────────────────────────────────────────────────────────────────
// Custom cursor — arrow-shaped, auto black/white via mix-blend-mode
// ─────────────────────────────────────────────────────────────────
(function initCursor() {
  const arrow = document.getElementById('cursorArrow');
  if (!arrow) return;

  // Use transform instead of left/top — avoids layout thrashing
  arrow.style.willChange = 'transform';
  let cursorRaf = false;
  let cx = 0, cy = 0;
  document.addEventListener('mousemove', (e) => {
    cx = e.clientX;
    cy = e.clientY;
    if (!cursorRaf) {
      cursorRaf = true;
      requestAnimationFrame(() => {
        arrow.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        cursorRaf = false;
      });
    }
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
// Lenis smooth scroll
// ─────────────────────────────────────────────────────────────────
const lenis = new Lenis({ autoRaf: false });

// Keep ScrollTrigger in sync with Lenis
lenis.on('scroll', ScrollTrigger.update);

// ─────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// ─────────────────────────────────────────────────────────────────
// Three.js — original dissolve shader (preserved exactly)
// ─────────────────────────────────────────────────────────────────
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2  uResolution;
  uniform float uDissolve;   // 0 = fully black, 1 = fully gone
  uniform vec2  uCenter;     // normalised (0.5, 0.5)
  varying vec2  vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5, fr = 1.0;
    for (int i = 0; i < 5; i++) { v += a * noise(p * fr); a *= 0.5; fr *= 2.0; }
    return v;
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;

    vec2  d        = (vUv - uCenter) * vec2(aspect, 1.0);
    float dist     = length(d);
    float angle    = atan(d.y, d.x);
    vec2  pixUv    = floor(vUv * uResolution / 6.0) * 6.0 / uResolution;
    float noisy    = fbm(pixUv * 80.0) * 0.12 + fbm(vec2(angle * 4.0, 0.0)) * 0.12;
    float noisyDist= dist + noisy;

    float maxDist  = length(vec2(aspect * 0.5, 0.5));
    float normDist = noisyDist / maxDist;

    float T     = uDissolve * 1.5;
    float alpha = smoothstep(T - 0.04, T + 0.04, normDist);

    float edgeZone = smoothstep(T - 0.12, T - 0.04, normDist) *
                     smoothstep(T + 0.04, T,         normDist);
    float sparkle  = hash(floor(vUv * uResolution / 4.0)) * edgeZone;

    // Canvas is WHITE — the dissolve fills in white over the dark hero
    // Sparkle pixels are slightly grey at the jagged dissolving edge
    float sparkDim = sparkle * 2.2 * (1.0 - uDissolve); // dimmer near edge as dissolve closes
    vec3  color    = vec3(1.0 - sparkDim * 0.25);        // white minus a hint of grey sparkle

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Three.js setup ─────────────────────────────────────────────────────────────
const container = document.querySelector('.canvas1');

const scene    = new THREE.Scene();
const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const material = new THREE.ShaderMaterial({
  uniforms: {
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uDissolve:   { value: 1.0 }, // 1 = fully transparent (hero visible on load)
    uCenter:     { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader,
  fragmentShader,
  transparent: true,
});

scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

// ── Resize handler ──────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  ScrollTrigger.refresh();
});

// ─────────────────────────────────────────────────────────────────
// Mouse glow — lerped radial gradient (GPU-accelerated transform)
// ─────────────────────────────────────────────────────────────────
const glow   = document.getElementById('mouseGlow');
let mouseX   = window.innerWidth  / 2;
let mouseY   = window.innerHeight / 2;
let glowX    = mouseX;
let glowY    = mouseY;

if (glow) glow.style.willChange = 'transform';

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Smooth glow follow — use transform instead of left/top
function tickGlow() {
  glowX += (mouseX - glowX) * 0.08;
  glowY += (mouseY - glowY) * 0.08;
  if (glow) glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;
}

// ─────────────────────────────────────────────────────────────────
// Unified RAF — Lenis + Three.js renderer + glow lerp
// Renderer only renders when hero is visible (IntersectionObserver)
// ─────────────────────────────────────────────────────────────────
let heroVisible = true;
const heroEl = document.querySelector('.hero');
if ('IntersectionObserver' in window && heroEl) {
  const heroObs = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
  }, { threshold: 0.01 });
  heroObs.observe(heroEl);
}

function raf(time) {
  lenis.raf(time);
  if (heroVisible) renderer.render(scene, camera);
  tickGlow();
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

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

// Cat wrap — pops up first, before VEDANSH letters ────────────────
const heroCatWrap = document.getElementById('heroCatWrap');
if (heroCatWrap) {
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

// ── Cat eye tracking + blinking ──────────────────────────────────────────────
(function initCatEyes() {
  const eyeLeft   = document.getElementById('eyeLeft');
  const eyeRight  = document.getElementById('eyeRight');
  const pupilLeft = document.getElementById('pupilLeft');
  const pupilRight= document.getElementById('pupilRight');
  if (!eyeLeft || !eyeRight) return;

  const eyes   = [eyeLeft,   eyeRight];
  const pupils = [pupilLeft, pupilRight];
  const MAX_PX = 6; // max pupil travel from centre

  // Track mouse → move pupils (throttled with rAF) ──────────────────
  let eyeRaf = false;
  let lastEyeX = 0, lastEyeY = 0;
  document.addEventListener('mousemove', (e) => {
    lastEyeX = e.clientX;
    lastEyeY = e.clientY;
    if (!eyeRaf) {
      eyeRaf = true;
      requestAnimationFrame(() => {
        eyes.forEach((eye, i) => {
          const r  = eye.getBoundingClientRect();
          const cx = r.left + r.width  / 2;
          const cy = r.top  + r.height / 2;
          const dx = lastEyeX - cx;
          const dy = lastEyeY - cy;
          const dist  = Math.sqrt(dx * dx + dy * dy);
          const ratio = Math.min(dist, 80) / 80;
          const px = (dx / (dist || 1)) * MAX_PX * ratio;
          const py = (dy / (dist || 1)) * MAX_PX * ratio;
          pupils[i].style.transform = `translate(${px}px, ${py}px)`;
        });
        eyeRaf = false;
      });
    }
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


// Letters (staggered) ───────────────────────────────────────────────
const LETTER_DUR   = 800;   // ms transition per letter
const LETTER_STAG  = 55;    // ms stagger offset
const LETTERS_START= 400;   // ms — cat appears at 100ms, letters follow at 400ms

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

// Subtitle lines (blur-in, 500ms after last letter) ─────────────────
const subtitleStart = LETTERS_START + letters.length * LETTER_STAG + 500;
if (heroEyebrow) revealElBlur(heroEyebrow,   subtitleStart - 200,  14);
revealElBlur(subtitleSans,  subtitleStart,       32);
revealElBlur(subtitleSerif, subtitleStart + 160, 32);

// Corner labels (last) ──────────────────────────────────────────────
const cornersStart = subtitleStart + 600;
revealEl(cornerLeft,  cornersStart,      18);
revealEl(cornerRight, cornersStart + 90, 18);

// ─────────────────────────────────────────────────────────────────
// GSAP ScrollTrigger — PINNED dissolve + bento reveal
// uDissolve: 1→0 = transparent→opaque white canvas over hero.
// onUpdate watches progress each scrub frame:
//   ≥ 0.98 → section2 fades IN above canvas (z16 > z15), cards blur in.
//   ≤ 0.02 → section2 resets, ready for re-play.
// canvas1 opacity is NEVER changed — section2 sits on top of it,
// so there is zero hero bleed-through / flicker at any browser.
// ─────────────────────────────────────────────────────────────────
const canvas1El = document.querySelector('.canvas1');

const dissolveST = gsap.fromTo(
  material.uniforms.uDissolve,
  { value: 1 },         // canvas transparent — dark hero bg shows
  {
    value: 0,           // canvas fully opaque white — hero is gone
    ease: 'none',
    scrollTrigger: {
      trigger:    '.hero',
      start:      'top top',
      end:        '+=70%',
      pin:        true,
      scrub:      0.6,
      pinSpacing: true,
      anticipatePin: 1
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// Micro-interaction: letter parallax on mouse hover over name
// ─────────────────────────────────────────────────────────────────
heroName.addEventListener('mousemove', (e) => {
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

heroName.addEventListener('mouseleave', () => {
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
// About section — ethereal hue-rotate animation (paused when off-screen)
// ─────────────────────────────────────────────────────────────────
(function initUaEthereal() {
  const hueEl = document.getElementById('uaEtherHue');
  if (!hueEl) return;
  let hue = 0;
  let hueRunning = true;
  let hueRafId = null;
  const DEG_PER_FRAME = 360 / (5.84 * 60);
  function animUaEther() {
    hue = (hue + DEG_PER_FRAME) % 360;
    hueEl.setAttribute('values', hue.toFixed(2));
    if (hueRunning) hueRafId = requestAnimationFrame(animUaEther);
  }

  // Only animate when section is visible
  const aboutEl = document.getElementById('udbhavAbout');
  if ('IntersectionObserver' in window && aboutEl) {
    const aboutObs = new IntersectionObserver(([entry]) => {
      hueRunning = entry.isIntersecting;
      if (hueRunning && !hueRafId) hueRafId = requestAnimationFrame(animUaEther);
      else if (!hueRunning && hueRafId) { cancelAnimationFrame(hueRafId); hueRafId = null; }
    }, { threshold: 0.01 });
    aboutObs.observe(aboutEl);
  }

  hueRafId = requestAnimationFrame(animUaEther);
})();

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

// ─────────────────────────────────────────────────────────────────
// PROBLEM DOMAINS — 3D tilted carousel + hover popup
// Carousel rotates on the Y axis while tilted on X (-20deg).
// On hover: rotation pauses, card glows, popup appears above card.
// Popup is fixed-position (outside 3D context) to avoid z-index issues.
// ─────────────────────────────────────────────────────────────────
(function initProblemDomains() {
  const carousel  = document.getElementById('pdCarousel');
  const scene     = document.getElementById('pdScene');
  const popupEl   = document.getElementById('pdPopupFloat');
  if (!carousel || !popupEl) return;

  // Popup sub-elements
  const popupIcon  = document.getElementById('pdPopupIcon');
  const popupBadge = document.getElementById('pdPopupBadge');
  const popupTitle = document.getElementById('pdPopupTitle');
  const popupDesc  = document.getElementById('pdPopupDesc');
  const popupTags  = document.getElementById('pdPopupTags');

  const cards = Array.from(carousel.querySelectorAll('.pd-card'));

  let angle      = 0;
  let paused     = false;
  let activeCard = null;
  let rafId      = null;
  let running    = true;

  const SPEED = 0.28; // degrees per frame @ ~60 fps
  const TILT  = -10;  // rotateX degrees (tilted axis)

  // ── Animation tick ─────────────────────────────────────────────
  function tick() {
    if (!paused) {
      angle = (angle + SPEED) % 360;
      carousel.style.transform = `rotateX(${TILT}deg) rotateY(${angle}deg)`;
    }
    if (running) rafId = requestAnimationFrame(tick);
  }

  // ── Popup helpers ───────────────────────────────────────────────
  function positionPopup(card) {
    const rect  = card.getBoundingClientRect();
    const popW  = 285;
    const vw    = window.innerWidth;

    // Centre horizontally above the card's bounding rect
    let left = rect.left + rect.width / 2;
    // Clamp so popup never goes off-screen
    left = Math.max(popW / 2 + 12, Math.min(vw - popW / 2 - 12, left));

    // top: card's top edge in viewport; CSS translateY(-100%) raises popup above it
    popupEl.style.left = `${left}px`;
    popupEl.style.top  = `${rect.top - 14}px`;
  }

  function showPopup(card) {
    const d = card.dataset;

    // Inject per-card color tokens into popup CSS vars
    const clrRgb  = (card.style.getPropertyValue('--clr-rgb') || '168,85,247').trim();
    const clrSolid = (card.style.getPropertyValue('--clr') || '#a855f7').trim();
    popupEl.style.setProperty('--pd-clr-rgb',   clrRgb);
    popupEl.style.setProperty('--pd-clr-solid', clrSolid);

    // Populate content
    popupIcon.textContent  = d.icon  || '';
    popupBadge.textContent = `Domain ${d.id || ''}`;
    popupTitle.textContent = d.name  || '';
    popupDesc.textContent  = d.desc  || '';
    popupTags.innerHTML    = (d.tags || '').split(',')
      .map(t => `<span>${t.trim()}</span>`).join('');

    positionPopup(card);
    popupEl.setAttribute('aria-hidden', 'false');
    popupEl.classList.add('active');
  }

  function hidePopup() {
    popupEl.classList.remove('active');
    popupEl.setAttribute('aria-hidden', 'true');
  }

  // ── Card event handlers ─────────────────────────────────────────
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      paused     = true;
      activeCard = card;
      card.classList.add('is-active');
      showPopup(card);
    });

    card.addEventListener('mouseleave', () => {
      paused     = false;
      activeCard = null;
      card.classList.remove('is-active');
      hidePopup();
    });
  });

  // ── Pause when section scrolls out of view (performance) ────────
  if ('IntersectionObserver' in window && scene) {
    const obs = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      if (running && !rafId) rafId = requestAnimationFrame(tick);
      else if (!running && rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }, { threshold: 0.05 });
    obs.observe(scene);
  }

  // Start
  rafId = requestAnimationFrame(tick);
})();

// ─────────────────────────────────────────────────────────────────
// SCHEDULE — GSAP ScrollTrigger scroll-in / scroll-out animations
// Items slide IN when scrolling down to them, stay visible as you
// continue scrolling down, but fade OUT when scrolling back UP.
// ─────────────────────────────────────────────────────────────────
(function initScheduleGSAP() {
  const section = document.getElementById('scheduleSection');
  if (!section) return;

  // Phase labels: slide in on scroll-down, fade on scroll-back-up
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
          // play  = fade in  (scroll down, enters from bottom)
          // none  = stay put (scroll down past it)
          // none  = stay put (scroll up, re-enters from top)
          // reverse = fade out (scroll up, leaves at the bottom)
          toggleActions: 'play none none reverse',
        }
      }
    );
  });

  // Schedule items: same logic — stay visible scrolling down, fade scrolling up
  const items = section.querySelectorAll('[data-sch-item]');
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
