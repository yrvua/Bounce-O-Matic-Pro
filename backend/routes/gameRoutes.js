
const express = require('express')
const router = express.Router()

const gameController = require('../controllers/gameController')
const analyticsController = require('../controllers/analyticsController')

// Game routes
router.post('/start', gameController.startGame)
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
