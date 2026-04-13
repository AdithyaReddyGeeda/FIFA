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

const DIFFICULTY = {
  easy: {
    aiReactionTime: 0.45,
    aiSprintChance: 0.15,
    shotAccMul: 0.7,
    pressRadius: 3,
  },
  medium: {
    aiReactionTime: 0.2,
    aiSprintChance: 0.3,
    shotAccMul: 0.85,
    pressRadius: 5,
  },
  hard: {
    aiReactionTime: 0.08,
    aiSprintChance: 0.55,
    shotAccMul: 1.0,
    pressRadius: 8,
  },
};
let activeDifficulty = DIFFICULTY.medium;

function applyActiveDifficulty() {
  PLAYER_CONFIG.aiReactionTime = activeDifficulty.aiReactionTime;
  PLAYER_CONFIG.aiSprintChance = activeDifficulty.aiSprintChance;
}

const STADIUM_CONFIG = {
  /** Optional: load GLTF path and parent to scene if extended */
  customModelUrl: null,
  ambientIntensity: 0.18,
  sunIntensity: 0.35,
  sunPosition: new THREE.Vector3(40, 80, 20),
  fogColor: 0x0a0a1a,
  fogNear: 120,
  fogFar: 280,
  floodIntensity: 0.55,
  floodDistance: 120,
  floodDecay: 2,
};

const GAME_CONFIG = {
  halfDurationSec: 180,
  fullDurationSec: 360,
  gravity: 25,
  ballFriction: 0.985,
  ballBounce: 0.35,
  ballRadius: 0.22,
  ballStopThreshold: 0.08,
  ballControlSpeedMax: 2.2,
  passPowerMul: 0.7,
  throughPowerMul: 0.9,
  shootPowerMul: 1.0,
  kickBasePower: 22,
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

/** Restore targets for weather (rain) toggling — do not compound between matches */
const WEATHER_SPEED_BASE = {
  runSpeed: PLAYER_CONFIG.runSpeed,
  sprintSpeed: PLAYER_CONFIG.sprintSpeed,
};
const WEATHER_BALL_FRICTION_BASE = GAME_CONFIG.ballFriction;

/**
 * Preset clubs: primary = shirt, secondary = shorts/trim, accent = detail.
 * Keys match <select> option values in index.html.
 */
const TEAM_PRESETS = {
  barcelona: {
    name: 'Barcelona',
    colors: { primary: 0xa50044, secondary: 0x004d98, accent: 0xedbb00 },
  },
  realmadrid: {
    name: 'Real Madrid',
    colors: { primary: 0xffffff, secondary: 0x00529f, accent: 0xfeb801 },
  },
  mancity: {
    name: 'Man City',
    colors: { primary: 0x6cabdd, secondary: 0xffffff, accent: 0x1c2c5b },
  },
  liverpool: {
    name: 'Liverpool',
    colors: { primary: 0xc8102e, secondary: 0xffffff, accent: 0xf6eb61 },
  },
  bayern: {
    name: 'Bayern Munich',
    colors: { primary: 0xdc052d, secondary: 0xffffff, accent: 0x0066b2 },
  },
  psg: {
    name: 'PSG',
    colors: { primary: 0x004170, secondary: 0xed1c24, accent: 0xffffff },
  },
  juventus: {
    name: 'Juventus',
    colors: { primary: 0x1a1a1a, secondary: 0xffffff, accent: 0xffea00 },
  },
  chelsea: {
    name: 'Chelsea',
    colors: { primary: 0x034694, secondary: 0xffffff, accent: 0xed1c24 },
  },
};

/** Per-slot ratings for 4-3-3 order: GK, DEF×4, MID×3, FWD×3 */
const DEFAULT_PLAYER_RATING = {
  pace: 0.75,
  shooting: 0.75,
  passing: 0.75,
  defending: 0.75,
};

const PLAYER_RATINGS = {
  barcelona: [
    { pace: 0.6, shooting: 0.3, passing: 0.7, defending: 0.85 },
    { pace: 0.74, shooting: 0.42, passing: 0.72, defending: 0.86 },
    { pace: 0.78, shooting: 0.38, passing: 0.75, defending: 0.84 },
    { pace: 0.76, shooting: 0.4, passing: 0.74, defending: 0.85 },
    { pace: 0.8, shooting: 0.36, passing: 0.7, defending: 0.82 },
    { pace: 0.82, shooting: 0.55, passing: 0.9, defending: 0.62 },
    { pace: 0.88, shooting: 0.62, passing: 0.92, defending: 0.58 },
    { pace: 0.8, shooting: 0.58, passing: 0.88, defending: 0.65 },
    { pace: 0.92, shooting: 0.88, passing: 0.82, defending: 0.42 },
    { pace: 0.9, shooting: 0.9, passing: 0.85, defending: 0.45 },
    { pace: 0.95, shooting: 0.92, passing: 0.88, defending: 0.45 },
  ],
  realmadrid: [
    { pace: 0.62, shooting: 0.32, passing: 0.68, defending: 0.86 },
    { pace: 0.78, shooting: 0.45, passing: 0.7, defending: 0.85 },
    { pace: 0.8, shooting: 0.42, passing: 0.72, defending: 0.86 },
    { pace: 0.77, shooting: 0.44, passing: 0.71, defending: 0.84 },
    { pace: 0.82, shooting: 0.4, passing: 0.68, defending: 0.83 },
    { pace: 0.85, shooting: 0.58, passing: 0.82, defending: 0.6 },
    { pace: 0.9, shooting: 0.72, passing: 0.8, defending: 0.55 },
    { pace: 0.88, shooting: 0.65, passing: 0.78, defending: 0.58 },
    { pace: 0.96, shooting: 0.94, passing: 0.8, defending: 0.4 },
    { pace: 0.93, shooting: 0.9, passing: 0.78, defending: 0.42 },
    { pace: 0.94, shooting: 0.93, passing: 0.8, defending: 0.4 },
  ],
  mancity: [
    { pace: 0.58, shooting: 0.28, passing: 0.75, defending: 0.84 },
    { pace: 0.76, shooting: 0.4, passing: 0.78, defending: 0.83 },
    { pace: 0.74, shooting: 0.38, passing: 0.8, defending: 0.82 },
    { pace: 0.75, shooting: 0.36, passing: 0.79, defending: 0.84 },
    { pace: 0.78, shooting: 0.35, passing: 0.77, defending: 0.81 },
    { pace: 0.84, shooting: 0.6, passing: 0.94, defending: 0.65 },
    { pace: 0.86, shooting: 0.68, passing: 0.95, defending: 0.6 },
    { pace: 0.83, shooting: 0.62, passing: 0.93, defending: 0.63 },
    { pace: 0.88, shooting: 0.82, passing: 0.88, defending: 0.48 },
    { pace: 0.85, shooting: 0.78, passing: 0.9, defending: 0.5 },
    { pace: 0.87, shooting: 0.8, passing: 0.87, defending: 0.48 },
  ],
  liverpool: [
    { pace: 0.64, shooting: 0.3, passing: 0.66, defending: 0.87 },
    { pace: 0.88, shooting: 0.48, passing: 0.72, defending: 0.8 },
    { pace: 0.85, shooting: 0.42, passing: 0.74, defending: 0.82 },
    { pace: 0.86, shooting: 0.44, passing: 0.73, defending: 0.81 },
    { pace: 0.84, shooting: 0.4, passing: 0.7, defending: 0.83 },
    { pace: 0.9, shooting: 0.62, passing: 0.78, defending: 0.68 },
    { pace: 0.82, shooting: 0.58, passing: 0.85, defending: 0.72 },
    { pace: 0.87, shooting: 0.6, passing: 0.82, defending: 0.7 },
    { pace: 0.94, shooting: 0.9, passing: 0.8, defending: 0.45 },
    { pace: 0.92, shooting: 0.88, passing: 0.78, defending: 0.46 },
    { pace: 0.91, shooting: 0.86, passing: 0.8, defending: 0.44 },
  ],
  bayern: [
    { pace: 0.65, shooting: 0.32, passing: 0.72, defending: 0.88 },
    { pace: 0.78, shooting: 0.45, passing: 0.72, defending: 0.88 },
    { pace: 0.8, shooting: 0.42, passing: 0.74, defending: 0.87 },
    { pace: 0.79, shooting: 0.44, passing: 0.73, defending: 0.86 },
    { pace: 0.83, shooting: 0.41, passing: 0.71, defending: 0.85 },
    { pace: 0.87, shooting: 0.65, passing: 0.88, defending: 0.62 },
    { pace: 0.84, shooting: 0.68, passing: 0.86, defending: 0.6 },
    { pace: 0.88, shooting: 0.62, passing: 0.9, defending: 0.63 },
    { pace: 0.93, shooting: 0.91, passing: 0.82, defending: 0.44 },
    { pace: 0.91, shooting: 0.89, passing: 0.84, defending: 0.46 },
    { pace: 0.96, shooting: 0.93, passing: 0.8, defending: 0.42 },
  ],
  /** Fast wide players and lethal forwards */
  psg: [
    { pace: 0.64, shooting: 0.31, passing: 0.7, defending: 0.84 },
    { pace: 0.82, shooting: 0.43, passing: 0.73, defending: 0.82 },
    { pace: 0.81, shooting: 0.41, passing: 0.75, defending: 0.83 },
    { pace: 0.8, shooting: 0.42, passing: 0.74, defending: 0.84 },
    { pace: 0.85, shooting: 0.4, passing: 0.72, defending: 0.81 },
    { pace: 0.9, shooting: 0.66, passing: 0.87, defending: 0.58 },
    { pace: 0.88, shooting: 0.64, passing: 0.89, defending: 0.56 },
    { pace: 0.91, shooting: 0.7, passing: 0.88, defending: 0.55 },
    { pace: 0.96, shooting: 0.92, passing: 0.83, defending: 0.4 },
    { pace: 0.94, shooting: 0.9, passing: 0.81, defending: 0.42 },
    { pace: 0.97, shooting: 0.94, passing: 0.84, defending: 0.38 },
  ],
  /** Compact back line, strong duels */
  juventus: [
    { pace: 0.61, shooting: 0.29, passing: 0.68, defending: 0.9 },
    { pace: 0.76, shooting: 0.4, passing: 0.7, defending: 0.9 },
    { pace: 0.78, shooting: 0.38, passing: 0.72, defending: 0.89 },
    { pace: 0.77, shooting: 0.39, passing: 0.71, defending: 0.9 },
    { pace: 0.8, shooting: 0.37, passing: 0.69, defending: 0.88 },
    { pace: 0.82, shooting: 0.52, passing: 0.84, defending: 0.72 },
    { pace: 0.8, shooting: 0.5, passing: 0.83, defending: 0.74 },
    { pace: 0.84, shooting: 0.55, passing: 0.85, defending: 0.7 },
    { pace: 0.88, shooting: 0.78, passing: 0.76, defending: 0.52 },
    { pace: 0.86, shooting: 0.76, passing: 0.78, defending: 0.54 },
    { pace: 0.89, shooting: 0.8, passing: 0.75, defending: 0.5 },
  ],
  /** Even spread — press and transition */
  chelsea: [
    { pace: 0.63, shooting: 0.31, passing: 0.71, defending: 0.85 },
    { pace: 0.79, shooting: 0.44, passing: 0.74, defending: 0.84 },
    { pace: 0.78, shooting: 0.42, passing: 0.75, defending: 0.85 },
    { pace: 0.77, shooting: 0.43, passing: 0.73, defending: 0.84 },
    { pace: 0.81, shooting: 0.41, passing: 0.72, defending: 0.83 },
    { pace: 0.85, shooting: 0.6, passing: 0.86, defending: 0.64 },
    { pace: 0.83, shooting: 0.58, passing: 0.87, defending: 0.65 },
    { pace: 0.86, shooting: 0.62, passing: 0.85, defending: 0.62 },
    { pace: 0.9, shooting: 0.82, passing: 0.8, defending: 0.48 },
    { pace: 0.88, shooting: 0.8, passing: 0.82, defending: 0.5 },
    { pace: 0.89, shooting: 0.84, passing: 0.79, defending: 0.47 },
  ],
};

function getPlayerRating(teamIndex, slotIndex) {
  const presetId =
    teamIndex === 0 ? TEAMS.home.presetId : TEAMS.away.presetId;
  const table = PLAYER_RATINGS[presetId];
  if (!table || slotIndex < 0 || slotIndex >= table.length) {
    return DEFAULT_PLAYER_RATING;
  }
  return table[slotIndex];
}

function averageTeamRatings(presetId) {
  const table = PLAYER_RATINGS[presetId];
  if (!table || table.length === 0) {
    return {
      pace: DEFAULT_PLAYER_RATING.pace,
      shooting: DEFAULT_PLAYER_RATING.shooting,
      passing: DEFAULT_PLAYER_RATING.passing,
      defending: DEFAULT_PLAYER_RATING.defending,
    };
  }
  let pac = 0;
  let sho = 0;
  let pas = 0;
  let def = 0;
  for (const r of table) {
    pac += r.pace;
    sho += r.shooting;
    pas += r.passing;
    def += r.defending;
  }
  const n = table.length;
  return {
    pace: pac / n,
    shooting: sho / n,
    passing: pas / n,
    defending: def / n,
  };
}

const TEAMS = {
  home: {
    name: TEAM_PRESETS.barcelona.name,
    colors: { ...TEAM_PRESETS.barcelona.colors },
    presetId: 'barcelona',
  },
  away: {
    name: TEAM_PRESETS.realmadrid.name,
    colors: { ...TEAM_PRESETS.realmadrid.colors },
    presetId: 'realmadrid',
  },
};

/**
 * Outfield slots 1–10: normalized x,z in roughly [-1,1]; world =
 * x * halfWidth*0.85, z * halfLength*0.8, then team / half flips on Z only.
 * Team 0 defends negative Z first half; `role` drives AI lanes.
 */
const FORMATION_GK_NORM = { x: 0, z: -1.1 };

const FORMATIONS = {
  '4-3-3': [
    { x: -0.69, z: -0.81, role: 'def' },
    { x: -0.24, z: -0.86, role: 'def' },
    { x: 0.24, z: -0.86, role: 'def' },
    { x: 0.69, z: -0.81, role: 'def' },
    { x: -0.48, z: -0.52, role: 'mid' },
    { x: 0, z: -0.57, role: 'mid' },
    { x: 0.48, z: -0.52, role: 'mid' },
    { x: -0.35, z: -0.24, role: 'fwd' },
    { x: 0, z: -0.19, role: 'fwd' },
    { x: 0.35, z: -0.24, role: 'fwd' },
  ],
  '4-4-2': [
    { x: -0.7, z: -0.82, role: 'def' },
    { x: -0.24, z: -0.86, role: 'def' },
    { x: 0.24, z: -0.86, role: 'def' },
    { x: 0.7, z: -0.82, role: 'def' },
    { x: -0.65, z: -0.5, role: 'mid' },
    { x: -0.22, z: -0.52, role: 'mid' },
    { x: 0.22, z: -0.52, role: 'mid' },
    { x: 0.65, z: -0.5, role: 'mid' },
    { x: -0.32, z: -0.2, role: 'fwd' },
    { x: 0.32, z: -0.2, role: 'fwd' },
  ],
  '3-5-2': [
    { x: -0.52, z: -0.88, role: 'def' },
    { x: 0, z: -0.9, role: 'def' },
    { x: 0.52, z: -0.88, role: 'def' },
    { x: -0.88, z: -0.55, role: 'mid' },
    { x: -0.26, z: -0.48, role: 'mid' },
    { x: 0, z: -0.42, role: 'mid' },
    { x: 0.26, z: -0.48, role: 'mid' },
    { x: 0.88, z: -0.55, role: 'mid' },
    { x: -0.3, z: -0.18, role: 'fwd' },
    { x: 0.3, z: -0.18, role: 'fwd' },
  ],
  '5-3-2': [
    { x: -0.82, z: -0.9, role: 'def' },
    { x: -0.42, z: -0.88, role: 'def' },
    { x: 0, z: -0.9, role: 'def' },
    { x: 0.42, z: -0.88, role: 'def' },
    { x: 0.82, z: -0.9, role: 'def' },
    { x: -0.35, z: -0.5, role: 'mid' },
    { x: 0, z: -0.48, role: 'mid' },
    { x: 0.35, z: -0.5, role: 'mid' },
    { x: -0.3, z: -0.22, role: 'fwd' },
    { x: 0.3, z: -0.22, role: 'fwd' },
  ],
};

const GAME_STATE = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  HALFTIME: 'HALFTIME',
  FULLTIME: 'FULLTIME',
  GOAL_REPLAY: 'GOAL_REPLAY',
  PENALTY: 'PENALTY',
  FREEKICK: 'FREEKICK',
  SUBSTITUTION: 'SUBSTITUTION',
};

// =============================================================================
// GLOBALS
// =============================================================================

let scene;
let camera;
/** @type {THREE.PerspectiveCamera | null} */
let cameraPersp = null;
/** @type {THREE.OrthographicCamera | null} */
let cameraOrtho = null;
let renderer;
let clock;
let gameState = GAME_STATE.LOADING;

let gameBall = null;
let ballShadow = null;
/** @type {THREE.Group | null} */
let homeGoalGroup = null;
/** @type {THREE.Group | null} */
let awayGoalGroup = null;
/** 3D stadium scoreboard (CanvasTexture) */
let scoreboardMesh = null;
let scoreboardTexture = null;
let scoreboardCanvas = null;
let scoreboardCtx = null;
/** Throttle for updateScoreboardTexture in updateUI */
let scoreboard3dTimer = 0;
let postShake = { group: null, timer: 0, intensity: 0 };
let ballVelocity = new THREE.Vector3();
/** Seconds until another ground-bounce tap can play (anti-spam). */
let bounceSoundCooldown = 0;
let ballOwner = null;
/** 0 | 1 — team that last played the ball (for throw-in / corner / goal kick) */
let lastTouchTeam = null;
/** Pauses AI during throw-in, corner, goal kick */
let restartInProgress = false;
let restartTimer = 0;

let freekickData = { shooter: null, targetX: 0, targetY: 1.2, power: 0.7 };
/** Countdown for AI penalty kick; null when not active */
let aiPenaltyTimer = null;
/** @type {THREE.ArrowHelper | null} */
let fkArrow = null;

let players = [];
let controlledPlayer = null;
let selectionRing = null;
let selectionRingMat = null;
/** Name tag sprite for user-controlled player only. */
let controlledLabel = null;
let controlledLabelTexture = null;
/** @type {HTMLCanvasElement | null} */
let controlledLabelCanvas = null;

let homeScore = 0;
let awayScore = 0;
/** Possession proxy: count each time a team gains control in checkBallControl */
const touches = [0, 0];
const shots = [0, 0];
const shotsOnTarget = [0, 0];
const passesCompleted = [0, 0];
/** Clock time of last GK save stat (per defending team) to avoid spam */
const lastGkSaveStatAt = [0, 0];

let matchTimeSec = 0;
let currentHalf = 1;
/** Regulation + stoppage: random 60–240s added at each half kickoff */
let injuryTimeAddedHalf1 = 60;
let injuryTimeAddedHalf2 = 60;
let injuryStoppageAnnouncedFirstHalf = false;
let injuryStoppageAnnouncedSecondHalf = false;
/** Penalty shootout (draw at full time) */
let penaltyTeam = 0;
let penaltyKickIndex = 0;
const penaltyScores = [0, 0];
const penaltyAttempts = [0, 0];
/** @type {('s' | 'm')[][]} s=scored, m=missed */
let penaltyResults = [[], []];
let penaltyIntroTimer = 0;
let penaltyAwaitingKick = false;
/** Penalty aim before kick: X ∈ [-1,1] (left–right), Y ∈ [0,1] (low–high). */
let penaltyAimX = 0;
let penaltyAimY = 0;
let penaltyRunTimer = 0;
let penaltyResolveTimer = 0;
let penaltySavedTimer = 0;
const penaltyKickStartPos = new THREE.Vector3();
const penaltyKickEndPos = new THREE.Vector3();
/** @type {Player | null} */
let penaltyStriker = null;
/** @type {Player | null} */
let penaltyGk = null;
/** Set before setState(FULLTIME) when pens decide the match */
let lastFulltimePenaltyWinner = null;
/** After halftime, teams swap ends: flip Z of formation for everyone. */
let sidesSwapped = false;

/** Goal net grid deformation (world X/Y impact, bulge along goal axis Z). */
let homeNetGeometry = null;
let awayNetGeometry = null;
/** @type {Float32Array | null} */
let homeNetRestPositions = null;
/** @type {Float32Array | null} */
let awayNetRestPositions = null;
let homeNetDeform = { active: false, timer: 0, impactX: 0, impactY: 0 };
let awayNetDeform = { active: false, timer: 0, impactX: 0, impactY: 0 };

/** Key of FORMATIONS — same for both teams unless extended later. */
let activeFormation = '4-3-3';

const keys = {};
let keySpacePressed = false;
let keyEPressed = false;
let keyQPressed = false;
/** Virtual joystick direction (screen: +x right, +y down) mapped to world X/Z in getMovementVector */
const touchMoveDir = new THREE.Vector2(0, 0);
/** Left stick (axes 0,1); dead-zoned in readGamepad */
const gamepadMoveDir = new THREE.Vector2(0, 0);
/** Last-frame button pressed state for edge detection */
const gamepadPrev = new Array(20).fill(false);
let gamepadSprint = false;
let gamepadShield = false;
/** Y / Triangle held — shot charge (PLAYING / FREEKICK) */
let gamepadYHeld = false;
/** D-pad while taking a free kick (do not clobber keyboard keys) */
let gamepadFkUp = false;
let gamepadFkDown = false;
let gamepadFkLeft = false;
let gamepadFkRight = false;
/** Horizontal orbit added to PLAYER_CAM (radians) */
let playerCamGamepadYaw = 0;
/** Vertical camera offset from right stick (axis 3), PLAYER_CAM only */
let playerCamGamepadPitch = 0;
let joystickActiveTouchId = null;
/** True while mobile Shoot (B) held for charged shot */
let touchShootHeld = false;
/** User shot charge 0–1 while holding E with the ball */
let shotChargePct = 0;
let shotCharging = false;

/** @type {'BROADCAST' | 'PLAYER_CAM' | 'TACTICAL'} */
let cameraMode = 'BROADCAST';

const cameraTargetPos = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpLabelQuat = new THREE.Quaternion();
const tmpParentQuat = new THREE.Quaternion();

let goalPopupTimer = 0;
const goalReplayPos = new THREE.Vector3();
let goalReplayTimer = 0;
let lastShooter = null;
let celebratingPlayer = null;
let celebrationTimer = 0;
/** @type {Player[]} */
let celebrationRunners = [];
let offsidePopupTimer = 0;
let cardPopupTimer = 0;
let uiTimerAccum = 0;
let subsMade = 0;
const MAX_SUBS = 3;
/** @type {'off' | 'on' | null} */
let subPanelPhase = null;
/** @type {Player | null} */
let subPlayerOut = null;
/** @type {Player | null} */
let subPlayerIn = null;

let weatherMode = 'clear';
/** @type {THREE.Points | null} */
let rainSystem = null;
/** @type {Float32Array | null} */
let rainVel = null;
const RAIN_COUNT = 800;

let aerialDuelCooldown = 0;

let cameraShake = { timer: 0, intensity: 0, fadeDuration: 0 };
const cameraShakeOffset = new THREE.Vector3();

const goalScorers = new Map();
/** -1 away … +1 home */
let momentumScore = 0;
let momentumTickAccum = 0;

/** @type {THREE.Mesh[]} */
const cornerFlagMeshes = [];

const matchHistory = [];

/** Yellow cards per player; value 1 = one yellow — next yellow becomes red. */
const yellowCards = new Map();

/** @type {AudioContext | null} */
let audioCtx = null;

/** Filtered 4s noise buffer for stadium murmur (built in initAudio). */
let crowdMurmurBuffer = null;
/** @type {GainNode | null} */
let crowdLoopGainNode = null;
/** @type {AudioBufferSourceNode | null} */
let crowdLoopSourceNode = null;
/** @type {Promise<void> | null} */
let crowdMurmurBuildPromise = null;

let nearMissCooldown = 0;

/** 1.0 fresh → ~0.78 by full time; scaled in Player.move */
let matchFatigueFactor = 1.0;

/** Commentary ticker: current minimum priority that may interrupt (-1 = none). */
let commentaryPriorityShowing = -1;
/** @type {ReturnType<typeof setTimeout> | null} */
let commentaryHideTimer = null;
let commentaryUserFirstTouchDone = false;

const GOAL_COMMENTARY_PHRASES = [
  (name) => `GOOOAL! ${name} take the lead!`,
  (name) => `What a strike! ${name} hit the net!`,
  (name) => `The crowd erupts — ${name} score!`,
  (name) => `Back of the net! ${name} are on the board!`,
  (name) => `Clinical finish! ${name} make it count!`,
];

function showCommentary(text, priority = 0) {
  if (priority < commentaryPriorityShowing) return;
  commentaryPriorityShowing = priority;
  if (elCommentaryText) elCommentaryText.textContent = text;
  if (elCommentaryBar) elCommentaryBar.classList.add('visible');
  if (commentaryHideTimer) clearTimeout(commentaryHideTimer);
  commentaryHideTimer = setTimeout(() => {
    if (elCommentaryBar) elCommentaryBar.classList.remove('visible');
    commentaryPriorityShowing = -1;
    commentaryHideTimer = null;
  }, 4000);
}

function updateCustomMatchTeamRatingCard() {
  const homeSel = document.getElementById('select-team-home');
  const awaySel = document.getElementById('select-team-away');
  const rpac = document.getElementById('r-pac');
  const rsho = document.getElementById('r-sho');
  const rpas = document.getElementById('r-pas');
  const rdef = document.getElementById('r-def');
  if (!homeSel || !awaySel || !rpac || !rsho || !rpas || !rdef) return;
  const h = averageTeamRatings(homeSel.value);
  const a = averageTeamRatings(awaySel.value);
  const avg = {
    pace: (h.pace + a.pace) / 2,
    shooting: (h.shooting + a.shooting) / 2,
    passing: (h.passing + a.passing) / 2,
    defending: (h.defending + a.defending) / 2,
  };
  rpac.style.width = `${avg.pace * 100}%`;
  rsho.style.width = `${avg.shooting * 100}%`;
  rpas.style.width = `${avg.passing * 100}%`;
  rdef.style.width = `${avg.defending * 100}%`;
}

/** Defenders frozen in a wall during user free kicks */
let freeKickWallPlayers = [];

/** Motion trail sprites for fast ball */
const TRAIL_COUNT = 10;
const trailSprites = [];
const trailPositions = [];
let trailHead = 0;
let trailWasFast = false;

const crowdLoop = {
  async start() {
    initAudio();
    if (!audioCtx) return;
    await ensureCrowdMurmurBuilt();
    if (!crowdMurmurBuffer || !crowdLoopGainNode) return;
    if (crowdLoopSourceNode) return;
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    const src = audioCtx.createBufferSource();
    src.buffer = crowdMurmurBuffer;
    src.loop = true;
    src.connect(crowdLoopGainNode);
    crowdLoopSourceNode = src;
    src.start(audioCtx.currentTime);
  },
  stop() {
    if (!crowdLoopSourceNode) return;
    try {
      crowdLoopSourceNode.stop();
    } catch (_) {
      /* already stopped */
    }
    try {
      crowdLoopSourceNode.disconnect();
    } catch (_) {
      /* */
    }
    crowdLoopSourceNode = null;
  },
};

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
let elOffsidePopup;
let elSetPiecePopup;
let elSetPieceText;
let elCardPopup;
let elCardPopupNumber;
let minimapCanvas;
let minimapCtx;
let elShotBar;
let elFreekickHint;
let elPenaltyHud;
let elPenaltyHudLabelHome;
let elPenaltyHudLabelAway;
let elPenaltyHudHome;
let elPenaltyHudAway;
let elPenaltySaved;
let elPenaltyCrosshair;
let elPenaltyCrosshairDot;
let elFtTeamHome;
let elFtTeamAway;
let elFtPossH;
let elFtPossA;
let elFtShotsH;
let elFtShotsA;
let elFtSotH;
let elFtSotA;
let elFtPassH;
let elFtPassA;
let elCommentaryBar;
let elCommentaryText;
let elStaminaWrap;
let elStaminaLabel;
let elSubPanel;
let elSubsHud;
let elMomentumFill;
let elMomHome;
let elMomAway;
let elHatTrickOverlay;

let hatTrickHideTimer = null;

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
    this.isShielding = false;
    this.shieldStealRadiusMul = 1;
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
    this.isDiving = false;
    this.diveDir = new THREE.Vector3();
    this.diveTimer = 0;
    this.createMesh();
    const r = getPlayerRating(teamIndex, slotIndex);
    this.paceRating = r.pace;
    this.maxSpeed = PLAYER_CONFIG.runSpeed * (0.8 + r.pace * 0.4);
    this.sprintSpeed = PLAYER_CONFIG.sprintSpeed * (0.8 + r.pace * 0.4);
    this.shotAccuracy = 0.6 + r.shooting * 0.35;
    this.passAccuracy = 0.65 + r.passing * 0.3;
    this.tackleStrength = 0.5 + r.defending * 0.5;
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
    bodyMat.userData.kitSlot = 'primary';
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
    legMat.userData.kitSlot = 'secondary';
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
    const legMatR = legMat.clone();
    legMatR.userData.kitSlot = 'secondary';
    const legMeshR = new THREE.Mesh(legGeo.clone(), legMatR);
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
    this.jerseyCanvas = canvas;
    this.jerseyCtx = ctx;
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
    this.jerseyNumberTex = tex;
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
    shortsMat.userData.kitSlot = 'secondary';
    const shorts = new THREE.Mesh(shortsGeo, shortsMat);
    shorts.position.y = bodyH * 0.2;
    shorts.castShadow = true;
    group.add(shorts);

    this.mesh = group;
    this.mesh.userData.player = this;
  }

  redrawJerseyNumber() {
    if (!this.jerseyCtx || !this.jerseyNumberTex) return;
    const ctx = this.jerseyCtx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.slotIndex + 1), 32, 34);
    this.jerseyNumberTex.needsUpdate = true;
  }

  /** Sync body / shorts / legs to current TEAMS colors (after custom match). */
  applyKitColors() {
    const team = this.teamIndex === 0 ? TEAMS.home : TEAMS.away;
    const { primary, secondary } = team.colors;
    this.mesh.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const slot = obj.material.userData?.kitSlot;
      if (slot === 'primary' && obj.material.color) {
        obj.material.color.setHex(primary);
      } else if (slot === 'secondary' && obj.material.color) {
        obj.material.color.setHex(secondary);
      }
    });
  }

  get position() {
    return this.mesh.position;
  }

  move(direction, isSprinting, deltaTime, walkOnly = false) {
    if (this.isDiving) return;
    if (!direction || direction.lengthSq() < 1e-6) {
      this.velocity.multiplyScalar(Math.pow(PLAYER_CONFIG.friction, deltaTime * 60));
      return;
    }
    const dir = direction.clone().normalize();
    this.rotation = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = this.rotation;

    const personalFatigue =
      0.75 + (this.stamina / PLAYER_CONFIG.staminaMax) * 0.25;
    const fatigueMul = matchFatigueFactor * personalFatigue;

    let speed = this.maxSpeed * fatigueMul;
    if (walkOnly) {
      speed = PLAYER_CONFIG.walkSpeed;
      this.stamina = Math.min(
        PLAYER_CONFIG.staminaMax,
        this.stamina + PLAYER_CONFIG.staminaRecover * deltaTime
      );
    } else if (isSprinting && this.stamina > 2) {
      speed = this.sprintSpeed * fatigueMul;
      this.stamina = Math.max(0, this.stamina - PLAYER_CONFIG.sprintDrain * deltaTime);
    } else {
      this.stamina = Math.min(
        PLAYER_CONFIG.staminaMax,
        this.stamina + PLAYER_CONFIG.staminaRecover * deltaTime
      );
    }
    if (!walkOnly && direction.length() < 0.85) speed = PLAYER_CONFIG.walkSpeed;

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
    const sprint = this.sprintSpeed;
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
    if (this.isDiving) {
      this.diveTimer -= deltaTime;
      const tiltAngle = Math.PI / 2.5;
      this.mesh.rotation.z = THREE.MathUtils.lerp(
        this.mesh.rotation.z,
        this.diveDir.x > 0 ? -tiltAngle : tiltAngle,
        0.25
      );
      this.mesh.position.y =
        Math.sin(Math.max(0, this.diveTimer) * 4) * 0.8;
      if (this.diveTimer <= 0) {
        this.isDiving = false;
        this.mesh.rotation.z = 0;
        this.mesh.position.y = 0;
      }
      this.updateLegAnimation();
      return;
    }
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
    preserveDrawingBuffer: true,
  });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

function setupLighting() {
  scene.background = new THREE.Color(0x0a0a1a);
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

  // 1-yard (0.9144 m) corner arcs — quarter circles inside the touchlines
  const cornerArcR = 0.9144;
  const cornerArcs = [
    [-hl, -hw, 0],
    [hl, -hw, Math.PI / 2],
    [-hl, hw, -Math.PI / 2],
    [hl, hw, Math.PI],
  ];
  for (const [cx, cz, startAngle] of cornerArcs) {
    const pts = [];
    for (let a = 0; a <= Math.PI / 2 + 1e-6; a += 0.1) {
      pts.push(
        new THREE.Vector3(
          cx + Math.cos(startAngle + a) * cornerArcR,
          0,
          cz + Math.sin(startAngle + a) * cornerArcR
        )
      );
    }
    addLine(pts);
  }

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

function createCornerFlags() {
  if (!scene) return;
  cornerFlagMeshes.length = 0;
  const flagPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6);
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  const flagMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
  });
  const hl = PITCH_CONFIG.halfLength;
  const hw = PITCH_CONFIG.halfWidth;
  const corners = [
    [-hl, -hw],
    [hl, -hw],
    [-hl, hw],
    [hl, hw],
  ];
  corners.forEach(([cx, cz]) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
    pole.position.y = 0.75;
    group.add(pole);
    const flagGeo = new THREE.PlaneGeometry(0.35, 0.22, 4, 2);
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.175, 1.45, 0);
    const posAttr = flagGeo.attributes.position;
    flag.userData.cornerFlagRest = new Float32Array(posAttr.array);
    cornerFlagMeshes.push(flag);
    group.add(flag);
    group.position.set(cx, 0, cz);
    scene.add(group);
  });
}

function updateCornerFlags(elapsed) {
  for (const flag of cornerFlagMeshes) {
    const rest = flag.userData.cornerFlagRest;
    if (!rest) continue;
    const pos = flag.geometry.attributes.position;
    const arr = pos.array;
    const w = 0.35;
    for (let vi = 0; vi < arr.length / 3; vi++) {
      const i = vi * 3;
      const rx = rest[i];
      const ry = rest[i + 1];
      const rz = rest[i + 2];
      const u = rx / w + 0.5;
      arr[i] = rx;
      arr[i + 1] = ry + Math.sin(elapsed * 2.8 + u * 3.2) * u * 0.02;
      arr[i + 2] = rz + Math.sin(elapsed * 3.5 + u * 4) * u * 0.06;
    }
    pos.needsUpdate = true;
    flag.geometry.computeVertexNormals();
  }
}

function triggerCameraShake(intensity, duration) {
  cameraShake.intensity = Math.max(cameraShake.intensity, intensity);
  const nt = Math.max(cameraShake.timer, duration);
  cameraShake.fadeDuration = Math.max(cameraShake.fadeDuration, nt);
  cameraShake.timer = nt;
}

function applyCameraShake(deltaTime) {
  if (!camera || cameraShake.timer <= 0) return;
  cameraShake.timer -= deltaTime;
  const decay =
    cameraShake.fadeDuration > 1e-6
      ? THREE.MathUtils.clamp(
          cameraShake.timer / cameraShake.fadeDuration,
          0,
          1
        )
      : 0;
  cameraShakeOffset.set(
    (Math.random() - 0.5) * 2 * cameraShake.intensity * decay,
    (Math.random() - 0.5) * 2 * cameraShake.intensity * decay * 0.4,
    0
  );
  camera.position.add(cameraShakeOffset);
  if (cameraShake.timer <= 0) {
    cameraShake.intensity = 0;
    cameraShake.fadeDuration = 0;
    cameraShakeOffset.set(0, 0, 0);
  }
}

function showHatTrick(player) {
  if (!elHatTrickOverlay) return;
  const num = player.slotIndex + 1;
  const teamName =
    player.teamIndex === 0 ? TEAMS.home.name : TEAMS.away.name;
  const numEl = document.getElementById('hat-trick-num');
  const teamEl = document.getElementById('hat-trick-team');
  if (numEl) numEl.textContent = `#${num}`;
  if (teamEl) teamEl.textContent = teamName;
  playSound('whistle');
  showCommentary(`HAT-TRICK! Incredible from #${num}!`, 2);
  elHatTrickOverlay.classList.add('show');
  if (hatTrickHideTimer) clearTimeout(hatTrickHideTimer);
  hatTrickHideTimer = setTimeout(() => {
    elHatTrickOverlay.classList.remove('show');
    hatTrickHideTimer = null;
  }, 4000);
}

function registerOpenPlayGoalMilestones(scoringTeamIndex) {
  if (!lastShooter || lastShooter.teamIndex !== scoringTeamIndex) return;
  const prev = goalScorers.get(lastShooter) ?? 0;
  const newCount = prev + 1;
  goalScorers.set(lastShooter, newCount);
  const num = lastShooter.slotIndex + 1;
  if (newCount === 2) {
    setTimeout(
      () => showCommentary(`Brace! #${num} with their second goal!`, 2),
      3500
    );
  } else if (newCount === 3) {
    const scorer = lastShooter;
    setTimeout(() => showHatTrick(scorer), 3500);
  } else if (newCount > 3) {
    setTimeout(
      () =>
        showCommentary(`Unbelievable! #${num} with ${newCount} goals!`, 2),
      3500
    );
  }
}

function pushMatchToHistory() {
  const penWinnerTeam = lastFulltimePenaltyWinner;
  matchHistory.push({
    home: TEAMS.home.name,
    away: TEAMS.away.name,
    homeScore,
    awayScore,
    penalties: penWinnerTeam !== null,
    penaltyWinner:
      penWinnerTeam !== null
        ? penWinnerTeam === 0
          ? TEAMS.home.name
          : TEAMS.away.name
        : null,
    date: new Date().toLocaleTimeString(),
  });
  updateHistoryPanel();
}

function updateHistoryPanel() {
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';
  const recent = matchHistory.slice(-5).reverse();
  const u = GAME_CONFIG.userTeamIndex;
  for (const r of recent) {
    const li = document.createElement('li');
    li.className = 'history-row';
    const penNote = r.penalties ? ` (pens: ${r.penaltyWinner})` : '';
    const score = `${r.homeScore} - ${r.awayScore}${penNote}`;
    const userGoals = u === 0 ? r.homeScore : r.awayScore;
    const oppGoals = u === 0 ? r.awayScore : r.homeScore;
    let outcome = 'draw';
    if (userGoals > oppGoals) outcome = 'win';
    else if (userGoals < oppGoals) outcome = 'loss';
    li.classList.add(`history-${outcome}`);
    li.innerHTML = `
      <span class="h-home">${r.home}</span>
      <span class="h-score">${score}</span>
      <span class="h-away">${r.away}</span>
    `;
    list.appendChild(li);
  }
  const panel = document.getElementById('history-panel');
  if (panel) panel.style.display = matchHistory.length ? 'block' : 'none';
}

function toggleFullscreen() {
  const btn = document.getElementById('btn-fullscreen');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    if (btn) btn.textContent = '✕ Exit Fullscreen';
  } else {
    document.exitFullscreen?.();
    if (btn) btn.textContent = '⛶ Fullscreen';
  }
}

function createStandSeatTexture(primaryHex, secondaryHex) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const pw = `#${primaryHex.toString(16).padStart(6, '0')}`;
  const sw = `#${secondaryHex.toString(16).padStart(6, '0')}`;
  const stripe = 16;
  for (let x = 0; x < c.width; x += stripe) {
    g.fillStyle = (x / stripe) % 2 === 0 ? pw : sw;
    g.fillRect(x, 0, stripe, c.height);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  tex.needsUpdate = true;
  return tex;
}

function createStadiumEnvironment() {
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.95,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  const standMatBase = {
    roughness: 0.88,
    metalness: 0.05,
  };
  const seatTex = createStandSeatTexture(
    TEAMS.home.colors.primary,
    TEAMS.home.colors.secondary
  );
  /** Touchlines run along Z; long stand uses user dims (length+20, 12, 8) with Y-rotation so length follows Z */
  const longGeo = new THREE.BoxGeometry(
    PITCH_CONFIG.length + 20,
    12,
    8
  );
  /** Goal-line stands: user (8, 12, width+20); Y-rotation so width+20 spans X */
  const shortGeo = new THREE.BoxGeometry(8, 12, PITCH_CONFIG.width + 20);
  const tilt = THREE.MathUtils.degToRad(15);
  const xStandOff = PITCH_CONFIG.halfWidth + 10;
  const zStandOff = PITCH_CONFIG.halfLength + 10;

  const longSeatMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    map: seatTex || undefined,
    ...standMatBase,
  });
  const longEast = new THREE.Mesh(longGeo, longSeatMat);
  longEast.position.set(xStandOff, 6, 0);
  longEast.rotation.order = 'YZX';
  longEast.rotation.y = Math.PI / 2;
  longEast.rotation.z = tilt;
  longEast.castShadow = true;
  longEast.receiveShadow = true;
  scene.add(longEast);

  const longWest = new THREE.Mesh(longGeo.clone(), longSeatMat.clone());
  longWest.position.set(-xStandOff, 6, 0);
  longWest.rotation.order = 'YZX';
  longWest.rotation.y = Math.PI / 2;
  longWest.rotation.z = -tilt;
  longWest.castShadow = true;
  longWest.receiveShadow = true;
  scene.add(longWest);

  const shortMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.88,
    metalness: 0.05,
  });
  const shortNorth = new THREE.Mesh(shortGeo, shortMat);
  shortNorth.position.set(0, 6, zStandOff);
  shortNorth.rotation.y = Math.PI / 2;
  shortNorth.castShadow = true;
  shortNorth.receiveShadow = true;
  scene.add(shortNorth);

  const shortSouth = new THREE.Mesh(shortGeo.clone(), shortMat.clone());
  shortSouth.position.set(0, 6, -zStandOff);
  shortSouth.rotation.y = Math.PI / 2;
  shortSouth.castShadow = true;
  shortSouth.receiveShadow = true;
  scene.add(shortSouth);

  const hl = PITCH_CONFIG.halfLength;
  const hw = PITCH_CONFIG.halfWidth;
  const poleR = 0.3;
  const poleH = 25;
  const poleGeo = new THREE.CylinderGeometry(poleR, poleR, poleH, 10);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.7,
    metalness: 0.35,
  });
  const cornerXZ = [
    [hl + 5, hw + 5],
    [hl + 5, -(hw + 5)],
    [-(hl + 5), hw + 5],
    [-(hl + 5), -(hw + 5)],
  ];
  for (const [cx, cz] of cornerXZ) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cx, poleH * 0.5, cz);
    pole.castShadow = true;
    scene.add(pole);

    const spot = new THREE.SpotLight(0xfff5e0, 60, 400, Math.PI / 6, 0.3, 1);
    spot.position.set(cx, poleH, cz);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 200;
    spot.target.position.set(0, 0, 0);
    scene.add(spot);
    scene.add(spot.target);
  }
}

function createScoreboard() {
  if (!scene) return;
  scoreboardCanvas = document.createElement('canvas');
  scoreboardCanvas.width = 512;
  scoreboardCanvas.height = 128;
  scoreboardCtx = scoreboardCanvas.getContext('2d');
  if (!scoreboardCtx) return;

  scoreboardTexture = new THREE.CanvasTexture(scoreboardCanvas);
  scoreboardTexture.colorSpace = THREE.SRGBColorSpace;
  scoreboardTexture.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(18, 4.5);
  const mat = new THREE.MeshBasicMaterial({
    map: scoreboardTexture,
    side: THREE.DoubleSide,
  });
  scoreboardMesh = new THREE.Mesh(geo, mat);
  scoreboardMesh.position.set(0, 16, -(PITCH_CONFIG.halfLength + 8));
  scoreboardMesh.rotation.y = Math.PI;
  scene.add(scoreboardMesh);

  updateScoreboardTexture();
}

function updateScoreboardTexture() {
  const ctx = scoreboardCtx;
  if (!ctx || !scoreboardTexture || !scoreboardCanvas) return;
  const w = scoreboardCanvas.width;
  const h = scoreboardCanvas.height;

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#ffdd00';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(TEAMS.home.name.toUpperCase().slice(0, 10), 20, 50);
  ctx.textAlign = 'right';
  ctx.fillText(TEAMS.away.name.toUpperCase().slice(0, 10), w - 20, 50);

  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdd00';
  ctx.fillText(`${homeScore}  -  ${awayScore}`, w / 2, 100);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(currentHalf === 1 ? '1ST HALF' : '2ND HALF', w / 2, 30);

  scoreboardTexture.needsUpdate = true;
}

function applyWeatherForMatch() {
  if (weatherMode === 'rain') {
    GAME_CONFIG.ballFriction = WEATHER_BALL_FRICTION_BASE * 0.992;
    PLAYER_CONFIG.runSpeed = WEATHER_SPEED_BASE.runSpeed * 0.93;
    PLAYER_CONFIG.sprintSpeed = WEATHER_SPEED_BASE.sprintSpeed * 0.93;
  } else {
    GAME_CONFIG.ballFriction = WEATHER_BALL_FRICTION_BASE;
    PLAYER_CONFIG.runSpeed = WEATHER_SPEED_BASE.runSpeed;
    PLAYER_CONFIG.sprintSpeed = WEATHER_SPEED_BASE.sprintSpeed;
  }
}

function initRain() {
  if (!scene || rainSystem) return;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  rainVel = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    rainPos[i * 3] = (Math.random() - 0.5) * 160;
    rainPos[i * 3 + 1] = Math.random() * 40;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    rainVel[i] = 18 + Math.random() * 12;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaaddff,
    size: 0.12,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  rainSystem = new THREE.Points(rainGeo, rainMat);
  rainSystem.visible = weatherMode === 'rain';
  scene.add(rainSystem);
}

function updateRain(deltaTime) {
  if (!rainSystem || !rainSystem.visible || !rainVel) return;
  const pos = rainSystem.geometry.attributes.position.array;
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    pos[i * 3 + 1] -= rainVel[i] * deltaTime;
    pos[i * 3] -= 2 * deltaTime;
    if (pos[i * 3 + 1] < -1) {
      pos[i * 3] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 1] = 38 + Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
  }
  rainSystem.geometry.attributes.position.needsUpdate = true;
}

function ensureRainSystem() {
  if (!scene) return;
  if (!rainSystem) initRain();
  if (rainSystem) rainSystem.visible = weatherMode === 'rain';
}

function getUserOutfieldPlayers() {
  return players.filter(
    (p) => p.teamIndex === GAME_CONFIG.userTeamIndex && p.role !== 'gk'
  );
}

function refreshPlayerRatingsFromSlot(p) {
  const r = getPlayerRating(p.teamIndex, p.slotIndex);
  p.paceRating = r.pace;
  p.maxSpeed = PLAYER_CONFIG.runSpeed * (0.8 + r.pace * 0.4);
  p.sprintSpeed = PLAYER_CONFIG.sprintSpeed * (0.8 + r.pace * 0.4);
  p.shotAccuracy = 0.6 + r.shooting * 0.35;
  p.passAccuracy = 0.65 + r.passing * 0.3;
  p.tackleStrength = 0.5 + r.defending * 0.5;
}

function cancelSubstitution() {
  subPanelPhase = null;
  subPlayerOut = null;
  subPlayerIn = null;
  setState(GAME_STATE.PLAYING);
}

function performSubstitution(outPl, inPl) {
  if (
    !outPl ||
    !inPl ||
    outPl === inPl ||
    outPl.teamIndex !== GAME_CONFIG.userTeamIndex ||
    inPl.teamIndex !== GAME_CONFIG.userTeamIndex
  ) {
    return;
  }
  const outNum = outPl.slotIndex + 1;
  const inNum = inPl.slotIndex + 1;

  if (ballOwner === outPl) {
    ballOwner = inPl;
    inPl.hasBall = true;
    outPl.hasBall = false;
  }

  const sTmp = outPl.slotIndex;
  outPl.slotIndex = inPl.slotIndex;
  inPl.slotIndex = sTmp;
  const rTmp = outPl.role;
  outPl.role = inPl.role;
  inPl.role = rTmp;

  tmpV1.copy(outPl.mesh.position);
  outPl.mesh.position.copy(inPl.mesh.position);
  inPl.mesh.position.copy(tmpV1);
  outPl.mesh.position.y = 0;
  inPl.mesh.position.y = 0;

  tmpV1.copy(outPl.formationWorld);
  outPl.formationWorld.copy(inPl.formationWorld);
  inPl.formationWorld.copy(tmpV1);

  tmpV1.copy(outPl.velocity);
  outPl.velocity.copy(inPl.velocity);
  inPl.velocity.copy(tmpV1);

  const rotTmp = outPl.rotation;
  outPl.rotation = inPl.rotation;
  inPl.rotation = rotTmp;
  outPl.mesh.rotation.y = outPl.rotation;
  inPl.mesh.rotation.y = inPl.rotation;

  refreshPlayerRatingsFromSlot(outPl);
  refreshPlayerRatingsFromSlot(inPl);

  inPl.stamina = PLAYER_CONFIG.staminaMax;

  outPl.redrawJerseyNumber();
  inPl.redrawJerseyNumber();

  if (controlledPlayer === outPl) {
    controlledPlayer = inPl;
    players.forEach((p) => {
      p.isUserControlled = p === controlledPlayer;
    });
    attachControlledLabelToPlayer(controlledPlayer);
  }

  subsMade += 1;
  showCommentary(`Substitution: #${outNum} off, #${inNum} on`, 1);
  subPanelPhase = null;
  subPlayerOut = null;
  subPlayerIn = null;
  setState(GAME_STATE.PLAYING);
}

function renderSubPanelList() {
  const list = document.getElementById('sub-list');
  const instr = document.getElementById('sub-instruction');
  const confirmBtn = document.getElementById('sub-confirm');
  if (!list || !instr || !confirmBtn) return;
  list.innerHTML = '';
  if (subPanelPhase === 'off') {
    instr.textContent = 'Select player to come OFF';
    for (const p of getUserOutfieldPlayers()) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'sub-player-row';
      row.dataset.slot = String(p.slotIndex);
      const pct = Math.round((p.stamina / PLAYER_CONFIG.staminaMax) * 100);
      row.innerHTML = `<span class="sub-num">#${p.slotIndex + 1}</span><span class="sub-role">${p.role}</span><span class="sub-bar"><span class="sub-bar-fill" style="width:${pct}%"></span></span>`;
      list.appendChild(row);
    }
    confirmBtn.disabled = true;
  } else if (subPanelPhase === 'on' && subPlayerOut) {
    instr.textContent = 'Select player to come ON';
    for (const p of getUserOutfieldPlayers()) {
      if (p === subPlayerOut) continue;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'sub-player-row';
      if (p.stamina > 70) row.classList.add('sub-fresh');
      row.dataset.slot = String(p.slotIndex);
      const pct = Math.round((p.stamina / PLAYER_CONFIG.staminaMax) * 100);
      row.innerHTML = `<span class="sub-num">#${p.slotIndex + 1}</span><span class="sub-role">${p.role}</span><span class="sub-bar"><span class="sub-bar-fill" style="width:${pct}%"></span></span>`;
      list.appendChild(row);
    }
    confirmBtn.disabled = !subPlayerIn;
  }
}

// =============================================================================
// GOALS & NET
// =============================================================================

function createNet(side) {
  const gw = GAME_CONFIG.goalWidth / 2;
  const gh = GAME_CONFIG.goalHeight;
  const depth = 2.2;
  const zBack = side * (PITCH_CONFIG.halfLength + depth * 0.92);
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

  const nx = 10;
  const ny = 6;
  const netGeo = new THREE.BufferGeometry();
  const vertCount = nx * ny;
  const positions = new Float32Array(vertCount * 3);
  let p = 0;
  for (let j = 0; j < ny; j += 1) {
    const fy = j / (ny - 1);
    const y = fy * gh;
    for (let i = 0; i < nx; i += 1) {
      const fx = i / (nx - 1);
      const x = -gw + fx * (gw * 2);
      positions[p++] = x;
      positions[p++] = y;
      positions[p++] = zBack;
    }
  }
  const idx = (i, j) => j * nx + i;
  const lineIndices = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      lineIndices.push(idx(i, j), idx(i + 1, j));
    }
  }
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny - 1; j += 1) {
      lineIndices.push(idx(i, j), idx(i, j + 1));
    }
  }
  netGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  netGeo.setIndex(lineIndices);

  const netLineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
  });
  const netLines = new THREE.LineSegments(netGeo, netLineMat);
  group.add(netLines);

  const rest = new Float32Array(positions);
  if (side === -1) {
    homeNetGeometry = netGeo;
    homeNetRestPositions = rest;
    homeNetDeform = { active: false, timer: 0, impactX: 0, impactY: 0 };
  } else {
    awayNetGeometry = netGeo;
    awayNetRestPositions = rest;
    awayNetDeform = { active: false, timer: 0, impactX: 0, impactY: 0 };
  }

  scene.add(group);
  return group;
}

function createGoal(side) {
  const group = createNet(side);
  if (side === -1) homeGoalGroup = group;
  else if (side === 1) awayGoalGroup = group;
  return group;
}

function updateNetDeform(deltaTime) {
  const configs = [
    {
      geo: homeNetGeometry,
      rest: homeNetRestPositions,
      deform: homeNetDeform,
      side: -1,
    },
    {
      geo: awayNetGeometry,
      rest: awayNetRestPositions,
      deform: awayNetDeform,
      side: 1,
    },
  ];
  for (const { geo, rest, deform, side } of configs) {
    if (!geo || !rest || !deform.active) continue;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const vx = rest[i];
      const vy = rest[i + 1];
      const vz = rest[i + 2];
      const dist = Math.hypot(vx - deform.impactX, vy - deform.impactY);
      const bulge =
        Math.sin(deform.timer * 8) * 0.4 * Math.exp(-dist * 0.8);
      pos[i] = vx;
      pos[i + 1] = vy;
      pos[i + 2] = vz + side * bulge;
    }
    geo.attributes.position.needsUpdate = true;
    deform.timer -= deltaTime;
    if (deform.timer <= 0) {
      deform.active = false;
      deform.timer = 0;
      pos.set(rest);
      geo.attributes.position.needsUpdate = true;
    }
  }
}

// =============================================================================
// BALL
// =============================================================================

function createBallTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const panels = [
    [size / 2, size / 2],
    [size / 2, size * 0.22],
    [size * 0.78, size * 0.62],
    [size * 0.22, size * 0.62],
    [size * 0.72, size * 0.2],
    [size * 0.28, size * 0.2],
  ];
  ctx.fillStyle = '#111111';
  panels.forEach(([px, py]) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const r = size * 0.1;
      const x = px + r * Math.cos(angle);
      const y = py + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBall() {
  const geo = new THREE.SphereGeometry(GAME_CONFIG.ballRadius, 24, 18);
  const ballMap = createBallTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: ballMap || undefined,
    color: ballMap ? 0xffffff : 0x111111,
    roughness: 0.3,
    metalness: 0.0,
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

/**
 * @param {'home' | 'away'} side
 * @param {string} presetId — key of TEAM_PRESETS
 */
function applyTeamPreset(side, presetId) {
  const preset = TEAM_PRESETS[presetId];
  if (!preset) return;
  const target = side === 'home' ? TEAMS.home : TEAMS.away;
  target.presetId = presetId;
  target.name = preset.name;
  target.colors.primary = preset.colors.primary;
  target.colors.secondary = preset.colors.secondary;
  target.colors.accent = preset.colors.accent;
}

function resetTeamsToDefault() {
  applyTeamPreset('home', 'barcelona');
  applyTeamPreset('away', 'realmadrid');
}

function getFormationSlotRole(slot) {
  if (slot === 0) return 'gk';
  const line = FORMATIONS[activeFormation];
  const entry = line?.[slot - 1];
  return entry?.role || 'mid';
}

function computeFormationWorld(teamIndex, slot) {
  const sx = PITCH_CONFIG.halfWidth * 0.85;
  const sz = PITCH_CONFIG.halfLength * 0.8;

  if (slot === 0) {
    let worldZ = FORMATION_GK_NORM.z * sz;
    const worldX = FORMATION_GK_NORM.x * sx;
    if (teamIndex === 1) worldZ = -worldZ;
    if (sidesSwapped) worldZ = -worldZ;
    return new THREE.Vector3(worldX, 0, worldZ);
  }

  const line = FORMATIONS[activeFormation];
  const entry = line?.[slot - 1];
  if (!entry) return new THREE.Vector3();

  let worldZ = entry.z * sz;
  let worldX = entry.x * sx;
  if (teamIndex === 1) worldZ = -worldZ;
  if (sidesSwapped) worldZ = -worldZ;
  return new THREE.Vector3(worldX, 0, worldZ);
}

function setupTeams() {
  players.forEach((p) => {
    if (p.mesh.parent) scene.remove(p.mesh);
  });
  players = [];

  for (let t = 0; t < 2; t++) {
    for (let s = 0; s < 11; s++) {
      const role = getFormationSlotRole(s);
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

  players.forEach((p) => p.applyKitColors());
  attachControlledLabelToPlayer(controlledPlayer);
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
  lastTouchTeam = null;
  restartInProgress = false;
  restartTimer = 0;
  if (gameBall) {
    gameBall.position.set(0, GAME_CONFIG.ballRadius, 0);
    gameBall.quaternion.identity();
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

function showSetPieceBanner(text) {
  restartInProgress = true;
  restartTimer = 1.5;
  if (elSetPieceText) elSetPieceText.textContent = text;
  if (elSetPiecePopup) elSetPiecePopup.classList.add('show');
}

function removeFkArrow() {
  if (fkArrow && scene) {
    scene.remove(fkArrow);
    fkArrow.dispose();
    fkArrow = null;
  }
}

function ensureFreekickArrow() {
  removeFkArrow();
  fkArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    6,
    0xfde047,
    1.2,
    0.85
  );
  scene.add(fkArrow);
}

function updateFreekickArrow() {
  if (!fkArrow || !gameBall || !freekickData.shooter) return;
  const gz = getAttackingGoalZ(freekickData.shooter.teamIndex);
  const ballPos = gameBall.position;
  const dir = new THREE.Vector3(freekickData.targetX, 0, gz).sub(ballPos);
  const len = Math.max(2, Math.min(16, dir.length()));
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();
  fkArrow.position.copy(ballPos);
  fkArrow.setDirection(dir);
  fkArrow.setLength(len, len * 0.22, len * 0.14);
}

function executeFreekickShot(charge01) {
  if (!gameBall || !freekickData.shooter) return;
  const team = freekickData.shooter.teamIndex;
  const gz = getAttackingGoalZ(team);
  const ballPos = gameBall.position.clone();
  const dir = new THREE.Vector3(freekickData.targetX, 0, gz).sub(ballPos);
  dir.normalize();
  dir.y = freekickData.power * 0.4 + 0.1;
  const c = THREE.MathUtils.clamp(charge01, 0, 1);
  const speedMul = 0.4 + c * 0.6;
  lastTouchTeam = team;
  releaseBallFromOwner();
  freekickData.shooter.hasBall = false;
  ballVelocity.copy(
    dir.multiplyScalar(
      GAME_CONFIG.kickBasePower * freekickData.power * speedMul
    )
  );
  playSound('kick');
  removeFkArrow();
  freekickData.shooter = null;
  delete freekickData.aiDelay;
  delete freekickData.aiFkCommentaryShown;
  setState(GAME_STATE.PLAYING);
}

function showCardPopup(player, kind) {
  if (!elCardPopup || !elCardPopupNumber || !player) return;
  elCardPopup.classList.remove('card-yellow', 'card-red');
  elCardPopup.classList.add(kind === 'red' ? 'card-red' : 'card-yellow');
  elCardPopupNumber.textContent = String(player.slotIndex + 1);
  elCardPopup.classList.add('show');
  cardPopupTimer = 2.5;
  if (kind === 'yellow') {
    showCommentary(`Booking! ${player.slotIndex + 1} is cautioned.`, 2);
  } else {
    const tn = player.teamIndex === 0 ? TEAMS.home.name : TEAMS.away.name;
    showCommentary(`Red card! ${tn} down to 10 men!`, 2);
  }
}

function reassignControlledPlayerAfterSendoff(teamIndex) {
  if (GAME_CONFIG.userTeamIndex !== teamIndex) return;
  const mates = players.filter((p) => p.teamIndex === teamIndex);
  if (mates.length === 0) {
    controlledPlayer = null;
    if (controlledLabel?.parent) controlledLabel.parent.remove(controlledLabel);
    return;
  }
  const preferred =
    mates.find((p) => p.role === 'fwd' && p.slotIndex === 9) ||
    mates.find((p) => p.role === 'fwd') ||
    mates[0];
  controlledPlayer = preferred;
  players.forEach((p) => {
    p.isUserControlled = p === controlledPlayer;
  });
  attachControlledLabelToPlayer(controlledPlayer);
}

function sendOffPlayer(p) {
  if (!p || !p.mesh) return;
  if (controlledLabel && controlledLabel.parent === p.mesh) {
    controlledLabel.parent.remove(controlledLabel);
  }
  if (ballOwner === p) releaseBallFromOwner();
  p.hasBall = false;
  yellowCards.delete(p);
  const team = p.teamIndex;
  if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
  else if (scene) scene.remove(p.mesh);
  const idx = players.indexOf(p);
  if (idx >= 0) players.splice(idx, 1);
  if (controlledPlayer === p) reassignControlledPlayerAfterSendoff(team);
}

function buildFreeKickWall(foulSpot, attackingTeamIndex) {
  const defendingTeam = attackingTeamIndex === 0 ? 1 : 0;
  const gz = getAttackingGoalZ(attackingTeamIndex);
  const dirToGoal = new THREE.Vector3(0, 0, gz).sub(foulSpot);
  dirToGoal.y = 0;
  if (dirToGoal.lengthSq() < 1e-8) {
    dirToGoal.set(0, 0, Math.sign(gz) || 1);
  } else {
    dirToGoal.normalize();
  }
  const wallCenter = foulSpot.clone().addScaledVector(dirToGoal, 9.15);
  const perp = new THREE.Vector3(-dirToGoal.z, 0, dirToGoal.x);
  if (perp.lengthSq() > 1e-8) perp.normalize();

  const defenders = players
    .filter((p) => p.teamIndex === defendingTeam && p.role !== 'gk')
    .sort(
      (a, b) =>
        a.position.distanceToSquared(foulSpot) -
        b.position.distanceToSquared(foulSpot)
    )
    .slice(0, 3);

  defenders.forEach((p, i) => {
    const offset = (i - 1) * 0.85;
    const wallPos = wallCenter.clone().addScaledVector(perp, offset);
    wallPos.y = 0;
    p.position.copy(wallPos);
    p.velocity.set(0, 0, 0);
    p.mesh.rotation.y = Math.atan2(-dirToGoal.x, -dirToGoal.z);
    p.rotation = p.mesh.rotation.y;
  });
  freeKickWallPlayers = defenders;
}

function freekick(fouledPlayer) {
  if (!gameBall || !fouledPlayer) return;
  const r = GAME_CONFIG.ballRadius;
  const halfW = PITCH_CONFIG.halfWidth;
  const halfL = PITCH_CONFIG.halfLength;
  const bx = THREE.MathUtils.clamp(
    fouledPlayer.position.x,
    -halfW + r,
    halfW - r
  );
  const bz = THREE.MathUtils.clamp(
    fouledPlayer.position.z,
    -halfL + r,
    halfL - r
  );
  const team = fouledPlayer.teamIndex;
  const taker =
    nearestPlayerForSetPiece(team, bx, bz, false) ||
    players.find((pl) => pl.teamIndex === team);
  if (!taker) return;
  lastTouchTeam = team;

  if (team === GAME_CONFIG.userTeamIndex) {
    freekickData.shooter = taker;
    freekickData.targetX = 0;
    freekickData.targetY = 1.2;
    freekickData.power = 0.7;
    delete freekickData.aiDelay;
    delete freekickData.aiFkCommentaryShown;
    giveBallToPlayerAt(taker, bx, r, bz);
    players.forEach((pl) => {
      pl.isUserControlled = pl === taker;
    });
    controlledPlayer = taker;
    attachControlledLabelToPlayer(taker);
    ensureFreekickArrow();
    updateFreekickArrow();
    buildFreeKickWall(new THREE.Vector3(bx, 0, bz), team);
    setState(GAME_STATE.FREEKICK);
    return;
  }

  freekickData.shooter = taker;
  freekickData.targetX = 0;
  freekickData.targetY = 1.2;
  freekickData.power = 0.7;
  freekickData.aiDelay = 1.5;
  delete freekickData.aiFkCommentaryShown;
  giveBallToPlayerAt(taker, bx, r, bz);
  buildFreeKickWall(new THREE.Vector3(bx, 0, bz), team);
  showCommentary('CPU lining up a free kick…', 0);
  setState(GAME_STATE.FREEKICK);
}

function applyTackleFoul(tackler, fouled) {
  const prev = yellowCards.get(tackler) || 0;
  if (prev >= 1) {
    showCardPopup(tackler, 'red');
    sendOffPlayer(tackler);
  } else {
    yellowCards.set(tackler, 1);
    showCardPopup(tackler, 'yellow');
  }
  freekick(fouled);
}

function giveBallToPlayerAt(p, wx, wy, wz) {
  if (!p || !gameBall) return;
  for (const pl of players) {
    pl.hasBall = pl === p;
  }
  ballOwner = p;
  ballVelocity.set(0, 0, 0);
  gameBall.position.set(wx, wy, wz);
  gameBall.quaternion.identity();
}

function nearestPlayerForSetPiece(teamIndex, bx, bz, excludeGk) {
  let best = null;
  let bestD = 1e9;
  for (const pl of players) {
    if (pl.teamIndex !== teamIndex) continue;
    if (excludeGk && pl.role === 'gk') continue;
    const dx = pl.position.x - bx;
    const dz = pl.position.z - bz;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = pl;
    }
  }
  return best;
}

/** Last-touching team takes the throw-in. */
function throwIn(ballX, ballZ) {
  const r = GAME_CONFIG.ballRadius;
  const halfW = PITCH_CONFIG.halfWidth;
  const halfL = PITCH_CONFIG.halfLength;
  const takingTeam =
    lastTouchTeam === 0 || lastTouchTeam === 1 ? lastTouchTeam : 0;
  const bx = Math.sign(ballX || 1) * (halfW - r - 0.1);
  const taker =
    nearestPlayerForSetPiece(takingTeam, bx, ballZ, false) ||
    players.find((pl) => pl.teamIndex === takingTeam);
  if (!taker) return;
  const bz = THREE.MathUtils.clamp(
    taker.position.z,
    -halfL + r + 0.25,
    halfL - r - 0.25
  );
  giveBallToPlayerAt(taker, bx, r, bz);
  lastTouchTeam = takingTeam;
  showSetPieceBanner('THROW IN');
}

function cornerKick(attackingTeamIndex) {
  const r = GAME_CONFIG.ballRadius;
  const halfW = PITCH_CONFIG.halfWidth;
  const halfL = PITCH_CONFIG.halfLength;
  const px = gameBall.position.x;
  const pz = gameBall.position.z;
  const positiveEnd = pz > 0;
  const corners = positiveEnd
    ? [
        { x: -halfW + 0.3, z: halfL - 0.3 },
        { x: halfW - 0.3, z: halfL - 0.3 },
      ]
    : [
        { x: -halfW + 0.3, z: -halfL + 0.3 },
        { x: halfW - 0.3, z: -halfL + 0.3 },
      ];
  let corner = corners[0];
  let bestD = 1e9;
  for (const c of corners) {
    const d = (px - c.x) ** 2 + (pz - c.z) ** 2;
    if (d < bestD) {
      bestD = d;
      corner = c;
    }
  }
  const taker =
    nearestPlayerForSetPiece(attackingTeamIndex, corner.x, corner.z, true) ||
    players.find((pl) => pl.teamIndex === attackingTeamIndex && pl.role !== 'gk');
  if (!taker) return;
  giveBallToPlayerAt(taker, corner.x, r, corner.z);
  lastTouchTeam = attackingTeamIndex;
  showSetPieceBanner('CORNER');
}

function goalKick(defendingTeamIndex) {
  const r = GAME_CONFIG.ballRadius;
  const hl = PITCH_CONFIG.halfLength;
  const gd = PITCH_CONFIG.goalAreaDepth;
  const bz =
    defendingTeamIndex === 1
      ? hl - gd * 0.5
      : -hl + gd * 0.5;
  const gk =
    players.find(
      (p) => p.teamIndex === defendingTeamIndex && p.role === 'gk'
    ) || players.find((p) => p.teamIndex === defendingTeamIndex);
  if (!gk) return;
  giveBallToPlayerAt(gk, 0, r, bz);
  lastTouchTeam = defendingTeamIndex;
  showSetPieceBanner('GOAL KICK');
}

function updateBallPhysics(deltaTime) {
  if (!gameBall) return;

  if (ballOwner) {
    const offDist = ballOwner.isShielding ? 1.4 : 0.9;
    const off = tmpV1
      .set(Math.sin(ballOwner.rotation), 0, Math.cos(ballOwner.rotation))
      .multiplyScalar(offDist);
    gameBall.position.copy(ballOwner.position).add(off);
    gameBall.position.y = GAME_CONFIG.ballRadius;
    ballVelocity.set(0, 0, 0);
    updateBallShadow();
    return;
  }

  bounceSoundCooldown = Math.max(0, bounceSoundCooldown - deltaTime);

  ballVelocity.y -= GAME_CONFIG.gravity * deltaTime;
  gameBall.position.addScaledVector(ballVelocity, deltaTime);

  const r = GAME_CONFIG.ballRadius;
  const groundY = r;
  if (gameBall.position.y < groundY) {
    const vyIn = ballVelocity.y;
    gameBall.position.y = groundY;
    ballVelocity.y *= -GAME_CONFIG.ballBounce;
    if (
      bounceSoundCooldown <= 0 &&
      Math.abs(vyIn) > 1.5
    ) {
      playSound('bounce');
      bounceSoundCooldown = 0.12;
    }
    if (Math.abs(ballVelocity.y) < 1.2) ballVelocity.y = 0;
  }

  const halfW = PITCH_CONFIG.halfWidth;
  const halfL = PITCH_CONFIG.halfLength;
  const px = gameBall.position.x;
  const pz = gameBall.position.z;

  if (gameState !== GAME_STATE.PENALTY) {
    if (Math.abs(px) > halfW - r) {
      throwIn(px, pz);
      updateBallShadow();
      return;
    }

    if (pz > halfL - r) {
      if (!isBallInGoalMouth(GAME_CONFIG.goalLineZAway, gameBall.position)) {
        if (lastTouchTeam === 0) cornerKick(0);
        else goalKick(1);
        updateBallShadow();
        return;
      }
    } else if (pz < -halfL + r) {
      if (!isBallInGoalMouth(GAME_CONFIG.goalLineZHome, gameBall.position)) {
        if (lastTouchTeam === 1) cornerKick(1);
        else goalKick(0);
        updateBallShadow();
        return;
      }
    }
  }

  if (gameBall.position.y <= groundY + 0.02) {
    const frictionFactor = Math.pow(GAME_CONFIG.ballFriction, deltaTime * 60);
    ballVelocity.x *= frictionFactor;
    ballVelocity.z *= frictionFactor;
  }

  const spd = ballVelocity.length();
  if (spd < GAME_CONFIG.ballStopThreshold && gameBall.position.y <= groundY + 0.05) {
    ballVelocity.multiplyScalar(0.92);
    if (spd < 0.05) ballVelocity.set(0, 0, 0);
  }

  const vx = ballVelocity.x;
  const vz = ballVelocity.z;
  if (vx * vx + vz * vz > 1e-8) {
    const rollAxis = tmpV2.set(-vz, 0, vx).normalize();
    const rollSpeed = ballVelocity.length() / GAME_CONFIG.ballRadius;
    gameBall.rotateOnWorldAxis(rollAxis, rollSpeed * deltaTime);
  }

  if (ballVelocity.y > 0) {
    const topSpin = ballVelocity.z * 0.12 * deltaTime;
    gameBall.rotateOnWorldAxis(tmpV3.set(1, 0, 0), topSpin);
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

function initBallTrail() {
  if (!scene) return;
  for (let i = 0; i < TRAIL_COUNT; i += 1) {
    const mat = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 1);
    scene.add(sprite);
    trailSprites.push(sprite);
    trailPositions.push(new THREE.Vector3());
  }
  trailHead = 0;
  trailWasFast = false;
}

function updateBallTrail(deltaTime) {
  if (!gameBall || trailSprites.length === 0) return;
  const spd = ballVelocity.length();
  if (ballOwner) {
    trailWasFast = false;
    trailSprites.forEach((s) => {
      s.material.opacity *= 0.8;
    });
    return;
  }
  if (spd > 8) {
    if (!trailWasFast) {
      trailWasFast = true;
      for (let j = 0; j < TRAIL_COUNT; j += 1) {
        trailPositions[j].copy(gameBall.position);
      }
      trailHead = 0;
    }
    trailPositions[trailHead].copy(gameBall.position);
    trailHead = (trailHead + 1) % TRAIL_COUNT;
    const col = spd > 18 ? 0xff6600 : 0xffffff;
    for (let i = 0; i < TRAIL_COUNT; i += 1) {
      const idx = (trailHead - 1 - i + TRAIL_COUNT) % TRAIL_COUNT;
      const age = i / TRAIL_COUNT;
      const sprite = trailSprites[i];
      sprite.position.copy(trailPositions[idx]);
      sprite.material.opacity = Math.max(0, 0.45 - age * 0.45);
      const s = 0.5 - age * 0.3;
      sprite.scale.set(s, s, 1);
      sprite.material.color.setHex(col);
    }
  } else {
    trailWasFast = false;
    trailSprites.forEach((s) => {
      s.material.opacity *= 0.8;
    });
  }
}

function releaseBallFromOwner() {
  if (ballOwner) {
    ballOwner.hasBall = false;
    ballOwner = null;
  }
}

function applyAccuracy(dir, accuracy, spreadMul = 1) {
  const spread = (1 - accuracy) * 0.35 * spreadMul;
  return dir
    .clone()
    .add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 2 * spread,
        0,
        (Math.random() - 0.5) * 2 * spread
      )
    )
    .normalize();
}

function checkBallControl(deltaTime = 1 / 60) {
  if (!gameBall || ballOwner) return;

  if (aerialDuelCooldown > 0) {
    aerialDuelCooldown -= deltaTime;
  }

  if (gameBall.position.y > 1.5 && !ballOwner && aerialDuelCooldown <= 0) {
    let bestA = null;
    let bestAd = 1e9;
    let bestB = null;
    let bestBd = 1e9;
    for (const p of players) {
      const d = p.position.distanceTo(gameBall.position);
      if (d < 2.5) {
        if (p.teamIndex === 0 && d < bestAd) {
          bestAd = d;
          bestA = p;
        }
        if (p.teamIndex === 1 && d < bestBd) {
          bestBd = d;
          bestB = p;
        }
      }
    }
    if (bestA && bestB) {
      const aRating = bestA.paceRating ?? 0.75;
      const bRating = bestB.paceRating ?? 0.75;
      const aWins = Math.random() < 0.5 + (aRating - bRating) * 0.3;
      const winner = aWins ? bestA : bestB;
      const gz = getAttackingGoalZ(winner.teamIndex);
      const dir = new THREE.Vector3(0, 0, gz).sub(gameBall.position);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) {
        dir.set(0, 0, winner.teamIndex === 0 ? 1 : -1);
      } else {
        dir.normalize();
      }
      ballVelocity.set(dir.x * 8, 3, dir.z * 8);
      lastTouchTeam = winner.teamIndex;
      playSound('kick');
      showCommentary(aWins ? 'Header!' : 'Aerial challenge won!', 0);
      aerialDuelCooldown = 0.35;
      return;
    }
    if (bestA || bestB) {
      const winner = bestA ?? bestB;
      if (
        winner.teamIndex === GAME_CONFIG.userTeamIndex ||
        Math.random() < 0.7
      ) {
        const gz = getAttackingGoalZ(winner.teamIndex);
        const dir = new THREE.Vector3(0, 0, gz).sub(gameBall.position);
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) {
          dir.set(0, 0, winner.teamIndex === 0 ? 1 : -1);
        } else {
          dir.normalize();
        }
        ballVelocity.set(dir.x * 10, 2, dir.z * 10);
        lastTouchTeam = winner.teamIndex;
        playSound('kick');
      }
      aerialDuelCooldown = 0.35;
      return;
    }
  }

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
    playSound('pass_receive');
    ballVelocity.set(0, 0, 0);
    touches[best.teamIndex] += 1;
    lastTouchTeam = best.teamIndex;
    if (
      !commentaryUserFirstTouchDone &&
      best.teamIndex === GAME_CONFIG.userTeamIndex
    ) {
      commentaryUserFirstTouchDone = true;
      const tn =
        GAME_CONFIG.userTeamIndex === 0
          ? TEAMS.home.name
          : TEAMS.away.name;
      showCommentary(`${tn} with early possession.`, 0);
    }
  }
}

// =============================================================================
// PASS / SHOOT / THROUGH / TACKLE / SWITCH
// =============================================================================

// =============================================================================
// WEB AUDIO (lightweight, no external libs)
// =============================================================================

async function ensureCrowdMurmurBuilt() {
  if (crowdMurmurBuffer && crowdLoopGainNode) return;
  if (!audioCtx) return;
  if (crowdMurmurBuildPromise) return crowdMurmurBuildPromise;

  const build = (async () => {
    const ac = audioCtx;
    if (!ac) return;
    const dur = 4;
    const sr = ac.sampleRate;
    const frameCount = Math.floor(sr * dur);
    const offline = new OfflineAudioContext(1, frameCount, sr);
    const noiseBuffer = offline.createBuffer(1, frameCount, sr);
    const ch = noiseBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      ch[i] = Math.random() * 2 - 1;
    }
    const src = offline.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = offline.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;
    src.connect(filter);
    filter.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    if (!audioCtx) return;
    crowdMurmurBuffer = rendered;
    if (!crowdLoopGainNode) {
      crowdLoopGainNode = audioCtx.createGain();
      crowdLoopGainNode.gain.value = 0.04;
      crowdLoopGainNode.connect(audioCtx.destination);
    }
  })();

  crowdMurmurBuildPromise = build;
  build.catch(() => {
    crowdMurmurBuildPromise = null;
  });

  return build;
}

function initAudio() {
  if (audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    void ensureCrowdMurmurBuilt();
  } catch {
    audioCtx = null;
  }
}

/**
 * @param {'kick' | 'whistle' | 'crowd_cheer' | 'near_miss' | 'save' | 'tackle' | 'bounce' | 'pass_receive'} type
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

  if (type === 'tackle') {
    const dur = 0.15;
    const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < n; i += 1) {
      ch[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t0);
    filter.Q.setValueAtTime(1.5, t0);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audioCtx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    return;
  }

  if (type === 'bounce') {
    const dur = 0.06;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t0);
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return;
  }

  if (type === 'pass_receive') {
    const dur = 0.07;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t0);
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return;
  }

  if (type === 'save') {
    const dur = 0.12;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t0);
    g.gain.setValueAtTime(eps, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(eps, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
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
    return;
  }

  if (type === 'near_miss') {
    const dur = 0.4;
    const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < n; i += 1) {
      ch[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t0);
    filter.Q.setValueAtTime(0.5, t0);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.09, t0);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audioCtx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    return;
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

function getBestPassTarget(player) {
  const facing = tmpV1.set(
    Math.sin(player.rotation),
    0,
    Math.cos(player.rotation)
  );
  let best = null;
  let bestScore = -1e9;
  const toMate = tmpV3;
  for (const p of players) {
    if (p === player || p.teamIndex !== player.teamIndex) continue;
    toMate.subVectors(p.position, player.position);
    toMate.y = 0;
    const dist = toMate.length();
    if (dist < 0.1) continue;
    tmpV2.copy(toMate).normalize();
    const dot = facing.dot(tmpV2);
    if (dot < -0.3) continue;
    const score = dot * 0.6 + (1 / Math.max(dist, 1)) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best || getClosestTeammate(player);
}

function getAttackingGoalZ(teamIndex) {
  const sign = teamIndex === 0 ? 1 : -1;
  return sign * (sidesSwapped ? -1 : 1) * PITCH_CONFIG.halfLength;
}

/** Distance along pitch Z to the goal this team attacks (smaller = closer to that goal line). */
function distToAttackingGoalZ(teamIndex, z) {
  return Math.abs(getAttackingGoalZ(teamIndex) - z);
}

/**
 * Offside: in opponents' half and nearer their goal line than both the ball (passer)
 * and the second-last opponent. Uses getAttackingGoalZ(teamIndex) as the attack axis.
 */
function isReceiverOffside(passer, receiver) {
  const team = passer.teamIndex;
  const gz = getAttackingGoalZ(team);
  const dist = (z) => distToAttackingGoalZ(team, z);

  if (gz > 0 && receiver.position.z <= 0) return false;
  if (gz < 0 && receiver.position.z >= 0) return false;

  const opps = players.filter((p) => p.teamIndex !== team);
  if (opps.length < 2) return false;

  opps.sort((a, b) => dist(a.position.z) - dist(b.position.z));
  const dSecond = dist(opps[1].position.z);
  const dRecv = dist(receiver.position.z);
  const dPass = dist(passer.position.z);

  if (dRecv >= dPass) return false;
  if (dRecv >= dSecond) return false;
  return true;
}

function resetBallToPasser(passer) {
  if (!passer || !gameBall) return;
  ballOwner = passer;
  passer.hasBall = true;
  ballVelocity.set(0, 0, 0);
  const off = tmpV1
    .set(Math.sin(passer.rotation), 0, Math.cos(passer.rotation))
    .multiplyScalar(0.9);
  gameBall.position.copy(passer.position).add(off);
  gameBall.position.y = GAME_CONFIG.ballRadius;
}

function showOffside(offsideTeamIndex) {
  offsidePopupTimer = 2;
  if (elOffsidePopup) elOffsidePopup.classList.add('show');
  showCommentary('Offside flag raised — play stops.', 1);
  if (offsideTeamIndex === 0 || offsideTeamIndex === 1) {
    momentumScore -= 0.04 * (offsideTeamIndex === 0 ? 1 : -1);
    momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
  }
}

function performPass(player) {
  if (!player || !player.hasBall || player !== ballOwner) return;
  const mate = getBestPassTarget(player);
  if (!mate) return;
  let dir = tmpV2.subVectors(mate.position, player.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) return;
  if (isReceiverOffside(player, mate)) {
    showOffside(player.teamIndex);
    resetBallToPasser(player);
    return;
  }
  dir.normalize();
  dir = applyAccuracy(dir, player.passAccuracy);
  const power = GAME_CONFIG.kickBasePower * GAME_CONFIG.passPowerMul;
  lastTouchTeam = player.teamIndex;
  momentumScore += 0.04 * (player.teamIndex === 0 ? 1 : -1);
  momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
  passesCompleted[player.teamIndex] += 1;
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
  const c = THREE.MathUtils.clamp(charge01, 0, 1);

  const facingDir = tmpV1.set(
    Math.sin(player.rotation),
    0,
    Math.cos(player.rotation)
  );
  const toGoalCenter = tmpV2.set(0, 0, gz).sub(player.position);
  toGoalCenter.y = 0;
  if (toGoalCenter.lengthSq() < 1e-4) return;
  toGoalCenter.normalize();
  lastShooter = player;

  tmpV3.copy(facingDir).multiplyScalar(0.6).addScaledVector(toGoalCenter, 0.4);
  tmpV3.y = 0;
  if (tmpV3.lengthSq() < 1e-4) tmpV3.copy(toGoalCenter);
  tmpV3.normalize();

  const aiSpreadMul = player.isUserControlled
    ? 1
    : 1 / Math.max(0.15, activeDifficulty.shotAccMul);
  const dir = applyAccuracy(tmpV3, player.shotAccuracy, aiSpreadMul);
  const power = GAME_CONFIG.kickBasePower * (0.4 + c * 0.6);
  lastTouchTeam = player.teamIndex;
  shots[player.teamIndex] += 1;
  releaseBallFromOwner();
  player.hasBall = false;
  ballVelocity.copy(dir.multiplyScalar(power));
  ballVelocity.y = 2 + Math.random() * 4 * c;
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
  if (isReceiverOffside(player, mate)) {
    showOffside(player.teamIndex);
    resetBallToPasser(player);
    return;
  }
  dir.normalize();
  dir = applyAccuracy(dir, player.passAccuracy);
  const power = GAME_CONFIG.kickBasePower * GAME_CONFIG.throughPowerMul;
  lastTouchTeam = player.teamIndex;
  releaseBallFromOwner();
  player.hasBall = false;
  ballVelocity.copy(dir.multiplyScalar(power));
  ballVelocity.y = 9;
  playSound('kick');
}

function performTackle(player) {
  if (!player || player.hasBall) return;
  let best = null;
  let bestD = Infinity;
  for (const o of players) {
    if (o.teamIndex === player.teamIndex) continue;
    const d = o.position.distanceTo(player.position);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (!best || !gameBall) return;

  const minDist = best.isShielding
    ? (PLAYER_CONFIG.tackleRadius * 1.5) / best.shieldStealRadiusMul
    : PLAYER_CONFIG.tackleRadius;
  if (bestD > minDist) return;

  const forceMultiplier = best.isShielding ? 0.6 : 1;

  const hadBallBefore = best.hasBall;
  const tackleDistance = bestD;

  const push = tmpV2.subVectors(gameBall.position, best.position);
  push.y = 0;
  if (push.lengthSq() < 1e-4) push.set(0, 0, 1);
  push.normalize().multiplyScalar(PLAYER_CONFIG.tackleForce * forceMultiplier);
  lastTouchTeam = player.teamIndex;
  releaseBallFromOwner();
  best.hasBall = false;
  ballVelocity.copy(push);
  ballVelocity.y = 2;

  if (
    hadBallBefore &&
    tackleDistance < PLAYER_CONFIG.tackleRadius * 0.5 &&
    tackleDistance < 1.2 &&
    Math.random() < 0.4 * (1 - best.tackleStrength)
  ) {
    applyTackleFoul(player, best);
  } else if (hadBallBefore && player.isUserControlled) {
    showCommentary('Great tackle! Ball won back.', 0);
  }

  if (hadBallBefore) {
    playSound('tackle');
    triggerCameraShake(0.2, 0.18);
    momentumScore -= 0.06 * (best.teamIndex === 0 ? 1 : -1);
    momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
  }
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
  attachControlledLabelToPlayer(best);
}

// =============================================================================
// GOALS
// =============================================================================

function showGoal(teamName, options) {
  if (!options?.penaltyOnly) {
    triggerCameraShake(0.6, 0.5);
  }
  playSound('whistle');
  playSound('crowd_cheer');
  goalPopupTimer = options?.penaltyOnly ? 2 : 3;
  if (elGoalPopup && elGoalTeamName) {
    elGoalTeamName.textContent = teamName;
    elGoalPopup.classList.add('show');
  }
  if (!options?.penaltyOnly) {
    const line =
      GOAL_COMMENTARY_PHRASES[
        Math.floor(Math.random() * GOAL_COMMENTARY_PHRASES.length)
      ](teamName);
    showCommentary(line, 2);
  }
  if (options?.penaltyOnly) return;
  if (gameBall) goalReplayPos.copy(gameBall.position);
  goalReplayTimer = 3.0;
  setState(GAME_STATE.GOAL_REPLAY);
}

function pickPenaltyStriker(teamIndex) {
  return (
    players.find(
      (p) =>
        p.teamIndex === teamIndex && p.role === 'fwd' && p.slotIndex === 9
    ) ||
    players.find((p) => p.teamIndex === teamIndex && p.role === 'fwd') ||
    players.find((p) => p.teamIndex === teamIndex && p.role !== 'gk')
  );
}

function positionPlayersForPenaltyKick() {
  const t = penaltyTeam;
  const gz = getAttackingGoalZ(t);
  const defTeam = t === 0 ? 1 : 0;
  penaltyStriker = pickPenaltyStriker(t);
  penaltyGk = players.find((p) => p.teamIndex === defTeam && p.role === 'gk');
  if (!penaltyStriker || !penaltyGk) return;

  penaltyStriker.position.set(0, 0, gz * 0.35);
  penaltyStriker.velocity.set(0, 0, 0);
  const toGoalZ = gz - penaltyStriker.position.z;
  penaltyStriker.rotation = Math.atan2(0, toGoalZ);
  penaltyStriker.mesh.rotation.y = penaltyStriker.rotation;

  const gLine =
    defTeam === 0 ? GAME_CONFIG.goalLineZHome : GAME_CONFIG.goalLineZAway;
  const inward = defTeam === 0 ? 1 : -1;
  penaltyGk.position.set(0, 0, gLine + inward * 0.65);
  penaltyGk.velocity.set(0, 0, 0);
  const gkFace = -inward;
  penaltyGk.rotation = Math.atan2(0, gkFace);
  penaltyGk.mesh.rotation.y = penaltyGk.rotation;

  for (const p of players) {
    if (p === penaltyStriker || p === penaltyGk) continue;
    const side = p.teamIndex === 0 ? -1 : 1;
    p.position.set(side * 28 + (p.slotIndex % 7) * 0.2, 0, -38 * Math.sign(gz));
    p.velocity.set(0, 0, 0);
  }

  releaseBallFromOwner();
  if (gameBall) {
    gameBall.position.set(0, GAME_CONFIG.ballRadius, 0);
    ballVelocity.set(0, 0, 0);
  }

  players.forEach((p) => {
    p.isUserControlled = p === penaltyStriker;
  });
  controlledPlayer = penaltyStriker;
  attachControlledLabelToPlayer(penaltyStriker);
}

function updatePenaltyHud() {
  if (!elPenaltyHudHome || !elPenaltyHudAway) return;
  if (elPenaltyHudLabelHome) elPenaltyHudLabelHome.textContent = TEAMS.home.name;
  if (elPenaltyHudLabelAway) elPenaltyHudLabelAway.textContent = TEAMS.away.name;
  const maxSlots = Math.max(
    5,
    penaltyResults[0].length,
    penaltyResults[1].length
  );
  function row(teamIdx) {
    const r = penaltyResults[teamIdx];
    const parts = [];
    for (let i = 0; i < maxSlots; i++) {
      if (i < r.length) parts.push(r[i] === 's' ? '●' : '○');
      else parts.push('\u00a0\u00a0');
    }
    return parts.join(' ');
  }
  elPenaltyHudHome.textContent = row(0);
  elPenaltyHudAway.textContent = row(1);
}

function tryFinishPenaltyShootout() {
  const s0 = penaltyScores[0];
  const s1 = penaltyScores[1];
  const a0 = penaltyAttempts[0];
  const a1 = penaltyAttempts[1];
  if (a0 < 5 || a1 < 5) {
    const rem0 = 5 - a0;
    const rem1 = 5 - a1;
    if (s0 > s1 + rem1) return 0;
    if (s1 > s0 + rem0) return 1;
    return null;
  }
  if (a0 === 5 && a1 === 5 && s0 !== s1) {
    return s0 > s1 ? 0 : 1;
  }
  if (a0 === 5 && a1 === 5 && s0 === s1) {
    return null;
  }
  if (a0 >= 5 && a1 >= 5 && a0 === a1 && s0 !== s1) {
    return s0 > s1 ? 0 : 1;
  }
  return null;
}

function penaltyShoot() {
  const t = penaltyTeam;
  const halfGoal = GAME_CONFIG.goalWidth * 0.5;
  const aimedX = penaltyAimX * halfGoal * 1.1;
  const aimedY = GAME_CONFIG.goalHeight * (0.15 + penaltyAimY * 0.8);
  const gz = getAttackingGoalZ(t);
  const gkReach = 0.35 + Math.random() * 0.25;
  const normalizedX = Math.abs(penaltyAimX);
  const scored =
    normalizedX > gkReach ||
    (penaltyAimY > 0.7 && Math.random() < 0.65);

  if (gameBall && penaltyStriker) {
    gameBall.position.set(
      penaltyStriker.position.x,
      GAME_CONFIG.ballRadius,
      penaltyStriker.position.z
    );
  }
  releaseBallFromOwner();
  if (penaltyStriker) penaltyStriker.hasBall = false;
  ballVelocity.set(aimedX * 3, aimedY * 6, Math.sign(gz || 1) * 22);
  lastTouchTeam = t;
  playSound('kick');

  penaltyAimX = 0;
  penaltyAimY = 0;

  if (scored) {
    penaltyScores[t] += 1;
    penaltyResults[t].push('s');
    triggerCameraShake(0.5, 0.4);
    showGoal(t === 0 ? TEAMS.home.name : TEAMS.away.name, { penaltyOnly: true });
  } else {
    penaltyResults[t].push('m');
    penaltySavedTimer = 1.8;
    if (elPenaltySaved) {
      elPenaltySaved.classList.add('show');
    }
    playSound('near_miss');
  }
  penaltyAttempts[t] += 1;
  penaltyKickIndex += 1;
  penaltyTeam = t === 0 ? 1 : 0;
  updatePenaltyHud();

  const winner = tryFinishPenaltyShootout();
  if (winner !== null) {
    endPenaltyShootout(winner);
    return;
  }
  penaltyResolveTimer = 2.5;
  penaltyAwaitingKick = false;
}

function endPenaltyShootout(winnerTeam) {
  lastFulltimePenaltyWinner = winnerTeam;
  penaltyRunTimer = 0;
  penaltyResolveTimer = 0;
  penaltyIntroTimer = 0;
  penaltyAwaitingKick = false;
  if (elSetPiecePopup) elSetPiecePopup.classList.remove('show');
  if (elPenaltyHud) elPenaltyHud.classList.remove('visible');
  if (elPenaltySaved) elPenaltySaved.classList.remove('show');
  releaseBallFromOwner();
  resetPlayersToFormation();
  setState(GAME_STATE.FULLTIME);
}

function startPenaltyShootout() {
  penaltyTeam = 0;
  penaltyKickIndex = 0;
  penaltyScores[0] = 0;
  penaltyScores[1] = 0;
  penaltyAttempts[0] = 0;
  penaltyAttempts[1] = 0;
  penaltyResults = [[], []];
  penaltyAimX = 0;
  penaltyAimY = 0;
  penaltyIntroTimer = 2;
  penaltyAwaitingKick = false;
  penaltyRunTimer = 0;
  penaltyResolveTimer = 0;
  penaltySavedTimer = 0;
  aiPenaltyTimer = null;

  if (elSetPieceText) elSetPieceText.textContent = 'PENALTY SHOOTOUT';
  if (elSetPiecePopup) elSetPiecePopup.classList.add('show');

  positionPlayersForPenaltyKick();
  updatePenaltyHud();
  setState(GAME_STATE.PENALTY);
}

function ballInHomeGoalScoringVolume(p) {
  const gw = GAME_CONFIG.goalWidth * 0.5;
  const gh = GAME_CONFIG.goalHeight;
  const r = GAME_CONFIG.ballRadius;
  return (
    p.z + r < GAME_CONFIG.goalLineZHome &&
    p.z + r > GAME_CONFIG.goalLineZHome - 2 &&
    Math.abs(p.x) <= gw &&
    p.y < gh + r
  );
}

function ballInAwayGoalScoringVolume(p) {
  const gw = GAME_CONFIG.goalWidth * 0.5;
  const gh = GAME_CONFIG.goalHeight;
  const r = GAME_CONFIG.ballRadius;
  return (
    p.z - r > GAME_CONFIG.goalLineZAway &&
    p.z - r < GAME_CONFIG.goalLineZAway + 2 &&
    Math.abs(p.x) <= gw &&
    p.y < gh + r
  );
}

function distPointToSegment3D(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLen2 = abx * abx + aby * aby + abz * abz;
  const t =
    abLen2 < 1e-10
      ? 0
      : THREE.MathUtils.clamp(
          (apx * abx + apy * aby + apz * abz) / abLen2,
          0,
          1
        );
  const qx = ax + t * abx;
  const qy = ay + t * aby;
  const qz = az + t * abz;
  return Math.hypot(px - qx, py - qy, pz - qz);
}

function minDistBallToHomeGoalFrame(p) {
  const gw = GAME_CONFIG.goalWidth * 0.5;
  const gh = GAME_CONFIG.goalHeight;
  const z = GAME_CONFIG.goalLineZHome;
  const d1 = distPointToSegment3D(p.x, p.y, p.z, -gw, 0, z, -gw, gh, z);
  const d2 = distPointToSegment3D(p.x, p.y, p.z, gw, 0, z, gw, gh, z);
  const d3 = distPointToSegment3D(p.x, p.y, p.z, -gw, gh, z, gw, gh, z);
  return Math.min(d1, d2, d3);
}

function minDistBallToAwayGoalFrame(p) {
  const gw = GAME_CONFIG.goalWidth * 0.5;
  const gh = GAME_CONFIG.goalHeight;
  const z = GAME_CONFIG.goalLineZAway;
  const d1 = distPointToSegment3D(p.x, p.y, p.z, -gw, 0, z, -gw, gh, z);
  const d2 = distPointToSegment3D(p.x, p.y, p.z, gw, 0, z, gw, gh, z);
  const d3 = distPointToSegment3D(p.x, p.y, p.z, -gw, gh, z, gw, gh, z);
  return Math.min(d1, d2, d3);
}

function checkNearMissShots(deltaTime) {
  if (nearMissCooldown > 0) {
    nearMissCooldown -= deltaTime;
    return;
  }
  if (!gameBall || ballOwner) return;
  if (ballVelocity.lengthSq() < 16) return;
  const p = gameBall.position;
  const r = GAME_CONFIG.ballRadius;
  const threshold = 0.5 + r;

  if (Math.abs(p.z - GAME_CONFIG.goalLineZHome) < 8) {
    if (
      minDistBallToHomeGoalFrame(p) < threshold &&
      !ballInHomeGoalScoringVolume(p)
    ) {
      playSound('near_miss');
      nearMissCooldown = 0.85;
      postShake.group = homeGoalGroup;
      postShake.timer = 0.35;
      postShake.intensity = 0.08;
      triggerCameraShake(0.3, 0.25);
      showCommentary('So close! Just wide of the post.', 1);
      return;
    }
  }
  if (Math.abs(p.z - GAME_CONFIG.goalLineZAway) < 8) {
    if (
      minDistBallToAwayGoalFrame(p) < threshold &&
      !ballInAwayGoalScoringVolume(p)
    ) {
      playSound('near_miss');
      nearMissCooldown = 0.85;
      postShake.group = awayGoalGroup;
      postShake.timer = 0.35;
      postShake.intensity = 0.08;
      triggerCameraShake(0.3, 0.25);
      showCommentary('So close! Just wide of the post.', 1);
    }
  }
}

function pickCelebrationRunners(scorer) {
  const mates = players.filter(
    (pl) =>
      pl.teamIndex === scorer.teamIndex && pl !== scorer && pl.role !== 'gk'
  );
  mates.sort(
    (a, b) =>
      a.position.distanceToSquared(scorer.position) -
      b.position.distanceToSquared(scorer.position)
  );
  celebrationRunners = mates.slice(0, 2);
}

function checkGoals() {
  if (!gameBall || ballOwner) return;
  if (gameState === GAME_STATE.PENALTY) return;
  const gw = GAME_CONFIG.goalWidth * 0.5;
  const gh = GAME_CONFIG.goalHeight;
  const p = gameBall.position;
  const r = GAME_CONFIG.ballRadius;

  if (p.z + r < GAME_CONFIG.goalLineZHome && p.z + r > GAME_CONFIG.goalLineZHome - 2) {
    if (Math.abs(p.x) <= gw && p.y < gh + r) {
      awayScore += 1;
      shotsOnTarget[1] += 1;
      homeNetDeform.active = true;
      homeNetDeform.timer = 0.8;
      homeNetDeform.impactX = p.x;
      homeNetDeform.impactY = p.y;
      if (lastShooter && lastShooter.teamIndex === 1) {
        celebratingPlayer = lastShooter;
        celebrationTimer = 2.5;
        pickCelebrationRunners(lastShooter);
      } else {
        celebratingPlayer = null;
        celebrationRunners = [];
        celebrationTimer = 0;
      }
      {
        const mood = 0.12 + 0.25;
        momentumScore -= mood;
        momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
      }
      registerOpenPlayGoalMilestones(1);
      showGoal(TEAMS.away.name);
    }
  }
  if (p.z - r > GAME_CONFIG.goalLineZAway && p.z - r < GAME_CONFIG.goalLineZAway + 2) {
    if (Math.abs(p.x) <= gw && p.y < gh + r) {
      homeScore += 1;
      shotsOnTarget[0] += 1;
      awayNetDeform.active = true;
      awayNetDeform.timer = 0.8;
      awayNetDeform.impactX = p.x;
      awayNetDeform.impactY = p.y;
      if (lastShooter && lastShooter.teamIndex === 0) {
        celebratingPlayer = lastShooter;
        celebrationTimer = 2.5;
        pickCelebrationRunners(lastShooter);
      } else {
        celebratingPlayer = null;
        celebrationRunners = [];
        celebrationTimer = 0;
      }
      {
        const mood = 0.12 + 0.25;
        momentumScore += mood;
        momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
      }
      registerOpenPlayGoalMilestones(0);
      showGoal(TEAMS.home.name);
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
  if (touchMoveDir.length() > 0.1) {
    tmpV1.set(touchMoveDir.x, 0, touchMoveDir.y);
    if (tmpV1.lengthSq() > 1) tmpV1.normalize();
    return tmpV1;
  }

  if (gamepadMoveDir.length() > 0.15) {
    tmpV1.set(gamepadMoveDir.x, 0, gamepadMoveDir.y);
    if (tmpV1.lengthSq() > 1) tmpV1.normalize();
    if (!camera) {
      return tmpV1;
    }
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    if (camForward.lengthSq() < 1e-10) {
      return tmpV1;
    }
    camForward.normalize();
    const camRight = new THREE.Vector3();
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();
    const gx = tmpV1.x;
    const gz = tmpV1.z;
    tmpV1
      .set(0, 0, 0)
      .addScaledVector(camForward, -gz)
      .addScaledVector(camRight, gx);
    if (tmpV1.lengthSq() > 1) tmpV1.normalize();
    return tmpV1;
  }

  let x = 0;
  let z = 0;
  if (keys.KeyW || keys.w) z -= 1;
  if (keys.KeyS || keys.s) z += 1;
  if (keys.KeyA || keys.a) x -= 1;
  if (keys.KeyD || keys.d) x += 1;
  if (x === 0 && z === 0) return tmpV1.set(0, 0, 0);

  if (!camera) {
    tmpV1.set(x, 0, z);
    if (tmpV1.lengthSq() > 1) tmpV1.normalize();
    return tmpV1;
  }

  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  if (camForward.lengthSq() < 1e-10) {
    tmpV1.set(x, 0, z);
    if (tmpV1.lengthSq() > 1) tmpV1.normalize();
    return tmpV1;
  }
  camForward.normalize();
  const camRight = new THREE.Vector3();
  camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

  tmpV1
    .set(0, 0, 0)
    .addScaledVector(camForward, -z)
    .addScaledVector(camRight, x);
  if (tmpV1.lengthSq() > 1) tmpV1.normalize();
  return tmpV1;
}

function updatePlayerMovement(deltaTime) {
  for (const p of players) {
    p.isShielding = false;
    p.shieldStealRadiusMul = 1;
  }

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
    (keys.KeyE || touchShootHeld || gamepadYHeld) &&
    controlledPlayer.hasBall &&
    ballOwner === controlledPlayer
  ) {
    shotChargePct = Math.min(
      1,
      shotChargePct + deltaTime / GAME_CONFIG.shotChargeDuration
    );
  }

  const dir = getMovementVector();
  const sprint = !!(
    keys.ShiftLeft ||
    keys.ShiftRight ||
    gamepadSprint
  );

  if (
    controlledPlayer.hasBall &&
    ballOwner === controlledPlayer &&
    (keys.KeyX || gamepadShield)
  ) {
    controlledPlayer.isShielding = true;
    controlledPlayer.shieldStealRadiusMul = 2;
    controlledPlayer.stamina = Math.max(
      0,
      controlledPlayer.stamina - PLAYER_CONFIG.sprintDrain * 0.5 * deltaTime
    );
    if (!dir || dir.lengthSq() < 1e-6) {
      controlledPlayer.velocity.multiplyScalar(
        Math.pow(PLAYER_CONFIG.friction, deltaTime * 60)
      );
    } else {
      const dirN = dir.clone().normalize();
      controlledPlayer.rotation = Math.atan2(dirN.x, dirN.z);
      controlledPlayer.mesh.rotation.y = controlledPlayer.rotation;
      const targetSpeed = PLAYER_CONFIG.walkSpeed * 0.7;
      const targetVel = dirN.multiplyScalar(targetSpeed);
      controlledPlayer.velocity.lerp(
        targetVel,
        1 - Math.pow(0.001, deltaTime * 60)
      );
    }
  } else {
    controlledPlayer.move(dir, sprint, deltaTime);
  }

  if (keySpacePressed) {
    keySpacePressed = false;
    if (controlledPlayer.hasBall && ballOwner === controlledPlayer) {
      performPass(controlledPlayer);
    } else {
      switchToClosestPlayer();
    }
  }
  if (keyEPressed && !shotCharging) {
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

function separatePlayers() {
  const minDist = PLAYER_CONFIG.bodyRadius * 2.2;
  const minDist2 = minDist * minDist;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const dx = a.position.x - b.position.x;
      const dz = a.position.z - b.position.z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 < minDist2 && dist2 > 1e-8) {
        const dist = Math.sqrt(dist2);
        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;
        a.position.x += nx * overlap;
        a.position.z += nz * overlap;
        b.position.x -= nx * overlap;
        b.position.z -= nz * overlap;
        a.clampToPitch();
        b.clampToPitch();
      }
    }
  }
}

function updateAllPlayers(deltaTime) {
  for (const p of players) {
    p.update(deltaTime);
  }
  separatePlayers();
}

// =============================================================================
// AI
// =============================================================================

function aiGoalkeeperBehavior(p, deltaTime) {
  /** Formation anchor (slot from computeFormationWorld), synced here only per AI contract */
  p.homePosition = p.formationWorld;

  if (!gameBall) return;
  if (p.isDiving) return;

  const goalZ = p.teamIndex === 0 ? -PITCH_CONFIG.halfLength : PITCH_CONFIG.halfLength;

  const distGkToBall = p.position.distanceTo(gameBall.position);
  const distBallToGoal = Math.hypot(
    gameBall.position.x,
    gameBall.position.z - goalZ
  );

  if (
    !ballOwner &&
    distGkToBall < 1.5 &&
    distBallToGoal < PLAYER_CONFIG.gkDiveRange &&
    gameBall.position.y < GAME_CONFIG.goalHeight + 1.5 &&
    Math.abs(gameBall.position.x - p.position.x) < 5
  ) {
    const saveDir = tmpV2.set(
      gameBall.position.x - p.position.x,
      0,
      gameBall.position.z - p.position.z
    );
    if (saveDir.lengthSq() < 1e-6) {
      saveDir.set(Math.sign(ballVelocity.x) || 1, 0, 0);
    } else {
      saveDir.normalize();
    }
    p.isDiving = true;
    p.diveDir.copy(saveDir);
    p.diveTimer = 0.6;
    ballVelocity.set(
      (Math.random() - 0.5) * 8,
      6 + Math.random() * 4,
      -ballVelocity.z * 0.3
    );
    releaseBallFromOwner();
    playSound('save');
    lastTouchTeam = p.teamIndex;
    if (clock) {
      const t = clock.getElapsedTime();
      const def = p.teamIndex;
      if (t - lastGkSaveStatAt[def] >= 0.35) {
        lastGkSaveStatAt[def] = t;
        const atk = def === 0 ? 1 : 0;
        shotsOnTarget[atk] += 1;
        momentumScore += 0.12 * (atk === 0 ? 1 : -1);
        momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
        showCommentary('Brilliant save by the keeper!', 1);
      }
    }
    return;
  }

  const toGoalFromBall = tmpV2.set(
    -gameBall.position.x,
    0,
    goalZ - gameBall.position.z
  );
  const tgl = toGoalFromBall.length();
  if (tgl > 1e-6) toGoalFromBall.multiplyScalar(1 / tgl);
  const vxz = tmpV3.set(ballVelocity.x, 0, ballVelocity.z);
  const vhLen = vxz.length();
  const dotTowardGoal = vhLen > 1e-6 ? vxz.dot(toGoalFromBall) / vhLen : 0;
  const shotThreat =
    !ballOwner &&
    ballVelocity.length() > 12 &&
    dotTowardGoal > 0;

  p.aiReaction += shotThreat ? deltaTime * 3 : deltaTime;
  const reactThreshold = shotThreat ? 0.05 : PLAYER_CONFIG.aiReactionTime;
  if (p.aiReaction < reactThreshold) return;
  p.aiReaction = 0;

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
      toHome.normalize();
      p.move(toHome, false, deltaTime, true);
    } else {
      p.velocity.multiplyScalar(0.88);
    }
  } else if (opponentThreatening) {
    const standOff = 2.8;
    const gx = 0;
    const gz = goalZ;
    const dx = gameBall.position.x - gx;
    const dz = gameBall.position.z - gz;
    const len = Math.hypot(dx, dz);
    let tx;
    let tz;
    if (len < 1e-4) {
      tx = THREE.MathUtils.clamp(
        gameBall.position.x * 0.7,
        -PLAYER_CONFIG.gkMoveRange,
        PLAYER_CONFIG.gkMoveRange
      );
      tz = gz + (p.teamIndex === 0 ? standOff : -standOff);
    } else {
      const ix = gx + (dx / len) * standOff;
      const iz = gz + (dz / len) * standOff;
      tx = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(ix, gameBall.position.x * 0.7, 0.5),
        -PLAYER_CONFIG.gkMoveRange,
        PLAYER_CONFIG.gkMoveRange
      );
      tz = iz;
    }
    const toTarget = tmpV2.set(tx - p.position.x, 0, tz - p.position.z);
    if (toTarget.length() > 0.05) {
      toTarget.normalize();
      const canSprint = p.stamina > 25;
      const shouldSprint =
        canSprint &&
        (distGkToBall < 8 || Math.random() < PLAYER_CONFIG.aiSprintChance);
      p.move(toTarget, shouldSprint, deltaTime, !shouldSprint);
    } else {
      p.velocity.multiplyScalar(0.85);
    }
  } else {
    if (distHome > 2 && toHome.lengthSq() > 1e-6) {
      toHome.normalize();
      p.move(toHome, false, deltaTime, true);
    } else {
      p.velocity.multiplyScalar(0.87);
    }
  }
}

function aiFieldPlayerBehavior(p, deltaTime) {
  /** Formation slot world target from computeFormationWorld */
  p.homePosition = p.formationWorld;
  const homePosition = p.homePosition;

  if (p.hasBall && ballOwner === p) {
    const gz = getAttackingGoalZ(p.teamIndex);
    const distToGoal = Math.abs(gz - p.position.z);

    const dir = tmpV2.set(0, 0, gz).sub(p.position);
    dir.y = 0;
    if (dir.lengthSq() > 1e-4) {
      dir.normalize();
      const distanceToBallCarrier = p.position.distanceTo(gameBall.position);
      const canSprint = p.stamina > 25;
      const shouldSprint =
        canSprint &&
        (distanceToBallCarrier < 8 ||
          p._shouldPress ||
          Math.random() < PLAYER_CONFIG.aiSprintChance);
      p.move(dir, shouldSprint, deltaTime);
    }

    const nearestOpponent = players
      .filter((o) => o.teamIndex !== p.teamIndex)
      .reduce((best, o) => {
        const d = o.position.distanceTo(p.position);
        return d < (best?.dist ?? 1e9) ? { pl: o, dist: d } : best;
      }, null);
    const opponentClose = nearestOpponent && nearestOpponent.dist < 5;

    if (distToGoal < 18 && !opponentClose) {
      performShoot(p, 0.7 + Math.random() * 0.3);
    } else if (opponentClose || distToGoal > 30) {
      if (Math.random() < 0.6) performPass(p);
      else performThroughBall(p);
    } else if (distToGoal < 28 && Math.random() < 0.015 * deltaTime * 60) {
      performShoot(p, 0.5 + Math.random() * 0.5);
    }
    return;
  }

  if (!gameBall) return;

  const ballPos = gameBall.position;
  const distanceToBall = p.position.distanceTo(ballPos);
  const weHaveBall = ballOwner != null && ballOwner.teamIndex === p.teamIndex;

  if (!p._shouldPress && !weHaveBall) {
    const toHome = tmpV2.subVectors(homePosition, p.position);
    toHome.y = 0;
    if (toHome.lengthSq() > 1e-4) {
      toHome.normalize();
      p.move(toHome, false, deltaTime, true);
    } else {
      p.velocity.multiplyScalar(0.88);
    }
    return;
  }

  if (!p._shouldPress && weHaveBall) {
    const gz = getAttackingGoalZ(p.teamIndex);
    const forwardSign = Math.sign(gz - ballPos.z) || (gz >= 0 ? 1 : -1);
    const margin = 0.5;
    const targetX = THREE.MathUtils.clamp(
      p.formationWorld.x,
      -PITCH_CONFIG.halfWidth + margin,
      PITCH_CONFIG.halfWidth - margin
    );
    let targetZ = ballPos.z + forwardSign * 8;
    targetZ = THREE.MathUtils.clamp(
      targetZ,
      -PITCH_CONFIG.halfLength + margin,
      PITCH_CONFIG.halfLength - margin
    );
    const toSupport = tmpV2.set(targetX - p.position.x, 0, targetZ - p.position.z);
    if (toSupport.lengthSq() > 1e-4) {
      toSupport.normalize();
      const canSprint = p.stamina > 25;
      const shouldSprint =
        canSprint &&
        (distanceToBall < 8 ||
          p._shouldPress ||
          Math.random() < PLAYER_CONFIG.aiSprintChance);
      p.move(toSupport, shouldSprint, deltaTime);
    } else {
      p.velocity.multiplyScalar(0.92);
    }
    return;
  }

  p.aiReaction += deltaTime;
  if (p.aiReaction < PLAYER_CONFIG.aiReactionTime) return;
  p.aiReaction = 0;

  const dir = tmpV3.set(0, 0, 0);

  if (!weHaveBall) {
    const toBall = tmpV2.subVectors(ballPos, p.position);
    toBall.y = 0;
    if (toBall.lengthSq() > 1e-4) dir.copy(toBall.normalize());
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
    const canSprint = p.stamina > 25;
    const shouldSprint =
      canSprint &&
      (distanceToBall < 8 ||
        p._shouldPress ||
        Math.random() < PLAYER_CONFIG.aiSprintChance);
    p.move(dir, shouldSprint, deltaTime);
  } else {
    p.velocity.multiplyScalar(0.9);
  }

  const tackleBallDist =
    ballOwner?.isShielding && ballOwner.teamIndex !== p.teamIndex ? 1 : 2;
  if (
    p._shouldPress &&
    distanceToBall < tackleBallDist &&
    !p.hasBall &&
    ballOwner &&
    ballOwner.teamIndex !== p.teamIndex
  ) {
    performTackle(p);
  }
}

function updateAI(deltaTime) {
  if (gameState !== GAME_STATE.PLAYING) return;
  if (restartInProgress) return;

  const distBallXZForPress = (pl) => {
    if (!gameBall) return 1e9;
    const dx = pl.position.x - gameBall.position.x;
    const dz = pl.position.z - gameBall.position.z;
    return Math.hypot(dx, dz);
  };

  const pressMaxDist = activeDifficulty.pressRadius * 3;
  for (let tid = 0; tid < 2; tid += 1) {
    const field = players.filter(
      (pl) => pl.teamIndex === tid && pl.role !== 'gk'
    );
    for (const pl of field) {
      pl._shouldPress = false;
    }
    const eligible = field.filter(
      (pl) => distBallXZForPress(pl) <= pressMaxDist
    );
    eligible.sort((a, b) => distBallXZForPress(a) - distBallXZForPress(b));
    for (let i = 0; i < Math.min(2, eligible.length); i += 1) {
      eligible[i]._shouldPress = true;
    }
  }

  for (const p of players) {
    if (p.isUserControlled) continue;
    if (
      gameState === GAME_STATE.FREEKICK &&
      freeKickWallPlayers.includes(p)
    ) {
      continue;
    }
    if (p.role === 'gk') aiGoalkeeperBehavior(p, deltaTime);
    else aiFieldPlayerBehavior(p, deltaTime);
  }
}

// =============================================================================
// MATCH TIME & STATES
// =============================================================================

function formatMatchClock(sec) {
  const halfDur = GAME_CONFIG.halfDurationSec;
  const fullDur = GAME_CONFIG.fullDurationSec;
  const halfRegMin = Math.floor(halfDur / 60);
  const fullRegMin = Math.floor(fullDur / 60);

  if (currentHalf === 1 && sec > halfDur) {
    const over = Math.floor(sec - halfDur);
    const om = Math.floor(over / 60);
    const os = over % 60;
    return `${halfRegMin}+${om}:${String(os).padStart(2, '0')}`;
  }
  if (currentHalf === 2 && sec > fullDur) {
    const over = Math.floor(sec - fullDur);
    const om = Math.floor(over / 60);
    const os = over % 60;
    return `${fullRegMin}+${om}:${String(os).padStart(2, '0')}`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateMatchTime(deltaTime) {
  if (gameState !== GAME_STATE.PLAYING) return;
  matchTimeSec += deltaTime;
  momentumTickAccum += deltaTime;
  while (momentumTickAccum >= 1) {
    momentumTickAccum -= 1;
    momentumScore *= 0.96;
    momentumScore = THREE.MathUtils.clamp(momentumScore, -1, 1);
  }
  matchFatigueFactor =
    1.0 -
    Math.min(
      1,
      matchTimeSec / (GAME_CONFIG.fullDurationSec + injuryTimeAddedHalf2)
    ) *
      0.22;

  if (currentHalf === 1) {
    if (
      !injuryStoppageAnnouncedFirstHalf &&
      matchTimeSec >= GAME_CONFIG.halfDurationSec
    ) {
      injuryStoppageAnnouncedFirstHalf = true;
      const n = injuryTimeAddedHalf1 / 60;
      showCommentary(`${n} minutes of added time`, 1);
    }
    if (
      matchTimeSec >=
      GAME_CONFIG.halfDurationSec + injuryTimeAddedHalf1
    ) {
      setState(GAME_STATE.HALFTIME);
    }
    return;
  }

  if (currentHalf === 2) {
    if (
      !injuryStoppageAnnouncedSecondHalf &&
      matchTimeSec >= GAME_CONFIG.fullDurationSec
    ) {
      injuryStoppageAnnouncedSecondHalf = true;
      const n = injuryTimeAddedHalf2 / 60;
      showCommentary(`${n} minutes of added time`, 1);
    }
    if (
      matchTimeSec >=
      GAME_CONFIG.fullDurationSec + injuryTimeAddedHalf2
    ) {
      if (homeScore === awayScore) {
        startPenaltyShootout();
      } else {
        setState(GAME_STATE.FULLTIME);
      }
    }
  }
}

function beginSecondHalf() {
  currentHalf = 2;
  injuryTimeAddedHalf2 = Math.floor(Math.random() * 4 + 1) * 60;
  injuryStoppageAnnouncedSecondHalf = false;
  sidesSwapped = true;
  const staminaBefore = players.map((p) => p.stamina);
  resetPlayersToFormation();
  players.forEach((p, i) => {
    const prev = staminaBefore[i] ?? p.stamina;
    p.stamina = Math.min(PLAYER_CONFIG.staminaMax, prev + 35);
  });
  matchFatigueFactor = Math.min(1.0, matchFatigueFactor + 0.08);
}

function setState(next) {
  const prev = gameState;
  gameState = next;

  if (prev === GAME_STATE.GOAL_REPLAY && next === GAME_STATE.PLAYING) {
    if (celebratingPlayer) {
      celebratingPlayer.mesh.position.y = 0;
      celebratingPlayer.mesh.rotation.y = celebratingPlayer.rotation;
      celebratingPlayer = null;
    }
    celebrationTimer = 0;
    celebrationRunners = [];
    resetAfterGoal();
  }

  if (
    prev === GAME_STATE.PLAYING &&
    next !== GAME_STATE.PLAYING &&
    next !== GAME_STATE.FREEKICK
  ) {
    shotCharging = false;
    shotChargePct = 0;
  }

  if (prev === GAME_STATE.FREEKICK && next !== GAME_STATE.FREEKICK) {
    removeFkArrow();
    freeKickWallPlayers = [];
    delete freekickData.aiDelay;
    delete freekickData.aiFkCommentaryShown;
    if (next !== GAME_STATE.PLAYING) {
      freekickData.shooter = null;
    }
  }

  if (next !== GAME_STATE.PENALTY && elPenaltyCrosshair) {
    elPenaltyCrosshair.classList.remove('visible');
  }

  if (next === GAME_STATE.MENU) {
    crowdLoop.stop();
    cameraMode = 'BROADCAST';
    if (cameraPersp) camera = cameraPersp;
    if (elMainMenu) elMainMenu.classList.remove('show-custom');
  }

  if (elLoadingScreen) elLoadingScreen.classList.toggle('hidden', next !== GAME_STATE.LOADING);
  if (elMainMenu) elMainMenu.classList.toggle('visible', next === GAME_STATE.MENU);
  if (elPauseMenu) elPauseMenu.classList.toggle('visible', next === GAME_STATE.PAUSED);
  if (elHalftimeScreen) elHalftimeScreen.classList.toggle('visible', next === GAME_STATE.HALFTIME);
  if (elFulltimeScreen) elFulltimeScreen.classList.toggle('visible', next === GAME_STATE.FULLTIME);
  if (elHud) {
    elHud.classList.toggle(
      'visible',
      next === GAME_STATE.PLAYING ||
        next === GAME_STATE.PAUSED ||
        next === GAME_STATE.GOAL_REPLAY ||
        next === GAME_STATE.PENALTY ||
        next === GAME_STATE.FREEKICK ||
        next === GAME_STATE.SUBSTITUTION
    );
  }

  if (elSubPanel) {
    elSubPanel.classList.toggle('visible', next === GAME_STATE.SUBSTITUTION);
  }
  if (next === GAME_STATE.SUBSTITUTION) {
    subPanelPhase = 'off';
    subPlayerOut = null;
    subPlayerIn = null;
    renderSubPanelList();
  }

  if (next === GAME_STATE.PENALTY && elPenaltyHud) {
    elPenaltyHud.classList.add('visible');
  }
  if (next !== GAME_STATE.PENALTY && elPenaltyHud) {
    elPenaltyHud.classList.remove('visible');
  }

  if (next === GAME_STATE.GOAL_REPLAY) {
    cameraMode = 'BROADCAST';
    if (cameraPersp) camera = cameraPersp;
    if (camera) camera.up.set(0, 1, 0);
  }

  if (next === GAME_STATE.HALFTIME && elHalftimeScore) {
    elHalftimeScore.textContent = `${homeScore} - ${awayScore}`;
  }
  if (next === GAME_STATE.HALFTIME) {
    showCommentary(
      'Half time whistle! The referee brings the first half to a close.',
      1
    );
  }
  if (next === GAME_STATE.FULLTIME && prev !== GAME_STATE.FULLTIME) {
    pushMatchToHistory();
  }
  if (next === GAME_STATE.FULLTIME) {
    if (elFulltimeScore) elFulltimeScore.textContent = `${homeScore} - ${awayScore}`;
    if (elFulltimeResult) {
      if (lastFulltimePenaltyWinner !== null) {
        const u = GAME_CONFIG.userTeamIndex;
        const won = lastFulltimePenaltyWinner === u;
        elFulltimeResult.textContent = won ? 'WIN (PENS)' : 'LOSS (PENS)';
        lastFulltimePenaltyWinner = null;
      } else {
        const u = GAME_CONFIG.userTeamIndex;
        const userAhead =
          u === 0 ? homeScore > awayScore : awayScore > homeScore;
        if (homeScore === awayScore) elFulltimeResult.textContent = 'DRAW';
        else if (userAhead) elFulltimeResult.textContent = 'WIN';
        else elFulltimeResult.textContent = 'LOSS';
      }
    }
  }
}

function resetMatchStats() {
  touches[0] = 0;
  touches[1] = 0;
  shots[0] = 0;
  shots[1] = 0;
  shotsOnTarget[0] = 0;
  shotsOnTarget[1] = 0;
  passesCompleted[0] = 0;
  passesCompleted[1] = 0;
  lastGkSaveStatAt[0] = 0;
  lastGkSaveStatAt[1] = 0;
  goalScorers.clear();
}

function startMatch() {
  playSound('whistle');
  cameraMode = 'BROADCAST';
  if (cameraPersp) camera = cameraPersp;
  yellowCards.clear();
  resetMatchStats();
  momentumScore = 0;
  momentumTickAccum = 0;
  subsMade = 0;
  applyWeatherForMatch();
  ensureRainSystem();
  homeScore = 0;
  awayScore = 0;
  matchTimeSec = 0;
  matchFatigueFactor = 1.0;
  commentaryUserFirstTouchDone = false;
  currentHalf = 1;
  injuryTimeAddedHalf1 = Math.floor(Math.random() * 4 + 1) * 60;
  injuryStoppageAnnouncedFirstHalf = false;
  injuryStoppageAnnouncedSecondHalf = false;
  sidesSwapped = false;
  lastFulltimePenaltyWinner = null;
  penaltyIntroTimer = 0;
  penaltyAwaitingKick = false;
  penaltyRunTimer = 0;
  penaltyResolveTimer = 0;
  penaltySavedTimer = 0;
  shotCharging = false;
  shotChargePct = 0;
  setupTeams();
  resetPlayersToFormation();
  setState(GAME_STATE.PLAYING);
  showCommentary('Kickoff! The match is underway.', 0);
  void crowdLoop.start();
}

// =============================================================================
// CAMERA
// =============================================================================

function updateTacticalOrthoFrustum() {
  if (!cameraOrtho) return;
  const w = window.innerWidth;
  const h = Math.max(1, window.innerHeight);
  const aspect = w / h;
  const margin = 6;
  const hx = PITCH_CONFIG.halfLength + margin;
  const hz = PITCH_CONFIG.halfWidth + margin;
  let left;
  let right;
  let top;
  let bottom;
  if (aspect >= hx / hz) {
    const halfZ = hz;
    const halfX = halfZ * aspect;
    left = -halfX;
    right = halfX;
    top = halfZ;
    bottom = -halfZ;
  } else {
    const halfX = hx;
    const halfZ = halfX / aspect;
    left = -halfX;
    right = halfX;
    top = halfZ;
    bottom = -halfZ;
  }
  cameraOrtho.left = left;
  cameraOrtho.right = right;
  cameraOrtho.top = top;
  cameraOrtho.bottom = bottom;
  cameraOrtho.updateProjectionMatrix();
}

function updateControlledLabelBillboard() {
  if (!controlledLabel || !controlledLabel.parent || !camera) return;
  controlledLabel.parent.getWorldQuaternion(tmpParentQuat);
  tmpLabelQuat.copy(tmpParentQuat).invert().multiply(camera.quaternion);
  controlledLabel.quaternion.copy(tmpLabelQuat);
}

function updateCamera(deltaTime) {
  if (!camera) return;

  if (cameraMode === 'TACTICAL') {
    if (!cameraOrtho || camera !== cameraOrtho) return;
    camera.position.set(0, 90, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    updateControlledLabelBillboard();
    applyCameraShake(deltaTime);
    return;
  }

  if (!cameraPersp || camera !== cameraPersp) return;
  if (!controlledPlayer) {
    applyCameraShake(deltaTime);
    return;
  }

  const lerp = GAME_CONFIG.cameraLerp;
  const p = controlledPlayer.position;

  if (cameraMode === 'BROADCAST') {
    const focal = gameBall ? gameBall.position : p;
    let fx = 0;
    let fz = 1;
    const bvx = ballVelocity.x;
    const bvz = ballVelocity.z;
    const bs = bvx * bvx + bvz * bvz;
    if (gameBall && bs > 0.08) {
      const inv = 1 / Math.sqrt(bs);
      fx = bvx * inv;
      fz = bvz * inv;
    } else {
      fx = Math.sin(controlledPlayer.rotation);
      fz = Math.cos(controlledPlayer.rotation);
    }
    const ang = THREE.MathUtils.degToRad(GAME_CONFIG.cameraAngleDeg);
    const back = GAME_CONFIG.cameraDistance * Math.cos(ang);
    const up = GAME_CONFIG.cameraHeight + GAME_CONFIG.cameraDistance * Math.sin(ang);
    const cx = focal.x - fx * back;
    const cz = focal.z - fz * back;
    const cy = focal.y + up;

    cameraTargetPos.set(cx, cy, cz);
    camera.position.lerp(cameraTargetPos, lerp);
    cameraLookTarget.copy(focal).add(new THREE.Vector3(0, 1.2, 0));
    camera.lookAt(cameraLookTarget);
    updateControlledLabelBillboard();
    applyCameraShake(deltaTime);
    return;
  }

  if (cameraMode === 'PLAYER_CAM') {
    const yaw = controlledPlayer.rotation + playerCamGamepadYaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const back = 15;
    const up = 8 + playerCamGamepadPitch * 5;
    const cx = p.x - fx * back;
    const cz = p.z - fz * back;
    const cy = p.y + up;

    cameraTargetPos.set(cx, cy, cz);
    camera.position.lerp(cameraTargetPos, lerp);
    cameraLookTarget.copy(p).add(new THREE.Vector3(0, 1.2, 0));
    camera.lookAt(cameraLookTarget);
    updateControlledLabelBillboard();
    applyCameraShake(deltaTime);
  }
}

// =============================================================================
// SELECTION INDICATOR & CONTROLLED NAME TAG
// =============================================================================

function drawControlledLabelCanvas(player) {
  const canvas = controlledLabelCanvas;
  if (!canvas || !player) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const teamName = player.teamIndex === 0 ? TEAMS.home.name : TEAMS.away.name;
  const text = `${teamName} #${player.slotIndex + 1}`;
  const w = 128;
  const h = 32;
  const r = 6;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, w, h, r);
  } else {
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
  }
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 14;
  ctx.font = `600 ${fontSize}px system-ui, "Segoe UI", sans-serif`;
  while (ctx.measureText(text).width > w - 12 && fontSize > 9) {
    fontSize -= 1;
    ctx.font = `600 ${fontSize}px system-ui, "Segoe UI", sans-serif`;
  }
  ctx.fillText(text, w * 0.5, h * 0.5);
  if (controlledLabelTexture) controlledLabelTexture.needsUpdate = true;
}

function createControlledNameLabel() {
  if (controlledLabel) return;
  controlledLabelCanvas = document.createElement('canvas');
  controlledLabelCanvas.width = 128;
  controlledLabelCanvas.height = 32;
  controlledLabelTexture = new THREE.CanvasTexture(controlledLabelCanvas);
  controlledLabelTexture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: controlledLabelTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  controlledLabel = new THREE.Sprite(mat);
  controlledLabel.scale.set(2.56, 0.64, 1);
  controlledLabel.center.set(0.5, 0.5);
  controlledLabel.renderOrder = 999;
}

function attachControlledLabelToPlayer(player) {
  createControlledNameLabel();
  if (!controlledLabel || !player?.mesh) return;
  if (controlledLabel.parent) controlledLabel.parent.remove(controlledLabel);
  drawControlledLabelCanvas(player);
  player.mesh.add(controlledLabel);
  controlledLabel.position.set(0, 2.4, 0);
}

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

function updateFulltimeStatsPanel() {
  if (!elFtPossH || !elFtPossA) return;
  if (elFtTeamHome) elFtTeamHome.textContent = TEAMS.home.name;
  if (elFtTeamAway) elFtTeamAway.textContent = TEAMS.away.name;

  const totTouches = touches[0] + touches[1];
  let possH = 50;
  let possA = 50;
  if (totTouches > 0) {
    possH = Math.round((touches[0] / totTouches) * 100);
    possA = 100 - possH;
  }
  elFtPossH.textContent = `${possH}%`;
  elFtPossA.textContent = `${possA}%`;

  if (elFtShotsH) elFtShotsH.textContent = String(shots[0]);
  if (elFtShotsA) elFtShotsA.textContent = String(shots[1]);
  if (elFtSotH) elFtSotH.textContent = String(shotsOnTarget[0]);
  if (elFtSotA) elFtSotA.textContent = String(shotsOnTarget[1]);
  if (elFtPassH) elFtPassH.textContent = String(passesCompleted[0]);
  if (elFtPassA) elFtPassA.textContent = String(passesCompleted[1]);
}

function updateUI(deltaTime) {
  if (
    gameState === GAME_STATE.PLAYING &&
    audioCtx &&
    crowdLoopGainNode &&
    gameBall
  ) {
    const halfL = PITCH_CONFIG.halfLength;
    const third = halfL * 0.6;
    const bz = Math.abs(gameBall.position.z);
    let target = 0.04;
    if (bz > third) {
      const span = halfL - third;
      const t = span > 1e-6 ? Math.min(1, (bz - third) / span) : 1;
      target = 0.04 + t * (0.12 - 0.04);
    }
    const now = audioCtx.currentTime;
    const rampEnd = now + 0.05;
    crowdLoopGainNode.gain.cancelScheduledValues(now);
    crowdLoopGainNode.gain.setValueAtTime(crowdLoopGainNode.gain.value, now);
    crowdLoopGainNode.gain.linearRampToValueAtTime(target, rampEnd);
  }

  if (elScoreboard) {
    elScoreboard.textContent = `${TEAMS.home.name} ${homeScore} - ${awayScore} ${TEAMS.away.name}`;
  }
  if (elMomentumFill) {
    const pct = (momentumScore + 1) / 2;
    const offset = (pct - 0.5) * 180;
    elMomentumFill.style.transform = `translateX(${offset}px)`;
  }
  if (elMomHome) {
    elMomHome.textContent = TEAMS.home.name.slice(0, 3).toUpperCase();
  }
  if (elMomAway) {
    elMomAway.textContent = TEAMS.away.name.slice(0, 3).toUpperCase();
  }
  scoreboard3dTimer += deltaTime;
  if (scoreboard3dTimer >= 1) {
    scoreboard3dTimer = 0;
    updateScoreboardTexture();
  }
  uiTimerAccum += deltaTime;
  if (uiTimerAccum >= 0.25) {
    uiTimerAccum = 0;
    if (elMatchTimer && gameState === GAME_STATE.PLAYING) {
      elMatchTimer.textContent = formatMatchClock(matchTimeSec);
      const inInjury =
        (currentHalf === 1 &&
          matchTimeSec > GAME_CONFIG.halfDurationSec) ||
        (currentHalf === 2 &&
          matchTimeSec > GAME_CONFIG.fullDurationSec);
      elMatchTimer.classList.toggle('injury-time', inInjury);
    }
  }
  if (elMatchTimer && gameState === GAME_STATE.PAUSED) {
    elMatchTimer.textContent = formatMatchClock(matchTimeSec);
    const inInjuryPause =
      (currentHalf === 1 &&
        matchTimeSec > GAME_CONFIG.halfDurationSec) ||
      (currentHalf === 2 &&
        matchTimeSec > GAME_CONFIG.fullDurationSec);
    elMatchTimer.classList.toggle('injury-time', inInjuryPause);
  }
  if (elMatchTimer && gameState === GAME_STATE.HALFTIME) {
    elMatchTimer.textContent = formatMatchClock(matchTimeSec);
    elMatchTimer.classList.remove('injury-time');
  }
  if (elMatchTimer && gameState === GAME_STATE.FULLTIME) {
    elMatchTimer.textContent = formatMatchClock(matchTimeSec);
    elMatchTimer.classList.remove('injury-time');
  }
  if (elMatchTimer && gameState === GAME_STATE.PENALTY) {
    elMatchTimer.textContent = 'PENS';
    elMatchTimer.classList.remove('injury-time');
  }

  if (elFreekickHint) {
    elFreekickHint.classList.toggle('visible', gameState === GAME_STATE.FREEKICK);
  }

  if (elPenaltyCrosshair && elPenaltyCrosshairDot) {
    const showCrosshair =
      gameState === GAME_STATE.PENALTY &&
      penaltyAwaitingKick &&
      penaltyIntroTimer <= 0 &&
      penaltyResolveTimer <= 0 &&
      penaltyRunTimer <= 0;
    elPenaltyCrosshair.classList.toggle('visible', showCrosshair);
    if (showCrosshair) {
      elPenaltyCrosshairDot.style.left = `${90 + penaltyAimX * 80}px`;
      elPenaltyCrosshairDot.style.bottom = `${6 + penaltyAimY * 76}px`;
    }
  }

  if (controlledPlayer && elStaminaFill) {
    const pct = controlledPlayer.stamina / PLAYER_CONFIG.staminaMax;
    elStaminaFill.style.transform = `scaleX(${Math.max(0.05, pct)})`;
  }
  if (elSubsHud) {
    elSubsHud.textContent = `SUBS: ${MAX_SUBS - subsMade}`;
  }

  const fatigueHud =
    gameState === GAME_STATE.PLAYING ||
    gameState === GAME_STATE.PAUSED ||
    gameState === GAME_STATE.FREEKICK ||
    gameState === GAME_STATE.GOAL_REPLAY ||
    gameState === GAME_STATE.SUBSTITUTION;
  if (elStaminaWrap) {
    const tired = fatigueHud && matchFatigueFactor < 0.88;
    elStaminaWrap.classList.toggle('fatigued', tired);
  }
  if (elStaminaLabel) {
    const tired = fatigueHud && matchFatigueFactor < 0.88;
    elStaminaLabel.textContent = tired ? 'Tired' : 'Stamina';
  }

  if (elShotBar) {
    if (shotCharging) {
      elShotBar.style.transform = `scaleX(${shotChargePct})`;
    } else {
      elShotBar.style.transform = 'scaleX(0)';
    }
  }

  if (goalPopupTimer > 0) {
    goalPopupTimer -= deltaTime;
    if (goalPopupTimer <= 0 && elGoalPopup) elGoalPopup.classList.remove('show');
  }

  if (offsidePopupTimer > 0) {
    offsidePopupTimer -= deltaTime;
    if (offsidePopupTimer <= 0 && elOffsidePopup) {
      elOffsidePopup.classList.remove('show');
    }
  }

  if (cardPopupTimer > 0) {
    cardPopupTimer -= deltaTime;
    if (cardPopupTimer <= 0 && elCardPopup) {
      elCardPopup.classList.remove('show');
    }
  }

  if (gameState === GAME_STATE.FULLTIME) {
    updateFulltimeStatsPanel();
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
  const smax = PLAYER_CONFIG.staminaMax;
  for (const p of players) {
    const { rx, ry } = worldToRadar(p.position.x, p.position.z);
    const s = p.stamina;
    let fill;
    if (s > 60) {
      fill = p.teamIndex === userTeam ? '#4ade80' : '#f87171';
    } else if (s >= 30) {
      fill = '#facc15';
    } else {
      fill = '#f97316';
    }
    const t = THREE.MathUtils.clamp(s / smax, 0, 1);
    const dotR = 2 + t;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(rx, ry, dotR, 0, Math.PI * 2);
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

function setupMobileControls() {
  if (!('ontouchstart' in window)) return;

  const zone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  const passBtn = document.getElementById('btn-mobile-pass');
  const shootBtn = document.getElementById('btn-mobile-shoot');
  const sprintBtn = document.getElementById('btn-mobile-sprint');

  const maxR = 50;
  const deadR = 8;

  function updateJoystick(clientX, clientY) {
    if (!zone || !knob) return;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len < deadR) {
      touchMoveDir.set(0, 0);
      knob.style.transform = 'translate(0, 0)';
      return;
    }
    const clampedLen = Math.min(len, maxR);
    dx = (dx / len) * clampedLen;
    dy = (dy / len) * clampedLen;
    const nlen = Math.hypot(dx, dy);
    if (nlen < 1e-6) {
      touchMoveDir.set(0, 0);
      knob.style.transform = 'translate(0, 0)';
      return;
    }
    touchMoveDir.set(dx / nlen, dy / nlen);
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function resetJoystick(tid) {
    if (joystickActiveTouchId !== tid) return;
    joystickActiveTouchId = null;
    touchMoveDir.set(0, 0);
    if (knob) knob.style.transform = 'translate(0, 0)';
  }

  if (zone) {
    zone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (!t) return;
        joystickActiveTouchId = t.identifier;
        updateJoystick(t.clientX, t.clientY);
      },
      { passive: false }
    );
    zone.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i += 1) {
          const t = e.changedTouches[i];
          if (t.identifier === joystickActiveTouchId) {
            updateJoystick(t.clientX, t.clientY);
            break;
          }
        }
      },
      { passive: false }
    );
  }

  function onGlobalTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      resetJoystick(e.changedTouches[i].identifier);
    }
  }
  window.addEventListener('touchend', onGlobalTouchEnd);
  window.addEventListener('touchcancel', onGlobalTouchEnd);

  if (passBtn) {
    passBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        keySpacePressed = true;
      },
      { passive: false }
    );
  }

  if (shootBtn) {
    shootBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const canShoot =
          gameState === GAME_STATE.PLAYING &&
          controlledPlayer &&
          controlledPlayer.hasBall &&
          ballOwner === controlledPlayer;
        const canFreekick =
          gameState === GAME_STATE.FREEKICK && freekickData.shooter;
        if (canShoot || canFreekick) {
          shotCharging = true;
          shotChargePct = 0;
          touchShootHeld = true;
        } else {
          keyEPressed = true;
        }
      },
      { passive: false }
    );
    const endShoot = (e) => {
      e.preventDefault();
      touchShootHeld = false;
      if (shotCharging) {
        if (gameState === GAME_STATE.FREEKICK) {
          executeFreekickShot(shotChargePct);
        } else if (
          gameState === GAME_STATE.PLAYING &&
          controlledPlayer &&
          controlledPlayer.hasBall &&
          ballOwner === controlledPlayer
        ) {
          performShoot(controlledPlayer, shotChargePct);
        }
        shotCharging = false;
        shotChargePct = 0;
        if (elShotBar) elShotBar.style.transform = 'scaleX(0)';
      }
    };
    shootBtn.addEventListener('touchend', endShoot, { passive: false });
    shootBtn.addEventListener('touchcancel', endShoot, { passive: false });
  }

  if (sprintBtn) {
    sprintBtn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        keys.ShiftLeft = true;
      },
      { passive: false }
    );
    const endSprint = (e) => {
      e.preventDefault();
      keys.ShiftLeft = false;
    };
    sprintBtn.addEventListener('touchend', endSprint, { passive: false });
    sprintBtn.addEventListener('touchcancel', endSprint, { passive: false });
  }
}

function setupUIListeners() {
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.diff;
      if (!key || !DIFFICULTY[key]) return;
      document.querySelectorAll('.diff-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.diff === key);
      });
      activeDifficulty = DIFFICULTY[key];
      applyActiveDifficulty();
    });
  });

  window.addEventListener('keydown', (e) => {
    if ('ontouchstart' in window) {
      document.documentElement.classList.add('hide-mobile-controls');
    }
    if (e.code === 'KeyE' && gameState === GAME_STATE.FREEKICK) {
      if (!e.repeat) {
        shotCharging = true;
        shotChargePct = 0;
      }
    } else if (e.code === 'KeyE' && gameState === GAME_STATE.PLAYING) {
      const canShoot =
        controlledPlayer &&
        controlledPlayer.hasBall &&
        ballOwner === controlledPlayer;
      if (canShoot) {
        if (!e.repeat) {
          shotCharging = true;
          shotChargePct = 0;
        }
      } else if (!e.repeat) {
        keyEPressed = true;
      }
    }
    if (e.code === 'KeyX' && !e.repeat) keys.KeyX = true;
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Space') keySpacePressed = true;
    if (e.code === 'KeyQ') keyQPressed = true;
    if (e.code === 'Tab') {
      e.preventDefault();
      if (gameState === GAME_STATE.PLAYING) {
        if (subsMade >= MAX_SUBS) {
          showCommentary('No substitutions remaining', 1);
        } else {
          setState(GAME_STATE.SUBSTITUTION);
        }
      }
    }
    if (e.code === 'KeyC') {
      if (
        gameState === GAME_STATE.PLAYING ||
        gameState === GAME_STATE.PAUSED
      ) {
        const order = ['BROADCAST', 'PLAYER_CAM', 'TACTICAL'];
        const i = order.indexOf(cameraMode);
        cameraMode = order[(i + 1) % order.length];
        if (cameraMode === 'TACTICAL') {
          camera = cameraOrtho;
          updateTacticalOrthoFrustum();
        } else {
          camera = cameraPersp;
        }
      }
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (gameState === GAME_STATE.SUBSTITUTION) {
        cancelSubstitution();
      } else if (gameState === GAME_STATE.PLAYING) {
        setState(GAME_STATE.PAUSED);
      } else if (gameState === GAME_STATE.PAUSED) {
        setState(GAME_STATE.PLAYING);
      }
    }
    if (e.code === 'KeyF' && !e.repeat) {
      toggleFullscreen();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyX') keys.KeyX = false;
    if (e.code === 'KeyE') {
      if (shotCharging) {
        if (gameState === GAME_STATE.FREEKICK) {
          executeFreekickShot(shotChargePct);
        } else if (
          gameState === GAME_STATE.PLAYING &&
          controlledPlayer &&
          controlledPlayer.hasBall &&
          ballOwner === controlledPlayer
        ) {
          performShoot(controlledPlayer, shotChargePct);
        }
        shotCharging = false;
        shotChargePct = 0;
        if (elShotBar) elShotBar.style.transform = 'scaleX(0)';
      }
    }
    keys[e.code] = false;
  });

  document.getElementById('btn-quick-match')?.addEventListener('click', () => {
    resetTeamsToDefault();
    activeFormation = '4-3-3';
    weatherMode = 'clear';
    document.querySelectorAll('.weather-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.weather === 'clear');
    });
    startMatch();
  });
  document.getElementById('btn-custom-match')?.addEventListener('click', () => {
    elMainMenu?.classList.add('show-custom');
  });
  document.getElementById('btn-kick-off-custom')?.addEventListener('click', () => {
    const homeSel = document.getElementById('select-team-home');
    const awaySel = document.getElementById('select-team-away');
    const formSel = document.getElementById('select-formation');
    if (homeSel?.value) applyTeamPreset('home', homeSel.value);
    if (awaySel?.value) applyTeamPreset('away', awaySel.value);
    const fk = formSel?.value;
    if (fk && FORMATIONS[fk]) activeFormation = fk;
    elMainMenu?.classList.remove('show-custom');
    startMatch();
  });
  document.getElementById('btn-custom-back')?.addEventListener('click', () => {
    elMainMenu?.classList.remove('show-custom');
  });

  document.querySelectorAll('.weather-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.weather;
      if (w !== 'clear' && w !== 'rain') return;
      weatherMode = w;
      document.querySelectorAll('.weather-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.weather === weatherMode);
      });
    });
  });

  document.getElementById('sub-list')?.addEventListener('click', (e) => {
    const row = e.target.closest('.sub-player-row');
    if (!row || gameState !== GAME_STATE.SUBSTITUTION) return;
    const slot = parseInt(row.dataset.slot, 10);
    const pl = players.find(
      (p) => p.teamIndex === GAME_CONFIG.userTeamIndex && p.slotIndex === slot
    );
    if (!pl || pl.role === 'gk') return;
    if (subPanelPhase === 'off') {
      subPlayerOut = pl;
      subPanelPhase = 'on';
      subPlayerIn = null;
      renderSubPanelList();
    } else if (subPanelPhase === 'on') {
      subPlayerIn = pl;
      renderSubPanelList();
    }
  });
  document.getElementById('sub-confirm')?.addEventListener('click', () => {
    if (
      gameState === GAME_STATE.SUBSTITUTION &&
      subPlayerOut &&
      subPlayerIn &&
      subPlayerOut !== subPlayerIn
    ) {
      performSubstitution(subPlayerOut, subPlayerIn);
    }
  });
  document.getElementById('sub-cancel')?.addEventListener('click', () => {
    if (gameState === GAME_STATE.SUBSTITUTION) cancelSubstitution();
  });

  document.getElementById('btn-resume')?.addEventListener('click', () => setState(GAME_STATE.PLAYING));
  document.getElementById('btn-pause-main')?.addEventListener('click', () => setState(GAME_STATE.MENU));

  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-fullscreen');
    if (btn) {
      btn.textContent = document.fullscreenElement
        ? '✕ Exit Fullscreen'
        : '⛶ Fullscreen';
    }
    onResize();
  });

  document.getElementById('btn-screenshot')?.addEventListener('click', () => {
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    const link = document.createElement('a');
    link.download = `goal-${Date.now()}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
    showCommentary('Screenshot saved!', 0);
  });
  document.getElementById('btn-continue-half')?.addEventListener('click', () => {
    beginSecondHalf();
    setState(GAME_STATE.PLAYING);
  });
  document.getElementById('btn-play-again')?.addEventListener('click', () => {
    setState(GAME_STATE.MENU);
  });

  if ('ontouchstart' in window) {
    document.documentElement.classList.add('has-touch');
  }
  setupMobileControls();

  window.addEventListener('gamepadconnected', () => {
    showCommentary('Controller connected.', 0);
  });

  window.addEventListener('keydown', (e) => {
    if (gameState === GAME_STATE.HALFTIME && e.code === 'Space') {
      e.preventDefault();
      beginSecondHalf();
      setState(GAME_STATE.PLAYING);
    }
    if (gameState === GAME_STATE.PENALTY && e.code === 'Space') {
      e.preventDefault();
    }
    if (
      gameState === GAME_STATE.PENALTY &&
      penaltyAwaitingKick &&
      penaltyIntroTimer <= 0 &&
      penaltyResolveTimer <= 0 &&
      penaltyRunTimer <= 0 &&
      (e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown')
    ) {
      e.preventDefault();
    }
    if (
      gameState === GAME_STATE.FREEKICK &&
      (e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown')
    ) {
      e.preventDefault();
    }
  });

  document
    .getElementById('select-team-home')
    ?.addEventListener('change', updateCustomMatchTeamRatingCard);
  document
    .getElementById('select-team-away')
    ?.addEventListener('change', updateCustomMatchTeamRatingCard);
  updateCustomMatchTeamRatingCard();
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
  elOffsidePopup = document.getElementById('offside-popup');
  elSetPiecePopup = document.getElementById('set-piece-popup');
  elSetPieceText = document.getElementById('set-piece-text');
  elCardPopup = document.getElementById('card-popup');
  elCardPopupNumber = document.getElementById('card-popup-number');
  minimapCanvas = document.getElementById('minimap-canvas');
  minimapCtx = minimapCanvas?.getContext('2d') || null;
  elShotBar = document.getElementById('shot-bar');
  elFreekickHint = document.getElementById('freekick-hint');
  elPenaltyHud = document.getElementById('penalty-hud');
  elPenaltyHudLabelHome = document.getElementById('penalty-hud-label-home');
  elPenaltyHudLabelAway = document.getElementById('penalty-hud-label-away');
  elPenaltyHudHome = document.getElementById('penalty-hud-home');
  elPenaltyHudAway = document.getElementById('penalty-hud-away');
  elPenaltySaved = document.getElementById('penalty-saved');
  elPenaltyCrosshair = document.getElementById('penalty-crosshair');
  elPenaltyCrosshairDot = document.getElementById('penalty-crosshair-dot');
  elFtTeamHome = document.getElementById('ft-team-home');
  elFtTeamAway = document.getElementById('ft-team-away');
  elFtPossH = document.getElementById('ft-poss-h');
  elFtPossA = document.getElementById('ft-poss-a');
  elFtShotsH = document.getElementById('ft-shots-h');
  elFtShotsA = document.getElementById('ft-shots-a');
  elFtSotH = document.getElementById('ft-sot-h');
  elFtSotA = document.getElementById('ft-sot-a');
  elFtPassH = document.getElementById('ft-pass-h');
  elFtPassA = document.getElementById('ft-pass-a');
  elCommentaryBar = document.getElementById('commentary-bar');
  elCommentaryText = document.getElementById('commentary-text');
  elStaminaWrap = document.getElementById('stamina-wrap');
  elStaminaLabel = document.getElementById('stamina-label');
  elSubPanel = document.getElementById('sub-panel');
  elSubsHud = document.getElementById('subs-hud');
  elMomentumFill = document.getElementById('momentum-fill');
  elMomHome = document.querySelector('#momentum-bar-wrap .mom-team.home-abbr');
  elMomAway = document.querySelector('#momentum-bar-wrap .mom-team.away-abbr');
  elHatTrickOverlay = document.getElementById('hat-trick-overlay');
}

function onResize() {
  if (!renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (cameraPersp) {
    cameraPersp.aspect = w / Math.max(1, h);
    cameraPersp.updateProjectionMatrix();
  }
  if (cameraOrtho) {
    updateTacticalOrthoFrustum();
  }
  renderer.setSize(w, h);
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

function readGamepad(deltaTime) {
  gamepadSprint = false;
  gamepadShield = false;
  gamepadYHeld = false;
  gamepadFkUp = false;
  gamepadFkDown = false;
  gamepadFkLeft = false;
  gamepadFkRight = false;
  gamepadMoveDir.set(0, 0);

  const gp = navigator.getGamepads?.()?.[0];
  if (!gp || !gp.connected) {
    playerCamGamepadYaw = 0;
    playerCamGamepadPitch = 0;
    for (let i = 0; i < gamepadPrev.length; i += 1) {
      gamepadPrev[i] = false;
    }
    return;
  }

  const pressed = (i) => !!gp.buttons[i]?.pressed;

  const ax = Math.abs(gp.axes[0] ?? 0) > 0.15 ? gp.axes[0] : 0;
  const ay = Math.abs(gp.axes[1] ?? 0) > 0.15 ? gp.axes[1] : 0;
  gamepadMoveDir.set(ax, ay);

  const userFkTaker =
    gameState === GAME_STATE.FREEKICK &&
    freekickData.shooter &&
    freekickData.shooter.teamIndex === GAME_CONFIG.userTeamIndex;

  if (userFkTaker) {
    gamepadFkUp = pressed(12);
    gamepadFkDown = pressed(13);
    gamepadFkLeft = pressed(14);
    gamepadFkRight = pressed(15);
  }

  const canShootPlay =
    gameState === GAME_STATE.PLAYING &&
    controlledPlayer &&
    controlledPlayer.hasBall &&
    ballOwner === controlledPlayer;
  const canFreekickShot =
    gameState === GAME_STATE.FREEKICK && !!freekickData.shooter;

  if (pressed(3) && (canShootPlay || canFreekickShot)) {
    gamepadYHeld = true;
  }

  if (pressed(3) && !gamepadPrev[3]) {
    if (canFreekickShot) {
      shotCharging = true;
      shotChargePct = 0;
    } else if (canShootPlay) {
      shotCharging = true;
      shotChargePct = 0;
    }
  }

  if (
    gamepadPrev[3] &&
    !pressed(3) &&
    shotCharging &&
    !keys.KeyE &&
    !touchShootHeld
  ) {
    if (gameState === GAME_STATE.FREEKICK) {
      executeFreekickShot(shotChargePct);
    } else if (
      gameState === GAME_STATE.PLAYING &&
      controlledPlayer &&
      controlledPlayer.hasBall &&
      ballOwner === controlledPlayer
    ) {
      performShoot(controlledPlayer, shotChargePct);
    }
    shotCharging = false;
    shotChargePct = 0;
    if (elShotBar) elShotBar.style.transform = 'scaleX(0)';
  }

  if (pressed(0) && !gamepadPrev[0]) {
    if (gameState === GAME_STATE.HALFTIME) {
      beginSecondHalf();
      setState(GAME_STATE.PLAYING);
    } else if (
      gameState === GAME_STATE.PENALTY &&
      penaltyAwaitingKick &&
      penaltyIntroTimer <= 0 &&
      penaltyResolveTimer <= 0 &&
      penaltyRunTimer <= 0 &&
      penaltyTeam === GAME_CONFIG.userTeamIndex
    ) {
      keySpacePressed = true;
    } else if (gameState === GAME_STATE.PLAYING) {
      keySpacePressed = true;
    }
  }

  if (pressed(1) && !gamepadPrev[1]) {
    if (gameState === GAME_STATE.PLAYING && controlledPlayer) {
      const has =
        controlledPlayer.hasBall && ballOwner === controlledPlayer;
      if (!has) {
        keyEPressed = true;
      }
    }
  }

  if (pressed(2) && !gamepadPrev[2]) {
    keyQPressed = true;
  }

  if (pressed(9) && !gamepadPrev[9]) {
    if (gameState === GAME_STATE.PLAYING) {
      setState(GAME_STATE.PAUSED);
    } else if (gameState === GAME_STATE.PAUSED) {
      setState(GAME_STATE.PLAYING);
    }
  }

  gamepadSprint = pressed(4);
  gamepadShield = pressed(5);

  if (cameraMode === 'PLAYER_CAM') {
    const rax =
      Math.abs(gp.axes[2] ?? 0) > 0.15 ? gp.axes[2] : 0;
    const ray =
      Math.abs(gp.axes[3] ?? 0) > 0.15 ? gp.axes[3] : 0;
    playerCamGamepadYaw += rax * 2.8 * deltaTime;
    playerCamGamepadYaw = THREE.MathUtils.clamp(
      playerCamGamepadYaw,
      -1.55,
      1.55
    );
    playerCamGamepadPitch += ray * 1.6 * deltaTime;
    playerCamGamepadPitch = THREE.MathUtils.clamp(
      playerCamGamepadPitch,
      -0.65,
      0.65
    );
  } else {
    playerCamGamepadYaw = 0;
    playerCamGamepadPitch = 0;
  }

  const n = Math.min(gamepadPrev.length, gp.buttons.length);
  for (let i = 0; i < n; i += 1) {
    gamepadPrev[i] = !!gp.buttons[i]?.pressed;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.1);
  readGamepad(deltaTime);

  if (gameState === GAME_STATE.PLAYING) {
    if (restartInProgress) {
      restartTimer -= deltaTime;
      if (restartTimer <= 0) {
        restartInProgress = false;
        if (elSetPiecePopup) elSetPiecePopup.classList.remove('show');
      }
    }
    updatePlayerMovement(deltaTime);
    updateBallPhysics(deltaTime);
    checkBallControl(deltaTime);
    checkGoals();
    if (gameState === GAME_STATE.PLAYING) {
      checkNearMissShots(deltaTime);
      updateAI(deltaTime);
      updateAllPlayers(deltaTime);
      updateMatchTime(deltaTime);
      updateCamera(deltaTime);
      updateSelectionIndicator();
      updateUI(deltaTime);
      if (postShake.timer > 0 && postShake.group) {
        postShake.timer -= deltaTime;
        const t = postShake.timer;
        const shake =
          Math.sin(t * 60) * postShake.intensity * t * 3;
        postShake.group.position.x = shake;
        if (postShake.timer <= 0) {
          postShake.group.position.x = 0;
          postShake.group = null;
        }
      }
    }
  } else if (gameState === GAME_STATE.PAUSED) {
    updateCamera(deltaTime);
    updateUI(deltaTime);
  } else if (gameState === GAME_STATE.HALFTIME || gameState === GAME_STATE.FULLTIME) {
    updateUI(deltaTime);
  } else if (gameState === GAME_STATE.FREEKICK) {
    updateBallPhysics(deltaTime);
    const userFkTaker =
      freekickData.shooter &&
      freekickData.shooter.teamIndex === GAME_CONFIG.userTeamIndex;
    if (userFkTaker) {
      if (
        shotCharging &&
        (keys.KeyE || touchShootHeld || gamepadYHeld) &&
        freekickData.shooter
      ) {
        shotChargePct = Math.min(
          1,
          shotChargePct + deltaTime / GAME_CONFIG.shotChargeDuration
        );
      }
      if (keys.ArrowRight || gamepadFkRight) {
        freekickData.targetX = Math.min(6, freekickData.targetX + 0.5);
      }
      if (keys.ArrowLeft || gamepadFkLeft) {
        freekickData.targetX = Math.max(-6, freekickData.targetX - 0.5);
      }
      if (keys.ArrowUp || gamepadFkUp) {
        freekickData.power = Math.min(1, freekickData.power + 0.35 * deltaTime);
      }
      if (keys.ArrowDown || gamepadFkDown) {
        freekickData.power = Math.max(0.3, freekickData.power - 0.35 * deltaTime);
      }
      updateFreekickArrow();
    } else if (
      freekickData.shooter &&
      freekickData.shooter.teamIndex !== GAME_CONFIG.userTeamIndex &&
      freekickData.aiDelay != null
    ) {
      freekickData.aiDelay -= deltaTime;
      if (freekickData.aiDelay <= 0) {
        freekickData.targetX = (Math.random() - 0.5) * 4;
        freekickData.power = 0.65 + Math.random() * 0.35;
        executeFreekickShot(1);
      }
    }
    updateCamera(deltaTime);
    updateSelectionIndicator();
    updateUI(deltaTime);
  } else if (gameState === GAME_STATE.PENALTY) {
    if (penaltyIntroTimer > 0) {
      penaltyIntroTimer -= deltaTime;
      if (penaltyIntroTimer <= 0) {
        penaltyIntroTimer = 0;
        if (elSetPiecePopup) elSetPiecePopup.classList.remove('show');
        penaltyAwaitingKick = true;
        aiPenaltyTimer = null;
      }
    }
    if (penaltyResolveTimer > 0) {
      penaltyResolveTimer -= deltaTime;
      if (penaltyResolveTimer <= 0) {
        penaltyResolveTimer = 0;
        positionPlayersForPenaltyKick();
        penaltyAwaitingKick = true;
        aiPenaltyTimer = null;
      }
    }
    if (penaltySavedTimer > 0) {
      penaltySavedTimer -= deltaTime;
      if (penaltySavedTimer <= 0 && elPenaltySaved) {
        elPenaltySaved.classList.remove('show');
      }
    }
    const penaltyIdle =
      penaltyAwaitingKick &&
      penaltyIntroTimer <= 0 &&
      penaltyResolveTimer <= 0 &&
      penaltyRunTimer <= 0;

    if (
      penaltyIdle &&
      penaltyTeam !== GAME_CONFIG.userTeamIndex
    ) {
      if (aiPenaltyTimer == null) {
        aiPenaltyTimer = 1.2;
        showCommentary('CPU taking penalty…', 0);
      } else {
        aiPenaltyTimer -= deltaTime;
        if (aiPenaltyTimer <= 0) {
          penaltyAimX = (Math.random() - 0.5) * 1.6;
          penaltyAimY = Math.random() * 0.8;
          keySpacePressed = true;
          aiPenaltyTimer = null;
        }
      }
    } else {
      aiPenaltyTimer = null;
    }

    if (penaltyIdle && penaltyTeam === GAME_CONFIG.userTeamIndex) {
      if (keys.ArrowLeft) {
        penaltyAimX = Math.max(-1, penaltyAimX - 1.5 * deltaTime);
      }
      if (keys.ArrowRight) {
        penaltyAimX = Math.min(1, penaltyAimX + 1.5 * deltaTime);
      }
      if (keys.ArrowUp) {
        penaltyAimY = Math.min(1, penaltyAimY + 1.2 * deltaTime);
      }
      if (keys.ArrowDown) {
        penaltyAimY = Math.max(0, penaltyAimY - 1.2 * deltaTime);
      }
    }
    if (
      keySpacePressed &&
      penaltyAwaitingKick &&
      penaltyIntroTimer <= 0 &&
      penaltyResolveTimer <= 0 &&
      penaltyRunTimer <= 0
    ) {
      keySpacePressed = false;
      penaltyAwaitingKick = false;
      if (penaltyStriker) {
        penaltyKickStartPos.copy(penaltyStriker.position);
        const gz = getAttackingGoalZ(penaltyTeam);
        const z = penaltyStriker.position.z;
        penaltyKickEndPos.set(0, 0, THREE.MathUtils.lerp(z, gz, 0.94));
        penaltyRunTimer = 2;
      }
    }
    if (penaltyRunTimer > 0) {
      penaltyRunTimer -= deltaTime;
      const u = THREE.MathUtils.clamp(
        (2 - Math.max(0, penaltyRunTimer)) / 2,
        0,
        1
      );
      if (penaltyStriker) {
        penaltyStriker.position.lerpVectors(
          penaltyKickStartPos,
          penaltyKickEndPos,
          u
        );
        penaltyStriker.position.y = 0;
        const ez = getAttackingGoalZ(penaltyTeam);
        const face = ez - penaltyStriker.position.z;
        penaltyStriker.rotation = Math.atan2(0, face);
        penaltyStriker.mesh.rotation.y = penaltyStriker.rotation;
      }
      if (penaltyRunTimer <= 0) {
        penaltyRunTimer = 0;
        penaltyShoot();
      }
    }
    if (penaltyRunTimer <= 0) {
      updateBallPhysics(deltaTime);
    }
    updateCamera(deltaTime);
    updateUI(deltaTime);
  } else if (gameState === GAME_STATE.GOAL_REPLAY) {
    goalReplayTimer -= deltaTime * 0.4;
    const angle = (3 - goalReplayTimer) * 1.2;
    const radius = 14;
    camera.position.set(
      goalReplayPos.x + Math.sin(angle) * radius,
      goalReplayPos.y + 6,
      goalReplayPos.z + Math.cos(angle) * radius
    );
    camera.lookAt(goalReplayPos);
    applyCameraShake(deltaTime);
    if (celebratingPlayer && celebrationTimer > 0) {
      celebrationTimer -= deltaTime * 0.4;
      const t = celebrationTimer;
      const bounce = Math.abs(Math.sin(t * 8)) * 0.4;
      celebratingPlayer.mesh.position.y = bounce;
      celebratingPlayer.mesh.rotation.y += deltaTime * 3;
    }
    if (
      celebrationRunners.length > 0 &&
      celebratingPlayer &&
      celebrationTimer > 0
    ) {
      const step = 3 * deltaTime * 0.4;
      const tx = celebratingPlayer.position.x;
      const tz = celebratingPlayer.position.z;
      for (const pl of celebrationRunners) {
        const dx = tx - pl.position.x;
        const dz = tz - pl.position.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.05) {
          pl.position.x += (dx / len) * step;
          pl.position.z += (dz / len) * step;
        }
      }
    }
    updateUI(deltaTime);
    updateControlledLabelBillboard();
    if (goalReplayTimer <= 0) {
      setState(GAME_STATE.PLAYING);
    }
  } else if (gameState === GAME_STATE.SUBSTITUTION) {
    updateCamera(deltaTime);
    updateUI(deltaTime);
  }

  if (rainSystem && rainSystem.visible) {
    updateRain(deltaTime);
  }

  if (homeNetDeform.active || awayNetDeform.active) {
    updateNetDeform(deltaTime);
  }

  updateBallTrail(deltaTime);

  if (cornerFlagMeshes.length && clock) {
    updateCornerFlags(clock.getElapsedTime());
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

// =============================================================================
// INIT
// =============================================================================

async function initGame() {
  cacheDom();
  updateHistoryPanel();
  initAudio();
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  clock = new THREE.Clock();
  scene = new THREE.Scene();

  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  cameraPersp = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);
  cameraPersp.position.set(0, 40, 60);

  cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  updateTacticalOrthoFrustum();

  cameraMode = 'BROADCAST';
  camera = cameraPersp;

  renderer = setupRenderer(canvas);
  window.addEventListener('resize', onResize);

  setupLighting();
  createPitch();
  createCornerFlags();
  createStadiumEnvironment();
  createScoreboard();
  createGoal(-1);
  createGoal(1);
  gameBall = createBall();
  ballShadow = createBallShadow();
  initBallTrail();
  setupTeams();
  createSelectionIndicator();
  applyActiveDifficulty();
  setupUIListeners();

  runLoadingSequence(() => {
    setState(GAME_STATE.MENU);
  });

  animate();
}

document.addEventListener('DOMContentLoaded', initGame);
