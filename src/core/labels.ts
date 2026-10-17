// Русские подписи для интерфейса и русского описания результата.
import type {
  Angle,
  Balance,
  Build,
  Capture,
  Category,
  Climate,
  ColorMode,
  DetailLevel,
  Emotion,
  EyeColor,
  Framing,
  Freckles,
  Gaze,
  Glasses,
  HairColor,
  HairLength,
  HairStyle,
  HairType,
  Height,
  Length,
  LockKey,
  Makeup,
  Mode,
  OutfitTag,
  Posture,
  Profile,
  Rarity,
  Season,
  SeriesTheme,
  Sharpness,
  SkinTone,
  Style,
  TimeOfDay,
  Weather,
} from './vocab.ts';
import type { ChoiceKey } from './settings.ts';

export const L_SEASON: Record<Season, string> = { spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима' };

export const L_WEATHER: Record<Weather, string> = {
  clear: 'Ясно',
  'partly-cloudy': 'Переменная облачность',
  overcast: 'Пасмурно',
  rain: 'Дождь',
  'after-rain': 'После дождя',
  fog: 'Туман',
  snow: 'Снег',
  windy: 'Лёгкий ветер',
  heat: 'Жара',
  frost: 'Мороз',
};

export const L_TIME: Record<TimeOfDay, string> = {
  dawn: 'Рассвет',
  morning: 'Утро',
  day: 'День',
  'golden-hour': 'Золотой час',
  dusk: 'Сумерки',
  evening: 'Вечер',
  night: 'Ночь',
};

export const L_CLIMATE: Record<Climate, string> = {
  temperate: 'Умеренный',
  warm: 'Тёплый (без снега)',
  cold: 'Холодный (долгая зима)',
};

export const L_CATEGORY: Record<Category, string> = {
  home: 'Дом и быт',
  city: 'Город',
  food: 'Еда и досуг',
  nature: 'Природа',
  'water-sport': 'Вода и спорт',
  travel: 'Путешествия',
  everyday: 'Повседневные моменты',
};

export const L_RARITY: Record<Rarity, string> = { common: 'Популярные', uncommon: 'Необычные', rare: 'Редкие' };

export const L_POSTURE: Record<Posture, string> = {
  stand: 'Стоя',
  sit: 'Сидя',
  walk: 'Идёт',
  move: 'В движении (бег, танец)',
  lean: 'Опираясь',
  crouch: 'Присев / наклонившись',
};

export const L_ANGLE: Record<Angle, string> = {
  front: 'Фронтально',
  'three-quarter': '3/4',
  profile: 'Профиль',
  'back-head-turn': 'Со спины с поворотом головы',
  side: 'Сбоку',
  'slightly-above': 'Чуть сверху',
  'slightly-below': 'Чуть снизу',
  'eye-level': 'С уровня глаз',
  distant: 'Издалека',
  'close-up': 'Крупный план',
  'dynamic-tilt': 'Динамичный наклон',
  'face-limited': 'Лицо частично скрыто',
};

export const L_CAPTURE: Record<Capture, string> = {
  'selfie-arm': 'Селфи с вытянутой рукой',
  'selfie-mirror': 'Селфи в зеркале',
  'selfie-reflection': 'Селфи в отражении',
  'front-camera': 'Фронтальная камера вблизи',
  'tripod-timer': 'Камера на таймере / штативе',
  'by-acquaintance': 'Снимает знакомый',
  'by-friend-walk': 'Снимает друг на прогулке',
  candid: 'Случайный candid-кадр',
};

export const L_FRAMING: Record<Framing, string> = {
  'close-up': 'Крупный план',
  portrait: 'Портрет',
  'waist-up': 'По пояс',
  'full-body': 'Полный рост',
  seated: 'Сидя',
  'in-motion': 'В движении',
};

export const L_GAZE: Record<Gaze, string> = {
  camera: 'В камеру',
  away: 'Мимо камеры',
  down: 'Вниз',
  object: 'На занятие или предмет',
  side: 'В сторону',
};

export const L_EMOTION: Record<Emotion, string> = {
  'natural-smile': 'Лёгкая естественная улыбка',
  'calm-friendly': 'Спокойное, дружелюбное',
  laugh: 'Смех',
  playful: 'Игривость',
  surprise: 'Удивление',
  thoughtful: 'Задумчивость',
  neutral: 'Нейтральное',
  sad: 'Грусть',
  crying: 'Слёзы',
};

export const L_STYLE: Record<Style, string> = {
  smartphone: 'Смартфон (бытовое фото)',
  camera: 'Фотокамера',
  film: 'Лёгкая плёночная фактура',
  documentary: 'Документальная съёмка',
};

export const L_COLOR: Record<ColorMode, string> = {
  natural: 'Естественный цвет',
  bw: 'Чёрно-белое',
  muted: 'Приглушённые цвета',
  film: 'Плёночная цветопередача',
};

export const L_SHARPNESS: Record<Sharpness, string> = {
  sharp: 'Чёткий читаемый фон',
  moderate: 'Умеренная естественная глубина резкости',
  blur: 'Портретное размытие',
};

export const L_LENGTH: Record<Length, string> = { short: 'Краткий', standard: 'Стандартный', detailed: 'Подробный' };
export const L_DETAIL: Record<DetailLevel, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };

export const L_PROFILE: Record<Profile, string> = {
  universal: 'Универсальный',
  'gpt-image': 'GPT/Image',
  'nano-banana': 'Nano Banana',
  seedance: 'Seedance / другие',
};

export const PROFILE_HELP: Record<Profile, string> = {
  universal: 'Один связный абзац и отдельный negative prompt — обычный текст без специального синтаксиса. Совместимость с конкретными инструментами не гарантируется.',
  'gpt-image': 'Связные предложения; «чего избегать» добавляется в конец текста. Только форматирование, без заявлений о совместимости.',
  'nano-banana': 'Текст в виде инструкции («Create a photorealistic image…»); исключения — отдельным предложением. Только форматирование.',
  seedance: 'Компактная версия одной строкой. Часть моделей Seedance ориентирована на видео — здесь остаётся текстовый промпт для одного кадра; выберите совместимый инструмент сами.',
};

export const L_BALANCE: Record<Balance, string> = {
  variety: 'Максимальная вариативность',
  balanced: 'Сбалансировано',
  realism: 'Больше реализма',
};

export const L_MODE: Record<Mode, string> = {
  new: 'Новая девушка',
  character: 'Один персонаж',
  series: 'Серия кадров',
  chaos: 'Полный рандом',
};

export const MODE_HELP: Record<Mode, string> = {
  new: 'Внешность меняется в каждом кадре.',
  character: 'Постоянный паспорт внешности; меняется только сценарий.',
  series: 'Несколько разных кадров одного персонажа, связанных общей темой.',
  chaos: 'Без ручных ограничений — действуют только возраст 20–45 и базовая безопасность.',
};

export const L_SERIES_THEME: Record<SeriesTheme, string> = {
  auto: 'Автоматически',
  'day-in-city': 'День в городе',
  trip: 'Поездка',
  'weekend-home': 'Выходные дома',
  'outdoor-day': 'День на природе',
};

export const L_OUTFIT_TAG: Record<OutfitTag, string> = {
  casual: 'Повседневная',
  cozy: 'Домашняя, уютная',
  smart: 'Смарт-кэжуал',
  evening: 'Нарядная',
  sport: 'Спортивная',
  dance: 'Для танцев',
  swim: 'Купальная',
  beach: 'Пляжная',
  ski: 'Лыжная',
  hiking: 'Походная',
  work: 'Рабочая',
  travel: 'Для путешествий',
};

export const L_HAIR_COLOR: Record<HairColor, string> = {
  black: 'Чёрные',
  'dark-brown': 'Тёмно-каштановые',
  brown: 'Каштановые',
  chestnut: 'Светло-каштановые',
  auburn: 'Рыжевато-каштановые',
  'copper-red': 'Медно-рыжие',
  'dark-blonde': 'Тёмно-русые',
  'golden-blonde': 'Золотисто-русые',
  'ash-blonde': 'Пепельно-русые',
  'salt-and-pepper': 'С проседью',
  'silver-gray': 'Седые',
};
export const L_HAIR_LENGTH: Record<HairLength, string> = { short: 'Короткие', chin: 'До подбородка', shoulder: 'До плеч', long: 'Длинные' };
export const L_HAIR_TYPE: Record<HairType, string> = { straight: 'Прямые', wavy: 'Волнистые', curly: 'Кудрявые', coily: 'Мелкие кудри' };
export const L_HAIR_STYLE: Record<HairStyle, string> = {
  loose: 'Распущены',
  ponytail: 'Хвост',
  'low-bun': 'Низкий пучок',
  'messy-bun': 'Небрежный пучок',
  braid: 'Коса',
  'half-up': 'Полуприбраны',
  tucked: 'Убраны за уши',
  bangs: 'С чёлкой',
  'short-tousled': 'Короткая небрежная стрижка',
};
export const L_EYE_COLOR: Record<EyeColor, string> = {
  'dark-brown': 'Тёмно-карие',
  brown: 'Карие',
  hazel: 'Ореховые',
  green: 'Зелёные',
  blue: 'Голубые',
  gray: 'Серые',
};
export const L_SKIN_TONE: Record<SkinTone, string> = {
  fair: 'Очень светлая',
  light: 'Светлая',
  medium: 'Средняя',
  olive: 'Оливковая',
  tan: 'Смуглая',
  brown: 'Коричневая',
  'deep-brown': 'Тёмно-коричневая',
};
export const L_BUILD: Record<Build, string> = {
  slim: 'Стройное',
  average: 'Среднее',
  athletic: 'Спортивное',
  'full-figured': 'Пышное',
  sturdy: 'Крепкое',
  'plus-size': 'Крупное (plus-size)',
};
export const L_HEIGHT: Record<Height, string> = { short: 'Невысокая', average: 'Средний рост', tall: 'Высокая' };
export const L_MAKEUP: Record<Makeup, string> = {
  none: 'Без макияжа',
  minimal: 'Естественный минимальный',
  everyday: 'Лёгкий повседневный',
  evening: 'Выразительный вечерний',
};
export const L_FRECKLES: Record<Freckles, string> = { none: 'Нет', light: 'Лёгкие', pronounced: 'Заметные' };
export const L_GLASSES: Record<Glasses, string> = { none: 'Без очков', clear: 'Обычные очки', sunglasses: 'Солнцезащитные' };

export const L_LOCK: Record<LockKey, string> = {
  age: 'Возраст',
  hair: 'Волосы',
  eyes: 'Глаза',
  skin: 'Кожа',
  build: 'Телосложение и рост',
  face: 'Макияж, веснушки, очки, черты',
  scene: 'Локация',
  season: 'Сезон',
  weather: 'Погода',
  time: 'Время суток',
  action: 'Поза / действие',
  capture: 'Тип съёмки',
  framing: 'Кадрирование',
  angle: 'Ракурс',
  emotion: 'Эмоция',
  outfit: 'Одежда',
  ratio: 'Формат кадра',
};

export const CHOICE_LABELS: Record<Exclude<ChoiceKey, 'scene'>, Record<string, string>> = {
  hairColor: L_HAIR_COLOR,
  hairLength: L_HAIR_LENGTH,
  hairType: L_HAIR_TYPE,
  hairStyle: L_HAIR_STYLE,
  eyeColor: L_EYE_COLOR,
  skinTone: L_SKIN_TONE,
  build: L_BUILD,
  height: L_HEIGHT,
  makeup: L_MAKEUP,
  freckles: L_FRECKLES,
  glasses: L_GLASSES,
  clothingStyle: L_OUTFIT_TAG,
  category: L_CATEGORY,
  season: L_SEASON,
  weather: L_WEATHER,
  time: L_TIME,
  framing: L_FRAMING,
  angle: L_ANGLE,
  emotion: L_EMOTION,
  posture: L_POSTURE,
};

export const CHOICE_TITLES: Record<ChoiceKey, string> = {
  hairColor: 'Цвет волос',
  hairLength: 'Длина волос',
  hairType: 'Тип волос',
  hairStyle: 'Причёска',
  eyeColor: 'Цвет глаз',
  skinTone: 'Тон кожи',
  build: 'Телосложение',
  height: 'Рост',
  makeup: 'Макияж',
  freckles: 'Веснушки',
  glasses: 'Очки',
  clothingStyle: 'Стиль одежды',
  scene: 'Конкретная локация',
  category: 'Категории локаций',
  season: 'Сезон',
  weather: 'Погода',
  time: 'Время суток',
  framing: 'Кадрирование',
  angle: 'Ракурс',
  emotion: 'Эмоции',
  posture: 'Поза',
};

export const CHOICE_HELP: Partial<Record<ChoiceKey, string>> = {
  hairStyle: 'Некоторые причёски недоступны для коротких волос — движок подберёт подходящую.',
  glasses: 'Солнцезащитные очки появятся только при дневном свете на улице.',
  clothingStyle: 'Одежда всё равно подбирается по погоде и месту: купальник не попадёт в зимний лес.',
  scene: 'Ручной выбор одной или нескольких локаций из библиотеки.',
  weather: 'В помещениях без окон погода не отображается, но влияет на одежду, если человек пришёл с улицы.',
  angle: 'Несовместимые с типом съёмки ракурсы исключаются автоматически.',
  emotion: 'Грусть и слёзы выключены по умолчанию — включаются отдельным переключателем.',
};
