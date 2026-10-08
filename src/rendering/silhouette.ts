import * as THREE from "three";
import type { ShipBlueprint } from "../blueprint/types";
import { createShip, disposeShip } from "./ship";
export type SilhouetteView = "TOP" | "SIDE" | "FRONT" | "ISOMETRIC";
/** QA-only orthographic camera. Old saved blueprints still use their own stored geometry. */
export class SilhouetteRenderer {
  private renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  private scene = new THREE.Scene();
  private ship?: THREE.Group;
  constructor(size = 320) {
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;
  }
  capture(
    b: ShipBlueprint,
    view: SilhouetteView,
    scale: "normalized" | "fixed" = "normalized",
    mass = false,
  ) {
    if (this.ship) {
      this.scene.remove(this.ship);
      disposeShip(this.ship);
    }
    const visible = structuredClone(b);
    visible.hardpoints = [];
    visible.surfaceFeatures = [];
    // Keep constructed hull / armor / propulsion envelopes; remove equipment and surface greebles.
    visible.prefabPlacements = visible.prefabPlacements?.filter(
      (p) => p.exterior && p.exterior.phase !== "equipment",
    );
    this.ship = createShip(visible, "Normal");
    this.ship.traverse((n) => {
      if (n instanceof THREE.Line || n instanceof THREE.LineSegments)
        n.visible = false;
      if (n instanceof THREE.Mesh) {
        let color = 0x000000;
        if (mass) {
          let ancestor: THREE.Object3D | null = n;
          let id: string | undefined;
          while (ancestor) {
            id ??= ancestor.userData.structureId;
            ancestor = ancestor.parent;
          }
          const role = b.macroDesign?.majorModuleRoles.find(
            (m) => m.id === id,
          )?.role;
          color =
            role === "dominant"
              ? 0xa93936
              : role === "supporting"
                ? 0x296eb0
                : role === "functional"
                  ? 0xd19633
                  : 0x536471;
        }
        const old = Array.isArray(n.material) ? n.material : [n.material];
        old.forEach((m) => m.dispose());
        n.material = new THREE.MeshBasicMaterial({ color });
      }
    });
    this.scene.add(this.ship);
    this.ship.updateMatrixWorld(true);
    const direction =
      view === "TOP"
        ? new THREE.Vector3(0, 1, 0)
        : view === "SIDE"
          ? new THREE.Vector3(1, 0, 0)
          : view === "FRONT"
            ? new THREE.Vector3(0, 0, -1)
            : new THREE.Vector3(-1.08, 0.88, -1.25).normalize();
    const up =
      view === "TOP" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = up.clone().cross(direction).normalize(),
      vertical = direction.clone().cross(right).normalize();
    let minU = Infinity,
      minV = Infinity,
      maxU = -Infinity,
      maxV = -Infinity;
    const point = new THREE.Vector3();
    this.ship.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        const p = n.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          point.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld);
          const u = point.dot(right),
            v = point.dot(vertical);
          minU = Math.min(minU, u);
          maxU = Math.max(maxU, u);
          minV = Math.min(minV, v);
          maxV = Math.max(maxV, v);
        }
      }
    });
    const extent =
      scale === "fixed"
        ? b.order.length * 1.65
        : Math.max(maxU - minU, maxV - minV) * 1.12;
    const center =
      scale === "fixed"
        ? new THREE.Vector3()
        : right
            .clone()
            .multiplyScalar((minU + maxU) / 2)
            .addScaledVector(vertical, (minV + maxV) / 2);
    const camera = new THREE.OrthographicCamera(
      -extent / 2,
      extent / 2,
      extent / 2,
      -extent / 2,
      0.01,
      b.order.length * 20,
    );
    camera.up.copy(up);
    camera.position.copy(center).addScaledVector(direction, b.order.length * 5);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    this.renderer.render(this.scene, camera);
    return {
      pixels: this.renderer.domElement.toDataURL("image/png"),
      projection: "orthographic" as const,
      scale,
      frameMeters: extent,
      projectedWidth: maxU - minU,
      projectedHeight: maxV - minV,
      view,
    };
  }
  dispose() {
    if (this.ship) disposeShip(this.ship);
    this.renderer.dispose();
  }
}
