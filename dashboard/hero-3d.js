import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

/**
 * KrishiRakshak — 3D Hero Experience
 *
 * Stage flow: soil → growth → life → focus → capture → analysis → diagnosis → report → hotspot
 *
 * Growth mechanic:
 *   - At 'soil' stage: plant scale.y = 0.02 (invisible at base), soil stationary
 *   - At 'growth' stage: animated scale.y ramps from 0.02 to 1.0 over time
 *   - At 'life'+: plant at full scale with natural idle sway
 *
 * Camera: fixed upper-front states. No OrbitControls. No continuous spinning.
 * Soil: completely stationary, no animation.
 * DiseasedLeaf underside: camera stays on upper-front angle to avoid geometry imperfection.
 */
export class Hero3DExperience {
  constructor(container) {
    this.container = container;
    this.canvas = document.getElementById('hero3dCanvas');
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.mobile = matchMedia('(max-width: 760px)');
    this.stage = 'soil';
    this.visible = true;
    this.frame = 0;
    this.lastFrame = 0;
    this.render = this.render.bind(this);
    this.look = new THREE.Vector3();
    this.fromLook = new THREE.Vector3();
    this.targetLook = new THREE.Vector3();
    this.fromPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.focusOverlay = document.getElementById('viewfinderReticle');
    this.transitionAt = 0;
    // Growth state
    this.growthProgress = 0;  // 0 = soil only, 1 = fully grown
    this.growthTarget = 0;
    this.growthStart = 0;
    this.growthDuration = 2200; // ms — time to grow from soil to full
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !this.mobile.matches,
      powerPreference: 'low-power',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 40);

    // Lighting — warm natural outdoor setup
    this.scene.add(new THREE.HemisphereLight(0xf1f3df, 0x4a3b29, 2));
    const key = new THREE.DirectionalLight(0xffefcf, 3.1);
    key.position.set(-2, 4, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5d0ad, 1.4);
    fill.position.set(3, 2, -1);
    this.scene.add(fill);

    // Load GLB — retains original embedded textures and materials
    const gltf = await new GLTFLoader().loadAsync('/models/TomatoPlant_Final.glb');
    this.root = gltf.scene;
    this.soil = this.root.getObjectByName('Soil');
    this.plant = this.root.getObjectByName('TomatoPlant');
    this.leaf = this.root.getObjectByName('DiseasedLeaf');

    if (!this.soil || !this.plant || !this.leaf) {
      this.dispose();
      throw new Error('Expected plant hierarchy incomplete: Soil, TomatoPlant, DiseasedLeaf');
    }

    this.scene.add(this.root);
    this.root.updateMatrixWorld(true);

    // Compute bounds from the full scene (at full scale, for camera math)
    const bounds = new THREE.Box3().setFromObject(this.root);
    this.center = bounds.getCenter(new THREE.Vector3());
    this.size = bounds.getSize(new THREE.Vector3());
    this.soilCenter = new THREE.Box3().setFromObject(this.soil).getCenter(new THREE.Vector3());
    this.leafCenter = new THREE.Box3().setFromObject(this.leaf).getCenter(new THREE.Vector3());
    this.leafSize = new THREE.Box3().setFromObject(this.leaf).getSize(new THREE.Vector3());

    /**
     * Growth pivot group — anchored at the SOIL TOP / STEM BASE.
     * We move plant and leaf into this group, positioned at soil-top level,
     * then scale the group vertically. The base stays planted in the soil.
     */
    this.growth = new THREE.Group();
    // Anchor position: stem base = bottom of the plant mesh world position
    const plantBounds = new THREE.Box3().setFromObject(this.plant);
    const stemBase = new THREE.Vector3(plantBounds.min.x, plantBounds.min.y, plantBounds.min.z);
    // Center of soil top is our anchor
    const soilBounds = new THREE.Box3().setFromObject(this.soil);
    const soilTopY = soilBounds.max.y;
    // Position growth group at soil surface
    this.growth.position.set(stemBase.x, soilTopY, stemBase.z);
    this.root.add(this.growth);

    // Re-attach plant and leaf to growth group, adjusting local position
    const plantWorldPos = new THREE.Vector3();
    this.plant.getWorldPosition(plantWorldPos);
    this.root.remove(this.plant);
    this.growth.add(this.plant);
    this.plant.position.set(
      plantWorldPos.x - this.growth.position.x,
      plantWorldPos.y - this.growth.position.y,
      plantWorldPos.z - this.growth.position.z,
    );

    const leafWorldPos = new THREE.Vector3();
    this.leaf.getWorldPosition(leafWorldPos);
    this.root.remove(this.leaf);
    this.growth.add(this.leaf);
    this.leaf.position.set(
      leafWorldPos.x - this.growth.position.x,
      leafWorldPos.y - this.growth.position.y,
      leafWorldPos.z - this.growth.position.z,
    );

    this.leafRest = this.leaf.rotation.clone();

    // Recompute leaf center after reparenting (in growth-group local space)
    this.leafWorldCenter = () => {
      const pos = new THREE.Vector3();
      this.leaf.getWorldPosition(pos);
      return pos;
    };

    // Start with plant nearly invisible (just peeking above soil)
    this.growth.scale.set(1, 0.02, 1);
    this.growthProgress = 0;

    this.enterAt = performance.now();
    this.resize();
    this.setStage('soil', true);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      this.schedule();
    }, { threshold: 0 });
    this.observer.observe(this.container);

    this.onVisibility = () => this.schedule();
    document.addEventListener('visibilitychange', this.onVisibility);

    this.onMotion = () => {
      this.growth.rotation.set(0, 0, 0);
      this.leaf.rotation.copy(this.leafRest);
      this.setStage(this.stage, true);
    };
    this.motion.addEventListener('change', this.onMotion);

    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.failed = true;
      cancelAnimationFrame(this.frame);
      this.container.dataset.modelStatus = 'fallback';
      document.getElementById('hero3dFallback').hidden = false;
      document.getElementById('heroLoaderStatus').textContent =
        'The plant preview paused. Explore the story or open the Farmer Portal.';
    });

    // QA metadata
    this.container.dataset.modelStatus = 'loaded';
    this.container.dataset.objects = [this.plant.name, this.leaf.name, this.soil.name].join(',');
    document.getElementById('hero3dFallback').hidden = true;
    this.schedule();
  }

  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile.matches ? 1.25 : 1.5));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.root) this.setStage(this.stage, true);
  }

  setStage(stage, immediate = false) {
    if (!this.root) return;
    const prevStage = this.stage;
    this.stage = stage;
    this.fromPosition.copy(this.camera.position);
    this.fromLook.copy(this.look);

    const fov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const distance = Math.max(
      this.size.y / 2 / Math.tan(fov),
      this.size.x / 2 / (Math.tan(fov) * this.camera.aspect),
    ) * 1.18;

    // ── Camera states ──────────────────────────────────────────
    // STATE A — SOIL / GROWTH: look at soil + lower plant, show ground relationship
    if (['soil', 'growth'].includes(stage)) {
      this.targetLook.set(this.center.x, this.soilCenter.y + this.size.y * 0.25, this.center.z);
      this.targetPosition.set(this.center.x + 0.1, this.soilCenter.y + this.size.y * 0.3, distance * 0.95);
    }
    // STATE B — FULL PLANT: balanced full composition
    else if (stage === 'life') {
      this.targetLook.copy(this.center);
      this.targetPosition.set(this.center.x + 0.14, this.center.y + 0.36, distance);
    }
    // STATE C — DISEASE FOCUS: upper-front, above leaf center (avoid underside)
    else if (['focus', 'capture', 'analysis', 'diagnosis'].includes(stage)) {
      const lc = this.leafWorldCenter ? this.leafWorldCenter() : this.leafCenter;
      this.targetLook.copy(lc);
      const close = stage === 'focus' ? 1.14 : stage === 'diagnosis' ? 1.2 : 0.83;
      // Always stay above the leaf center to avoid geometry imperfection on underside
      this.targetPosition.copy(lc).add(new THREE.Vector3(0.06, 0.44, close));
    }
    // STATE D — REPORT / HOTSPOT: pull back
    else if (['report', 'hotspot'].includes(stage)) {
      this.targetLook.set(this.center.x, this.center.y + 0.1, this.center.z);
      this.targetPosition.set(this.center.x + 0.18, this.center.y + 0.7, distance * 1.08);
    }

    // Start growth animation when transitioning to 'growth' stage
    if (stage === 'growth' && prevStage === 'soil') {
      this.growthTarget = 1;
      this.growthStart = performance.now();
    }
    // When jumping past growth to life+, ensure plant is fully grown
    if (!['soil', 'growth'].includes(stage) && this.growthProgress < 1) {
      this.growthTarget = 1;
      this.growthProgress = 1;
      this.growth.scale.set(1, 1, 1);
    }
    // Jumping back to soil: reset plant
    if (stage === 'soil') {
      this.growthTarget = 0;
      this.growthProgress = 0;
      this.growth.scale.set(1, 0.02, 1);
    }

    this.transitionAt = performance.now();
    if (immediate || this.motion.matches) {
      this.camera.position.copy(this.targetPosition);
      this.look.copy(this.targetLook);
      this.transitionAt -= 1200;
    }
    this.schedule();
  }

  schedule() {
    if (this.failed || !this.root || !this.visible || document.hidden || this.frame) return;
    this.frame = requestAnimationFrame(this.render);
  }

  render(now) {
    this.frame = 0;
    if (this.failed || !this.visible || document.hidden) return;
    // Cap to ~30fps on mobile for battery
    if (now - this.lastFrame < (this.mobile.matches ? 40 : 20)) { this.schedule(); return; }
    this.lastFrame = now;

    // ── Camera transition ──────────────────────────────────────
    const progress = Math.min(1, Math.max(0, (now - this.transitionAt) / 1100));
    const eased = 1 - Math.pow(1 - progress, 3);
    if (!this.motion.matches && progress < 1) {
      this.camera.position.lerpVectors(this.fromPosition, this.targetPosition, eased);
      this.look.lerpVectors(this.fromLook, this.targetLook, eased);
    } else {
      this.camera.position.copy(this.targetPosition);
      this.look.copy(this.targetLook);
    }
    this.camera.lookAt(this.look);

    // ── Growth animation (soil → growth stage) ─────────────────
    if (!this.motion.matches && this.growthProgress < this.growthTarget) {
      const elapsed = Math.max(0, now - this.growthStart);
      const t = Math.min(1, elapsed / this.growthDuration);
      // Ease out cubic — starts fast, settles gently
      const easeOut = 1 - Math.pow(1 - t, 3);
      this.growthProgress = easeOut;
      // Scale Y from 0.02 to 1.0 — X/Z stay 1 so base stays anchored
      const scaleY = 0.02 + 0.98 * easeOut;
      this.growth.scale.set(1, scaleY, 1);
    }

    // ── Natural idle motion (life+, no rotation, no spin) ─────
    if (!this.motion.matches && !['soil', 'growth'].includes(this.stage)) {
      const entrance = Math.min(1, (now - this.enterAt) / 1500);
      const entranceBob = 0.88 + 0.12 * (1 - Math.pow(1 - entrance, 3));
      // Ensure Y scale stays at 1 once fully grown
      const baseScale = this.growthProgress >= 1 ? 1 : this.growth.scale.y;
      this.growth.scale.setY(Math.max(baseScale, this.growthProgress >= 1 ? 1 : entranceBob));
      // Very subtle natural sway — NOT continuous rotation
      this.growth.rotation.z = Math.sin(now * 0.00065) * 0.004;
      this.leaf.rotation.z = this.leafRest.z + Math.sin(now * 0.0008) * 0.002;
    } else if (this.motion.matches) {
      this.growth.rotation.set(0, 0, 0);
      this.leaf.rotation.copy(this.leafRest);
    }

    this.renderer.render(this.scene, this.camera);

    // Project leaf center for viewfinder overlay
    const leafPos = this.leafWorldCenter ? this.leafWorldCenter() : this.leafCenter;
    this.projected.copy(leafPos).project(this.camera);
    const reticle = this.focusOverlay;
    if (reticle) {
      reticle.style.left = `${(this.projected.x * 0.5 + 0.5) * 100}%`;
      reticle.style.top = `${(-this.projected.y * 0.5 + 0.5) * 100}%`;
    }

    // Keep rendering during transitions, growth, or idle stages
    const needsContinuous = (
      progress < 1 ||
      this.growthProgress < this.growthTarget ||
      (!this.motion.matches && !['soil', 'signal', 'hotspot', 'officer'].includes(this.stage))
    );
    if (needsContinuous) this.schedule();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.onMotion) this.motion.removeEventListener('change', this.onMotion);
    this.root?.traverse(obj => {
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.filter(Boolean).forEach(mat => {
        for (const value of Object.values(mat)) if (value?.isTexture) value.dispose();
        mat.dispose();
      });
    });
    this.renderer?.dispose();
  }
}
