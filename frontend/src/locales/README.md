# Internationalization (i18n) Locales

## Purpose

Planned directory for internationalization/localization support.

**Current Status**: Placeholder (not yet implemented)

## Structure

```
locales/
├── en/        # English translations
└── ru/        # Russian translations
```

## Implementation Plan

### Phase 1: Setup i18n Library
- Choose i18n package: `next-intl`, `i18next`, or similar
- Create translation file format (JSON, YAML, etc.)
- Setup language detection

### Phase 2: Key Areas to Translate
- **UI Components**: Labels, buttons, navigation
- **Messages**: Error messages, notifications, validation
- **Content**: Book descriptions, author bios, comments

### Phase 3: Language Detection
- Browser language preference
- User preference storage in profile
- URL-based language routing (`/en/`, `/ru/`)

## Current Implementation Status

Currently, the app is primarily in Russian with some English in UI components.

**Blocking translation work**:
- [ ] Choose i18n framework
- [ ] Create translation workflow
- [ ] Setup CI/CD for translation updates
- [ ] Test RTL language support (if needed)

## References

- [next-intl documentation](https://next-intl-docs.vercel.app/)
- [i18next documentation](https://www.i18next.com/)
- [Google Translate API](https://cloud.google.com/translate)
