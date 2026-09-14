import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

/** Fixed, upper-front camera states; original GLB materials and UVs remain untouched. */
export class Hero3DExperience {
  constructor(container) {
    this.container = container;
    this.canvas = document.getElementById('hero3dCanvas');
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.mobile = matchMedia('(max-width: 760px)');
    this.stage = 'life';
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
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({canvas:this.canvas, alpha:true, antialias:!this.mobile.matches, powerPreference:'low-power'});
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38,1,.01,40);
    this.scene.add(new THREE.HemisphereLight(0xf1f3df,0x4a3b29,2));
    const key = new THREE.DirectionalLight(0xffefcf,3.1);
    key.position.set(-2,4,4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5d0ad,1.4);
    fill.position.set(3,2,-1);
    this.scene.add(fill);
    // The GLB contains embedded WebP base-color, normal and metallic/roughness textures.
    const gltf = await new GLTFLoader().loadAsync('/models/TomatoPlant_Final.glb');
    this.root = gltf.scene;
    this.soil = this.root.getObjectByName('Soil');
    this.plant = this.root.getObjectByName('TomatoPlant');
    this.leaf = this.root.getObjectByName('DiseasedLeaf');
    if (!this.soil || !this.plant || !this.leaf) {
      this.dispose();
      throw new Error('Prepared plant hierarchy is incomplete');
    }
    this.scene.add(this.root);
    this.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.root);
    this.center = bounds.getCenter(new THREE.Vector3());
    this.size = bounds.getSize(new THREE.Vector3());
    this.leafCenter = new THREE.Box3().setFromObject(this.leaf).getCenter(new THREE.Vector3());
    this.leafSize = new THREE.Box3().setFromObject(this.leaf).getSize(new THREE.Vector3());
    // Pivot the plant and its attached leaf together at the stem base, never the soil.
    this.growth = new THREE.Group();
    this.growth.position.set(this.plant.position.x,this.plant.position.y,this.plant.position.z);
    this.root.add(this.growth);
    this.growth.attach(this.plant);
    this.growth.attach(this.leaf);
    this.leafRest = this.leaf.rotation.clone();
    this.enterAt = performance.now();
    this.resize();
    this.setStage('life',true);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      this.schedule();
    },{threshold:0});
    this.observer.observe(this.container);
    this.onVisibility = () => this.schedule();
    document.addEventListener('visibilitychange',this.onVisibility);
    this.onMotion = () => { this.growth.rotation.set(0,0,0); this.growth.scale.setScalar(1); this.leaf.rotation.copy(this.leafRest); this.setStage(this.stage,true); };
    this.motion.addEventListener('change',this.onMotion);
    this.canvas.addEventListener('webglcontextlost',event => {
      event.preventDefault();
      this.failed = true;
      cancelAnimationFrame(this.frame);
      this.container.dataset.modelStatus = 'fallback';
      document.getElementById('hero3dFallback').hidden = false;
      document.getElementById('heroLoaderStatus').textContent = 'The plant preview paused. You can still explore the story or check your crop.';
    });
    // Inspectable rendering metadata for local QA, with no application/customer data.
    this.container.dataset.soilTransform = this.soil.matrixWorld.elements.join(',');
    this.container.dataset.objects = [this.plant.name,this.leaf.name,this.soil.name].join(',');
    this.container.dataset.textures = JSON.stringify({color:!!this.leaf.material.map,normal:!!this.leaf.material.normalMap,roughness:!!this.leaf.material.roughnessMap,metalness:!!this.leaf.material.metalnessMap});
    this.container.dataset.modelStatus = 'loaded';
    document.getElementById('hero3dFallback').hidden = true;
    this.schedule();
  }

  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1,this.mobile.matches ? 1.25 : 1.5));
    this.renderer.setSize(w,h,false);
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
    if (this.root) this.setStage(this.stage,true);
  }

  setStage(stage,immediate=false) {
    if (!this.root) return;
    this.stage = stage;
    this.fromPosition.copy(this.camera.position);
    this.fromLook.copy(this.look);
    // A: full-plant three-quarter hero, framed from actual asset bounds.
    const fov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const distance = Math.max(this.size.y/2/Math.tan(fov),this.size.x/2/(Math.tan(fov)*this.camera.aspect))*1.18;
    this.targetLook.copy(this.center);
    this.targetPosition.set(this.center.x + .14,this.center.y + .36,distance);
    // B/C: approach from above/front; never orbit under the leaf attachment.
    if (['focus','capture','analysis','diagnosis'].includes(stage)) {
      this.targetLook.copy(this.leafCenter);
      const close = stage === 'focus' ? 1.14 : stage === 'diagnosis' ? 1.2 : .83;
      this.targetPosition.copy(this.leafCenter).add(new THREE.Vector3(.06,.40,close));
    }
    // D: pull back and slightly upward before the report becomes a regional view.
    if (['report','signal','hotspot','officer'].includes(stage)) {
      this.targetPosition.set(this.center.x+.18,this.center.y+.7,distance*1.08);
    }
    this.container.dataset.camera = JSON.stringify({stage:this.stage,aboveLeaf:this.targetPosition.y>this.leafCenter.y,reducedMotion:this.motion.matches});
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
    if (now - this.lastFrame < 32) { this.schedule(); return; }
    this.lastFrame = now;
    const progress = Math.min(1,Math.max(0,(now-this.transitionAt)/1100));
    const eased = 1 - Math.pow(1-progress,3);
    if (!this.motion.matches && progress < 1) {
      this.camera.position.lerpVectors(this.fromPosition,this.targetPosition,eased);
      this.look.lerpVectors(this.fromLook,this.targetLook,eased);
    } else {
      this.camera.position.copy(this.targetPosition);
      this.look.copy(this.targetLook);
    }
    this.camera.lookAt(this.look);
    if (!this.motion.matches) {
      const entrance = Math.min(1,(now-this.enterAt)/1500);
      this.growth.scale.setScalar(.88+.12*(1-Math.pow(1-entrance,3)));
      this.growth.rotation.z = Math.sin(now*.00065)*.004;
      this.leaf.rotation.z = this.leafRest.z + Math.sin(now*.0008)*.002;
    }
    this.renderer.render(this.scene,this.camera);
    // Project the actual leaf center so the focus overlay follows the camera transition.
    this.projected.copy(this.leafCenter).project(this.camera);
    const reticle = this.focusOverlay;
    reticle.style.left = `${(this.projected.x*.5+.5)*100}%`;
    reticle.style.top = `${(-this.projected.y*.5+.5)*100}%`;
    if (!this.container.dataset.triangles) this.container.dataset.triangles = this.renderer.info.render.triangles;
    if (!this.motion.matches && !['signal','hotspot','officer'].includes(this.stage)) this.schedule();
    else if(progress<1) this.schedule();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange',this.onVisibility);
    if (this.onMotion) this.motion.removeEventListener('change',this.onMotion);
    this.root?.traverse(obj => {
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.filter(Boolean).forEach(material => { for(const value of Object.values(material)) if(value?.isTexture) value.dispose(); material.dispose(); });
    });
    this.renderer?.dispose();
  }
}
