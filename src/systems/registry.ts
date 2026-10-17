import type { EquipmentType, SystemDefinition } from './types';
/** Initial game design specifications, not measured reactor/material engineering.
 * Total equipment mass includes unmodelled machinery; envelope is NOT solid metal. */
const define = (type: EquipmentType, size: number[], massKg: number, demandMW: number, capacity: number, capacityUnit: SystemDefinition['capacityUnit'], priority: number, costIndex: number, description: string): SystemDefinition => ({ type, sizeM: { x: size[0], y: size[1], z: size[2] }, massKg, materialId: 'HIGH_STRENGTH_STRUCTURAL_STEEL', massBasis: 'SPECIFICATION_DRY_MASS_NOT_HOMOGENEOUS_VOLUME', demandMW, capacity, capacityUnit, priority, costIndex, description });
export const SYSTEM_REGISTRY: Readonly<Record<EquipmentType, Readonly<SystemDefinition>>> = Object.freeze({
    POWER_GENERATOR: define('POWER_GENERATOR', [3, 3, 5], 18000, 0, 120, 'MW', 0, 8, 'SF generator; fuel/cooling/heat rejection reserved for future models'),
    POWER_DISTRIBUTION: define('POWER_DISTRIBUTION', [1.2, 1.5, 2], 2200, 0, 100, 'MW', 0, 4, 'Finite input/output throughput; no power generation'),
    ENERGY_STORAGE: { ...define('ENERGY_STORAGE', [1.2, 1.5, 2], 3000, 0, 180, 'MJ', 5, 6, 'Finite rechargeable reserve; MW × seconds = MJ'), storageOutputMW: 12 },
    COMMAND_CONTROL: define('COMMAND_CONTROL', [1.2, 1.5, 2], 1000, 2, 1, 'AUTHORITY', 0, 5, 'Powered command source'),
    PROPULSION_CONTROL: define('PROPULSION_CONTROL', [1.2, 1.5, 2], 1300, 15, 1, 'AUTHORITY', 1, 5, 'Authority for referenced existing engines; no new thrust model'),
    MANEUVER_CONTROL: define('MANEUVER_CONTROL', [1.2, 1.5, 2], 800, 6, 1, 'AUTHORITY', 2, 5, 'Authority for existing visual RCS; not 6DOF performance'),
    FIRE_CONTROL: define('FIRE_CONTROL', [1.2, 1.5, 2], 900, 5, 8, 'CHANNELS', 3, 6, 'Channels for actual installed weapons; no automatic weapon installation'),
    SENSOR_PROCESSING: define('SENSOR_PROCESSING', [1.2, 1.5, 2], 700, 4, 8, 'CHANNELS', 4, 6, 'Processing only; no detection range or automatic combat sensor'),
});
for (const d of Object.values(SYSTEM_REGISTRY)) {
    Object.freeze(d.sizeM);
    Object.freeze(d);
}
export function systemSpecification(type: EquipmentType, mode: string): SystemDefinition {
    const s: SystemDefinition = structuredClone(SYSTEM_REGISTRY[type]);
    if (mode === 'MOBILITY') {
        s.materialId = 'LIGHT_STRUCTURAL_ALLOY';
        s.massKg *= .72;
        s.costIndex *= 1.25;
    }
    if (mode === 'ECONOMY') {
        s.costIndex *= .8;
        if (type === 'POWER_GENERATOR')
            s.capacity = 80;
    }
    return s;
}
