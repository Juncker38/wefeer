export interface FeatureDef {
  id: string;
  en: string;
  ru: string;
  minAge?: number;
  weight: number;
}

/** Индивидуальные особенности внешности (подмешиваются по 0–2 штуки). */
export const FEATURES: readonly FeatureDef[] = [
  { id: 'mole-cheek', en: 'a small mole on her cheek', ru: 'небольшая родинка на щеке', weight: 3 },
  { id: 'gap-teeth', en: 'a small gap between her front teeth', ru: 'небольшая щель между передними зубами', weight: 1.5 },
  { id: 'dimples', en: 'dimples when she smiles', ru: 'ямочки на щеках при улыбке', weight: 2 },
  { id: 'asym-smile', en: 'a slightly asymmetrical smile', ru: 'чуть асимметричная улыбка', weight: 2 },
  { id: 'strong-brows', en: 'strong, naturally thick eyebrows', ru: 'густые естественные брови', weight: 2.5 },
  { id: 'laugh-lines', en: 'faint laugh lines around her eyes', ru: 'тонкие мимические морщинки у глаз', minAge: 32, weight: 3 },
  { id: 'gray-temples', en: 'a few gray hairs at the temples', ru: 'несколько седых волосков на висках', minAge: 38, weight: 2.5 },
  { id: 'nose-stud', en: 'a tiny nose stud', ru: 'маленький пирсинг в носу', weight: 1 },
  { id: 'ear-piercings', en: 'several small piercings in her ears', ru: 'несколько маленьких проколов в ушах', weight: 1.5 },
  { id: 'chin-scar', en: 'a small old scar on her chin', ru: 'небольшой старый шрам на подбородке', weight: 1 },
  { id: 'cheekbones', en: 'prominent cheekbones', ru: 'выраженные скулы', weight: 2 },
  { id: 'sun-spots', en: 'a few faint sun spots across her cheekbones', ru: 'несколько светлых пигментных пятнышек на скулах', minAge: 28, weight: 1.5 },
  { id: 'crooked-tooth', en: 'one slightly crooked canine tooth', ru: 'один чуть искривлённый клык', weight: 1 },
  { id: 'uneven-eyebrows', en: 'slightly uneven eyebrows', ru: 'чуть неровные брови', weight: 1.5 },
];

export const FEATURE_BY_ID: ReadonlyMap<string, FeatureDef> = new Map(FEATURES.map((f) => [f.id, f]));
