import { analyzeJsonRpc, analyzeBatch } from "./analyzer"
import { describe, test, expect } from "vitest"

describe("JSON-RPC Analyzer", () => {
  test("detects stack trace disclosure", () => {
    const input = `{
      "jsonrpc": "2.0",
      "id": 1,
      "error": {
        "code": -32000,
        "message": "Error processing request: TypeError: Cannot read property 'balance' of undefined\\n    at Object.getBalance (/app/node_modules/web3/lib/web3.js:232)\\n    at processRequest (/app/server.js:45)"
      }
    }`

    const { results } = analyzeJsonRpc(input)
    expect(results.some((r) => r.title.includes("Stack Trace"))).toBe(true)
  })

  test("detects private key disclosure", () => {
    const input = `{
      "jsonrpc": "2.0",
      "id": 1,
      "result": {
        "privateKey": "0x07a1bb5c1ccec8657c4e1a9fa26e202ae6f6c6f89f2539744e6ed3535e85b9d0"
      }
    }`

    const { results } = analyzeJsonRpc(input)
    expect(results.some((r) => r.title.includes("Private Key"))).toBe(true)
  })

  test("handles batch analysis", () => {
    const inputs = [
      `{"jsonrpc": "2.0", "id": 1, "result": "ok"}`,
      `{"jsonrpc": "2.0", "id": 2, "error": {"code": -32000, "message": "stack trace"}}`,
    ]

    const { results, stats } = analyzeBatch(inputs)
    expect(results.length).toBeGreaterThan(0)
    expect(stats.totalResponses).toBe(2)
  })

  test("validates JSON format", () => {
    const input = `invalid json`
    const { results, error } = analyzeJsonRpc(input)
    expect(error).toBeDefined()
    expect(results.length).toBe(0)
  })
})
