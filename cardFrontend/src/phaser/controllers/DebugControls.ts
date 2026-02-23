export const DEBUG_SCENARIO_PATHS: string[] = [
  'GD01/GD01-123/deploy_add_shield_then_rest_enemy_hp_le_3',
  'GD02/GD02-075/attack_rest_enemy_unit_lv_le_4',
  'GD02/GD02-120/action_heal_aeug_unit_or_base',
  'GD03/GD03-123/deploy_add_shield_then_rest_enemy_level_le_3_if_friendly_jupitris_unit_in_play',
  'GD03/GD03-123/deploy_add_shield_no_rest_without_friendly_jupitris'
];

export function resolveScenarioPathIndex(path?: string): number {
  if (!path) return 0;
  const idx = DEBUG_SCENARIO_PATHS.indexOf(path);
  return idx >= 0 ? idx : 0;
}

export function getNextScenarioPath(currentPath?: string): string {
  if (DEBUG_SCENARIO_PATHS.length === 0) return '';
  const currentIdx = resolveScenarioPathIndex(currentPath);
  const nextIdx = (currentIdx + 1) % DEBUG_SCENARIO_PATHS.length;
  return DEBUG_SCENARIO_PATHS[nextIdx];
}
