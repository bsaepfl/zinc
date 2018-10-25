const fs = require('fs')
const axios = require('axios')
const identity = require('@louismerlin/cothority')

const { net, misc } = identity

const PORT = 6842
const DEFAULT_COTHORITY = 'dedis'
const DEDIS = 'https://raw.githubusercontent.com/dedis/cothority/master/dedis-cothority.toml'
const BSA = '/root/go/src/github.com/dedis/cothority/conode/public.toml'
const TIMEOUT_LIMIT = 10000
const COTHORITIES = ['dedis', 'bsa']

const URL = process.env.NODE_ENV === 'production' ? 'https://zinc.cool' : `http://localhost:${PORT}`

const cothorities = {}

const initCothorities = async () => {
  COTHORITIES.forEach(c => { cothorities[c] = {} })
  const res = await axios.get(DEDIS)
  cothorities.dedis.socket = new net.RosterSocket(identity.Roster.fromTOML(await res.data), 'Status')
  cothorities.dedis.addresses = JSON.parse(JSON.stringify(cothorities.dedis.socket.addresses))
  cothorities.dedis.skipchains = {}
  fs.readFile(BSA, (err, data) => {
    if (err) return
    cothorities.bsa.socket = new net.RosterSocket(identity.Roster.fromTOML(data.toString()), 'Status')
    cothorities.bsa.addresses = JSON.parse(JSON.stringify(cothorities.bsa.socket.addresses))
    cothorities.bsa.skipchains = {}
  })
}

const getCothority = cothority => {
  if (!cothority) return cothorities[DEFAULT_COTHORITY]
  else if (cothorities[cothority]) return cothorities[cothority]
  else throw new Error(`Could not find cothority ${cothority}`)
}

let dataTimeout = {}
const dataTimedOut = value => dataTimeout[value] === undefined || Date.now() > dataTimeout[value]
const resetTimeout = value => { dataTimeout[value] = Date.now() + TIMEOUT_LIMIT }

const coolSend = (res, obj) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(obj, null, 2))
}

const uth = misc.uint8ArrayToHex

const formatSkipblock = block => ({
  ...block,
  hash: uth(block.hash),
  backlinks: block.backlinks.map(uth),
  verifiers: block.verifiers.map(uth),
  data: uth(block.data),
  payload: uth(block.payload),
  genesis: uth(block.genesis),
  roster: {
    id: uth(block.roster.id),
    list: block.roster.list.map(e => ({
      ...e,
      public: uth(e.public),
      id: uth(e.id)
    })),
    aggregate: uth(block.roster.aggregate)
  },
  forward: block.forward.map(f => ({
    from: uth(f.from),
    to: uth(f.to),
    signature: {
      msg: uth(f.signature.msg),
      sig: uth(f.signature.sig)
    }
  }))
})

module.exports = {
  initCothorities,
  getCothority,
  URL,
  PORT,
  COTHORITIES,
  dataTimedOut,
  resetTimeout,
  coolSend,
  formatSkipblock
}
