
const express = require('express')
const router = express.Router()

const gameController = require('../controllers/gameController')
const esp32Controller = require('../controllers/esp32Controller')
const analyticsController = require('../controllers/analyticsController')

// Game routes
router.get('/esp32/status', esp32Controller.getESP32Status)
router.post('/start', esp32Controller.requireESP32Connection, gameController.startGame)
router.get('/history', gameController.getGameHistory)

// Analytics routes
router.get('/analytics/cups', analyticsController.getCupAnalysis)

router.get(
  '/analytics/recommendations',
  analyticsController.getPlayerRecommendations
)

router.get(
  '/analytics/rankings',
  analyticsController.getPlayerRankings
)

// Individual game routes
router.get('/:sessionId', gameController.getGame)
router.post('/:sessionId/hit', gameController.registerHit)
router.post('/:sessionId/end', gameController.endGame)

module.exports = router
