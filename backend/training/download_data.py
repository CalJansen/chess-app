"""
Download Training Data — Fetches games from the Lichess open database.

Lichess provides their complete game database at https://database.lichess.org/
The files are large (compressed PGN), so we download a specific month and
filter for rated games from players above a rating threshold.

Usage:
    python -m training.download_data --month 2013-01 --output data/lichess_games.pgn

We use an early month (2013-01) because the files are smaller (~30MB compressed)
but still contain plenty of quality games to learn from.
"""

import argparse
import os
import sys
import urllib.request
import zstandard as zstd


LICHESS_DB_URL = "https://database.lichess.org/standard/lichess_db_standard_rated_{month}.pgn.zst"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def download_and_decompress(month: str, output_path: str, max_games: int = 50000,
                            min_rating: int = 1500):
    """
    Download a Lichess monthly database and extract games.

    The database is compressed with zstandard. We stream-decompress it and
    filter games on the fly, keeping only rated games where both players
    are above min_rating. This avoids downloading/storing the full file.

    Args:
        month: Format "YYYY-MM" (e.g., "2013-01")
        output_path: Where to write the filtered PGN
        max_games: Stop after collecting this many games
        min_rating: Minimum rating for both players
    """
    url = LICHESS_DB_URL.format(month=month)
    print(f"Downloading from: {url}")
    print(f"Filtering: min rating {min_rating}, max {max_games} games")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Stream download + zstd decompression
    req = urllib.request.Request(url, headers={"User-Agent": "chess-app-trainer/1.0"})
    response = urllib.request.urlopen(req)

    dctx = zstd.ZstdDecompressor()
    reader = dctx.stream_reader(response)

    games_collected = 0
    current_game_lines = []
    in_game = False
    white_rating = 0
    black_rating = 0
    is_rated = False
    buffer = b""

    with open(output_path, "w", encoding="utf-8") as out_file:
        while True:
            chunk = reader.read(65536)
            if not chunk:
                break
            buffer += chunk
            lines = buffer.split(b"\n")
            # Keep the last incomplete line in the buffer
            buffer = lines[-1]
            lines = lines[:-1]

            for raw_line in lines:
                line = raw_line.decode("utf-8", errors="replace").rstrip()

                if line.startswith("[Event "):
                    # Start of a new game — save previous if it passes filters
                    if current_game_lines and is_rated and white_rating >= min_rating and black_rating >= min_rating:
                        out_file.write("\n".join(current_game_lines) + "\n\n")
                        games_collected += 1
                        if games_collected % 1000 == 0:
                            print(f"  Collected {games_collected}/{max_games} games...")
                        if games_collected >= max_games:
                            break
                    current_game_lines = [line]
                    in_game = True
                    white_rating = 0
                    black_rating = 0
                    is_rated = '"Rated' in line
                elif in_game:
                    current_game_lines.append(line)
                    if line.startswith("[WhiteElo "):
                        try:
                            white_rating = int(line.split('"')[1])
                        except (IndexError, ValueError):
                            pass
                    elif line.startswith("[BlackElo "):
                        try:
                            black_rating = int(line.split('"')[1])
                        except (IndexError, ValueError):
                            pass

            if games_collected >= max_games:
                break

        # Handle last game in buffer
        if current_game_lines and games_collected < max_games:
            if is_rated and white_rating >= min_rating and black_rating >= min_rating:
                out_file.write("\n".join(current_game_lines) + "\n\n")
                games_collected += 1

    reader.close()
    response.close()

    print(f"Done! Collected {games_collected} games -> {output_path}")
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"File size: {file_size_mb:.1f} MB")

    return games_collected


def main():
    parser = argparse.ArgumentParser(description="Download Lichess training data")
    parser.add_argument("--month", default="2013-01",
                        help="Database month (YYYY-MM). Default: 2013-01 (small file)")
    parser.add_argument("--output", default=os.path.join(DATA_DIR, "lichess_games.pgn"),
                        help="Output PGN file path")
    parser.add_argument("--max-games", type=int, default=50000,
                        help="Maximum number of games to collect")
    parser.add_argument("--min-rating", type=int, default=1500,
                        help="Minimum Elo rating for both players")
    args = parser.parse_args()

    download_and_decompress(args.month, args.output, args.max_games, args.min_rating)


if __name__ == "__main__":
    main()
