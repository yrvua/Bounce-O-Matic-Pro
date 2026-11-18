
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Award,
  Clock,
  Gamepad2,
  RotateCcw,
  Trophy,
  User,
  Zap,
  RefreshCw,
} from 'lucide-react'
import './App.css'

const API_URL = 'http://localhost:3001/api/game'

const cups = [
  { number: 1, points: 10 },
  { number: 2, points: 20 },
  { number: 3, points: 30 },
  { number: 4, points: 40 },
  { number: 5, points: 50 },
  { number: 6, points: 100 },
]

type GameStatus = 'ready' | 'running' | 'finished'

type GameData = {
  sessionId: string
  playerName: string
  status: 'running' | 'completed'
  timeRemaining: number
  score: number
  hits: number
}

type CupResult = {
  cupNumber: number
  points: number
  totalHits: number
  hitPercentage: number
}

type CupAnalysis = {
  success: boolean
  totalGamesAnalyzed: number
  totalHits: number
  cupAnalysis: CupResult[]
  mostHitCup: number | null
  leastHitCup: number | null
  message: string
}

type PlayerRecommendation = {
  playerName: string
  score: number
  totalHits: number
  bestCup: number | null
  bestCupPoints?: number
  practiceCups: number[]
  recommendation: string
}

type RecommendationData = {
  success: boolean
  totalPlayersAnalyzed: number
  recommendations: PlayerRecommendation[]
  message: string
}

type RankedPlayer = {
  playerName: string
  gamesPlayed: number
  totalScore: number
  averageScore: number
  totalHits: number
  cupHits: Record<string, number>
  group: string | null
  rank: number
}

type RankingData = {
  success: boolean
  totalPlayersAnalyzed: number
  rankings: RankedPlayer[]
  clusteringMessage: string
  message: string
}

async function fetchAnalyticsData<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Could not load analytics.')
  }

  return data as T
}

function App() {
  const [playerName, setPlayerName] = useState('')
  const [activePlayer, setActivePlayer] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [gameStatus, setGameStatus] = useState<GameStatus>('ready')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // AI analytics states
  const [cupData, setCupData] = useState<CupAnalysis | null>(null)
  const [recommendationData, setRecommendationData] =
    useState<RecommendationData | null>(null)
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')

  // Load all three AI analytics features from the Node.js backend
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError('')

    try {
      const [cupResult, recommendationResult, rankingResult] =
        await Promise.all([
          fetchAnalyticsData<CupAnalysis>('/analytics/cups'),
          fetchAnalyticsData<RecommendationData>(
            '/analytics/recommendations',
          ),
          fetchAnalyticsData<RankingData>('/analytics/rankings'),
        ])

      setCupData(cupResult)
      setRecommendationData(recommendationResult)
      setRankingData(rankingResult)
    } catch (error) {
      setAnalyticsError(
        error instanceof Error
          ? error.message
          : 'Could not load AI analytics.',
      )
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  // Load analytics when the dashboard first opens
  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // Refresh analytics after a game finishes
  useEffect(() => {
    if (gameStatus === 'finished') {
      loadAnalytics()
    }
  }, [gameStatus, loadAnalytics])

  // Start a new game through the backend
  const startGame = async () => {
    const name = playerName.trim()

    if (!name) {
      setErrorMessage('Please enter the player name first.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not start the game.')
      }

      const game: GameData = data.game

      setSessionId(game.sessionId)
      setActivePlayer(game.playerName)
      setScore(game.score)
      setHits(game.hits)
      setTimeLeft(game.timeRemaining)
      setGameStatus('running')
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Backend connection failed.',
      )
    } finally {
      setLoading(false)
    }
  }

  // Get the latest game information from the backend
  useEffect(() => {
    if (!sessionId || gameStatus !== 'running') return

    let isActive = true

    const updateGame = async () => {
      try {
        const response = await fetch(`${API_URL}/${sessionId}`)

        if (!response.ok) {
          throw new Error('Could not retrieve game information.')
        }

        const data = await response.json()
        const game: GameData = data.game

        if (!isActive) return

        setScore(game.score)
        setHits(game.hits)
        setTimeLeft(game.timeRemaining)

        if (game.status === 'completed') {
          setTimeLeft(0)
          setGameStatus('finished')
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Could not connect to the backend.',
          )
        }
      }
    }

    updateGame()

    const intervalId = window.setInterval(updateGame, 1000)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [sessionId, gameStatus])

  // End the current game and prepare for another player
  const resetGame = async () => {
    if (sessionId && gameStatus === 'running') {
      try {
        await fetch(`${API_URL}/${sessionId}/end`, {
          method: 'POST',
        })

        // Refresh analytics after ending the game
        await loadAnalytics()
      } catch {
        setErrorMessage('Could not end the previous game on the backend.')
      }
    }

    setSessionId('')
    setScore(0)
    setHits(0)
    setTimeLeft(60)
    setActivePlayer('')
    setPlayerName('')
    setGameStatus('ready')
    setErrorMessage('')
  }

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds)
    const minutes = Math.floor(safeSeconds / 60)
    const remainingSeconds = safeSeconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds,
    ).padStart(2, '0')}`
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Gamepad2 size={27} />
          </div>
          <div>
            <h1>Bounce-O-Matic <span>Pro</span></h1>
            <p>Distributed IoT Ping-Pong Toss Challenge</p>
          </div>
        </div>

        <div className="connection-status">
          <span className="status-dot"></span>
          BACKEND CONNECTED
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">CARNIVAL GAME SYSTEM</p>
          <h2>Ready to bounce?</h2>
          <p>Test your aim, hit the cups, and earn points!</p>
        </div>
        <div className="welcome-icon">
          <Zap size={42} />
        </div>
      </section>

      <section className="dashboard">
        <div className="game-panel panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GAME CONTROL</p>
              <h2>Player Session</h2>
            </div>
            <Gamepad2 size={25} />
          </div>

          <label htmlFor="playerName">PLAYER NAME</label>
          <div className="name-input">
            <User size={19} />
            <input
              id="playerName"
              type="text"
              placeholder="Enter player name"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              disabled={gameStatus === 'running' || loading}
            />
          </div>

          <div className="timer-card">
            <p><Clock size={17} /> TIME REMAINING</p>
            <strong className={timeLeft <= 10 ? 'timer-warning' : ''}>
              {formatTime(timeLeft)}
            </strong>
            <span>
              {gameStatus === 'running'
                ? 'GAME IN PROGRESS'
                : gameStatus === 'finished'
                  ? 'TIME IS UP!'
                  : 'READY TO START'}
            </span>
          </div>

          <div className="game-buttons">
            {gameStatus !== 'running' ? (
              <button
                className="start-button"
                onClick={startGame}
                disabled={loading}
              >
                <Zap size={19} />
                {loading
                  ? 'STARTING...'
                  : gameStatus === 'finished'
                    ? 'START NEW GAME'
                    : 'START GAME'}
              </button>
            ) : (
              <button className="start-button running-button" disabled>
                <Activity size={19} />
                GAME RUNNING
              </button>
            )}

            <button
              className="reset-button"
              onClick={resetGame}
              disabled={loading}
            >
              <RotateCcw size={18} />
              NEW PLAYER
            </button>
          </div>

          {errorMessage && (
            <p className="error-message">{errorMessage}</p>
          )}
        </div>

        <div className="stats-panel panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LIVE PERFORMANCE</p>
              <h2>Game Statistics</h2>
            </div>
            <Activity size={25} />
          </div>

          <div className="stat-grid">
            <div className="stat-card score-card">
              <div className="stat-icon"><Trophy size={22} /></div>
              <p>TOTAL SCORE</p>
              <strong>{score}</strong>
              <span>POINTS</span>
            </div>

            <div className="stat-card hits-card">
              <div className="stat-icon"><Zap size={22} /></div>
              <p>SUCCESSFUL HITS</p>
              <strong>{hits}</strong>
              <span>HITS</span>
            </div>
          </div>

          <div className="player-info">
            <span>ACTIVE PLAYER</span>
            <strong>{activePlayer || 'No player yet'}</strong>
          </div>

          {gameStatus === 'finished' && (
            <div className="finished-message">
              Game over! Final score: {score} points.
            </div>
          )}
        </div>
      </section>

      <section className="cups-section panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SCORING SYSTEM</p>
            <h2>Target Cups</h2>
          </div>
          <Award size={25} />
        </div>

        <div className="cups-grid">
          {cups.map((cup) => (
            <div className="cup-card" key={cup.number}>
              <div className="cup-number">{cup.number}</div>
              <div className="cup-visual">🥤</div>
              <h3>Cup {cup.number}</h3>
              <strong>{cup.points} <small>PTS</small></strong>
            </div>
          ))}
        </div>
      </section>

      {/* AI ANALYTICS DASHBOARD */}
      <section className="analytics-panel panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">INTELLIGENT ANALYTICS</p>
            <h2>AI Performance Center</h2>
          </div>

          <button
            className="reset-button"
            onClick={loadAnalytics}
            disabled={analyticsLoading}
          >
            <RefreshCw size={17} />
            {analyticsLoading ? 'LOADING...' : 'REFRESH'}
          </button>
        </div>

        {analyticsError && (
          <p className="error-message">{analyticsError}</p>
        )}

        {analyticsLoading && (
          <p>Loading analytics from the Python service...</p>
        )}

        {!analyticsLoading && !analyticsError && (
          <div className="analytics-grid">

            {/* PLAYER RECOMMENDATIONS */}
            <div className="analytics-card">
              <Award size={24} />
              <h3>Player Recommendations</h3>
              <p>Analyze player results and identify cups to practice.</p>

              {recommendationData &&
              recommendationData.recommendations.length > 0 ? (
                <div className="analytics-details">
                  {recommendationData.recommendations.map(
                    (item, index) => (
                      <div
                        className="analytics-item"
                        key={`${item.playerName}-${index}`}
                      >
                        <strong>{item.playerName}</strong>
                        <p>Score: {item.score}</p>
                        <p>Successful hits: {item.totalHits}</p>

                        <p>
                          Best cup:{' '}
                          {item.bestCup
                            ? `Cup ${item.bestCup}`
                            : 'Not available yet'}
                        </p>

                        <p>
                          Practice cups:{' '}
                          {item.practiceCups.length > 0
                            ? item.practiceCups
                                .map((cup) => `Cup ${cup}`)
                                .join(', ')
                            : 'Not available yet'}
                        </p>

                        <p>{item.recommendation}</p>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <span>NO COMPLETED GAMES YET</span>
              )}
            </div>

            {/* CUP HIT PATTERNS */}
            <div className="analytics-card">
              <Activity size={24} />
              <h3>Cup Hit Patterns</h3>
              <p>Discover which cups receive the most and fewest hits.</p>

              {cupData && cupData.totalHits > 0 ? (
                <div className="analytics-details">
                  <p>Total successful hits: {cupData.totalHits}</p>
                  <p>Most-hit cup: Cup {cupData.mostHitCup}</p>
                  <p>Least-hit cup: Cup {cupData.leastHitCup}</p>

                  {cupData.cupAnalysis.map((cup) => (
                    <div
                      className="analytics-item"
                      key={cup.cupNumber}
                    >
                      <strong>
                        Cup {cup.cupNumber} — {cup.points} points
                      </strong>
                      <p>
                        Hits: {cup.totalHits} (
                        {cup.hitPercentage}%)
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <span>
                  {cupData
                    ? 'NO SUCCESSFUL HITS RECORDED'
                    : 'NO CUP DATA AVAILABLE'}
                </span>
              )}
            </div>

            {/* PLAYER RANKINGS */}
            <div className="analytics-card">
              <Trophy size={24} />
              <h3>Player Rankings</h3>
              <p>Compare player scores and group similar performances.</p>

              {rankingData && rankingData.rankings.length > 0 ? (
                <div className="analytics-details">
                  {rankingData.rankings.map((player) => (
                    <div
                      className="analytics-item"
                      key={player.playerName}
                    >
                      <strong>
                        #{player.rank} — {player.playerName}
                      </strong>
                      <p>Games played: {player.gamesPlayed}</p>
                      <p>Total score: {player.totalScore}</p>
                      <p>Average score: {player.averageScore}</p>
                      <p>Successful hits: {player.totalHits}</p>
                      <p>
                        Performance group:{' '}
                        {player.group || 'Not assigned'}
                      </p>
                    </div>
                  ))}

                  <p>{rankingData.clusteringMessage}</p>
                </div>
              ) : (
                <span>NO PLAYER RANKINGS AVAILABLE</span>
              )}
            </div>

          </div>
        )}
      </section>

      <footer>
        <p>Bounce-O-Matic Pro © 2026 | IoT Carnival Game Project</p>
      </footer>
    </main>
  )
}

export default App
