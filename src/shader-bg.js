import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Hero Background Shader
// Ring-wave GLSL pattern ported from ShaderAnimation (React → vanilla Three.js)
// ─────────────────────────────────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */`
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  #define TWO_PI 6.2831853072
  #define PI 3.14159265359

  precision highp float;
  uniform vec2  resolution;
  uniform float time;

  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    float t = time * 0.05;
    float lineWidth = 0.002;

    vec3 color = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 5; i++) {
        color[j] += lineWidth * float(i * i)
          / abs(
              fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0
              - length(uv)
              + mod(uv.x + uv.y, 0.2)
            );
      }
    }

    // Tone-map: keep colours from blowing out to harsh white
    color = color / (color + vec3(1.0));

    gl_FragColor = vec4(color.r, color.g, color.b, 0.72);
  }
`;

export function initHeroBgShader(mountEl) {
  if (!mountEl) return null;

  // ── Scene setup ──────────────────────────────────────────────────────────
  const camera = new THREE.Camera();
  camera.position.z = 1;

  const scene    = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    time:       { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent:    true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  mountEl.appendChild(renderer.domElement);

  // ── Resize ───────────────────────────────────────────────────────────────
  function resize() {
    const w = mountEl.clientWidth;
    const h = mountEl.clientHeight;
    renderer.setSize(w, h);
    uniforms.resolution.value.set(
      renderer.domElement.width,
      renderer.domElement.height,
    );
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // ── RAF loop (paused when hero off-screen via IntersectionObserver) ───────
  let rafId = null;
  let frameCount = 0;
  let isVisible = true;

  function animate() {
    if (!isVisible) { rafId = null; return; }
    rafId = requestAnimationFrame(animate);
    frameCount++;
    uniforms.time.value += 0.05;
    renderer.render(scene, camera);
  }

  // Pause shader when hero section scrolls off-screen — saves GPU/battery
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !rafId) rafId = requestAnimationFrame(animate);
    }, { threshold: 0.01 });
    obs.observe(mountEl);
  }

  animate();

  // ── Destroy / cleanup ────────────────────────────────────────────────────
  function destroy() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    if (renderer.domElement.parentNode === mountEl) {
      mountEl.removeChild(renderer.domElement);
    }
    renderer.dispose();
    geometry.dispose();
    material.dispose();
  }

  return { destroy };
}
