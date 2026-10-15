import type { ShipBlueprint } from '../blueprint/types';

export interface PhysicalDiagnostics {
  totalMs: number;
  stages: Record<string, { ms: number; calls: number }>;
  cache: { hits: number; misses: number };
}
let enabled = false;
let current: PhysicalDiagnostics | undefined;
const results = new WeakMap<ShipBlueprint, PhysicalDiagnostics>();

export const setPhysicalProfilingEnabled = (value: boolean) => { enabled = value; };
export const physicalProfilingEnabled = () => enabled;
export const physicalDiagnostics = (b: ShipBlueprint) => results.get(b);
export const activePhysicalDiagnostics = () => current;

export function recordPhysicalStage(name: string, ms: number) {
  if (!current) return;
  const stage = current.stages[name] ??= { ms: 0, calls: 0 };
  stage.ms += ms;
  stage.calls++;
}
export function timedPhysical<T>(name: string, fn: () => T): T {
  if (!current) return fn();
  const start = performance.now();
  try { return fn(); }
  finally { recordPhysicalStage(name, performance.now() - start); }
}
/** Runtime-only opt-in profiling; never changes deterministic design JSON. */
export function capturePhysicalGeneration(fn: () => ShipBlueprint) {
  if (!enabled || current) return fn();
  const diagnostics: PhysicalDiagnostics = { totalMs: 0, stages: {}, cache: { hits: 0, misses: 0 } };
  const start = performance.now();
  current = diagnostics;
  try {
    const blueprint = fn();
    diagnostics.totalMs = performance.now() - start;
    results.set(blueprint, diagnostics);
    return blueprint;
  } finally { current = undefined; }
}
