/**
 * pd-gallery.js  ─  OGL WebGL curved gallery  +  hover popup
 * ─────────────────────────────────────────────────────────────────
 * HOW HOVER WORKS (canvas has no DOM elements):
 *  1. Track mouse X/Y over the container.
 *  2. Convert container-relative X to viewport world-space X.
 *  3. Walk each Media, check if worldX falls inside plane.position.x ± plane.scale.x/2.
 *  4. When a card is hit → pause auto-scroll + show HTML popup overlay.
 *  5. Popup slides in from the bottom-right corner of the hovered card.
 * ─────────────────────────────────────────────────────────────────
 */

import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

/* ─── Domain data (with rich info for the popup) ────────────────── */
const DOMAIN_ITEMS = [
  {
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop&auto=format',
    text:  'HealthTech & MedTech',
    num:   '01',
    desc:  'Tackle real challenges in healthcare delivery, remote diagnostics, patient monitoring, and medical data management.',
    tags:  ['Diagnostics', 'Wearables', 'Remote Health'],
    clr:   '#f43f5e',
  },
  {
    image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&h=600&fit=crop&auto=format',
    text:  'AI / ML & Data Science',
    num:   '02',
    desc:  'Build intelligent systems that learn, predict, and automate — from NLP to computer vision and predictive analytics.',
    tags:  ['NLP', 'Computer Vision', 'Neural Nets'],
    clr:   '#a855f7',
  },
  {
    image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&h=600&fit=crop&auto=format',
    text:  'Smart Cities & IoT',
    num:   '03',
    desc:  'Design connected solutions for urban infrastructure — smart traffic, waste management, energy grids, and public safety.',
    tags:  ['IoT Sensors', 'Traffic AI', 'Energy Grid'],
    clr:   '#22d3ee',
  },
  {
    image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=600&fit=crop&auto=format',
    text:  'Sustainability & GreenTech',
    num:   '04',
    desc:  'Engineer eco-friendly solutions targeting climate change, carbon tracking, clean energy, and sustainable agriculture.',
    tags:  ['Carbon Track', 'Clean Energy', 'AgriTech'],
    clr:   '#22c55e',
  },
  {
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop&auto=format',
    text:  'EdTech & Skilling',
    num:   '05',
    desc:  'Reimagine how people learn — adaptive platforms, vernacular tools, and AI-powered career guidance for the next billion.',
    tags:  ['Adaptive Learn', 'Vernacular AI', 'AR / VR'],
    clr:   '#f59e0b',
  },
  {
    image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=600&fit=crop&auto=format',
    text:  'FinTech & Web3',
    num:   '06',
    desc:  'Build the future of finance — DeFi apps, smart contracts, digital wallets, fraud detection, and financial inclusion.',
    tags:  ['DeFi', 'Smart Contracts', 'Fraud AI'],
    clr:   '#3b82f6',
  },
  {
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=600&fit=crop&auto=format',
    text:  'CyberSecurity & Privacy',
    num:   '07',
    desc:  'Defend digital systems against evolving threats — zero-trust architectures, threat intelligence, and privacy-first tools.',
    tags:  ['Zero Trust', 'Threat Intel', 'Privacy Tools'],
    clr:   '#f97316',
  },
  {
    image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=600&fit=crop&auto=format',
    text:  'Social Impact & Rural Tech',
    num:   '08',
    desc:  'Bridge the urban-rural divide — digital governance, farmer tech, women safety systems, and accessibility for all.',
    tags:  ['Digital Gov', 'AgriTech', 'Accessibility'],
    clr:   '#ec4899',
  },
];

/* ─── Helpers ────────────────────────────────────────────────────── */
function lerp(p1, p2, t) { return p1 + (p2 - p1) * t; }

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function createTextTexture(gl, text, font, color) {
  const canvas  = document.createElement('canvas');
  const ctx     = canvas.getContext('2d');
  ctx.font      = font;
  const metrics = ctx.measureText(text);
  const tw      = Math.ceil(metrics.width);
  const th      = Math.ceil(parseInt(font, 10) * 1.2);
  canvas.width  = tw + 28;
  canvas.height = th + 28;
  ctx.font          = font;
  ctx.fillStyle     = color;
  ctx.textBaseline  = 'middle';
  ctx.textAlign     = 'center';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture   = new Texture(gl, { generateMipmaps: false });
  texture.image   = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}

/* ─── Title (WebGL text label below card) ───────────────────────── */
class Title {
  constructor({ gl, plane, text, font, textColor }) {
    this.gl        = gl;
    this.plane     = plane;
    this.text      = text;
    this.font      = font;
    this.textColor = textColor;
    this._build();
  }
  _build() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor);
    const geo  = new Plane(this.gl);
    const prog = new Program(this.gl, {
      vertex: `attribute vec3 position; attribute vec2 uv; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragment: `precision highp float; uniform sampler2D tMap; varying vec2 vUv; void main() { vec4 c = texture2D(tMap, vUv); if (c.a < 0.1) discard; gl_FragColor = c; }`,
      uniforms: { tMap: { value: texture } },
      transparent: true,
    });
    this.mesh = new Mesh(this.gl, { geometry: geo, program: prog });
    const aspect = width / height;
    const th     = this.plane.scale.y * 0.14;
    const tw     = th * aspect;
    this.mesh.scale.set(tw, th, 1);
    this.mesh.position.y = -this.plane.scale.y * 0.5 - th * 0.5 - 0.08;
    this.mesh.setParent(this.plane);
  }
}

/* ─── Media (one WebGL image card) ──────────────────────────────── */
class Media {
  constructor({ geometry, gl, image, index, length, scene, screen, text, viewport, bend, textColor, borderRadius, font }) {
    Object.assign(this, { gl, geometry, image, index, length, scene, screen, text, viewport, bend, textColor, borderRadius, font });
    this.extra = 0; this.speed = 0; this.isBefore = false; this.isAfter = false;
    this._createShader(); this._createMesh(); this._createTitle(); this.onResize();
  }

  _createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: true });
    this.program  = new Program(this.gl, {
      depthTest: false, depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position; attribute vec2 uv;
        uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
        uniform float uTime; uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * uSpeed * 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes; uniform vec2 uPlaneSizes;
        uniform sampler2D tMap; uniform float uBorderRadius;
        varying vec2 vUv;
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(vUv.x * ratio.x + (1.0 - ratio.x) * 0.5, vUv.y * ratio.y + (1.0 - ratio.y) * 0.5);
          vec4 color = texture2D(tMap, uv);
          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          gl_FragColor = vec4(color.rgb, 1.0 - smoothstep(-0.002, 0.002, d));
        }`,
      uniforms: {
        tMap: { value: texture }, uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] }, uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() }, uBorderRadius: { value: this.borderRadius },
      },
      transparent: true,
    });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
    };
  }

  _createMesh() {
    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program });
    this.plane.setParent(this.scene);
  }

  _createTitle() {
    this.title = new Title({ gl: this.gl, plane: this.plane, text: this.text, font: this.font, textColor: this.textColor });
  }

  update(scroll, direction) {
    this.plane.position.x = this.x - scroll.current - this.extra;
    const x = this.plane.position.x;
    const H = this.viewport.width / 2;
    if (this.bend === 0) {
      this.plane.position.y = 0; this.plane.rotation.z = 0;
    } else {
      const B = Math.abs(this.bend), R = (H * H + B * B) / (2 * B);
      const ex = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(Math.max(0, R * R - ex * ex));
      if (this.bend > 0) { this.plane.position.y = -arc; this.plane.rotation.z = -Math.sign(x) * Math.asin(ex / R); }
      else               { this.plane.position.y =  arc; this.plane.rotation.z =  Math.sign(x) * Math.asin(ex / R); }
    }
    this.speed = scroll.current - scroll.last;
    this.program.uniforms.uTime.value  += 0.04;
    this.program.uniforms.uSpeed.value  = this.speed;
    const po = this.plane.scale.x / 2, vo = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + po < -vo;
    this.isAfter  = this.plane.position.x - po >  vo;
    if (direction === 'right' && this.isBefore) { this.extra -= this.widthTotal; this.isBefore = this.isAfter = false; }
    if (direction === 'left'  && this.isAfter)  { this.extra += this.widthTotal; this.isBefore = this.isAfter = false; }
  }

  onResize({ screen, viewport } = {}) {
    if (screen)   this.screen   = screen;
    if (viewport) this.viewport = viewport;
    this.scale  = this.screen.height / 1500;
    this.plane.scale.y = (this.viewport.height * (900 * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width  * (700 * this.scale)) / this.screen.width;
    this.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding    = 2;
    this.width      = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x          = this.width * this.index;
  }
}

/* ─── GalleryApp ─────────────────────────────────────────────────── */
class GalleryApp {
  constructor(container, popup, items, opts) {
    const { bend = 3, textColor = '#fff', borderRadius = 0.05, font = 'bold 28px Inter, sans-serif', scrollSpeed = 2, scrollEase = 0.05 } = opts;
    this.container  = container;
    this.popup      = popup;
    this.items      = items;        // original (non-duplicated) for popup data lookup
    this.scrollSpeed = scrollSpeed;
    this.scroll     = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.isDown     = false;
    this.start      = 0;
    this.autoSpeed  = 0.07;
    this.running    = true;
    this.hoveredIdx = -1;           // index into duplicated medias array
    this.mouseX     = 0;
    this.mouseY     = 0;
    this._onCheckDebounce = debounce(this._onCheck.bind(this), 200);

    this._createRenderer();
    this._createCamera();
    this._createScene();
    this._onResize();
    this._createGeometry();
    this._createMedias(items, bend, textColor, borderRadius, font);
    this._bindEvents();
    this._raf = requestAnimationFrame(this._update.bind(this));
  }

  _createRenderer() {
    this.renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    this.gl       = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }

  _createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }

  _createScene() { this.scene = new Transform(); }

  _createGeometry() {
    this.planeGeo = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 });
  }

  _createMedias(items, bend, textColor, borderRadius, font) {
    const all    = [...items, ...items];
    this.medias  = all.map((d, i) => new Media({
      geometry: this.planeGeo, gl: this.gl, image: d.image,
      index: i, length: all.length, scene: this.scene,
      screen: this.screen, text: d.text, viewport: this.viewport,
      bend, textColor, borderRadius, font,
    }));
  }

  /* ── Hover detection ─────────────────────────────────────────── */
  _detectHover(clientX, clientY) {
    if (!this.medias || !this.viewport) return -1;
    const rect     = this.container.getBoundingClientRect();
    const localX   = clientX - rect.left;
    const localY   = clientY - rect.top;

    // Convert pixel X inside container → world-space X
    const ndcX     = (localX / this.screen.width) * 2 - 1;
    const worldX   = ndcX * this.viewport.width / 2;

    // Also check Y — only hit if mouse is within card height range
    const ndcY     = 1 - (localY / this.screen.height) * 2;
    const worldY   = ndcY * this.viewport.height / 2;

    for (let i = 0; i < this.medias.length; i++) {
      const m   = this.medias[i];
      const px  = m.plane.position.x;
      const py  = m.plane.position.y;
      const hw  = m.plane.scale.x / 2;
      const hh  = m.plane.scale.y / 2;
      if (Math.abs(worldX - px) < hw && Math.abs(worldY - py) < hh) {
        return i;
      }
    }
    return -1;
  }

  _onMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    const idx = this._detectHover(e.clientX, e.clientY);
    if (idx !== this.hoveredIdx) {
      this.hoveredIdx = idx;
      if (idx >= 0) {
        this._showPopup(idx, e.clientX, e.clientY);
      } else {
        this._hidePopup();
      }
    } else if (idx >= 0) {
      // Update popup position as mouse moves within the card
      this._positionPopup(e.clientX, e.clientY);
    }
  }

  _onMouseLeaveContainer() {
    this.hoveredIdx = -1;
    this._hidePopup();
  }

  /* ── Popup show/hide/position ────────────────────────────────── */
  _showPopup(mediaIdx, clientX, clientY) {
    if (!this.popup) return;
    // Map mediaIdx back to original items (since items are duplicated)
    const origIdx   = mediaIdx % this.items.length;
    const domain    = this.items[origIdx];

    // Inject content
    this.popup.querySelector('.pdgp-num').textContent   = domain.num;
    this.popup.querySelector('.pdgp-title').textContent = domain.text;
    this.popup.querySelector('.pdgp-desc').textContent  = domain.desc;
    const tagsEl = this.popup.querySelector('.pdgp-tags');
    tagsEl.innerHTML = domain.tags.map(t => `<span style="border-color:${domain.clr}40;color:${domain.clr}">${t}</span>`).join('');
    this.popup.style.setProperty('--popup-clr', domain.clr);

    this._positionPopup(clientX, clientY);
    this.popup.classList.add('is-visible');
  }

  _positionPopup(clientX, clientY) {
    if (!this.popup) return;
    const rect    = this.container.getBoundingClientRect();
    const lx      = clientX - rect.left;
    const ly      = clientY - rect.top;
    const pw      = 280;
    const ph      = 180; // approx popup height
    const margin  = 16;

    // Prefer right-bottom of cursor, flip if near edges
    let left = lx + margin;
    let top  = ly + margin;
    if (left + pw > this.screen.width)  left = lx - pw - margin;
    if (top  + ph > this.screen.height) top  = ly - ph - margin;

    this.popup.style.left = `${Math.max(0, left)}px`;
    this.popup.style.top  = `${Math.max(0, top)}px`;
  }

  _hidePopup() {
    if (!this.popup) return;
    this.popup.classList.remove('is-visible');
  }

  /* ── Input handlers ─────────────────────────────────────────── */
  _onTouchDown(e) {
    this._hidePopup();
    this.hoveredIdx = -1;
    this.isDown     = true;
    this._scrollPos = this.scroll.current;
    this.start      = e.touches ? e.touches[0].clientX : e.clientX;
  }

  _onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    this.scroll.target = this._scrollPos + (this.start - x) * this.scrollSpeed * 0.025;
  }

  _onTouchUp() { this.isDown = false; this._onCheck(); }

  _onWheel(e) {
    const delta = e.deltaY || e.wheelDelta || e.detail;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this._onCheckDebounce();
  }

  _onCheck() {
    if (!this.medias?.[0]) return;
    const w   = this.medias[0].width;
    const idx = Math.round(Math.abs(this.scroll.target) / w);
    this.scroll.target = Math.sign(this.scroll.target || 1) * w * idx;
  }

  _onResize() {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({ aspect: this.screen.width / this.screen.height });
    const fov     = (this.camera.fov * Math.PI) / 180;
    const h       = 2 * Math.tan(fov / 2) * this.camera.position.z;
    this.viewport = { width: h * this.camera.aspect, height: h };
    if (this.medias) this.medias.forEach(m => m.onResize({ screen: this.screen, viewport: this.viewport }));
  }

  _update() {
    if (!this.running) { this._raf = requestAnimationFrame(this._update.bind(this)); return; }

    // Pause auto-scroll while hovering a card
    if (!this.isDown && this.hoveredIdx < 0) {
      this.scroll.target += this.autoSpeed;
    }

    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    if (this.medias) this.medias.forEach(m => m.update(this.scroll, direction));
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this._raf = requestAnimationFrame(this._update.bind(this));
  }

  _bindEvents() {
    this._resizeCb        = this._onResize.bind(this);
    this._wheelCb         = this._onWheel.bind(this);
    this._downCb          = this._onTouchDown.bind(this);
    this._moveCb          = this._onTouchMove.bind(this);
    this._upCb            = this._onTouchUp.bind(this);
    this._mouseMoveCb     = this._onMouseMove.bind(this);
    this._mouseLeaveCb    = this._onMouseLeaveContainer.bind(this);

    window.addEventListener('resize', this._resizeCb);
    this.container.addEventListener('wheel', this._wheelCb, { passive: true });
    this.container.addEventListener('mousedown', this._downCb);
    window.addEventListener('mousemove', this._moveCb);
    window.addEventListener('mouseup', this._upCb);
    this.container.addEventListener('touchstart', this._downCb, { passive: true });
    window.addEventListener('touchmove', this._moveCb, { passive: true });
    window.addEventListener('touchend', this._upCb);
    // Hover detection — use container for move so worldX math stays accurate
    this.container.addEventListener('mousemove', this._mouseMoveCb);
    this.container.addEventListener('mouseleave', this._mouseLeaveCb);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resizeCb);
    this.container.removeEventListener('wheel', this._wheelCb);
    this.container.removeEventListener('mousedown', this._downCb);
    window.removeEventListener('mousemove', this._moveCb);
    window.removeEventListener('mouseup', this._upCb);
    this.container.removeEventListener('touchstart', this._downCb);
    window.removeEventListener('touchmove', this._moveCb);
    window.removeEventListener('touchend', this._upCb);
    this.container.removeEventListener('mousemove', this._mouseMoveCb);
    this.container.removeEventListener('mouseleave', this._mouseLeaveCb);
    if (this.gl?.canvas?.parentNode) this.gl.canvas.parentNode.removeChild(this.gl.canvas);
  }
}

/* ─── Init export ────────────────────────────────────────────────── */
export function initPdGallery() {
  const container = document.getElementById('pdgContainer');
  const popup     = document.getElementById('pdgPopup');
  if (!container) return;

  let app = null;

  function mount() {
    if (app) return;
    app = new GalleryApp(container, popup, DOMAIN_ITEMS, {
      bend:         3,
      borderRadius: 0.08,
      scrollSpeed:  2,
      scrollEase:   0.05,
      font:         'bold 26px Inter, sans-serif',
      textColor:    'rgba(255,255,255,0.88)',
    });
  }

  function unmount() { if (app) app.running = false; }
  function resume()  { if (app) app.running = true;  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { mount(); resume(); }
      else                  { unmount(); }
    }, { threshold: 0.05 }).observe(container);
  } else {
    mount();
  }
}
