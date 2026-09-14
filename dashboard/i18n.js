/**
 * KrishiRakshak i18n Engine
 * Loads translation bundles lazily and exposes t() for string lookup.
 */

const SUPPORTED = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'pa'];
const STORAGE_KEY = 'kr_lang';

let _strings = null;
let _lang = 'en';

/** Resolve a dot-path key from the translations object */
function resolve(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

/** Translate a key, with optional {placeholder} substitution */
export function t(key, vars = {}) {
  if (!_strings) return key;
  let str = resolve(_strings, key);
  if (str === null) return key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

/** Get the currently active language code */
export function currentLang() { return _lang; }

/** Get all supported language metadata (code + native name + choose label) */
export async function allLanguages() {
  const results = [];
  for (const code of SUPPORTED) {
    try {
      const mod = await loadBundle(code);
      results.push({ code, name: mod.lang.name, choose: mod.lang.choose });
    } catch { /* skip broken bundle */ }
  }
  return results;
}

async function loadBundle(code) {
  if (code === 'en') {
    const { en } = await import('./translations/en.js');
    return en;
  }
  if (code === 'hi') {
    const { hi } = await import('./translations/hi.js');
    return hi;
  }
  if (code === 'te') {
    const { te } = await import('./translations/te.js');
    return te;
  }
  if (code === 'ta') {
    const { ta } = await import('./translations/ta.js');
    return ta;
  }
  const { kn, ml, mr, bn, pa } = await import('./translations/regional.js');
  const map = { kn, ml, mr, bn, pa };
  if (map[code]) return map[code];
  throw new Error(`Unknown lang: ${code}`);
}

/** Load and activate a language. Returns the strings object. */
export async function setLanguage(code) {
  if (!SUPPORTED.includes(code)) code = 'en';
  _strings = await loadBundle(code);
  _lang = code;
  localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code;
  return _strings;
}

/** Initialize i18n from persisted preference or browser default */
export async function initI18n(forceCode) {
  const saved = forceCode || localStorage.getItem(STORAGE_KEY);
  const browser = (navigator.language || 'en').split('-')[0];
  const lang = SUPPORTED.includes(saved) ? saved : SUPPORTED.includes(browser) ? browser : 'en';
  return setLanguage(lang);
}

/** Whether the user has already chosen a language */
export function hasLanguageChoice() {
  return !!localStorage.getItem(STORAGE_KEY);
}
