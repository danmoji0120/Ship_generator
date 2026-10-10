import {renderEquipmentPreview} from './equipment-preview';
import type {PreviewPlan} from '../equipment-preview/fitment';
import {setSurfacePresentation} from './textured-surface';
import type {FinishProfile} from '../generation/appearance/types';
import {setDetailVisibility} from './details';
import type {DetailMode} from '../generation/details/types';
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { AnyShipBlueprint } from "../blueprint/types";
import { createShip, disposeShip, type DebugView } from "./ship";
export class ShipViewer {
  onHardpointSelect?: (id:string)=>void;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 10000);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private ship?: THREE.Group;
  private equipmentPreview?: THREE.Group;
  private previewPlan?: PreviewPlan;
  private previewDebug=false;
  private blueprint?: AnyShipBlueprint;
  private resizeObserver: ResizeObserver;
  private detailMode:DetailMode="AUTO";
  private finish?:FinishProfile;
  private mode: DebugView = "Normal";
  private radius = 100;
  private disposed = false;
  private armorShadowLight?: THREE.DirectionalLight;
  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "생성된 우주함선 3D 관찰 화면",
    );
    this.renderer.domElement.setAttribute("tabindex", "0");
    container.append(this.renderer.domElement);
    let down={x:0,y:0};this.renderer.domElement.addEventListener("pointerdown",e=>{down={x:e.clientX,y:e.clientY};});
    this.renderer.domElement.addEventListener("pointerup",e=>{if(!this.ship||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const rect=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);const markers:THREE.Object3D[]=[];this.ship.traverse(n=>{if(n.userData.modularSlotIds)markers.push(n);});const hit=ray.intersectObjects(markers,false)[0];if(hit?.instanceId!==undefined)this.onHardpointSelect?.(hit.object.userData.modularSlotIds[hit.instanceId]);});
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.scene.add(new THREE.HemisphereLight(0xc2d9ed, 0x4c5365, 2.6));
    for (const [pos, intensity, color] of [
      [[-250, 400, -300], 4.5, 0xffebcc],
      [[350, 100, 250], 3, 0xa4ccff],
      [[-100, -250, 100], 1.8, 0x9eaabf],
    ] as const) {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(pos[0], pos[1], pos[2]);
      if (intensity === 4.5) {
        this.armorShadowLight = light;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0012;
      }
      this.scene.add(light);
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }
  private resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (w && h) {
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.blueprint) this.fit(false);
    }
  }
  private animate = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);
    this.controls.update();
    if(this.ship){const pixels=this.radius*2/Math.max(1,this.camera.position.distanceTo(this.controls.target))/Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*this.container.clientHeight/2;setDetailVisibility(this.ship,this.detailMode,pixels);}
    this.renderer.render(this.scene, this.camera);
  };
  show(b: AnyShipBlueprint, reset = true) {
    this.setEquipmentPreview();
    this.blueprint = b;
    if (this.ship) {
      this.scene.remove(this.ship);
      disposeShip(this.ship);
    }
    this.ship = createShip(b, this.mode,this.detailMode);
    setSurfacePresentation(this.ship,this.finish,this.mode==='Surface Texture'?'TEXTURE':this.mode==='Decal Markings'?'DECAL':'NONE');
    this.scene.add(this.ship);
    // Only new stored armor opts into its contact shadows. Historical Blueprint rendering is unchanged.
    const shadows = Boolean(b.schemaVersion===2&&(b.layeredArmor?.budget.segmentCount||b.productionDesign?.armor.length));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.armorShadowLight) {
      this.armorShadowLight.castShadow = shadows;
      const c = this.armorShadowLight.shadow.camera, l = b.order.length;
      c.left = c.bottom = -l * 1.2; c.right = c.top = l * 1.2;
      c.near = .1; c.far = l * 5 + 1000; c.updateProjectionMatrix();
      this.armorShadowLight.shadow.normalBias = l * .0006;
    }
    if (shadows) this.ship.traverse(n => { if(n instanceof THREE.Mesh) n.receiveShadow = true; });
    if (reset) this.fit(true);
  }
  snapshot(b: AnyShipBlueprint, mode: DebugView = "Normal") {
    this.mode = mode;
    this.show(b);
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }
  setSurfaceFinish(finish:FinishProfile){this.finish=finish;if(this.ship)setSurfacePresentation(this.ship,finish,this.mode==='Surface Texture'?'TEXTURE':this.mode==='Decal Markings'?'DECAL':'NONE');}
  setDetailMode(mode:DetailMode){this.detailMode=mode;if(this.ship)setDetailVisibility(this.ship,mode,Infinity);}
  setEquipmentPreview(plan?:PreviewPlan,debug=false){
    if(this.equipmentPreview){this.scene.remove(this.equipmentPreview);disposeShip(this.equipmentPreview);this.equipmentPreview=undefined;}
    this.previewPlan=plan;this.previewDebug=debug;
    if(plan&&this.blueprint?.schemaVersion===2){this.equipmentPreview=renderEquipmentPreview(plan,this.blueprint,debug);this.scene.add(this.equipmentPreview);}
  }
  setMode(mode: DebugView) {
    this.mode = mode;
    const plan=this.previewPlan,debug=this.previewDebug;
    if (this.blueprint) this.show(this.blueprint, false);
    if(plan)this.setEquipmentPreview(plan,debug);
  }
  fit(reset = true) {
    if (!this.ship) return;
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    const box = new THREE.Box3().setFromObject(this.ship),
      center = box.getCenter(new THREE.Vector3());
    this.radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const halfVertical = THREE.MathUtils.degToRad(this.camera.fov / 2),
      halfHorizontal = Math.atan(Math.tan(halfVertical) * this.camera.aspect),
      sphereDistance =
        (this.radius / Math.sin(Math.min(halfVertical, halfHorizontal))) * 1.08;
    const direction = reset
      ? new THREE.Vector3(-1.08, 0.88, -1.25).normalize()
      : this.camera.position.clone().sub(this.controls.target).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize(),
      up = direction.clone().cross(right).normalize();
    let distance = 0;
    this.ship.updateMatrixWorld(true);
    const corner = new THREE.Vector3();
    this.ship.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const vertices = node.geometry.getAttribute("position");
        for (let i = 0; i < vertices.count; i++) {
          corner
            .fromBufferAttribute(vertices, i)
            .applyMatrix4(node.matrixWorld)
            .sub(center);
          distance = Math.max(
            distance,
            Math.abs(corner.dot(right)) / Math.tan(halfHorizontal) +
              corner.dot(direction),
            Math.abs(corner.dot(up)) / Math.tan(halfVertical) +
              corner.dot(direction),
          );
        }
      }
    });
    if (!Number.isFinite(distance) || distance <= 0) distance = sphereDistance;
    distance *= 1.14;
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.near = this.radius * 0.003;
    this.camera.far = this.radius * 60;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.radius * 1.08;
    this.controls.maxDistance = this.radius * 15;
    this.controls.update();
    this.controls.enableDamping = damping;
  }
  view(direction: "top" | "rear" | "iso" | "front" | "side") {
    if (direction === "iso") this.fit();
    else {
      const distance = this.camera.position.distanceTo(this.controls.target);
      this.camera.position
        .copy(this.controls.target)
        .addScaledVector(
          direction === "top"
            ? new THREE.Vector3(0, 1, 0.001)
            : direction === "front"
              ? new THREE.Vector3(0, 0.05, -1).normalize()
              : direction === "side"
                ? new THREE.Vector3(1, 0.05, 0).normalize()
                : new THREE.Vector3(0, 0.12, 1).normalize(),
          distance,
        );
      this.controls.update();
      this.fit(false);
    }
  }
  getDiagnostics() {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      camera: [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ],
      radius: this.radius,
      geometryFinite: this.ship
        ? (() => {
            let valid = true;
            this.ship!.traverse((n) => {
              if (n instanceof THREE.Mesh) {
                const p = n.geometry.getAttribute("position");
                for (let i = 0; i < p.array.length; i++)
                  if (!Number.isFinite(p.array[i])) valid = false;
              }
            });
            return valid;
          })()
        : false,
    };
  }
  dispose() {
    this.setEquipmentPreview();
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.ship) disposeShip(this.ship);
    this.renderer.dispose();
  }
}
