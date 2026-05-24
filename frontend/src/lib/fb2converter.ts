'use client';

const STOP_WORDS = new Set([
  'он', 'она', 'оно', 'они', 'я', 'ты', 'мы', 'вы',
  'кто', 'что', 'это', 'тот', 'так', 'вот', 'все',
  'мне', 'мной', 'меня', 'тебе', 'тобой', 'тебя',
  'ему', 'его', 'ним', 'него', 'ней', 'неё', 'них',
  'нам', 'нас', 'вам', 'вас', 'себя', 'себе',
  'собой', 'этот', 'эта', 'это', 'эти', 'такой',
  'князь', 'граф', 'графиня', 'барон', 'баронесса',
  'господин', 'госпожа', 'товарищ', 'мистер', 'миссис',
  'дон', 'донна', 'сеньор', 'сеньора',
  'пан', 'пани', 'герр', 'фрау', 'мадам', 'месье',
  'полковник', 'генерал', 'майор', 'капитан',
  'княжна', 'княгиня', 'царь', 'король', 'королева',
  'привет', 'здравствуй', 'здравствуйте', 'пока', 'до',
  'да', 'нет', 'ну', 'ага', 'угу', 'ой', 'ах', 'эх',
  'хорошо', 'ладно', 'конечно', 'верно', 'точно',
  'слушай', 'слушайте', 'послушай', 'послушайте',
  'извини', 'извините', 'прости', 'простите',
  'пожалуйста', 'спасибо', 'благодарю',
  'будет', 'есть', 'был', 'была', 'были',
  'вот', 'вон', 'там', 'тут', 'здесь', 'сейчас',
  'сегодня', 'вчера', 'завтра', 'всегда', 'никогда',
  'может', 'можно', 'нельзя', 'надо', 'нужно',
  'как', 'за', 'затем', 'после', 'похоже', 'впрочем',
  'однако', 'потом', 'тогда', 'поэтому', 'зачем',
  'почему', 'откуда', 'куда', 'где', 'когда', 'сколько',
  'мой', 'моя', 'моё', 'мои', 'твой', 'твоя', 'твоё',
  'наш', 'наша', 'наше', 'наши', 'ваш', 'ваша', 'ваше',
  'свой', 'своя', 'своё', 'свои', 'весь', 'вся', 'всё',
  'сам', 'сама', 'само', 'сами', 'самый', 'самая',
  'какой', 'какая', 'какое', 'какие',
  'того', 'тому', 'тем', 'том', 'тех', 'теми',
  'всех', 'всем', 'всеми', 'самых', 'самым',
  'рад', 'рада', 'этот', 'эта', 'это', 'эти',
]);

const SPEECH_VERBS = [
  'сказал', 'сказала', 'сказало', 'сказали',
  'ответил', 'ответила', 'ответило', 'ответили',
  'спросил', 'спросила', 'спросило', 'спросили',
  'промолвил', 'промолвила', 'промолвили',
  'произнес', 'произнесла', 'произнесли', 'произнёс',
  'крикнул', 'крикнула', 'крикнули',
  'шепнул', 'шепнула', 'шепнули',
  'пробормотал', 'пробормотала', 'пробормотали',
  'воскликнул', 'воскликнула', 'воскликнули',
  'заметил', 'заметила', 'заметили',
  'добавил', 'добавила', 'добавили',
  'продолжил', 'продолжила', 'продолжили',
  'перебил', 'перебила', 'перебили',
  'усмехнулся', 'усмехнулась', 'усмехнулись',
  'рассмеялся', 'рассмеялась', 'рассмеялись',
  'вздохнул', 'вздохнула', 'вздохнули',
  'обратился', 'обратилась', 'обратились',
  'подумал', 'подумала', 'подумали',
  'решил', 'решила', 'решили',
  'возразил', 'возразила', 'возразили',
  'согласился', 'согласилась', 'согласились',
  'отозвался', 'отозвалась', 'отозвались',
  'попросил', 'попросила', 'попросили',
  'предложил', 'предложила', 'предложили',
  'повторил', 'повторила', 'повторили',
  'напомнил', 'напомнила', 'напомнили',
  'приказал', 'приказала', 'приказали',
  'потребовал', 'потребовала', 'потребовали',
  'продолжал', 'продолжала', 'продолжали',
  'говорил', 'говорила', 'говорили',
  'отвечал', 'отвечала', 'отвечали',
  'спрашивал', 'спрашивала', 'спрашивали',
  'повторял', 'повторяла', 'повторяли',
  'приговаривал', 'приговаривала', 'приговаривали',
  'бормотал', 'бормотала', 'бормотали',
  'шептал', 'шептала', 'шептали',
  'кричал', 'кричала', 'кричали',
  'восклицал', 'восклицала', 'восклицали',
  'думал', 'думала', 'думали',
  'молвил', 'молвила', 'молвили',
  'вскричал', 'вскричала', 'вскричали',
  'прибавил', 'прибавила', 'прибавили',
  'добавлял', 'добавляла', 'добавляли',
  'выговорил', 'выговорила', 'выговорили',
  'произносил', 'произносила', 'произносили',
  'вздыхал', 'вздыхала', 'вздыхали',
  'усмехался', 'усмехалась', 'усмехались',
  'удивился', 'удивилась', 'удивились', 'удивило',
  'кивнул', 'кивнула', 'кивнули',
  'пожал', 'пожала', 'пожали',
  'махнул', 'махнула', 'махнули',
  'оглянулся', 'оглянулась', 'оглянулись',
  'обернулся', 'обернулась', 'обернулись',
  'растерялся', 'растерялась', 'растерялись',
  'наклонил', 'наклонила', 'наклонили',
  'покачал', 'покачала', 'покачали',
  'помолчал', 'помолчала', 'помолчали',
  'соглашался', 'соглашалась', 'соглашались',
  'возражал', 'возражала', 'возражали',
  'интересовался', 'интересовалась', 'интересовались',
  'поинтересовался', 'поинтересовалась', 'поинтересовались',
  'уточнил', 'уточнила', 'уточнили',
  'буркнул', 'буркнула', 'буркнули',
  'выдохнул', 'выдохнула', 'выдохнули',
  'хихикнул', 'хихикнула', 'хихикнули',
  'фыркнул', 'фыркнула', 'фыркнули',
  'улыбнулся', 'улыбнулась', 'улыбнулись',
  'улыбался', 'улыбалась', 'улыбались',
  'нахмурился', 'нахмурилась', 'нахмурились',
  'насупился', 'насупилась', 'насупились',
  'скривился', 'скривилась', 'скривились',
  'поморщился', 'поморщилась', 'поморщились',
  'насторожился', 'насторожилась', 'насторожились',
  'встрепенулся', 'встрепенулась', 'встрепенулись',
  'оживился', 'оживилась', 'оживились',
  'взмахнул', 'взмахнула', 'взмахнули',
  'отмахнулся', 'отмахнулась', 'отмахнулись',
  'кинул', 'кинула', 'кинули',
  'бросил', 'бросила', 'бросили',
  'прошептал', 'прошептала', 'прошептали',
  'выкрикнул', 'выкрикнула', 'выкрикнули',
  'заорал', 'заорала', 'заорали',
  'закричал', 'закричала', 'закричали',
  'засмеялся', 'засмеялась', 'засмеялись',
  'задумался', 'задумалась', 'задумались',
  'прищурился', 'прищурилась', 'прищурились',
  'огрызнулся', 'огрызнулась', 'огрызнулись',
  'вскипел', 'вскипела', 'вскипели',
  'взбесился', 'взбесилась', 'взбесились',
  'обиделся', 'обиделась', 'обиделись',
  'восхитился', 'восхитилась', 'восхитились',
  'всплеснул', 'всплеснула', 'всплеснули',
  'сморщился', 'сморщилась', 'сморщились',
  'выдавил', 'выдавила', 'выдавили',
  'выпалил', 'выпалила', 'выпалили',
  'брякнул', 'брякнула', 'брякнули',
  'ляпнул', 'ляпнула', 'ляпнули',
  'гаркнул', 'гаркнула', 'гаркнули',
  'вскрикнул', 'вскрикнула', 'вскрикнули',
  'взвизгнул', 'взвизгнула', 'взвизгнули',
];

const FAMILY_ROLES = new Set([
  'матушка', 'батюшка', 'отец', 'мать', 'сын', 'дочь',
  'дедушка', 'бабушка', 'дядя', 'тётя', 'тетя',
  'брат', 'сестра', 'сударь', 'сударыня',
]);

const FEMALE_WORDS = new Set([
  'рада', 'готова', 'согласна', 'должна', 'уверена',
  'знакома', 'способна', 'обязана', 'больна',
  'жива', 'здорова', 'счастлива', 'влюблена',
  'одинока', 'сыта', 'горда', 'права', 'виновата',
  'спокойна', 'довольна', 'печальна', 'грустна', 'весела',
  'бледна', 'смугла', 'худа', 'толста',
  'сильна', 'слаба', 'умна', 'глупа', 'хитра',
  'красива', 'мила', 'добра', 'зла', 'нежна',
  'груба', 'резка', 'пряма', 'скромна',
  'занята', 'открыта', 'закрыта', 'написана', 'сделана',
  'показана', 'дана', 'принята', 'понята', 'собрана',
  'настроена', 'удивлена', 'была',
]);

const MALE_WORDS = new Set([
  'мог', 'нёс', 'вёз', 'полз', 'рос', 'грёб', 'скрёб',
  'рад', 'готов', 'согласен', 'должен', 'уверен',
  'знаком', 'способен', 'обязан', 'болен',
  'жив', 'здоров', 'счастлив', 'влюблён',
  'одинок', 'сыт', 'горд', 'прав', 'виноват',
  'спокоен', 'доволен', 'печален', 'грустен', 'весел',
  'бледен', 'смугл', 'худ', 'толст',
  'силён', 'слаб', 'умён', 'глуп', 'хитёр',
  'красив', 'мил', 'добр', 'зол', 'нежен',
  'груб', 'резок', 'прям', 'скромен',
  'занят', 'открыт', 'закрыт', 'написан', 'сделан',
  'показан', 'дан', 'принят', 'понят', 'собран',
  'настроен', 'удивлён', 'был',
]);

let _speechRegex: RegExp | null = null;
function getSpeechRegex(): RegExp {
  if (_speechRegex) return _speechRegex;
  const sorted = [...SPEECH_VERBS].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![а-яёА-ЯЁ])');
  _speechRegex = new RegExp(escaped.join('|'), 'gi');
  return _speechRegex;
}

function extractXmlText(elem: Element): string {
  const parts: string[] = [];
  if (elem.textContent) {
    parts.push(elem.textContent.trim());
  }
  for (const child of elem.children) {
    const childText = extractXmlText(child);
    if (childText) parts.push(childText);
  }
  return parts.join(' ').replace(/\s+/g, ' ');
}

// FB2 namespace
const FB2_NS = 'http://www.gribuser.ru/xml/fictionbook/2.0';
function fb2Tag(tag: string): string {
  return `${FB2_NS}:${tag}`;
}

export interface Fb2Data {
  title: string;
  author: string;
  chapters: { id: string; title: string; paragraphs: { id: string; text: string }[] }[];
}

export function parseFb2(xmlText: string): Fb2Data {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const ns = xml.documentElement?.namespaceURI || FB2_NS;

  function q(tag: string, parent: Document | Element = xml): Element | null {
    return parent.getElementsByTagNameNS(ns, tag)[0] || null;
  }
  function qAll(tag: string, parent: Document | Element = xml): Element[] {
    return Array.from(parent.getElementsByTagNameNS(ns, tag));
  }

  const titleInfo = q('title-info');
  const bookTitle = q('book-title', titleInfo || xml);
  const title = bookTitle?.textContent?.trim() || 'Untitled';

  let author = 'Unknown';
  if (titleInfo) {
    const authorEl = q('author', titleInfo);
    if (authorEl) {
      const first = q('first-name', authorEl)?.textContent?.trim() || '';
      const last = q('last-name', authorEl)?.textContent?.trim() || '';
      author = [first, last].filter(Boolean).join(' ');
    }
  }

  const bodies = qAll('body');
  const chapters: Fb2Data['chapters'] = [];
  let chIdx = 0;

  function collectSections(parent: Element, parentTitle: string = '') {
    for (const section of qAll('section', parent)) {
      const titleElem = q('title', section);
      const sectionTitle = titleElem?.textContent?.trim() || `Глава ${chIdx + 1}`;

      const paragraphs: { id: string; text: string }[] = [];
      for (const child of Array.from(section.children)) {
        const tag = child.tagName.replace(/^.*?:/, '').toLowerCase();
        if (tag === 'title') continue;
        if (tag === 'section') {
          collectSections(child, sectionTitle);
          continue;
        }
        if (tag === 'p' || tag === 'empty-line') {
          const text = extractXmlText(child as Element);
          if (text) paragraphs.push({ id: `ch-${chIdx}-p-${paragraphs.length}`, text });
        }
      }
      if (paragraphs.length > 0) {
        chapters.push({ id: `ch-${chIdx}`, title: sectionTitle, paragraphs });
        chIdx++;
      }
    }
  }

  for (const body of bodies) {
    const sections = qAll('section', body);
    if (sections.length > 0) {
      collectSections(body);
    } else {
      const paragraphs: { id: string; text: string }[] = [];
      for (const child of Array.from(body.children)) {
        const tag = child.tagName.replace(/^.*?:/, '').toLowerCase();
        if (tag === 'title') continue;
        if (tag === 'p' || tag === 'empty-line') {
          const text = extractXmlText(child as Element);
          if (text) paragraphs.push({ id: `ch-0-p-${paragraphs.length}`, text });
        }
      }
      if (paragraphs.length > 0) {
        chapters.push({ id: 'ch-0', title, paragraphs });
      }
    }
  }

  return { title, author, chapters };
}

const MALE_EXCEPTIONS = new Set([
  'никита', 'илья', 'кузьма', 'лука', 'даня', 'ваня', 'петя', 'коля',
  'миша', 'серёжа', 'алёша', 'дима', 'гриша', 'тима', 'лёша', 'паша',
  'юра', 'боря', 'витя', 'федя', 'сева', 'рома', 'толя', 'гена', 'даня',
]);
const UNISEX_NAMES = new Set([
  'саша', 'женя', 'валя', 'шура', 'слава',
]);

export type GenderConfidence = 'high' | 'medium' | 'low';

export interface GenderResult {
  gender: string | null;
  confidence: GenderConfidence | null;
}

/** Нормализация текста перед парсингом. */
export function normalizeText(text: string): string {
  return text
    .replace(/\u00AD/g, '')           // soft hyphen
    .replace(/[\u2013\u2014]/g, '—')  // en-dash, em-dash → —
    .replace(/[\u2018\u2019]/g, "'")  // curly quotes → straight
    .replace(/[\u201C\u201D]/g, '"')  // double curly → straight
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();
}

export function determineGender(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (MALE_EXCEPTIONS.has(lower)) return 'male';
  if (UNISEX_NAMES.has(lower)) return null;
  const last = name[name.length - 1].toLowerCase();
  if (last === 'а' || last === 'я' || last === 'и') return 'female';
  if (name.endsWith('ия') || name.endsWith('ья')) return 'female';
  return 'male';
}

export function isDialogue(text: string): boolean {
  if (text.startsWith('—') || text.startsWith('- ')) return true;
  if (/^\[[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\]\s*[—\-]/.test(text)) return true;
  if (text.startsWith('«') || text.startsWith('"')) return true;
  return false;
}

function findBracketSpeaker(text: string): string | null {
  const m = text.match(/^\[([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\]\s*[—\-]/);
  return m ? m[1] : null;
}

export function findSpeaker(text: string): string | null {
  if (!isDialogue(text)) return null;

  const bracket = findBracketSpeaker(text);
  if (bracket) return bracket;

  const matches = text.matchAll(getSpeechRegex());
  for (const match of matches) {
    const idx = match.index ?? 0;
    // Before: имя перед глаголом
    const before = text.slice(Math.max(0, idx - 12), idx);
    const beforeM = before.match(/.*?([А-ЯЁ][а-яё]+)\s{0,2}:?\s{0,2}$/);
    if (beforeM) {
      const candidate = beforeM[1];
      if (!STOP_WORDS.has(candidate.toLowerCase()) && candidate.length > 1) {
        const between = before.slice(before.lastIndexOf(candidate) + candidate.length);
        if (!/[—«"„\u201C\u201E]/.test(between)) {
          return candidate;
        }
      }
    }

    // After: имя после глагола
    let after = text.slice(match.index! + match[0].length);
    for (let attempt = 0; attempt < 5; attempt++) {
      after = after.trim().replace(/^[, \u2014\u2013\-:]+/, '');
          const wordM = after.match(/^([а-яёА-ЯЁ]+)(?![а-яёА-ЯЁ])/);
      if (wordM) {
        const word = wordM[1];
        const wordLower = word.toLowerCase();
        if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase() &&
            !STOP_WORDS.has(wordLower) && word.length > 1) {
          return word;
        }
        if (FAMILY_ROLES.has(wordLower)) return word;
        after = after.slice(wordM[1].length);
      } else {
        break;
      }
    }
  }
  return null;
}

export function findNamesInText(text: string): string[] {
  const names = text.match(/(?<![а-яёА-ЯЁA-Za-z0-9_])([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)(?![а-яёА-ЯЁA-Za-z0-9_])/g) || [];
  return names.filter(n => !STOP_WORDS.has(n.toLowerCase()) && n.length > 1);
}

function checkGenderWord(word: string): string | null {
  const w = word.toLowerCase();
  if (FEMALE_WORDS.has(w)) return 'female';
  if (MALE_WORDS.has(w)) return 'male';
  if (w.endsWith('лась')) return 'female';
  if (w.endsWith('ла') && !w.endsWith('ло') && !w.endsWith('ли')) return 'female';
  if (w.endsWith('лся')) return 'male';
  if (w.endsWith('л') && !w.endsWith('ла') && !w.endsWith('ло') && !w.endsWith('ли') &&
      !w.endsWith('лый') && !w.endsWith('лая') && !w.endsWith('лое') && !w.endsWith('лые') &&
      !w.endsWith('лась') && !w.endsWith('лось') && !w.endsWith('лись')) {
    return 'male';
  }
  return null;
}

export function detectGenderFromVerbs(text: string): string | null {
  const ruRegex = /[а-яё]+/gi;
  const tokens: { w: string; pos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = ruRegex.exec(text.toLowerCase())) !== null) {
    tokens.push({ w: m[0], pos: m.index });
  }
  for (let idx = 0; idx < tokens.length; idx++) {
    if (tokens[idx].w !== 'я') continue;
    const start = Math.max(0, idx - 4);
    const end = Math.min(tokens.length, idx + 5);
    for (let j = start; j < end; j++) {
      if (j === idx) continue;
      const neighbor = tokens[j];
      const a = Math.min(neighbor.pos + neighbor.w.length, tokens[idx].pos);
      const b = Math.max(neighbor.pos, tokens[idx].pos);
      const between = text.slice(a, b);
      if (/[.!?:;]/.test(between)) continue;
      const gender = checkGenderWord(neighbor.w);
      if (gender) return gender;
    }
  }
  return null;
}

/** Detect gender from dialogue attribution segments (after even-positioned em-dashes).
 *  ─ Текст, ─ атрибуция, ─ продолжение, ─ ещё атрибуция.
 *  Чётные сегменты (после 2-го, 4-го, 6-го тире) = атрибуция.
 *  Приоритет внутри атрибуции: прямой голос > глагол > существительное. */
const FEMALE_NOUNS = new Set([
  'незнакомка', 'девушка', 'девица', 'женщина', 'старуха', 'старушка',
  'ведьма', 'колдунья', 'принцесса', 'королева', 'княгиня', 'княжна',
  'богиня', 'госпожа', 'леди', 'мадам', 'мисс', 'миссис',
  'хозяйка', 'мама', 'мать', 'сестра', 'дочь', 'бабушка', 'тётя', 'жена',
  'подруга', 'спутница', 'напарница', 'ученица', 'учительница',
  'воительница', 'охотница', 'красавица', 'императрица',
]);
const MALE_NOUNS = new Set([
  'незнакомец', 'парень', 'мужчина', 'старик', 'дед',
  'принц', 'король', 'князь', 'царь', 'император',
  'господин', 'мистер', 'сэр', 'месье',
  'хозяин', 'отец', 'папа', 'брат', 'сын',
  'друг', 'спутник', 'напарник', 'ученик', 'учитель',
  'воин', 'охотник', 'красавец',
]);
export function detectGenderFromAttribution(text: string): string | null {
  const parts = text.split('—');
  let found = false;
  for (let i = 2; i < parts.length; i += 2) {
    const seg = parts[i];
    if (!seg) continue;
    found = true;
    const lower = seg.toLowerCase();
    if (/женский голос|женск/.test(lower)) return 'female';
    if (/мужской голос|мужск/.test(lower)) return 'male';
    const words = seg.match(/[а-яё]+/gi) || [];
    for (const w of words) {
      const lw = w.toLowerCase();
      const gender = checkGenderWord(lw);
      if (gender) return gender;
      if (FEMALE_NOUNS.has(lw)) return 'female';
      if (MALE_NOUNS.has(lw)) return 'male';
    }
  }
  return found ? null : null;
}

/** Gender markers in dialogue text (без атрибуции). Fallback после verbs и attribution. */
const FEMALE_LEXICAL = new Set(['одна', 'одну', 'сама', 'моя', 'твоя', 'своя']);
export function detectGenderFromLexical(text: string): string | null {
  const lower = text.toLowerCase();
  const words = lower.match(/[а-яё]+/g) || [];
  for (const w of words) {
    if (FEMALE_LEXICAL.has(w)) return 'female';
  }
  return null;
}

export function convertFb2ToVblite(fb2File: File): Promise<{ data: any; fb2: Fb2Data }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xml = e.target?.result as string;
        const fb2 = parseFb2(xml);

        const knownCharacters = new Set<string>();
        const chaptersData: {
          text: string;
          normalized: string;
          speaker: string | null;
          isDialogue: boolean;
        }[][] = [];

        for (const ch of fb2.chapters) {
          const paras = [];
          for (const p of ch.paragraphs) {
            const normalized = normalizeText(p.text);
            const speaker = findSpeaker(normalized);
            if (speaker) knownCharacters.add(speaker);
            paras.push({ text: p.text, normalized, speaker, isDialogue: isDialogue(normalized) });
          }
          chaptersData.push(paras);
        }

        const charactersGender: Record<string, string | null> = {};
        const chaptersVblite: any[] = [];

        function detectGenderWithConfidence(text: string): GenderResult {
          const a = detectGenderFromAttribution(text);
          if (a) return { gender: a, confidence: 'high' };
          const v = detectGenderFromVerbs(text);
          if (v) return { gender: v, confidence: 'medium' };
          const l = detectGenderFromLexical(text);
          if (l) return { gender: l, confidence: 'low' };
          return { gender: null, confidence: null };
        }

        for (const chData of chaptersData) {
          const parasVblite: any[] = [];
          let lastNarrativeText = '';

          for (const para of chData) {
            let characterName: string | null = null;
            let genderConfidence: GenderConfidence | null = null;

            if (para.isDialogue) {
              if (para.speaker) {
                characterName = para.speaker;
                genderConfidence = 'low';
              } else if (lastNarrativeText) {
                const names = findNamesInText(lastNarrativeText)
                  .filter(n => knownCharacters.has(n));
                if (names.length > 0) characterName = names[0];
              }
              lastNarrativeText = '';
            } else {
              lastNarrativeText = para.normalized;
            }

            let charValue: any;
            if (para.isDialogue) {
              if (characterName) {
                let gender = charactersGender[characterName];
                if (gender === undefined) {
                  gender = determineGender(characterName);
                  charactersGender[characterName] = gender ?? null;
                }
                charValue = { name: characterName, gender, genderConfidence: gender ? 'low' : null };
              } else {
                const detected = detectGenderWithConfidence(para.normalized);
                if (detected.gender) {
                  charValue = { name: 'неопределено', gender: detected.gender, genderConfidence: detected.confidence };
                } else {
                  charValue = { name: 'неопределено' };
                }
              }
            } else {
              charValue = { name: 'действие' };
            }

            parasVblite.push({ text: para.text, character: charValue, voice: null });
          }

          if (parasVblite.length > 0) {
            chaptersVblite.push({ paragraphs: parasVblite });
          }
        }

        const result = {
          format: 'vblite',
          version: 1,
          title: fb2.title,
          author: fb2.author,
          metadata: {
            title: fb2.title,
            author: fb2.author,
            language: 'ru',
            source: 'fb2',
            generated: new Date().toISOString(),
          },
          chapters: chaptersVblite,
          characters: Object.entries(charactersGender).map(([name, gender]) => ({ name, gender })),
        };

        resolve({ data: result, fb2 });
      } catch (err: any) {
        reject(new Error('Ошибка парсинга FB2: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(fb2File);
  });
}
