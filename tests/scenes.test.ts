import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../src/core/vocab.ts';
import { EXAMPLE_SCENES } from '../src/data/scenes/_examples.ts';
import { SCENE_INPUTS, SCENE_INPUTS_BY_CATEGORY } from '../src/data/scenes/inputs.ts';
import { ID_PREFIX, validateLibrary, validateSceneInput } from '../src/data/validate.ts';

describe('образцы из руководства авторов', () => {
  it.each(EXAMPLE_SCENES.map((s) => [s.id, s] as const))('%s проходит валидацию', (_id, s) => {
    expect(validateSceneInput(s)).toEqual([]);
  });
});

describe.each(CATEGORIES)('данные сцен: %s', (cat) => {
  const scenes = SCENE_INPUTS_BY_CATEGORY[cat];
  it('категория не пуста и сцены принадлежат ей', () => {
    expect(scenes.length).toBeGreaterThan(0);
    for (const s of scenes) {
      expect(s.cat).toBe(cat);
      expect(s.id.startsWith(`${ID_PREFIX[cat]}-`)).toBe(true);
    }
  });
  if (scenes.length > 0) {
    it.each(scenes.map((s) => [s.id, s] as const))('%s', (_id, s) => {
      expect(validateSceneInput(s)).toEqual([]);
    });
  }
});

describe('библиотека сцен целиком', () => {
  it('содержит не менее 200 уникальных сцен и сбалансирована', () => {
    expect(validateLibrary(SCENE_INPUTS, { min: 200 })).toEqual([]);
  });
});
