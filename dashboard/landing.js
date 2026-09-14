/**
 * KrishiRakshak — Landing Page Story Controller
 *
 * Primary narrative: SCROLL-DRIVEN.
 * The hero section is pinned while scroll progress drives the 3D stage.
 * Prev/Next buttons are kept as accessibility fallback, not primary navigation.
 *
 * Stages (0–8):
 *   0. soil      — soil visible, plant invisible at base
 *   1. growth    — plant grows upward from soil
 *   2. life      — full plant, idle sway
 *   3. focus     — diseased leaf becomes focal
 *   4. capture   — camera frames the leaf
 *   5. analysis  — scan effect
 *   6. diagnosis — result overlay
 *   7. report    — location signal
 *   8. hotspot   — regional pattern + officer awareness
 */

(() => {
  const field = document.getElementById('hero3dContainer');
  if (!field) return;

  const mobile = matchMedia('(max-width: 760px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // ── Stage definitions ──────────────────────────────────────────
  const stages = {
    soil:      ['The story begins in soil.',          'Before disease is visible, the plant grows quietly from the ground. Every crop disease story starts here.', 'Watch it grow'],
    growth:    ['The plant emerges.',                 'From soil upward. Stem and leaves unfold toward light. A small change on one leaf can be easy to miss.', 'Find the leaf'],
    life:      ['A healthy plant in the field.',      'Everything looks ordinary. Then, a discolored patch. A texture that does not belong. One leaf asks for attention.', 'Look closer'],
    focus:     ['One leaf asks for attention.',        'A discoloured patch is a reason to look closer. The affected leaf becomes the focus.', 'Frame the leaf'],
    capture:   ['A clear photo is the first step.',   'The farmer frames the affected leaf. A focused photo gives the analysis a better starting point.', 'Analyze the photo'],
    analysis:  ['Looking for visible symptoms.',       'The image is analyzed for crop disease patterns. This scan is an illustration of that process.', 'See the result'],
    diagnosis: ['A possible diagnosis. A next step.', 'Example: possible early blight. Review the guidance and ask an agricultural expert to confirm.', 'Create a report'],
    report:    ['An observation worth sharing.',       'The farmer chooses to share the diagnosis and field location. Nothing is submitted by this demonstration.', 'Place the signal'],
    hotspot:   ['Nearby observations form a pattern.','Similar reports in an area can reveal a cluster for agricultural officers to investigate.', 'See again'],
  };

  const mobileStages = ['soil', 'growth', 'life', 'focus', 'capture', 'diagnosis', 'report', 'hotspot'];
  const desktopStages = Object.keys(stages);

  const sequence = () => mobile.matches ? mobileStages : desktopStages;

  // ── DOM refs ───────────────────────────────────────────────────
  const byId = id => document.getElementById(id);
  let index = 0;
  let scene = null;
  let captureTimer;
  let scrollUnpin;

  function render() {
    clearTimeout(captureTimer);
    const steps = sequence();
    index = Math.min(index, steps.length - 1);
    const key = steps[index];
    const text = stages[key];

    field.dataset.stage = key;

    // Progress bar — CSS custom property approach
    const pct = ((index + 1) / steps.length * 100).toFixed(1) + '%';
    const progressEl = byId('storyProgress');
    if (progressEl) progressEl.style.setProperty('--p', pct);
    if (progressEl) progressEl.setAttribute('aria-valuenow', index + 1);

    byId('stageIndicator').textContent = text[0];
    byId('stageCaption').textContent = text[1];
    byId('prevStageBtn').disabled = index === 0;
    byId('nextStageBtn').textContent = (index === steps.length - 1 ? 'See again' : text[2]) + ' →';

    byId('viewfinderReticle').hidden = !['capture', 'analysis'].includes(key);
    byId('viewfinderReticle').classList.toggle('scanning', key === 'analysis');
    byId('focusStatus').textContent = key === 'analysis' ? 'Analyzing crop symptoms…' : 'Focus locked · ready to capture';
    byId('storyResult').hidden = key !== 'diagnosis';
    byId('storyReport').hidden = key !== 'report';
    byId('storyRegion').hidden = !['hotspot'].includes(key);
    byId('regionTitle').textContent = key === 'hotspot' ? 'Several reports. One area to investigate.' : 'One observation on the map.';
    byId('storyOfficerLink').hidden = key !== 'hotspot';
    byId('specimenLabel').textContent = ['report', 'hotspot'].includes(key) ? 'From local to regional' : 'Solanum lycopersicum';

    // Leaf note visible only on life stage
    const leafNote = document.querySelector('.leaf-note');
    if (leafNote) leafNote.style.opacity = key === 'life' ? '1' : '0';

    if (key === 'capture') {
      captureTimer = setTimeout(() => {
        byId('focusStatus').textContent = 'Photo captured';
      }, 850);
    }

    scene?.setStage(key);
  }

  // ── Button controls ───────────────────────────────────────────
  byId('prevStageBtn').addEventListener('click', () => { index = Math.max(0, index - 1); render(); });
  byId('nextStageBtn').addEventListener('click', () => {
    index = (index + 1) % sequence().length;
    render();
  });

  mobile.addEventListener('change', () => { index = 0; render(); });

  // ── Scroll-driven story ───────────────────────────────────────
  // The hero section scrolls naturally. We listen to scroll and map
  // window.scrollY to stage progress. No scroll-jacking, no pinning.
  function setupScrollStory() {
    if (reducedMotion.matches) return; // Skip scroll story if reduced motion

    function onScroll() {
      const heroEl = document.querySelector('.hero');
      if (!heroEl) return;
      const rect = heroEl.getBoundingClientRect();
      const heroHeight = heroEl.offsetHeight;
      const viewH = window.innerHeight;

      // Progress: 0 at top of hero, 1 when hero bottom hits viewport top
      const scrolled = -rect.top;
      const total = heroHeight - viewH;
      if (total <= 0) return;

      const p = Math.max(0, Math.min(1, scrolled / total));
      const steps = sequence();
      const targetIndex = Math.floor(p * steps.length);
      const clampedIndex = Math.min(targetIndex, steps.length - 1);

      if (clampedIndex !== index) {
        index = clampedIndex;
        render();
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    scrollUnpin = () => window.removeEventListener('scroll', onScroll);
  }

  render();
  setupScrollStory();

  // ── Load 3D engine after layout is painted ────────────────────
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    try {
      const { Hero3DExperience } = await import('./hero-3d.js?v=3');
      scene = new Hero3DExperience(field);
      await scene.init();
      scene.setStage(sequence()[index]);
    } catch (error) {
      scene?.dispose();
      field.dataset.modelError = error.message;
      field.dataset.modelStatus = 'fallback';
      byId('hero3dFallback').hidden = false;
      byId('heroLoaderStatus').textContent = 'Explore the story with the controls below.';
    }
  }));
})();
