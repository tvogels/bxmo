/**
 * CLI tool for importing new edition results from CSV.
 *
 * Usage:
 *   node cli/import.mjs --year 2026 --location "City" --country nld \
 *     --bronze 10 --silver 15 --gold 20 --csv results.csv
 *
 * CSV format (header row required):
 *   no,country,fname,lname,mname,p1,p2,p3,p4
 *
 * The tool will:
 *   1. Parse the CSV file
 *   2. Validate all data
 *   3. Write data/editions/{year}.yaml
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const EDITIONS_DIR = join(DATA_DIR, 'editions');

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1];
      i++;
    }
  }
  return opts;
}

function parseCsv(content, delimiter = ',') {
  const lines = content.trim().split('\n');
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(delimiter)
      .map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    header.forEach((h, j) => {
      row[h] = values[j] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function validateScore(value, field) {
  const n = Number(value);
  if (isNaN(n) || n < 0 || n > 7 || !Number.isInteger(n)) {
    throw new Error(
      `Invalid score for ${field}: ${value} (must be integer 0-7)`,
    );
  }
  return n;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Validate required options
  const required = [
    'year',
    'location',
    'country',
    'bronze',
    'silver',
    'gold',
    'csv',
  ];
  for (const key of required) {
    if (!opts[key]) {
      console.error(`Missing required option: --${key}`);
      console.error(
        'Usage: node cli/import.mjs --year 2026 --location "City" --country nld --bronze 10 --silver 15 --gold 20 --csv results.csv',
      );
      process.exit(1);
    }
  }

  const year = Number(opts.year);
  const hm = opts.hm !== 'false'; // default true

  // Check if edition already exists
  const editionPath = join(EDITIONS_DIR, `${year}.yaml`);
  if (existsSync(editionPath) && !opts.force) {
    console.error(`Edition ${year} already exists. Use --force to overwrite.`);
    process.exit(1);
  }

  // Parse CSV
  const csvContent = readFileSync(resolve(opts.csv), 'utf-8');
  const rows = parseCsv(csvContent, opts.delimiter || ',');
  console.log(`Parsed ${rows.length} participants from CSV`);

  // Validate and transform participants
  const participants = rows.map((row, i) => {
    const lineNum = i + 2; // 1-indexed + header
    const participant = {
      no: Number(row.no),
      country: row.country,
    };

    if (!participant.country || participant.country.length !== 3) {
      throw new Error(`Line ${lineNum}: Invalid country code "${row.country}"`);
    }

    if (row.fname) participant.fname = row.fname;
    if (row.mname) participant.mname = row.mname;
    if (row.lname) participant.lname = row.lname;

    participant.scores = [
      validateScore(row.p1, `line ${lineNum} P1`),
      validateScore(row.p2, `line ${lineNum} P2`),
      validateScore(row.p3, `line ${lineNum} P3`),
      validateScore(row.p4, `line ${lineNum} P4`),
    ];

    return participant;
  });

  // Sort by country then number
  participants.sort((a, b) => {
    const cc = a.country.localeCompare(b.country);
    if (cc !== 0) return cc;
    return a.no - b.no;
  });

  // Build edition YAML
  const edition = {
    year,
    location: opts.location,
    country: opts.country,
    thresholds: {
      bronze: Number(opts.bronze),
      silver: Number(opts.silver),
      gold: Number(opts.gold),
    },
    honourableMentions: hm,
    info: opts.info || '',
    problems: [],
    delegations: [],
    participants,
  };

  // Write YAML
  writeFileSync(
    editionPath,
    yaml.dump(edition, { lineWidth: -1, quotingType: '"', noRefs: true }),
  );

  // Summary
  const thresholds = edition.thresholds;
  let gold = 0,
    silver = 0,
    bronze = 0,
    hmCount = 0;
  for (const p of participants) {
    const total = p.scores.reduce((a, b) => a + b, 0);
    if (total >= thresholds.gold) gold++;
    else if (total >= thresholds.silver) silver++;
    else if (total >= thresholds.bronze) bronze++;
    else if (hm && p.scores.some((s) => s === 7)) hmCount++;
  }

  console.log(`\nEdition ${year} written to ${editionPath}`);
  console.log(`  Participants: ${participants.length}`);
  console.log(
    `  Countries: ${[...new Set(participants.map((p) => p.country))].length}`,
  );
  console.log(
    `  Medals: ${gold} gold, ${silver} silver, ${bronze} bronze, ${hmCount} HM`,
  );
  console.log(
    '\nNote: Add delegations and problems by editing the YAML file directly.',
  );
  console.log('Then commit and push to trigger a rebuild.');
}

main();
