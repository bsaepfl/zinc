#!/usr/bin/env node
const express = require('express')
const cors = require('cors')

const cothority = require('./cothority')

const { initCothorities, URL, PORT, COTHORITIES, getCothority, coolSend } = require('./utils')

const app = express()
app.use(cors())

app.get('/', async (req, res) => {
  return coolSend(res, {
    cothorities: {
      description: 'list of zinc\'s cothorities',
      url: `${URL}/cothorities`
    },
    cothority: {
      description: 'endpoint for a specific cothority',
      url: `${URL}/:cothority`
    }
  })
})

app.get('/cothorities', (req, res) => coolSend(res, COTHORITIES))

app.use('/:cothority', async (req, res, next) => {
  req.cothority = getCothority(req.params.cothority)
  return next()
})

app.use('/:cothority', cothority)

const start = async () => {
  await initCothorities()
  app.listen(PORT, () => console.log(`zinc listening on port ${PORT}!`))
}

start()
