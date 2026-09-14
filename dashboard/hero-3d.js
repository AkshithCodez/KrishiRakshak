/**
 * KrishiRakshak — Hero 3D Experience
 *
 * Architecture:
 *   - One persistent Three.js scene; no OrbitControls; no user interaction.
 *   - Normalized scroll progress (0–1) drives everything: growth, camera, markers.
 *   - Plant grows root-anchored from soil (scale from stem base, Y up only first).
 *   - Soil is always stationary — never attached to growth group.
 *   - Camera travels through 5 deliberate states interpolated by smoothstep.
 *   - Region markers and hotspot halo appear in the final quarter.
 *   - Idle sway is restrained (leaf barely moves in breeze) — only during life stage.
 *   - Performance: on-demand rendering, IntersectionObserver pause, DPR cap.
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

// ── Math helpers ──────────────────────────────────────────────────────────────
const clamp  = n => Math.max(0, Math.min(1, n));
const lerp   = (a, b, t) => a + (b - a) * t;
// smoothstep — maps range [a,b] to eased [0,1]
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
// ease-out cubic
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);

export class Hero3DExperience {
  constructor(container, { onError = () => {} } = {}) {
    this.container  = container;
    this.canvas     = container.querySelector('canvas');
    this.onError    = onError;
    this.motion     = matchMedia('(prefers-reduced-motion: reduce)');
    this.mobile     = matchMedia('(max-width: 760px)');
    this.progress   = 0;
    this.visible    = true;
    this.frame      = 0;
    this.lastFrame  = 0;
    this.wakeUntil  = 0;
    this.look       = new THREE.Vector3();
    this.reportPos  = new THREE.Vector3();
    this.render     = this.render.bind(this);
  }

  async init() {
    // ── Renderer ─────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: !this.mobile.matches,
      powerPreference: 'low-power',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping      = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    // ── Scene + Camera ────────────────────────────────────────────────────────
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.01, 60);

    // ── Lighting — warm outdoor, no expensive shadows ─────────────────────────
    this.scene.add(new THREE.HemisphereLight(0xf0f2e4, 0x4a3b29, 1.9));
    const key  = new THREE.DirectionalLight(0xfff0d8, 2.9);
    key.position.set(-2.2, 4.5, 3.8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc2d0a8, 1.3);
    fill.position.set(3.2, 1.8, -1.2);
    this.scene.add(fill);

    // Context loss → graceful fallback
    this.onContextLost = e => { e.preventDefault(); this.onError(new Error('WebGL context lost')); };
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);

    // ── Load GLB ─────────────────────────────────────────────────────────────
    const gltf = await new GLTFLoader().loadAsync('/models/TomatoPlant_Final.glb');
    this.root  = gltf.scene;

    // Discover named nodes — inspect first in case names differ slightly
    this.soil  = this.root.getObjectByName('Soil');
    this.plant = this.root.getObjectByName('TomatoPlant');
    this.leaf  = this.root.getObjectByName('DiseasedLeaf');

    if (!this.soil || !this.plant || !this.leaf) {
      // Fallback: try to find by type if names mismatch
      const meshes = [];
      this.root.traverse(o => { if (o.isMesh) meshes.push(o); });
      console.warn('[hero-3d] Expected Soil, TomatoPlant, DiseasedLeaf. Found:', meshes.map(m => m.name));
      throw new Error('GLB missing expected nodes: Soil, TomatoPlant, DiseasedLeaf');
    }

    this.scene.add(this.root);
    this.root.updateMatrixWorld(true);

    // ── Compute geometry bounds ───────────────────────────────────────────────
    const rootBounds = new THREE.Box3().setFromObject(this.root);
    this.center      = rootBounds.getCenter(new THREE.Vector3());
    this.size        = rootBounds.getSize(new THREE.Vector3());

    const soilBounds = new THREE.Box3().setFromObject(this.soil);
    this.soilCenter  = soilBounds.getCenter(new THREE.Vector3());
    this.soilTopY    = soilBounds.max.y;

    const leafBounds = new THREE.Box3().setFromObject(this.leaf);
    this.leafCenter  = leafBounds.getCenter(new THREE.Vector3());
    this.leafSize    = leafBounds.getSize(new THREE.Vector3());

    const plantBounds = new THREE.Box3().setFromObject(this.plant);
    this.plantBase    = new THREE.Vector3(
      (plantBounds.min.x + plantBounds.max.x) / 2,
      plantBounds.min.y,     // bottom of the plant mesh = stem root
      (plantBounds.min.z + plantBounds.max.z) / 2,
    );

    // ── Growth group — root-anchored at the stem base ─────────────────────────
    // The group sits at stemBase world position.
    // Group.attach() preserves world transform so plant/leaf keep their position
    // relative to the scene, but the group's LOCAL scale pivot is at stemBase.
    //
    // Result: scaling growth group scales plant UP from the stem base, not from
    // model center. Soil is never in this group — it stays fixed.
    this.stemBase = this.plant.getWorldPosition(new THREE.Vector3());
    // Use the computed plantBase Y (bottom of plant) as the actual anchor
    this.stemBase.y = this.plantBase.y;

    this.growth = new THREE.Group();
    this.growth.position.copy(this.stemBase);
    this.scene.add(this.growth);
    this.growth.updateMatrixWorld(true);
    // Reparent plant and leaf INTO growth group, preserving their world positions
    this.growth.attach(this.plant);
    this.growth.attach(this.leaf);

    // Store leaf rest rotation for idle animation reference
    this.leafRestRot = this.leaf.rotation.clone();

    // Store soil rest — soil stays in root, never moves
    // (no-op, just explicit documentation)

    // ── Start with plant essentially invisible (scale at stem base) ───────────
    // Y is 0.005 (barely a sliver), X/Z 0.05 (tight stub so it reads as a shoot)
    this.growth.scale.set(0.05, 0.005, 0.05);

    // ── Region visualization (illustrative field map) ─────────────────────────
    this.buildRegion();

    // ── Camera setup ─────────────────────────────────────────────────────────
    this.resize();

    // ── Lifecycle observers ───────────────────────────────────────────────────
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      if (!this.visible) { cancelAnimationFrame(this.frame); this.frame = 0; }
      else { this.wakeUntil = performance.now() + 600; this.schedule(); }
    });
    this.observer.observe(this.container);

    this.onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; }
      else { this.wakeUntil = performance.now() + 800; this.schedule(); }
    };
    document.addEventListener('visibilitychange', this.onVisibility);

    this.onPageHide = () => { cancelAnimationFrame(this.frame); this.frame = 0; };
    this.onPageShow = () => {
      this.wakeUntil = performance.now() + 800;
      this.onPageHide(); this.resize();
      requestAnimationFrame(() => this.schedule());
    };
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);

    this.onMotion = () => { this.resize(); this.schedule(); };
    this.motion.addEventListener('change', this.onMotion);

    // Paint during the canvas reveal transition
    this.wakeUntil = performance.now() + 1000;
    this.container.dataset.modelStatus = 'loaded';
    this.container.dataset.objects = [this.plant.name, this.leaf.name, this.soil.name].join(',');
    document.getElementById('hero3dFallback').hidden = true;
    this.schedule();
  }

  // ── Region / hotspot geometry ─────────────────────────────────────────────
  buildRegion() {
    // Procedural field map — illustrative cadastral grid, not a real map
    const paper = document.createElement('canvas');
    paper.width = 1024; paper.height = 700;
    const ctx = paper.getContext('2d');
    ctx.fillStyle = '#111a13'; ctx.fillRect(0, 0, 1024, 700);

    const rows = [0, 220, 455, 700], cols = [0, 182, 412, 622, 824, 1024];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const x = cols[c] + 8, y = rows[r] + 8;
        const w = cols[c + 1] - cols[c] - 16, h = rows[r + 1] - rows[r] - 16;
        ctx.fillStyle = (r + c) % 3 === 0 ? '#1f2f22' : '#192419';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#445840'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
        // Row crop lines
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.strokeStyle = 'rgba(110,140,100,.1)'; ctx.lineWidth = 2;
        for (let s = -h; s < w + h; s += 14) {
          ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s + h * 0.38, y + h); ctx.stroke();
        }
        ctx.restore();
      }
    }
    // A road / waterway
    ctx.strokeStyle = 'rgba(181,160,107,.35)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 445); ctx.bezierCurveTo(340, 410, 640, 520, 1024, 448); ctx.stroke();

    this.mapTex = new THREE.CanvasTexture(paper);
    this.mapTex.colorSpace = THREE.SRGBColorSpace;
    this.mapMat = new THREE.MeshBasicMaterial({ map: this.mapTex, transparent: true, opacity: 0, depthWrite: false });
    this.map    = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.6), this.mapMat);
    this.map.rotation.x = -Math.PI / 2;
    this.map.position.set(0, this.soilCenter.y - 0.04, 0);
    this.scene.add(this.map);

    // Signal dots
    this.region     = new THREE.Group();
    this.region.position.y = this.soilCenter.y + 0.09;
    this.scene.add(this.region);

    this.dotGeo = new THREE.SphereGeometry(0.052, 10, 7);
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0xc7b75f });

    const positions = [[0,0],[0.5,0.3],[-0.44,0.44],[0.32,-0.52],[-0.46,-0.35],[2.1,-1.35],[-2.1,1.4],[-1.8,-1.2],[2.4,0.9]];
    this.markers = positions.map(([x, z]) => {
      const dot = new THREE.Mesh(this.dotGeo, this.dotMat);
      dot.position.set(x, 0.025, z);
      dot.scale.setScalar(0);
      this.region.add(dot);
      return dot;
    });

    // Halo ring (hotspot cluster ring)
    this.haloMat = new THREE.MeshBasicMaterial({ color: 0xc7b75f, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    this.halo    = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.835, 64), this.haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.012;
    this.region.add(this.halo);

    // Area fill
    this.areaMat = new THREE.MeshBasicMaterial({ color: 0xc7b75f, transparent: true, opacity: 0, depthWrite: false });
    this.area    = new THREE.Mesh(new THREE.CircleGeometry(0.8, 64), this.areaMat);
    this.area.rotation.x = -Math.PI / 2;
    this.area.position.y = 0.005;
    this.region.add(this.area);

    // Report dot (travels from leaf center to map center)
    this.reportDot   = new THREE.Mesh(this.dotGeo, this.dotMat);
    this.reportEnd   = new THREE.Vector3(0, this.region.position.y + 0.025, 0);
    this.reportDot.scale.setScalar(0);
    this.scene.add(this.reportDot);
  }

  // ── Camera key states ─────────────────────────────────────────────────────
  buildCameraKeys() {
    const mob    = this.mobile.matches;
    const center = this.center;
    const soil   = this.soilCenter;
    const leaf   = this.leafCenter;

    // Distances tuned for the FOV and scene bounds
    const distFull = mob ? Math.max(7.8, 2.7 / this.camera.aspect) : 3.7;
    const distNear = mob ? Math.max(1.9, 0.74 / this.camera.aspect) : 1.1;
    const distSoil = mob ? 3.1 : 2.0;

    // Horizontal offset for left/right composition
    const rPx = mob ? 0.50 : 0.73;   // x offset in ViewOffset: plant to the right
    const lPx = mob ? 0.50 : 0.30;   // plant centered-left for full-plant stage

    // Convenience builder: (progress, lookTarget, cameraDelta, xComposition, yComposition)
    const mk = (p, look, dx, dy, dz, x, y = 0.50) => ({
      p,
      look:     look.clone(),
      position: look.clone().add(new THREE.Vector3(dx, dy, dz)),
      x, y,
    });

    // Soil look: slightly above soil center to frame emerging stem
    const soilLook = soil.clone().add(new THREE.Vector3(0, 0.12, 0));
    const regionLook = soil.clone();
    const introY = mob ? 0.74 : 0.55;

    this.keys = [
      // STATE A — SOIL / INTRO (0.00–0.08)
      mk(0.00, soilLook,  0.08, 0.65, distSoil, rPx, introY),
      mk(0.08, soilLook,  0.08, 0.65, distSoil, rPx, mob ? 0.32 : 0.55),

      // STATE A→B transition: plant starts growing (0.08–0.25)
      // Camera slowly lifts and pans to show more of the plant
      mk(0.22, center,   0.10, 0.42, distFull, lPx, mob ? 0.32 : 0.52),

      // STATE B — FULL PLANT (0.25–0.35)
      mk(0.25, center,   0.14, 0.40, distFull, lPx, mob ? 0.32 : 0.50),
      mk(0.34, center,   0.14, 0.40, distFull, lPx, mob ? 0.32 : 0.50),

      // STATE C — DISEASE FOCUS (0.35–0.48)
      // Upper-front angle — stays above leaf center, never sees the underside
      mk(0.48, leaf,     0.06, 0.48, distNear * 1.4, rPx, mob ? 0.32 : 0.50),

      // STATE D — CAPTURE / SCAN (0.48–0.70)
      mk(0.56, leaf,     0.06, 0.46, distNear,       rPx, mob ? 0.32 : 0.50),
      mk(0.78, leaf,     0.06, 0.46, distNear,       rPx, mob ? 0.32 : 0.50),

      // STATE E — REPORT → REGIONAL (0.78–1.00)
      // Pull back to reveal the illustrative map
      mk(0.87, regionLook, 0.28, 3.1, 5.8, rPx, mob ? 0.32 : 0.50),
      mk(0.96, regionLook, 0.28, mob ? 15 : 9.5, mob ? 22 : 10.5, rPx, mob ? 0.32 : 0.50),
      mk(1.00, regionLook, 0.28, mob ? 15 : 9.5, mob ? 22 : 10.5, rPx, mob ? 0.32 : 0.50),
    ];

    // Reduced motion: fixed balanced view of full plant
    if (this.motion.matches) {
      const d = Math.max(3.4, 2.6 / this.camera.aspect);
      this.keys = [mk(0, center, 0.14, 0.4, d, 0.5), mk(1, center, 0.14, 0.4, d, 0.5)];
    }
  }

  resize() {
    if (!this.renderer || !this.root) return;
    this.width  = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile.matches ? 1.25 : 1.5));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.updateProjectionMatrix();
    this.buildCameraKeys();
    this.schedule();
  }

  setProgress(p) {
    this.progress = clamp(p);
    this.schedule();
  }

  schedule() {
    if (this.disposed || !this.root || !this.visible || document.hidden || this.frame) return;
    this.frame = requestAnimationFrame(this.render);
  }

  render(now) {
    this.frame = 0;
    if (this.disposed || !this.visible || document.hidden) return;
    // Frame rate cap: ~50fps desktop, ~30fps mobile
    if (now - this.lastFrame < (this.mobile.matches ? 34 : 20)) { this.schedule(); return; }
    this.lastFrame = now;

    const p = this.motion.matches ? 0.30 : this.progress;

    // ── Plant growth ─────────────────────────────────────────────────────────
    // smooth(.08, .25, p) → 0 before 8%, 1 after 25%
    const growthT = smooth(0.08, 0.25, p);
    // Start extremely small at base; grow to full size
    // X/Z get a slight lag so the plant feels like it's pushing UP first
    const scaleXZ = easeOut(smooth(0.10, 0.26, p));
    const scaleY  = easeOut(growthT);
    this.growth.scale.set(
      0.02 + 0.98 * scaleXZ,
      0.005 + 0.995 * scaleY,
      0.02 + 0.98 * scaleXZ,
    );

    // ── Idle sway — only during the 'life' hold (p ≈ 0.25–0.35) ─────────────
    const swayAmt = smooth(0.27, 0.32, p) * (1 - smooth(0.33, 0.38, p));
    if (!this.motion.matches && swayAmt > 0) {
      // Very gentle breeze — max 0.003 radians
      this.growth.rotation.z = Math.sin(now * 0.00058) * 0.003 * swayAmt;
      this.leaf.rotation.z   = this.leafRestRot.z + Math.sin(now * 0.00082) * 0.0015 * swayAmt;
    } else {
      this.growth.rotation.z = 0;
      if (this.leaf) this.leaf.rotation.z = this.leafRestRot?.z ?? 0;
    }

    // ── Camera interpolation ──────────────────────────────────────────────────
    let next = 1;
    while (next < this.keys.length - 1 && p > this.keys[next].p) next++;
    const a = this.keys[next - 1];
    const b = this.keys[next];
    const t = smooth(a.p, b.p, p);

    this.camera.position.lerpVectors(a.position, b.position, t);
    this.look.lerpVectors(a.look, b.look, t);
    this.camera.lookAt(this.look);

    // ── Horizontal composition offset ─────────────────────────────────────────
    // Plant sits on right side of frame during soil/growth; centers for full plant;
    // shifts back right for leaf focus.
    const xBase   = this.motion.matches || this.mobile.matches ? 0.50 : 0.73;
    const xShift  = -0.43 * smooth(0.05, 0.14, p) + 0.43 * smooth(0.34, 0.44, p);
    const x       = xBase + (this.mobile.matches ? 0 : xShift);
    const y       = lerp(a.y, b.y, t);
    this.camera.setViewOffset(this.width, this.height, (0.5 - x) * this.width, (0.5 - y) * this.height, this.width, this.height);
    this.camera.updateProjectionMatrix();

    // ── Region / map ──────────────────────────────────────────────────────────
    const showMap  = p > 0.79 && !this.motion.matches;
    this.map.visible    = showMap;
    this.region.visible = p > 0.845 && !this.motion.matches;
    this.mapMat.opacity = smooth(0.79, 0.87, p);

    // Report dot: travels from leaf toward map center
    const showReport = p > 0.815 && p < 0.88 && !this.motion.matches;
    this.reportDot.visible = showReport;
    if (showReport) {
      this.reportPos.lerpVectors(this.leafCenter, this.reportEnd, smooth(0.815, 0.865, p));
      this.reportDot.position.copy(this.reportPos);
      this.reportDot.scale.setScalar(smooth(0.815, 0.84, p));
    }

    // Markers appear staggered
    this.markers.forEach((dot, i) => {
      const start = i === 0 ? 0.86 : 0.87 + i * 0.007;
      const end   = i === 0 ? 0.875 : 0.90 + i * 0.007;
      dot.scale.setScalar(smooth(start, end, p));
    });

    // Hotspot halo and area fill
    const regionGrowth = smooth(0.925, 0.99, p);
    this.halo.scale.setScalar(0.2 + 0.8 * regionGrowth);
    this.haloMat.opacity = 0.72 * regionGrowth;
    this.area.scale.setScalar(0.2 + 0.8 * regionGrowth);
    this.areaMat.opacity = 0.08 * regionGrowth;

    // ── Render ────────────────────────────────────────────────────────────────
    this.renderer.render(this.scene, this.camera);

    // Schedule next frame only when needed (idle during life stage sway, or
    // during active camera travel / growth). Pauses when static.
    const needsContinuous =
      now < this.wakeUntil ||
      (!this.motion.matches && swayAmt > 0) ||
      p > 0 && p < 1;
    if (needsContinuous) this.schedule();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame); this.frame = 0;
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    this.motion.removeEventListener('change', this.onMotion);
    this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    const geos = new Set(), mats = new Set(), texs = new Set();
    this.scene?.traverse(obj => {
      if (obj.geometry) geos.add(obj.geometry);
      const ms = Array.isArray(obj.material) ? obj.material : [obj.material];
      ms.filter(Boolean).forEach(m => {
        mats.add(m);
        Object.values(m).forEach(v => { if (v?.isTexture) texs.add(v); });
      });
    });
    geos.forEach(g => g.dispose());
    mats.forEach(m => m.dispose());
    texs.forEach(t => t.dispose());
    this.renderer?.dispose();
  }
}
