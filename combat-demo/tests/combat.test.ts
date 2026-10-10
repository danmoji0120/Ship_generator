import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { Vector3, Quaternion } from "three";
import {
  Battle,
  Ship,
  ShipFlightController,
  collision,
  segmentSphere,
  turretEligible,
  type Projectile,
} from "../src/simulation";
import { TUNING as C } from "../src/config";
const idle = () => ({ move: new Vector3(), turn: new Vector3(), boost: false });
const projectile = (position: Vector3, velocity: Vector3): Projectile => ({
  id: 99,
  owner: 1,
  kind: "SPINAL",
  position,
  previous: position.clone(),
  velocity,
  age: 0,
  target: 0,
  damage: 165,
  penetration: 90,
});
describe("shared combat rules", () => {
  it("moves along all six local directions and stabilizes velocity", () => {
    for (const v of [
      new Vector3(1, 0, 0),
      new Vector3(-1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, -1, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 0, -1),
    ]) {
      const s = new Ship(0),
        f = new ShipFlightController();
      for (let i = 0; i < 60; i++) f.step(s, { ...idle(), move: v }, C.dt);
      expect(s.position.dot(v)).toBeGreaterThan(10);
      for (let i = 0; i < 120; i++) f.step(s, idle(), C.dt);
      expect(s.velocity.length()).toBeLessThan(0.1);
    }
  });
  it("boost spends exactly25, uses input, respects cooldown and delayed recovery", () => {
    const s = new Ship(0),
      f = new ShipFlightController();
    f.step(s, { ...idle(), move: new Vector3(1, 0, 0), boost: true }, C.dt);
    expect(s.energy).toBe(75);
    expect(s.velocity.x).toBeGreaterThan(10);
    f.step(s, { ...idle(), boost: true }, C.dt);
    expect(s.energy).toBe(75);
    for (let i = 0; i < 80; i++) f.step(s, idle(), C.dt);
    expect(s.energy).toBeGreaterThan(75);
  });
  it("mode and lock are independent; missiles require completed lock and turn toward target", () => {
    const b = new Battle();
    expect(b.fire(b.ships[0], "MISSILE", b.ships[1].position)).toBe(false);
    b.lock();
    for (let i = 0; i < 40; i++) b.step(idle(), b.ships[1].position, false);
    for (const m of [2, 3, 1] as const) {
      b.selectMode(m);
      expect(b.locked).toBe(true);
      expect(b.mode).toBe(m);
    }
    b.ships[1].position.set(120, 0, -230);
    b.fire(b.ships[0], "MISSILE", b.ships[1].position);
    const p = b.projectiles[0],
      before = p.velocity.x;
    b.step(idle(), b.ships[1].position, false);
    expect(p.velocity.x).toBeGreaterThan(before);
    expect(p.velocity.length()).toBeGreaterThan(65);
    expect(b.projectiles.length).toBeGreaterThan(1);
  });
  it("spinal uses hull forward regardless of camera aim", () => {
    const b = new Battle(),
      s = b.ships[0];
    s.attitude.setFromAxisAngle(new Vector3(0, 1, 0), 0.8);
    b.fire(s, "SPINAL", new Vector3(999, 999, 0));
    expect(
      b.projectiles[0].velocity.clone().normalize().distanceTo(s.direction()),
    ).toBeLessThan(1e-8);
  });
  it("camera/turret aiming does not change attitude and arcs forbid hull shots", () => {
    const b = new Battle(),
      s = b.ships[0],
      q = s.attitude.clone();
    b.selectMode(3);
    b.aimTurrets(s, new Vector3(100, 100, 400), 1);
    expect(s.attitude.equals(q)).toBe(true);
    expect(turretEligible(0, new Vector3(0, 0, 1))).toBe(false);
    expect(turretEligible(0, new Vector3(0, -1, 0))).toBe(false);
    expect(b.fire(s, "TURRET", new Vector3(100, 100, 400))).toBe(false);
  });
  it("AI evades a collision threat through the same paid boost controller", () => {
    const b = new Battle(),
      s = b.ships[1];
    b.defenseCooldown = [99, 99];
    const p = projectile(
      s.position.clone().add(new Vector3(0, 0, -100)),
      new Vector3(0, 0, 200),
    );
    p.owner = 0;
    p.target = 1;
    b.projectiles.push(p);
    b.step(idle(), s.position, false);
    expect(b.stats.aiBoosts).toBe(1);
    expect(s.boostTime).toBeGreaterThan(0);
    expect(s.energy).toBe(75);
    expect(s.velocity.length()).toBeGreaterThan(10);
  });
  it("only swept geometric crossings intersect a local field", () => {
    expect(
      segmentSphere(
        new Vector3(-20, 0, 0),
        new Vector3(20, 0, 0),
        new Vector3(),
        7,
      ),
    ).toBe(true);
    expect(
      segmentSphere(
        new Vector3(-20, 10, 0),
        new Vector3(20, 10, 0),
        new Vector3(),
        7,
      ),
    ).toBe(false);
    const b = new Battle();
    b.defenseCooldown = [99, 99];
    b.projectiles = [projectile(new Vector3(0, 0, 70), new Vector3(0, 0, 950))];
    b.fields = [
      {
        id: 2,
        owner: 0,
        position: new Vector3(40, 0, 90),
        delay: 0,
        life: 0.24,
      },
    ];
    for (let i = 0; i < 8; i++) b.step(idle(), b.ships[1].position, false);
    expect(b.stats.intercepts).toBe(0);
    expect(b.stats.hits).toBe(1);
    expect(b.ships[0].health).toBeLessThan(1);
  });
  it("an active field removes a crossing entity, while delayed fields do not", () => {
    for (const delay of [0, 1]) {
      const b = new Battle();
      b.defenseCooldown = [99, 99];
      b.projectiles = [
        projectile(new Vector3(60, 0, 150), new Vector3(-950, 0, 0)),
      ];
      b.fields = [
        {
          id: 2,
          owner: 0,
          position: new Vector3(50, 0, 150),
          delay,
          life: 0.24,
        },
      ];
      b.step(idle(), new Vector3(), false);
      expect(b.stats.intercepts).toBe(delay === 0 ? 1 : 0);
      expect(b.projectiles.length).toBe(delay === 0 ? 0 : 1);
    }
  });
  it("swept collision detects high speed passage and returns the actual component", () => {
    const s = new Ship(0);
    const hit = collision(s, new Vector3(0, 0, -200), new Vector3(0, 0, 200));
    expect(hit?.part.definition.id).toBe("spinal");
    expect(hit?.point.z).toBe(-48);
  });
  it("destroyed engines reduce thrust and destroyed weapons cannot shoot", () => {
    const s = new Ship(0),
      b = new Battle();
    s.parts
      .filter((p) => p.definition.kind === "engine")
      .forEach((p) => (p.hp = 0));
    expect(s.thrust).toBe(0.28);
    s.parts.find((p) => p.definition.kind === "spinal")!.hp = 0;
    expect(b.fire(s, "SPINAL", new Vector3())).toBe(false);
  });
  it("disabled core ends battle and fresh battle resets all state", () => {
    const b = new Battle();
    b.ships[1].parts.find((p) => p.definition.kind === "core")!.hp = 0;
    b.step(idle(), new Vector3(), false);
    expect(b.outcome).toBe("VICTORY");
    const fresh = new Battle();
    expect(fresh.outcome).toBeNull();
    expect(fresh.ships[1].alive).toBe(true);
    expect(fresh.time).toBe(0);
  });
  it("can complete a deterministic actual-collision engagement without auto player fire", () => {
    const b = new Battle();
    b.lock();
    for (let i = 0; i < 60 * 180 && !b.outcome; i++) {
      const p = b.ships[0],
        e = b.ships[1];
      const desired = e.position.clone().sub(p.position).normalize(),
        q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), desired);
      const local = q.clone();
      p.attitude.slerp(local, 0.04);
      b.selectMode(i % 400 < 200 ? 1 : 2);
      b.step(idle(), e.position, true);
    }
    expect(b.stats.hits).toBeGreaterThan(5);
    expect(
      b.ships.every(
        (s) =>
          s.position.toArray().every(Number.isFinite) &&
          s.turretDirections.every((d) => d.toArray().every(Number.isFinite)),
      ),
    ).toBe(true);
    expect(b.stats.aiBoosts).toBeGreaterThan(0);
    expect(b.stats.intercepts).toBeGreaterThan(0);
    expect(b.outcome).not.toBeNull();
    writeFileSync(
      "qa/simulation-report.json",
      JSON.stringify(
        {
          time: b.time,
          outcome: b.outcome,
          stats: b.stats,
          health: b.ships.map((s) => s.health),
        },
        null,
        2,
      ),
    );
  });
});
