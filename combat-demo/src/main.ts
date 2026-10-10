import * as T from "three";
import {
  Battle,
  threatTime,
  type CombatEvent,
  type FlightInput,
} from "./simulation";
import { TUNING as C } from "./config";
import { ShipAssembler } from "./assembler";
import "./style.css";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<div id="hud"><div class="top"><div><div class="brand">HYPER SPACE COMBAT</div><div class="sub">AEGIS / LIVE COMBAT TRIAL · V0.1</div></div><div id="clock">00:00</div></div><div class="target enemy"><div id="target-label">HOSTILE · NO LOCK</div><div class="bar"><div id="target-hp" class="fill"></div></div><div id="range"></div></div><div class="bb" id="bb"></div><div class="bottom"><div id="hull"></div><div class="bar"><div id="hull-hp" class="fill"></div></div><div id="energy-label"></div><div class="bar"><div id="energy" class="fill"></div></div><div class="sub" id="systems"></div></div><div class="weapons"><div class="weapon" id="w1"></div><div class="weapon" id="w2"></div><div class="weapon" id="w3"></div></div><div class="reticle" id="reticle"></div><div class="marker" id="marker"><span id="marker-label">HOSTILE</span></div><div class="lead" id="lead"></div><div class="warning" id="warning"></div><div class="hint">TAB LOCK · 1 / 2 / 3 WEAPONS · SHIFT QUICK BOOST · ESC PAUSE</div></div><div class="overlay" id="overlay"><div class="panel"><h1 id="title">HYPER SPACE</h1><div class="sub">ONE SHIP. ONE ADVERSARY. YOU HAVE FIRE CONTROL.</div><p id="description">Outmaneuver guided salvos. BB predicts threats and deploys small gravity interception fields. Keep energy for your next boost.</p><div class="controls"><div>WASD · move / strafe<br>SPACE / CTRL · rise / descend<br>Q / E · roll · SHIFT · boost</div><div>1 · locked missiles<br>2 · hull-aim spinal cannon<br>3 · camera-aim turrets</div><div>MOUSE · aim · LMB · fire<br>TAB · select and lock target</div><div>RMB + MOUSE · turn hull in 1/3<br>ESC · pause · R · rematch</div></div><button id="play">ENGAGE</button></div></div>`;
const el = (id: string) => document.getElementById(id)!;
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setClearColor(0x030913);
app.prepend(renderer.domElement);
const scene = new T.Scene();
scene.fog = new T.FogExp2(0x030913, 0.00012);
scene.add(new T.HemisphereLight(0x99d9ff, 0x152435, 2.4));
const sun = new T.DirectionalLight(0xd3ecff, 3.4);
sun.position.set(300, 500, 200);
scene.add(sun);
const rim = new T.DirectionalLight(0x4778ff, 2);
rim.position.set(-200, -100, -400);
scene.add(rim);
const camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 1, 15000);
let seed = 1234;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const stars = new Float32Array(6000 * 3);
for (let i = 0; i < stars.length; i += 3) {
  const v = new T.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)
    .normalize()
    .multiplyScalar(2200 + rand() * 5000);
  stars.set(v.toArray(), i);
}
const starGeo = new T.BufferGeometry();
starGeo.setAttribute("position", new T.BufferAttribute(stars, 3));
scene.add(
  new T.Points(
    starGeo,
    new T.PointsMaterial({ color: 0x91b9d8, size: 2, sizeAttenuation: true }),
  ),
);
// Distant geometric landmarks give translational motion a frame of reference.
const ring = new T.Mesh(
  new T.TorusGeometry(800, 3, 6, 100),
  new T.MeshBasicMaterial({ color: 0x21364f }),
);
ring.position.set(-1000, 300, -1800);
ring.rotation.y = 0.6;
scene.add(ring);
let battle = new Battle(),
  models: ShipAssembler[] = [];
const projectileMeshes = new Map<number, T.Object3D>(),
  trails = new Map<number, { line: T.Line; points: T.Vector3[] }>(),
  fieldMeshes = new Map<number, T.Mesh>();
const missileGeometry = new T.ConeGeometry(1.1, 5, 6);
missileGeometry.rotateX(-Math.PI / 2);
const bulletGeometry = new T.BoxGeometry(0.8, 0.8, 9);
const fieldGeometry = new T.IcosahedronGeometry(C.defense.radius, 2);
const blue = new T.MeshBasicMaterial({ color: 0x8aefff }),
  red = new T.MeshBasicMaterial({ color: 0xff7650 });
interface Effect {
  mesh: T.Mesh;
  velocity: T.Vector3;
  life: number;
  max: number;
  scale: number;
}
let effects: Effect[] = [];
const effectGeometry = new T.IcosahedronGeometry(1, 0);
let scars: T.Mesh[] = [];
function reset() {
  for (const m of models) {
    scene.remove(m.group);
    m.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      } else if (o instanceof T.LineSegments) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
  }
  for (const m of projectileMeshes.values()) scene.remove(m);
  projectileMeshes.clear();
  for (const t of trails.values()) {
    scene.remove(t.line);
    t.line.geometry.dispose();
    (t.line.material as T.Material).dispose();
  }
  trails.clear();
  for (const m of fieldMeshes.values()) {
    scene.remove(m);
    (m.material as T.Material).dispose();
  }
  fieldMeshes.clear();
  for (const e of effects) {
    scene.remove(e.mesh);
    (e.mesh.material as T.Material).dispose();
  }
  effects = [];
  scars = [];
  battle = new Battle();
  models = battle.ships.map((s) => new ShipAssembler(s));
  models.forEach((m) => scene.add(m.group));
  keys.clear();
  mouseX = mouseY = pendingPitch = pendingYaw = 0;
  left = right = boost = false;
  cameraQ.identity();
  camera.position.copy(battle.ships[0].position).add(new T.Vector3(0, 38, 110));
}
const keys = new Set<string>();
let left = false,
  right = false,
  boost = false,
  paused = true,
  started = false,
  mouseX = 0,
  mouseY = 0,
  pendingPitch = 0,
  pendingYaw = 0,
  shake = 0;
const cameraQ = new T.Quaternion();
let audio: AudioContext | undefined;
function sound(kind: string) {
  if (!audio) return;
  const osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.type = kind === "hit" ? "sawtooth" : "triangle";
  osc.frequency.setValueAtTime(
    kind === "shot" ? 140 : kind === "hit" ? 60 : 430,
    audio.currentTime,
  );
  osc.frequency.exponentialRampToValueAtTime(30, audio.currentTime + 0.14);
  gain.gain.setValueAtTime(0.025, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  osc.start();
  osc.stop(audio.currentTime + 0.2);
}
async function resume() {
  if (battle.outcome) reset();
  audio ??= new AudioContext();
  await audio.resume();
  try {
    await renderer.domElement.requestPointerLock();
  } catch {}
  if (document.pointerLockElement) {
    paused = false;
    started = true;
    el("overlay").style.display = "none";
  }
}
el("play").onclick = () => void resume();
renderer.domElement.onclick = () => {
  if (paused) void resume();
};
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) {
    paused = true;
    keys.clear();
    left = false;
    right = false;
    el("overlay").style.display = "flex";
    if (!battle.outcome) {
      el("title").textContent = started ? "PAUSED" : "HYPER SPACE";
      el("play").textContent = started ? "RESUME" : "ENGAGE";
    }
  }
});
window.addEventListener("keydown", (e) => {
  if (["Tab", "Space", "ControlLeft", "ShiftLeft"].includes(e.code))
    e.preventDefault();
  if (e.code === "Escape") {
    paused = true;
    document.exitPointerLock();
    el("overlay").style.display = "flex";
    el("title").textContent = "PAUSED";
    el("play").textContent = "RESUME";
    return;
  }
  keys.add(e.code);
  if (e.code === "Tab") battle.lock();
  if (["Digit1", "Digit2", "Digit3"].includes(e.code)) {
    battle.selectMode(Number(e.code.slice(-1)) as 1 | 2 | 3);
    if (battle.mode === 2) cameraQ.copy(battle.ships[0].attitude);
  }
  if (e.code === "ShiftLeft" && !e.repeat) boost = true;
  if (e.code === "KeyR" && battle.outcome) {
    reset();
    void resume();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  if (!paused) {
    if (e.button === 0) left = true;
    if (e.button === 2) right = true;
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) left = false;
  if (e.button === 2) right = false;
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mousemove", (e) => {
  if (!paused) {
    mouseX += e.movementX;
    mouseY += e.movementY;
  }
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
function input(dt: number): FlightInput {
  const hullAim = battle.mode === 2 || right;
  const turn = new T.Vector3(
    0,
    0,
    (keys.has("KeyQ") ? 1 : 0) - (keys.has("KeyE") ? 1 : 0),
  );
  if (hullAim) {
    pendingPitch -= mouseY * 0.0024;
    pendingYaw -= mouseX * 0.0024;
    turn.x = T.MathUtils.clamp(pendingPitch / dt, -C.rotation, C.rotation);
    turn.y = T.MathUtils.clamp(pendingYaw / dt, -C.rotation, C.rotation);
    pendingPitch -= turn.x * dt;
    pendingYaw -= turn.y * dt;
  } else {
    const yaw = new T.Quaternion().setFromAxisAngle(
        new T.Vector3(0, 1, 0),
        -mouseX * 0.0024,
      ),
      pitch = new T.Quaternion().setFromAxisAngle(
        new T.Vector3(1, 0, 0),
        -mouseY * 0.0024,
      );
    cameraQ.premultiply(yaw).multiply(pitch).normalize();
  }
  mouseX = mouseY = 0;
  const result = {
    move: new T.Vector3(
      Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      Number(keys.has("Space")) - Number(keys.has("ControlLeft")),
      Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
    ),
    turn,
    boost,
  };
  boost = false;
  return result;
}
function spark(position: T.Vector3, color: number, count: number, size = 2) {
  for (let i = 0; i < count; i++) {
    const mesh = new T.Mesh(
      effectGeometry,
      new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
    );
    mesh.position.copy(position);
    const scale = size * (0.5 + rand());
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    const life = 0.2 + rand() * 0.7;
    effects.push({
      mesh,
      velocity: new T.Vector3(
        rand() - 0.5,
        rand() - 0.5,
        rand() - 0.5,
      ).multiplyScalar(65),
      life,
      max: life,
      scale,
    });
  }
}
function event(e: CombatEvent) {
  if (e.kind === "shot") {
    spark(e.position, e.owner === 0 ? 0x96ffff : 0xffaf66, 2, 2);
    if (e.owner === 0) {
      sound("shot");
      if (e.weapon === "SPINAL") shake = 0.12;
    }
  }
  if (e.kind === "hit" || e.kind === "destroy") {
    spark(
      e.position,
      0xffcd7e,
      e.kind === "destroy" || e.weapon === "SPINAL" ? 18 : 8,
      e.kind === "destroy" || e.weapon === "SPINAL" ? 4 : 2,
    );
    sound("hit");
    if (e.owner === 0) shake = 0.22;
    const mesh = new T.Mesh(
      new T.SphereGeometry(2.3, 8, 6),
      new T.MeshBasicMaterial({ color: 0x18100e }),
    );
    mesh.position.copy(models[e.owner].group.worldToLocal(e.position.clone()));
    models[e.owner].group.add(mesh);
    scars.push(mesh);
    if (scars.length > 80) {
      const old = scars.shift()!;
      old.removeFromParent();
      old.geometry.dispose();
      (old.material as T.Material).dispose();
    }
  }
  if (e.kind === "intercept") {
    spark(e.position, 0x90b6ff, 5, 1.5);
  }
}
function sync(dt: number) {
  models.forEach((m) => m.update(battle.time));
  const ids = new Set(battle.projectiles.map((p) => p.id));
  for (const [id, m] of projectileMeshes)
    if (!ids.has(id)) {
      scene.remove(m);
      projectileMeshes.delete(id);
      const t = trails.get(id);
      if (t) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as T.Material).dispose();
        trails.delete(id);
      }
    }
  for (const p of battle.projectiles) {
    let m = projectileMeshes.get(p.id);
    if (!m) {
      m = new T.Mesh(
        p.kind === "MISSILE" ? missileGeometry : bulletGeometry,
        p.owner === 0 ? blue : red,
      );
      if (p.kind === "SPINAL") m.scale.set(2.5, 2.5, 4);
      scene.add(m);
      projectileMeshes.set(p.id, m);
    }
    m.position.copy(p.position);
    m.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, -1),
      p.velocity.clone().normalize(),
    );
    if (p.kind === "MISSILE") {
      let t = trails.get(p.id);
      if (!t) {
        const line = new T.Line(
          new T.BufferGeometry(),
          new T.LineBasicMaterial({
            color: p.owner === 0 ? 0x43c9ff : 0xff764b,
            transparent: true,
            opacity: 0.6,
          }),
        );
        t = { line, points: [] };
        trails.set(p.id, t);
        scene.add(line);
      }
      t.points.push(p.position.clone());
      if (t.points.length > 22) t.points.shift();
      t.line.geometry.dispose();
      t.line.geometry = new T.BufferGeometry().setFromPoints(t.points);
    }
  }
  const fieldIds = new Set(battle.fields.map((f) => f.id));
  for (const [id, m] of fieldMeshes)
    if (!fieldIds.has(id)) {
      scene.remove(m);
      (m.material as T.Material).dispose();
      fieldMeshes.delete(id);
    }
  for (const f of battle.fields) {
    let m = fieldMeshes.get(f.id);
    if (!m) {
      m = new T.Mesh(
        fieldGeometry,
        new T.MeshBasicMaterial({
          color: f.owner === 0 ? 0x7ea7ff : 0xca81ff,
          wireframe: true,
          transparent: true,
          depthWrite: false,
        }),
      );
      scene.add(m);
      fieldMeshes.set(f.id, m);
    }
    m.position.copy(f.position);
    m.visible = f.delay <= 0;
    (m.material as T.MeshBasicMaterial).opacity =
      Math.max(0.1, f.life / C.defense.lifetime) * 0.65;
    m.rotation.y += dt * 4;
    m.scale.setScalar(1);
  }
  for (const e of effects) {
    e.life -= dt;
    e.mesh.position.addScaledVector(e.velocity, dt);
    (e.mesh.material as T.MeshBasicMaterial).opacity = Math.max(
      0,
      e.life / e.max,
    );
    e.mesh.scale.setScalar(e.scale * (0.6 + e.life / e.max));
  }
  effects = effects.filter((e) => {
    if (e.life > 0) return true;
    scene.remove(e.mesh);
    (e.mesh.material as T.Material).dispose();
    return false;
  });
}
function marker(id: string, world: T.Vector3, offscreen = false) {
  const p = world.clone().project(camera),
    visible = p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85;
  el(id).style.display = visible || offscreen ? "block" : "none";
  if (!visible && p.z > 1) {
    p.x = -p.x;
    p.y = -p.y;
  }
  el(id).style.left =
    `${(T.MathUtils.clamp(p.x, -0.88, 0.88) * 0.5 + 0.5) * innerWidth}px`;
  el(id).style.top =
    `${(-T.MathUtils.clamp(p.y, -0.8, 0.8) * 0.5 + 0.5) * innerHeight}px`;
  return visible;
}
function hud() {
  const p = battle.ships[0],
    enemy = battle.ships[1],
    range = p.position.distanceTo(enemy.position);
  el("target-label").textContent = battle.locked
    ? battle.lockProgress < 1
      ? "ACQUIRING TARGET"
      : "HOSTILE · LOCKED"
    : "HOSTILE · TAB TO LOCK";
  el("range").textContent =
    `${Math.round(range)} m · ${enemy.alive ? "ACTIVE" : "DISABLED"}`;
  el("target-hp").style.width = `${enemy.health * 100}%`;
  el("hull-hp").style.width = `${p.health * 100}%`;
  el("hull").textContent = `CORE INTEGRITY ${Math.ceil(p.health * 100)}%`;
  el("energy-label").textContent =
    `BOOST / DEFENSE ${Math.floor(p.energy)} / 100`;
  el("energy").style.width = `${p.energy}%`;
  el("systems").textContent =
    `THRUST ${Math.round(p.thrust * 100)}% · ARMOR ${p.functional("armor").length}/5`;
  const names = [
    "MISSILE / LOCK & FIRE",
    "SPINAL / HULL AIM",
    "TURRET / CAMERA AIM",
  ];
  for (let i = 1; i <= 3; i++) {
    const kind = i === 1 ? "MISSILE" : i === 2 ? "SPINAL" : "TURRET";
    el(`w${i}`).className = `weapon ${battle.mode === i ? "active" : ""}`;
    el(`w${i}`).textContent =
      `${i}  ${names[i - 1]} · ${!p.functional(kind.toLowerCase()).length ? "OFFLINE" : p.reload[kind] > 0 ? p.reload[kind].toFixed(1) + "s" : i === 1 ? p.ammo + " ROUNDS" : "READY"}`;
  }
  const incoming = battle.projectiles.filter(
    (x) => x.owner === 1 && threatTime(x, p) < 3,
  ).length;
  el("warning").textContent = incoming
    ? `⚠ INCOMING · ${incoming} THREATS`
    : "";
  el("bb").innerHTML =
    `BB // DEFENSE ONLINE<br>${p.energy < 34 ? "ENERGY RESERVED FOR BOOST" : battle.fields.some((f) => f.owner === 0) ? "LOCAL GRAVITY FIELD ACTIVE" : "TRACKING BALLISTIC THREATS"}<br>INTERCEPTED ${battle.stats.interceptsByOwner[0]}`;
  if (battle.mode === 2)
    marker("reticle", p.position.clone().addScaledVector(p.direction(), range));
  else {
    el("reticle").style.display = "block";
    el("reticle").style.left = "50%";
    el("reticle").style.top = "50%";
  }
  const visible = marker("marker", enemy.position, true);
  el("marker-label").textContent = visible ? "HOSTILE" : "◀ TARGET DIRECTION";
  marker(
    "lead",
    enemy.position
      .clone()
      .addScaledVector(
        enemy.velocity,
        range / (battle.mode === 2 ? C.spinal.speed : C.turret.speed),
      ),
  );
  el("clock").textContent = `${Math.floor(battle.time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(battle.time % 60)
    .toString()
    .padStart(2, "0")}`;
  if (battle.outcome && !paused) {
    paused = true;
    document.exitPointerLock();
    el("overlay").style.display = "flex";
    el("title").textContent = battle.outcome;
    el("description").textContent =
      `Engagement ${Math.round(battle.time)}s · ${battle.stats.hits} impacts · ${battle.stats.intercepts} interceptions. Wreck remains in space. Press R or rematch.`;
    el("play").textContent = "REMATCH";
  }
}
let last = performance.now(),
  accumulator = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.08, (now - last) / 1000);
  last = now;
  accumulator += paused && !battle.outcome ? 0 : elapsed;
  while (accumulator >= C.dt) {
    const player = battle.ships[0],
      control = battle.outcome
        ? { move: new T.Vector3(), turn: new T.Vector3(), boost: false }
        : input(C.dt);
    if (battle.mode === 2 || right) cameraQ.slerp(player.attitude, 0.24);
    const aimDirection = new T.Vector3(0, 0, -1).applyQuaternion(cameraQ);
    const aimDepth = Math.max(
      120,
      battle.ships[1].position.clone().sub(camera.position).dot(aimDirection),
    );
    const aim = aimDirection.multiplyScalar(aimDepth).add(camera.position);
    battle.step(control, aim, left);
    battle.events.forEach(event);
    sync(C.dt);
    accumulator -= C.dt;
  }
  if (!paused) {
    const player = battle.ships[0];
    if (battle.mode === 2 || right)
      cameraQ.slerp(player.attitude, 1 - Math.exp(-10 * elapsed));
    const offset = new T.Vector3(0, 30, 110).applyQuaternion(cameraQ);
    camera.position.lerp(
      player.position.clone().add(offset),
      1 - Math.exp(-9 * elapsed),
    );
    camera.quaternion.copy(cameraQ);
    shake = Math.max(0, shake - elapsed);
    if (shake > 0)
      camera.position.add(
        new T.Vector3(rand() - 0.5, rand() - 0.5, 0).multiplyScalar(shake * 4),
      );
    camera.fov = T.MathUtils.lerp(
      camera.fov,
      65 + Math.min(9, player.velocity.length() / 24),
      1 - Math.exp(-5 * elapsed),
    );
    camera.updateProjectionMatrix();
  } else if (!started) {
    camera.lookAt(battle.ships[1].position);
    models.forEach((m) => m.update(0));
  }
  hud();
  renderer.render(scene, camera);
}
reset();
requestAnimationFrame(frame);
// Read-only snapshot supports browser QA without altering combat rules.
Object.assign(window, {
  combatDemo: {
    snapshot: () => ({
      time: battle.time,
      mode: battle.mode,
      locked: battle.locked,
      paused,
      outcome: battle.outcome,
      ships: battle.ships.map((s) => ({
        position: s.position.toArray(),
        attitude: s.attitude.toArray(),
        energy: s.energy,
        health: s.health,
        boostTime: s.boostTime,
      })),
      projectiles: battle.projectiles.length,
      fields: battle.fields.length,
      stats: { ...battle.stats },
      camera: camera.quaternion.toArray(),
      targetNDC: battle.ships[1].position.clone().project(camera).toArray(),
      spinalNDC: battle.ships[0].position
        .clone()
        .addScaledVector(
          battle.ships[0].direction(),
          battle.ships[0].position.distanceTo(battle.ships[1].position),
        )
        .project(camera)
        .toArray(),
      leadNDC: battle.ships[1].position
        .clone()
        .addScaledVector(
          battle.ships[1].velocity,
          battle.ships[0].position.distanceTo(battle.ships[1].position) /
            (battle.mode === 2 ? C.spinal.speed : C.turret.speed),
        )
        .project(camera)
        .toArray(),
      systems: {
        spinal: battle.ships[0].functional("spinal").length > 0,
        turret: battle.ships[0].functional("turret").length > 0,
        missile:
          battle.ships[0].functional("missile").length > 0 &&
          battle.ships[0].ammo > 0,
      },
      incoming: battle.projectiles
        .filter((p) => p.owner === 1 && p.kind === "MISSILE")
        .map((p) => threatTime(p, battle.ships[0]))
        .filter((t) => t < 2),
    }),
  },
});
