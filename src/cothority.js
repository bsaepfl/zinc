const express = require('express')
const { misc } = require('@louismerlin/cothority')

const { dataTimedOut, resetTimeout, URL, coolSend, formatSkipblock } = require('./utils')

const router = express.Router()

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
  const { socket, skipchains, addresses } = cothority
  if (dataTimedOut('skipchains')) {
    socket.service = 'Skipchain'
    const responses = await sendAllConodes(socket, addresses, 'skipchain.GetAllSkipChainIDs', 'GetAllSkipChainIDsReply', {})
    const skipChainIDs = responses.map(r => r.skipChainIDs).reduce((acc, val) => acc.concat(val), [])
    await Promise.all(skipChainIDs.map(async hash => {
      const hex = misc.uint8ArrayToHex(hash)
      if (!skipchains[hex]) {
        skipchains[hex] = []
      }
    }))
    resetTimeout(skipchains)
  }
  return Object.keys(skipchains)
}

const getLatestSkipchain = async (cothority, hash) => {
  const { socket, skipchains } = cothority
  if (!hash.trim()) throw new Error('Invalid skipchain hash')
  if (dataTimedOut(hash)) {
    await getLatestSkipchains(cothority)
    if (!Object.keys(skipchains).some(i => i === hash)) throw new Error(`Could not get skipchain with hash ${hash}`)
    socket.service = 'Skipchain'
    const { update } = await socket.send('skipchain.GetUpdateChain', 'GetUpdateChainReply', { latestID: misc.hexToUint8Array(hash) })

    if (!update) throw new Error(`Could not find skipchain with hash ${hash}`)

    const skipchain = update.map(formatSkipblock)

    skipchains[hash] = skipchain

    resetTimeout(hash)
  }
  return skipchains[hash]
}

const getSkipblock = async (cothority, hash) => {
  const { socket } = cothority
  if (!hash.trim()) throw new Error('Invalid block hash')
  socket.service = 'Skipchain'
  const skipblock = await socket.send('skipchain.GetSingleBlock', 'SkipBlock', { id: misc.hexToUint8Array(hash) })
  if (!skipblock) throw new Error(`Could not find block with hash ${hash}`)
  return formatSkipblock(skipblock)
}

const getSkipblockByIndex = async (cothority, hash, blockIndex) => {
  const { socket } = cothority
  if (!hash.trim()) throw new Error('Invalid skipchain hash')
  if (!blockIndex.trim()) throw new Error('Invalid block index')
  socket.service = 'Skipchain'
  const skipblock = await socket.send('skipchain.GetSingleBlockByIndex', 'SkipBlock', { genesis: misc.hexToUint8Array(hash), index: Number(blockIndex) })
  if (!skipblock) throw new Error(`Could not find block with index ${blockIndex} on chain ${hash}`)
  return formatSkipblock(skipblock)
}

router.get('/', async (req, res) => {
  return coolSend(res, {
    status: {
      description: 'status of the conode zinc is connected to',
      url: `${URL}${req.baseUrl}/status`
    },
    skipchains: {
      description: 'all of the cothoritie\'s skipchains',
      url: `${URL}${req.baseUrl}/skipchains`
    },
    skipchain: {
      description: 'traversal view of skipchain with hash',
      url: `${URL}${req.baseUrl}/skipchain/:hash`
    },
    block: {
      description: 'skipblock by hash',
      url: `${URL}${req.baseUrl}/skipchain/skipblock/:hash`
    },
    block_by_index: {
      description: 'skipblock by index',
      url: `${URL}${req.baseUrl}/skipchain/:hash/skipblock/:block_index`
    }
  })
})

router.get('/status', async (req, res) => {
  const socket = req.cothority.socket
  socket.service = 'Status'
  const status = await socket.send('status.Request', 'Response', {})
  return coolSend(res, status)
})

router.get('/skipchains', async (req, res) => {
  const skipchains = await getLatestSkipchains(req.cothority)
  return coolSend(res, skipchains)
})

router.get('/skipchain/:hash', async (req, res) => {
  try {
    const skipchain = await getLatestSkipchain(req.cothority, req.params.hash)
    return coolSend(res, skipchain)
  } catch (err) {
    return res.status(400).send(err.toString())
  }
})

router.get('/skipchain/skipblock/:hash', async (req, res) => {
  try {
    const skipblock = await getSkipblock(req.cothority, req.params.hash)
    return coolSend(res, skipblock)
  } catch (err) {
    return res.status(400).send(err.toString())
  }
})

router.get('/skipchain/:hash/block_by_index/:block_index', async (req, res) => {
  try {
    const skipblock = await getSkipblockByIndex(req.cothority, req.params.hash, req.params.block_index)
    return coolSend(res, skipblock)
  } catch (err) {
    return res.status(400).send(err.toString())
  }
})

module.exports = router
