import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sound } from './sound.js';

// 사진처럼 부드러운 둥근 모서리와 깊은 음각 구멍(Drilled Pit) 질감을 가진 고품질 플라스틱 주사위 텍스처
function createRealisticDiceFaceTexture(number) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 1. 순백의 부드러운 매트 화이트 플라스틱 바탕 (빛반사 없는 매끄러운 질감)
  const bgGrad = ctx.createRadialGradient(size * 0.48, size * 0.45, 10, size / 2, size / 2, size * 0.75);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.65, '#f9fafb');
  bgGrad.addColorStop(0.9, '#f0f2f5');
  bgGrad.addColorStop(1, '#e5e7eb');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. 핍(점) 위치 정의
  const dotRadius = number === 1 ? 58 : 42;
  const p1 = size * 0.25;
  const p2 = size * 0.5;
  const p3 = size * 0.75;

  const dotPositions = {
    1: [[p2, p2]],
    2: [[p1, p1], [p3, p3]],
    3: [[p1, p1], [p2, p2], [p3, p3]],
    4: [[p1, p1], [p3, p1], [p1, p3], [p3, p3]],
    5: [[p1, p1], [p3, p1], [p2, p2], [p1, p3], [p3, p3]],
    6: [[p1, p1], [p3, p1], [p1, p2], [p3, p2], [p1, p3], [p3, p3]],
  };

  const dots = dotPositions[number] || [];
  const isOne = number === 1;

  // 3. 사진 속 주사위처럼 깊은 3D 음각 구멍(Cavity) 렌더링
  for (const [x, y] of dots) {
    // A. 구멍 바깥쪽 앰비언트 오클루전 그림자
    ctx.beginPath();
    ctx.arc(x, y + 1.5, dotRadius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fill();

    // B. 구멍 입구 베벨 림
    ctx.beginPath();
    ctx.arc(x, y, dotRadius + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();

    // C. 구멍 내부 벽면 깊은 음영
    const holeGrad = ctx.createRadialGradient(
      x, y - dotRadius * 0.35, dotRadius * 0.1,
      x, y + dotRadius * 0.15, dotRadius
    );

    if (isOne) {
      holeGrad.addColorStop(0, '#590000');
      holeGrad.addColorStop(0.45, '#aa0f0f');
      holeGrad.addColorStop(0.85, '#e51a1a');
      holeGrad.addColorStop(1, '#ff3b3b');
    } else {
      holeGrad.addColorStop(0, '#0a0b0d');
      holeGrad.addColorStop(0.5, '#16181d');
      holeGrad.addColorStop(0.85, '#262930');
      holeGrad.addColorStop(1, '#353842');
    }

    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = holeGrad;
    ctx.fill();

    // D. 구멍 바닥의 오목한 구면 반사 볼륨감
    const innerBottomGrad = ctx.createRadialGradient(
      x, y + dotRadius * 0.25, 2,
      x, y + dotRadius * 0.25, dotRadius * 0.7
    );
    innerBottomGrad.addColorStop(0, isOne ? 'rgba(255, 120, 120, 0.35)' : 'rgba(255, 255, 255, 0.18)');
    innerBottomGrad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(x, y + dotRadius * 0.2, dotRadius * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = innerBottomGrad;
    ctx.fill();

    // E. 구멍 입구 상단 하이라이트 아크
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, Math.PI * 0.9, Math.PI * 2.1, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export class PhysicsDiceScene {
  constructor(containerElement, onDiceSettled, onDiceClick) {
    this.container = containerElement;
    this.onDiceSettled = onDiceSettled;
    this.onDiceClick = onDiceClick;

    this.diceCount = 5;
    this.diceList = []; // { mesh, body, index, isKept, value }
    this.isRolling = false;
    this.rollStartTime = 0;
    this.settleStableTime = 0;

    // 마주보는 면의 합이 7이 되는 로컬 축 및 숫자 매핑
    // BoxFace 인덱스: 0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z, 5:-Z
    this.faceMappings = [
      { faceIndex: 0, number: 1, normal: new THREE.Vector3( 1,  0,  0) },
      { faceIndex: 1, number: 6, normal: new THREE.Vector3(-1,  0,  0) },
      { faceIndex: 2, number: 2, normal: new THREE.Vector3( 0,  1,  0) },
      { faceIndex: 3, number: 5, normal: new THREE.Vector3( 0, -1,  0) },
      { faceIndex: 4, number: 3, normal: new THREE.Vector3( 0,  0,  1) },
      { faceIndex: 5, number: 4, normal: new THREE.Vector3( 0,  0, -1) },
    ];

    this.initThree();
    this.initCannon();
    this.createTray();
    this.createDice();
    this.setupInteractions();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // ⭐ 수직 탑다운 시점: 트레이(Z:-6.5~+6.5)와 보관함(Z:8.5)이 완벽히 중앙에 꽉 차게 들어오도록 시야 최적화 ⭐
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 150);
    // Y=36 높이 상공에서 Z=1.5(전체 영역의 정중앙)를 직하 수직으로 내려다봄
    this.camera.position.set(0, 36, 1.8);
    this.camera.lookAt(0, 0, 1.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 부드럽고 균일한 앰비언트 라이트 (빛반사 눈부심 없이 주사위 눈이 선명하게 보이도록)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
    this.scene.add(ambientLight);

    // 입체감을 주는 소프트 디렉셔널 라이트 (트레이 뒤쪽 상공에서 비추어 보관함 정반사 방지)
    const dirLight = new THREE.DirectionalLight(0xfff8ee, 0.65);
    dirLight.position.set(6, 28, -8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 70;
    dirLight.shadow.camera.left = -16;
    dirLight.shadow.camera.right = 16;
    dirLight.shadow.camera.top = 18;
    dirLight.shadow.camera.bottom = -18;
    dirLight.shadow.bias = -0.0006;
    this.scene.add(dirLight);

    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  initCannon() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -32, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 14;

    this.diceMaterial = new CANNON.Material('plasticDice');
    this.trayMaterial = new CANNON.Material('feltTray');

    const diceTrayContact = new CANNON.ContactMaterial(this.diceMaterial, this.trayMaterial, {
      friction: 0.35,
      restitution: 0.42
    });
    this.world.addContactMaterial(diceTrayContact);

    const diceDiceContact = new CANNON.ContactMaterial(this.diceMaterial, this.diceMaterial, {
      friction: 0.25,
      restitution: 0.55
    });
    this.world.addContactMaterial(diceDiceContact);
  }

  createTray() {
    const trayGroup = new THREE.Group();

    // 1. 메인 주사위 트레이 내부 바닥 (시원하고 넓은 그린 펠트)
    const floorWidth = 22;
    const floorDepth = 13.5; // Z: -6.75 ~ +6.75
    const floorGeo = new THREE.PlaneGeometry(floorWidth, floorDepth);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c3b28, // 품격 있는 카지노 에메랄드 그린
      roughness: 0.9,
      metalness: 0.02
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorMesh.position.set(0, 0, 0);
    trayGroup.add(floorMesh);

    // 2. 슬림하고 세련된 원목 테두리 프레임 (시야를 가리지 않도록 두께 0.7로 슬림화)
    const wallThick = 0.7;
    const wallVisualHeight = 2.4;
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x22130c, // 마호가니 다크 월넛
      roughness: 0.4,
      metalness: 0.05
    });

    const wallsConfig = [
      // Left (-X)
      { size: [wallThick, wallVisualHeight, floorDepth + wallThick * 2], pos: [-floorWidth / 2 - wallThick / 2, wallVisualHeight / 2, 0] },
      // Right (+X)
      { size: [wallThick, wallVisualHeight, floorDepth + wallThick * 2], pos: [floorWidth / 2 + wallThick / 2, wallVisualHeight / 2, 0] },
      // Top (-Z)
      { size: [floorWidth, wallVisualHeight, wallThick], pos: [0, wallVisualHeight / 2, -floorDepth / 2 - wallThick / 2] },
      // Bottom (+Z) : 트레이와 아래쪽 보관함 사이의 경계 벽
      { size: [floorWidth, wallVisualHeight, wallThick], pos: [0, wallVisualHeight / 2, floorDepth / 2 + wallThick / 2] }
    ];

    // 시각적 우드 프레임 렌더링
    wallsConfig.forEach(cfg => {
      const geo = new THREE.BoxGeometry(...cfg.size);
      const mesh = new THREE.Mesh(geo, woodMat);
      mesh.position.set(...cfg.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      trayGroup.add(mesh);
    });

    // ⭐ 물리 투명 충돌 벽 (Invisible Barrier): 상공 높이 22까지 밀폐하여 탈출 100% 원천 차단 ⭐
    const wallPhysicsHeight = 22.0;
    wallsConfig.forEach(cfg => {
      const wallShape = new CANNON.Box(new CANNON.Vec3(cfg.size[0] / 2, wallPhysicsHeight / 2, cfg.size[2] / 2));
      const wallBody = new CANNON.Body({
        mass: 0,
        shape: wallShape,
        material: this.trayMaterial,
        position: new CANNON.Vec3(cfg.pos[0], wallPhysicsHeight / 2, cfg.pos[2])
      });
      this.world.addBody(wallBody);
    });

    // 3. 바닥 물리 평면
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.trayMaterial
    });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(floorBody);

    // 4. 천장 물리 평면 (Y=8.5 밀폐)
    const ceilingBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      position: new CANNON.Vec3(0, 8.5, 0)
    });
    ceilingBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    this.world.addBody(ceilingBody);

    // 5. ⭐ 상자 바깥 아래쪽 주사위 보관함 (Keep Tray Dock) ⭐
    // 수직 시야에서 바로 아래에 완벽하게 보이도록 Z = 9.2 위치에 안착
    const rackZ = 9.2;
    const rackWidth = 20;
    const rackDepth = 3.6;
    const rackHeight = 0.4;

    const rackBaseGeo = new THREE.BoxGeometry(rackWidth, rackHeight, rackDepth);
    const rackBaseMesh = new THREE.Mesh(rackBaseGeo, woodMat);
    rackBaseMesh.position.set(0, rackHeight / 2, rackZ);
    rackBaseMesh.receiveShadow = true;
    trayGroup.add(rackBaseMesh);

    // 보관함 내부 네이비 벨벳 패드 (주사위 5개가 안착하는 고급 슬롯)
    const padGeo = new THREE.BoxGeometry(rackWidth - 0.6, 0.05, rackDepth - 0.6);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x111c2e, // 깊고 깔끔한 네이비 블루
      roughness: 0.9,
      metalness: 0.02
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(0, rackHeight + 0.02, rackZ);
    padMesh.receiveShadow = true;
    trayGroup.add(padMesh);

    // 보관함 5개 주사위 안착 자리(슬롯 가이드) 시각화
    const slotSpacing = 2.8;
    const slotStartX = -((this.diceCount - 1) * slotSpacing) / 2;
    for (let i = 0; i < 5; i++) {
      const slotMarkGeo = new THREE.PlaneGeometry(2.1, 2.1);
      const slotMarkMat = new THREE.MeshBasicMaterial({
        color: 0x223552,
        transparent: true,
        opacity: 0.6
      });
      const slotMesh = new THREE.Mesh(slotMarkGeo, slotMarkMat);
      slotMesh.rotation.x = -Math.PI / 2;
      slotMesh.position.set(slotStartX + i * slotSpacing, rackHeight + 0.05, rackZ);
      trayGroup.add(slotMesh);
    }

    this.scene.add(trayGroup);
  }

  createDice() {
    const diceSize = 1.7;
    const halfSize = diceSize / 2;

    const faceTextures = [];
    for (let i = 0; i < 6; i++) {
      const mapping = this.faceMappings.find(m => m.faceIndex === i);
      faceTextures.push(createRealisticDiceFaceTexture(mapping.number));
    }

    // 사진 속 부드러운 둥근 모서리 주사위 (RoundedBoxGeometry)
    const diceGeometry = new RoundedBoxGeometry(diceSize, diceSize, diceSize, 6, 0.32);

    for (let i = 0; i < this.diceCount; i++) {
      // 빛반사 없이 항상 또렷하게 주사위 눈이 보이는 부드러운 매트 플라스틱
      const materials = faceTextures.map(tex => {
        return new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.55,
          metalness: 0.0
        });
      });

      const mesh = new THREE.Mesh(diceGeometry, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { diceIndex: i };
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(halfSize, halfSize, halfSize));
      const body = new CANNON.Body({
        mass: 1.15,
        shape: shape,
        material: this.diceMaterial,
        linearDamping: 0.14,
        angularDamping: 0.18
      });

      body.addEventListener('collide', (e) => {
        if (!this.isRolling) return;
        const impact = e.contact.getImpactVelocityAlongNormal();
        if (impact > 1.2) {
          const strength = Math.min((impact - 1.0) / 6.0, 1.8);
          sound.playDiceHit(strength);
        }
      });

      this.world.addBody(body);

      this.diceList.push({
        index: i,
        mesh: mesh,
        body: body,
        isKept: false,
        value: 1
      });
    }

    this.resetDicePositions();
  }

  resetDicePositions() {
    const spacing = 3.0;
    const startX = -((this.diceCount - 1) * spacing) / 2;

    this.diceList.forEach((dice, idx) => {
      dice.isKept = false;
      dice.value = idx + 1;

      dice.body.collisionFilterMask = -1;
      dice.body.collisionResponse = true;
      dice.body.velocity.set(0, 0, 0);
      dice.body.angularVelocity.set(0, 0, 0);
      dice.body.sleep();

      // 트레이 바닥 중앙(Z = 0)에 가지런히 정렬
      const targetX = startX + idx * spacing;
      const targetY = 0.86;
      const targetZ = 0;

      dice.body.position.set(targetX, targetY, targetZ);
      this.setDiceToValue(dice, idx + 1);

      dice.mesh.position.copy(dice.body.position);
      dice.mesh.quaternion.copy(dice.body.quaternion);

      this.updateDiceHighlight(dice);
    });
  }

  setDiceToValue(dice, val) {
    const targetMapping = this.faceMappings.find(m => m.number === val);
    if (!targetMapping) return;

    const fromVec = targetMapping.normal.clone();
    const toVec = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(fromVec, toVec);

    dice.body.quaternion.set(q.x, q.y, q.z, q.w);
    dice.mesh.quaternion.copy(dice.body.quaternion);
    dice.value = val;
  }

  rollDice(keepIndices = []) {
    if (this.isRolling) return;

    this.isRolling = true;
    this.rollStartTime = performance.now();
    this.settleStableTime = 0;

    sound.playRollThrow();

    const rollIndices = [];
    for (let i = 0; i < this.diceCount; i++) {
      if (!keepIndices.includes(i)) {
        rollIndices.push(i);
      }
    }

    this.arrangeKeptDice(keepIndices);

    // 트레이 내부 상단에서 자연스럽게 투척
    const throwCornerX = -5.5 + (Math.random() * 1.5 - 0.75);
    const throwCornerZ = -3.5 + (Math.random() * 1.5 - 0.75);
    const throwBaseHeight = 5.5;

    rollIndices.forEach((diceIdx, i) => {
      const dice = this.diceList[diceIdx];
      dice.isKept = false;
      this.updateDiceHighlight(dice);

      dice.body.collisionFilterMask = -1;
      dice.body.collisionResponse = true;
      dice.body.wakeUp();

      const posX = throwCornerX + (i % 2) * 1.5 + (Math.random() * 0.4 - 0.2);
      const posY = throwBaseHeight + i * 0.4 + Math.random() * 0.4;
      const posZ = throwCornerZ + Math.floor(i / 2) * 1.5 + (Math.random() * 0.4 - 0.2);
      dice.body.position.set(posX, posY, posZ);

      // 활기차고 자연스러운 굴림
      const velX = 10.5 + Math.random() * 6.0;
      const velY = -3.0 - Math.random() * 3.5;
      const velZ = 7.0 + Math.random() * 5.0;
      dice.body.velocity.set(velX, velY, velZ);

      const angX = (Math.random() - 0.5) * 50;
      const angY = (Math.random() - 0.5) * 45;
      const angZ = (Math.random() - 0.5) * 50;
      dice.body.angularVelocity.set(angX, angY, angZ);

      dice.body.quaternion.set(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      );
      dice.body.quaternion.normalize();
    });
  }

  // ⭐ 킵된 주사위를 상자 바깥 아래쪽 전용 랙(Z = 9.2)에 정렬하고 충돌 원천 차단 ⭐
  arrangeKeptDice(keepIndices) {
    if (keepIndices.length === 0) return;

    const spacing = 2.8;
    const startX = -((keepIndices.length - 1) * spacing) / 2;
    const outerRackZ = 9.2;
    const outerRackY = 1.05;

    keepIndices.forEach((diceIdx, i) => {
      const dice = this.diceList[diceIdx];
      dice.isKept = true;
      this.updateDiceHighlight(dice);

      dice.body.collisionFilterMask = 0;
      dice.body.collisionResponse = false;
      dice.body.sleep();
      dice.body.velocity.set(0, 0, 0);
      dice.body.angularVelocity.set(0, 0, 0);

      const targetX = startX + i * spacing;
      dice.body.position.set(targetX, outerRackY, outerRackZ);

      this.setDiceToValue(dice, dice.value);

      dice.mesh.position.copy(dice.body.position);
      dice.mesh.quaternion.copy(dice.body.quaternion);
    });
  }

  toggleKeep(diceIndex) {
    if (this.isRolling) return;
    const dice = this.diceList[diceIndex];
    if (!dice) return;

    dice.isKept = !dice.isKept;
    sound.playKeep(dice.isKept);
    this.updateDiceHighlight(dice);

    const kept = this.getKeptIndices();
    this.arrangeKeptDice(kept);

    if (!dice.isKept) {
      dice.body.collisionFilterMask = -1;
      dice.body.collisionResponse = true;
      dice.body.position.set(dice.mesh.position.x, 0.86, 0);
      this.setDiceToValue(dice, dice.value);
      dice.mesh.position.copy(dice.body.position);
    }

    if (this.onDiceClick) {
      this.onDiceClick(diceIndex, dice.isKept);
    }
  }

  setDiceKept(diceIndex, isKept) {
    const dice = this.diceList[diceIndex];
    if (!dice) return;
    dice.isKept = isKept;
    this.updateDiceHighlight(dice);

    const kept = this.getKeptIndices();
    this.arrangeKeptDice(kept);

    if (!dice.isKept) {
      dice.body.collisionFilterMask = -1;
      dice.body.collisionResponse = true;
      dice.body.position.set(dice.mesh.position.x, 0.86, 0);
      this.setDiceToValue(dice, dice.value);
      dice.mesh.position.copy(dice.body.position);
    }
  }

  getKeptIndices() {
    return this.diceList
      .filter(d => d.isKept)
      .map(d => d.index);
  }

  getCurrentValues() {
    return this.diceList.map(d => d.value);
  }

  updateDiceHighlight(dice) {
    const emissiveColor = dice.isKept ? 0x221a08 : 0x000000;
    dice.mesh.material.forEach(mat => {
      mat.emissive = new THREE.Color(emissiveColor);
    });
  }

  readTopValue(dice) {
    const upVector = new THREE.Vector3(0, 1, 0);
    let bestDot = -Infinity;
    let bestNumber = 1;

    for (const mapping of this.faceMappings) {
      const worldNormal = mapping.normal.clone().applyQuaternion(dice.mesh.quaternion);
      const dot = worldNormal.dot(upVector);

      if (dot > bestDot) {
        bestDot = dot;
        bestNumber = mapping.number;
      }
    }

    if (bestDot < 0.85) {
      this.setDiceToValue(dice, bestNumber);
    }

    return bestNumber;
  }

  setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e) => {
      if (this.isRolling) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const meshes = this.diceList.map(d => d.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const diceIdx = hitMesh.userData.diceIndex;
        if (diceIdx !== undefined) {
          this.toggleKeep(diceIdx);
        }
      }
    };

    this.renderer.domElement.addEventListener('pointerdown', handleClick);
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);

    const timeStep = 1 / 60;
    this.world.step(timeStep);

    let allStationary = true;
    const now = performance.now();
    const elapsedSinceRoll = now - this.rollStartTime;

    for (const dice of this.diceList) {
      if (!dice.isKept && this.isRolling) {
        dice.mesh.position.copy(dice.body.position);
        dice.mesh.quaternion.copy(dice.body.quaternion);

        const vLen = dice.body.velocity.length();
        const wLen = dice.body.angularVelocity.length();

        if (vLen > 0.12 || wLen > 0.18) {
          allStationary = false;
        }
      } else {
        dice.mesh.position.copy(dice.body.position);
        dice.mesh.quaternion.copy(dice.body.quaternion);
      }
    }

    if (this.isRolling) {
      if (elapsedSinceRoll > 600) {
        if (allStationary) {
          this.settleStableTime += timeStep;
        } else {
          this.settleStableTime = 0;
        }

        if (this.settleStableTime > 0.25 || elapsedSinceRoll > 3000) {
          this.isRolling = false;
          this.settleStableTime = 0;

          for (const dice of this.diceList) {
            if (!dice.isKept) {
              dice.body.sleep();
              dice.value = this.readTopValue(dice);
            }
          }

          const values = this.getCurrentValues();
          if (this.onDiceSettled) {
            this.onDiceSettled(values);
          }
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
