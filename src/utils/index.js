const fs = require('fs')
const axios = require('axios')
const identity = require('@louismerlin/cothority')

const { net } = identity

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

module.exports = {
  initCothorities,
  getCothority,
  URL,
  PORT,
  COTHORITIES,
  dataTimedOut,
  resetTimeout
}
