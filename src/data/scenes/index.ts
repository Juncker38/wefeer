import type { Scene } from '../../core/types.ts';
import { normalizeScene } from './define.ts';
import { SCENE_INPUTS } from './inputs.ts';

export const ALL_SCENES: readonly Scene[] = SCENE_INPUTS.map(normalizeScene);
export const SCENE_BY_ID: ReadonlyMap<string, Scene> = new Map(ALL_SCENES.map((s) => [s.id, s]));
