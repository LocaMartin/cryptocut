export interface MethodPayload {
  id: number
  method: string
  params: any[]
  description: string
}

export interface MethodCategory {
  name: string
  description: string
  methods: MethodPayload[]
}

export const ETH_METHODS: MethodCategory[] = [
  {
    name: "Basic Methods",
    description: "Common Ethereum node information and chain methods",
    methods: [
      {
        id: 1,
        method: "web3_clientVersion",
        params: [],
        description: "Returns the current client version",
      },
      {
        id: 2,
        method: "net_version",
        params: [],
        description: "Returns the current network ID",
      },
      {
        id: 3,
        method: "eth_chainId",
        params: [],
        description: "Returns the chain ID used for signing protected transactions",
      },
      {
        id: 4,
        method: "eth_blockNumber",
        params: [],
        description: "Returns the number of the most recent block",
      },
      {
        id: 5,
        method: "eth_getBlockByNumber",
        params: ["latest", false],
        description: "Returns information about the latest block",
      },
    ],
  },
  {
    name: "Account Methods",
    description: "Methods related to Ethereum accounts",
    methods: [
      {
        id: 6,
        method: "eth_accounts",
        params: [],
        description: "Returns a list of addresses owned by client",
      },
      {
        id: 7,
        method: "eth_getBalance",
        params: ["0x0000000000000000000000000000000000000000", "latest"],
        description: "Returns the balance of the zero address",
      },
      {
        id: 8,
        method: "eth_getTransactionCount",
        params: ["0x0000000000000000000000000000000000000000", "latest"],
        description: "Returns the number of transactions sent from the zero address",
      },
    ],
  },
  {
    name: "Admin Methods",
    description: "Administrative methods that may reveal sensitive information",
    methods: [
      {
        id: 9,
        method: "admin_peers",
        params: [],
        description: "Returns the connected peers (may reveal network topology)",
      },
      {
        id: 10,
        method: "admin_nodeInfo",
        params: [],
        description: "Returns information about the node (may reveal internal details)",
      },
      {
        id: 11,
        method: "debug_traceTransaction",
        params: ["0x0000000000000000000000000000000000000000000000000000000000000000", {}],
        description: "Attempts to trace a transaction (may reveal internal state)",
      },
    ],
  },
  {
    name: "Personal Methods",
    description: "Methods related to account management (often restricted)",
    methods: [
      {
        id: 12,
        method: "personal_listAccounts",
        params: [],
        description: "Lists all accounts (may reveal wallet addresses)",
      },
      {
        id: 13,
        method: "personal_newAccount",
        params: ["weakpassword"],
        description: "Attempts to create a new account with a weak password",
      },
      {
        id: 14,
        method: "personal_unlockAccount",
        params: ["0x0000000000000000000000000000000000000000", "password", 300],
        description: "Attempts to unlock an account (may reveal if account exists)",
      },
    ],
  },
  {
    name: "Malformed Requests",
    description: "Intentionally malformed requests to test error handling",
    methods: [
      {
        id: 15,
        method: "eth_getBalance",
        params: ["not_a_valid_address", "latest"],
        description: "Invalid address format",
      },
      {
        id: 16,
        method: "eth_getBlockByNumber",
        params: ["0xffffffff", true],
        description: "Block number likely out of range",
      },
      {
        id: 17,
        method: "eth_call",
        params: [{ to: "0x0000000000000000000000000000000000000000", data: "0x" + "a".repeat(1000000) }, "latest"],
        description: "Oversized call data (potential DoS)",
      },
      {
        id: 18,
        method: "eth_getLogs",
        params: [{ fromBlock: "0x0", toBlock: "latest" }],
        description: "Request for all logs (potential DoS)",
      },
    ],
  },
  {
    name: "Injection Attempts",
    description: "Payloads that attempt to inject or exploit vulnerabilities",
    methods: [
      {
        id: 19,
        method: "eth_call",
        params: [
          { to: "0x0000000000000000000000000000000000000000", data: "0x'; DROP TABLE transactions; --" },
          "latest",
        ],
        description: "SQL injection attempt in hex data",
      },
      {
        id: 20,
        method: "eth_sendRawTransaction",
        params: ["0x' OR 1=1 --"],
        description: "SQL injection in transaction data",
      },
      {
        id: 21,
        method: "eth_call",
        params: [{ to: "<script>alert('XSS')</script>" }, "latest"],
        description: "XSS attempt in parameters",
      },
    ],
  },
]

export function generateJsonRpcPayload(method: MethodPayload): string {
  return JSON.stringify(
    {
      jsonrpc: "2.0",
      id: method.id,
      method: method.method,
      params: method.params,
    },
    null,
    2,
  )
}

export function generateBatchJsonRpcPayload(methods: MethodPayload[]): string {
  const requests = methods.map((method) => ({
    jsonrpc: "2.0",
    id: method.id,
    method: method.method,
    params: method.params,
  }))

  return JSON.stringify(requests, null, 2)
}
