import * as THREE from "three";
import type { AvatarState } from "../../store/avatar";

export interface WhaleAvatarController {
  update(state: AvatarState, mouthOpen: number, elapsed: number): void;
  rotate(delta: number): void;
  resetView(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** REQ-025: 构造无需外部模型文件的蓝鲸主题 3D 导游原型，并映射现有数字人状态。 */
export function createWhaleAvatar(canvas: HTMLCanvasElement): WhaleAvatarController {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
  camera.position.set(0, 2.12, 8.7);
  camera.lookAt(0, 2.05, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa8d3, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(-3, 6, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -5;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x78b9ff, 2.0);
  rimLight.position.set(3, 3, -4);
  scene.add(rimLight);

  const mat = (color: number, roughness = 0.72, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const navy = mat(0x1a285e);
  const skirtBlue = mat(0x233b87);
  const hair = mat(0x38559a, 0.49);
  const hairLight = mat(0x6986cb, 0.47);
  const finBlue = mat(0x4477bd);
  const finLight = mat(0xa2d9ef);
  const ivory = mat(0xfff7ed);
  const lace = mat(0xfaf6ff);
  const skin = mat(0xffd8c8);
  const blush = mat(0xed9baa);
  const gold = mat(0xe5bc75, 0.35, 0.22);
  const iris = mat(0x297cc0, 0.25);
  const pupil = mat(0x142955, 0.18);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function ellipsoid(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], scale: [number, number, number], segments = 20) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(12, segments - 4)), material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function tube(parent: THREE.Object3D, material: THREE.Material, points: Array<[number, number, number]>, radius: number) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), material);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const root = new THREE.Group();
  scene.add(root);
  const figure = new THREE.Group();
  root.add(figure);

  // 鞋、裙摆和围裙共同形成清晰的 Q 版轮廓。
  for (const side of [-1, 1]) {
    ellipsoid(figure, skin, [side * 0.28, 0.46, 0.1], [0.14, 0.34, 0.14]);
    ellipsoid(figure, navy, [side * 0.29, 0.20, 0.25], [0.22, 0.16, 0.32]);
    ellipsoid(figure, gold, [side * 0.29, 0.30, 0.51], [0.055, 0.035, 0.015]);
  }

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.83, 1.37, 36, 1), skirtBlue);
  skirt.position.y = 1.15;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  figure.add(skirt);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.052, 8, 40), ivory);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.53;
  figure.add(hem);
  const goldHem = new THREE.Mesh(new THREE.TorusGeometry(0.70, 0.018, 6, 40), gold);
  goldHem.rotation.x = Math.PI / 2;
  goldHem.position.y = 0.65;
  figure.add(goldHem);
  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2;
    ellipsoid(figure, lace, [Math.sin(angle) * 0.77, 0.48, Math.cos(angle) * 0.77], [0.105, 0.085, 0.065], 12);
  }
  ellipsoid(figure, ivory, [0, 1.20, 0.55], [0.48, 0.64, 0.105]);
  ellipsoid(figure, lace, [0, 1.70, 0.47], [0.33, 0.18, 0.11]);
  for (let i = -3; i <= 3; i += 1) {
    ellipsoid(figure, lace, [i * 0.13, 0.68 + Math.abs(i) * 0.015, 0.72 - Math.abs(i) * 0.025], [0.09, 0.10, 0.055], 12);
  }
  ellipsoid(figure, finBlue, [0, 1.13, 0.674], [0.16, 0.095, 0.026]);
  ellipsoid(figure, finBlue, [-0.13, 1.12, 0.674], [0.10, 0.055, 0.025]);
  ellipsoid(figure, finBlue, [0.13, 1.12, 0.674], [0.10, 0.055, 0.025]);
  ellipsoid(figure, finLight, [0.09, 1.16, 0.705], [0.035, 0.025, 0.012]);
  tube(figure, gold, [[-0.38, 1.74, 0.40], [0, 1.66, 0.51], [0.38, 1.74, 0.40]], 0.028);
  ellipsoid(figure, navy, [0, 1.79, 0.53], [0.16, 0.09, 0.06]);
  ellipsoid(figure, gold, [0, 1.79, 0.59], [0.045, 0.045, 0.022]);

  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.42, 1.84, 0);
    figure.add(arm);
    const sleeve = ellipsoid(arm, navy, [side * 0.20, -0.30, 0.06], [0.23, 0.37, 0.25]);
    sleeve.rotation.z = side * 0.35;
    ellipsoid(arm, lace, [side * 0.34, -0.58, 0.11], [0.19, 0.11, 0.20]);
    ellipsoid(arm, skin, [side * 0.38, -0.68, 0.15], [0.14, 0.13, 0.13]);
    arms.push(arm);
  }

  const tail = new THREE.Group();
  tail.position.set(0.45, 0.79, -0.60);
  figure.add(tail);
  const tailStem = ellipsoid(tail, finBlue, [0.30, 0.01, -0.08], [0.46, 0.16, 0.18]);
  tailStem.rotation.z = -0.25;
  for (const side of [-1, 1]) {
    const fluke = ellipsoid(tail, finBlue, [0.72, side * 0.21, -0.08], [0.28, 0.13, 0.08]);
    fluke.rotation.z = side * 0.55;
    ellipsoid(tail, finLight, [0.78, side * 0.20, 0.01], [0.16, 0.055, 0.025]);
  }

  const head = new THREE.Group();
  head.position.y = 2.65;
  figure.add(head);
  ellipsoid(head, hair, [0, -0.24, -0.24], [0.91, 1.14, 0.69]);
  for (const side of [-1, 1]) {
    tube(head, hair, [[side * 0.70, 0.22, -0.03], [side * 0.86, -0.30, 0.02], [side * 0.77, -0.98, 0.04], [side * 0.91, -1.33, 0.09]], 0.17);
    tube(head, hairLight, [[side * 0.86, -1.03, 0.13], [side * 0.93, -1.22, 0.11], [side * 0.83, -1.42, 0.05]], 0.08);
  }
  ellipsoid(head, skin, [0, 0.0, 0.35], [0.76, 0.74, 0.62]);
  ellipsoid(head, hair, [0, 0.60, 0.08], [0.83, 0.54, 0.73]);
  for (const [x, angle] of [[-0.46, -0.30], [-0.18, -0.16], [0.12, 0.08], [0.43, 0.28]]) {
    const bang = ellipsoid(head, hair, [x, 0.42, 0.67], [0.25, 0.47, 0.20]);
    bang.rotation.z = angle;
  }
  ellipsoid(head, hairLight, [-0.45, 0.64, 0.62], [0.13, 0.20, 0.045]);

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.31, 0.0, 0.90);
    head.add(eye);
    ellipsoid(eye, white, [0, 0, 0], [0.175, 0.22, 0.055]);
    ellipsoid(eye, iris, [side * 0.014, -0.025, 0.052], [0.125, 0.17, 0.033]);
    ellipsoid(eye, pupil, [side * 0.014, -0.028, 0.084], [0.068, 0.11, 0.016]);
    ellipsoid(eye, white, [-0.04, 0.07, 0.103], [0.038, 0.047, 0.012]);
    ellipsoid(head, blush, [side * 0.55, -0.28, 0.78], [0.12, 0.048, 0.023]);
    eyes.push(eye);
  }
  const mouth = ellipsoid(head, mat(0x923d65), [0, -0.39, 0.96], [0.076, 0.035, 0.025]);
  ellipsoid(head, skin, [0, -0.28, 0.97], [0.045, 0.026, 0.012]);

  for (const side of [-1, 1]) {
    const fin = ellipsoid(head, finBlue, [side * 0.87, 0.00, -0.01], [0.32, 0.15, 0.12]);
    fin.rotation.z = side * 0.26;
    const lining = ellipsoid(head, finLight, [side * 0.92, -0.06, 0.10], [0.24, 0.07, 0.025]);
    lining.rotation.z = side * 0.26;
    ellipsoid(head, finBlue, [side * 0.73, 0.46, 0.24], [0.17, 0.13, 0.08]);
    const bowWing = ellipsoid(head, finLight, [side * 0.80, 0.47, 0.33], [0.18, 0.11, 0.035]);
    bowWing.rotation.z = side * 0.45;
    ellipsoid(head, gold, [side * 0.75, 0.45, 0.38], [0.045, 0.047, 0.022]);
  }
  for (let i = -7; i <= 7; i += 1) {
    const x = i * 0.105;
    const y = 0.76 + 0.15 * (1 - Math.pow(x / 0.75, 2));
    ellipsoid(head, lace, [x, y, 0.21], [0.10, 0.075, 0.10], 12);
  }
  tube(head, navy, [[-0.03, 0.89, 0.14], [0.04, 1.10, 0.05], [0.14, 1.13, 0.02], [0.18, 1.01, 0.03]], 0.045);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.48, 48),
    new THREE.MeshBasicMaterial({ color: 0x8db9e8, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.035;
  scene.add(ground);
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(1.16, 1.18, 64),
    new THREE.MeshBasicMaterial({ color: 0xb7e4f5, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;
  scene.add(groundRing);

  let viewAngle = 0;
  return {
    update(state, mouthOpen, elapsed) {
      const talking = state === "speaking";
      const lively = talking || state === "happy";
      figure.position.y = Math.sin(elapsed * (lively ? 3.4 : 1.7)) * (lively ? 0.055 : 0.028);
      head.rotation.z = state === "thinking" ? -0.11 : state === "concerned" || state === "error" ? 0.08 : Math.sin(elapsed * 0.8) * 0.025;
      head.rotation.x = state === "listening" ? -0.07 : Math.sin(elapsed * 0.9) * 0.018;
      arms[0].rotation.z = state === "thinking" ? -0.42 : Math.sin(elapsed * 2) * 0.035;
      arms[1].rotation.z = talking ? -0.30 + Math.sin(elapsed * 5) * 0.16 : Math.sin(elapsed * 2 + 1) * 0.035;
      tail.rotation.z = Math.sin(elapsed * 2.6) * 0.17;
      const blink = Math.sin(elapsed * 1.9) > 0.985 ? 0.12 : 1;
      eyes.forEach((eye) => { eye.scale.y = blink; });
      mouth.scale.y = talking ? 0.035 + Math.max(0, mouthOpen) * 0.085 : state === "happy" ? 0.052 : 0.035;
      groundRing.scale.setScalar(1 + (talking ? Math.sin(elapsed * 5) * 0.035 : 0));
      root.rotation.y = viewAngle;
      renderer.render(scene, camera);
    },
    rotate(delta) { viewAngle += delta; },
    resetView() { viewAngle = 0; },
    resize(width, height) {
      if (width < 1 || height < 1) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },
    dispose() {
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    },
  };
}
