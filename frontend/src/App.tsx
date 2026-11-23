
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Clock,
  Gamepad2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Target,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';
import './App.css';

type Screen = 'landing' | 'welcome' | 'game' | 'results' | 'operator';
type GameStatus = 'idle' | 'running' | 'finished';
type ServiceStatus = 'checking' | 'connected' | 'waiting' | 'offline' | 'unknown';

interface ServiceHealth {
  gameApi: ServiceStatus;
  aiApi: ServiceStatus;
  esp32: ServiceStatus;
  checkedAt: string | null;
}

interface GameData {
  sessionId?: string;
  score?: number;
  hits?: number;
  timeLeft?: number;
  timeRemaining?: number;
  status?: string;
  playerName?: string;
}

interface CupAnalysis {
  cupNumber?: number;
  cup?: number;
  totalHits?: number;
  hits?: number;
  count?: number;
  percentage?: number;
  hitPercentage?: number;
}

interface PlayerRecommendation {
  playerName?: string;
  score?: number;
  totalHits?: number;
  recommendation?: string;
  message?: string;
}

interface RankedPlayer {
  playerName?: string;
  name?: string;
  score?: number;
  totalScore?: number;
  averageScore?: number;
  gamesPlayed?: number;
  rank?: number;
}

interface AnalyticsData {
  cups: CupAnalysis[];
  recommendations: PlayerRecommendation[];
  rankings: RankedPlayer[];
}

const API_URL = 'http://localhost:3001/api/game';

const CUP_SCORES = [
  { cup: 1, points: 10 },
  { cup: 2, points: 20 },
  { cup: 3, points: 30 },
  { cup: 4, points: 40 },
  { cup: 5, points: 50 },
  { cup: 6, points: 100 },
];

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [playerName, setPlayerName] = useState('');
  const [activePlayer, setActivePlayer] = useState('Guest');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');

  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    cups: [],
    recommendations: [],
    rankings: [],
  });

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [hitFeedback, setHitFeedback] = useState<{ points: number; cupNumber?: number } | null>(null);
  const previousScoreRef = useRef(0);
  const previousHitsRef = useRef(0);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth>({
    gameApi: 'unknown',
    aiApi: 'unknown',
    esp32: 'unknown',
    checkedAt: null,
  });

  const checkServices = useCallback(async () => {
    setServiceHealth((current) => ({ ...current, gameApi: 'checking', aiApi: 'checking', esp32: 'checking' }));

    const checkEndpoint = async (url: string): Promise<ServiceStatus> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        return response.ok ? 'connected' : 'offline';
      } catch {
        return 'offline';
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const checkESP32 = async (): Promise<ServiceStatus> => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${API_URL}/esp32/status`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return 'offline';
        const status = await response.json();
        return status.connected ? 'connected' : 'offline';
      } catch {
        return 'offline';
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const [gameApi, aiApi, esp32] = await Promise.all([
      checkEndpoint(`${API_URL}/history`),
      checkEndpoint(`${API_URL}/analytics/recommendations`),
      checkESP32(),
    ]);

    setServiceHealth({ gameApi, aiApi, esp32, checkedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) });
  }, []);

  useEffect(() => {
    if (screen !== 'game' || gameStatus === 'running') return;

    let active = true;
    const checkESP32Status = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch(`${API_URL}/esp32/status`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const status = response.ok ? await response.json() : null;
        if (active) {
          setServiceHealth((current) => ({
            ...current,
            esp32: status?.connected === true ? 'connected' : 'offline',
          }));
        }
      } catch {
        if (active) setServiceHealth((current) => ({ ...current, esp32: 'offline' }));
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void checkESP32Status();
    const interval = window.setInterval(checkESP32Status, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [screen, gameStatus]);

  useEffect(() => {
    const scoreGain = score - previousScoreRef.current;
    const hitGain = hits - previousHitsRef.current;

    if (gameStatus === 'running' && scoreGain > 0) {
      const cupNumber = hitGain === 1
        ? CUP_SCORES.find((cup) => cup.points === scoreGain)?.cup
        : undefined;
      setHitFeedback({ points: scoreGain, cupNumber });
      const timeout = window.setTimeout(() => setHitFeedback(null), 1700);
      previousScoreRef.current = score;
      previousHitsRef.current = hits;
      return () => window.clearTimeout(timeout);
    }

    previousScoreRef.current = score;
    previousHitsRef.current = hits;
  }, [score, hits, gameStatus]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    try {
      const [cupsRes, recommendationsRes, rankingsRes] =
        await Promise.all([
          fetch(`${API_URL}/analytics/cups`),
          fetch(`${API_URL}/analytics/recommendations`),
          fetch(`${API_URL}/analytics/rankings`),
        ]);

      if (!cupsRes.ok || !recommendationsRes.ok || !rankingsRes.ok) {
        throw new Error('Analytics data is not available.');
      }

      const [cups, recommendations, rankings] = await Promise.all([
        cupsRes.json(),
        recommendationsRes.json(),
        rankingsRes.json(),
      ]);

      setAnalytics({
        cups: Array.isArray(cups) ? cups : cups?.cupAnalysis ?? cups?.cups ?? cups?.data ?? [],
        recommendations: Array.isArray(recommendations)
          ? recommendations
          : recommendations?.recommendations ?? recommendations?.data ?? [],
        rankings: Array.isArray(rankings)
          ? rankings
          : rankings?.rankings ?? rankings?.data ?? [],
      });
    } catch (error) {
      console.error('Analytics loading error:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Real game: get scores and hits from the backend.
  useEffect(() => {
    if (!sessionId || gameStatus !== 'running') return;

    const pollGame = async () => {
      try {
        const response = await fetch(`${API_URL}/${sessionId}`);

        if (!response.ok) {
          throw new Error('Unable to get game information.');
        }

        const responseData = await response.json();
        const data: GameData = responseData.game ?? responseData.session ?? responseData;
        const remainingTime = data.timeLeft ?? data.timeRemaining;

        setScore(data.score ?? 0);
        setHits(data.hits ?? 0);
        setTimeLeft(remainingTime ?? 60);

        if (
          data.status === 'finished' ||
          data.status === 'completed' ||
          (remainingTime !== undefined && remainingTime <= 0)
        ) {
          setGameStatus('finished');
          setScreen('results');
          loadAnalytics();
        }
      } catch (error) {
        console.error('Game polling error:', error);
        setErrorMessage('Unable to connect to the game server.');
      }
    };

    pollGame();

    const interval = window.setInterval(pollGame, 1000);

    return () => window.clearInterval(interval);
  }, [sessionId, gameStatus, loadAnalytics]);

  const startGame = async () => {
    if (serviceHealth.gameApi !== 'connected' || serviceHealth.esp32 !== 'connected') {
      setErrorMessage('Connect the ESP32 and game server before starting the round.');
      void checkServices();
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const name = playerName.trim() || 'Guest';
    setActivePlayer(name);

    try {
      const response = await fetch(`${API_URL}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName: name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 503) {
          setServiceHealth((current) => ({ ...current, esp32: 'offline' }));
        }
        throw new Error(errorData.message || 'Could not start the game.');
      }

      const responseData = await response.json();
      const data: GameData = responseData.game ?? responseData.session ?? responseData;
      const newSessionId = data.sessionId ?? responseData.sessionId ?? responseData.id;

      if (!newSessionId) {
        throw new Error('The server did not return a session ID.');
      }

      setSessionId(String(newSessionId));
      setScore(data.score ?? 0);
      setHits(data.hits ?? 0);
      setTimeLeft(data.timeLeft ?? data.timeRemaining ?? 60);
      setGameStatus('running');
      setScreen('game');
    } catch (error) {
      console.error('Start game error:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start the game. Check your backend server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const playAgain = () => {
    setSessionId(null);
    setScore(0);
    setHits(0);
    setTimeLeft(60);
    setHitFeedback(null);
    setGameStatus('idle');
    setErrorMessage('');
    setScreen('welcome');
  };

  const continueToGame = () => {
    setActivePlayer(playerName.trim() || 'Guest');
    setSessionId(null);
    setScore(0);
    setHits(0);
    setTimeLeft(60);
    setHitFeedback(null);
    setGameStatus('idle');
    setErrorMessage('');
    setScreen('game');
    checkServices();
  };

  const nextPlayer = () => {
    setSessionId(null);
    setPlayerName('');
    setActivePlayer('Guest');
    setScore(0);
    setHits(0);
    setTimeLeft(60);
    setGameStatus('idle');
    setErrorMessage('');
    setScreen('welcome');
  };

  const openOperator = () => {
    if (gameStatus === 'running') {
      setErrorMessage('Finish the current game before opening Operator Mode.');
      return;
    }

    setErrorMessage('');
    setScreen('operator');
    loadAnalytics();
    checkServices();
  };

  const returnToPlayer = () => {
    setErrorMessage('');
    setScreen('landing');
  };

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const currentRoundRecommendation = analytics.recommendations.find((item) =>
    (item.playerName ?? '').trim().toLowerCase() === activePlayer.trim().toLowerCase() &&
    item.score === score &&
    item.totalHits === hits
  );
  const performanceSummary = hits === 0
    ? 'No successful cup hits were recorded this round. Your score is ready for a first hit next round.'
    : `${hits >= 10 ? 'Strong volume' : hits >= 5 ? 'Steady round' : 'A start to build on'}: ${hits} successful ${hits === 1 ? 'hit' : 'hits'} for ${score} points, averaging ${Math.round(score / hits)} points per hit.`;
  const nextRoundTip = hits === 0
    ? 'Start with a controlled bounce toward Cup 1 or 2, then repeat the same release before aiming farther.'
    : currentRoundRecommendation?.recommendation ?? currentRoundRecommendation?.message ?? 'Your round was recorded, but a next-round tip is not available yet.';
  const isGameReady = serviceHealth.gameApi === 'connected' && serviceHealth.esp32 === 'connected';
  const isCheckingReadiness = serviceHealth.gameApi === 'checking' || serviceHealth.esp32 === 'checking';

  const Header = () => (
    <header className="app-header">
      <a
        href="/"
        className="brand brand-link"
        onClick={(event) => { event.preventDefault(); if (gameStatus !== 'running') returnToPlayer(); }}
        aria-disabled={gameStatus === 'running'}
        tabIndex={gameStatus === 'running' ? -1 : 0}
        title={gameStatus === 'running' ? 'Finish the current round first' : 'Go to the welcome screen'}
        aria-label="Bounce-O-Matic home"
      >
        <div className="brand-icon">
          <Gamepad2 size={25} />
        </div>
        <div>
          <h1>BOUNCE-O-MATIC</h1>
          <span>PRO PING-PONG CHALLENGE</span>
        </div>
      </a>

      <button
        className="operator-button"
        onClick={openOperator}
        disabled={gameStatus === 'running'}
      >
        <Settings size={17} />
        Operator Mode
      </button>
      <div className="header-bunting" aria-hidden="true">
        {Array.from({ length: 30 }, (_, index) => {
          const colors = ['#c9273a', '#e5b548', '#25877b'];
          return <span className="bunting-flag" style={{ backgroundColor: colors[index % colors.length] }} key={index} />;
        })}
      </div>
    </header>
  );

  const ErrorNotice = () =>
    errorMessage ? (
      <div className="error-notice" role="alert">
        {errorMessage}
        <button onClick={() => setErrorMessage('')} aria-label="Dismiss">
          ×
        </button>
      </div>
    ) : null;

  const renderLanding = () => (
    <main className="player-container landing-page">
      <section className="landing-card">
        <div className="cup-art" aria-hidden="true">
          <span className="cup-ball" />
          {CUP_SCORES.map((item) => (
            <span className={'cup-art-item cup-art-item-' + item.cup} key={item.cup}><i /></span>
          ))}
        </div>
        <span className="eyebrow">THE ULTIMATE CARNIVAL CHALLENGE</span>
        <h2>Ready to Bounce?</h2>
        <p>Take your shot, hit the cups, and chase the high score.</p>
        <div className="welcome-facts" aria-label="Game details">
          <div><Clock size={18} /><strong>60 sec</strong><span>per round</span></div>
          <div><Target size={18} /><strong>6 cups</strong><span>to aim for</span></div>
          <div><Trophy size={18} /><strong>100 pts</strong><span>top cup</span></div>
        </div>
        <button className="primary-button" onClick={() => setScreen('welcome')}>
          Play Game <Play size={19} />
        </button>
      </section>
    </main>
  );

  const renderWelcome = () => (
    <main className="player-container">
      <section className="welcome-card welcome-only name-entry-card">
        <div className="welcome-left">
          <button className="back-button name-entry-back" onClick={() => setScreen('landing')}>
            <ArrowLeft size={16} /> Back to Start
          </button>
          <div className="name-entry-icon"><User size={25} /></div>
          <span className="eyebrow">PLAYER DETAILS</span>
          <h2>Who’s Playing?</h2>
          <p>Enter a name or leave it blank to play as Guest.</p>

          <div className="name-field">
            <label htmlFor="playerName">PLAYER NAME</label>
            <div className="input-wrapper">
              <User size={19} />
              <input
                id="playerName"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                maxLength={30}
              />
            </div>
          </div>

          <button className="primary-button" onClick={continueToGame}>
            Continue <Play size={19} />
          </button>
        </div>
      </section>
    </main>
  );

  const renderGame = () => (
    <main className="player-container game-page">
      <section className="game-layout">
        <aside className="game-guide" aria-label="How to play and cup scoring">
          <button className="back-button" onClick={() => setScreen('welcome')}>
            <ArrowLeft size={16} /> Back to Welcome
          </button>
          <span className="eyebrow">QUICK GUIDE</span>
          <h2>How to Play</h2>
          <div className="game-guide-steps">
            <div><span>01</span><p><strong>Stand behind the line</strong><small>Get ready with a ping-pong ball.</small></p></div>
            <div><span>02</span><p><strong>Bounce into any cup</strong><small>Only successful hits score.</small></p></div>
            <div><span>03</span><p><strong>Beat the 60-second clock</strong><small>Keep playing until time runs out.</small></p></div>
          </div>
          <div className="game-guide-score-title">
            <h3>Cup scoring</h3><span>Highest: 100 pts</span>
          </div>
          <div className="game-guide-scores">
            {CUP_SCORES.map((item) => (
              <div className={'game-guide-score' + (item.points === 100 ? ' top-prize' : '') + (hitFeedback?.cupNumber === item.cup ? ' cup-hit-flash' : '')} key={item.cup}>
                <span>Cup {item.cup}</span><strong>{item.points}</strong>
              </div>
            ))}
          </div>
          <p className="game-guide-note">Aim carefully—misses don’t reduce your score.</p>
        </aside>

        <section className="game-stage">
          <div className="game-topline">
            <span className={gameStatus === 'running' ? 'live-label' : 'ready-label'}>
              <span className={gameStatus === 'running' ? 'live-dot' : 'ready-dot'} />
              {gameStatus !== 'running' ? 'READY WHEN YOU ARE' : 'LIVE GAME'}
            </span>
            <span className="player-label"><User size={16} /> {activePlayer}</span>
          </div>

          <h2>{gameStatus !== 'running' ? 'Your 60-second round' : 'Game in Progress'}</h2>
          <p>{gameStatus !== 'running' ? 'Your timer starts when you press Ready.' : 'Keep aiming for the cups!'}</p>

          <div className={gameStatus === 'running' && timeLeft <= 10 ? 'timer-display timer-warning' : 'timer-display'} role="timer" aria-label={gameStatus === 'running' ? timeLeft + ' seconds remaining' : 'Game timer set to 60 seconds'}>
            <Clock size={25} />
            <span>{formatTime(timeLeft)}</span>
            <small>{gameStatus === 'running' ? 'TIME LEFT' : 'GAME TIME'}</small>
          </div>

          <div className="live-stats">
            <div className="live-stat live-stat-score">
              <span>CURRENT SCORE</span>
              <strong aria-live="polite" aria-atomic="true">{score}</strong>
              <small>POINTS</small>
            </div>
            <div className="live-stat">
              <span>SUCCESSFUL HITS</span>
              <strong>{hits}</strong>
              <small>HITS</small>
            </div>
          </div>

          {gameStatus === 'running' ? (
            <div className={hitFeedback ? 'game-reminder hit-reminder' : 'game-reminder'} role={hitFeedback ? 'status' : undefined} aria-live={hitFeedback ? 'polite' : undefined}>
              {hitFeedback ? (
                <>
                  <CheckCircle size={18} />
                  <strong>+{hitFeedback.points} pts</strong>
                  <span>{hitFeedback.cupNumber ? `Cup ${hitFeedback.cupNumber} hit!` : 'Hit registered!'}</span>
                </>
              ) : (
                <>
                  <Target size={20} />
                  <span>Focus on your aim. Every successful hit counts!</span>
                </>
              )}
            </div>
          ) : (
            <>
              <div className={'game-readiness-note readiness-' + (isGameReady ? 'connected' : isCheckingReadiness ? 'checking' : 'offline')} role="status">
                <span className={'readiness-dot status-' + (isGameReady ? 'connected' : isCheckingReadiness ? 'checking' : 'offline')} />
                <span>{isCheckingReadiness ? 'Checking the ESP32 and game server…' : serviceHealth.gameApi !== 'connected' ? 'Game server unavailable. Check your connection and retry.' : serviceHealth.esp32 !== 'connected' ? 'ESP32 is disconnected. Connect it before starting the timer.' : 'ESP32 and game server are ready. Your timer will start when you press Ready.'}</span>
              </div>
              <button
                className="primary-button ready-start-button"
                onClick={startGame}
                disabled={loading || !isGameReady || isCheckingReadiness}
              >
                {loading ? 'Getting game ready…' : 'I’m Ready — Start Game'} {!loading && <Play size={19} />}
              </button>
            </>
          )}
          <ErrorNotice />
        </section>
      </section>
    </main>
  );

  const renderResults = () => (
    <main className="player-container">
      <section className="results-card">
        <div className="results-heading">
          <div className="results-icon"><Trophy size={32} /></div>
          <div>
            <span className="eyebrow">ROUND COMPLETE</span>
            <h2>Nice game, {activePlayer}!</h2>
            <p>Here’s how your round went.</p>
          </div>
        </div>

        <div className="final-score">
          <div><span>FINAL SCORE</span><strong>{score}</strong><small>PTS</small></div>
          <div className="score-mark" aria-hidden="true"><Trophy size={25} /></div>
        </div>

        <div className="results-stats">
          <div>
            <Target size={22} />
            <strong>{hits}</strong>
            <span>Successful hits</span>
          </div>
          <div>
            <Clock size={22} />
            <strong>{formatTime(60)}</strong>
            <span>Game time</span>
          </div>
        </div>

        <div className="ai-summary">
          <div className="ai-summary-heading">
            <Activity size={19} />
            <div><strong>Game insights</strong><small>Based on available game data</small></div>
          </div>

          <div className="insight-list">
            <div>
              <span>PERFORMANCE</span>
              <p>{performanceSummary}</p>
            </div>
            <div>
              <span>TIP FOR NEXT ROUND</span>
              <p>{analyticsLoading && hits > 0 && !currentRoundRecommendation ? 'Preparing a tip from this round…' : nextRoundTip}</p>
            </div>
          </div>
        </div>

        <div className="results-actions">
          <button className="primary-button" onClick={playAgain}><RotateCcw size={18} /> Play Again</button>
          <button className="secondary-button" onClick={nextPlayer}><Users size={18} /> Next Player</button>
        </div>
      </section>
    </main>
  );

  const dashboardAnalytics = analytics;
  const maxCupHits = Math.max(
    1,
    ...dashboardAnalytics.cups.map((cup) => cup.hits ?? cup.totalHits ?? cup.count ?? 0)
  );
  const rankedPlayers = [...dashboardAnalytics.rankings].sort(
    (a, b) => (a.rank ?? 999) - (b.rank ?? 999)
  );
  const recommendationsByPlayer = new Map<string, PlayerRecommendation>();
  dashboardAnalytics.recommendations.forEach((item) => {
    const key = (item.playerName ?? 'Player').trim().toLocaleLowerCase();
    const existing = recommendationsByPlayer.get(key);
    recommendationsByPlayer.set(key, {
      ...item,
      playerName: existing?.playerName ?? item.playerName,
    });
  });
  const latestRecommendations = [...recommendationsByPlayer.values()];

  const renderOperator = () => (
    <main className="operator-container">
      <div className="operator-heading">
        <div>
          <span className="eyebrow">SYSTEM CONTROL CENTER</span>
          <h2>Operator Dashboard</h2>
          <p>Monitor the game and review AI-generated analytics.</p>
        </div>

        <button className="secondary-button back-to-player" onClick={returnToPlayer}>
          <ArrowLeft size={17} /> Player Mode
        </button>
      </div>

      <section className="operator-status-grid" aria-label="System connection status">
        <div className="operator-status-card">
          <div className="status-icon">
            <Activity size={22} />
          </div>
          <div className="operator-status-copy">
            <span>GAME SERVER API</span>
            <strong>{serviceHealth.gameApi === 'connected' ? 'Connected' : serviceHealth.gameApi === 'checking' ? 'Checking…' : serviceHealth.gameApi === 'offline' ? 'Offline' : 'Not checked'}</strong>
            <small>Session and score endpoints</small>
          </div>
          <span className={'status-pill status-' + serviceHealth.gameApi}>{serviceHealth.gameApi}</span>
        </div>

        <div className="operator-status-card">
          <div className="status-icon">
            <Gamepad2 size={22} />
          </div>
          <div className="operator-status-copy">
            <span>ESP32 SENSOR</span>
            <strong>{serviceHealth.esp32 === 'connected' ? hits > 0 ? 'Signal received' : 'Serial connection ready' : serviceHealth.esp32 === 'checking' ? 'Checking connection…' : serviceHealth.esp32 === 'offline' ? 'Disconnected' : 'Not checked'}</strong>
            <small>{hits > 0 ? `${hits} hit${hits === 1 ? '' : 's'} received this session` : serviceHealth.esp32 === 'connected' ? 'Sensor hits will be confirmed during play' : 'Connect the ESP32 before starting a round'}</small>
          </div>
          <span className={'status-pill status-' + serviceHealth.esp32}>{serviceHealth.esp32 === 'unknown' ? 'not checked' : serviceHealth.esp32}</span>
        </div>

        <div className="operator-status-card">
          <div className="status-icon">
            <Zap size={22} />
          </div>
          <div className="operator-status-copy">
            <span>AI ANALYTICS API</span>
            <strong>{serviceHealth.aiApi === 'connected' ? 'Responding' : serviceHealth.aiApi === 'checking' ? 'Checking…' : serviceHealth.aiApi === 'offline' ? 'Unavailable' : 'Not checked'}</strong>
            <small>Recommendation endpoint response</small>
          </div>
          <span className={'status-pill status-' + serviceHealth.aiApi}>{serviceHealth.aiApi}</span>
        </div>
      </section>

      <section className="operator-section">
        <div className="section-title-row">
          <div>
            <h3>Current Game Information</h3>
            <p>Latest game session details</p>
          </div>
          <button
            className="refresh-button"
            onClick={() => { loadAnalytics(); checkServices(); }}
            disabled={analyticsLoading}
          >
            <RefreshCw size={17} />
            Refresh status & analytics
          </button>
        </div>

        <div className="operator-stats-grid">
          <div className="operator-stat">
            <span>PLAYER</span>
            <strong>{activePlayer}</strong>
          </div>
          <div className="operator-stat">
            <span>SCORE</span>
            <strong aria-live="polite" aria-atomic="true">{score}</strong>
          </div>
          <div className="operator-stat">
            <span>SUCCESSFUL HITS</span>
            <strong>{hits}</strong>
          </div>
          <div className="operator-stat">
            <span>TIME LEFT</span>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
        </div>
      </section>

      <section className="operator-section">
        <div className="section-title-row">
          <div>
            <h3>AI Analytics</h3>
            <p>Insights based on available game data</p>
          </div>
          <BarChart3 size={24} />
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="analytics-card-heading">
              <Target size={20} />
              <h4>Cup Hit Patterns</h4>
            </div>
            <div className="analytics-top-target">
              <span>HIGHEST-VALUE TARGET</span>
              <strong>Cup 6 <b>100 pts</b></strong>
            </div>

            {dashboardAnalytics.cups.some((cup) => (cup.hits ?? cup.totalHits ?? cup.count ?? 0) > 0) ? (
              dashboardAnalytics.cups.map((cup, index) => {
                const cupNumber = cup.cupNumber ?? cup.cup ?? index + 1;
                const cupHits = cup.hits ?? cup.totalHits ?? cup.count ?? 0;
                const percentage = cup.hitPercentage ?? cup.percentage ?? Math.round((cupHits / maxCupHits) * 100);
                return (
                <div className={'cup-analytics-item' + (cupHits > 0 && cupHits === maxCupHits ? ' cup-analytics-top' : '')} key={index}>
                  <div className="cup-analytics-label">
                    <span>Cup {cupNumber}</span>
                    <strong>{cupHits} {cupHits === 1 ? 'hit' : 'hits'}</strong>
                  </div>
                  <div className="analytics-bar-track" role="progressbar" aria-label={`Cup ${cupNumber} hits`} aria-valuemin={0} aria-valuemax={maxCupHits} aria-valuenow={cupHits}>
                    <span className="analytics-bar-fill" style={{ width: `${percentage}%` }} />
                  </div>
                  {cupHits > 0 && cupHits === maxCupHits && <span className="most-hit-label">Most hits</span>}
                </div>
                );
              })
            ) : (
              <p>Not enough game data yet.</p>
            )}
          </div>

          <div className="analytics-card">
            <div className="analytics-card-heading">
              <Zap size={20} />
              <h4>AI Recommendations</h4>
            </div>

            {latestRecommendations.length > 0 ? (
              latestRecommendations.map((item, index) => (
                <div className="analytics-row recommendation-row" key={index}>
                  <span>{item.playerName ?? 'Player'}</span>
                  <p>{item.recommendation ?? item.message ?? 'No recommendation available.'}</p>
                </div>
              ))
            ) : (
              <p>Not enough game data yet.</p>
            )}
          </div>

          <div className="analytics-card rankings-card">
            <div className="analytics-card-heading">
              <Trophy size={20} />
              <h4>Player Rankings</h4>
            </div>

            {rankedPlayers.length > 0 ? (
              rankedPlayers.map((player, index) => (
                <div className="analytics-row" key={index}>
                  <span className="ranking-player-info">
                    <span className={'rank-number' + (index === 0 ? ' rank-first' : '')}>#{index + 1}</span> {player.playerName ?? player.name ?? 'Player'}
                    <small>{player.totalScore ?? player.score ?? 0} total pts · {player.gamesPlayed ?? 0} {player.gamesPlayed === 1 ? 'round' : 'rounds'}</small>
                  </span>
                  <strong>{(player.averageScore ?? player.score ?? 0).toFixed(1)} avg pts</strong>
                </div>
              ))
            ) : (
              <p>Not enough game data yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="operator-note">
        <CheckCircle size={20} />
        <p>
          {serviceHealth.checkedAt
            ? `Service checks last ran at ${serviceHealth.checkedAt}. The AI status confirms its API response; the ESP32 is verified only after a hit arrives.`
            : 'Run a status check to verify the available service endpoints. The ESP32 is verified only after a hit arrives.'}
        </p>
      </section>

      <ErrorNotice />
    </main>
  );

  return (
    <div className="app">
      <Header />

      {screen === 'landing' && renderLanding()}
      {screen === 'welcome' && renderWelcome()}
      {screen === 'game' && renderGame()}
      {screen === 'results' && renderResults()}
      {screen === 'operator' && renderOperator()}

      <footer className="app-footer">
        <span>BOUNCE-O-MATIC PRO</span>
        <span>Distributed IoT Ping-Pong Toss Challenge</span>
      </footer>
    </div>
  );
}

export default App;





