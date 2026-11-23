from collections import defaultdict
from sklearn.cluster import KMeans


def analyze_player_grouping(games):
    """Aggregate completed games by player, ignoring name capitalization."""
    player_stats = defaultdict(lambda: {
        "playerName": None,
        "gamesPlayed": 0,
        "totalScore": 0,
        "totalHits": 0,
        "cupHits": {str(cup): 0 for cup in range(1, 7)},
    })

    for game in games:
        if game.get("status") != "completed":
            continue

        display_name = str(game.get("playerName", "Unknown Player")).strip()
        if not display_name:
            display_name = "Unknown Player"

        # Use a normalized key for matching, while keeping the first spelling
        # seen in the database for display.
        key = display_name.casefold()
        stats = player_stats[key]
        if stats["playerName"] is None:
            stats["playerName"] = display_name

        stats["gamesPlayed"] += 1
        stats["totalScore"] += int(game.get("score", 0))
        stats["totalHits"] += int(game.get("hits", 0))

        cup_hits = game.get("cupHits", {})
        for cup in range(1, 7):
            count = int(cup_hits.get(str(cup), 0))
            if count < 0:
                raise ValueError("Cup hit counts cannot be negative.")
            stats["cupHits"][str(cup)] += count

    players = []
    for stats in player_stats.values():
        average_score = round(stats["totalScore"] / stats["gamesPlayed"], 2)
        players.append({
            "playerName": stats["playerName"],
            "gamesPlayed": stats["gamesPlayed"],
            "totalScore": stats["totalScore"],
            "averageScore": average_score,
            "totalHits": stats["totalHits"],
            "cupHits": stats["cupHits"],
            "group": None,
        })

    players.sort(
        key=lambda player: (
            player["averageScore"],
            player["totalScore"],
            player["totalHits"],
        ),
        reverse=True,
    )

    for index, player in enumerate(players, start=1):
        player["rank"] = index

    clustering_message = "Not enough distinct players for K-Means grouping."
    if len(players) >= 2:
        features = [
            [player["averageScore"], player["totalHits"], player["gamesPlayed"]]
            for player in players
        ]
        cluster_count = min(3, len(players))
        model = KMeans(n_clusters=cluster_count, random_state=42, n_init=10)
        labels = model.fit_predict(features)
        for player, label in zip(players, labels):
            player["group"] = f"Group {int(label) + 1}"
        clustering_message = "Players grouped according to score, hits, and games played."

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
