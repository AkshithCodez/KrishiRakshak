/**
 * KrishiRakshak — Landing Page Scroll Controller
 *
 * Drives the 3D narrative via native document scroll.
 * No scroll-jacking. No wheel interception. No setInterval.
 *
 * Architecture:
 *  - .story-world is a tall container (770svh desktop, 340svh mobile)
 *  - .scene-shell inside it is position:sticky; height:100svh
 *  - Raw scroll offset is mapped to [0,1] via (scrollY - sectionTop) / travel
 *  - narrativeProgress() compresses this for mobile
 *  - Resulting progress drives Three.js and CSS data-stage transitions
 *  - The GLB loads asynchronously; text/CTAs appear immediately
 */

import { clamp, narrativeProgress, stageAt } from './story-timeline.js?v=6';

const world   = document.getElementById('plant-story');
const field   = document.getElementById('hero3dContainer');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mobile  = matchMedia('(max-width: 760px)');

let scene, progress = 0, sectionTop = 0, travel = 1, captured = false;

// Activate scroll story layout before first paint so sticky positioning works
document.documentElement.classList.add('story-ready');

function measure() {
  // Re-measure after layout changes (resize, font load, etc.)
  sectionTop = world.getBoundingClientRect().top + scrollY;
  travel     = Math.max(1, world.offsetHeight - innerHeight);
  update();
}

function update() {
  const raw = clamp((scrollY - sectionTop) / travel);
  progress  = narrativeProgress(raw, mobile.matches);

  // Semantic stage drives CSS overlays (viewfinder, diagnosis token, etc.)
  // Only update DOM when stage actually changes — never on every scroll tick.
  const stage = reduced.matches ? 'life' : stageAt(progress, mobile.matches);
  if (field.dataset.stage !== stage) field.dataset.stage = stage;

  // Capture flag for the capture-label overlay
  const nowCaptured = progress >= 0.56 && progress < 0.70;
  if (captured !== nowCaptured) field.dataset.captured = String(captured = nowCaptured);

  // Drive the 3D scene (continuous, no DOM writes inside WebGL)
  scene?.setProgress(reduced.matches ? 0.30 : progress);
}

function fail(error) {
  scene?.dispose();
  field.dataset.modelStatus = 'fallback';
  document.documentElement.classList.remove('story-ready');
  field.dataset.modelError  = error?.message ?? 'unknown';
  document.getElementById('hero3dFallback').hidden = false;
  document.getElementById('heroLoaderStatus').textContent =
    'The plant preview is unavailable. The story and both portals remain ready to explore.';
}

// Passive listeners — never block scroll
addEventListener('scroll', update, { passive: true });
addEventListener('resize', measure, { passive: true });
addEventListener('pageshow', measure);
new ResizeObserver(measure).observe(world);
mobile.addEventListener('change', measure);
reduced.addEventListener('change', measure);

// Initial measurement
measure();

// Load 3D after two frames so text + CTAs paint first (no spinner blocking UX)
requestAnimationFrame(() => requestAnimationFrame(async () => {
  try {
    const { Hero3DExperience } = await import('./hero-3d.js?v=6');
    scene = new Hero3DExperience(field, { onError: fail });
    await scene.init();
    // Sync to current scroll position now that the scene is ready
    update();
  } catch (error) {
    fail(error);
  }
}));
