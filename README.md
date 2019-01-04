# zinc
**z**inc **i**s **n**ot a **c**onode

This is a simple proxy around the cothority conodes, useful until they support wss:// connection.

## Options

When doing a query, zinc will automatically connect to the `dedis` cothority network.

You can decide which network to connect to by adding `?cothority=<dedis or bsa>` to your query.

The `bsa` network is a test network running on the same server as zinc.
