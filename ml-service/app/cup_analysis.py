
from collections import Counter


CUP_POINTS = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50,
    6: 100,
}


def analyze_cup_patterns(games):
    """
    Analyze actual completed game records.
    Each game should contain a cupHits dictionary.
    """

    cup_totals = Counter({cup: 0 for cup in CUP_POINTS})
    total_games = 0
    total_hits = 0

    for game in games:
        if game.get("status") != "completed":
            continue

        cup_hits = game.get("cupHits", {})

        total_games += 1

        for cup in CUP_POINTS:
            count = int(cup_hits.get(str(cup), 0))

            if count < 0:
                raise ValueError("Cup hit counts cannot be negative.")

            cup_totals[cup] += count
            total_hits += count

    results = []

    for cup, points in CUP_POINTS.items():
        hits = cup_totals[cup]

        percentage = (
            round((hits / total_hits) * 100, 2)
            if total_hits > 0
            else 0
        )

        results.append({
            "cupNumber": cup,
            "points": points,
            "totalHits": hits,
            "hitPercentage": percentage,
        })

    most_hit = max(results, key=lambda item: item["totalHits"])
    least_hit = min(results, key=lambda item: item["totalHits"])

    return {
        "success": True,
        "totalGamesAnalyzed": total_games,
        "totalHits": total_hits,
        "cupAnalysis": results,
        "mostHitCup": most_hit["cupNumber"] if total_hits else None,
        "leastHitCup": least_hit["cupNumber"] if total_hits else None,
        "message": (
            "Cup hit patterns analyzed successfully."
            if total_hits
            else "No completed games with recorded hits yet."
        ),
    }
