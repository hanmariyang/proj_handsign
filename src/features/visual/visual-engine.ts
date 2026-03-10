import * as THREE from "three";
import {
  createEmptyInteractionState,
  type InteractionState,
} from "@/features/inference/inference-types";

const PARTICLE_COUNT = 1600;

export class VisualEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly particles: THREE.Points<
    THREE.BufferGeometry,
    THREE.PointsMaterial
  >;
  private readonly haloPrimary: THREE.Mesh<
    THREE.TorusGeometry,
    THREE.MeshBasicMaterial
  >;
  private readonly haloSecondary: THREE.Mesh<
    THREE.TorusGeometry,
    THREE.MeshBasicMaterial
  >;
  private readonly core: THREE.Mesh<
    THREE.IcosahedronGeometry,
    THREE.MeshBasicMaterial
  >;
  private readonly positions: Float32Array;
  private readonly radii = new Float32Array(PARTICLE_COUNT);
  private readonly angles = new Float32Array(PARTICLE_COUNT);
  private readonly drift = new Float32Array(PARTICLE_COUNT);
  private frameId = 0;
  private lastFpsMark = performance.now();
  private frameCount = 0;
  private interaction: InteractionState = createEmptyInteractionState();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFrame?: (fps: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050812, 2.6, 8.8);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
    this.camera.position.z = 3.8;

    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const stride = index * 3;
      this.radii[index] = 0.3 + Math.random() * 1.25;
      this.angles[index] = Math.random() * Math.PI * 2;
      this.drift[index] = 0.4 + Math.random() * 1.4;

      this.positions[stride] = 0;
      this.positions[stride + 1] = 0;
      this.positions[stride + 2] = (Math.random() - 0.5) * 0.3;

      colors[stride] = 0.62 + Math.random() * 0.2;
      colors[stride + 1] = 0.72 + Math.random() * 0.22;
      colors[stride + 2] = 0.9 + Math.random() * 0.08;
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.038,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    const haloGeometry = new THREE.TorusGeometry(1.4, 0.02, 16, 96);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc46a,
      transparent: true,
      opacity: 0.18,
    });
    this.haloPrimary = new THREE.Mesh(haloGeometry, haloMaterial);
    this.haloPrimary.rotation.x = Math.PI / 2;
    this.scene.add(this.haloPrimary);

    this.haloSecondary = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.016, 16, 72),
      new THREE.MeshBasicMaterial({
        color: 0x81f8d8,
        transparent: true,
        opacity: 0.12,
      }),
    );
    this.haloSecondary.rotation.x = Math.PI / 2;
    this.haloSecondary.rotation.y = Math.PI / 4;
    this.scene.add(this.haloSecondary);

    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16, 1),
      new THREE.MeshBasicMaterial({
        color: 0x7ec9ff,
        transparent: true,
        opacity: 0.42,
        wireframe: true,
      }),
    );
    this.scene.add(this.core);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    this.animate();
  }

  setInteractionState(interaction: InteractionState) {
    this.interaction = interaction;
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
    this.particles.geometry.dispose();
    this.particles.material.dispose();
    this.haloPrimary.geometry.dispose();
    this.haloPrimary.material.dispose();
    this.haloSecondary.geometry.dispose();
    this.haloSecondary.material.dispose();
    this.core.geometry.dispose();
    this.core.material.dispose();
  }

  private readonly handleResize = () => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };

  private readonly animate = () => {
    const now = performance.now();
    const time = now * 0.001;
    const targetX = (this.interaction.pointer?.x ?? 0.5) * 2 - 1;
    const targetY = -((this.interaction.pointer?.y ?? 0.5) * 2 - 1);
    const energy = this.interaction.handDetected
      ? 0.65 + this.interaction.pinch * 0.9
      : 0.3;
    let follow = this.interaction.handDetected ? 0.52 : 0.12;
    let hue = 0.53;
    let lightness = 0.6;
    let haloOpacity = 0.18;
    let secondaryOpacity = 0.12;
    let coreScale = 1;
    let swirl = 1;

    switch (this.interaction.sceneMode) {
      case "open-palm":
        hue = 0.49;
        lightness = 0.66;
        haloOpacity = 0.2;
        secondaryOpacity = 0.16;
        coreScale = 1.14;
        swirl = 0.82;
        break;
      case "pinch-focus":
        hue = 0.12;
        lightness = 0.58;
        haloOpacity = 0.28;
        secondaryOpacity = 0.18;
        coreScale = 0.88;
        follow = 0.68;
        swirl = 1.35;
        break;
      case "victory-flare":
        hue = 0.08;
        lightness = 0.7;
        haloOpacity = 0.34;
        secondaryOpacity = 0.24;
        coreScale = 1.32;
        follow = 0.58;
        swirl = 1.08;
        break;
      case "tracking":
        hue = 0.55;
        lightness = 0.6;
        break;
      case "idle":
        hue = 0.56;
        lightness = 0.5;
        haloOpacity = 0.1;
        secondaryOpacity = 0.06;
        coreScale = 0.82;
        break;
    }

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const stride = index * 3;
      const angle =
        this.angles[index] + time * 0.4 * this.drift[index] * swirl;
      const radius = this.radii[index] * (0.4 + energy * 0.55);
      const wobble = Math.sin(time * 0.7 + index * 0.08) * 0.14;

      this.positions[stride] =
        Math.cos(angle) * radius * 0.9 + targetX * follow + wobble * 0.2;
      this.positions[stride + 1] =
        Math.sin(angle * 1.12) * radius * 0.55 + targetY * follow;
      this.positions[stride + 2] =
        Math.sin(angle * 2.1 + time * 1.8) * 0.22 * energy;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.rotation.z += 0.0018 + this.interaction.pinch * 0.004;
    this.particles.material.size = 0.025 + this.interaction.pinch * 0.045;
    this.particles.material.opacity = 0.72 + this.interaction.presence * 0.24;
    this.particles.material.color.setHSL(hue, 0.75, lightness);

    this.haloPrimary.material.opacity = haloOpacity;
    this.haloPrimary.material.color.setHSL(hue, 0.72, 0.62);
    this.haloPrimary.rotation.z += 0.002 + this.interaction.pinch * 0.01;
    this.haloPrimary.scale.setScalar(1 + this.interaction.presence * 0.24);

    this.haloSecondary.material.opacity = secondaryOpacity;
    this.haloSecondary.material.color.setHSL(
      Math.max(0, hue - 0.06),
      0.8,
      0.68,
    );
    this.haloSecondary.rotation.z -= 0.0012 + this.interaction.presence * 0.004;
    this.haloSecondary.scale.setScalar(0.9 + this.interaction.pinch * 0.3);

    this.core.material.color.setHSL(hue, 0.68, 0.74);
    this.core.material.opacity = 0.18 + this.interaction.presence * 0.36;
    this.core.rotation.x += 0.006 + this.interaction.presence * 0.01;
    this.core.rotation.y += 0.004 + this.interaction.pinch * 0.014;
    this.core.scale.setScalar(coreScale + Math.sin(time * 2.4) * 0.04);

    this.camera.position.x += (targetX * 0.36 - this.camera.position.x) * 0.04;
    this.camera.position.y += (targetY * 0.22 - this.camera.position.y) * 0.04;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);

    this.frameCount += 1;
    const elapsed = now - this.lastFpsMark;
    if (elapsed >= 1000) {
      this.onFrame?.((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsMark = now;
    }

    this.frameId = requestAnimationFrame(this.animate);
  };
}
