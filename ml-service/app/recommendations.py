CUP_POINTS = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50,
    6: 100,
}


def _cup_list(cups):
    labels = [f"Cup {cup}" for cup in cups]
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return ", ".join(labels[:-1]) + f", and {labels[-1]}"


def analyze_player_recommendations(games):
    """Generate a data-based recommendation for each completed game."""
    recommendations = []

    for game in games:
        if game.get("status") != "completed":
            continue

        player_name = str(game.get("playerName", "Unknown Player")).strip()
        if not player_name:
            player_name = "Unknown Player"

        score = int(game.get("score", 0))
        hits = int(game.get("hits", 0))
        cup_hits = game.get("cupHits", {})

        cup_results = {}
        for cup in CUP_POINTS:
            count = int(cup_hits.get(str(cup), 0))
            if count < 0:
                raise ValueError("Cup hit counts cannot be negative.")
            cup_results[cup] = count

        total_cup_hits = sum(cup_results.values())

        if total_cup_hits == 0:
            recommendations.append({
                "playerName": player_name,
                "score": score,
                "totalHits": hits,
                "bestCup": None,
                "bestCups": [],
                "practiceCups": [],
                "balanced": False,
                "recommendation": (
                    "No successful hits recorded yet. Keep playing to generate performance data."
                ),
            })
            continue

        highest_hits = max(cup_results.values())
        lowest_hits = min(cup_results.values())
        best_cups = [cup for cup, count in cup_results.items() if count == highest_hits]
        practice_cups = [cup for cup, count in cup_results.items() if count == lowest_hits]

        # Every cup has the same count, so none is meaningfully strongest or weakest.
        if highest_hits == lowest_hits:
            recommendations.append({
                "playerName": player_name,
                "score": score,
                "totalHits": hits,
                "bestCup": None,
                "bestCups": list(CUP_POINTS),
                "bestCupPoints": None,
                "practiceCups": [],
                "balanced": True,
                "recommendation": (
                    "Your hits were evenly distributed across all six cups. "
                    "Keep that consistency and try landing more shots in Cup 6 "
                    "to increase your score."
                ),
            })
            continue

        if len(best_cups) == 1:
            strongest_text = f"Your strongest cup is Cup {best_cups[0]}"
        else:
            strongest_text = f"Your most-hit cups are {_cup_list(best_cups)}"

        practice_text = _cup_list(practice_cups)
        recommendations.append({
            "playerName": player_name,
            "score": score,
            "totalHits": hits,
            "bestCup": best_cups[0] if len(best_cups) == 1 else None,
            "bestCups": best_cups,
            "bestCupPoints": CUP_POINTS[best_cups[0]] if len(best_cups) == 1 else None,
            "practiceCups": practice_cups,
            "balanced": False,
            "recommendation": (
                f"{strongest_text}. Consider practicing {practice_text}, "
                "the cup or cups with the fewest hits, to improve your hit distribution."
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
