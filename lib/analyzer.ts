export interface AnalysisResult {
  id: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  title: string
  description: string
  recommendation: string
  affectedData?: string
  responseId?: string // For batch processing to track which response had the issue
  method?: string // JSON-RPC method if available
}

export interface BatchAnalysisStats {
  totalResponses: number
  vulnerableResponses: number
  issuesBySeverity: Record<string, number>
  methodsCovered: Set<string>
}

// Vulnerability detection rules
const rules = [
  {
    id: "STACK_TRACE",
    severity: "high",
    title: "Stack Trace Disclosure",
    test: (json: any) => {
      const error = json?.error?.message || ""
      return (
        typeof error === "string" &&
        (error.includes("stack") || error.includes("at ") || error.match(/\/[\w/.-]+:\d+:\d+/))
      )
    },
    description:
      "The error response contains a stack trace, which can reveal implementation details and potential attack vectors.",
    recommendation: "Filter error messages to remove stack traces before sending responses.",
  },
  {
    id: "VERBOSE_ERROR",
    severity: "medium",
    title: "Verbose Error Code",
    test: (json: any) => json?.error?.code === -32000,
    description: "The error code -32000 indicates a server error that might reveal internal state.",
    recommendation: "Use standardized error codes and minimize information disclosure in error messages.",
  },
  {
    id: "PRIVATE_KEY",
    severity: "critical",
    title: "Private Key Disclosure",
    test: (json: any) => {
      const resultStr = JSON.stringify(json)
      return /0x[a-fA-F0-9]{64}/.test(resultStr) && !resultStr.includes("blockHash")
    },
    description: "The response contains a 64-character hex string that might be a private key or sensitive data.",
    recommendation: "Ensure no private keys or sensitive credentials are included in responses.",
  },
  {
    id: "INTERNAL_IP",
    severity: "medium",
    title: "Internal IP Address Disclosure",
    test: (json: any) => {
      const resultStr = JSON.stringify(json)
      return /\b(10|172\.(1[6-9]|2[0-9]|3[0-1])|192\.168)(\.\d{1,3}){2}\b/.test(resultStr)
    },
    description: "The response contains what appears to be an internal IP address.",
    recommendation: "Filter out internal network information from responses.",
  },
  {
    id: "CLIENT_VERSION",
    severity: "low",
    title: "Client Version Disclosure",
    test: (json: any) => Boolean(json?.result?.clientVersion),
    description: "The response reveals the client version, which could help attackers target known vulnerabilities.",
    recommendation: "Consider hiding detailed version information in production environments.",
  },
  {
    id: "JSONRPC_VERSION",
    severity: "low",
    title: "Incorrect or Missing JSONRPC Version",
    test: (json: any) => !json?.jsonrpc || json.jsonrpc !== "2.0",
    description: 'The response does not correctly specify the JSONRPC version "2.0".',
    recommendation: "Ensure all responses include the correct JSONRPC version field.",
  },
  {
    id: "ADMIN_METHODS",
    severity: "high",
    title: "Admin Method Exposure",
    test: (json: any) => {
      const method = json?.method || ""
      return typeof method === "string" && (method.startsWith("admin_") || method.startsWith("debug_"))
    },
    description: "Administrative or debug methods are exposed which could lead to unauthorized access.",
    recommendation: "Restrict access to admin and debug methods or disable them in production.",
  },
  {
    id: "DB_CONNECTION",
    severity: "high",
    title: "Database Connection String Exposure",
    test: (json: any) => {
      const resultStr = JSON.stringify(json)
      return /mongodb(\+srv)?:\/\/|postgres:\/\/|mysql:\/\//.test(resultStr)
    },
    description: "The response contains what appears to be a database connection string.",
    recommendation: "Ensure no connection strings or credentials are included in responses.",
  },
  {
    id: "AUTH_TOKEN",
    severity: "critical",
    title: "Authentication Token Exposure",
    test: (json: any) => {
      const resultStr = JSON.stringify(json)
      return /eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/.test(resultStr) // JWT pattern
    },
    description: "The response contains what appears to be an authentication token or JWT.",
    recommendation: "Never include authentication tokens in API responses.",
  },
  {
    id: "SENSITIVE_PARAMS",
    severity: "high",
    title: "Sensitive Parameters in Response",
    test: (json: any) => {
      const resultStr = JSON.stringify(json).toLowerCase()
      const sensitiveWords = ["password", "secret", "token", "auth", "key", "credential"]
      return sensitiveWords.some((word) => resultStr.includes(word))
    },
    description: "The response contains field names that suggest sensitive information.",
    recommendation: "Review and remove any sensitive parameter names and values from responses.",
  },
]

export function analyzeJsonRpc(jsonInput: string, responseId?: string): { results: AnalysisResult[]; error?: string } {
  try {
    // Parse the JSON input
    const parsedJson = JSON.parse(jsonInput)
    const results: AnalysisResult[] = []

    // Extract the method if available
    const method = parsedJson.method || "unknown"

    // Apply all rules
    for (const rule of rules) {
      try {
        if (rule.test(parsedJson)) {
          let affectedData: string | undefined

          // Extract relevant data for the finding
          if (rule.id === "STACK_TRACE" && parsedJson.error) {
            affectedData = JSON.stringify(parsedJson.error, null, 2)
          } else if (rule.id === "PRIVATE_KEY") {
            const match = JSON.stringify(parsedJson).match(/0x[a-fA-F0-9]{64}/)
            affectedData = match ? match[0] : undefined
          } else if (rule.id === "INTERNAL_IP") {
            const match = JSON.stringify(parsedJson).match(
              /\b(10|172\.(1[6-9]|2[0-9]|3[0-1])|192\.168)(\.\d{1,3}){2}\b/,
            )
            affectedData = match ? match[0] : undefined
          } else if (rule.id === "CLIENT_VERSION" && parsedJson.result?.clientVersion) {
            affectedData = parsedJson.result.clientVersion
          } else if (rule.id === "JSONRPC_VERSION") {
            affectedData = parsedJson.jsonrpc || "missing"
          }

          results.push({
            id: `${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            severity: rule.severity as any,
            title: rule.title,
            description: rule.description,
            recommendation: rule.recommendation,
            affectedData,
            responseId,
            method,
          })
        }
      } catch (ruleError) {
        console.error(`Error applying rule ${rule.id}:`, ruleError)
      }
    }

    // If no issues found, add an info result
    if (results.length === 0) {
      results.push({
        id: `NO_ISSUES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: "info",
        title: "No Issues Detected",
        description: "No common vulnerabilities were detected in this JSON-RPC response.",
        recommendation: "Continue with manual analysis for more subtle issues.",
        responseId,
        method,
      })
    }

    return { results }
  } catch (err) {
    return { results: [], error: "Invalid JSON format. Please check your input." }
  }
}

export function analyzeBatch(jsonInputs: string[]): {
  results: AnalysisResult[]
  errors: { index: number; error: string }[]
  stats: BatchAnalysisStats
} {
  const allResults: AnalysisResult[] = []
  const errors: { index: number; error: string }[] = []
  const methodsCovered = new Set<string>()
  let vulnerableResponses = 0

  // Process each input
  jsonInputs.forEach((input, index) => {
    if (!input.trim()) return

    const responseId = `response-${index}`
    const { results, error } = analyzeJsonRpc(input, responseId)

    if (error) {
      errors.push({ index, error })
    } else {
      // Extract method if available
      try {
        const parsed = JSON.parse(input)
        const method = parsed.method || "unknown"
        methodsCovered.add(method)

        // Count vulnerable responses (those with non-info findings)
        if (results.some((r) => r.severity !== "info")) {
          vulnerableResponses++
        }
      } catch (e) {
        // Skip method extraction if parsing fails
      }

      allResults.push(...results)
    }
  })

  // Compile statistics
  const issuesBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }

  allResults.forEach((result) => {
    if (issuesBySeverity[result.severity] !== undefined) {
      issuesBySeverity[result.severity]++
    }
  })

  return {
    results: allResults,
    errors,
    stats: {
      totalResponses: jsonInputs.length,
      vulnerableResponses,
      issuesBySeverity,
      methodsCovered,
    },
  }
}
