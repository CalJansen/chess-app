"""
MCTS Engine — Level 4: Monte Carlo Tree Search.

Strategy: Instead of exhaustively searching every move to a fixed depth
(like minimax), MCTS uses random simulations ("rollouts") to estimate
which moves are promising. It focuses search effort on the most promising
branches using the UCB1 formula.

Key concepts:
  - Tree Policy (Selection): Walk down the tree, picking the most promising
    child at each level using UCB1. This balances exploitation (moves that
    have scored well) with exploration (moves we haven't tried much).

  - Expansion: When we reach a node with untried moves, add one new child.

  - Rollout (Simulation): From the new node, play random moves until the
    game ends (or we hit a depth limit). Use the result to estimate the
    position's value.

  - Backpropagation: Walk back up the tree, updating the win/visit counts
    for every node we passed through.

  - UCB1 Formula: score = wins/visits + C * sqrt(ln(parent_visits) / visits)
    The first term is the exploitation component (average win rate).
    The second term is the exploration component (how uncertain we are).
    C = sqrt(2) ≈ 1.414 is the exploration constant.

Why MCTS matters for ML:
    MCTS is the foundation of AlphaZero's approach. In Phase 4, we'll
    replace the random rollouts with a neural network evaluation, turning
    this into a much more powerful algorithm.

Expected strength: ~800-1200 Elo with random rollouts (stronger with more
simulations, but fundamentally limited by random play evaluation)
"""

import math
import random
import time
import chess
from .base import ChessEngine


# ─── MCTS Node ─────────────────────────────────────────────────────────────────

class MCTSNode:
    """
    A node in the Monte Carlo search tree.

    Each node represents a game position reached by a specific move.
    It tracks how many times it's been visited and how many of those
    visits resulted in wins, which lets us estimate how good the move is.
    """

    def __init__(self, board: chess.Board, parent=None, move=None):
        self.board = board
        self.parent = parent
        self.move = move           # The move that led to this node

        self.wins = 0.0            # Number of wins from this node's perspective
        self.visits = 0            # Number of times this node was visited
        self.children = []         # Child nodes (expanded moves)
        self.untried_moves = list(board.legal_moves)  # Moves not yet expanded

    @property
    def is_fully_expanded(self) -> bool:
        """Have we tried every legal move from this position?"""
        return len(self.untried_moves) == 0

    @property
    def is_terminal(self) -> bool:
        """Is this a game-ending position?"""
        return self.board.is_game_over()

    def ucb1_score(self, exploration_constant: float = 1.414) -> float:
        """
        Calculate the UCB1 (Upper Confidence Bound) score.

        UCB1 = exploitation + exploration
             = (wins / visits) + C * sqrt(ln(parent_visits) / visits)

        - High exploitation: moves that have won often
        - High exploration: moves we haven't tried much yet

        The exploration constant C controls this tradeoff:
        - Higher C = more exploration (try new things)
        - Lower C = more exploitation (stick with what works)
        """
        if self.visits == 0:
            return float("inf")  # Always try unvisited nodes first

        exploitation = self.wins / self.visits
        exploration = exploration_constant * math.sqrt(
            math.log(self.parent.visits) / self.visits
        )
        return exploitation + exploration


# ─── MCTS Algorithm ────────────────────────────────────────────────────────────

def mcts_select(node: MCTSNode) -> MCTSNode:
    """
    SELECTION: Walk down the tree, picking the child with the highest
    UCB1 score at each level, until we reach a node with untried moves
    or a terminal position.
    """
    while not node.is_terminal and node.is_fully_expanded:
        node = max(node.children, key=lambda c: c.ucb1_score())
    return node


def mcts_expand(node: MCTSNode) -> MCTSNode:
    """
    EXPANSION: Pick a random untried move and create a new child node.
    """
    if node.untried_moves:
        move = random.choice(node.untried_moves)
        node.untried_moves.remove(move)

        new_board = node.board.copy()
        new_board.push(move)

        child = MCTSNode(new_board, parent=node, move=move)
        node.children.append(child)
        return child

    return node  # Already fully expanded


def mcts_rollout(board: chess.Board, max_depth: int = 100) -> float:
    """
    SIMULATION (ROLLOUT): Play random moves from this position until the
    game ends or we hit a depth limit. Return the result.

    Returns:
        1.0 for a win (by the side that STARTED the rollout)
        0.5 for a draw
        0.0 for a loss
    """
    sim_board = board.copy()
    starting_turn = board.turn
    depth = 0

    while not sim_board.is_game_over() and depth < max_depth:
        moves = list(sim_board.legal_moves)
        sim_board.push(random.choice(moves))
        depth += 1

    # Evaluate the result
    result = sim_board.result()
    if result == "1-0":
        return 1.0 if starting_turn == chess.WHITE else 0.0
    elif result == "0-1":
        return 0.0 if starting_turn == chess.WHITE else 1.0
    else:
        return 0.5  # Draw or depth limit reached


def mcts_backpropagate(node: MCTSNode, result: float):
    """
    BACKPROPAGATION: Walk back up the tree, updating win/visit counts.

    The tricky part: a win for one side is a loss for the other. So we
    alternate the result as we go up the tree.
    """
    while node is not None:
        node.visits += 1
        # The result needs to be from the perspective of the node's PARENT's
        # turn (the side that chose to go to this node)
        node.wins += result
        # Flip the result for the parent (opponent's perspective)
        result = 1.0 - result
        node = node.parent


# ─── Engine Class ──────────────────────────────────────────────────────────────

class MCTSEngine(ChessEngine):
    """
    Monte Carlo Tree Search engine.

    Runs a configurable number of simulations, then picks the move
    with the most visits (most robust choice).
    """

    def __init__(self, simulations: int = 800):
        self._simulations = simulations

    @property
    def name(self) -> str:
        return "mcts"

    @property
    def description(self) -> str:
        return f"Monte Carlo Tree Search -- {self._simulations} simulations with random rollouts."

    def select_move(self, board: chess.Board) -> chess.Move:
        start_time = time.time()

        # Create the root node
        root = MCTSNode(board.copy())

        # Run simulations
        for i in range(self._simulations):
            # 1. SELECT: find the most promising node to explore
            node = mcts_select(root)

            # 2. EXPAND: add a new child if possible
            if not node.is_terminal and not node.is_fully_expanded:
                node = mcts_expand(node)

            # 3. ROLLOUT: simulate a random game from this position
            result = mcts_rollout(node.board)

            # 4. BACKPROPAGATE: update statistics up the tree
            mcts_backpropagate(node, result)

        # Pick the move with the most visits (most robust)
        best_child = max(root.children, key=lambda c: c.visits)

        elapsed = time.time() - start_time

        # Log statistics
        print(f"  [mcts] simulations={self._simulations} | time={elapsed:.2f}s")
        # Show top 5 moves by visit count
        sorted_children = sorted(root.children, key=lambda c: c.visits, reverse=True)
        for child in sorted_children[:5]:
            win_rate = child.wins / child.visits if child.visits > 0 else 0
            print(
                f"    {board.san(child.move):>7} | "
                f"visits={child.visits:>5} | "
                f"win_rate={win_rate:.1%}"
            )

        return best_child.move
