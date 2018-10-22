#!/usr/bin/env node
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const identity = require('@louismerlin/cothority')

const { net, misc } = identity

const app = express()
app.use(cors())

const port = 6842

const URL = process.env.NODE_ENV === 'production' ? 'https://zinc.cool' : `http://localhost:${port}`
const DEFAULT_COTHORITY = 'dedis'
const DEDIS = 'https://raw.githubusercontent.com/dedis/cothority/master/dedis-cothority.toml'
const BSA = '/root/go/src/github.com/dedis/cothority/conode/public.toml'
const TIMEOUT_LIMIT = 10000

const cothorities = {
  dedis: {
    socket: {},
    skipchains: {},
    addresses: []
  },
  bsa: {
    socket: {},
    skipchains: {},
    addresses: []
  }
}

let dataTimeout = {}
const dataTimedOut = value => dataTimeout[value] === undefined || Date.now() > dataTimeout[value]

const getSocket = cothority => {
  if (!cothority) return cothorities[DEFAULT_COTHORITY].socket
  else if (cothorities[cothority]) return cothorities[cothority].socket
  else throw new Error(`Could not find cothority ${cothority}`)
}

const getCothority = cothority => {
  if (!cothority) return cothorities[DEFAULT_COTHORITY]
  else if (cothorities[cothority]) return cothorities[cothority]
  else throw new Error(`Could not find cothority ${cothority}`)
}

const sendAllConodes = async (socket, addresses, request, response, data) => {
  const allResponses = []
  for (let i = 0; i < addresses.length; i++) {
    socket.lastGoodServer = addresses[i]
    const res = await socket.send(request, response, data)
    allResponses[i] = res
  }
  return allResponses
}

const getLatestSkipchains = async (cothority) => {
  const { socket, skipchains, addresses } = getCothority(cothority)
  if (dataTimedOut('skipchains')) {
    socket.service = 'Skipchain'
    const responses = await sendAllConodes(socket, addresses, 'skipchain.GetAllSkipChainIDs', 'GetAllSkipChainIDsReply', {})
    // const { skipChainIDs } = await socket.send('skipchain.GetAllSkipChainIDs', 'GetAllSkipChainIDsReply', {})
    const skipChainIDs = responses.map(r => r.skipChainIDs).reduce((acc, val) => acc.concat(val), [])
    await Promise.all(skipChainIDs.map(async hash => {
      const hex = misc.uint8ArrayToHex(hash)
      if (!skipchains[hex]) {
        skipchains[hex] = []
      }
    }))
    dataTimeout.skipchains = Date.now() + TIMEOUT_LIMIT
  }
  return Object.keys(skipchains)
}

const getLatestSkipchain = async (cothority, hash) => {
  const { socket, skipchains } = getCothority(cothority)
  if (!hash) throw new Error('Please choose a hash')
  if (dataTimedOut(hash)) {
    await getLatestSkipchains(cothority)
    if (!Object.keys(skipchains).some(i => i === hash)) throw new Error(`Could not get skipchain with hash ${hash}`)
    /*
    const chain = []
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
    return res.send(chain)
    */
    socket.service = 'Skipchain'
    const { update } = await socket.send('skipchain.GetUpdateChain', 'GetUpdateChainReply', { latestID: misc.hexToUint8Array(hash) })

    skipchains[hash] = update

    dataTimeout[hash] = Date.now() + TIMEOUT_LIMIT
  }
  return skipchains[hash]
}

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
      description: 'traversal view of skipchain with hash',
      url: `${URL}/skipchain/:hash`
    }
  })
})

app.get('/cothorities', (req, res) => res.send(Object.keys(cothorities)))

app.get('/status', async (req, res) => {
  const socket = getSocket(req.query.cothority)
  socket.service = 'Status'
  const status = await socket.send('status.Request', 'Response', {})
  return res.send(status)
})

app.get('/skipchain/:hash', async (req, res) => {
  try {
    const skipchain = await getLatestSkipchain(req.query.cothority, req.params.hash)
    return res.send(skipchain)
  } catch (err) {
    return res.send(err)
  }
})

app.get('/skipchains', async (req, res) => {
  const skipchains = await getLatestSkipchains(req.query.cothority)
  return res.send(skipchains)
})

const start = async () => {
  const res = await axios.get(DEDIS)
  cothorities.dedis.socket = new net.RosterSocket(identity.Roster.fromTOML(await res.data), 'Status')
  cothorities.dedis.addresses = JSON.parse(JSON.stringify(cothorities.dedis.socket.addresses))
  fs.readFile(BSA, (err, data) => {
    if (err) return
    cothorities.bsa.socket = new net.RosterSocket(identity.Roster.fromTOML(data.toString()), 'Status')
    cothorities.bsa.addresses = JSON.parse(JSON.stringify(cothorities.bsa.socket.addresses))
  })
  app.listen(port, () => console.log(`zinc listening on port ${port}!`))
}

start()
