
const fs = require('fs')
const path = require('path')

const databasePath = path.join(__dirname, '../data/database.json')

const ML_SERVICE_URL = 'http://127.0.0.1:8000'


async function sendGamesToML(endpoint) {
  const database = JSON.parse(
    fs.readFileSync(databasePath, 'utf8')
  )

  const response = await fetch(
    `${ML_SERVICE_URL}${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        games: database.games || [],
      }),
    }
  )

  const result = await response.json()

  if (!response.ok) {
    const error = new Error('Python analytics service returned an error.')
    error.status = response.status
    error.details = result
    throw error
  }

  return result
}


exports.getCupAnalysis = async (req, res) => {
  try {
    const result = await sendGamesToML('/api/analytics/cups')
    return res.json(result)

  } catch (error) {
    console.error('Cup analysis error:', error.message)

    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.details || null,
    })
  }
}


exports.getPlayerRecommendations = async (req, res) => {
  try {
    const result = await sendGamesToML(
      '/api/analytics/recommendations'
    )

    return res.json(result)

  } catch (error) {
    console.error('Player recommendation error:', error.message)

    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.details || null,
    })
  }
}

exports.getPlayerRankings = async (req, res) => {
  try {
    const result = await sendGamesToML(
      '/api/analytics/rankings'
    )

    return res.json(result)

  } catch (error) {
    console.error('Player ranking error:', error.message)

    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
      details: error.details || null,
    })
  }
}
