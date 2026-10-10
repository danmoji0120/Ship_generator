import { Box3, Quaternion, Ray, Vector3 } from "three";
import { TUNING as C } from "./config";
import {
  TEST_SHIP,
  type ControlMode,
  type PartDefinition,
  type ShipDefinition,
  type WeaponKind,
} from "./definition";
const forward = new Vector3(0, 0, -1),
  up = new Vector3(0, 1, 0);
export interface FlightInput {
  move: Vector3;
  turn: Vector3;
  boost: boolean;
}
export interface PartState {
  definition: PartDefinition;
  hp: number;
}
export class Ship {
  position = new Vector3();
  velocity = new Vector3();
  attitude = new Quaternion();
  angularVelocity = new Vector3();
  energy = C.energy as number;
  boostTime = 0;
  boostCooldown = 0;
  recovery = 0;
  boostDirection = new Vector3();
  parts: PartState[];
  ammo = 180;
  reload: Record<WeaponKind, number> = { MISSILE: 0, SPINAL: 0, TURRET: 0 };
  turretDirections: Vector3[];
  constructor(
    public id: number,
    public definition: ShipDefinition = TEST_SHIP,
  ) {
    this.parts = definition.parts.map((definition) => ({
      definition,
      hp: definition.hp,
    }));
    this.turretDirections = definition.parts
      .filter((p) => p.kind === "turret")
      .map(() => new Vector3(0, 0, -1));
  }
  get alive() {
    return (
      this.parts.find((p) => p.definition.kind === "core")!.hp > 0 &&
      (this.functional("spinal").length > 0 ||
        this.functional("turret").length > 0 ||
        (this.ammo > 0 && this.functional("missile").length > 0))
    );
  }
  get health() {
    const core = this.parts.find((p) => p.definition.kind === "core")!;
    return Math.max(0, core.hp) / core.definition.hp;
  }
  functional(kind: string) {
    return this.parts.filter((p) => p.definition.kind === kind && p.hp > 0);
  }
  get thrust() {
    return (
      0.28 +
      (0.72 * this.functional("engine").length) /
        Math.max(
          1,
          this.definition.parts.filter((p) => p.kind === "engine").length,
        )
    );
  }
  direction() {
    return forward.clone().applyQuaternion(this.attitude);
  }
  spend(cost: number) {
    if (this.energy < cost) return false;
    this.energy -= cost;
    this.recovery = C.regenDelay;
    return true;
  }
}
export class ShipFlightController {
  step(ship: Ship, input: FlightInput, dt: number) {
    ship.boostCooldown = Math.max(0, ship.boostCooldown - dt);
    ship.recovery = Math.max(0, ship.recovery - dt);
    if (ship.recovery === 0)
      ship.energy = Math.min(C.energy, ship.energy + C.regen * dt);
    if (!ship.alive) {
      ship.position.addScaledVector(ship.velocity, dt);
      return;
    }
    if (input.boost && ship.boostCooldown === 0 && ship.spend(C.boostCost)) {
      ship.boostTime = C.boostDuration;
      ship.boostCooldown = C.boostCooldown;
      ship.boostDirection
        .copy(input.move.lengthSq() > 0 ? input.move : forward)
        .normalize()
        .applyQuaternion(ship.attitude);
    }
    const move = input.move
      .clone()
      .clampLength(0, 1)
      .applyQuaternion(ship.attitude);
    ship.velocity.addScaledVector(move, C.acceleration * ship.thrust * dt);
    ship.velocity.multiplyScalar(Math.exp(-C.damping * dt));
    if (ship.boostTime > 0) {
      ship.velocity.addScaledVector(
        ship.boostDirection,
        C.boostAcceleration * ship.thrust * dt,
      );
      ship.boostTime = Math.max(0, ship.boostTime - dt);
    }
    ship.velocity.clampLength(0, ship.boostTime > 0 ? C.boostSpeed : C.speed);
    ship.position.addScaledVector(ship.velocity, dt);
    ship.angularVelocity.lerp(
      input.turn.clone().clampLength(0, C.rotation),
      1 - Math.exp(-12 * dt),
    );
    const angle = ship.angularVelocity.length() * dt;
    if (angle > 0)
      ship.attitude
        .multiply(
          new Quaternion().setFromAxisAngle(
            ship.angularVelocity.clone().normalize(),
            angle,
          ),
        )
        .normalize();
    for (const kind of ["MISSILE", "SPINAL", "TURRET"] as WeaponKind[])
      ship.reload[kind] = Math.max(0, ship.reload[kind] - dt);
  }
}
export interface Projectile {
  id: number;
  owner: number;
  kind: WeaponKind;
  position: Vector3;
  previous: Vector3;
  velocity: Vector3;
  age: number;
  target: number;
  damage: number;
  penetration: number;
}
export interface GravityField {
  id: number;
  owner: number;
  position: Vector3;
  delay: number;
  life: number;
}
export interface CombatEvent {
  kind: "shot" | "hit" | "intercept" | "destroy" | "boost";
  position: Vector3;
  owner: number;
  part?: string;
  weapon?: WeaponKind;
}
export function segmentSphere(
  a: Vector3,
  b: Vector3,
  center: Vector3,
  radius: number,
) {
  const d = b.clone().sub(a);
  const t = d.lengthSq()
    ? Math.max(0, Math.min(1, center.clone().sub(a).dot(d) / d.lengthSq()))
    : 0;
  return (
    a.clone().addScaledVector(d, t).distanceToSquared(center) <= radius * radius
  );
}
export function collision(ship: Ship, a: Vector3, b: Vector3) {
  const inv = ship.attitude.clone().invert(),
    start = a.clone().sub(ship.position).applyQuaternion(inv),
    end = b.clone().sub(ship.position).applyQuaternion(inv),
    delta = end.clone().sub(start),
    length = delta.length();
  if (length === 0) return null;
  const ray = new Ray(start, delta.normalize());
  let nearest: { part: PartState; point: Vector3; distance: number } | null =
    null;
  for (const part of ship.parts) {
    if (part.hp <= 0) continue;
    const def = part.definition,
      half = def.size.clone().multiplyScalar(0.5);
    const hit = ray.intersectBox(
      new Box3(def.center.clone().sub(half), def.center.clone().add(half)),
      new Vector3(),
    );
    if (!hit) continue;
    const distance = hit.distanceTo(start);
    if (distance <= length && (!nearest || distance < nearest.distance))
      nearest = {
        part,
        point: hit.applyQuaternion(ship.attitude).add(ship.position),
        distance,
      };
  }
  return nearest;
}
export function turretEligible(index: number, localDirection: Vector3) {
  return (
    localDirection.z < 0.35 &&
    (index === 0 ? localDirection.y > -0.08 : localDirection.y < 0.08)
  );
}
export function threatTime(projectile: Projectile, ship: Ship) {
  const r = projectile.position.clone().sub(ship.position),
    v = projectile.velocity.clone().sub(ship.velocity);
  const time = -r.dot(v) / Math.max(1, v.lengthSq());
  return time > 0 && r.addScaledVector(v, time).length() < 38 ? time : Infinity;
}
export class Battle {
  ships = [new Ship(0), new Ship(1)];
  projectiles: Projectile[] = [];
  fields: GravityField[] = [];
  events: CombatEvent[] = [];
  flight = new ShipFlightController();
  time = 0;
  nextId = 1;
  mode: ControlMode = 1;
  locked = false;
  lockProgress = 0;
  outcome: "VICTORY" | "DEFEAT" | null = null;
  defenseCooldown = [0, 0];
  aiReaction = 0;
  aiMissile = 2;
  aiGun = 1;
  stats = {
    hits: 0,
    intercepts: 0,
    interceptsByOwner: [0, 0],
    aiBoosts: 0,
    shots: 0,
    playerShots: { MISSILE: 0, SPINAL: 0, TURRET: 0 },
  };
  constructor() {
    this.ships[0].position.set(0, 0, 150);
    this.ships[1].position.set(0, 30, -230);
    this.ships[1].attitude.setFromAxisAngle(up, Math.PI);
  }
  selectMode(mode: ControlMode) {
    this.mode = mode;
  }
  lock() {
    this.locked = true;
  }
  fire(ship: Ship, kind: WeaponKind, aim: Vector3) {
    if (
      !ship.alive ||
      ship.reload[kind] > 0 ||
      !ship.functional(kind.toLowerCase()).length
    )
      return false;
    if (
      kind === "MISSILE" &&
      ((ship.id === 0 && (!this.locked || this.lockProgress < 1)) ||
        ship.ammo < 1)
    )
      return false;
    let count = 0;
    const spawn = (position: Vector3, direction: Vector3) => {
      const cfg =
        kind === "MISSILE"
          ? C.missile
          : kind === "SPINAL"
            ? C.spinal
            : C.turret;
      this.projectiles.push({
        id: this.nextId++,
        owner: ship.id,
        kind,
        position,
        previous: position.clone(),
        velocity: direction
          .multiplyScalar(kind === "MISSILE" ? 65 : cfg.speed)
          .add(ship.velocity),
        age: 0,
        target: 1 - ship.id,
        damage: cfg.damage,
        penetration: cfg.penetration,
      });
      this.events.push({
        kind: "shot",
        position: position.clone(),
        owner: ship.id,
        weapon: kind,
      });
      count++;
    };
    if (kind === "SPINAL") {
      const gun = ship.functional("spinal")[0].definition;
      spawn(
        gun.center
          .clone()
          .add(new Vector3(0, 0, -gun.size.z / 2 - 2))
          .applyQuaternion(ship.attitude)
          .add(ship.position),
        ship.direction(),
      );
    }
    if (kind === "MISSILE") {
      const tubes = ship.functional("missile");
      for (let i = 0; i < Math.min(C.missile.salvo, ship.ammo); i++) {
        const p = tubes[i % tubes.length].definition.center.clone();
        p.z -= 12;
        p.x += ((i % 3) - 1) * 2;
        spawn(
          p.applyQuaternion(ship.attitude).add(ship.position),
          ship.direction(),
        );
      }
      ship.ammo -= count;
    }
    if (kind === "TURRET") {
      for (let i = 0; i < ship.turretDirections.length; i++) {
        const part = ship.parts.filter((p) => p.definition.kind === "turret")[
          i
        ];
        if (part.hp <= 0) continue;
        const local = aim
          .clone()
          .sub(ship.position)
          .applyQuaternion(ship.attitude.clone().invert())
          .sub(part.definition.center)
          .normalize();
        if (
          !turretEligible(part.definition.center.y >= 0 ? 0 : 1, local) ||
          ship.turretDirections[i].angleTo(local) > 0.1
        )
          continue;
        const muzzle = part.definition.center
          .clone()
          .addScaledVector(ship.turretDirections[i], 10)
          .applyQuaternion(ship.attitude)
          .add(ship.position);
        const dir = ship.turretDirections[i]
          .clone()
          .applyQuaternion(ship.attitude);
        if (collision(ship, muzzle, muzzle.clone().addScaledVector(dir, 80)))
          continue;
        spawn(muzzle, dir);
      }
    }
    if (count) {
      ship.reload[kind] =
        kind === "MISSILE"
          ? ship.id === 1
            ? C.ai.missileReload
            : C.missile.reload
          : kind === "SPINAL"
            ? C.spinal.reload
            : C.turret.reload;
      this.stats.shots += count;
      if (ship.id === 0) this.stats.playerShots[kind] += count;
      return true;
    }
    return false;
  }
  aimTurrets(ship: Ship, aim: Vector3, dt: number) {
    const localAim = aim
      .clone()
      .sub(ship.position)
      .applyQuaternion(ship.attitude.clone().invert());
    for (let i = 0; i < ship.turretDirections.length; i++) {
      const dir = ship.turretDirections[i],
        mount = ship.parts.filter((p) => p.definition.kind === "turret")[i];
      const desired = localAim.clone().sub(mount.definition.center).normalize();
      const q = new Quaternion().setFromUnitVectors(dir, desired),
        angle = dir.angleTo(desired);
      dir
        .applyQuaternion(
          new Quaternion().slerp(
            q,
            Math.min(1, (C.turret.turn * dt) / Math.max(0.001, angle)),
          ),
        )
        .normalize();
    }
  }
  aiInput(dt: number): FlightInput {
    const enemy = this.ships[1],
      player = this.ships[0],
      to = player.position.clone().sub(enemy.position),
      distance = to.length();
    const local = to
      .clone()
      .normalize()
      .applyQuaternion(enemy.attitude.clone().invert());
    const turn = new Vector3(
      Math.atan2(local.y, -local.z),
      Math.atan2(-local.x, -local.z),
      0,
    ).multiplyScalar(1.5);
    const move = new Vector3(
      Math.sin(this.time * 0.6) * 0.8,
      Math.cos(this.time * 0.47) * 0.35,
      distance > C.ai.range ? -1 : distance < 230 ? 1 : 0,
    );
    this.aiReaction -= dt;
    let boost = false;
    if (this.aiReaction <= 0) {
      this.aiReaction = C.ai.reaction;
      const threat = this.projectiles.find(
        (p) => p.owner === 0 && threatTime(p, enemy) < 1.2,
      );
      if (threat && enemy.energy >= C.boostCost && enemy.boostCooldown === 0) {
        move.set(Math.sin(this.time * 3) > 0 ? 1 : -1, 0.5, 0);
        boost = true;
        this.stats.aiBoosts++;
      }
    }
    return { move, turn, boost };
  }
  defend(ship: Ship, dt: number) {
    this.defenseCooldown[ship.id] = Math.max(
      0,
      this.defenseCooldown[ship.id] - dt,
    );
    const cfg = C.defense;
    if (
      !ship.alive ||
      this.defenseCooldown[ship.id] > 0 ||
      ship.energy < cfg.cost + cfg.reserve ||
      this.fields.filter((f) => f.owner === ship.id).length >= cfg.max
    )
      return;
    const threats = this.projectiles
      .filter((p) => p.owner !== ship.id && threatTime(p, ship) < 1.3)
      .sort((a, b) => threatTime(a, ship) - threatTime(b, ship));
    const p = threats[0];
    if (!p) return;
    const time = threatTime(p, ship);
    const ahead = Math.min(time, cfg.delay + 0.1);
    const position = p.position.clone().addScaledVector(p.velocity, ahead);
    // Deterministic estimation error changes the predicted location, never the collision result.
    const error = ship.id === 0 ? 2 : 7;
    position.add(
      new Vector3(
        Math.sin(p.id * 2.3),
        Math.cos(p.id * 1.7),
        Math.sin(p.id),
      ).multiplyScalar(error),
    );
    if (position.distanceTo(ship.position) > cfg.range) return;
    if (ship.spend(cfg.cost)) {
      this.fields.push({
        id: this.nextId++,
        owner: ship.id,
        position,
        delay: cfg.delay,
        life: cfg.lifetime,
      });
      this.defenseCooldown[ship.id] = cfg.cooldown;
    }
  }
  damage(ship: Ship, part: PartState, p: Projectile, point: Vector3) {
    const resistance =
      part.definition.resistance *
      (0.35 + (0.65 * Math.max(0, part.hp)) / part.definition.hp);
    const damage = p.damage * (p.penetration >= resistance ? 1 : 0.55);
    part.hp = Math.max(0, part.hp - damage);
    const core = ship.parts.find((s) => s.definition.kind === "core")!;
    if (part !== core) {
      const penetration = p.penetration > resistance;
      core.hp = Math.max(0, core.hp + p.damage * (penetration ? -0.65 : -0.12));
    }
    this.stats.hits++;
    this.events.push({
      kind: "hit",
      owner: ship.id,
      position: point.clone(),
      part: part.definition.id,
      weapon: p.kind,
    });
    if (part.hp === 0)
      this.events.push({
        kind: "destroy",
        owner: ship.id,
        position: point.clone(),
        part: part.definition.id,
      });
  }
  step(input: FlightInput, aim: Vector3, firing: boolean, dt = C.dt) {
    this.events = [];
    this.time += dt;
    this.flight.step(
      this.ships[0],
      this.outcome
        ? { move: new Vector3(), turn: new Vector3(), boost: false }
        : input,
      dt,
    );
    this.flight.step(
      this.ships[1],
      this.outcome
        ? { move: new Vector3(), turn: new Vector3(), boost: false }
        : this.aiInput(dt),
      dt,
    );
    if (this.locked)
      this.lockProgress = Math.min(1, this.lockProgress + dt / 0.6);
    this.aimTurrets(this.ships[0], aim, dt);
    const player = this.ships[0],
      enemy = this.ships[1];
    const lead = player.position
      .clone()
      .addScaledVector(
        player.velocity,
        enemy.position.distanceTo(player.position) / C.turret.speed,
      );
    // A bounded tracking estimate rather than perfect-frame enemy aim.
    lead.add(
      new Vector3(
        Math.sin(this.time * 1.7),
        Math.cos(this.time * 1.3),
        Math.sin(this.time * 0.9),
      ).multiplyScalar(C.ai.aimError),
    );
    this.aimTurrets(enemy, lead, dt);
    if (!this.outcome) {
      if (firing)
        this.fire(
          player,
          this.mode === 1 ? "MISSILE" : this.mode === 2 ? "SPINAL" : "TURRET",
          aim,
        );
      this.aiMissile -= dt;
      this.aiGun -= dt;
      if (this.aiMissile <= 0) {
        this.fire(enemy, "MISSILE", player.position);
        this.aiMissile = C.ai.missileReload;
      }
      if (this.aiGun <= 0) {
        this.fire(enemy, "TURRET", lead);
        this.aiGun = C.ai.gunReload;
      }
      this.defend(player, dt);
      this.defend(enemy, dt);
    }
    for (const f of this.fields) {
      if (f.delay > 0) f.delay -= dt;
      else f.life -= dt;
    }
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      p.previous.copy(p.position);
      p.age += dt;
      if (p.kind === "MISSILE") {
        const target = this.ships[p.target],
          desired = target.position
            .clone()
            .addScaledVector(target.velocity, 0.25)
            .sub(p.position)
            .normalize(),
          dir = p.velocity.clone().normalize(),
          angle = dir.angleTo(desired);
        const q = new Quaternion().setFromUnitVectors(dir, desired);
        dir.applyQuaternion(
          new Quaternion().slerp(
            q,
            Math.min(1, (C.missile.turn * dt) / Math.max(0.001, angle)),
          ),
        );
        const speed = Math.min(
          C.missile.speed,
          p.velocity.length() + C.missile.acceleration * dt,
        );
        p.velocity.copy(dir).multiplyScalar(speed);
      }
      p.position.addScaledVector(p.velocity, dt);
      const field = this.fields.find(
        (f) =>
          f.owner !== p.owner &&
          f.delay <= 0 &&
          f.life > 0 &&
          segmentSphere(p.previous, p.position, f.position, C.defense.radius),
      );
      if (field) {
        this.stats.intercepts++;
        this.stats.interceptsByOwner[field.owner]++;
        this.events.push({
          kind: "intercept",
          owner: field.owner,
          position: p.position.clone(),
        });
        continue;
      }
      const target = this.ships[p.target],
        hit = collision(target, p.previous, p.position);
      if (hit) {
        this.damage(target, hit.part, p, hit.point);
        continue;
      }
      if (
        p.age <
        (p.kind === "MISSILE"
          ? C.missile.life
          : p.kind === "SPINAL"
            ? C.spinal.life
            : C.turret.life)
      )
        survivors.push(p);
    }
    this.projectiles = survivors;
    this.fields = this.fields.filter((f) => f.life > 0);
    if (!this.outcome) {
      if (!player.alive) this.outcome = "DEFEAT";
      else if (!enemy.alive) this.outcome = "VICTORY";
    }
  }
}
