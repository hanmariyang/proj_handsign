import * as THREE from "three";
import {
  createEmptyInteractionState,
  type InteractionState,
  type SceneMode,
} from "@/features/inference/inference-types";

const PARTICLE_COUNT = 1600;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** ease-in cubic: 느리게 시작 → 빠르게 끝 */
function easeIn(t: number) {
  return t * t * t;
}

/** ease-out cubic: 빠르게 시작 → 부드럽게 끝 */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** 스프링-댐퍼 */
function spring(
  pos: number, vel: number,
  target: number, stiffness: number, damping: number,
): [number, number] {
  const force = (target - pos) * stiffness - vel * damping;
  const nextVel = vel + force;
  return [pos + nextVel, nextVel];
}

export class VisualEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly haloPrimary: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly haloSecondary: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly core: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  private readonly positions: Float32Array;
  private readonly radii   = new Float32Array(PARTICLE_COUNT);
  private readonly angles  = new Float32Array(PARTICLE_COUNT);
  private readonly drift   = new Float32Array(PARTICLE_COUNT);
  private frameId    = 0;
  private lastFpsMark = performance.now();
  private frameCount  = 0;
  private interaction: InteractionState = createEmptyInteractionState();

  // ── 스프링 상태 ───────────────────────────────────────────────
  private coreX = 0; private coreVelX = 0;
  private coreY = 0; private coreVelY = 0;
  private haloX = 0; private haloVelX = 0;
  private haloY = 0; private haloVelY = 0;
  private camX  = 0; private camVelX  = 0;
  private camY  = 0; private camVelY  = 0;

  // ── 속도 추적 ─────────────────────────────────────────────────
  private prevPointer    = { x: 0.5, y: 0.5 };
  private smoothVelocity = 0;
  private velocityBurst  = 0;

  // ── 주먹/펴기 ─────────────────────────────────────────────────
  private gatherStrength = 0;   // 0=퍼짐, 1=완전히 모임
  private expandBurst    = 0;   // fist→open 전환 시 폭발량
  private gatherX        = 0;   // 모임 중심 X (실시간 추적)
  private gatherY        = 0;
  private prevSceneMode: SceneMode = "idle";

  // ── 손 감지 부드러운 전환 ─────────────────────────────────────
  private smoothPresence = 0;

  // ── 시각 파라미터 (lerp용) ───────────────────────────────────
  private curHue              = 0.53;
  private curLightness        = 0.60;
  private curEnergy           = 0.30;
  private curCoreScale        = 1.00;
  private curHaloOpacity      = 0.18;
  private curSecondaryOpacity = 0.12;
  private curSwirl            = 1.00;
  private curParticleSize     = 0.025;
  private curParticleOpacity  = 0.72;
  private curCoreOpacity      = 0.18;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFrame?: (fps: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050812, 2.6, 8.8);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
    this.camera.position.z = 3.8;

    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors   = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = i * 3;
      this.radii[i]  = 0.3 + Math.random() * 1.25;
      this.angles[i] = Math.random() * Math.PI * 2;
      this.drift[i]  = 0.4 + Math.random() * 1.4;
      this.positions[s]     = 0;
      this.positions[s + 1] = 0;
      this.positions[s + 2] = (Math.random() - 0.5) * 0.3;
      colors[s]     = 0.62 + Math.random() * 0.20;
      colors[s + 1] = 0.72 + Math.random() * 0.22;
      colors[s + 2] = 0.90 + Math.random() * 0.08;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color",    new THREE.BufferAttribute(colors,    3));

    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 0.038, vertexColors: true, transparent: true,
      opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(this.particles);

    this.haloPrimary = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.02, 16, 96),
      new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.18 }),
    );
    this.haloPrimary.rotation.x = Math.PI / 2;
    this.scene.add(this.haloPrimary);

    this.haloSecondary = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.016, 16, 72),
      new THREE.MeshBasicMaterial({ color: 0x81f8d8, transparent: true, opacity: 0.12 }),
    );
    this.haloSecondary.rotation.x = Math.PI / 2;
    this.haloSecondary.rotation.y = Math.PI / 4;
    this.scene.add(this.haloSecondary);

    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16, 1),
      new THREE.MeshBasicMaterial({ color: 0x7ec9ff, transparent: true, opacity: 0.42, wireframe: true }),
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
    const w = this.canvas.clientWidth  || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  };

  private readonly animate = () => {
    const now  = performance.now();
    const time = now * 0.001;

    // ── 손 위치 ──────────────────────────────────────────────────
    const px = this.interaction.pointer?.x    ?? 0.5;
    const py = this.interaction.pointer?.y    ?? 0.5;
    const qx = this.interaction.palmCenter?.x ?? 0.5;
    const qy = this.interaction.palmCenter?.y ?? 0.5;
    const targetX = (px - 0.5) * 2;
    const targetY = -((py - 0.5) * 2);
    const palmX   = (qx - 0.5) * 2;
    const palmY   = -((qy - 0.5) * 2);

    // ── 손 presence 부드럽게 ──────────────────────────────────────
    const presenceTarget = this.interaction.handDetected ? 1 : 0;
    this.smoothPresence  = lerp(this.smoothPresence, presenceTarget, 0.05);

    // ── 속도 ─────────────────────────────────────────────────────
    const dvx    = px - this.prevPointer.x;
    const dvy    = py - this.prevPointer.y;
    const rawVel = Math.sqrt(dvx * dvx + dvy * dvy) * 60;
    this.prevPointer = { x: px, y: py };
    this.smoothVelocity = lerp(this.smoothVelocity, rawVel, rawVel > this.smoothVelocity ? 0.14 : 0.04);
    if (this.interaction.handDetected && rawVel > 0.022) {
      this.velocityBurst = Math.min(1, this.velocityBurst + rawVel * 2.8);
    }
    this.velocityBurst = lerp(this.velocityBurst, 0, 0.032);
    const velNorm = Math.min(this.smoothVelocity / 0.1, 1);

    // ── 주먹/펴기 감지 ────────────────────────────────────────────
    const mode  = this.interaction.sceneMode;
    const isFist = mode === "closed-fist";

    if (this.prevSceneMode === "closed-fist" && mode === "open-palm") {
      // 모임 위치에서 폭발
      this.expandBurst = 2.2;
    }
    this.prevSceneMode = mode;

    // gatherStrength: ease-in으로 가속하며 모임, ease-out으로 천천히 풀림
    const gatherTarget = isFist ? 1 : 0;
    const gatherSpeed  = isFist ? 0.055 : 0.032;
    this.gatherStrength = lerp(this.gatherStrength, gatherTarget, gatherSpeed);

    // expandBurst: 천천히, 부드럽게 감쇠
    this.expandBurst = lerp(this.expandBurst, 0, 0.025);

    // 모임 중심 위치를 실시간 추적 (주먹일 때)
    if (isFist || this.gatherStrength > 0.05) {
      this.gatherX = lerp(this.gatherX, palmX, 0.06);
      this.gatherY = lerp(this.gatherY, palmY, 0.06);
    }

    // 시각 계산에 사용할 eased 값
    const gE = easeIn(this.gatherStrength);   // 모임: 끝에서 급격히 수렴
    const eE = easeOut(this.expandBurst / 2.2); // 펴짐: 처음에 빠르게 터짐

    // ── 모드별 목표 파라미터 ──────────────────────────────────────
    let tHue = 0.53, tLightness = 0.60;
    let tHaloOpacity = 0.18, tSecondaryOpacity = 0.12;
    let tCoreScale = 1.0, tSwirl = 1.0;
    let tFollow = this.smoothPresence > 0.1 ? 0.52 : 0.12;

    switch (mode) {
      case "closed-fist":
        tHue = 0.66; tLightness = 0.40;
        tHaloOpacity = 0.06; tSecondaryOpacity = 0.04;
        tCoreScale = 0.4; tSwirl = 0.2; tFollow = 0.72;
        break;
      case "open-palm":
        tHue = 0.48; tLightness = 0.68;
        tHaloOpacity = 0.24; tSecondaryOpacity = 0.18;
        tCoreScale = 1.18; tSwirl = 0.80;
        break;
      case "pinch-focus":
        tHue = 0.12; tLightness = 0.58;
        tHaloOpacity = 0.30; tSecondaryOpacity = 0.20;
        tCoreScale = 0.88; tFollow = 0.68; tSwirl = 1.35;
        break;
      case "victory-flare":
        tHue = 0.08; tLightness = 0.72;
        tHaloOpacity = 0.38; tSecondaryOpacity = 0.28;
        tCoreScale = 1.32; tFollow = 0.58; tSwirl = 1.10;
        break;
      case "tracking":
        tHue = 0.54; tLightness = 0.60;
        break;
      case "idle":
        tHue = 0.56; tLightness = 0.48;
        tHaloOpacity = 0.09; tSecondaryOpacity = 0.05;
        tCoreScale = 0.80;
        break;
    }

    tHue       = Math.max(0, tHue - velNorm * 0.10);
    tLightness = Math.min(0.85, tLightness + velNorm * 0.07);

    // 아이들 시 자연스러운 호흡 (에너지 느리게 맥동)
    const breathe  = Math.sin(time * 0.38) * 0.05 + Math.sin(time * 0.71) * 0.02;
    const baseEnergy = this.smoothPresence > 0.05
      ? 0.62 + this.interaction.pinch * 0.85 + velNorm * 0.32
      : 0.28 + breathe;
    const tEnergy = baseEnergy + breathe * (1 - this.smoothPresence);

    // ── 시각 파라미터 부드럽게 전환 ──────────────────────────────
    const P = 0.038;
    this.curHue              = lerp(this.curHue,              tHue,             P);
    this.curLightness        = lerp(this.curLightness,        tLightness,       P);
    this.curEnergy           = lerp(this.curEnergy,           tEnergy,          0.045);
    this.curCoreScale        = lerp(this.curCoreScale,        tCoreScale,       P);
    this.curHaloOpacity      = lerp(this.curHaloOpacity,      tHaloOpacity + this.velocityBurst * 0.16, P);
    this.curSecondaryOpacity = lerp(this.curSecondaryOpacity, tSecondaryOpacity + this.velocityBurst * 0.10, P);
    this.curSwirl            = lerp(this.curSwirl,            tSwirl,           P);

    const tParticleSize    = 0.024 + this.interaction.pinch * 0.032 + velNorm * 0.018;
    const tParticleOpacity = 0.65 + this.smoothPresence * 0.28;
    const tCoreOpacity     = 0.18 + this.smoothPresence * 0.44 + this.velocityBurst * 0.18;
    this.curParticleSize    = lerp(this.curParticleSize,    tParticleSize,    0.045);
    this.curParticleOpacity = lerp(this.curParticleOpacity, tParticleOpacity, 0.038);
    this.curCoreOpacity     = lerp(this.curCoreOpacity,     tCoreOpacity,     0.045);

    // ── 파티클 ───────────────────────────────────────────────────
    // gE: 0→1이 되면서 파티클이 수렴점으로 완전히 끌림
    // expandBurst: 수렴점에서 폭발하듯 퍼짐
    const gatherPull  = gE;                              // 수렴 강도 (easeIn)
    const radiusMult  = (1 - gE * 0.98)                 // 모일수록 반지름 → 0
                      * (1 + this.velocityBurst * 0.32)
                      * (1 + this.expandBurst   * 1.10);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = i * 3;
      const angle  = this.angles[i] + time * 0.26 * this.drift[i] * this.curSwirl;
      const radius = this.radii[i] * radiusMult * (0.4 + this.curEnergy * 0.55);
      const wobble = Math.sin(time * 0.45 + i * 0.08) * 0.08;

      const orbitX = Math.cos(angle) * radius * 0.9 + targetX * tFollow + wobble * 0.12;
      const orbitY = Math.sin(angle * 1.12) * radius * 0.55 + targetY * tFollow;
      const orbitZ = Math.sin(angle * 2.1 + time * 1.2) * 0.16 * this.curEnergy;

      // 모임: gatherPull 비율만큼 gatherX/Y로 당김
      this.positions[s]     = lerp(orbitX, this.gatherX, gatherPull);
      this.positions[s + 1] = lerp(orbitY, this.gatherY, gatherPull);
      this.positions[s + 2] = orbitZ * (1 - gE);
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.rotation.z += 0.0012 + this.interaction.pinch * 0.003;
    this.particles.material.size    = this.curParticleSize * (1 + this.expandBurst * 0.55);
    this.particles.material.opacity = this.curParticleOpacity;
    this.particles.material.color.setHSL(this.curHue, 0.75, this.curLightness);

    // ── Core ─────────────────────────────────────────────────────
    // 모일 때: gatherX/Y로 이동 후 작아짐 (에너지 집중으로 밝아짐)
    // 풀릴 때: expandBurst로 일시 팽창
    const coreTgtX  = lerp(targetX * 0.85, this.gatherX, gE);
    const coreTgtY  = lerp(targetY * 0.62, this.gatherY, gE);
    [this.coreX, this.coreVelX] = spring(this.coreX, this.coreVelX, coreTgtX, 0.042, 0.78);
    [this.coreY, this.coreVelY] = spring(this.coreY, this.coreVelY, coreTgtY, 0.042, 0.78);
    this.core.position.set(this.coreX, this.coreY, 0);

    const coreShrink  = 1 - gE * 0.82;
    const corePulse   = 1 + this.expandBurst * 1.0 + Math.sin(time * 2.2) * 0.04;
    const coreVelBoost = 1 + this.velocityBurst * 0.28;
    this.core.material.color.setHSL(this.curHue, 0.70, 0.76);
    // 주먹 시 에너지 집중 → opacity 상승
    this.core.material.opacity = this.curCoreOpacity * (1 + gE * 1.2);
    this.core.rotation.x += 0.005 + this.smoothPresence * 0.007 + velNorm * 0.018;
    this.core.rotation.y += 0.003 + this.interaction.pinch * 0.009 + velNorm * 0.012;
    this.core.scale.setScalar(this.curCoreScale * coreShrink * corePulse * coreVelBoost);

    // ── Halos ─────────────────────────────────────────────────────
    // 모일 때: 거의 사라짐 / 풀릴 때: 크게 퍼짐
    const haloTgtX  = lerp(palmX * 0.62, this.gatherX, gE);
    const haloTgtY  = lerp(palmY * 0.46, this.gatherY, gE);
    [this.haloX, this.haloVelX] = spring(this.haloX, this.haloVelX, haloTgtX, 0.028, 0.82);
    [this.haloY, this.haloVelY] = spring(this.haloY, this.haloVelY, haloTgtY, 0.028, 0.82);

    const haloShrink  = 1 - gE * 0.96;                   // 주먹: 거의 0으로 수축
    const haloExpand  = 1 + this.expandBurst * 1.5 + this.velocityBurst * 0.28;
    const haloPresence = 1 + this.smoothPresence * 0.22;

    this.haloPrimary.position.set(this.haloX, this.haloY, 0);
    this.haloPrimary.material.opacity = this.curHaloOpacity * haloShrink * (1 + eE * 0.6);
    this.haloPrimary.material.color.setHSL(this.curHue, 0.72, 0.62);
    this.haloPrimary.rotation.z += 0.0014 + this.interaction.pinch * 0.006;
    this.haloPrimary.scale.setScalar(haloPresence * haloShrink * haloExpand);

    this.haloSecondary.position.set(this.haloX, this.haloY, 0);
    this.haloSecondary.material.opacity = this.curSecondaryOpacity * haloShrink * (1 + eE * 0.5);
    this.haloSecondary.material.color.setHSL(Math.max(0, this.curHue - 0.06), 0.8, 0.68);
    this.haloSecondary.rotation.z -= 0.0010 + this.smoothPresence * 0.003 + velNorm * 0.006;
    this.haloSecondary.scale.setScalar((0.88 + this.interaction.pinch * 0.26) * haloShrink * haloExpand);

    // ── 카메라 스프링 ─────────────────────────────────────────────
    // 주먹 시 카메라도 중앙 수렴
    const camTgtX = lerp(targetX * 0.26, 0, gE * 0.7);
    const camTgtY = lerp(targetY * 0.15, 0, gE * 0.7);
    [this.camX, this.camVelX] = spring(this.camX, this.camVelX, camTgtX, 0.016, 0.88);
    [this.camY, this.camVelY] = spring(this.camY, this.camVelY, camTgtY, 0.016, 0.88);
    this.camera.position.x = this.camX;
    this.camera.position.y = this.camY;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);

    this.frameCount++;
    const elapsed = now - this.lastFpsMark;
    if (elapsed >= 1000) {
      this.onFrame?.((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsMark = now;
    }

    this.frameId = requestAnimationFrame(this.animate);
  };
}
