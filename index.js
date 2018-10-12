const fs = require('fs')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const identity = require('@dedis/cothority')

const { net, misc } = identity

const app = express()
app.use(cors())

const port = 6842

const URL = process.env.NODE_ENV === 'production' ? 'https://zinc.louismerl.in' : `http://localhost:${port}`
const DEFAULT_COTHORITY = 'dedis'
const DEDIS = 'https://raw.githubusercontent.com/dedis/cothority/master/dedis-cothority.toml'
const BSA = '../go/src/github.com/dedis/cothority/conode/public.toml'

const skipchains = {
  dedis: ['d669adf6bf6fd59f0f412bf1d9baee95c194baca6ba70d8056f8370380bc99da'],
  bsa: ['94ac819a55c9f1b5fa332b61d895c134dc885c2ef9b3a0e14374dcae7129a68f']
}

let sockets = {
  dedis: {},
  bsa: {}
}

const getSocket = cothority => sockets[cothority] || sockets[DEFAULT_COTHORITY]

app.get('/', async (req, res) => {
  return res.send({
    status: `${URL}/status`,
    skipchain: `${URL}/skipchain`,
    skipchains: `${URL}/skipchains`
  })
})

app.get('/status', async (req, res) => {
  const socket = getSocket(req.query.cothority)
  socket.service = 'Status'
  const status = await socket.send('status.Request', 'Response', {})
  return res.send(status)
})

app.get('/skipchain', async (req, res) => {
  const socket = getSocket(req.query.cothority)
  socket.service = 'Skipchain'
  // const skipchain = await socket.send('skipchain.GetAllSkipChainIDs', 'GetAllSkipChainIDsReply', {})
  try {
    const skipchain = await socket.send('skipchain.GetUpdateChain', 'GetUpdateChainReply', { latestID: misc.hexToUint8Array(skipchains[req.query.cothority || DEFAULT_COTHORITY][0]) })
    return res.send(skipchain)
  } catch (err) {
    return res.send(err)
  }
})

app.get('/skipchains', (req, res) => res.send(skipchains))

const start = async () => {
  const res = await axios.get(DEDIS)
  sockets.dedis = new net.RosterSocket(identity.Roster.fromTOML(await res.data), 'Status')
  fs.readFile(BSA, (err, data) => {
    if (err) return
    sockets.bsa = new net.RosterSocket(identity.Roster.fromTOML(data.toString()), 'Status')
  })
  app.listen(port, () => console.log(`zinc listening on port ${port}!`))
}

start()
