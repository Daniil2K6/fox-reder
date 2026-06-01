import re
import unicodedata

# Транслитерация: кириллица → латиница и латиница → кириллица
_CYR_TO_LAT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}
_CYR_TO_LAT.update({k.upper(): v.capitalize() for k, v in list(_CYR_TO_LAT.items()) if v})

_LAT_TO_CYR = {}
for _c, _l in _CYR_TO_LAT.items():
    if _l and len(_l) == 1:
        _LAT_TO_CYR[_l.lower()] = _c.lower()
        _LAT_TO_CYR[_l.upper()] = _c.upper()
_LAT_TO_CYR.update({
    'zh': 'ж', 'kh': 'х', 'ts': 'ц', 'ch': 'ч', 'sh': 'ш', 'shch': 'щ',
    'yu': 'ю', 'ya': 'я', 'yo': 'ё',
})


def transliterate(text: str) -> str:
    """Транслитерация: если текст кириллический — в латиницу, если латинский — в кириллицу."""
    if not text:
        return text

    has_cyr = any('а' <= c.lower() <= 'я' or c == 'ё' for c in text)
    has_lat = any('a' <= c.lower() <= 'z' for c in text)

    if has_cyr and not has_lat:
        result = []
        i = 0
        while i < len(text):
            chunk = text[i:i+4].lower()
            if chunk[:4] in _CYR_TO_LAT and len(_CYR_TO_LAT.get(chunk[:4], '')) > 1:
                lat = _CYR_TO_LAT.get(chunk[:4], text[i])
                result.append(lat if text[i].islower() else lat.capitalize())
                i += 4
                continue
            chunk = text[i:i+3].lower()
            if chunk[:3] in _CYR_TO_LAT and len(_CYR_TO_LAT.get(chunk[:3], '')) > 1:
                lat = _CYR_TO_LAT.get(chunk[:3], text[i])
                result.append(lat if text[i].islower() else lat.capitalize())
                i += 3
                continue
            chunk = text[i:i+2].lower()
            if chunk[:2] in _CYR_TO_LAT and len(_CYR_TO_LAT.get(chunk[:2], '')) > 1:
                lat = _CYR_TO_LAT.get(chunk[:2], text[i])
                result.append(lat if text[i].islower() else lat.capitalize())
                i += 2
                continue
            c = text[i]
            lat = _CYR_TO_LAT.get(c.lower(), c)
            result.append(lat if c.islower() else lat.capitalize() if lat else '')
            i += 1
        return ''.join(result)

    if has_lat and not has_cyr:
        result = []
        i = 0
        lower_text = text.lower()
        while i < len(text):
            if lower_text[i:i+4] == 'shch':
                result.append('щ' if text[i].islower() else 'Щ')
                i += 4
                continue
            for length in (3, 2, 1):
                chunk = lower_text[i:i+length]
                if chunk in _LAT_TO_CYR and len(_LAT_TO_CYR[chunk]) == 1:
                    cyr = _LAT_TO_CYR[chunk]
                    result.append(cyr if text[i].islower() else cyr.upper())
                    i += length
                    break
            else:
                result.append(text[i])
                i += 1
        return ''.join(result)

    return text


def _escape_fts_word(word: str) -> str:
    """Экранирование спецсимволов FTS5 и добавление вариантов регистра для кириллицы."""
    clean = re.sub(r'[^\w\-]', '', word, flags=re.UNICODE)
    if not clean:
        return ""
    variants = {clean, clean.lower(), clean.upper(), clean.capitalize()}
    escaped = [f'"{v}"' for v in sorted(variants) if v]
    if len(escaped) == 1:
        return escaped[0]
    return '(' + ' OR '.join(escaped) + ')'


def build_fts_query(text: str, search_fields: list[str] | None = None) -> str | None:
    """
    Строгий FTS5 запрос (AND между словами).
    Для каждого слова: оригинальное + lowercase + uppercase + capitalize + транслит.
    """
    if not text or not text.strip():
        return None

    clean = re.sub(r'[^\w\s\-]', '', text.strip(), flags=re.UNICODE).strip()
    if not clean:
        return None

    words = clean.split()
    if not words:
        return None

    word_groups = []
    for word in words:
        variants = {word, word.lower(), word.upper(), word.capitalize()}
        tr = transliterate(word)
        if tr and tr != word:
            variants.update({tr, tr.lower(), tr.upper(), tr.capitalize()})
        escaped = [f'"{v}"' for v in sorted(variants) if v]
        if len(escaped) == 1:
            word_groups.append(escaped[0])
        else:
            word_groups.append('(' + ' OR '.join(escaped) + ')')

    if not word_groups:
        return None

    return ' AND '.join(word_groups)


def build_fts_query_soft(text: str) -> str | None:
    """
    Мягкий FTS5 запрос: OR между всеми словами + вариантами.
    """
    if not text or not text.strip():
        return None

    clean = re.sub(r'[^\w\s\-]', '', text.strip(), flags=re.UNICODE).strip()
    if not clean:
        return None

    words = clean.split()
    if not words:
        return None

    all_variants = []
    for word in words:
        variants = {word, word.lower(), word.upper(), word.capitalize()}
        tr = transliterate(word)
        if tr and tr != word:
            variants.update({tr, tr.lower(), tr.upper(), tr.capitalize()})
        all_variants.extend([f'"{v}"' for v in sorted(variants) if v])

    if not all_variants:
        return None

    return ' OR '.join(all_variants)
