"""
FB2 to VBLite converter — без LLM.
Определяет диалоги и персонажей через регулярные выражения.
"""
import json
import logging
import re
from datetime import datetime
from typing import Optional

from vb_parser import parse_fb2

logger = logging.getLogger("fb2_to_vblite")

# Паттерн для [Имя] в начале параграфа
BRACKET_SPEAKER_RE = re.compile(r'^\[([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)\]\s*[—\-]')

# Глаголы речи (все формы)
SPEECH_VERBS = [
    'сказал', 'сказала', 'сказало', 'сказали',
    'ответил', 'ответила', 'ответило', 'ответили',
    'спросил', 'спросила', 'спросило', 'спросили',
    'промолвил', 'промолвила', 'промолвили',
    'произнес', 'произнесла', 'произнесли', 'произнёс', 'произнесла',
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
    # Несовершенный вид
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
    'отвечал', 'отвечала', 'отвечали',
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
    'рявкнул', 'рявкнула', 'рявкнули',
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
    'рявкнул', 'рявкнула', 'рявкнули',
    'вскрикнул', 'вскрикнула', 'вскрикнули',
    'взвизгнул', 'взвизгнула', 'взвизгнули',
]

SPEECH_VERBS_PATTERN = re.compile(
    '|'.join(re.escape(v) + r'\b' for v in sorted(SPEECH_VERBS, key=len, reverse=True)),
    re.IGNORECASE,
)

STOP_WORDS = {'он', 'она', 'оно', 'они', 'я', 'ты', 'мы', 'вы',
              'кто', 'что', 'это', 'тот', 'так', 'вот', 'все',
              'мне', 'мной', 'меня', 'тебе', 'тобой', 'тебя',
              'ему', 'его', 'ним', 'него', 'ней', 'неё', 'них',
              'нам', 'нас', 'вам', 'вас', 'ним', 'себя', 'себе',
              'собой', 'этот', 'эта', 'это', 'эти', 'такой',
              'князь', 'граф', 'графиня', 'барон', 'баронесса',
              'господин', 'госпожа', 'товарищ', 'мистер', 'миссис',
              'дон', 'донна', 'сеньор', 'сеньора',
              'пан', 'пани', 'герр', 'фрау', 'мадам', 'месье',
              'полковник', 'генерал', 'майор', 'капитан',
              'княжна', 'княгиня', 'царь', 'король', 'королева',
              # Приветствия и общие слова с заглавной (в диалогах)
              'привет', 'здравствуй', 'здравствуйте', 'пока', 'до',
              'да', 'нет', 'ну', 'ага', 'угу', 'ой', 'ах', 'эх',
              'хорошо', 'ладно', 'конечно', 'верно', 'точно',
              'слушай', 'слушайте', 'послушай', 'послушайте',
              'извини', 'извините', 'прости', 'простите',
              'пожалуйста', 'спасибо', 'благодарю', 'рад', 'рада',
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
              'этот', 'эта', 'это', 'эти', 'такой', 'такая',
              'какой', 'какая', 'какое', 'какие', 'этой', 'эту',
              'того', 'тому', 'тем', 'том', 'тех', 'теми',
              'всех', 'всем', 'всеми', 'самых', 'самым'}


_MALE_EXCEPTIONS = frozenset([
    'никита', 'илья', 'кузьма', 'лука', 'даня', 'ваня', 'петя', 'коля',
    'миша', 'серёжа', 'алёша', 'дима', 'гриша', 'тима', 'лёша', 'паша',
    'юра', 'боря', 'витя', 'федя', 'сева', 'рома', 'толя', 'гена',
])
_UNISEX_NAMES = frozenset(['саша', 'женя', 'валя', 'шура', 'слава'])


def determine_gender(name: str) -> Optional[str]:
    """Определить пол персонажа по окончанию имени."""
    if not name:
        return None
    lower = name.lower()
    if lower in _MALE_EXCEPTIONS:
        return "male"
    if lower in _UNISEX_NAMES:
        return None
    last = name[-1].lower()
    if last in ('а', 'я', 'и'):
        return "female"
    if name.endswith(('ия', 'ья')):
        return "female"
    return "male"


# Слова, которые могут быть персонажами даже с маленькой буквы
FAMILY_ROLES = {'матушка', 'батюшка', 'отец', 'мать', 'сын', 'дочь',
                'дедушка', 'бабушка', 'дядя', 'тётя', 'тетя',
                'брат', 'сестра', 'сударь', 'сударыня'}


def _is_likely_dialogue(text: str) -> bool:
    """Проверить, содержит ли параграф диалог."""
    if text.startswith('—') or text.startswith('- '):
        return True
    if BRACKET_SPEAKER_RE.match(text):
        return True
    if text.startswith('«') or text.startswith('"'):
        return True
    return False


# Любое русское слово (для пропуска стоп-слов между глаголом и именем)
_ANY_RU_WORD = re.compile(r'([а-яёА-ЯЁ]+)\b')


def _find_bracket_speaker(text: str) -> Optional[str]:
    """Извлечь имя из [Имя]— в начале параграфа."""
    m = BRACKET_SPEAKER_RE.match(text)
    if m:
        return m.group(1)
    return None


def find_speaker(text: str) -> Optional[str]:
    """Определить имя говорящего в параграфе."""
    if not _is_likely_dialogue(text):
        return None

    # 0. [Имя]— в начале
    bracket = _find_bracket_speaker(text)
    if bracket:
        return bracket

    for verb_match in SPEECH_VERBS_PATTERN.finditer(text):
        # 1. Имя ДО глагола (Иван сказал: — ...) — только сразу перед глаголом
        before = text[max(0, verb_match.start() - 12):verb_match.start()]
        # Ищем имя, от которого до глагола только пробелы/двоеточие (макс 2 символа)
        m = re.match(r'.*?([А-ЯЁ][а-яё]+)\s{0,2}:?\s{0,2}$', before)
        if m:
            candidate = m.group(1)
            if candidate.lower() not in STOP_WORDS and len(candidate) > 1:
                # Проверяем, что между именем и глаголом нет диалоговых маркеров
                between = before[before.rfind(candidate) + len(candidate):]
                if not re.search(r'[—«\"„\u201C\u201E]', between):
                    return candidate

        # 2. Имя ПОСЛЕ глагола (— текст, — сказал Иван.)
        after = text[verb_match.end():]
        for _ in range(5):
            after = after.strip().lstrip(', -—:')
            m = _ANY_RU_WORD.match(after)
            if m:
                word = m.group(1)
                word_lower = word.lower()
                if word[0].isupper() and word_lower not in STOP_WORDS and len(word) > 1:
                    return word
                # Семейные роли (матушка, отец) тоже считаем персонажами
                if word_lower in FAMILY_ROLES:
                    return word
                after = after[m.end():]
            else:
                break

    return None


def _find_names_in_text(text: str) -> list[str]:
    """Найти все имена собственные (с заглавной) в тексте, исключая стоп-слова."""
    names = re.findall(r'(?<!\w)([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)(?!\w)', text)
    result = []
    for n in names:
        if n.lower() not in STOP_WORDS and len(n) > 1:
            result.append(n)
    return result


def _is_narrative(text: str) -> bool:
    """Проверить, является ли параграф нарративом (не диалогом)."""
    return not _is_likely_dialogue(text) and not BRACKET_SPEAKER_RE.match(text)


# Глагольные окончания для определения пола
_FEMALE_PAST_ENDINGS = ('ла', 'лась')
_MALE_PAST_ENDINGS = ('л', 'лся')


def _detect_gender_from_verbs(text: str) -> Optional[str]:
    """Определить пол говорящего по глагольным формам (1-е лицо, рядом с 'я')."""
    tokens = [(m.group(), m.start()) for m in re.finditer(r'[а-яё]+', text.lower())]
    for idx, (w, pos) in enumerate(tokens):
        if w != 'я':
            continue
        for j in range(max(0, idx - 4), min(len(tokens), idx + 5)):
            if j == idx:
                continue
            neighbor, npos = tokens[j]
            start = min(npos + len(neighbor), pos)
            end = max(npos, pos)
            between = text[start:end]
            if any(c in between for c in ('.', '!', '?', ':', ';')):
                continue
            gender = _check_gender_word(neighbor)
            if gender:
                return gender
    return None


_FEMALE_NOUNS = frozenset([
    'незнакомка', 'девушка', 'девица', 'женщина', 'старуха', 'старушка',
    'ведьма', 'колдунья', 'принцесса', 'королева', 'княгиня', 'княжна',
    'богиня', 'госпожа', 'леди', 'мадам', 'мисс', 'миссис',
    'хозяйка', 'мама', 'мать', 'сестра', 'дочь', 'бабушка', 'тётя', 'жена',
    'подруга', 'спутница', 'напарница', 'ученица', 'учительница',
    'воительница', 'охотница', 'красавица', 'императрица',
])
_MALE_NOUNS = frozenset([
    'незнакомец', 'парень', 'мужчина', 'старик', 'дед',
    'принц', 'король', 'князь', 'царь', 'император',
    'господин', 'мистер', 'сэр', 'месье',
    'хозяин', 'отец', 'папа', 'брат', 'сын',
    'друг', 'спутник', 'напарник', 'ученик', 'учитель',
    'воин', 'охотник', 'красавец',
])


def _detect_gender_from_attribution(text: str) -> Optional[str]:
    """Определить пол по чётным сегментам тире (атрибуция)."""
    parts = text.split('—')
    found = False
    for i in range(2, len(parts), 2):
        seg = parts[i].strip()
        if not seg:
            continue
        found = True
        lower = seg.lower()
        if 'женский голос' in lower or 'женск' in lower:
            return "female"
        if 'мужской голос' in lower or 'мужск' in lower:
            return "male"
        words = re.findall(r'[а-яё]+', lower)
        for w in words:
            gender = _check_gender_word(w)
            if gender:
                return gender
            if w in _FEMALE_NOUNS:
                return "female"
            if w in _MALE_NOUNS:
                return "male"
    return None


_FEMALE_LEXICAL = frozenset(['одна', 'одну', 'сама', 'моя', 'твоя', 'своя'])


def _detect_gender_from_lexical(text: str) -> Optional[str]:
    """Gender markers в тексте диалога (без атрибуции). Fallback."""
    words = re.findall(r'[а-яё]+', text.lower())
    for w in words:
        if w in _FEMALE_LEXICAL:
            return "female"
    return None


def _check_gender_word(word: str) -> Optional[str]:
    """Проверить слово на признаки рода."""
    # Female past tense
    if word.endswith('лась'):
        return "female"
    if word.endswith('ла') and not word.endswith(('ло', 'ли')):
        return "female"
    # Male past tense (не ла/ло/ли/лась/лось/лись)
    if word.endswith('лся'):
        return "male"
    if word.endswith('л') and not word.endswith(
        ('ла', 'ло', 'ли', 'лый', 'лая', 'лое', 'лые',
         'лась', 'лось', 'лись')
    ):
        return "male"
    # Short adjectives & participles
    if word in ('рада', 'готова', 'согласна', 'должна', 'уверена',
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
                'настроена', 'удивлена'):
        return "female"
    # Irregular male past tense (not ending in -л)
    if word in ('мог', 'нёс', 'вёз', 'полз', 'рос', 'грёб', 'скрёб'):
        return "male"
    if word in ('рад', 'готов', 'согласен', 'должен', 'уверен',
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
                'настроен', 'удивлён'):
        return "male"
    if word == 'была':
        return "female"
    if word == 'был':
        return "male"
    return None


def _normalize_text(text: str) -> str:
    """Normalize text before parsing."""
    return (text
        .replace('\u00ad', '')           # soft hyphen
        .replace('\u2013', '—')          # en-dash → —
        .replace('\u2014', '—')          # em-dash → —
        .replace('\u2018', "'")          # curly quotes → straight
        .replace('\u2019', "'")
        .replace('\u201c', '"')
        .replace('\u201d', '"')
    )


def _detect_gender_with_confidence(text: str) -> tuple[Optional[str], Optional[str]]:
    """(gender, confidence). high=attribution, medium=verbs, low=lexical."""
    a = _detect_gender_from_attribution(text)
    if a:
        return a, 'high'
    v = _detect_gender_from_verbs(text)
    if v:
        return v, 'medium'
    l = _detect_gender_from_lexical(text)
    if l:
        return l, 'low'
    return None, None


def convert_fb2_to_vblite(fb2_path: str) -> dict:
    """Конвертировать FB2 файл в VBLite формат без LLM."""
    logger.info(f"Parsing FB2: {fb2_path}")
    data = parse_fb2(fb2_path)

    # Pass 1: предвычисляем speaker для всех параграфов + собираем known characters
    known_characters: set[str] = set()
    chapters_data: list[dict] = []

    for ch in data.get("chapters", []):
        chapter_paras = []
        for p in ch.get("paragraphs", []):
            raw = p.get("text", "")
            if not raw:
                continue
            text = _normalize_text(raw)
            speaker = find_speaker(text)
            if speaker:
                known_characters.add(speaker)
            chapter_paras.append({
                "text": raw,
                "normalized": text,
                "speaker": speaker,
                "is_dialogue": _is_likely_dialogue(text),
            })
        chapters_data.append({
            "id": ch.get("id", ""),
            "title": ch.get("title", ""),
            "paragraphs": chapter_paras,
        })

    logger.info(f"Found {len(known_characters)} known characters via verb/bracket detection")

    # Pass 2: назначение speaker + gender
    characters_gender: dict[str, Optional[str]] = {}
    chapters_vblite = []

    for ch_data in chapters_data:
        paragraphs_vblite = []
        last_narrative_text = ""

        for para in ch_data["paragraphs"]:
            text = para["normalized"]
            detected = para["speaker"]
            is_dialogue = para["is_dialogue"]

            character_name = None
            gender_confidence = None

            if is_dialogue:
                if detected:
                    character_name = detected
                    gender_confidence = 'low'
                else:
                    # Наследование из предыдущего нарратива
                    if last_narrative_text:
                        names = [n for n in _find_names_in_text(last_narrative_text)
                                 if n in known_characters]
                        if names:
                            character_name = names[0]
                last_narrative_text = ""
            else:
                last_narrative_text = text

            if is_dialogue:
                if character_name:
                    gender = characters_gender.get(character_name)
                    if gender is None:
                        gender = determine_gender(character_name)
                        characters_gender[character_name] = gender
                    conf = 'low' if gender else None
                    char_value = {"name": character_name, "gender": gender, "genderConfidence": conf}
                else:
                    detected_gender, conf = _detect_gender_with_confidence(text)
                    if detected_gender:
                        char_value = {"name": "неопределено", "gender": detected_gender, "genderConfidence": conf}
                    else:
                        char_value = {"name": "неопределено"}
            else:
                char_value = {"name": "действие"}

            paragraphs_vblite.append({
                "text": para["text"],
                "character": char_value,
                "voice": None,
            })

        if paragraphs_vblite:
            chapters_vblite.append({
                "id": ch_data["id"],
                "title": ch_data["title"],
                "paragraphs": paragraphs_vblite,
            })

    now = datetime.now().isoformat()
    book_title = data.get("title", "")
    book_author = data.get("author", "")
    result = {
        "format": "vblite",
        "version": 1,
        "title": book_title,
        "author": book_author,
        "metadata": {
            "title": book_title,
            "author": book_author,
            "language": "ru",
            "source": "fb2",
            "generated": now,
        },
        "chapters": chapters_vblite,
        "characters": [
            {"name": name, "gender": gender}
            for name, gender in characters_gender.items()
        ],
    }

    logger.info(
        f"Converted: {result['metadata']['title']} — "
        f"{len(result['chapters'])} chapters, "
        f"{len(result['characters'])} characters"
    )
    return result


def convert_fb2_to_vblite_json(fb2_path: str) -> str:
    """Конвертировать FB2 в JSON строку VBLite."""
    return json.dumps(
        convert_fb2_to_vblite(fb2_path),
        ensure_ascii=False,
        indent=2,
    )
