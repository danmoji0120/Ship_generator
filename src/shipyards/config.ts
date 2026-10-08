import type {
  Profile,
  ArchitectureGrammar,
  ShapeKind,
  JoinType,
} from "../blueprint/types";
export interface Shipyard {
  shapePreferences: readonly ShapeKind[];
  joinPreferences: readonly JoinType[];
  structuralMultiplier: number;
  id: string;
  name: string;
  doctrine: string;
  description: string;
  width: number;
  height: number;
  profiles: Profile[];
  structure: "heavy" | "swift" | "truss" | "clean";
  engines: readonly number[];
  armor: number;
  colors: [string, string, string];
  roughness: number;
  architectureWeights: Record<ArchitectureGrammar, number>;
}
export const SHIPYARDS: Shipyard[] = [
  {
    id: "aegis",
    shapePreferences: [
      "CHAMFERED_BOX",
      "FLATTENED_HEX",
      "WEDGE",
      "COMPOUND_LOFT",
    ],
    joinPreferences: ["OVERLAP", "ARMORED_COLLAR", "FLUSH"],
    structuralMultiplier: 1.35,
    architectureWeights: {
      MONOLITHIC: 8,
      BLOCK_ASSEMBLY: 9,
      SPINE_AND_MODULES: 2,
      TRUSS_POD: 0.35,
      TWIN_HULL: 1.5,
      CORE_AND_NACELLES: 1,
      STACKED_BLOCKS: 7,
      HYBRID: 1,
    },
    name: "AEGIS NAVAL",
    doctrine: "Heavy Naval",
    description: "넓은 장갑 선체 · 대형 추진기 · 정규 해군 설계",
    width: 1.32,
    height: 1.18,
    profiles: ["chamfer", "box"],
    structure: "heavy",
    engines: [1, 2, 4],
    armor: 1.3,
    colors: ["#98a8b6", "#526879", "#e5b56b"],
    roughness: 0.67,
  },
  {
    id: "vesper",
    shapePreferences: ["TAPERED_PRISM", "LONG_LOFT", "WEDGE", "HEX_PRISM"],
    joinPreferences: ["TRANSITION", "STRUCTURAL_NECK", "NACELLE_MOUNT"],
    structuralMultiplier: 1,
    architectureWeights: {
      MONOLITHIC: 1.5,
      BLOCK_ASSEMBLY: 2,
      SPINE_AND_MODULES: 8,
      TRUSS_POD: 2,
      TWIN_HULL: 5,
      CORE_AND_NACELLES: 10,
      STACKED_BLOCKS: 0.4,
      HYBRID: 2,
    },
    name: "VESPER DYNAMICS",
    doctrine: "High Mobility",
    description: "화살촉 선수 · 좁은 중심축 · 분산 고출력 추진",
    width: 0.73,
    height: 0.78,
    profiles: ["diamond", "hex"],
    structure: "swift",
    engines: [4, 6],
    armor: 0.5,
    colors: ["#ccd3d7", "#546877", "#80d5ea"],
    roughness: 0.46,
  },
  {
    id: "forge",
    shapePreferences: ["BOX", "CLIPPED_BOX", "HEX_PRISM", "ARMORED_CYLINDER"],
    joinPreferences: ["TRUSS", "BOOM", "STRUCTURAL_NECK", "FLUSH"],
    structuralMultiplier: 1.15,
    architectureWeights: {
      MONOLITHIC: 1,
      BLOCK_ASSEMBLY: 7,
      SPINE_AND_MODULES: 6,
      TRUSS_POD: 11,
      TWIN_HULL: 3,
      CORE_AND_NACELLES: 4,
      STACKED_BLOCKS: 4,
      HYBRID: 4,
    },
    name: "FORGE UNION",
    doctrine: "Industrial / Truss",
    description: "분할 모듈 · 노출 트러스 · 외부 엔진 나셀",
    width: 0.87,
    height: 1.0,
    profiles: ["rounded", "box"],
    structure: "truss",
    engines: [2, 4, 6],
    armor: 0.8,
    colors: ["#b5aca0", "#665f57", "#ed9a54"],
    roughness: 0.78,
  },
  {
    id: "serein",
    shapePreferences: [
      "COMPOUND_LOFT",
      "TAPERED_PRISM",
      "FLATTENED_HEX",
      "WEDGE",
    ],
    joinPreferences: ["TRANSITION", "RECESSED", "FLUSH"],
    structuralMultiplier: 1.05,
    architectureWeights: {
      MONOLITHIC: 8,
      BLOCK_ASSEMBLY: 2,
      SPINE_AND_MODULES: 8,
      TRUSS_POD: 1,
      TWIN_HULL: 7,
      CORE_AND_NACELLES: 4,
      STACKED_BLOCKS: 1.5,
      HYBRID: 1.5,
    },
    name: "SEREIN SYSTEMS",
    doctrine: "Advanced / Clean",
    description: "낮은 렌즈형 장갑 · 매립 마운트 · 연속적인 표면",
    width: 1.08,
    height: 0.65,
    profiles: ["flattened", "hex"],
    structure: "clean",
    engines: [1, 2, 4],
    armor: 0.75,
    colors: ["#d6dddc", "#7b949a", "#89e2c9"],
    roughness: 0.34,
  },
];
export function getShipyard(id: string) {
  const y = SHIPYARDS.find((y) => y.id === id);
  if (!y) throw new Error(`Unknown shipyard: ${id}`);
  return y;
}
