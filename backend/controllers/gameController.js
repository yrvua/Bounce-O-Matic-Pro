
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const databasePath = path.join(__dirname, '../data/database.json')

const GAME_DURATION = 60

const CUP_POINTS = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
  5: 50,
  6: 100,
}

function readDatabase() {
  try {
    const data = fs.readFileSync(databasePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { games: [] }
  }
}

function saveDatabase(database) {
  fs.writeFileSync(
    databasePath,
    JSON.stringify(database, null, 2),
    'utf8',
  )
}

function getRemainingTime(game) {
  if (game.status !== 'running') return 0

  const elapsed = Date.now() - new Date(game.startTime).getTime()

  return Math.max(0, GAME_DURATION - Math.floor(elapsed / 1000))
}

function finishIfExpired(game, database) {
  if (
    game.status === 'running' &&
    getRemainingTime(game) <= 0
  ) {
    game.status = 'completed'
    game.endTime = new Date().toISOString()
    game.timeRemaining = 0
    saveDatabase(database)
  }

  return game
}

// Shared scoring function for API and ESP32 hits
function addCupHit(game, cupNumber, database) {
  const points = CUP_POINTS[cupNumber]

  game.hits += 1
  game.score += points
  game.cupHits[cupNumber] += 1

  game.hitHistory.push({
    cupNumber,
    points,
    timestamp: new Date().toISOString(),
  })

  game.timeRemaining = getRemainingTime(game)

  saveDatabase(database)

  return {
    success: true,
    message: `Cup ${cupNumber} hit registered!`,
    addedPoints: points,
    game,
  }
}

// Start a new player session
exports.startGame = (req, res) => {
  const playerName =
    typeof req.body.playerName === 'string'
      ? req.body.playerName.trim()
      : ''

  if (!playerName || playerName.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Enter a player name between 1 and 50 characters.',
    })
  }

  const database = readDatabase()

  // Finish any previous active sessions before starting another
  database.games.forEach((game) => {
    finishIfExpired(game, database)

    if (game.status === 'running') {
      game.status = 'completed'
      game.endTime = new Date().toISOString()
      game.timeRemaining = 0
    }
  })

  const game = {
    sessionId: randomUUID(),
    playerName,
    status: 'running',
    startTime: new Date().toISOString(),
    endTime: null,
    duration: GAME_DURATION,
    timeRemaining: GAME_DURATION,
    score: 0,
    hits: 0,
    cupHits: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    },
    hitHistory: [],
  }

  database.games.push(game)
  saveDatabase(database)

  return res.status(201).json({
    success: true,
    message: 'Game started successfully.',
    game,
  })
}

// Get one game session
exports.getGame = (req, res) => {
  const database = readDatabase()

  const game = database.games.find(
    (item) => item.sessionId === req.params.sessionId,
  )

  if (!game) {
    return res.status(404).json({
      success: false,
      message: 'Game session not found.',
    })
  }

  finishIfExpired(game, database)

  return res.json({
    success: true,
    game: {
      ...game,
      timeRemaining: getRemainingTime(game),
    },
  })
}

// Receive a successful cup hit through the HTTP API
exports.registerHit = (req, res) => {
  const cupNumber = Number(req.body.cupNumber)

  if (!Number.isInteger(cupNumber) || !CUP_POINTS[cupNumber]) {
    return res.status(400).json({
      success: false,
      message: 'Cup number must be an integer from 1 to 6.',
    })
  }

  const database = readDatabase()

  const game = database.games.find(
    (item) => item.sessionId === req.params.sessionId,
  )

  if (!game) {
    return res.status(404).json({
      success: false,
      message: 'Game session not found.',
    })
  }

  finishIfExpired(game, database)

  if (game.status !== 'running') {
    return res.status(409).json({
      success: false,
      message: 'This game is no longer active.',
      game,
    })
  }

  const result = addCupHit(game, cupNumber, database)

  return res.json(result)
}

// Receive a successful cup hit directly from the ESP32 over USB
exports.registerHitFromESP32 = (cupNumber) => {
  if (!Number.isInteger(cupNumber) || !CUP_POINTS[cupNumber]) {
    console.log('ESP32 sent an invalid cup number:', cupNumber)
    return
  }

  const database = readDatabase()

  // Complete expired games before looking for an active session
  database.games.forEach((game) => {
    finishIfExpired(game, database)
  })

  // Use the most recently started active game
  const activeGames = database.games
    .filter((game) => game.status === 'running')
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() -
        new Date(a.startTime).getTime(),
    )

  const game = activeGames[0]

  if (!game) {
    console.log(`Cup ${cupNumber} hit ignored: no active game.`)
    return
  }

  const result = addCupHit(game, cupNumber, database)

  console.log(
    `${game.playerName}: Cup ${cupNumber} hit! +${result.addedPoints} points. Total: ${game.score}`,
  )
}

// End a game manually
exports.endGame = (req, res) => {
  const database = readDatabase()

  const game = database.games.find(
    (item) => item.sessionId === req.params.sessionId,
  )

  if (!game) {
    return res.status(404).json({
      success: false,
      message: 'Game session not found.',
    })
  }

  if (game.status === 'running') {
    game.status = 'completed'
    game.endTime = new Date().toISOString()
    game.timeRemaining = 0
    saveDatabase(database)
  }

  return res.json({
    success: true,
    message: 'Game ended.',
    game,
  })
}

// Get all saved game sessions
exports.getGameHistory = (req, res) => {
  const database = readDatabase()

  database.games.forEach((game) => {
    finishIfExpired(game, database)
  })

  return res.json({
    success: true,
    totalGames: database.games.length,
    games: database.games,
  })
}
