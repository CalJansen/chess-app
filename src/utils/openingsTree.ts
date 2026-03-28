import treeData from "@/data/openings-tree.json";

export interface OpeningTreeNode {
  move: string;
  fen: string;
  eco?: string;
  name?: string;
  children: OpeningTreeNode[];
}

const root = treeData as OpeningTreeNode;

/**
 * Get the root node of the opening tree (starting position).
 */
export function getTreeRoot(): OpeningTreeNode {
  return root;
}

/**
 * Given a move sequence (SAN array), traverse the tree and return
 * the node at that position, or null if the path isn't in the tree.
 */
export function getNodeForMoves(moves: string[]): OpeningTreeNode | null {
  let node: OpeningTreeNode = root;
  for (const san of moves) {
    const child = node.children.find((c) => c.move === san);
    if (!child) return null;
    node = child;
  }
  return node;
}

/**
 * Get all available next moves from a position in the tree.
 * Returns the children of the node at the given move sequence.
 */
export function getChildrenForMoves(moves: string[]): OpeningTreeNode[] {
  const node = getNodeForMoves(moves);
  return node ? node.children : [];
}

/**
 * Search openings by name or ECO code.
 * Returns matching nodes with their full move path.
 */
export interface SearchResult {
  eco: string;
  name: string;
  moves: string[];
  fen: string;
}

export function searchOpenings(query: string, maxResults: number = 20): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  function traverse(node: OpeningTreeNode, path: string[]) {
    if (results.length >= maxResults) return;

    if (node.eco && node.name) {
      const matchesName = node.name.toLowerCase().includes(q);
      const matchesEco = node.eco.toLowerCase().startsWith(q);
      if (matchesName || matchesEco) {
        results.push({
          eco: node.eco,
          name: node.name,
          moves: [...path],
          fen: node.fen,
        });
      }
    }

    for (const child of node.children) {
      if (results.length >= maxResults) break;
      traverse(child, [...path, child.move]);
    }
  }

  traverse(root, []);
  return results;
}
