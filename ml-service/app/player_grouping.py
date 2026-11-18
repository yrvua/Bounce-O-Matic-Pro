
from collections import defaultdict
from sklearn.cluster import KMeans


def analyze_player_grouping(games):
    """
    Rank players by their actual game performance.
    Group players with similar performance using K-Means
    when enough distinct players are available.
    """

    player_stats = defaultdict(lambda: {
        "gamesPlayed": 0,
        "totalScore": 0,
        "totalHits": 0,
        "cupHits": {
            "1": 0,
            "2": 0,
            "3": 0,
            "4": 0,
            "5": 0,
            "6": 0,
        },
    })

    # Collect completed games by player name.
    for game in games:
        if game.get("status") != "completed":
            continue

        name = str(game.get("playerName", "Unknown Player")).strip()

        if not name:
            name = "Unknown Player"

        stats = player_stats[name]

        stats["gamesPlayed"] += 1
        stats["totalScore"] += int(game.get("score", 0))
        stats["totalHits"] += int(game.get("hits", 0))

        cup_hits = game.get("cupHits", {})

        for cup in range(1, 7):
            count = int(cup_hits.get(str(cup), 0))

            if count < 0:
                raise ValueError("Cup hit counts cannot be negative.")

            stats["cupHits"][str(cup)] += count

    # Calculate each player's average score.
    players = []

    for name, stats in player_stats.items():
        average_score = round(
            stats["totalScore"] / stats["gamesPlayed"], 2
        )

        players.append({
            "playerName": name,
            "gamesPlayed": stats["gamesPlayed"],
            "totalScore": stats["totalScore"],
            "averageScore": average_score,
            "totalHits": stats["totalHits"],
            "cupHits": stats["cupHits"],
            "group": None,
        })

    # Sort players from highest to lowest average score.
    players.sort(
        key=lambda player: (
            player["averageScore"],
            player["totalScore"],
            player["totalHits"],
        ),
        reverse=True,
    )

    # Assign ranking positions.
    for index, player in enumerate(players, start=1):
        player["rank"] = index

    # K-Means requires at least two distinct players.
    clustering_message = (
        "Not enough distinct players for K-Means grouping."
    )

    if len(players) >= 2:
        features = [
            [
                player["averageScore"],
                player["totalHits"],
                player["gamesPlayed"],
            ]
            for player in players
        ]

        cluster_count = min(3, len(players))

        model = KMeans(
            n_clusters=cluster_count,
            random_state=42,
            n_init=10,
        )

        labels = model.fit_predict(features)

        for player, label in zip(players, labels):
            player["group"] = f"Group {int(label) + 1}"

        clustering_message = (
            "Players grouped according to score, hits, "
            "and games played."
        )

    return {
        "success": True,
        "totalPlayersAnalyzed": len(players),
        "rankings": players,
        "clusteringMessage": clustering_message,
        "message": (
            "Player rankings generated successfully."
            if players
            else "No completed player games available yet."
        ),
    }
