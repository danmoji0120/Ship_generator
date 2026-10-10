import * as T from "three";
import type { Ship } from "./simulation";
export class ShipAssembler {
  group = new T.Group();
  parts = new Map<string, T.Mesh>();
  exhaust: T.Mesh[] = [];
  turrets: T.Group[] = [];
  constructor(public ship: Ship) {
    const base = ship.id === 0 ? 0x527887 : 0x80565b;
    for (const p of ship.parts) {
      const d = p.definition;
      const mesh = new T.Mesh(
        new T.BoxGeometry(d.size.x, d.size.y, d.size.z),
        new T.MeshStandardMaterial({
          color:
            d.kind === "armor" ? base : d.kind === "core" ? 0x13222b : 0x263940,
          metalness: 0.65,
          roughness: 0.5,
        }),
      );
      mesh.position.copy(d.center);
      this.parts.set(d.id, mesh);
      this.group.add(mesh);
      const edges = new T.LineSegments(
        new T.EdgesGeometry(mesh.geometry),
        new T.LineBasicMaterial({
          color: ship.id === 0 ? 0x83d7e3 : 0xff9780,
          transparent: true,
          opacity: 0.25,
        }),
      );
      mesh.add(edges);
      if (d.kind === "engine") {
        const glow = new T.Mesh(
          new T.CylinderGeometry(2.3, 1, 15, 10),
          new T.MeshBasicMaterial({
            color: ship.id === 0 ? 0x55ddff : 0xff7950,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          }),
        );
        glow.rotation.x = Math.PI / 2;
        glow.position.copy(d.center).add(new T.Vector3(0, 0, 13));
        this.group.add(glow);
        this.exhaust.push(glow);
      }
      if (d.kind === "turret") {
        const pivot = new T.Group();
        pivot.position.copy(d.center);
        const barrel = new T.Mesh(
          new T.BoxGeometry(1.4, 1.4, 12),
          new T.MeshStandardMaterial({ color: 0x9aaeb5, metalness: 0.8 }),
        );
        barrel.position.z = -8;
        pivot.add(barrel);
        this.group.add(pivot);
        this.turrets.push(pivot);
      }
      if (d.kind === "missile")
        for (let i = 0; i < 4; i++) {
          const tube = new T.Mesh(
            new T.CylinderGeometry(0.8, 0.8, 3, 8),
            new T.MeshBasicMaterial({ color: 0x090f19 }),
          );
          tube.rotation.x = Math.PI / 2;
          tube.position
            .copy(d.center)
            .add(
              new T.Vector3(
                (i % 2) * 2 - 1,
                Math.floor(i / 2) * 2 - 1,
                -d.size.z / 2,
              ),
            );
          this.group.add(tube);
        }
    }
    for (const x of [-11, 11])
      for (const z of [-18, 18]) {
        const jet = new T.Mesh(
          new T.ConeGeometry(0.7, 3, 8),
          new T.MeshBasicMaterial({ color: 0x68cfff }),
        );
        jet.position.set(x, 0, z);
        jet.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.group.add(jet);
      }
    const bridge = new T.Mesh(
      new T.BoxGeometry(8, 5, 12),
      new T.MeshStandardMaterial({ color: base }),
    );
    bridge.position.set(0, 10, 13);
    this.group.add(bridge);
    const window = new T.Mesh(
      new T.BoxGeometry(7, 0.8, 0.3),
      new T.MeshBasicMaterial({ color: ship.id === 0 ? 0x6feaff : 0xff8467 }),
    );
    window.position.set(0, 11, 6.8);
    this.group.add(window);
  }
  update(time: number) {
    this.group.position.copy(this.ship.position);
    this.group.quaternion.copy(this.ship.attitude);
    for (const p of this.ship.parts) {
      const mesh = this.parts.get(p.definition.id)!;
      mesh.visible = p.hp > 0;
      const mat = mesh.material as T.MeshStandardMaterial;
      mat.emissive.setHex(p.hp < p.definition.hp * 0.35 ? 0x55190b : 0);
    }
    this.exhaust.forEach((m, i) => {
      m.visible =
        this.ship.alive &&
        this.ship
          .functional("engine")
          .some(
            (p) =>
              p.definition.id ===
              this.ship.parts.filter((p) => p.definition.kind === "engine")[i]
                .definition.id,
          );
      m.scale.y =
        (this.ship.boostTime > 0
          ? 3
          : 0.5 + this.ship.velocity.length() / 100) *
        (1 + 0.1 * Math.sin(time * 40));
    });
    this.turrets.forEach((t, i) => {
      t.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, -1),
        this.ship.turretDirections[i],
      );
      t.visible = this.parts.get(
        this.ship.parts.filter((p) => p.definition.kind === "turret")[i]
          .definition.id,
      )!.visible;
    });
  }
}
