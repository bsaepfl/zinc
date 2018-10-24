const express = require('express')
const { misc } = require('@louismerlin/cothority')

const { getCothority, dataTimedOut, resetTimeout, URL } = require('./utils')

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
    resetTimeout(skipchains)
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

    resetTimeout(hash)
  }
  return skipchains[hash]
}

router.get('/', async (req, res) => {
  console.log(req.baseUrl)
  return res.send({
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
    }
  })
})

router.get('/status', async (req, res) => {
  const socket = req.cothority.socket
  socket.service = 'Status'
  const status = await socket.send('status.Request', 'Response', {})
  return res.send(status)
})

router.get('/skipchain/:hash', async (req, res) => {
  try {
    const skipchain = await getLatestSkipchain(req.query.cothority, req.params.hash)
    return res.send(skipchain)
  } catch (err) {
    return res.send(err)
  }
})

router.get('/skipchains', async (req, res) => {
  const skipchains = await getLatestSkipchains(req.query.cothority)
  return res.send(skipchains)
})

module.exports = router
