import { describe, test, expect } from "vitest"
import {
  createInitialStatistics,
  updateTestStatistics,
  finalizeTestStatistics,
  extractTransactionData,
  serializeStatistics,
} from "./statistics"

describe("Statistics Library", () => {
  test("creates initial statistics object", () => {
    const stats = createInitialStatistics()
    expect(stats.test.requestsSent).toBe(0)
    expect(stats.test.responsesReceived).toBe(0)
    expect(stats.test.errors.total).toBe(0)
    expect(stats.transactions.totalTransactions).toBe(0)
    expect(stats.transactions.addresses.unique).toBe(0)
  })

  test("updates test statistics correctly", () => {
    let stats = createInitialStatistics()
    stats = updateTestStatistics(stats, "eth_getBalance", 150, false)

    expect(stats.test.requestsSent).toBe(1)
    expect(stats.test.responsesReceived).toBe(1)
    expect(stats.test.responseTimeAvg).toBe(150)
    expect(stats.test.methods["eth_getBalance"]).toBe(1)
    expect(stats.test.errors.total).toBe(0)

    // Add an error
    stats = updateTestStatistics(stats, "eth_getBalance", 250, true, "Invalid params")

    expect(stats.test.requestsSent).toBe(2)
    expect(stats.test.responsesReceived).toBe(2)
    expect(stats.test.responseTimeAvg).toBe(200) // (150 + 250) / 2
    expect(stats.test.methods["eth_getBalance"]).toBe(2)
    expect(stats.test.errors.total).toBe(1)
    expect(stats.test.errors.byType["Invalid params"]).toBe(1)
  })

  test("finalizes test statistics", () => {
    const stats = createInitialStatistics()
    const finalized = finalizeTestStatistics(stats)

    expect(finalized.test.endTime).not.toBeNull()
    expect(finalized.test.totalDuration).toBeGreaterThanOrEqual(0)
  })

  test("extracts transaction data from responses", () => {
    let stats = createInitialStatistics()

    // Test with a single transaction
    const singleTx = {
      result: {
        hash: "0x123",
        from: "0xabc",
        to: "0xdef",
        gas: "0x5208",
        gasPrice: "0x4a817c800",
        nonce: "0x1",
        value: "0x1",
      },
    }

    stats = extractTransactionData(stats, singleTx)

    expect(stats.transactions.totalTransactions).toBe(1)
    expect(stats.transactions.addresses.total).toBe(2) // from + to
    expect(stats.transactions.addresses.unique).toBe(2)
    expect(stats.transactions.fields.hash).toBe(1)
    expect(stats.transactions.fields.from).toBe(1)
    expect(stats.transactions.fields.to).toBe(1)

    // Test with txpool content
    const txpoolContent = {
      result: {
        pending: {
          "0xabc": {
            "1": { to: "0xdef", gas: "0x5208" },
            "2": { to: "0xghi", gas: "0x5208" },
          },
          "0xdef": {
            "5": { to: "0xabc", gas: "0x5208" },
          },
        },
        queued: {
          "0xjkl": {
            "0": { to: "0xmno", gas: "0x5208" },
          },
        },
      },
    }

    stats = extractTransactionData(stats, txpoolContent)

    expect(stats.transactions.pending).toBe(3)
    expect(stats.transactions.queued).toBe(1)
    expect(stats.transactions.addresses.unique).toBeGreaterThan(2) // Added more unique addresses
  })

  test("serializes statistics for export", () => {
    const stats = createInitialStatistics()
    stats.transactions.addresses.list.add("0xabc")
    stats.transactions.addresses.list.add("0xdef")

    const serialized = serializeStatistics(stats)

    expect(Array.isArray(serialized.transactions.addresses.list)).toBe(true)
    expect(serialized.transactions.addresses.list).toContain("0xabc")
    expect(serialized.transactions.addresses.list).toContain("0xdef")
  })
})
