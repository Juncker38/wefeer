import type { SceneInput } from '../../core/types.ts';
import type { Category } from '../../core/vocab.ts';
import { scenes as cityBase } from './city.base.ts';
import { scenes as city } from './city.scenes.ts';
import { scenes as everyday } from './everyday.scenes.ts';
import { scenes as foodBase } from './food.base.ts';
import { scenes as food } from './food.scenes.ts';
import { scenes as homeBase } from './home.base.ts';
import { scenes as home } from './home.scenes.ts';
import { scenes as natureBase } from './nature.base.ts';
import { scenes as nature } from './nature.scenes.ts';
import { scenes as travel } from './travel.scenes.ts';
import { scenes as water } from './water.scenes.ts';

export const SCENE_INPUTS_BY_CATEGORY: Record<Category, readonly SceneInput[]> = {
  home: [...homeBase, ...home],
  city: [...cityBase, ...city],
  food: [...foodBase, ...food],
  nature: [...natureBase, ...nature],
  'water-sport': water,
  travel,
  everyday,
};

export const SCENE_INPUTS: readonly SceneInput[] = Object.values(SCENE_INPUTS_BY_CATEGORY).flat();
