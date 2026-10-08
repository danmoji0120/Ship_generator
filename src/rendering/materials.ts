import * as THREE from "three";
import type { AnyShipBlueprint } from "../blueprint/types";
export function shipMaterials(b: AnyShipBlueprint) {
  const theme = b.materialTheme;
  const finish=b.schemaVersion===2?b.functionalExterior?.finishPalette:undefined;
  const hull = new THREE.MeshStandardMaterial({
    color: finish?.hull??theme.hull,
    metalness: 0.48,
    roughness: theme.roughness,
  });
  // Object-space panels: no UV editor or texture asset; repeating bands follow the ship axis.
  if(!(b.schemaVersion===2&&b.functionalExterior))hull.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 shipPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nshipPosition = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 shipPosition;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
   float stripe = abs(fract(shipPosition.z / ${theme.panelScale.toFixed(4)} + .5) - .5);
   float seam = 1.0 - smoothstep(.007, .018, stripe);
   float panel = floor(shipPosition.z / ${theme.panelScale.toFixed(4)});
   float variation = mod(panel, 3.0) * .025;
   diffuseColor.rgb *= 1.0 - seam * .25 - variation;
  `,
      );
  };
  const secondary = new THREE.MeshStandardMaterial({
    color: finish?.secondary??theme.secondary,
    roughness: theme.roughness,
    metalness: 0.5,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: theme.accent,
    roughness: 0.5,
    metalness: 0.3,
  });
  const mount = new THREE.MeshStandardMaterial({
    color: finish?.mount??"#33434e",
    metalness: 0.65,
    roughness: 0.5,
  });
  const engine = new THREE.MeshStandardMaterial({
    color: finish?.engine??"#15252e",
    roughness: 0.4,
    metalness: 0.8,
  });
  const glow = new THREE.MeshBasicMaterial({ color: finish?.glow??theme.engine });
  const armor=new THREE.MeshStandardMaterial({color:finish?.armor??new THREE.Color(theme.hull).multiplyScalar(1.06),roughness:.64,metalness:.35});
  return { armor, hull, secondary, accent, mount, engine, glow };
}
