
const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')

const gameController = require('./gameController')

const PORT_NAME = process.env.ESP32_PORT || 'COM9'
const BAUD_RATE = 115200
const RECONNECT_DELAY_MS = 3000

let esp32Port = null
let reconnectTimer = null

function isESP32Connected() {
  return Boolean(esp32Port && esp32Port.isOpen)
}

function getESP32Status(req, res) {
  const connected = isESP32Connected()
  res.set('Cache-Control', 'no-store')

  return res.json({
    success: true,
    connected,
    port: PORT_NAME,
    message: connected
      ? `ESP32 connected on ${PORT_NAME}.`
      : `ESP32 is not connected on ${PORT_NAME}.`,
  })
}

function requireESP32Connection(req, res, next) {
  if (!isESP32Connected()) {
    return res.status(503).json({
      success: false,
      connected: false,
      message: `ESP32 is not connected on ${PORT_NAME}. Connect it before starting a game.`,
    })
  }

  return next()
}

function scheduleReconnect() {
  if (esp32Port || reconnectTimer) {
    return
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectESP32()
  }, RECONNECT_DELAY_MS)
}

function connectESP32() {
  if (esp32Port) {
    console.log('ESP32 serial connection already initialized.')
    return
  }

  const port = new SerialPort({
    path: PORT_NAME,
    baudRate: BAUD_RATE,
    autoOpen: false,
  })
  esp32Port = port

  const parser = port.pipe(
    new ReadlineParser({ delimiter: '\n' })
  )

  port.open((error) => {
    if (error) {
      console.error(`ESP32 connection error on ${PORT_NAME}:`, error.message)
      if (esp32Port === port) {
        esp32Port = null
      }
      scheduleReconnect()
      return
    }

    console.log(`ESP32 connected on ${PORT_NAME}`)
  })

  parser.on('data', (line) => {
    const message = line.trim()

    if (!message.startsWith('HIT:')) {
      return
    }

    const cupNumber = Number(message.substring(4))

    if (
      !Number.isInteger(cupNumber) ||
      cupNumber < 1 ||
      cupNumber > 6
    ) {
      console.log('Invalid ESP32 message:', message)
      return
    }

    gameController.registerHitFromESP32(cupNumber)
  })

  port.on('error', (error) => {
    console.error('ESP32 serial error:', error.message)
  })

  port.on('close', () => {
    console.log('ESP32 serial connection closed.')
    if (esp32Port === port) {
      esp32Port = null
    }
    scheduleReconnect()
  })
}

module.exports = {
  connectESP32,
  getESP32Status,
  isESP32Connected,
  requireESP32Connection,
}
