#!/usr/bin/env node
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const identity = require('@louismerlin/cothority')

const { net } = identity

const app = express()
app.use(cors())

const port = 6842

const URL = process.env.NODE_ENV === 'production' ? 'https://zinc.cool' : `http://localhost:${port}`
const DEFAULT_COTHORITY = 'dedis'
const DEDIS = 'https://raw.githubusercontent.com/dedis/cothority/master/dedis-cothority.toml'
const BSA = '/root/go/src/github.com/dedis/cothority/conode/public.toml'

let sockets = {
  dedis: {},
  bsa: {}
}

const getSocket = cothority => sockets[cothority] || sockets[DEFAULT_COTHORITY]

app.get('/', async (req, res) => {
  return res.send({
    cothorities: {
      description: 'list of zinc\'s cothorities',
      url: `${URL}/cothorities`
    },
    status: {
      description: 'status of the conode zinc is connected to',
      url: `${URL}/status`
    },
    skipchains: {
      description: 'all of the cothoritie\'s skipchains',
      url: `${URL}/skipchains`
    },
    skipchain: {
      description: 'traversal view of skipchain with index',
      url: `${URL}/skipchain/:index`
    }
  })
})

app.get('/cothorities', (req, res) => res.send(Object.keys(sockets)))

app.get('/status', async (req, res) => {
  const socket = getSocket(req.query.cothority)
  socket.service = 'Status'
  const status = await socket.send('status.Request', 'Response', {})
  return res.send(status)
})

app.get('/skipchain/:index', async (req, res) => {
  const socket = getSocket(req.query.cothority)
  const index = Number(req.params.index)
  socket.service = 'Skipchain'
  try {
    const { skipChainIDs } = await socket.send('skipchain.GetAllSkipChainIDs', 'GetAllSkipChainIDsReply', {})
    const latestID = skipChainIDs[index]
    if (!latestID) throw new Error(`Could not get skipchain with index ${index}`)
    /*const chain = []
    const getNextBlockRecur = async (index) => {
      try {
        console.log('genesis ' + latestID)
        console.log('index ' + index)
        const SkipBlock = await socket.send('skipchain.GetSingleBlockByIndex', 'SkipBlock', { genesis: latestID, index: index })
        console.log(SkipBlock && SkipBlock.index)
        if (SkipBlock) {
          chain[index] = SkipBlock
          return getNextBlockRecur(index + 1)
        } else {
          return
        }
      } catch (e) {
        return
      }
    }
    await getNextBlockRecur(0);
    await getNextBlockRecur(2);
    await getNextBlockRecur(0);
    await getNextBlockRecur(0);
    return res.send(chain)*/
    const { update } = await socket.send('skipchain.GetUpdateChain', 'GetUpdateChainReply', { latestID })
    return res.send(update)
  } catch (err) {
    return res.send(err)
  }
})

app.get('/skipchains', async (req, res) => {
  const socket = getSocket(req.query.cothority)
  socket.service = 'Skipchain'
  const { skipChainIDs } = await socket.send('skipchain.GetAllSkipChainIDs', 'GetAllSkipChainIDsReply', {})
  return res.send(skipChainIDs)
})

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
