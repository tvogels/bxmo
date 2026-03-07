/**
 * Validates all YAML data files for consistency and correctness.
 *
 * Usage:
 *   node cli/validate.mjs
 *
 * Checks:
 *   - All YAML files parse correctly
 *   - Required fields present in each edition
 *   - Score values in range 0-7
 *   - Country codes reference valid countries
 *   - Problem PDF files exist on disk
 *   - Thresholds are ordered (bronze ≤ silver ≤ gold)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const PUBLIC_DIR = join(ROOT, 'public');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.error(`  ⚠️  ${msg}`);
  warnings++;
}

function loadYaml(path) {
  const content = readFileSync(path, 'utf-8');
  return yaml.load(content);
}

function main() {
  console.log('Validating BxMO data...\n');

  // Load countries
  const countriesPath = join(DATA_DIR, 'countries.yaml');
  if (!existsSync(countriesPath)) {
    error('countries.yaml not found');
    return;
  }
  console.log('📂 countries.yaml');
  const countries = loadYaml(countriesPath);
  const validCountryCodes = new Set(countries.map((c) => c.code));
  console.log(`  ✅ ${countries.length} countries\n`);

  // Load languages
  const languagesPath = join(DATA_DIR, 'languages.yaml');
  if (!existsSync(languagesPath)) {
    error('languages.yaml not found');
    return;
  }
  console.log('📂 languages.yaml');
  const languages = loadYaml(languagesPath);
  const validLangCodes = new Set(languages.map((l) => l.code));
  console.log(`  ✅ ${languages.length} languages\n`);

  // Load about
  const aboutPath = join(DATA_DIR, 'about.md');
  if (!existsSync(aboutPath)) {
    warn('about.md not found');
  } else {
    console.log('📂 about.md');
    const about = readFileSync(aboutPath, 'utf-8');
    if (about.trim().length === 0) {
      warn('about.md is empty');
    } else {
      console.log(`  ✅ ${about.length} bytes\n`);
    }
  }

  // Validate editions
  const editionsDir = join(DATA_DIR, 'editions');
  if (!existsSync(editionsDir)) {
    error('editions/ directory not found');
    return;
  }

  const editionFiles = readdirSync(editionsDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();

  let totalParticipants = 0;

  for (const file of editionFiles) {
    const path = join(editionsDir, file);
    console.log(`📂 editions/${file}`);

    let ed;
    try {
      ed = loadYaml(path);
    } catch (e) {
      error(`Failed to parse YAML: ${e.message}`);
      continue;
    }

    // Required fields
    if (!ed.year) error('Missing year');
    if (!ed.location) error('Missing location');
    if (!ed.country) error('Missing country');
    if (!ed.thresholds) error('Missing thresholds');

    // Country code valid
    if (ed.country && !validCountryCodes.has(ed.country)) {
      error(`Host country "${ed.country}" not in countries.yaml`);
    }

    // Thresholds ordered
    if (ed.thresholds) {
      const { bronze, silver, gold } = ed.thresholds;
      if (bronze > silver) error(`bronze (${bronze}) > silver (${silver})`);
      if (silver > gold) error(`silver (${silver}) > gold (${gold})`);
    }

    // Participants
    if (ed.participants) {
      totalParticipants += ed.participants.length;

      for (let i = 0; i < ed.participants.length; i++) {
        const p = ed.participants[i];

        if (!p.country) {
          error(`Participant ${i + 1}: missing country`);
        } else if (!validCountryCodes.has(p.country)) {
          error(
            `Participant ${i + 1}: country "${p.country}" not in countries.yaml`,
          );
        }

        if (!p.scores || p.scores.length !== 4) {
          error(`Participant ${i + 1}: must have exactly 4 scores`);
        } else {
          for (let j = 0; j < 4; j++) {
            const s = p.scores[j];
            if (typeof s !== 'number' || s < 0 || s > 7) {
              error(
                `Participant ${i + 1}: P${j + 1} score ${s} out of range 0-7`,
              );
            }
          }
        }
      }
    } else {
      warn('No participants');
    }

    // Problems — check PDF exists
    if (ed.problems) {
      for (const prob of ed.problems) {
        if (!validLangCodes.has(prob.lang)) {
          error(`Problem language "${prob.lang}" not in languages.yaml`);
        }
        const pdfPath = join(
          PUBLIC_DIR,
          'problems',
          `bxmo-problems-${ed.year}-${prob.lang}.pdf`,
        );
        if (!existsSync(pdfPath)) {
          warn(`PDF not found: bxmo-problems-${ed.year}-${prob.lang}.pdf`);
        }
      }
    }

    // Delegations
    if (ed.delegations) {
      for (const d of ed.delegations) {
        if (!validCountryCodes.has(d.country)) {
          error(`Delegation country "${d.country}" not in countries.yaml`);
        }
      }
    }

    console.log(
      `  ✅ ${ed.participants?.length ?? 0} participants, ${ed.delegations?.length ?? 0} delegations, ${ed.problems?.length ?? 0} problems\n`,
    );
  }

  // Summary
  console.log('─'.repeat(50));
  console.log(
    `\n${editionFiles.length} editions, ${totalParticipants} participants total`,
  );

  if (errors > 0) {
    console.error(`\n❌ ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`\n⚠️  ${warnings} warning(s), 0 errors`);
  } else {
    console.log('\n✅ All data valid!');
  }
}

main();
