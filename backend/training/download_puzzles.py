"""
Download Chess Puzzles -- Fetches the Lichess puzzle database.

Lichess provides their complete puzzle database as a compressed CSV at:
https://database.lichess.org/#puzzles

The CSV contains ~4 million puzzles with fields:
  PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity,
  NbPlays, Themes, GameUrl, OpeningTags

Usage:
    python -m training.download_puzzles
    python -m training.download_puzzles --max-puzzles 100000 --min-rating 1200
    python -m training.download_puzzles --themes "mate fork"
"""

import argparse
import csv
import io
import os
import sys
import urllib.request
import zstandard as zstd


PUZZLES_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def download_puzzles(output_path: str, max_puzzles: int = 50000,
                     min_rating: int = 0, max_rating: int = 9999,
                     themes: list = None):
    """
    Download and filter puzzles from the Lichess puzzle database.

    Args:
        output_path: Where to save the filtered CSV
        max_puzzles: Maximum number of puzzles to keep
        min_rating: Minimum puzzle rating (difficulty)
        max_rating: Maximum puzzle rating
        themes: Optional list of themes to filter by (puzzle must have at least one)
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print(f"Downloading Lichess puzzle database...")
    print(f"  URL: {PUZZLES_URL}")
    print(f"  Filters: rating {min_rating}-{max_rating}, max {max_puzzles} puzzles")
    if themes:
        print(f"  Themes: {', '.join(themes)}")

    # Stream download with decompression
    req = urllib.request.Request(PUZZLES_URL)
    req.add_header("User-Agent", "chess-app-puzzle-downloader/1.0")

    response = urllib.request.urlopen(req)
    dctx = zstd.ZstdDecompressor()

    kept = 0
    scanned = 0
    header = None

    with open(output_path, "w", newline="", encoding="utf-8") as outfile:
        writer = None

        # Stream decompress and parse CSV
        with dctx.stream_reader(response) as reader:
            text_reader = io.TextIOWrapper(reader, encoding="utf-8")
            csv_reader = csv.reader(text_reader)

            for row in csv_reader:
                # First row is header
                if header is None:
                    header = row
                    writer = csv.writer(outfile)
                    writer.writerow(header)
                    # Find column indices
                    cols = {name: i for i, name in enumerate(header)}
                    rating_idx = cols.get("Rating", 3)
                    themes_idx = cols.get("Themes", 7)
                    popularity_idx = cols.get("Popularity", 5)
                    continue

                scanned += 1

                # Parse rating
                try:
                    rating = int(row[rating_idx])
                except (ValueError, IndexError):
                    continue

                # Filter by rating
                if rating < min_rating or rating > max_rating:
                    continue

                # Filter by popularity (skip very unpopular puzzles)
                try:
                    popularity = int(row[popularity_idx])
                    if popularity < -50:
                        continue
                except (ValueError, IndexError):
                    pass

                # Filter by themes
                if themes:
                    try:
                        puzzle_themes = row[themes_idx].lower().split()
                        if not any(t.lower() in puzzle_themes for t in themes):
                            continue
                    except IndexError:
                        continue

                writer.writerow(row)
                kept += 1

                if kept % 10000 == 0:
                    print(f"  Kept {kept:,} puzzles (scanned {scanned:,})...")

                if kept >= max_puzzles:
                    break

    print(f"\nDone! Saved {kept:,} puzzles to {output_path}")
    print(f"  Scanned {scanned:,} total puzzles")
    return kept


def main():
    parser = argparse.ArgumentParser(description="Download Lichess chess puzzles")
    parser.add_argument("--output", default=os.path.join(DATA_DIR, "puzzles.csv"),
                        help="Output CSV path (default: data/puzzles.csv)")
    parser.add_argument("--max-puzzles", type=int, default=50000,
                        help="Maximum puzzles to download (default: 50000)")
    parser.add_argument("--min-rating", type=int, default=0,
                        help="Minimum puzzle rating (default: 0)")
    parser.add_argument("--max-rating", type=int, default=9999,
                        help="Maximum puzzle rating (default: 9999)")
    parser.add_argument("--themes", nargs="*", default=None,
                        help="Filter by themes (e.g., mate fork pin)")
    args = parser.parse_args()

    download_puzzles(
        args.output,
        max_puzzles=args.max_puzzles,
        min_rating=args.min_rating,
        max_rating=args.max_rating,
        themes=args.themes,
    )


if __name__ == "__main__":
    main()
