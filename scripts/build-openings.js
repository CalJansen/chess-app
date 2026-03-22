// Converts Lichess ECO TSV files into JSON data for the chess app.
// Usage: node scripts/build-openings.js
// Output: src/data/openings.json (flat lookup) + src/data/openings-tree.json (tree structure)

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

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

// ─── Output 1: Flat lookup (openings.json) ──────────────────────────────────

const outPath = path.join(__dirname, "..", "src", "data", "openings.json");
fs.writeFileSync(outPath, JSON.stringify(openings, null, 0));

console.log(`Written ${Object.keys(openings).length} openings to ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);

// ─── Output 2: Opening tree (openings-tree.json) ────────────────────────────
// Build a trie from all opening move sequences. Each node has:
//   move: string (SAN), eco?: string, name?: string, fen: string, children: node[]

function buildTree() {
  // Root represents the starting position
  const root = { move: "", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", children: [] };

  let inserted = 0;
  let errors = 0;

  for (const [key, { eco, name }] of Object.entries(openings)) {
    const moves = key.split(" ");
    let node = root;
    const game = new Chess();

    let valid = true;
    for (const san of moves) {
      try {
        game.move(san);
      } catch {
        errors++;
        valid = false;
        break;
      }

      // Find or create child node for this move
      let child = node.children.find((c) => c.move === san);
      if (!child) {
        child = { move: san, fen: game.fen(), children: [] };
        node.children.push(child);
      }
      node = child;
    }

    if (valid) {
      // Tag the leaf node with the opening info
      node.eco = eco;
      node.name = name;
      inserted++;
    }
  }

  // Sort children alphabetically at each level for consistent output
  function sortChildren(node) {
    node.children.sort((a, b) => a.move.localeCompare(b.move));
    for (const child of node.children) {
      sortChildren(child);
    }
  }
  sortChildren(root);

  console.log(`Tree: ${inserted} openings inserted, ${errors} parse errors`);
  return root;
}

const tree = buildTree();
const treePath = path.join(__dirname, "..", "src", "data", "openings-tree.json");
fs.writeFileSync(treePath, JSON.stringify(tree, null, 0));

console.log(`Written tree to ${treePath}`);
console.log(`Tree file size: ${(fs.statSync(treePath).size / 1024).toFixed(1)} KB`);
