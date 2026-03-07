import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Country {
  code: string;
  englishName: string;
  nativeName: string;
}

export interface Language {
  code: string;
  englishName: string;
  nativeName: string;
}

export interface Person {
  fname?: string;
  mname?: string;
  lname?: string;
}

export interface Delegation {
  country: string;
  leader?: Person;
  deputies?: Person[];
}

export interface Participant {
  no: number;
  country: string;
  fname?: string;
  mname?: string;
  lname?: string;
  scores: [number, number, number, number];
}

export interface Thresholds {
  bronze: number;
  silver: number;
  gold: number;
}

export interface ProblemRef {
  lang: string;
}

export interface Edition {
  year: number;
  location: string;
  country: string;
  thresholds: Thresholds;
  honourableMentions: boolean;
  info: string;
  problems: ProblemRef[];
  delegations: Delegation[];
  participants: Participant[];
}

// ---------------------------------------------------------------------------
// Data directory resolution
// ---------------------------------------------------------------------------

const DATA_DIR = new URL('../../data', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadYaml<T>(filename: string): T {
  const content = readFileSync(join(DATA_DIR, filename), 'utf-8');
  return yaml.load(content) as T;
}

let countriesCache: Country[] | null = null;
export function loadCountries(): Country[] {
  if (!countriesCache) {
    countriesCache = loadYaml<Country[]>('countries.yaml');
  }
  return countriesCache;
}

let languagesCache: Language[] | null = null;
export function loadLanguages(): Language[] {
  if (!languagesCache) {
    languagesCache = loadYaml<Language[]>('languages.yaml');
  }
  return languagesCache;
}

export function loadAbout(): string {
  return readFileSync(join(DATA_DIR, 'about.md'), 'utf-8');
}

let editionsCache: Map<number, Edition> | null = null;
export function loadEditions(): Map<number, Edition> {
  if (!editionsCache) {
    editionsCache = new Map();
    const files = readdirSync(join(DATA_DIR, 'editions')).filter((f) =>
      f.endsWith('.yaml'),
    );
    for (const file of files) {
      const ed = loadYaml<Edition>(`editions/${file}`);
      editionsCache.set(ed.year, ed);
    }
  }
  return editionsCache;
}

export function loadEdition(year: number): Edition | undefined {
  return loadEditions().get(year);
}

export function getEditionYears(): number[] {
  return Array.from(loadEditions().keys()).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatPersonName(p: Person | undefined | null): string {
  if (!p) return '';
  return [p.fname, p.mname, p.lname].filter(Boolean).join(' ');
}

export function participantName(p: Participant): string {
  return [p.fname, p.mname, p.lname].filter(Boolean).join(' ');
}

export function participantScore(p: Participant): number {
  return p.scores.reduce((a, b) => a + b, 0);
}

export function countryName(code: string, countries?: Country[]): string {
  const list = countries ?? loadCountries();
  return list.find((c) => c.code === code)?.englishName ?? code;
}

export function languageName(code: string, languages?: Language[]): string {
  const list = languages ?? loadLanguages();
  return list.find((l) => l.code === code)?.englishName ?? code;
}
