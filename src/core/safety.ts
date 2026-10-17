// Защитный словарь: ни данные, ни итоговые промпты не должны содержать эти слова.
// Используется в валидаторе библиотеки сцен, в рендерере (страховка) и в тестах.

const MINOR_TERMS =
  /\b(girls?|teen\w*|child\w*|kids?|minors?|underage|school\s?girl\w*|school\s?boy\w*|school\s?uniform\w*|lolit?a?\w*|juvenile\w*|pre-?teen\w*|tweens?|infants?|babies|baby|toddler\w*|boys?|young|youthful|petite|girlish|childlike|babyface\w*|baby-faced)\b/i;

const EXPLICIT_TERMS =
  /\b(nude|naked|topless|nsfw|lingerie|erotic\w*|sexy|sexual\w*|seductive\w*|provocative\w*|cleavage|underwear|thongs?|busty|voluptuous|sensual\w*|fetish\w*|boudoir|sultry|undress\w*|strip(?:per|pers|tease|club|ping)|bikinis?|revealing|skimpy)\b/i;

const BRAND_TERMS =
  /\b(nike|adidas|puma|reebok|apple|iphone|ipad|macbook|samsung|google|android|gucci|prada|chanel|zara|ikea|starbucks|mcdonald\w*|kfc|coca|pepsi|canon|nikon|sony|leica|fuji\w*|gopro|netflix|instagram|tiktok|youtube|facebook|whatsapp|telegram|uber|tesla|bmw|mercedes|toyota|honda|volkswagen|lego|disney|nutella|polaroid|levi\w*|converse|vans|birkenstock|crocs|ray-ban|rayban)\b/i;

const TEXT_TERMS = /\b(logos?|brand\w*|slogans?|inscriptions?|lettering|watermarks?|captions?)\b/i;

/** Возвращает список нарушений (пустой массив — текст безопасен). */
export function safetyProblems(text: string, opts: { allowTextTerms?: boolean } = {}): string[] {
  const problems: string[] = [];
  const m1 = MINOR_TERMS.exec(text);
  if (m1) problems.push(`слово, указывающее на несовершеннолетних или «юный» образ: «${m1[0]}»`);
  const m2 = EXPLICIT_TERMS.exec(text);
  if (m2) problems.push(`недопустимая лексика откровенного характера: «${m2[0]}»`);
  const m3 = BRAND_TERMS.exec(text);
  if (m3) problems.push(`название бренда или сервиса: «${m3[0]}»`);
  if (!opts.allowTextTerms) {
    const m4 = TEXT_TERMS.exec(text);
    if (m4) problems.push(`упоминание логотипов/надписей: «${m4[0]}»`);
  }
  return problems;
}

export function isSafeText(text: string, opts: { allowTextTerms?: boolean } = {}): boolean {
  return safetyProblems(text, opts).length === 0;
}
