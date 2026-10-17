// Английские фразы для описания внешности и простых перечислений.
import type {
  Build,
  EyeColor,
  Freckles,
  Glasses,
  HairColor,
  HairLength,
  HairStyle,
  HairType,
  Height,
  Makeup,
  SkinTone,
} from '../core/vocab.ts';

export const EN_HAIR_COLOR: Record<HairColor, string> = {
  black: 'black',
  'dark-brown': 'dark brown',
  brown: 'brown',
  chestnut: 'chestnut',
  auburn: 'auburn',
  'copper-red': 'copper red',
  'dark-blonde': 'dark blonde',
  'golden-blonde': 'golden blonde',
  'ash-blonde': 'ash blonde',
  'salt-and-pepper': 'salt-and-pepper',
  'silver-gray': 'silver-gray',
};

export const EN_HAIR_LENGTH: Record<HairLength, string> = {
  short: 'short',
  chin: 'chin-length',
  shoulder: 'shoulder-length',
  long: 'long',
};

export const EN_HAIR_TYPE: Record<HairType, string> = {
  straight: 'straight',
  wavy: 'wavy',
  curly: 'curly',
  coily: 'coily',
};

export const EN_HAIR_STYLE: Record<HairStyle, string> = {
  loose: 'worn loose',
  ponytail: 'tied back in a ponytail',
  'low-bun': 'pinned in a low bun',
  'messy-bun': 'piled into a loose messy bun',
  braid: 'in a loose braid',
  'half-up': 'half pulled back',
  tucked: 'tucked behind her ears',
  bangs: 'with soft bangs',
  'short-tousled': 'naturally tousled',
};

export const EN_EYE: Record<EyeColor, string> = {
  'dark-brown': 'dark brown',
  brown: 'brown',
  hazel: 'hazel',
  green: 'green',
  blue: 'blue',
  gray: 'gray',
};

export const EN_SKIN: Record<SkinTone, string> = {
  fair: 'fair',
  light: 'light',
  medium: 'medium',
  olive: 'olive',
  tan: 'tan',
  brown: 'brown',
  'deep-brown': 'deep brown',
};

export const EN_BUILD: Record<Build, string> = {
  slim: 'a slim build',
  average: 'an average build',
  athletic: 'an athletic build',
  'full-figured': 'a full-figured build',
  sturdy: 'a sturdy build',
  'plus-size': 'a plus-size build',
};

export const EN_HEIGHT: Record<Height, string> = {
  short: 'on the shorter side',
  average: 'of average height',
  tall: 'tall',
};

export const EN_MAKEUP: Record<Makeup, string> = {
  none: 'no visible makeup',
  minimal: 'minimal natural makeup',
  everyday: 'light everyday makeup',
  evening: 'defined evening makeup',
};

export const EN_FRECKLES: Record<Freckles, string> = {
  none: '',
  light: 'light freckles across her nose and cheeks',
  pronounced: 'pronounced freckles across her nose and cheeks',
};

export const EN_GLASSES: Record<Glasses, string> = {
  none: '',
  clear: 'clear-lens glasses',
  sunglasses: 'sunglasses',
};
