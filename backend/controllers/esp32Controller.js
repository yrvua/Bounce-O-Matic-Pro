
const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')

const gameController = require('./gameController')

const PORT_NAME = 'COM9'
const BAUD_RATE = 115200

let esp32Port = null

function connectESP32() {
  if (esp32Port) {
    console.log('ESP32 serial connection already initialized.')
    return
  }

  esp32Port = new SerialPort({
    path: PORT_NAME,
    baudRate: BAUD_RATE,
    autoOpen: false,
  })

  const parser = esp32Port.pipe(
    new ReadlineParser({ delimiter: '\n' })
  )

  esp32Port.open((error) => {
    if (error) {
      console.error('ESP32 connection error:', error.message)
      esp32Port = null
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

  esp32Port.on('error', (error) => {
    console.error('ESP32 serial error:', error.message)
  })

  esp32Port.on('close', () => {
    console.log('ESP32 serial connection closed.')
    esp32Port = null
  })
}

module.exports = { connectESP32 }
