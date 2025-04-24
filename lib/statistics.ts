export interface TestStatistics {
  requestsSent: number
  responsesReceived: number
  responseTimeAvg: number
  responseTimeMin: number
  responseTimeMax: number
  totalDuration: number
  startTime: number
  endTime: number | null
  errors: {
    total: number
    byType: Record<string, number>
  }
  methods: Record<string, number>
}

export interface TransactionStatistics {
  totalTransactions: number
  addresses: {
    total: number
    unique: number
    list: Set<string>
  }
  pending: number
  queued: number
  fields: {
    chainId: number
    type: number
    nonce: number
    gas: number
    maxFeePerGas: number
    maxPriorityFeePerGas: number
    to: number
    value: number
    accessList: number
    input: number
    r: number
    s: number
    yParity: number
    v: number
    hash: number
    blockHash: number
    blockNumber: number
    transactionIndex: number
    from: number
    gasPrice: number
  }
}

export interface Statistics {
  test: TestStatistics
  transactions: TransactionStatistics
}

export function createInitialStatistics(): Statistics {
  return {
    test: {
      requestsSent: 0,
      responsesReceived: 0,
      responseTimeAvg: 0,
      responseTimeMin: Number.POSITIVE_INFINITY,
      responseTimeMax: 0,
      totalDuration: 0,
      startTime: Date.now(),
      endTime: null,
      errors: {
        total: 0,
        byType: {},
      },
      methods: {},
    },
    transactions: {
      totalTransactions: 0,
      addresses: {
        total: 0,
        unique: 0,
        list: new Set<string>(),
      },
      pending: 0,
      queued: 0,
      fields: {
        chainId: 0,
        type: 0,
        nonce: 0,
        gas: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        to: 0,
        value: 0,
        accessList: 0,
        input: 0,
        r: 0,
        s: 0,
        yParity: 0,
        v: 0,
        hash: 0,
        blockHash: 0,
        blockNumber: 0,
        transactionIndex: 0,
        from: 0,
        gasPrice: 0,
      },
    },
  }
}

export function updateTestStatistics(
  stats: Statistics,
  method: string,
  responseTime: number,
  isError: boolean,
  errorType?: string,
): Statistics {
  const newStats = { ...stats }

  // Update request counts
  newStats.test.requestsSent += 1
  newStats.test.responsesReceived += 1

  // Update response time metrics
  newStats.test.responseTimeMin = Math.min(newStats.test.responseTimeMin, responseTime)
  newStats.test.responseTimeMax = Math.max(newStats.test.responseTimeMax, responseTime)

  // Update running average
  const prevTotal = newStats.test.responseTimeAvg * (newStats.test.responsesReceived - 1)
  newStats.test.responseTimeAvg = (prevTotal + responseTime) / newStats.test.responsesReceived

  // Update method counts
  newStats.test.methods[method] = (newStats.test.methods[method] || 0) + 1

  // Update error stats if applicable
  if (isError) {
    newStats.test.errors.total += 1
    if (errorType) {
      newStats.test.errors.byType[errorType] = (newStats.test.errors.byType[errorType] || 0) + 1
    }
  }

  return newStats
}

export function finalizeTestStatistics(stats: Statistics): Statistics {
  const newStats = { ...stats }
  newStats.test.endTime = Date.now()
  newStats.test.totalDuration = (newStats.test.endTime - newStats.test.startTime) / 1000 // in seconds
  return newStats
}

export function extractTransactionData(stats: Statistics, responseData: any): Statistics {
  const newStats = { ...stats }

  try {
    // Handle different response formats
    let transactions: any[] = []

    // Case 1: Direct transaction object
    if (responseData && typeof responseData === "object" && responseData.hash) {
      transactions = [responseData]
    }
    // Case 2: Array of transactions
    else if (Array.isArray(responseData)) {
      transactions = responseData.filter((tx) => tx && typeof tx === "object")
    }
    // Case 3: Result containing transactions array
    else if (responseData && responseData.result) {
      if (Array.isArray(responseData.result)) {
        transactions = responseData.result.filter((tx) => tx && typeof tx === "object")
      } else if (typeof responseData.result === "object") {
        // Case 4: txpool.content response format
        if (responseData.result.pending) {
          newStats.transactions.pending = countTxPoolTransactions(responseData.result.pending)
          extractTxPoolAddresses(newStats, responseData.result.pending)
        }
        if (responseData.result.queued) {
          newStats.transactions.queued = countTxPoolTransactions(responseData.result.queued)
          extractTxPoolAddresses(newStats, responseData.result.queued)
        }

        // Case 5: Single transaction in result
        if (responseData.result.hash) {
          transactions = [responseData.result]
        }
      }
    }

    // Process extracted transactions
    if (transactions.length > 0) {
      newStats.transactions.totalTransactions += transactions.length

      // Process each transaction
      transactions.forEach((tx) => {
        // Count transaction fields
        Object.keys(newStats.transactions.fields).forEach((field) => {
          if (tx[field] !== undefined) {
            newStats.transactions.fields[field as keyof typeof newStats.transactions.fields] += 1
          }
        })

        // Track addresses
        if (tx.from) {
          newStats.transactions.addresses.total += 1
          newStats.transactions.addresses.list.add(tx.from.toLowerCase())
        }
        if (tx.to) {
          newStats.transactions.addresses.total += 1
          newStats.transactions.addresses.list.add(tx.to.toLowerCase())
        }
      })

      // Update unique address count
      newStats.transactions.addresses.unique = newStats.transactions.addresses.list.size
    }
  } catch (error) {
    console.error("Error extracting transaction data:", error)
  }

  return newStats
}

// Helper function to count transactions in txpool.content response
function countTxPoolTransactions(poolSection: Record<string, Record<string, any>>): number {
  let count = 0
  Object.keys(poolSection).forEach((address) => {
    Object.keys(poolSection[address]).forEach(() => {
      count++
    })
  })
  return count
}

// Helper function to extract addresses from txpool.content response
function extractTxPoolAddresses(stats: Statistics, poolSection: Record<string, Record<string, any>>): void {
  Object.keys(poolSection).forEach((address) => {
    stats.transactions.addresses.total += 1
    stats.transactions.addresses.list.add(address.toLowerCase())

    // Also count 'to' addresses in the transactions
    Object.values(poolSection[address]).forEach((tx) => {
      if (tx.to) {
        stats.transactions.addresses.total += 1
        stats.transactions.addresses.list.add(tx.to.toLowerCase())
      }
    })
  })
}

// Helper function to create a serializable version of statistics for export
export function serializeStatistics(stats: Statistics): any {
  const serialized = JSON.parse(JSON.stringify(stats))
  serialized.transactions.addresses.list = Array.from(stats.transactions.addresses.list)
  return serialized
}
