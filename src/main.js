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
import { initCubeViewer }    from './cube.js';
import { initAnalogClock3D } from './clock.js';
import { initGlobe3D }       from './globe.js';
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

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
// Mouse glow — lerped radial gradient
// ─────────────────────────────────────────────────────────────────
const glow   = document.getElementById('mouseGlow');
let mouseX   = window.innerWidth  / 2;
let mouseY   = window.innerHeight / 2;
let glowX    = mouseX;
let glowY    = mouseY;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Smooth glow follow runs inside the RAF below
function tickGlow() {
  glowX += (mouseX - glowX) * 0.08;
  glowY += (mouseY - glowY) * 0.08;
  glow.style.left = `${glowX}px`;
  glow.style.top  = `${glowY}px`;
}

// ─────────────────────────────────────────────────────────────────
// Unified RAF — Lenis + Three.js renderer + glow lerp
// ─────────────────────────────────────────────────────────────────
function raf(time) {
  lenis.raf(time);
  renderer.render(scene, camera);
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

// ── State flag to prevent repeat triggers ─────────────────
let bentoVisible = false;

// ── Stagger bento cards in (blur→clear) ──────────────────────────
function revealBentoCards() {
  const cards = Array.from(document.querySelectorAll('#section2 .bento-card'));
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('bento-revealed'), i * 90);
  });
}

// ── Reset bento cards to hidden state ────────────────────────────
function hideBentoCards() {
  const cards = Array.from(document.querySelectorAll('#section2 .bento-card'));
  cards.forEach(card => card.classList.remove('bento-revealed'));
}

// ── Show section2 + stagger bento cards ──────────────────────────
function showSection2() {
  const s2 = document.getElementById('section2');
  if (!s2) return;
  s2.style.opacity        = '1';
  s2.style.pointerEvents  = 'auto';
  // Cards blur-in with stagger after section2 fade (35ms CSS transition)
  setTimeout(revealBentoCards, 60);
}

// ── Hide section2 + reset bento cards ────────────────────────────
function hideSection2() {
  const s2 = document.getElementById('section2');
  if (!s2) return;
  s2.style.opacity        = '0';
  s2.style.pointerEvents  = 'none';
  hideBentoCards();
}

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
      anticipatePin: 1,

      // ── onUpdate: fires every scrub frame, works in all browsers ──
      onUpdate: (self) => {
        if (self.progress >= 0.98 && !bentoVisible) {
          bentoVisible = true;
          showSection2();
        } else if (self.progress < 0.02 && bentoVisible) {
          bentoVisible = false;
          hideSection2();
        }
      },
    },
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

  // ── Section 4 (Skills — black bg) → revert navbar to dark glass ──────────
  // Also covers the marquee ribbon section (4.5) which is also black.
  // onLeave is intentionally NOT toLight here — the next sections are also black.
  const skillsEl = document.getElementById('skillsSection');
  if (skillsEl) {
    ScrollTrigger.create({
      trigger: skillsEl,
      start:   'top 72px',
      end:     'bottom 72px',
      onEnter:     toDark,
      onLeaveBack: toLight,   // scrolling back up into work (white bg) → light
      onLeave:     toDark,    // scrolling into marquee / glimpse (also black) → stay dark
      onEnterBack: toDark,
    });
  }

  // ── Section 5 (Glimpse of Me — black bg) → keep navbar dark ─────────────
  const glimpseEl = document.getElementById('glimpseSection');
  if (glimpseEl) {
    ScrollTrigger.create({
      trigger: glimpseEl,
      start:   'top 72px',
      end:     'bottom 72px',
      onEnter:     toDark,
      onLeaveBack: toDark,   // marquee above is also black
      onLeave:     toDark,   // anything after is also dark
      onEnterBack: toDark,
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
    { id:'9',  label:'Register Now',      icon:'calendar',  description:'Register for UDBHAV\'26',     short:'⌘K', end:'Page',  href:'/book-a-call.html',color:'#4ade80', external:false },
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
// BENTO — Philosophy subtext roll on card hover
// ─────────────────────────────────────────────────────────────────
(function initPhilSubtext() {
  const card = document.getElementById('cardPhilosophy');
  const clip = document.getElementById('philSubClip');
  if (!card || !clip) return;

  card.addEventListener('mouseenter', () => clip.classList.add('hovered'));
  card.addEventListener('mouseleave', () => clip.classList.remove('hovered'));
})();

// ─────────────────────────────────────────────────────────────────
// BENTO — Philosophy tabs (Motion / Type / Feedback / Craft)
// ─────────────────────────────────────────────────────────────────
(function initPhilTabs() {
  const tabs    = document.querySelectorAll('.phil-tab');
  const content = document.getElementById('philContent');
  const heading = document.getElementById('philHeading');
  const desc    = document.getElementById('philDesc');
  if (!tabs.length || !content || !heading || !desc) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('active')) return;

      // Swap active state
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Remove animation class, update text, re-add to retrigger
      content.classList.remove('animating');
      // Force reflow so animation restarts
      void content.offsetWidth;
      heading.textContent = tab.dataset.heading;
      desc.textContent    = tab.dataset.desc;
      content.classList.add('animating');

      // Clean up class after animation completes
      content.addEventListener('animationend', () => {
        content.classList.remove('animating');
      }, { once: true });
    });
  });
})();

// ─────────────────────────────────────────────────────────────────
// GLIMPSE SECTION — Age in days (DOB 29-10-2007)
// Updates both the inline bio span and the stat card value.
// setInterval recalculates every 60 s — the day count flips
// automatically when midnight passes with no extra scheduling logic.
// ─────────────────────────────────────────────────────────────────
(function initAgeDays() {
  const DOB = new Date('2007-10-29T00:00:00'); // 29 Oct 2007

  function updateAge() {
    const msPerDay = 1000 * 60 * 60 * 24;
    const days     = Math.floor((Date.now() - DOB.getTime()) / msPerDay)
                         .toLocaleString('en-IN'); // e.g. "6,744"
    const bioSpan  = document.getElementById('ageDays');
    const statSpan = document.getElementById('ageStatDays');
    if (bioSpan)  bioSpan.textContent  = days;
    if (statSpan) statSpan.textContent = days;
  }

  updateAge();                       // run immediately on load
  setInterval(updateAge, 60_000);    // re-check every minute — zero scheduling needed
})();

// ─────────────────────────────────────────────────────────────────
// BENTO SECTION — Live identity time (Card 1)
// ─────────────────────────────────────────────────────────────────
(function initIdentityTime() {
  const el = document.getElementById('identityTime');
  if (!el) return;
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
})();

// ─────────────────────────────────────────────────────────────────
// BENTO SECTION — 3D Analog Clock (Three.js) — Card 2
// Replaces 2D canvas clock with premium metallic 3D clock
// ─────────────────────────────────────────────────────────────────
initAnalogClock3D();

// ─────────────────────────────────────────────────────────────────
// BENTO SECTION — Timezone Selector (Card 5)
// ─────────────────────────────────────────────────────────────────
(function initTimezone() {
  const rows = document.querySelectorAll('.tz-row');
  const timeEls = {
    'Europe/London': document.getElementById('tzTimeUK'),
    'Asia/Kolkata':  document.getElementById('tzTimeIN'),
    'America/New_York': document.getElementById('tzTimeUS'),
  };

  function updateTimes() {
    for (const [tz, el] of Object.entries(timeEls)) {
      if (!el) continue;
      const t = new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      el.textContent = t;
    }
  }

  updateTimes();
  setInterval(updateTimes, 1000);

  rows.forEach(row => {
    row.addEventListener('click', () => {
      rows.forEach(r => r.classList.remove('tz-row--active'));
      row.classList.add('tz-row--active');
    });
  });
})();

// ─────────────────────────────────────────────────────────────────
// BENTO SECTION — Email copy to clipboard (Card 3)
// ─────────────────────────────────────────────────────────────────
(function initEmailCopy() {
  const btn     = document.getElementById('emailCopyBtn');
  const clip    = document.getElementById('emailHintClip');
  const emailEl = btn?.querySelector('.email-address');
  if (!btn || !clip || !emailEl) return;

  btn.addEventListener('click', async () => {
    if (clip.classList.contains('copied')) return;

    try {
      await navigator.clipboard.writeText(emailEl.textContent.trim());
      clip.classList.add('copied');
      setTimeout(() => clip.classList.remove('copied'), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = emailEl.textContent.trim();
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      clip.classList.add('copied');
      setTimeout(() => clip.classList.remove('copied'), 1500);
    }
  });
})();

// ─────────────────────────────────────────────────────────────────
// BENTO SECTION — WebGL Globe via cobe (Card 4)
// Replaces 2D canvas globe with interactive 3D WebGL sphere
// ─────────────────────────────────────────────────────────────────
initGlobe3D();

// ── Init Three.js FBX cube in the identity card ──────────────────
initCubeViewer();

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
// SECTION 4 — Skills: scroll-driven orb rotation + badge entrance
//
// Orb rotation:
//   Scroll DOWN → rotate LEFT  (CCW = negative degrees)
//   Scroll UP   → rotate RIGHT (CW  = positive degrees)
//
// Badge entrance: staggered fade+slide in when section enters view.
// ─────────────────────────────────────────────────────────────────
(function initSkillsSection() {
  const orb    = document.getElementById('skillsOrb');
  const section = document.getElementById('skillsSection');
  if (!orb || !section) return;

  let orbDeg   = 0;   // accumulated rotation degrees
  let firstHit = false;

  // ── Orb: scroll-driven rotation via wheel event ──────────────────
  // Down scroll → negative delta → CCW (left) rotation
  // Up   scroll → positive delta → CW (right) rotation
  window.addEventListener('wheel', (e) => {
    if (!firstHit) {
      orb.classList.add('gsap-active'); // stops CSS float animation
      firstHit = true;
    }

    // Clamp per-event delta (higher cap = more travel per fast scroll)
    const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120);

    // Scroll DOWN (deltaY > 0) → orbDeg DECREASES (CCW = left)
    // Scroll UP   (deltaY < 0) → orbDeg INCREASES (CW  = right)
    orbDeg -= delta * 0.22;

    gsap.to(orb, {
      rotation: orbDeg,
      duration: 1.2,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }, { passive: true });

  // ── Skills header: fade-in on scroll into view ────────────────────
  const header = section.querySelector('.skills-header');
  const orbWrap = section.querySelector('.skills-orb-wrap');
  if (header) {
    gsap.fromTo(header,
      { opacity: 0, y: 40, filter: 'blur(8px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
          once: true,
        },
      }
    );
  }

  // ── Badge stagger entrance (ScrollTrigger IntersectionObserver) ───
  const badges = Array.from(section.querySelectorAll('.skill-badge'));
  if (!badges.length) return;

  // Use IntersectionObserver for performance — fires once when grid enters view
  const gridEl = section.querySelector('.skills-grid');
  if (!gridEl) return;

  let badgesRevealed = false;

  const observer = new IntersectionObserver((entries) => {
    if (badgesRevealed) return;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        badgesRevealed = true;
        observer.disconnect();

        badges.forEach((badge, i) => {
          setTimeout(() => badge.classList.add('badge-visible'), i * 42);
        });
      }
    });
  }, { threshold: 0.15 });

  observer.observe(gridEl);
})();


// ─────────────────────────────────────────────────────────────────
// SECTION 4.5 — Infinite Marquee Ribbon  (v2 — velocity lerp)
//
// Velocity-lerped GSAP ticker animation:
//   currentVelocity exponentially lerps toward FULL_SPEED each frame,
//   giving a smooth natural acceleration on page load.
//   Marquee runs continuously — no hover pause.
// ─────────────────────────────────────────────────────────────────
(function initMarquee() {
  const section = document.getElementById('marqueeSection');
  const track   = document.getElementById('marqueeTrack');
  if (!section || !track) return;

  // Prevent velocity spikes after tab switch / sleep
  gsap.ticker.lagSmoothing(0);

  const FULL_SPEED = 1.4;   // px/frame cruise speed at 60 fps
  const LERP_ALPHA = 0.062; // exponential ease factor

  let offsetX         = 0;
  let loopWidth       = 0;   // half of total scrollWidth = one copy's width
  let currentVelocity = 0;   // starts at 0, ramps up smoothly on first frames

  function measure() {
    loopWidth = track.scrollWidth / 2;
  }

  // Continuous ticker — always runs, no pause on hover
  gsap.ticker.add(() => {
    if (loopWidth <= 0) return;

    // Smooth acceleration from 0 → FULL_SPEED on first frames
    currentVelocity += (FULL_SPEED - currentVelocity) * LERP_ALPHA;

    if (Math.abs(currentVelocity) < 0.001) return;

    offsetX -= currentVelocity;
    if (offsetX <= -loopWidth) offsetX += loopWidth; // seamless loop

    gsap.set(track, { x: offsetX });
  });

  requestAnimationFrame(() => requestAnimationFrame(measure));
  window.addEventListener('resize', () => requestAnimationFrame(measure));
})();


// ─────────────────────────────────────────────────────────────────
// SECTION 5 — Glimpse of Me
//
// Photo auto-swap engine:
//   · 3 photos stacked in .glimpse-frame via position:absolute
//   · Transition: clip-path inset() — incoming slides up from bottom,
//     outgoing clips up — premium editorial reveal, no crossfade.
//   · Ken Burns: each active photo slowly drifts to scale(1.0) over 4s.
//   · Progress bar: GSAP tween from 0% to 100% over HOLD_MS, resets on swap.
//   · Dot click → interrupt timer, go to target index, restart timer.
//   · Section entrance: GSAP ScrollTrigger stagger fade for left content.
// ─────────────────────────────────────────────────────────────────
(function initGlimpse() {
  const section  = document.getElementById('glimpseSection');
  if (!section) return;

  const photos      = Array.from(section.querySelectorAll('.glimpse-photo'));
  const dots        = Array.from(section.querySelectorAll('.glimpse-dot'));
  const counterEl   = document.getElementById('glimpseCounterCur');
  const progressBar = document.getElementById('glimpseProgressBar');

  if (!photos.length) return;

  const TOTAL    = photos.length;
  const HOLD_MS  = 3500;       // ms each photo displays before next swap
  const DUR_IN   = 0.85;       // seconds for incoming clip-path reveal
  const DUR_OUT  = 0.65;       // seconds for outgoing clip-path close

  let current    = 0;
  let autoTimer  = null;
  let progressTw = null;       // reference to the running progress tween

  // ── Initial state setup ───────────────────────────────────────────
  // All photos clipped to hidden; first photo already set via CSS class.
  // Set them explicitly so GSAP has clean start values.
  photos.forEach((ph, i) => {
    if (i === 0) {
      gsap.set(ph, { clipPath: 'inset(0% 0% 0% 0%)', zIndex: 2 });
      ph.classList.add('is-kenburns'); // start Ken Burns on first
    } else {
      gsap.set(ph, { clipPath: 'inset(100% 0% 0% 0%)', zIndex: 0 });
    }
  });

  // ── Animate progress bar from left→right over HOLD_MS ─────────────
  function startProgress() {
    if (progressBar) {
      if (progressTw) progressTw.kill();
      gsap.set(progressBar, { scaleX: 0, transformOrigin: 'left center' });
      progressTw = gsap.to(progressBar, {
        scaleX: 1,
        duration: HOLD_MS / 1000,
        ease: 'none',
      });
    }
  }

  // ── Update dot state + counter display ────────────────────────────
  function updateUI(idx) {
    dots.forEach((d, i) => {
      const isActive = i === idx;
      d.classList.toggle('glimpse-dot--active', isActive);
      d.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (counterEl) {
      counterEl.textContent = String(idx + 1).padStart(2, '0');
    }
  }

  // ── Core transition: go from `current` to `next` ──────────────────
  function goTo(next) {
    if (next === current) return;
    const prev = current;
    current    = next;

    const phIn  = photos[next];
    const phOut = photos[prev];

    // Bring incoming above outgoing
    gsap.set(phIn,  { zIndex: 3, clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(phOut, { zIndex: 2 });

    // Remove Ken Burns from outgoing
    phOut.classList.remove('is-kenburns');

    // Animate IN — clip reveals upward (bottom inset slides to 0%)
    gsap.to(phIn, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: DUR_IN,
      ease: 'power3.inOut',
      onComplete: () => {
        // Settle z-indexes after transition
        gsap.set(phIn,  { zIndex: 2 });
        gsap.set(phOut, { zIndex: 0, clipPath: 'inset(100% 0% 0% 0%)' });
        // Start Ken Burns on fresh photo
        phIn.classList.add('is-kenburns');
      },
    });

    // Animate OUT — clip closes upward simultaneously
    gsap.to(phOut, {
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: DUR_OUT,
      ease: 'power2.in',
    });

    updateUI(next);
    startProgress();
  }

  // ── Auto-advance timer ────────────────────────────────────────────
  function startTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      goTo((current + 1) % TOTAL);
    }, HOLD_MS);
  }

  // ── Dot click → jump to that photo and restart timer ─────────────
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.idx, 10);
      if (idx === current) return;
      clearInterval(autoTimer);
      goTo(idx);
      startTimer();
    });
  });

  // ── ScrollTrigger: section entrance — stagger left content ────────
  const leftEls = Array.from(section.querySelectorAll(
    '.glimpse-eyebrow, .glimpse-heading, .glimpse-bio, ' +
    '.glimpse-stats, .glimpse-social-bar'
  ));

  if (leftEls.length) {
    gsap.fromTo(leftEls,
      { opacity: 0, y: 36, filter: 'blur(6px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.10,
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          once: true,
        },
      }
    );
  }

  // Right side frame entrance
  const frame = document.getElementById('glimpseFrame');
  if (frame) {
    gsap.fromTo(frame,
      { opacity: 0, y: 50, scale: 0.97 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          once: true,
        },
        delay: 0.2,
      }
    );
  }

  // ── Boot ──────────────────────────────────────────────────────────
  updateUI(0);
  startProgress();
  startTimer();
})();

// ─────────────────────────────────────────────────────────────────
// SECTION 6 — Testimonials entrance animations
// ─────────────────────────────────────────────────────────────────
(function initTestimonials() {
  const section = document.getElementById('testimonialsSection');
  if (!section) return;

  // Left column: stagger each child element in
  const leftEls = section.querySelectorAll(
    '.testi-eyebrow, .testi-heading, .testi-desc, .testi-stats, .testi-actions'
  );
  if (leftEls.length) {
    gsap.fromTo(leftEls,
      { opacity: 0, y: 30, filter: 'blur(4px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.09,
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          once: true,
        },
      }
    );
  }

  // Right column: cascade cards in
  section.querySelectorAll('.testi-card').forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 40, scale: 0.97 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.85,
        ease: 'power3.out',
        delay: i * 0.12,
        scrollTrigger: {
          trigger: section,
          start: 'top 68%',
          once: true,
        },
      }
    );
  });
})();

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
// About section — ethereal hue-rotate animation (same as other pages)
// ─────────────────────────────────────────────────────────────────
(function initUaEthereal() {
  const hueEl = document.getElementById('uaEtherHue');
  if (!hueEl) return;
  let hue = 0;
  const DEG_PER_FRAME = 360 / (5.84 * 60);
  function animUaEther() {
    hue = (hue + DEG_PER_FRAME) % 360;
    hueEl.setAttribute('values', hue.toFixed(2));
    requestAnimationFrame(animUaEther);
  }
  animUaEther();
})();
