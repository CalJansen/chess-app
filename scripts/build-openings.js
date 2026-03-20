// Converts Lichess ECO TSV files into a JSON lookup for the chess app.
// Usage: node scripts/build-openings.js
// Output: src/data/openings.json

const fs = require("fs");
const path = require("path");

const TSV_FILES = [
  path.join(__dirname, "eco_a.tsv"),
  path.join(__dirname, "eco_b.tsv"),
  path.join(__dirname, "eco_c.tsv"),
  path.join(__dirname, "eco_d.tsv"),
  path.join(__dirname, "eco_e.tsv"),
];

// Strip move numbers and normalize PGN to just the moves as SAN tokens
// e.g. "1. e4 e5 2. Nf3 Nc6" -> "e4 e5 Nf3 Nc6"
function pgnToMoveKey(pgn) {
  return pgn
    .replace(/\d+\.\s*/g, "") // remove move numbers
    .replace(/\s+/g, " ")     // normalize whitespace
    .trim();
}

const openings = {};

for (const file of TSV_FILES) {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  for (let i = 1; i < lines.length; i++) {
    // Skip header
    const parts = lines[i].split("\t");
    if (parts.length < 3) continue;

    const [eco, name, pgn] = parts;
    const key = pgnToMoveKey(pgn);

    // Keep the longest/most specific name for duplicate keys
    if (!openings[key] || name.length > openings[key].name.length) {
      openings[key] = { eco, name };
    }
  }
}

const outPath = path.join(__dirname, "..", "src", "data", "openings.json");
fs.writeFileSync(outPath, JSON.stringify(openings, null, 0));

console.log(`Written ${Object.keys(openings).length} openings to ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
