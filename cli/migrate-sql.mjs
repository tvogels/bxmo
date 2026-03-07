/**
 * SQL-to-YAML migration script for BxMO data.
 *
 * Parses a phpMyAdmin SQL dump and produces:
 *   - data/countries.yaml
 *   - data/languages.yaml
 *   - data/about.md
 *   - data/editions/{year}.yaml  (one per edition)
 *
 * Usage:
 *   node cli/migrate-sql.mjs <path-to-sql-dump>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const EDITIONS_DIR = join(DATA_DIR, 'editions');

// ---------------------------------------------------------------------------
// SQL value parser — handles strings, NULLs, and numbers inside INSERT rows
// ---------------------------------------------------------------------------

/**
 * Parse a single row of SQL values like: (1, 'hello', NULL, 'it''s')
 * Returns an array of JS values (string | number | null).
 */
function parseSqlRow(row) {
  const values = [];
  let i = 0;

  // Skip leading '('
  while (i < row.length && row[i] !== '(') i++;
  i++; // skip '('

  while (i < row.length) {
    // Skip whitespace
    while (i < row.length && row[i] === ' ') i++;

    if (row[i] === ')') break;

    if (row[i] === ',') {
      i++;
      continue;
    }

    if (row[i] === 'N' && row.substring(i, i + 4) === 'NULL') {
      values.push(null);
      i += 4;
      continue;
    }

    if (row[i] === "'") {
      // String value — handle escaped quotes
      i++; // skip opening quote
      let str = '';
      while (i < row.length) {
        if (row[i] === "'" && row[i + 1] === "'") {
          str += "'";
          i += 2;
        } else if (row[i] === "'") {
          i++; // skip closing quote
          break;
        } else if (row[i] === '\\' && row[i + 1] === "'") {
          str += "'";
          i += 2;
        } else if (row[i] === '\\' && row[i + 1] === '\\') {
          str += '\\';
          i += 2;
        } else if (row[i] === '\\' && row[i + 1] === 'n') {
          str += '\n';
          i += 2;
        } else if (row[i] === '\\' && row[i + 1] === 'r') {
          str += '\r';
          i += 2;
        } else if (row[i] === '\\' && row[i + 1] === '"') {
          str += '"';
          i += 2;
        } else {
          str += row[i];
          i++;
        }
      }
      values.push(str);
      continue;
    }

    // Number value
    let num = '';
    while (
      i < row.length &&
      row[i] !== ',' &&
      row[i] !== ')' &&
      row[i] !== ' '
    ) {
      num += row[i];
      i++;
    }
    values.push(Number(num));
  }

  return values;
}

/**
 * Extract all INSERT rows for a given table from the SQL dump.
 * Returns an array of arrays (each inner array = one row's values).
 */
function extractInserts(sql, tableName) {
  const pattern = new RegExp(
    `INSERT INTO \`${tableName}\`[^V]*VALUES\\s*\\n?`,
    'g',
  );
  const match = pattern.exec(sql);
  if (!match) return [];

  // Find the block from after VALUES to the statement-ending semicolon.
  // We must skip semicolons inside string literals.
  const start = match.index + match[0].length;
  let end = start;
  let inString = false;
  for (let i = start; i < sql.length; i++) {
    if (inString) {
      if (sql[i] === '\\') {
        i++; // skip escaped character
      } else if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          i++; // skip doubled quote
        } else {
          inString = false;
        }
      }
    } else {
      if (sql[i] === "'") {
        inString = true;
      } else if (sql[i] === ';') {
        end = i;
        break;
      }
    }
  }
  const block = sql.substring(start, end);

  // Split into individual rows. Each row starts with '(' and ends with ')'
  const rows = [];
  let depth = 0;
  let rowStart = -1;

  for (let i = 0; i < block.length; i++) {
    if (block[i] === '(' && depth === 0) {
      rowStart = i;
      depth = 1;
    } else if (block[i] === '(') {
      depth++;
    } else if (block[i] === ')') {
      depth--;
      if (depth === 0 && rowStart >= 0) {
        rows.push(parseSqlRow(block.substring(rowStart, i + 1)));
        rowStart = -1;
      }
    } else if (block[i] === "'" && depth > 0) {
      // Skip string contents to avoid counting parens inside strings
      i++;
      while (i < block.length) {
        if (block[i] === "'" && block[i + 1] === "'") {
          i += 2;
        } else if (block[i] === '\\' && block[i + 1] === "'") {
          i += 2;
        } else if (block[i] === "'") {
          break;
        } else {
          i++;
        }
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// HTML to Markdown conversion (lightweight, for edition infoPage fields)
// ---------------------------------------------------------------------------

function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;

  // Remove HTML entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&eacute;/g, 'é');
  md = md.replace(/&euml;/g, 'ë');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');

  // Convert links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');

  // Remove spans, divs, and other inline wrappers (keep content)
  md = md.replace(/<\/?(?:span|div|br\s*\/?)[^>]*>/gi, ' ');

  // Convert paragraphs to double newlines
  md = md.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  md = md.replace(/<\/?p[^>]*>/gi, '');

  // Remove any remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  md = md.replace(/[ \t]+/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

// ---------------------------------------------------------------------------
// Name formatting helper
// ---------------------------------------------------------------------------

function formatName(fname, lname, mname) {
  if (!fname && !lname) return null;
  const parts = [fname, mname, lname].filter(Boolean);
  return parts.join(' ');
}

function buildPerson(fname, lname, mname) {
  const name = formatName(fname, lname, mname);
  if (!name) return null;
  const result = {};
  if (fname) result.fname = fname;
  if (mname) result.mname = mname;
  if (lname) result.lname = lname;
  return result;
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

function migrate(sqlPath) {
  const sql = readFileSync(sqlPath, 'utf-8');

  // --- Countries ---
  const countryRows = extractInserts(sql, 'Country');
  const countries = countryRows.map(([code, englishName, nativeName]) => ({
    code,
    englishName,
    nativeName,
  }));
  countries.sort((a, b) => a.code.localeCompare(b.code));

  // --- Languages ---
  const langRows = extractInserts(sql, 'Language');
  const languages = langRows.map(([code, englishName, nativeName]) => ({
    code,
    englishName,
    nativeName,
  }));
  languages.sort((a, b) => a.code.localeCompare(b.code));

  // --- Editions ---
  const editionRows = extractInserts(sql, 'Edition');
  const editions = {};
  for (const [
    year,
    country,
    location,
    bronze,
    silver,
    gold,
    infoPage,
    honourableMentions,
  ] of editionRows) {
    editions[year] = {
      year,
      location,
      country,
      thresholds: { bronze, silver, gold },
      honourableMentions: honourableMentions === 1,
      info: htmlToMarkdown(infoPage),
      problems: [],
      delegations: [],
      participants: [],
    };
  }

  // --- Problem PDFs ---
  const pdfRows = extractInserts(sql, 'ProblemPdf');
  for (const [_id, edition, language] of pdfRows) {
    if (editions[edition]) {
      editions[edition].problems.push({ lang: language });
    }
  }
  // Sort problems per edition by language code
  for (const ed of Object.values(editions)) {
    ed.problems.sort((a, b) => a.lang.localeCompare(b.lang));
  }

  // --- Country Participations (delegations) ---
  const cpRows = extractInserts(sql, 'CountryParticipation');
  for (const row of cpRows) {
    const [
      _id,
      country,
      edition,
      leaderFname,
      leaderLname,
      leaderMname,
      dep1Fname,
      dep1Lname,
      dep1Mname,
      dep2Fname,
      dep2Lname,
      dep2Mname,
      dep3Fname,
      dep3Lname,
      dep3Mname,
    ] = row;

    if (!editions[edition]) continue;

    const delegation = { country };

    const leader = buildPerson(leaderFname, leaderLname, leaderMname);
    if (leader) delegation.leader = leader;

    const deputies = [
      buildPerson(dep1Fname, dep1Lname, dep1Mname),
      buildPerson(dep2Fname, dep2Lname, dep2Mname),
      buildPerson(dep3Fname, dep3Lname, dep3Mname),
    ].filter(Boolean);

    if (deputies.length > 0) delegation.deputies = deputies;

    editions[edition].delegations.push(delegation);
  }
  // Sort delegations by country code
  for (const ed of Object.values(editions)) {
    ed.delegations.sort((a, b) => a.country.localeCompare(b.country));
  }

  // --- Participants ---
  const partRows = extractInserts(sql, 'Participant');
  for (const row of partRows) {
    const [
      _id,
      edition,
      country,
      no,
      fname,
      lname,
      mname,
      _dob,
      _gender,
      p1,
      p2,
      p3,
      p4,
      _award, // We don't store award — it's computed from thresholds
    ] = row;

    if (!editions[edition]) continue;

    const participant = { no, country };
    if (fname) participant.fname = fname;
    if (mname) participant.mname = mname;
    if (lname) participant.lname = lname;
    participant.scores = [p1, p2, p3, p4];

    editions[edition].participants.push(participant);
  }
  // Sort participants by country then number
  for (const ed of Object.values(editions)) {
    ed.participants.sort((a, b) => {
      const cc = a.country.localeCompare(b.country);
      if (cc !== 0) return cc;
      return a.no - b.no;
    });
  }

  // --- Write output ---
  mkdirSync(EDITIONS_DIR, { recursive: true });

  // countries.yaml
  writeFileSync(
    join(DATA_DIR, 'countries.yaml'),
    yaml.dump(countries, { lineWidth: -1, quotingType: '"' }),
  );

  // languages.yaml
  writeFileSync(
    join(DATA_DIR, 'languages.yaml'),
    yaml.dump(languages, { lineWidth: -1, quotingType: '"' }),
  );

  // about.md (from info.html)
  const infoHtmlPath = join(
    ROOT,
    '..',
    'bxmo-clean',
    'public_html',
    'info.html',
  );
  if (existsSync(infoHtmlPath)) {
    const infoHtml = readFileSync(infoHtmlPath, 'utf-8');
    const aboutMd = htmlToMarkdown(infoHtml);
    writeFileSync(join(DATA_DIR, 'about.md'), aboutMd + '\n');
  } else {
    writeFileSync(
      join(DATA_DIR, 'about.md'),
      '# The Benelux Mathematical Olympiad\n\nContent to be added.\n',
    );
  }

  // Per-edition YAML
  const years = Object.keys(editions)
    .map(Number)
    .sort((a, b) => a - b);

  for (const year of years) {
    const ed = editions[year];
    const doc = {
      year: ed.year,
      location: ed.location,
      country: ed.country,
      thresholds: ed.thresholds,
      honourableMentions: ed.honourableMentions,
      info: ed.info,
      problems: ed.problems,
      delegations: ed.delegations,
      participants: ed.participants,
    };

    writeFileSync(
      join(EDITIONS_DIR, `${year}.yaml`),
      yaml.dump(doc, {
        lineWidth: -1,
        quotingType: '"',
        noRefs: true,
      }),
    );
  }

  // --- Summary ---
  const totalParticipants = Object.values(editions).reduce(
    (sum, ed) => sum + ed.participants.length,
    0,
  );
  console.warn(`Migration complete:`);
  console.warn(`  Countries:    ${countries.length}`);
  console.warn(`  Languages:    ${languages.length}`);
  console.warn(
    `  Editions:     ${years.length} (${years[0]}-${years[years.length - 1]})`,
  );
  console.warn(`  Participants: ${totalParticipants}`);
  console.warn(`  Problem PDFs: ${pdfRows.length}`);
  console.warn(`\nOutput written to ${DATA_DIR}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error('Usage: node cli/migrate-sql.mjs <path-to-sql-dump>');
  process.exit(1);
}

migrate(resolve(sqlPath));
