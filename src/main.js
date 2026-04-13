/**
 * FIFA-style soccer game — Three.js + Vite
 * Single-file game logic (Player class only modular OOP per spec).
 */

import * as THREE from 'three';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PITCH_CONFIG = {
  length: 105,
  width: 68,
  halfLength: 52.5,
  halfWidth: 34,
  surfaceColor: 0x2d6b3a,
  stripeColor: 0x256030,
  lineColor: 0xffffff,
  lineHeight: 0.02,
  penaltyDepth: 16.5,
  penaltyWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  centerCircleRadius: 9.15,
};

const PLAYER_CONFIG = {
  height: 1.8,
  bodyRadius: 0.35,
  headRadius: 0.22,
  walkSpeed: 5,
  runSpeed: 10,
  sprintSpeed: 14,
  passAccuracy: 0.9,
  shotAccuracy: 0.8,
  controlRadius: 1.5,
  tackleRadius: 5,
  tackleForce: 15,
  staminaMax: 100,
  sprintDrain: 22,
  staminaRecover: 16,
  friction: 0.88,
  aiChaseRange: 15,
  aiReactionTime: 0.2,
  aiSprintChance: 0.3,
  gkMoveRange: 3.2,
  gkDiveRange: 12,
  gkSaveForce: 15,
};

const STADIUM_CONFIG = {
  /** Optional: load GLTF path and parent to scene if extended */
  customModelUrl: null,
  ambientIntensity: 0.35,
  sunIntensity: 0.95,
  sunPosition: new THREE.Vector3(40, 80, 20),
  fogColor: 0xaaccff,
  fogNear: 80,
  fogFar: 220,
  floodIntensity: 0.55,
  floodDistance: 120,
  floodDecay: 2,
};

const GAME_CONFIG = {
  halfDurationSec: 180,
  fullDurationSec: 360,
  gravity: 20,
  ballFriction: 0.98,
  ballBounce: 0.6,
  ballRadius: 0.22,
  ballStopThreshold: 0.15,
  ballControlSpeedMax: 2.2,
  passPowerMul: 0.8,
  throughPowerMul: 0.9,
  shootPowerMul: 1.0,
  kickBasePower: 28,
  /** Seconds to reach full shot charge while holding E */
  shotChargeDuration: 1.2,
  goalLineZHome: -52.5,
  goalLineZAway: 52.5,
  goalWidth: 7.32,
  goalHeight: 2.44,
  cameraHeight: 25,
  cameraDistance: 35,
  cameraAngleDeg: 45,
  cameraLerp: 0.05,
  userTeamIndex: 0,
};

const TEAMS = {
  home: {
    name: 'Barcelona',
    colors: { primary: 0xa50044, secondary: 0x004d98, accent: 0xedbb00 },
  },
  away: {
    name: 'Real Madrid',
    colors: { primary: 0xffffff, secondary: 0x00529f, accent: 0xfeb801 },
  },
};

/** 4-3-3 local offsets from team anchor (x, z). Team 0 defends negative Z first half. */
const FORMATION_SLOTS = [
  { role: 'gk', offset: new THREE.Vector2(0, -46) },
  { role: 'def', offset: new THREE.Vector2(-20, -34) },
  { role: 'def', offset: new THREE.Vector2(-7, -36) },
  { role: 'def', offset: new THREE.Vector2(7, -36) },
  { role: 'def', offset: new THREE.Vector2(20, -34) },
  { role: 'mid', offset: new THREE.Vector2(-14, -22) },
  { role: 'mid', offset: new THREE.Vector2(0, -24) },
  { role: 'mid', offset: new THREE.Vector2(14, -22) },
  { role: 'fwd', offset: new THREE.Vector2(-10, -10) },
  { role: 'fwd', offset: new THREE.Vector2(0, -8) },
  { role: 'fwd', offset: new THREE.Vector2(10, -10) },
];

const GAME_STATE = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  HALFTIME: 'HALFTIME',
  FULLTIME: 'FULLTIME',
};

// =============================================================================
// GLOBALS
// =============================================================================

let scene;
let camera;
let renderer;
let clock;
let gameState = GAME_STATE.LOADING;

let gameBall = null;
let ballShadow = null;
let ballVelocity = new THREE.Vector3();
let ballOwner = null;

let players = [];
let controlledPlayer = null;
let selectionRing = null;
let selectionRingMat = null;

let homeScore = 0;
let awayScore = 0;
let matchTimeSec = 0;
let currentHalf = 1;
/** After halftime, teams swap ends: flip Z of formation for everyone. */
let sidesSwapped = false;

const keys = {};
let keySpacePressed = false;
let keyEPressed = false;
let keyQPressed = false;
/** User shot charge 0–1 while holding E with the ball */
let shotChargePct = 0;
let shotCharging = false;

const cameraTargetPos = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

let goalPopupTimer = 0;
let uiTimerAccum = 0;

/** @type {AudioContext | null} */
let audioCtx = null;

// DOM
let elLoadingScreen;
let elLoadingBar;
let elLoadingText;
let elMainMenu;
let elPauseMenu;
let elHalftimeScreen;
let elFulltimeScreen;
let elHud;
let elScoreboard;
let elMatchTimer;
let elStaminaFill;
let elHalftimeScore;
let elFulltimeScore;
let elFulltimeResult;
let elGoalPopup;
let elGoalTeamName;
let minimapCanvas;
let minimapCtx;
let elShotBar;

// =============================================================================
// PLAYER CLASS
// =============================================================================

class Player {
  constructor(teamIndex, slotIndex, role) {
    this.teamIndex = teamIndex;
    this.slotIndex = slotIndex;
    this.role = role;
    this.velocity = new THREE.Vector3();
    this.stamina = PLAYER_CONFIG.staminaMax;
    this.rotation = 0;
    this.hasBall = false;
    this.isUserControlled = false;
    this.aiReaction = 0;
    this.mesh = null;
    this.formationWorld = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._kickScratch = new THREE.Vector3();
    /** Horizontal speed (units/s), used for stride phase and amplitude */
    this.speed = 0;
    this.legPivotL = null;
    this.legPivotR = null;
    this.createMesh();
  }

  createMesh() {
    const team = this.teamIndex === 0 ? TEAMS.home : TEAMS.away;
    const group = new THREE.Group();
    const bodyH = PLAYER_CONFIG.height * 0.55;
    const bodyGeo = new THREE.CylinderGeometry(
      PLAYER_CONFIG.bodyRadius,
      PLAYER_CONFIG.bodyRadius * 0.92,
      bodyH,
      10
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color: team.colors.primary,
      roughness: 0.55,
      metalness: 0.08,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyH * 0.5 + 0.08;
    body.castShadow = true;
    group.add(body);

    const legW = 0.1;
    const legD = 0.1;
    const legLen = bodyH * 0.44;
    const legGeo = new THREE.BoxGeometry(legW, legLen, legD);
    const legMat = new THREE.MeshStandardMaterial({
      color: team.colors.secondary,
      roughness: 0.65,
      metalness: 0.05,
    });
    const hipY = -bodyH * 0.38;
    const hipX = PLAYER_CONFIG.bodyRadius * 0.34;

    this.legPivotL = new THREE.Group();
    this.legPivotL.position.set(-hipX, hipY, 0);
    const legMeshL = new THREE.Mesh(legGeo, legMat);
    legMeshL.position.y = -legLen * 0.5;
    legMeshL.castShadow = true;
    this.legPivotL.add(legMeshL);
    body.add(this.legPivotL);

    this.legPivotR = new THREE.Group();
    this.legPivotR.position.set(hipX, hipY, 0);
    const legMeshR = new THREE.Mesh(legGeo.clone(), legMat.clone());
    legMeshR.position.y = -legLen * 0.5;
    legMeshR.castShadow = true;
    this.legPivotR.add(legMeshR);
    body.add(this.legPivotR);

    const headGeo = new THREE.SphereGeometry(PLAYER_CONFIG.headRadius, 12, 10);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffdcb4,
      roughness: 0.65,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = bodyH + PLAYER_CONFIG.headRadius + 0.1;
    head.castShadow = true;
    group.add(head);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.slotIndex + 1), 32, 34);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const jerseyGeo = new THREE.PlaneGeometry(0.55, 0.55);
    const jerseyMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const jersey = new THREE.Mesh(jerseyGeo, jerseyMat);
    jersey.position.set(0, bodyH * 0.55 + 0.1, PLAYER_CONFIG.bodyRadius + 0.02);
    group.add(jersey);

    const shortsGeo = new THREE.CylinderGeometry(
      PLAYER_CONFIG.bodyRadius * 0.85,
      PLAYER_CONFIG.bodyRadius * 0.75,
      bodyH * 0.28,
      8
    );
    const shortsMat = new THREE.MeshStandardMaterial({
      color: team.colors.secondary,
      roughness: 0.6,
    });
    const shorts = new THREE.Mesh(shortsGeo, shortsMat);
    shorts.position.y = bodyH * 0.2;
    shorts.castShadow = true;
    group.add(shorts);

    this.mesh = group;
    this.mesh.userData.player = this;
  }

  get position() {
    return this.mesh.position;
  }

  move(direction, isSprinting, deltaTime) {
    if (!direction || direction.lengthSq() < 1e-6) {
      this.velocity.multiplyScalar(Math.pow(PLAYER_CONFIG.friction, deltaTime * 60));
      return;
    }
    const dir = direction.clone().normalize();
    this.rotation = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = this.rotation;

    let speed = PLAYER_CONFIG.runSpeed;
    if (isSprinting && this.stamina > 2) {
      speed = PLAYER_CONFIG.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - PLAYER_CONFIG.sprintDrain * deltaTime);
    } else {
      this.stamina = Math.min(
        PLAYER_CONFIG.staminaMax,
        this.stamina + PLAYER_CONFIG.staminaRecover * deltaTime
      );
    }
    if (direction.length() < 0.85) speed = PLAYER_CONFIG.walkSpeed;

    const targetVel = dir.multiplyScalar(speed);
    this.velocity.lerp(targetVel, 1 - Math.pow(0.001, deltaTime * 60));
  }

  kick(direction, power) {
    if (!direction || direction.lengthSq() < 1e-6) return;
    const d = direction.clone().normalize();
    this._kickScratch.copy(d).multiplyScalar(power);
    return this._kickScratch.clone();
  }

  clampToPitch() {
    const m = 0.5;
    this.position.x = THREE.MathUtils.clamp(
      this.position.x,
      -PITCH_CONFIG.halfWidth + m,
      PITCH_CONFIG.halfWidth - m
    );
    this.position.z = THREE.MathUtils.clamp(
      this.position.z,
      -PITCH_CONFIG.halfLength + m,
      PITCH_CONFIG.halfLength - m
    );
    this.position.y = 0;
  }

  /**
   * Procedural stride: phase = speed * elapsedTime, swing on X, amplitude scales walk→sprint.
   */
  updateLegAnimation() {
    if (!clock || !this.legPivotL || !this.legPivotR) return;

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);

    const walk = PLAYER_CONFIG.walkSpeed;
    const sprint = PLAYER_CONFIG.sprintSpeed;
    if (this.speed < 0.12) {
      this.legPivotL.rotation.x = THREE.MathUtils.lerp(this.legPivotL.rotation.x, 0, 0.15);
      this.legPivotR.rotation.x = THREE.MathUtils.lerp(this.legPivotR.rotation.x, 0, 0.15);
      return;
    }

    const phase = this.speed * clock.getElapsedTime();
    const speedNorm = THREE.MathUtils.clamp(
      (this.speed - walk) / Math.max(0.001, sprint - walk),
      0,
      1
    );
    const amplitude = THREE.MathUtils.lerp(0.22, 0.62, speedNorm);
    const swing = Math.sin(phase) * amplitude;
    this.legPivotL.rotation.x = swing;
    this.legPivotR.rotation.x = -swing;
  }

  update(deltaTime) {
    this.position.addScaledVector(this.velocity, deltaTime);
    this.clampToPitch();
    this.updateLegAnimation();
  }
}

// =============================================================================
// SCENE & RENDERER
// =============================================================================

function setupRenderer(canvas) {
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

function setupLighting() {
  scene.fog = new THREE.Fog(
    STADIUM_CONFIG.fogColor,
    STADIUM_CONFIG.fogNear,
    STADIUM_CONFIG.fogFar
  );

  const ambient = new THREE.AmbientLight(0xffffff, STADIUM_CONFIG.ambientIntensity);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e6, STADIUM_CONFIG.sunIntensity);
  sun.position.copy(STADIUM_CONFIG.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  scene.add(sun);

  const corners = [
    new THREE.Vector3(-48, 28, -42),
    new THREE.Vector3(48, 28, -42),
    new THREE.Vector3(-48, 28, 42),
    new THREE.Vector3(48, 28, 42),
  ];
  corners.forEach((pos) => {
    const pl = new THREE.PointLight(0xffeedd, STADIUM_CONFIG.floodIntensity, STADIUM_CONFIG.floodDistance, STADIUM_CONFIG.floodDecay);
    pl.position.copy(pos);
    scene.add(pl);
  });
}

// =============================================================================
// PITCH
// =============================================================================

function createStripeTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = `#${PITCH_CONFIG.surfaceColor.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 4, 4);
  g.fillStyle = `#${PITCH_CONFIG.stripeColor.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 2, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 26);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addLine(points, y = PITCH_CONFIG.lineHeight) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: PITCH_CONFIG.lineColor });
  const line = new THREE.Line(geo, mat);
  line.position.y = y;
  scene.add(line);
}

function createPitch() {
  const tex = createStripeTexture();
  const geo = new THREE.PlaneGeometry(PITCH_CONFIG.length, PITCH_CONFIG.width);
  const mat = new THREE.MeshStandardMaterial({
    map: tex || undefined,
    color: tex ? 0xffffff : PITCH_CONFIG.surfaceColor,
    roughness: 0.9,
    metalness: 0,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  const hw = PITCH_CONFIG.halfWidth;
  const hl = PITCH_CONFIG.halfLength;
  const pd = PITCH_CONFIG.penaltyDepth;
  const pw = PITCH_CONFIG.penaltyWidth / 2;
  const gaD = PITCH_CONFIG.goalAreaDepth;
  const gaW = PITCH_CONFIG.goalAreaWidth / 2;
  const cr = PITCH_CONFIG.centerCircleRadius;

  addLine([
    new THREE.Vector3(0, 0, -hw),
    new THREE.Vector3(0, 0, hw),
  ]);

  addLine([
    new THREE.Vector3(-hl, 0, -hw),
    new THREE.Vector3(hl, 0, -hw),
    new THREE.Vector3(hl, 0, hw),
    new THREE.Vector3(-hl, 0, hw),
    new THREE.Vector3(-hl, 0, -hw),
  ]);

  const arcSegs = 48;
  const circlePts = [];
  for (let i = 0; i <= arcSegs; i++) {
    const a = (i / arcSegs) * Math.PI * 2;
    circlePts.push(new THREE.Vector3(Math.sin(a) * cr, 0, Math.cos(a) * cr));
  }
  addLine(circlePts);

  addLine([new THREE.Vector3(0, 0, 0)]);

  addLine([
    new THREE.Vector3(-hl + pd, 0, -pw),
    new THREE.Vector3(-hl + pd, 0, pw),
    new THREE.Vector3(-hl, 0, pw),
    new THREE.Vector3(-hl, 0, -pw),
    new THREE.Vector3(-hl + pd, 0, -pw),
  ]);
  addLine([
    new THREE.Vector3(hl - pd, 0, -pw),
    new THREE.Vector3(hl - pd, 0, pw),
    new THREE.Vector3(hl, 0, pw),
    new THREE.Vector3(hl, 0, -pw),
    new THREE.Vector3(hl - pd, 0, -pw),
  ]);

  addLine([
    new THREE.Vector3(-hl + gaD, 0, -gaW),
    new THREE.Vector3(-hl + gaD, 0, gaW),
    new THREE.Vector3(-hl, 0, gaW),
    new THREE.Vector3(-hl, 0, -gaW),
    new THREE.Vector3(-hl + gaD, 0, -gaW),
  ]);
  addLine([
    new THREE.Vector3(hl - gaD, 0, -gaW),
    new THREE.Vector3(hl - gaD, 0, gaW),
    new THREE.Vector3(hl, 0, gaW),
    new THREE.Vector3(hl, 0, -gaW),
    new THREE.Vector3(hl - gaD, 0, -gaW),
  ]);

  const arcR = 9.15;
  const arcPtsL = [];
  for (let i = 0; i <= 24; i++) {
    const t = -Math.PI * 0.35 + (i / 24) * Math.PI * 0.7;
    arcPtsL.push(
      new THREE.Vector3(-hl + pd + Math.cos(t) * arcR, 0, Math.sin(t) * arcR)
    );
  }
  addLine(arcPtsL);
  const arcPtsR = [];
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI * 0.65 + (i / 24) * Math.PI * 0.7;
    arcPtsR.push(
      new THREE.Vector3(hl - pd + Math.cos(t) * arcR, 0, Math.sin(t) * arcR)
    );
  }
  addLine(arcPtsR);
}

// =============================================================================
// GOALS & NET
// =============================================================================

function createNet(side) {
  const gw = GAME_CONFIG.goalWidth / 2;
  const gh = GAME_CONFIG.goalHeight;
  const depth = 2.2;
  const z0 = side * (PITCH_CONFIG.halfLength + depth * 0.5);
  const group = new THREE.Group();

  const postMat = new THREE.MeshStandardMaterial({ color: 0xffdd33, roughness: 0.4, metalness: 0.3 });
  const postR = 0.12;
  const postGeo = new THREE.CylinderGeometry(postR, postR, gh, 8);

  const left = new THREE.Mesh(postGeo, postMat);
  left.position.set(-gw, gh * 0.5, side * PITCH_CONFIG.halfLength);
  left.castShadow = true;
  group.add(left);

  const right = new THREE.Mesh(postGeo, postMat);
  right.position.set(gw, gh * 0.5, side * PITCH_CONFIG.halfLength);
  right.castShadow = true;
  group.add(right);

  const barGeo = new THREE.CylinderGeometry(postR, postR, gw * 2 + postR * 2, 8);
  const bar = new THREE.Mesh(barGeo, postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, gh, side * PITCH_CONFIG.halfLength);
  bar.castShadow = true;
  group.add(bar);

  const netMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const netGeo = new THREE.BoxGeometry(gw * 2, gh, depth);
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set(0, gh * 0.5, z0);
  group.add(net);

  scene.add(group);
}

function createGoal(side) {
  createNet(side);
}

// =============================================================================
// BALL
// =============================================================================

function createBall() {
  const geo = new THREE.SphereGeometry(GAME_CONFIG.ballRadius, 24, 18);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35,
    metalness: 0.15,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(0, GAME_CONFIG.ballRadius, 0);
  scene.add(mesh);
  return mesh;
}

function createBallShadow() {
  const geo = new THREE.CircleGeometry(GAME_CONFIG.ballRadius * 1.4, 24);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  scene.add(mesh);
  return mesh;
}

// =============================================================================
// TEAMS & FORMATIONS
// =============================================================================

function computeFormationWorld(teamIndex, slot) {
  const slotData = FORMATION_SLOTS[slot];
  if (!slotData) return new THREE.Vector3();
  let z = slotData.offset.z;
  if (teamIndex === 1) z = -z;
  if (sidesSwapped) z = -z;
  return new THREE.Vector3(slotData.offset.x, 0, z);
}

function setupTeams() {
  players.forEach((p) => {
    if (p.mesh.parent) scene.remove(p.mesh);
  });
  players = [];

  for (let t = 0; t < 2; t++) {
    for (let s = 0; s < 11; s++) {
      const role = FORMATION_SLOTS[s].role;
      const p = new Player(t, s, role);
      const fw = computeFormationWorld(t, s);
      p.formationWorld.copy(fw);
      p.mesh.position.copy(fw);
      p.mesh.position.y = 0;
      scene.add(p.mesh);
      players.push(p);
    }
  }

  const userTeam = GAME_CONFIG.userTeamIndex;
  controlledPlayer = players.find((p) => p.teamIndex === userTeam && p.role === 'fwd' && p.slotIndex === 9) || players[userTeam * 11];
  players.forEach((p) => {
    p.isUserControlled = p === controlledPlayer;
  });
}

function resetPlayersToFormation() {
  players.forEach((p) => {
    const fw = computeFormationWorld(p.teamIndex, p.slotIndex);
    p.formationWorld.copy(fw);
    p.mesh.position.set(fw.x, 0, fw.z);
    p.velocity.set(0, 0, 0);
    p.hasBall = false;
    p.stamina = PLAYER_CONFIG.staminaMax;
  });
  ballOwner = null;
  if (gameBall) {
    gameBall.position.set(0, GAME_CONFIG.ballRadius, 0);
    ballVelocity.set(0, 0, 0);
  }
}

// =============================================================================
// BALL PHYSICS & CONTROL
// =============================================================================

function isBallInGoalMouth(zLine, ballPos) {
  const gw = GAME_CONFIG.goalWidth * 0.5 + GAME_CONFIG.ballRadius;
  return Math.abs(ballPos.x) <= gw && ballPos.y - GAME_CONFIG.ballRadius < GAME_CONFIG.goalHeight;
}

function updateBallPhysics(deltaTime) {
  if (!gameBall) return;

  if (ballOwner) {
    const off = tmpV1.set(Math.sin(ballOwner.rotation), 0, Math.cos(ballOwner.rotation)).multiplyScalar(0.9);
    gameBall.position.copy(ballOwner.position).add(off);
    gameBall.position.y = GAME_CONFIG.ballRadius;
    ballVelocity.set(0, 0, 0);
    updateBallShadow();
    return;
  }

  ballVelocity.y -= GAME_CONFIG.gravity * deltaTime;
  gameBall.position.addScaledVector(ballVelocity, deltaTime);

  const r = GAME_CONFIG.ballRadius;
  const groundY = r;
  if (gameBall.position.y < groundY) {
    gameBall.position.y = groundY;
    ballVelocity.y *= -GAME_CONFIG.ballBounce;
    if (Math.abs(ballVelocity.y) < 0.4) ballVelocity.y = 0;
    ballVelocity.x *= GAME_CONFIG.ballFriction;
    ballVelocity.z *= GAME_CONFIG.ballFriction;
  }

  const hw = PITCH_CONFIG.halfWidth - r * 0.9;
  const hl = PITCH_CONFIG.halfLength - r * 0.9;
  const gw = GAME_CONFIG.goalWidth * 0.5 + r * 0.5;

  if (gameBall.position.x < -hw) {
    gameBall.position.x = -hw;
    ballVelocity.x *= -GAME_CONFIG.ballBounce * 0.85;
  } else if (gameBall.position.x > hw) {
    gameBall.position.x = hw;
    ballVelocity.x *= -GAME_CONFIG.ballBounce * 0.85;
  }

  const z = gameBall.position.z;
  const yTop = gameBall.position.y;

  if (z < -hl) {
    if (!isBallInGoalMouth(GAME_CONFIG.goalLineZHome, gameBall.position)) {
      gameBall.position.z = -hl;
      ballVelocity.z *= -GAME_CONFIG.ballBounce * 0.85;
    }
  } else if (z > hl) {
    if (!isBallInGoalMouth(GAME_CONFIG.goalLineZAway, gameBall.position)) {
      gameBall.position.z = hl;
      ballVelocity.z *= -GAME_CONFIG.ballBounce * 0.85;
    }
  }

  if (gameBall.position.y <= groundY + 0.02) {
    ballVelocity.x *= Math.pow(GAME_CONFIG.ballFriction, deltaTime * 60 * 0.08);
    ballVelocity.z *= Math.pow(GAME_CONFIG.ballFriction, deltaTime * 60 * 0.08);
  }

  const spd = ballVelocity.length();
  if (spd < GAME_CONFIG.ballStopThreshold && gameBall.position.y <= groundY + 0.05) {
    ballVelocity.multiplyScalar(0.92);
    if (spd < 0.05) ballVelocity.set(0, 0, 0);
  }

  updateBallShadow();
}

function updateBallShadow() {
  if (!ballShadow || !gameBall) return;
  ballShadow.position.x = gameBall.position.x;
  ballShadow.position.z = gameBall.position.z;
  const h = Math.max(0, gameBall.position.y - GAME_CONFIG.ballRadius);
  const fade = THREE.MathUtils.clamp(1 - h / 8, 0.12, 0.55);
  ballShadow.material.opacity = fade;
  const sc = 1 + h * 0.08;
  ballShadow.scale.set(sc, sc, sc);
}

function releaseBallFromOwner() {
  if (ballOwner) {
    ballOwner.hasBall = false;
    ballOwner = null;
  }
}

function applyAccuracy(dir, accuracy) {
  const spread = (1 - accuracy) * 0.35;
  return dir.clone().add(
    new THREE.Vector3(
      (Math.random() - 0.5) * 2 * spread,
      0,
      (Math.random() - 0.5) * 2 * spread
    )
  ).normalize();
}

function checkBallControl() {
  if (!gameBall || ballOwner) return;
  const spd = ballVelocity.length();
  if (spd > GAME_CONFIG.ballControlSpeedMax) return;

  let best = null;
  let bestD = PLAYER_CONFIG.controlRadius;

  for (const p of players) {
    const d = p.position.distanceTo(gameBall.position);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }

  if (best) {
    ballOwner = best;
    best.hasBall = true;
    ballVelocity.set(0, 0, 0);
  }
}

// =============================================================================
// PASS / SHOOT / THROUGH / TACKLE / SWITCH
// =============================================================================

// =============================================================================
// WEB AUDIO (lightweight, no external libs)
// =============================================================================

function initAudio() {
  if (audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
}

/**
 * @param {'kick' | 'whistle' | 'crowd_cheer'} type
 */
function playSound(type) {
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const t0 = audioCtx.currentTime;
  const eps = 0.0001;

  if (type === 'kick') {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(eps, t0 + 0.08);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.085);
    return;
  }

  if (type === 'whistle') {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, t0);
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.025);
    g.gain.exponentialRampToValueAtTime(eps, t0 + 0.6);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.62);
    return;
  }

  if (type === 'crowd_cheer') {
    const dur = 1.2;
    const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, t0);
    filter.Q.setValueAtTime(0.7, t0);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.45);
    g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audioCtx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}

function getClosestTeammate(player) {
  let best = null;
  let bestD = 1e9;
  for (const p of players) {
    if (p === player || p.teamIndex !== player.teamIndex) continue;
    const d = p.position.distanceTo(player.position);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function getAttackingGoalZ(teamIndex) {
  const sign = teamIndex === 0 ? 1 : -1;
  return sign * (sidesSwapped ? -1 : 1) * PITCH_CONFIG.halfLength;
}

function performPass(player) {
  if (!player || !player.hasBall || player !== ballOwner) return;
  const mate = getClosestTeammate(player);
  if (!mate) return;
  let dir = tmpV2.subVectors(mate.position, player.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) return;
  dir.normalize();
  dir = applyAccuracy(dir, PLAYER_CONFIG.passAccuracy);
  const power = GAME_CONFIG.kickBasePower * GAME_CONFIG.passPowerMul;
  releaseBallFromOwner();
  player.hasBall = false;
  ballVelocity.copy(dir.multiplyScalar(power));
  ballVelocity.y = 6;
  playSound('kick');
  checkBallControl();
}

/**
 * @param {number} [charge01=1] — 0–1 charge; AI uses full 1. Power = kickBasePower * (0.4 + charge * 0.6)
 */
function performShoot(player, charge01 = 1) {
  if (!player || !player.hasBall || player !== ballOwner) return;
  const gz = getAttackingGoalZ(player.teamIndex);
  const target = tmpV2.set(0, 0, gz);
  let dir = tmpV3.subVectors(target, player.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) return;
  dir.normalize();
  dir = applyAccuracy(dir, PLAYER_CONFIG.shotAccuracy);
  const c = THREE.MathUtils.clamp(charge01, 0, 1);
  const power = GAME_CONFIG.kickBasePower * (0.4 + c * 0.6);
  releaseBallFromOwner();
  player.hasBall = false;
  ballVelocity.copy(dir.multiplyScalar(power));
  ballVelocity.y = 3.5;
  playSound('kick');
}

function getThroughBallTarget(player) {
  const mates = players.filter((p) => p.teamIndex === player.teamIndex && p !== player);
  const atk = getAttackingGoalZ(player.teamIndex);
  let best = null;
  let bestAdvance = -1e9;
  for (const m of mates) {
    const adv = m.position.z * Math.sign(atk);
    if (adv > bestAdvance) {
      bestAdvance = adv;
      best = m;
    }
  }
  return best || getClosestTeammate(player);
}

function performThroughBall(player) {
  if (!player || !player.hasBall || player !== ballOwner) return;
  const mate = getThroughBallTarget(player);
  if (!mate) return;
  let dir = tmpV2.subVectors(mate.position, player.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) return;
  dir.normalize();
  dir = applyAccuracy(dir, PLAYER_CONFIG.passAccuracy);
  const power = GAME_CONFIG.kickBasePower * GAME_CONFIG.throughPowerMul;
  releaseBallFromOwner();
  player.hasBall = false;
  ballVelocity.copy(dir.multiplyScalar(power));
  ballVelocity.y = 9;
  playSound('kick');
}

function performTackle(player) {
  if (!player || player.hasBall) return;
  let best = null;
  let bestD = PLAYER_CONFIG.tackleRadius;
  for (const o of players) {
    if (o.teamIndex === player.teamIndex) continue;
    const d = o.position.distanceTo(player.position);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (!best || !gameBall) return;

  const push = tmpV2.subVectors(gameBall.position, best.position);
  push.y = 0;
  if (push.lengthSq() < 1e-4) push.set(0, 0, 1);
  push.normalize().multiplyScalar(PLAYER_CONFIG.tackleForce);
  releaseBallFromOwner();
  best.hasBall = false;
  ballVelocity.copy(push);
  ballVelocity.y = 2;
}

function switchToClosestPlayer() {
  const team = GAME_CONFIG.userTeamIndex;
  if (!gameBall) return;
  let best = null;
  let bestD = 1e9;
  for (const p of players) {
    if (p.teamIndex !== team) continue;
    const d = p.position.distanceTo(gameBall.position);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best) return;
  players.forEach((p) => {
    p.isUserControlled = p === best;
  });
  controlledPlayer = best;
}

// =============================================================================
// GOALS
// =============================================================================

function showGoal(teamName) {
  playSound('whistle');
  playSound('crowd_cheer');
  goalPopupTimer = 3;
  if (elGoalPopup && elGoalTeamName) {
    elGoalTeamName.textContent = teamName;
    elGoalPopup.classList.add('show');
  }
}

function checkGoals() {
  if (!gameBall || ballOwner) return;
  const gw = GAME_CONFIG.goalWidth * 0.5;
  const gh = GAME_CONFIG.goalHeight;
  const p = gameBall.position;
  const r = GAME_CONFIG.ballRadius;

  if (p.z + r < GAME_CONFIG.goalLineZHome && p.z + r > GAME_CONFIG.goalLineZHome - 2) {
    if (Math.abs(p.x) <= gw && p.y < gh + r) {
      awayScore += 1;
      showGoal(TEAMS.away.name);
      resetAfterGoal();
    }
  }
  if (p.z - r > GAME_CONFIG.goalLineZAway && p.z - r < GAME_CONFIG.goalLineZAway + 2) {
    if (Math.abs(p.x) <= gw && p.y < gh + r) {
      homeScore += 1;
      showGoal(TEAMS.home.name);
      resetAfterGoal();
    }
  }
}

function resetAfterGoal() {
  resetPlayersToFormation();
}

// =============================================================================
// INPUT & PLAYER MOVEMENT
// =============================================================================

function getMovementVector() {
  let x = 0;
  let z = 0;
  if (keys.KeyW || keys.w) z -= 1;
  if (keys.KeyS || keys.s) z += 1;
  if (keys.KeyA || keys.a) x -= 1;
  if (keys.KeyD || keys.d) x += 1;
  tmpV1.set(x, 0, z);
  if (tmpV1.lengthSq() > 1) tmpV1.normalize();
  return tmpV1;
}

function updatePlayerMovement(deltaTime) {
  if (!controlledPlayer) return;

  if (
    shotCharging &&
    (!controlledPlayer.hasBall || ballOwner !== controlledPlayer)
  ) {
    shotCharging = false;
    shotChargePct = 0;
  }

  if (
    shotCharging &&
    keys.KeyE &&
    controlledPlayer.hasBall &&
    ballOwner === controlledPlayer
  ) {
    shotChargePct = Math.min(
      1,
      shotChargePct + deltaTime / GAME_CONFIG.shotChargeDuration
    );
  }

  const dir = getMovementVector();
  const sprint = !!(keys.ShiftLeft || keys.ShiftRight);
  controlledPlayer.move(dir, sprint, deltaTime);

  if (keySpacePressed) {
    keySpacePressed = false;
    if (controlledPlayer.hasBall && ballOwner === controlledPlayer) {
      performPass(controlledPlayer);
    } else {
      switchToClosestPlayer();
    }
  }
  if (keyEPressed) {
    keyEPressed = false;
    performTackle(controlledPlayer);
  }
  if (keyQPressed) {
    keyQPressed = false;
    if (controlledPlayer.hasBall && ballOwner === controlledPlayer) {
      performThroughBall(controlledPlayer);
    }
  }
}

function updateAllPlayers(deltaTime) {
  for (const p of players) {
    p.update(deltaTime);
  }
}

// =============================================================================
// AI
// =============================================================================

function aiGoalkeeperBehavior(p, deltaTime) {
  /** Formation anchor (slot from computeFormationWorld), synced here only per AI contract */
  p.homePosition = p.formationWorld;

  p.aiReaction += deltaTime;
  if (p.aiReaction >= PLAYER_CONFIG.aiReactionTime) {
    p.aiReaction = 0;

    const goalZ = p.teamIndex === 0 ? -PITCH_CONFIG.halfLength : PITCH_CONFIG.halfLength;
    const ballToGoal = tmpV2.subVectors(gameBall.position, new THREE.Vector3(0, 0, goalZ));
    const distGoal = ballToGoal.length();

    const homePosition = p.homePosition;
    const weHaveBall = ballOwner && ballOwner.teamIndex === p.teamIndex;
    const toHome = tmpV3.set(
      homePosition.x - p.position.x,
      0,
      homePosition.z - p.position.z
    );
    const distHome = toHome.length();

    const bz = gameBall.position.z;
    const opponentThreatening = p.teamIndex === 0 ? bz < -10 : bz > 10;

    if (weHaveBall) {
      if (distHome > 2 && toHome.lengthSq() > 1e-6) {
        toHome.normalize().multiplyScalar(PLAYER_CONFIG.runSpeed * 0.65);
        p.velocity.lerp(toHome, 0.4);
      } else {
        p.velocity.multiplyScalar(0.88);
      }
    } else if (opponentThreatening) {
      const tx = THREE.MathUtils.clamp(
        gameBall.position.x,
        -PLAYER_CONFIG.gkMoveRange,
        PLAYER_CONFIG.gkMoveRange
      );
      const tz = goalZ + (p.teamIndex === 0 ? 0.8 : -0.8);
      const toTarget = tmpV3.set(tx - p.position.x, 0, tz - p.position.z);
      if (toTarget.length() > 0.05) {
        toTarget.normalize().multiplyScalar(PLAYER_CONFIG.runSpeed * 0.85);
        p.velocity.lerp(toTarget, 0.35);
      } else {
        p.velocity.multiplyScalar(0.85);
      }
    } else {
      if (distHome > 2 && toHome.lengthSq() > 1e-6) {
        toHome.normalize().multiplyScalar(PLAYER_CONFIG.runSpeed * 0.65);
        p.velocity.lerp(toHome, 0.35);
      } else {
        p.velocity.multiplyScalar(0.87);
      }
    }

    if (
      distGoal < PLAYER_CONFIG.gkDiveRange &&
      Math.abs(gameBall.position.x - p.position.x) < 4 &&
      gameBall.position.y < GAME_CONFIG.goalHeight + 1 &&
      !ballOwner
    ) {
      const saveDir = tmpV2.subVectors(gameBall.position, p.position);
      if (saveDir.lengthSq() > 1e-5) {
        saveDir.normalize();
        ballVelocity.addScaledVector(saveDir, PLAYER_CONFIG.gkSaveForce);
        gameBall.position.addScaledVector(saveDir, 0.15);
      }
    }
  }
}

function aiFieldPlayerBehavior(p, deltaTime) {
  /** Formation slot world target from computeFormationWorld */
  p.homePosition = p.formationWorld;
  const homePosition = p.homePosition;

  if (p.hasBall && ballOwner === p) {
    const goalZ = getAttackingGoalZ(p.teamIndex);
    const dir = tmpV2.set(0, 0, goalZ).sub(p.position);
    dir.y = 0;
    if (dir.lengthSq() > 1e-4) {
      dir.normalize();
      p.rotation = Math.atan2(dir.x, dir.z);
      p.mesh.rotation.y = p.rotation;
      const sprint = Math.random() < PLAYER_CONFIG.aiSprintChance;
      p.move(dir, sprint, deltaTime);
    }
    if (Math.random() < 0.02 * deltaTime * 60) {
      if (Math.random() < 0.45) performPass(p);
      else if (Math.random() < 0.35) performShoot(p);
      else performThroughBall(p);
    }
    return;
  }

  p.aiReaction += deltaTime;
  if (p.aiReaction < PLAYER_CONFIG.aiReactionTime) return;
  p.aiReaction = 0;

  const ballPos = gameBall.position;
  const weHaveBall = ballOwner != null && ballOwner.teamIndex === p.teamIndex;

  const distBallXZ = (pl) => {
    const dx = pl.position.x - ballPos.x;
    const dz = pl.position.z - ballPos.z;
    return Math.hypot(dx, dz);
  };

  const fieldMates = players.filter(
    (pl) => pl.teamIndex === p.teamIndex && pl.role !== 'gk'
  );
  const rankedByBall = [...fieldMates].sort(
    (a, b) => distBallXZ(a) - distBallXZ(b)
  );
  const pressers = new Set(rankedByBall.slice(0, 2));
  const isPresser = pressers.has(p);

  const dir = tmpV3.set(0, 0, 0);

  if (!weHaveBall) {
    if (isPresser) {
      const toBall = tmpV2.subVectors(ballPos, p.position);
      toBall.y = 0;
      if (toBall.lengthSq() > 1e-4) dir.copy(toBall.normalize());
    } else {
      const toHome = tmpV2.subVectors(homePosition, p.position);
      toHome.y = 0;
      if (toHome.length() > 2 && toHome.lengthSq() > 1e-4) {
        dir.copy(toHome.normalize());
      }
    }
  } else {
    const gz = getAttackingGoalZ(p.teamIndex);
    const carrier = ballOwner;
    const anchor = carrier ? carrier.position : ballPos;
    const forwardSign = Math.sign(gz - anchor.z) || (gz >= 0 ? 1 : -1);
    const runDepth =
      p.role === 'fwd' ? 10 : p.role === 'mid' ? 7 : p.role === 'def' ? 3.5 : 0;
    const lateralSpread = (p.slotIndex - 5) * 2.0;
    const spreadX = THREE.MathUtils.lerp(
      homePosition.x,
      anchor.x + lateralSpread,
      0.55
    );
    const targetZ = anchor.z + forwardSign * runDepth;
    const toRun = tmpV2.set(spreadX - p.position.x, 0, targetZ - p.position.z);
    if (toRun.lengthSq() > 1e-4) dir.copy(toRun.normalize());
  }

  if (dir.lengthSq() > 1e-4) {
    p.rotation = Math.atan2(dir.x, dir.z);
    p.mesh.rotation.y = p.rotation;
    const sprint = Math.random() < PLAYER_CONFIG.aiSprintChance;
    p.move(dir, sprint, deltaTime);
  } else {
    p.velocity.multiplyScalar(0.9);
  }

  const dist = distBallXZ(p);
  if (
    isPresser &&
    dist < 1.8 &&
    !p.hasBall &&
    ballOwner &&
    ballOwner.teamIndex !== p.teamIndex
  ) {
    performTackle(p);
  }
}

function updateAI(deltaTime) {
  if (gameState !== GAME_STATE.PLAYING) return;
  for (const p of players) {
    if (p.isUserControlled) continue;
    if (p.role === 'gk') aiGoalkeeperBehavior(p, deltaTime);
    else aiFieldPlayerBehavior(p, deltaTime);
  }
}

// =============================================================================
// MATCH TIME & STATES
// =============================================================================

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateMatchTime(deltaTime) {
  if (gameState !== GAME_STATE.PLAYING) return;
  matchTimeSec += deltaTime;
  if (matchTimeSec >= GAME_CONFIG.halfDurationSec && currentHalf === 1) {
    setState(GAME_STATE.HALFTIME);
    return;
  }
  if (matchTimeSec >= GAME_CONFIG.fullDurationSec && currentHalf === 2) {
    setState(GAME_STATE.FULLTIME);
  }
}

function beginSecondHalf() {
  currentHalf = 2;
  sidesSwapped = true;
  resetPlayersToFormation();
  players.forEach((p) => {
    p.formationWorld.copy(computeFormationWorld(p.teamIndex, p.slotIndex));
  });
}

function setState(next) {
  const prev = gameState;
  gameState = next;

  if (prev === GAME_STATE.PLAYING && next !== GAME_STATE.PLAYING) {
    shotCharging = false;
    shotChargePct = 0;
  }

  if (elLoadingScreen) elLoadingScreen.classList.toggle('hidden', next !== GAME_STATE.LOADING);
  if (elMainMenu) elMainMenu.classList.toggle('visible', next === GAME_STATE.MENU);
  if (elPauseMenu) elPauseMenu.classList.toggle('visible', next === GAME_STATE.PAUSED);
  if (elHalftimeScreen) elHalftimeScreen.classList.toggle('visible', next === GAME_STATE.HALFTIME);
  if (elFulltimeScreen) elFulltimeScreen.classList.toggle('visible', next === GAME_STATE.FULLTIME);
  if (elHud) elHud.classList.toggle('visible', next === GAME_STATE.PLAYING || next === GAME_STATE.PAUSED);

  if (next === GAME_STATE.HALFTIME && elHalftimeScore) {
    elHalftimeScore.textContent = `${homeScore} - ${awayScore}`;
  }
  if (next === GAME_STATE.FULLTIME) {
    if (elFulltimeScore) elFulltimeScore.textContent = `${homeScore} - ${awayScore}`;
    if (elFulltimeResult) {
      const u = GAME_CONFIG.userTeamIndex;
      const userAhead =
        u === 0 ? homeScore > awayScore : awayScore > homeScore;
      if (homeScore === awayScore) elFulltimeResult.textContent = 'DRAW';
      else if (userAhead) elFulltimeResult.textContent = 'WIN';
      else elFulltimeResult.textContent = 'LOSS';
    }
  }
}

function startMatch() {
  playSound('whistle');
  homeScore = 0;
  awayScore = 0;
  matchTimeSec = 0;
  currentHalf = 1;
  sidesSwapped = false;
  shotCharging = false;
  shotChargePct = 0;
  resetPlayersToFormation();
  setupTeams();
  setState(GAME_STATE.PLAYING);
}

// =============================================================================
// CAMERA
// =============================================================================

function updateCamera(deltaTime) {
  if (!controlledPlayer || !camera) return;
  const p = controlledPlayer.position;
  const ang = THREE.MathUtils.degToRad(GAME_CONFIG.cameraAngleDeg);
  const back = GAME_CONFIG.cameraDistance * Math.cos(ang);
  const up = GAME_CONFIG.cameraHeight + GAME_CONFIG.cameraDistance * Math.sin(ang);
  const fx = Math.sin(controlledPlayer.rotation);
  const fz = Math.cos(controlledPlayer.rotation);
  const cx = p.x - fx * back;
  const cz = p.z - fz * back;
  const cy = p.y + up;

  cameraTargetPos.set(cx, cy, cz);
  camera.position.lerp(cameraTargetPos, GAME_CONFIG.cameraLerp);

  cameraLookTarget.copy(p).add(new THREE.Vector3(0, 1.2, 0));
  camera.lookAt(cameraLookTarget);
}

// =============================================================================
// SELECTION INDICATOR
// =============================================================================

function createSelectionIndicator() {
  const geo = new THREE.RingGeometry(0.55, 0.75, 32);
  selectionRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  selectionRing = new THREE.Mesh(geo, selectionRingMat);
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.08;
  scene.add(selectionRing);
}

function updateSelectionIndicator() {
  if (!selectionRing || !controlledPlayer) return;
  selectionRing.position.set(
    controlledPlayer.position.x,
    0.1,
    controlledPlayer.position.z
  );
  selectionRing.rotation.set(-Math.PI / 2, 0, 0);
}

// =============================================================================
// UI
// =============================================================================

function updateUI(deltaTime) {
  if (elScoreboard) {
    elScoreboard.textContent = `${TEAMS.home.name} ${homeScore} - ${awayScore} ${TEAMS.away.name}`;
  }
  uiTimerAccum += deltaTime;
  if (uiTimerAccum >= 0.25) {
    uiTimerAccum = 0;
    if (elMatchTimer && gameState === GAME_STATE.PLAYING) {
      elMatchTimer.textContent = formatTime(matchTimeSec);
    }
  }
  if (elMatchTimer && (gameState === GAME_STATE.PAUSED || gameState === GAME_STATE.HALFTIME)) {
    elMatchTimer.textContent = formatTime(matchTimeSec);
  }

  if (controlledPlayer && elStaminaFill) {
    const pct = controlledPlayer.stamina / PLAYER_CONFIG.staminaMax;
    elStaminaFill.style.transform = `scaleX(${Math.max(0.05, pct)})`;
  }

  if (elShotBar) {
    elShotBar.style.width = shotCharging ? `${shotChargePct * 100}%` : '0%';
  }

  if (goalPopupTimer > 0) {
    goalPopupTimer -= deltaTime;
    if (goalPopupTimer <= 0 && elGoalPopup) elGoalPopup.classList.remove('show');
  }

  drawMinimap();
}

function drawMinimap() {
  if (!minimapCtx || !minimapCanvas) return;
  const ctx = minimapCtx;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20,60,40,0.5)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  const scaleX = (w * 0.42) / PITCH_CONFIG.halfWidth;
  const scaleZ = (h * 0.42) / PITCH_CONFIG.halfLength;

  function worldToRadar(x, z) {
    return {
      rx: w / 2 + x * scaleX,
      ry: h / 2 + z * scaleZ,
    };
  }

  const userTeam = GAME_CONFIG.userTeamIndex;
  for (const p of players) {
    const { rx, ry } = worldToRadar(p.position.x, p.position.z);
    ctx.fillStyle = p.teamIndex === userTeam ? '#4ade80' : '#f87171';
    ctx.beginPath();
    ctx.arc(rx, ry, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (gameBall) {
    const { rx, ry } = worldToRadar(gameBall.position.x, gameBall.position.z);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(rx, ry, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function setupUIListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Space') keySpacePressed = true;
    if (e.code === 'KeyE') {
      const canShoot =
        gameState === GAME_STATE.PLAYING &&
        controlledPlayer &&
        controlledPlayer.hasBall &&
        ballOwner === controlledPlayer;
      if (canShoot) {
        shotCharging = true;
        shotChargePct = 0;
      } else {
        keyEPressed = true;
      }
    }
    if (e.code === 'KeyQ') keyQPressed = true;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (gameState === GAME_STATE.PLAYING) setState(GAME_STATE.PAUSED);
      else if (gameState === GAME_STATE.PAUSED) setState(GAME_STATE.PLAYING);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') {
      if (shotCharging) {
        if (
          gameState === GAME_STATE.PLAYING &&
          controlledPlayer &&
          controlledPlayer.hasBall &&
          ballOwner === controlledPlayer
        ) {
          performShoot(controlledPlayer, shotChargePct);
        }
        shotCharging = false;
        shotChargePct = 0;
      }
    }
    keys[e.code] = false;
  });

  document.getElementById('btn-quick-match')?.addEventListener('click', () => startMatch());
  document.getElementById('btn-custom-match')?.addEventListener('click', () => startMatch());
  document.getElementById('btn-resume')?.addEventListener('click', () => setState(GAME_STATE.PLAYING));
  document.getElementById('btn-pause-main')?.addEventListener('click', () => setState(GAME_STATE.MENU));
  document.getElementById('btn-continue-half')?.addEventListener('click', () => {
    beginSecondHalf();
    setState(GAME_STATE.PLAYING);
  });
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    setState(GAME_STATE.MENU);
  });

  window.addEventListener('keydown', (e) => {
    if (gameState === GAME_STATE.HALFTIME && e.code === 'Space') {
      e.preventDefault();
      beginSecondHalf();
      setState(GAME_STATE.PLAYING);
    }
  });
}

function cacheDom() {
  elLoadingScreen = document.getElementById('loading-screen');
  elLoadingBar = document.getElementById('loading-bar');
  elLoadingText = document.getElementById('loading-text');
  elMainMenu = document.getElementById('main-menu');
  elPauseMenu = document.getElementById('pause-menu');
  elHalftimeScreen = document.getElementById('halftime-screen');
  elFulltimeScreen = document.getElementById('fulltime-screen');
  elHud = document.getElementById('hud');
  elScoreboard = document.getElementById('scoreboard');
  elMatchTimer = document.getElementById('match-timer');
  elStaminaFill = document.getElementById('stamina-fill');
  elHalftimeScore = document.getElementById('halftime-score');
  elFulltimeScore = document.getElementById('fulltime-score');
  elFulltimeResult = document.getElementById('fulltime-result');
  elGoalPopup = document.getElementById('goal-popup');
  elGoalTeamName = document.getElementById('goal-team-name');
  minimapCanvas = document.getElementById('minimap-canvas');
  minimapCtx = minimapCanvas?.getContext('2d') || null;
  elShotBar = document.getElementById('shot-bar');
}

function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =============================================================================
// LOADING
// =============================================================================

function runLoadingSequence(onDone) {
  let p = 0;
  const steps = [
    'Initializing renderer…',
    'Building pitch…',
    'Spawning teams…',
    'Ready.',
  ];
  let si = 0;
  const id = setInterval(() => {
    p += 8 + Math.random() * 12;
    if (p > 100) p = 100;
    if (elLoadingBar) elLoadingBar.style.width = `${p}%`;
    if (elLoadingText && si < steps.length) elLoadingText.textContent = steps[si];
    si = Math.min(steps.length - 1, si + (p > 25 ? 1 : 0));
    if (p >= 100) {
      clearInterval(id);
      if (elLoadingText) elLoadingText.textContent = steps[steps.length - 1];
      onDone();
    }
  }, 120);
}

// =============================================================================
// MAIN LOOP
// =============================================================================

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.1);

  if (gameState === GAME_STATE.PLAYING) {
    updatePlayerMovement(deltaTime);
    updateBallPhysics(deltaTime);
    checkBallControl();
    checkGoals();
    updateAI(deltaTime);
    updateAllPlayers(deltaTime);
    updateMatchTime(deltaTime);
    updateCamera(deltaTime);
    updateSelectionIndicator();
    updateUI(deltaTime);
  } else if (gameState === GAME_STATE.PAUSED) {
    updateUI(deltaTime);
  } else if (gameState === GAME_STATE.HALFTIME || gameState === GAME_STATE.FULLTIME) {
    updateUI(deltaTime);
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

// =============================================================================
// INIT
// =============================================================================

async function initGame() {
  cacheDom();
  initAudio();
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  clock = new THREE.Clock();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 40, 60);

  renderer = setupRenderer(canvas);
  window.addEventListener('resize', onResize);

  setupLighting();
  createPitch();
  createGoal(-1);
  createGoal(1);
  gameBall = createBall();
  ballShadow = createBallShadow();
  setupTeams();
  createSelectionIndicator();
  setupUIListeners();

  runLoadingSequence(() => {
    setState(GAME_STATE.MENU);
  });

  animate();
}

document.addEventListener('DOMContentLoaded', initGame);
