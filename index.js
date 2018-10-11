const express = require('express')
const axios = require('axios')
const identity = require('@dedis/cothority')
const { net } = identity
const app = express()
const port = 6842

const URL = process.env.NODE_ENV === 'production' ? 'https://zinc.louismerl.in' : `http://localhost:${port}`

let socket = {}

app.get('/', async (req, res) => {
  return res.send({
    status: `${URL}/status`
  })
})

app.get('/status', async (req, res) => {
  const status = await socket.send('status.Request', 'Response', {})
  return res.send(status)
})

const start = async () => {
  const COTHORITY = 'https://raw.githubusercontent.com/dedis/cothority/master/dedis-cothority.toml'
  const res = await axios.get(COTHORITY)
  socket = new net.RosterSocket(identity.Roster.fromTOML(await res.data), 'Status')
  app.listen(port, () => console.log(`zinc listening on port ${port}!`))
}

start()
