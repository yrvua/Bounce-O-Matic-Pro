
CUP_POINTS = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50,
    6: 100,
}


def analyze_player_recommendations(games):
    """
    Generate player performance recommendations
    using completed game records.
    """

    recommendations = []

    for game in games:

        if game.get("status") != "completed":
            continue

        player_name = game.get("playerName", "Unknown Player")
        score = int(game.get("score", 0))
        hits = int(game.get("hits", 0))
        cup_hits = game.get("cupHits", {})

        # Count successful hits for each cup.
        cup_results = {}

        for cup in CUP_POINTS:
            count = int(cup_hits.get(str(cup), 0))

            if count < 0:
                raise ValueError("Cup hit counts cannot be negative.")

            cup_results[cup] = count

        total_cup_hits = sum(cup_results.values())

        # No recommendation is possible without successful hits.
        if total_cup_hits == 0:
            recommendations.append({
                "playerName": player_name,
                "score": score,
                "totalHits": hits,
                "bestCup": None,
                "practiceCups": [],
                "recommendation": (
                    "No successful hits recorded yet. "
                    "Keep playing to generate performance data."
                ),
            })
            continue

        # Identify the cup with the most successful hits.
        highest_hits = max(cup_results.values())

        best_cups = [
            cup for cup, count in cup_results.items()
            if count == highest_hits
        ]

        # Identify cups with the fewest successful hits.
        lowest_hits = min(cup_results.values())

        practice_cups = [
            cup for cup, count in cup_results.items()
            if count == lowest_hits
        ]

        best_cup = best_cups[0]

        recommendations.append({
            "playerName": player_name,
            "score": score,
            "totalHits": hits,
            "bestCup": best_cup,
            "bestCupPoints": CUP_POINTS[best_cup],
            "practiceCups": practice_cups,
            "recommendation": (
                f"Your strongest cup is Cup {best_cup}. "
                f"Consider practicing Cup {practice_cups[0]} "
                "to improve your hit distribution."
            ),
        })

    return {
        "success": True,
        "totalPlayersAnalyzed": len(recommendations),
        "recommendations": recommendations,
        "message": (
            "Player recommendations generated successfully."
            if recommendations
            else "No completed player games available for analysis."
        ),
    }
