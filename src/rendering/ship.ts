import {renderExteriorDetails} from './details';
import type {DetailMode} from '../generation/details/types';
import{decorateWeaponDebug}from'./weapons-qa';
import {renderProductionArmor} from "./production";
import { panelGeometry, renderLayeredArmor } from "./armor";
import * as THREE from "three";
import type { AnyShipBlueprint, Vec3 } from "../blueprint/types";
import { loftGeometry, moduleGeometry, beamBetween } from "./geometry";
import { renderArchitecture } from "./architecture";
import { renderPrefabs } from "./prefabs";
import { shipMaterials } from "./materials";
export type DebugView =
  | "Normal"
  | "Hull Sections"
  | "Hardpoints"
  | "Engines"
  | "Structure"
  | "Architecture"
  | "Structural Graph"
  | "Integration"
  | "Armor"
  | "Equipment"
  | "Hull Only" | "Armor Coverage" | "Armor Panels" | "Panel Seams" | "Secondary Armor" | "Hardpoint Mounts" | "Complete Ship" | "Structural Armor Only" | "Functional Exterior Only" | "Hardpoint Layout Only" | "Mount Size" | "Symmetry Groups" | "Firing Arc";
const v = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);
export function createShip(b: AnyShipBlueprint, mode: DebugView, detailMode:DetailMode="HIGH"): THREE.Group {
  if(b.schemaVersion===2&&b.productionDesign&&["Structural Armor Only","Functional Exterior Only","Hardpoint Layout Only","Mount Size","Symmetry Groups","Firing Arc"].includes(mode)){
    const copy=structuredClone(b);
    if(mode!=="Functional Exterior Only")copy.exteriorDetailPlan=undefined;
    if(mode==="Structural Armor Only"){copy.hardpoints=[];copy.engines=[];copy.surfaceFeatures=[];copy.prefabPlacements=copy.prefabPlacements?.filter(p=>p.exterior&&["integration","bow","stern"].includes(p.exterior.phase));copy.productionDesign!.finish=[];}
    if(mode==="Functional Exterior Only"){copy.productionDesign=undefined;copy.hardpoints=[];copy.prefabPlacements=copy.prefabPlacements?.filter(p=>b.productionDesign!.functionalPrefabIds.includes(p.id));copy.structuralVolumes=[];copy.structuralConnectors=[];copy.trusses=[];}
    const r=createShip(copy,"Normal",detailMode);
    if(copy.weaponLayout&&["Hardpoint Layout Only","Mount Size","Symmetry Groups","Firing Arc"].includes(mode))decorateWeaponDebug(r,copy,mode==="Symmetry Groups"?"GROUPS":mode==="Firing Arc"?"ARCS":"LAYOUT");
    return r;
  }
  if(b.schemaVersion===2&&["Hull Only","Armor Coverage","Armor Panels","Panel Seams","Secondary Armor","Hardpoint Mounts","Complete Ship"].includes(mode)) {
    const copy=structuredClone(b);
    if(mode!=="Functional Exterior Only")copy.exteriorDetailPlan=undefined;
    if(mode==="Hull Only"){copy.structuralArmorPilot=undefined;copy.functionalExterior=undefined;copy.productionDesign=undefined;copy.prefabPlacements=copy.prefabPlacements?.filter(p=>!p.assembly);}
    if(mode==="Hull Only"||mode==="Armor Panels"||mode==="Panel Seams"||mode==="Armor Coverage"||mode==="Secondary Armor") {
      copy.hardpoints=[];copy.engines=[];copy.surfaceFeatures=[];
      copy.prefabPlacements=copy.prefabPlacements?.filter(p=>p.exterior&&["integration","bow","stern"].includes(p.exterior.phase));
      copy.layeredArmor?.assemblies.forEach(a=>a.segments=a.segments.filter(s=>mode==="Hull Only"?false:mode==="Secondary Armor"?s.layer===2:s.layer===1));
    }
    const r=createShip(copy,"Normal",detailMode);
    if(mode==="Panel Seams")r.traverse(n=>{if(n instanceof THREE.Mesh&&!n.userData.armorLayer)n.material=new THREE.MeshStandardMaterial({color:0x26323b,roughness:.8});});
    if(mode==="Armor Coverage"&&copy.productionDesign){
      const palette={top:0x64c9ca,bottom:0xa994eb,left:0x74c99b,right:0xe3af6a,fore:0x8baedf,aft:0xdf8d9a};
      r.traverse(n=>{if(n instanceof THREE.Mesh&&n.userData.functionalParts){const normals=n.geometry.getAttribute("normal"),colors:number[]=[];for(let i=0;i<normals.count;i++){const x=normals.getX(i),y=normals.getY(i),z=normals.getZ(i),direction=Math.abs(z)>Math.max(Math.abs(x),Math.abs(y))?(z<0?'fore':'aft'):Math.abs(x)>Math.abs(y)?(x<0?'left':'right'):(y<0?'bottom':'top'),c=new THREE.Color(palette[direction]);colors.push(c.r,c.g,c.b);}n.geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));n.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});}});
    }
    if(mode==="Armor Coverage"&&copy.layeredArmor){
      r.traverse(n=>{if(n instanceof THREE.Mesh&&n.userData.armorLayer){
        const colors:number[]=[];for(const range of n.userData.armorSegments){const s=copy.layeredArmor!.assemblies.flatMap(a=>a.segments).find(s=>s.id===range.id)!;const direction=copy.layeredArmor!.surfaces.find(f=>f.id===s.surfaceId)!.direction;const c=new THREE.Color({top:0x64c9ca,bottom:0xa994eb,left:0x74c99b,right:0xe3af6a,fore:0x8baedf,aft:0xdf8d9a}[direction]);for(let i=0;i<range.vertexCount;i++)colors.push(c.r,c.g,c.b);}n.geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));n.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
      }});
    }
    if(mode==="Hardpoint Mounts")r.traverse(n=>{
      if(n instanceof THREE.Mesh&&n.userData.mountFoundation)n.material=new THREE.MeshStandardMaterial({color:0xe5b566,roughness:.65});
      if(n instanceof THREE.Group&&n.userData.hardpoint)n.traverse(c=>{if(c instanceof THREE.Mesh)c.material=new THREE.MeshStandardMaterial({color:0x83d6dc,roughness:.5});});
    });
    return r;
  }
  const root = new THREE.Group(),
    m = shipMaterials(b),
    l = b.order.length;
  const ghost = new THREE.MeshStandardMaterial({
    color: "#536575",
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    roughness: 0.9,
  });
  const categoryMaterial = (part: string, normal: THREE.Material) =>
    mode === "Normal" || mode === part ? normal : ghost;
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position?: Vec3,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.copy(v(position));
    root.add(mesh);
    return mesh;
  };
  if (b.schemaVersion === 2) {
    root.add(renderArchitecture(b, mode, m, ghost));
    if(b.productionDesign&&["Normal","Structure","Armor"].includes(mode))root.add(renderProductionArmor(b,m));
    if(b.structuralArmorPilot && ["Normal", "Structure", "Armor"].includes(mode)) {
      for(const c of b.structuralArmorPilot.components) {
        const mesh=add(panelGeometry(c.solid), c.role==='SIDE_BELT'?m.secondary:m.hull);
        mesh.userData.structuralArmor=c.id;mesh.castShadow=true;mesh.receiveShadow=true;
      }
      for(const mount of b.structuralArmorPilot.mounts.filter(m=>!b.weaponLayout?.supersededFoundationIds.includes(m.hardpointId))) {
        const mesh=add(panelGeometry(mount.foundation),m.secondary);
        mesh.userData.mountFoundation=mount.hardpointId;mesh.castShadow=true;mesh.receiveShadow=true;
      }
    }
    if (["Normal", "Structure", "Armor"].includes(mode) && b.layeredArmor)
      root.add(renderLayeredArmor(b, m));
    if (
      ["Normal", "Structure", "Integration", "Armor", "Equipment"].includes(
        mode,
      ) &&
      b.prefabPlacements?.length
    )
      root.add(
        renderPrefabs(
          b.prefabPlacements.filter(p=>!b.structuralArmorPilot?.supersededPrefabIds.includes(p.id)).filter(p=>!b.layeredArmor?.supersededExteriorIds.includes(p.id)).filter((p) =>
            mode === "Integration"
              ? p.exterior &&
                ["integration", "bow", "stern"].includes(p.exterior.phase)
              : mode === "Armor"
                ? p.exterior?.armorClass || (p.assembly && p.functionality==="protection")
                : mode === "Equipment"
                  ? p.assembly || p.exterior?.phase === "equipment" ||
                    p.kind === "RADIATOR_BANK"
                  : true,
          ),
          m,
        ),
      );
  } else {
    if (mode === "Hull Sections") {
      b.hullSections.forEach((s, i) => {
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.46 + i * 0.061, 0.43, 0.5),
          roughness: 0.72,
        });
        const mesh = add(loftGeometry([s.start, s.end]), material);
        root.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, 10),
            new THREE.LineBasicMaterial({ color: "#071b23" }),
          ),
        );
      });
    } else add(loftGeometry(b.stations), categoryMaterial("Structure", m.hull));
    for (const module of b.secondaryStructures) {
      const mesh = add(
        moduleGeometry(module),
        categoryMaterial(
          "Structure",
          module.kind === "armor" ? m.hull : m.secondary,
        ),
        module.position,
      );
      if (mode === "Normal" || mode === "Structure") {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry, 22),
          new THREE.LineBasicMaterial({
            color: mode === "Structure" ? "#80d5c4" : "#293945",
            transparent: true,
            opacity: 0.5,
          }),
        );
        edges.position.copy(mesh.position);
        root.add(edges);
      }
    }
    for (const t of b.trusses) {
      const start = v(t.start),
        end = v(t.end),
        cross = end.clone().sub(start);
      root.add(
        beamBetween(
          start,
          end,
          t.radius,
          categoryMaterial("Structure", m.accent),
        ),
      );
      // Two longer rails plus diagonal braces turn a support into a recognizable girder.
      const offset = new THREE.Vector3(0, l * 0.009, 0);
      for (const side of [-1, 1])
        root.add(
          beamBetween(
            start.clone().addScaledVector(offset, side),
            end.clone().addScaledVector(offset, side),
            t.radius * 0.5,
            categoryMaterial("Structure", m.secondary),
          ),
        );
      for (let i = 0; i < 3; i++)
        root.add(
          beamBetween(
            start
              .clone()
              .addScaledVector(cross, i / 3)
              .addScaledVector(offset, i % 2 ? 1 : -1),
            start
              .clone()
              .addScaledVector(cross, (i + 1) / 3)
              .addScaledVector(offset, i % 2 ? -1 : 1),
            t.radius * 0.38,
            categoryMaterial("Structure", m.accent),
          ),
        );
    }
  }
  for (const e of b.engines) {
    const g = new THREE.Group();
    g.position.copy(v(e.position));
    if (e.direction)
      g.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        v(e.direction),
      );
    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(
        e.nozzleRadius * e.bellRatio,
        e.nozzleRadius,
        e.nozzleLength,
        12,
        1,
        true,
      ),
      categoryMaterial("Engines", m.engine),
    );
    casing.rotation.x = Math.PI / 2;
    casing.position.z = e.nozzleLength / 2;
    g.add(casing);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        e.nozzleRadius * e.bellRatio,
        e.nozzleRadius * 0.12,
        6,
        16,
      ),
      categoryMaterial("Engines", m.secondary),
    );
    ring.position.z = e.nozzleLength;
    g.add(ring);
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(e.nozzleRadius * 0.99, 16),
      categoryMaterial("Engines", m.glow),
    );
    disk.position.z = e.nozzleLength * 0.96;
    g.add(disk);
    if (mode === "Engines")
      g.add(
        new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, e.nozzleLength),
          l * 0.06,
          0x71dfff,
          l * 0.013,
          l * 0.007,
        ),
      );
    root.add(g);
  }
  for (const h of b.hardpoints) {
    if(b.schemaVersion===2&&mode==="Normal"&&h.plannedMountId&&b.weaponLayout?.mounts.some(m=>m.id===h.plannedMountId))continue;
    if(b.schemaVersion===2&&mode==="Normal"&&b.functionalExterior?.replacedHardpointVisuals.includes(h.id)&&b.prefabPlacements?.some(p=>p.assembly?.equipmentIds.includes(h.id)))continue;
    if(h.surfaceMount) {
      const foundation=new THREE.Mesh(panelGeometry(h.surfaceMount.foundation.solid),categoryMaterial("Hardpoints",m.secondary));
      foundation.userData.mountFoundation=h.surfaceMount.foundation.id;foundation.receiveShadow=true;root.add(foundation);
    }
    const group = new THREE.Group();
    group.userData.hardpoint = {
      id: h.id,
      type: h.type,
      size: h.size,
      parentId: h.parentId,
      normal: h.normal,
      ...(h.surfaceMount?{armorId:h.surfaceMount.armorId,surfaceId:h.surfaceMount.surfaceId,foundationId:h.surfaceMount.foundation.id}:{}),
    };
    group.position.copy(v(h.position));
    group.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v(h.normal),
    );
    if (b.schemaVersion === 2) {
      const material = categoryMaterial("Hardpoints", m.mount),
        finish = categoryMaterial("Hardpoints", m.secondary);
      if (h.type === "Missile") {
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(h.radius * 2.2, l * 0.005, h.radius * 2.6),
          finish,
        );
        base.position.y = l * 0.002;
        group.add(base);
        for (let row = 0; row < 3; row++)
          for (const side of [-1, 1]) {
            const cell = new THREE.Mesh(
              new THREE.BoxGeometry(
                h.radius * 0.66,
                l * 0.0015,
                h.radius * 0.6,
              ),
              material,
            );
            cell.position.set(
              side * h.radius * 0.47,
              l * 0.005,
              (row - 1) * h.radius * 0.77,
            );
            group.add(cell);
          }
      } else if (h.type === "Sensor") {
        const blister = new THREE.Mesh(
          new THREE.SphereGeometry(h.radius, 10, 6),
          finish,
        );
        blister.scale.set(1.4, 0.6, 0.95);
        blister.position.y = l * 0.001;
        group.add(blister);
      } else {
        const barbette = new THREE.Mesh(
          new THREE.CylinderGeometry(
            h.radius * 0.86,
            h.radius * 1.16,
            h.radius * 0.32,
            8,
          ),
          finish,
        );
        barbette.position.y = h.radius * 0.08;
        group.add(barbette);
        const well = new THREE.Mesh(
          new THREE.CylinderGeometry(
            h.radius * 0.67,
            h.radius * 0.67,
            l * 0.001,
            12,
          ),
          material,
        );
        well.position.y = h.radius * 0.25;
        group.add(well);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(h.radius * 0.73, h.radius * 0.095, 4, 12),
          finish,
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = h.radius * 0.26;
        group.add(ring);
      }
    } else {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(
          h.radius,
          h.radius * 1.12,
          l * 0.004,
          h.type === "Missile" ? 4 : 8,
        ),
        categoryMaterial("Hardpoints", m.mount),
      );
      plate.position.y = l * 0.001;
      group.add(plate);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(h.radius * 0.79, l * 0.0012, 4, 12),
        categoryMaterial("Hardpoints", m.accent),
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = l * 0.0035;
      group.add(rim);
      if (h.type === "Sensor") {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(
            h.radius * 1.5,
            l * (0.006 + b.order.priorities.sensor * 0.00013),
            h.radius * 0.35,
          ),
          categoryMaterial("Hardpoints", m.accent),
        );
        p.position.y = l * 0.006;
        group.add(p);
      }
    }
    if (h.type === "Spinal") {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(
          h.radius * 0.7,
          h.radius * 0.95,
          l * 0.052,
          8,
          1,
          true,
        ),
        categoryMaterial("Hardpoints", m.secondary),
      );
      tube.position.y = l * 0.02;
      group.add(tube);
    }
    root.add(group);
    if (mode === "Hardpoints") {
      group.userData.debugMarker = true;
      const color =
        h.type === "Missile"
          ? 0xffaf64
          : h.type === "Sensor"
            ? 0x9effcc
            : 0x79bdff;
      root.add(
        new THREE.ArrowHelper(
          v(h.normal),
          v(h.position),
          l * 0.043,
          color,
          l * 0.01,
          l * 0.005,
        ),
      );
    }
  }
  if (mode === "Normal")
    for (const f of b.surfaceFeatures) {
      const detailGroup = new THREE.Group();
      detailGroup.position.copy(v(f.position));
      if (f.normal)
        detailGroup.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          v(f.normal),
        );
      detailGroup.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(f.size.x, f.size.y, f.size.z),
          f.kind === "vls"
            ? m.accent
            : f.kind === "vent"
              ? m.mount
              : m.secondary,
        ),
      );
      if (f.kind === "vent" || f.kind === "vls")
        for (let i = 0; i < 4; i++) {
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(
              f.size.x * 0.84,
              f.size.y * 0.7,
              f.size.z * 0.08,
            ),
            m.mount,
          );
          bar.position.set(0, f.size.y, (i - 1.5) * f.size.z * 0.2);
          detailGroup.add(bar);
        }
      root.add(detailGroup);
    }
  if(b.schemaVersion===2&&b.exteriorDetailPlan&&["Normal","Equipment"].includes(mode))root.add(renderExteriorDetails(b,m,detailMode));
  root.userData.blueprint = b;
  return root;
}
export function disposeShip(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if(node instanceof THREE.Sprite){node.material.map?.dispose();materials.add(node.material);}
    if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
      node.geometry.dispose();
      for (const m of Array.isArray(node.material)
        ? node.material
        : [node.material])
        materials.add(m);
    }
  });
  materials.forEach((m) => m.dispose());
}
