/* The DOM story works independently of WebGL. One control system, no scroll-jacking. */
(() => {
  const field = document.getElementById('hero3dContainer');
  if (!field) return;
  const mobile = matchMedia('(max-width: 760px)');
  const stages = {
    life: ['It starts with a living plant.', 'Rooted in soil. Growing quietly. A small change on one leaf can be easy to miss.', 'Look closer'],
    focus: ['One leaf asks for attention.', 'A discoloured patch is a reason to look closer. The affected leaf becomes our focus.', 'Frame the leaf'],
    capture: ['A clear photo is the first step.', 'The farmer frames the affected leaf. A focused photo gives the analysis a better starting point.', 'Analyze the photo'],
    analysis: ['Looking for visible symptoms.', 'The image is analyzed for crop disease patterns. This scan is an illustration of that process.', 'See the result'],
    diagnosis: ['A possible diagnosis. A next step.', 'Example: possible early blight. Review the guidance and ask an agricultural expert to confirm.', 'Create a report'],
    report: ['An observation worth sharing.', 'The farmer chooses to share the diagnosis and field location. Nothing is submitted by this demonstration.', 'Place the signal'],
    signal: ['One report finds its place.', 'A field observation becomes a location signal. One report alone does not establish an outbreak.', 'Connect reports'],
    hotspot: ['Nearby observations form a pattern.', 'Similar reports in an area can reveal a cluster for agricultural officers to investigate.', 'See the wider view'],
    officer: ['A wider view. An informed response.', 'Officers review regional alerts, inspect field reports and identify areas that need attention.', 'Start again']
  };
  let index = 0, scene = null, captureTimer;
  const sequence = () => mobile.matches ? ['life','focus','capture','diagnosis','report','hotspot'] : Object.keys(stages);
  const byId = id => document.getElementById(id);
  function render() {
    clearTimeout(captureTimer);
    const steps = sequence();
    index = Math.min(index, steps.length - 1);
    const key = steps[index], text = stages[key];
    field.dataset.stage = key;
    byId('storyCount').textContent = `${String(index + 1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}`;
    byId('stageIndicator').textContent = text[0];
    byId('stageCaption').textContent = mobile.matches && key === 'capture' ? 'Frame the affected leaf, capture a clear photo, then analyze its visible symptoms.' : mobile.matches && key === 'hotspot' ? 'Nearby reports form a regional picture. Officers use the dashboard to investigate areas needing attention.' : text[1];
    byId('prevStageBtn').disabled = index === 0;
    byId('nextStageBtn').textContent = (index === steps.length - 1 ? 'Start again' : mobile.matches && key === 'capture' ? 'See the result' : mobile.matches && key === 'report' ? 'Connect reports' : text[2]) + ' →';
    byId('storyProgress').style.width = `${(index + 1) / steps.length * 100}%`;
    byId('viewfinderReticle').hidden = !['capture','analysis'].includes(key);
    byId('viewfinderReticle').classList.toggle('scanning', key === 'analysis');
    byId('focusStatus').textContent = key === 'analysis' ? 'Analyzing crop symptoms…' : 'Focus locked · ready to capture';
    byId('storyResult').hidden = key !== 'diagnosis';
    byId('storyReport').hidden = key !== 'report';
    byId('storyRegion').hidden = !['signal','hotspot','officer'].includes(key);
    byId('regionTitle').textContent = key === 'signal' ? 'One observation on the map.' : key === 'officer' ? 'Regional awareness starts in the field.' : 'Several reports. One area to investigate.';
    byId('storyOfficerLink').hidden = !(key === 'officer' || (mobile.matches && key === 'hotspot'));
    byId('specimenLabel').textContent = ['signal','hotspot','officer'].includes(key) ? 'From local to regional' : 'Solanum lycopersicum';
    if (key === 'capture') captureTimer = setTimeout(() => {
      byId('focusStatus').textContent = mobile.matches ? 'Photo captured · analyzing symptoms…' : 'Photo captured';
      if (mobile.matches) byId('viewfinderReticle').classList.add('scanning');
    }, 850);
    scene?.setStage(key);
  }
  byId('prevStageBtn').addEventListener('click', () => { index = Math.max(0,index - 1); render(); });
  byId('nextStageBtn').addEventListener('click', () => { index = (index + 1) % sequence().length; render(); });
  mobile.addEventListener('change', () => { index = 0; render(); });
  render();
  // Copy, CTA and a botanical illustration are painted before downloading the model.
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    try {
      const { Hero3DExperience } = await import('./hero-3d.js?v=2');
      scene = new Hero3DExperience(field);
      await scene.init();
      scene.setStage(sequence()[index]);
    } catch (error) {
      scene?.dispose();
      field.dataset.modelError = error.message;
      field.dataset.modelStatus = 'fallback';
      byId('hero3dFallback').hidden = false;
      byId('heroLoaderStatus').textContent = 'Explore the story with the controls below. Photo diagnosis is still available.';
    }
  }));
})();
