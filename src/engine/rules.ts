import type { Angle, Capture, Framing, Gaze } from '../core/vocab.ts';
import type { Action, Scene, ScenarioRatio } from '../core/types.ts';
import { L_POSTURE } from '../core/labels.ts';

// Статические таблицы совместимости съёмки. Все причины — по-русски: они показываются пользователю.

export const CAPTURE_FRAMINGS: Record<Capture, readonly Framing[]> = {
  'selfie-arm': ['close-up', 'portrait', 'waist-up'],
  'front-camera': ['close-up', 'portrait', 'waist-up'],
  'selfie-mirror': ['portrait', 'waist-up', 'full-body', 'seated'],
  'selfie-reflection': ['portrait', 'waist-up', 'full-body', 'seated'],
  'tripod-timer': ['waist-up', 'full-body', 'seated'],
  'by-acquaintance': ['portrait', 'waist-up', 'full-body', 'seated'],
  'by-friend-walk': ['waist-up', 'full-body', 'in-motion'],
  candid: ['close-up', 'portrait', 'waist-up', 'full-body', 'seated', 'in-motion'],
};

export const CAPTURE_ANGLES: Record<Capture, readonly Angle[]> = {
  'selfie-arm': ['front', 'three-quarter', 'slightly-above', 'slightly-below', 'eye-level', 'close-up', 'dynamic-tilt'],
  'front-camera': ['front', 'three-quarter', 'slightly-above', 'eye-level', 'close-up'],
  'selfie-mirror': ['front', 'three-quarter', 'eye-level', 'side', 'slightly-above'],
  'selfie-reflection': ['front', 'three-quarter', 'side', 'eye-level'],
  'tripod-timer': ['front', 'three-quarter', 'profile', 'side', 'eye-level', 'slightly-above', 'distant'],
  'by-acquaintance': ['front', 'three-quarter', 'profile', 'side', 'slightly-above', 'slightly-below', 'eye-level', 'distant', 'close-up', 'dynamic-tilt'],
  'by-friend-walk': ['three-quarter', 'profile', 'side', 'back-head-turn', 'eye-level', 'slightly-below', 'dynamic-tilt', 'distant'],
  candid: ['front', 'three-quarter', 'profile', 'side', 'back-head-turn', 'slightly-above', 'slightly-below', 'eye-level', 'distant', 'close-up', 'dynamic-tilt', 'face-limited'],
};

export const FRAMING_ANGLES: Record<Framing, readonly Angle[]> = {
  'close-up': ['front', 'three-quarter', 'profile', 'slightly-above', 'slightly-below', 'eye-level', 'close-up', 'face-limited', 'dynamic-tilt'],
  portrait: ['front', 'three-quarter', 'profile', 'side', 'slightly-above', 'slightly-below', 'eye-level', 'close-up', 'dynamic-tilt', 'face-limited', 'back-head-turn'],
  'waist-up': ['front', 'three-quarter', 'profile', 'side', 'back-head-turn', 'slightly-above', 'slightly-below', 'eye-level', 'dynamic-tilt', 'face-limited'],
  'full-body': ['front', 'three-quarter', 'profile', 'side', 'back-head-turn', 'slightly-above', 'slightly-below', 'eye-level', 'distant', 'dynamic-tilt'],
  seated: ['front', 'three-quarter', 'profile', 'side', 'slightly-above', 'eye-level', 'distant', 'face-limited', 'back-head-turn'],
  'in-motion': ['three-quarter', 'profile', 'side', 'back-head-turn', 'slightly-below', 'eye-level', 'distant', 'dynamic-tilt'],
};

const BACK_ANGLES: readonly Angle[] = ['back-head-turn', 'side', 'profile', 'distant', 'face-limited'];
const HIDDEN_ANGLES: readonly Angle[] = ['side', 'profile', 'slightly-above', 'distant', 'face-limited', 'back-head-turn', 'dynamic-tilt'];

/** Углы, при которых лицо видно только частично. */
export const PARTIAL_FACE_ANGLES: readonly Angle[] = ['back-head-turn', 'face-limited'];

export const SELFIE_CAPTURES: readonly Capture[] = ['selfie-arm', 'selfie-mirror', 'selfie-reflection', 'front-camera'];
export const isSelfie = (c: Capture): boolean => SELFIE_CAPTURES.includes(c);

export function faceVisibilityOf(angle: Angle): 'full' | 'partial' {
  return PARTIAL_FACE_ANGLES.includes(angle) ? 'partial' : 'full';
}

/** null — съёмка возможна; иначе причина (по-русски). */
export function captureReason(capture: Capture, scene: Scene, action: Action): string | null {
  switch (capture) {
    case 'selfie-arm':
    case 'front-camera':
    case 'selfie-mirror':
    case 'selfie-reflection': {
      if (action.hands > 1) return 'для селфи нужна свободная рука, а это действие занимает обе';
      if (action.back) return 'в этом действии героиня стоит спиной к камере — селфи невозможно';
      if (action.hidden) return 'в этом действии лицо скрыто — селфи невозможно';
      if (action.obj) return 'внимание героини занято делом — в селфи она смотрела бы в камеру';
      if (capture === 'selfie-mirror' && !scene.mirror) return 'в этой локации нет зеркала';
      if (capture === 'selfie-reflection' && !scene.glass) return 'в этой локации нет стекла или витрины для отражения';
      const ok = capture === 'selfie-mirror' || capture === 'selfie-reflection' ? ['stand', 'sit', 'lean'] : ['stand', 'sit', 'lean', 'walk'];
      if (!ok.includes(action.posture)) return `поза «${L_POSTURE[action.posture]}» не подходит для селфи`;
      return null;
    }
    case 'tripod-timer':
      if (scene.noTripod) return 'в этой локации нельзя поставить камеру';
      if (!['stand', 'sit', 'lean', 'crouch'].includes(action.posture)) return 'снимок на таймер не подходит для движения';
      return null;
    case 'by-acquaintance':
      return scene.solo ? 'в этой локации некому снимать' : null;
    case 'by-friend-walk':
      if (scene.solo) return 'в этой локации некому снимать';
      return action.posture === 'walk' ? null : 'съёмка на ходу требует действия «идёт»';
    case 'candid':
      return scene.solo ? 'в этой локации некому снимать' : null;
  }
}

export function framingReason(framing: Framing, capture: Capture, action: Action): string | null {
  if (!CAPTURE_FRAMINGS[capture].includes(framing)) return 'это кадрирование несовместимо с выбранным типом съёмки';
  if (framing === 'seated' && action.posture !== 'sit') return 'кадр «сидя» требует действия сидя';
  if (framing === 'in-motion' && action.posture !== 'walk' && action.posture !== 'move') return 'кадр «в движении» требует движения';
  if (framing === 'full-body' && action.posture === 'sit') return 'для сидящей героини используйте кадр «сидя»';
  if ((framing === 'close-up' || framing === 'portrait') && action.hidden) return 'лицо скрыто действием — портретный кадр не имеет смысла';
  if (framing === 'close-up' && action.back) return 'крупный план невозможен со спины';
  return null;
}

export function anglesFor(capture: Capture, framing: Framing, action: Action, scene: Scene, faceRequired: boolean): Angle[] {
  let list = CAPTURE_ANGLES[capture].filter((a) => FRAMING_ANGLES[framing].includes(a) && scene.angles.includes(a));
  if (action.back) list = list.filter((a) => BACK_ANGLES.includes(a));
  if (action.hidden) list = list.filter((a) => HIDDEN_ANGLES.includes(a));
  if (faceRequired) {
    list = list.filter((a) => !PARTIAL_FACE_ANGLES.includes(a));
    if (action.back) list = list.filter((a) => a === 'profile' || a === 'side' || a === 'distant');
  }
  return list;
}

export function angleReason(angle: Angle, capture: Capture, framing: Framing, action: Action, scene: Scene, faceRequired: boolean): string | null {
  if (!CAPTURE_ANGLES[capture].includes(angle)) return 'этот ракурс несовместим с выбранным типом съёмки';
  if (!FRAMING_ANGLES[framing].includes(angle)) return 'этот ракурс несовместим с выбранным кадрированием';
  if (!scene.angles.includes(angle)) return 'в этой локации такой ракурс нереалистичен';
  if (action.back && !BACK_ANGLES.includes(angle)) return 'героиня стоит спиной — ракурс должен быть сбоку или со спины';
  if (action.hidden && !HIDDEN_ANGLES.includes(angle)) return 'лицо скрыто действием — ракурс «в лицо» противоречив';
  if (faceRequired && PARTIAL_FACE_ANGLES.includes(angle)) return 'включено «Лицо обязательно видно»';
  return null;
}

export function ratioReason(ratio: ScenarioRatio, capture: Capture, framing: Framing): string | null {
  const r = ratio.w / ratio.h;
  if (isSelfie(capture) && ratio.orientation === 'horizontal') return 'селфи снимают вертикально или в квадрат';
  if (isSelfie(capture) && r < 0.5) return 'слишком вытянутый формат для селфи';
  if (r >= 1.9 && framing !== 'full-body' && framing !== 'in-motion' && framing !== 'seated') {
    return 'сверхширокий формат подходит только для кадров во весь рост, в движении или сидя';
  }
  if (framing === 'close-up' && r > 1.5) return 'крупный план в широком формате теряет смысл';
  return null;
}

export function gazesFor(capture: Capture, angle: Angle, action: Action): Gaze[] {
  let set: Gaze[];
  switch (capture) {
    case 'selfie-arm':
    case 'front-camera':
      set = ['camera'];
      break;
    case 'selfie-mirror':
    case 'selfie-reflection':
      set = ['camera', 'down'];
      break;
    case 'tripod-timer':
    case 'by-acquaintance':
      set = ['camera', 'away', 'side'];
      break;
    case 'by-friend-walk':
      set = ['camera', 'away', 'side'];
      break;
    case 'candid':
      set = ['away', 'side', 'down', 'camera'];
      break;
  }
  if (action.obj || action.hands > 0) {
    if (!isSelfie(capture)) set = [...set, 'object'];
  }
  if (!isSelfie(capture) && action.obj) set = [...set, 'down'];
  if (angle === 'profile') set = set.filter((g) => g !== 'camera');
  if (angle === 'back-head-turn') set = set.filter((g) => g === 'camera' || g === 'away');
  const uniq = [...new Set(set)];
  return uniq.length ? uniq : ['away'];
}
