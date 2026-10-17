// Единый словарь значений. Все перечисления — `as const`, чтобы типы выводились из данных.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const WEATHERS = [
  'clear',
  'partly-cloudy',
  'overcast',
  'rain',
  'after-rain',
  'fog',
  'snow',
  'windy',
  'heat',
  'frost',
] as const;
export type Weather = (typeof WEATHERS)[number];

export const TIMES = ['dawn', 'morning', 'day', 'golden-hour', 'dusk', 'evening', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];

export const CLIMATES = ['temperate', 'warm', 'cold'] as const;
export type Climate = (typeof CLIMATES)[number];

export const CATEGORIES = ['home', 'city', 'food', 'nature', 'water-sport', 'travel', 'everyday'] as const;
export type Category = (typeof CATEGORIES)[number];

export const RARITIES = ['common', 'uncommon', 'rare'] as const;
export type Rarity = (typeof RARITIES)[number];

export const ENVS = ['indoor', 'outdoor', 'covered'] as const;
export type Env = (typeof ENVS)[number];

export const VIEWS = ['open', 'window', 'none'] as const;
export type View = (typeof VIEWS)[number];

export const POSTURES = ['stand', 'sit', 'walk', 'move', 'lean', 'crouch'] as const;
export type Posture = (typeof POSTURES)[number];

export const ANGLES = [
  'front',
  'three-quarter',
  'profile',
  'back-head-turn',
  'side',
  'slightly-above',
  'slightly-below',
  'eye-level',
  'distant',
  'close-up',
  'dynamic-tilt',
  'face-limited',
] as const;
export type Angle = (typeof ANGLES)[number];

export const OUTFIT_TAGS = [
  'casual',
  'cozy',
  'smart',
  'evening',
  'sport',
  'dance',
  'swim',
  'beach',
  'ski',
  'hiking',
  'work',
  'travel',
] as const;
export type OutfitTag = (typeof OUTFIT_TAGS)[number];

export const SCENE_TAGS = [
  'trees',
  'grass',
  'pavement',
  'stone',
  'wood',
  'water',
  'sand',
  'glass',
  'crowd',
  'vehicle',
  'soil',
  'snowbound',
] as const;
export type SceneTag = (typeof SCENE_TAGS)[number];

export const CAPTURES = [
  'selfie-arm',
  'selfie-mirror',
  'selfie-reflection',
  'front-camera',
  'tripod-timer',
  'by-acquaintance',
  'by-friend-walk',
  'candid',
] as const;
export type Capture = (typeof CAPTURES)[number];

export const FRAMINGS = ['close-up', 'portrait', 'waist-up', 'full-body', 'seated', 'in-motion'] as const;
export type Framing = (typeof FRAMINGS)[number];

export const GAZES = ['camera', 'away', 'down', 'object', 'side'] as const;
export type Gaze = (typeof GAZES)[number];

export const EMOTIONS = [
  'natural-smile',
  'calm-friendly',
  'laugh',
  'playful',
  'surprise',
  'thoughtful',
  'neutral',
  'sad',
  'crying',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const STYLES = ['smartphone', 'camera', 'film', 'documentary'] as const;
export type Style = (typeof STYLES)[number];

export const COLORS = ['natural', 'bw', 'muted', 'film'] as const;
export type ColorMode = (typeof COLORS)[number];

export const SHARPNESS = ['sharp', 'moderate', 'blur'] as const;
export type Sharpness = (typeof SHARPNESS)[number];

export const LENGTHS = ['short', 'standard', 'detailed'] as const;
export type Length = (typeof LENGTHS)[number];

export const DETAIL_LEVELS = ['low', 'medium', 'high'] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const PROFILES = ['universal', 'gpt-image', 'nano-banana', 'seedance'] as const;
export type Profile = (typeof PROFILES)[number];

export const BALANCES = ['variety', 'balanced', 'realism'] as const;
export type Balance = (typeof BALANCES)[number];

export const MODES = ['new', 'character', 'series', 'chaos'] as const;
export type Mode = (typeof MODES)[number];

export const SERIES_THEMES = ['auto', 'day-in-city', 'trip', 'weekend-home', 'outdoor-day'] as const;
export type SeriesTheme = (typeof SERIES_THEMES)[number];

export const RATIO_IDS = ['9:16', '16:9', '4:3', '3:4', '1:1', '4:5', '5:4', '2:3', '3:2', '21:9'] as const;
export type RatioId = (typeof RATIO_IDS)[number];

export const ORIENTATIONS = ['vertical', 'horizontal', 'square'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

// Внешность
export const HAIR_COLORS = [
  'black',
  'dark-brown',
  'brown',
  'chestnut',
  'auburn',
  'copper-red',
  'dark-blonde',
  'golden-blonde',
  'ash-blonde',
  'salt-and-pepper',
  'silver-gray',
] as const;
export type HairColor = (typeof HAIR_COLORS)[number];

export const HAIR_LENGTHS = ['short', 'chin', 'shoulder', 'long'] as const;
export type HairLength = (typeof HAIR_LENGTHS)[number];

export const HAIR_TYPES = ['straight', 'wavy', 'curly', 'coily'] as const;
export type HairType = (typeof HAIR_TYPES)[number];

export const HAIR_STYLES = [
  'loose',
  'ponytail',
  'low-bun',
  'messy-bun',
  'braid',
  'half-up',
  'tucked',
  'bangs',
  'short-tousled',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const EYE_COLORS = ['dark-brown', 'brown', 'hazel', 'green', 'blue', 'gray'] as const;
export type EyeColor = (typeof EYE_COLORS)[number];

export const SKIN_TONES = ['fair', 'light', 'medium', 'olive', 'tan', 'brown', 'deep-brown'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

export const BUILDS = ['slim', 'average', 'athletic', 'full-figured', 'sturdy', 'plus-size'] as const;
export type Build = (typeof BUILDS)[number];

export const HEIGHTS = ['short', 'average', 'tall'] as const;
export type Height = (typeof HEIGHTS)[number];

export const MAKEUPS = ['none', 'minimal', 'everyday', 'evening'] as const;
export type Makeup = (typeof MAKEUPS)[number];

export const FRECKLES = ['none', 'light', 'pronounced'] as const;
export type Freckles = (typeof FRECKLES)[number];

export const GLASSES = ['none', 'clear', 'sunglasses'] as const;
export type Glasses = (typeof GLASSES)[number];

export const LOCK_KEYS = [
  'age',
  'hair',
  'eyes',
  'skin',
  'build',
  'face',
  'scene',
  'season',
  'weather',
  'time',
  'action',
  'capture',
  'framing',
  'angle',
  'emotion',
  'outfit',
  'ratio',
] as const;
export type LockKey = (typeof LOCK_KEYS)[number];

export const AGE_MIN = 20;
export const AGE_MAX = 45;
