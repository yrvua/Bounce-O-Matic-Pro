
require('dotenv').config()
const { connectESP32 } = require('./controllers/esp32Controller')

const express = require('express')
const cors = require('cors')
const gameRoutes = require('./routes/gameRoutes')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bounce-O-Matic Pro backend is running!',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/game', gameRoutes)

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  })
})
connectESP32()

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================')
  console.log(' BOUNCE-O-MATIC PRO BACKEND')
  console.log('====================================')
  console.log(`Server running on port ${PORT}`)
  console.log(`Health: http://localhost:${PORT}/api/health`)
  console.log('====================================')
})
