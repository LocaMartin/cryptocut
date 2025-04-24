"use client"

import type React from "react"

import { useState, useRef } from "react"
import { AlertCircle, ArrowRight, Bug, Download, FileJson, Search, Upload, X, AlertTriangle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { analyzeJsonRpc, analyzeBatch, type AnalysisResult, type BatchAnalysisStats } from "@/lib/analyzer"
import { Label } from "@/components/ui/label"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"

// Rest of the file remains the same as before, but add this navigation section at the top:

export default function EthAnalyzer() {
  const [jsonInput, setJsonInput] = useState("")
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [batchResults, setBatchResults] = useState<AnalysisResult[]>([])
  const [batchStats, setBatchStats] = useState<BatchAnalysisStats | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("single")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [progress, setProgress] = useState(0)
  const [currentFileIdx, setCurrentFileIdx] = useState(0)
  const [batchErrors, setBatchErrors] = useState<{ index: number; error: string; name?: string }[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const analyzeJsonRpcSingle = () => {
    setIsAnalyzing(true)
    setError("")

    try {
      const { results, error } = analyzeJsonRpc(jsonInput)
      if (error) {
        setError(error)
      } else {
        setResults(results)
      }
    } catch (err) {
      setError("Error analyzing JSON-RPC response")
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      setUploadedFiles((prevFiles) => [...prevFiles, ...files])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index))
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const analyzeBatchFiles = async () => {
    setIsAnalyzing(true)
    setBatchErrors([])
    setBatchResults([])
    setBatchStats(null)
    setProgress(0)
    setCurrentFileIdx(0)

    try {
      const jsonContents: string[] = []
      const fileErrors: { index: number; error: string; name: string }[] = []

      // Process files in chunks to avoid UI freezing
      const chunkSize = 10
      const totalFiles = uploadedFiles.length

      for (let i = 0; i < totalFiles; i += chunkSize) {
        const chunk = uploadedFiles.slice(i, i + chunkSize)
        const chunkContents = await Promise.all(
          chunk.map(async (file, chunkIndex) => {
            const globalIndex = i + chunkIndex
            setCurrentFileIdx(globalIndex + 1)

            try {
              return await readFileAsText(file)
            } catch (err) {
              fileErrors.push({
                index: globalIndex,
                error: "Failed to read file",
                name: file.name,
              })
              return ""
            }
          }),
        )

        jsonContents.push(...chunkContents)
        setProgress(Math.round(((i + chunk.length) / totalFiles) * 100))

        // Allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      const { results, errors, stats } = analyzeBatch(jsonContents)

      // Map file errors
      const mappedErrors = [
        ...fileErrors,
        ...errors.map((err) => ({
          ...err,
          name: uploadedFiles[err.index]?.name || `File ${err.index}`,
        })),
      ]

      setBatchResults(results)
      setBatchStats(stats)
      setBatchErrors(mappedErrors)
    } catch (err) {
      setError("Error analyzing batch files")
      console.error(err)
    } finally {
      setIsAnalyzing(false)
      setProgress(100)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-purple-700"
      case "high":
        return "bg-red-500"
      case "medium":
        return "bg-orange-500"
      case "low":
        return "bg-yellow-500"
      default:
        return "bg-blue-500"
    }
  }

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-purple-700"
      case "high":
        return "text-red-500"
      case "medium":
        return "text-orange-500"
      case "low":
        return "text-yellow-500"
      default:
        return "text-blue-500"
    }
  }

  const exportResults = () => {
    const activeResults = activeTab === "single" ? results : batchResults
    const exportData = {
      timestamp: new Date().toISOString(),
      input: activeTab === "single" ? jsonInput : `${uploadedFiles.length} files analyzed`,
      results: activeResults,
      stats: activeTab === "batch" ? batchStats : undefined,
      errors: activeTab === "batch" ? batchErrors : undefined,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `eth-rpc-analysis-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getPieChartData = () => {
    if (!batchStats) return []

    const { issuesBySeverity } = batchStats
    return [
      { name: "Critical", value: issuesBySeverity.critical || 0 },
      { name: "High", value: issuesBySeverity.high || 0 },
      { name: "Medium", value: issuesBySeverity.medium || 0 },
      { name: "Low", value: issuesBySeverity.low || 0 },
      { name: "Info", value: issuesBySeverity.info || 0 },
    ].filter((item) => item.value > 0)
  }

  const COLORS = {
    Critical: "#9333ea",
    High: "#ef4444",
    Medium: "#f97316",
    Low: "#eab308",
    Info: "#3b82f6",
  }

  const renderActiveResults = () => {
    const activeResults = activeTab === "single" ? results : batchResults

    return (
      <ScrollArea className="h-[400px] pr-4">
        {activeResults.length > 0 ? (
          <div className="space-y-4">
            {activeResults.map((result) => (
              <div key={result.id} className="border rounded-lg overflow-hidden">
                <div className={`px-4 py-2 text-white ${getSeverityColor(result.severity)}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">{result.title}</h3>
                    <Badge variant="outline" className="text-white border-white">
                      {result.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {activeTab === "batch" && result.responseId && (
                    <div className="text-sm text-muted-foreground">
                      Response ID: {result.responseId}
                      {result.method && ` | Method: ${result.method}`}
                    </div>
                  )}

                  <p>{result.description}</p>

                  {result.affectedData && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Affected Data:</p>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{result.affectedData}</pre>
                    </div>
                  )}

                  <div className="flex items-start gap-1 text-sm">
                    <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <p>
                      <span className="font-medium">Recommendation:</span> {result.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Search className="h-12 w-12 mb-2 opacity-20" />
            <p>No results yet. Analyze a JSON-RPC response to see findings here.</p>
          </div>
        )}
      </ScrollArea>
    )
  }

  const renderBatchStats = () => {
    if (!batchStats) return null

    const pieChartData = getPieChartData()

    return (
      <div className="p-4 border rounded-md mb-4">
        <h3 className="text-lg font-semibold mb-2">Analysis Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-sm text-muted-foreground">Total Files:</dt>
              <dd className="text-sm font-medium">{batchStats.totalResponses}</dd>

              <dt className="text-sm text-muted-foreground">Vulnerable Responses:</dt>
              <dd className="text-sm font-medium">{batchStats.vulnerableResponses}</dd>

              <dt className="text-sm text-muted-foreground">Unique Methods:</dt>
              <dd className="text-sm font-medium">{batchStats.methodsCovered.size}</dd>

              <dt className="text-sm text-muted-foreground">Critical Issues:</dt>
              <dd className={`text-sm font-bold ${getSeverityTextColor("critical")}`}>
                {batchStats.issuesBySeverity.critical || 0}
              </dd>

              <dt className="text-sm text-muted-foreground">High Issues:</dt>
              <dd className={`text-sm font-bold ${getSeverityTextColor("high")}`}>
                {batchStats.issuesBySeverity.high || 0}
              </dd>

              <dt className="text-sm text-muted-foreground">Medium Issues:</dt>
              <dd className={`text-sm font-bold ${getSeverityTextColor("medium")}`}>
                {batchStats.issuesBySeverity.medium || 0}
              </dd>

              <dt className="text-sm text-muted-foreground">Low Issues:</dt>
              <dd className={`text-sm font-bold ${getSeverityTextColor("low")}`}>
                {batchStats.issuesBySeverity.low || 0}
              </dd>
            </dl>
          </div>

          <div className="flex justify-center items-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground">No issues found</div>
            )}
          </div>
        </div>

        {batchErrors.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
              {batchErrors.length} error{batchErrors.length !== 1 ? "s" : ""} occurred during analysis
            </h4>
            <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {batchErrors.map((err, idx) => (
                  <li key={idx}>
                    {err.name ? `${err.name}: ` : `File ${err.index}: `}
                    {err.error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="flex items-center gap-2 mb-2">
          <Bug className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Ethereum JSON-RPC Analyzer</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Analyze Ethereum JSON-RPC responses to identify potential security vulnerabilities for bug bounty hunting
        </p>

        {/* Add navigation links */}
        <div className="flex gap-4 mt-4">
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Search className="h-4 w-4" /> Response Analyzer
            </Button>
          </Link>
          <Link href="/method-tester">
            <Button variant="outline" className="gap-2">
              <Zap className="h-4 w-4" /> Method Tester
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Analysis</TabsTrigger>
          <TabsTrigger value="batch">Batch Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                JSON-RPC Response
              </CardTitle>
              <CardDescription>Paste an Ethereum JSON-RPC response to analyze for security issues</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={`Paste JSON-RPC response here...\n\nExample:\n{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "clientVersion": "Geth/v1.10.8-stable"\n  }\n}`}
                className="min-h-[300px] font-mono text-sm"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={analyzeJsonRpcSingle} disabled={isAnalyzing || !jsonInput.trim()} className="w-full">
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">Analyzing...</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Analyze Response
                  </span>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Batch JSON-RPC Analysis
              </CardTitle>
              <CardDescription>Upload multiple JSON files for bulk analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".json"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="flex flex-col space-y-1">
                      <Label htmlFor="file-upload" className="text-primary cursor-pointer font-medium">
                        Click to upload JSON files
                      </Label>
                      <p className="text-sm text-muted-foreground">or drag and drop JSON files here</p>
                    </div>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} selected
                    </h4>
                    <div className="max-h-40 overflow-y-auto border rounded-md">
                      <div className="p-2 grid gap-2">
                        {uploadedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1 px-2 text-sm border rounded bg-muted/50"
                          >
                            <span className="truncate max-w-[80%]">{file.name}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeFile(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing files...</span>
                      <span>
                        {currentFileIdx} / {uploadedFiles.length}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={analyzeBatchFiles}
                disabled={isAnalyzing || uploadedFiles.length === 0}
                className="w-full"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">Analyzing Batch...</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Analyze {uploadedFiles.length} File{uploadedFiles.length !== 1 ? "s" : ""}
                  </span>
                )}
              </Button>
            </CardFooter>
          </Card>

          {batchStats && renderBatchStats()}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Analysis Results
          </CardTitle>
          <CardDescription>
            {activeTab === "single" &&
              results.length > 0 &&
              `Found ${results.length} potential ${results.length === 1 ? "issue" : "issues"}`}
            {activeTab === "batch" &&
              batchResults.length > 0 &&
              `Found ${batchResults.length} potential ${batchResults.length === 1 ? "issue" : "issues"} across ${batchStats?.vulnerableResponses || 0} files`}
            {((activeTab === "single" && !results.length) || (activeTab === "batch" && !batchResults.length)) &&
              "Results will appear here after analysis"}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderActiveResults()}</CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={exportResults}
            disabled={
              (activeTab === "single" && results.length === 0) || (activeTab === "batch" && batchResults.length === 0)
            }
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
        </CardFooter>
      </Card>

      <Tabs defaultValue="examples" className="mt-8 max-w-3xl mx-auto">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="examples">Example Payloads</TabsTrigger>
          <TabsTrigger value="guide">Bug Hunting Guide</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>
        <TabsContent value="examples" className="p-4 border rounded-md mt-2">
          <h3 className="text-lg font-medium mb-2">Example JSON-RPC Payloads</h3>
          <p className="mb-4 text-muted-foreground">Click on an example to load it into the analyzer:</p>

          <div className="grid gap-3">
            <Button
              variant="outline"
              className="justify-start h-auto py-2 px-4 font-mono text-xs"
              onClick={() =>
                setJsonInput(`{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Error processing request: TypeError: Cannot read property 'balance' of undefined\\n    at Object.getBalance (/app/node_modules/web3/lib/web3.js:232)\\n    at processRequest (/app/server.js:45)",
    "data": {
      "request": "eth_getBalance",
      "params": ["0x1234567890123456789012345678901234567890"]
    }
  }
}`)
              }
            >
              Error with Stack Trace
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-2 px-4 font-mono text-xs"
              onClick={() =>
                setJsonInput(`{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "accounts": [
      "0x1234567890123456789012345678901234567890",
      "0x0987654321098765432109876543210987654321"
    ],
    "clientVersion": "Geth/v1.9.12-stable",
    "nodeInfo": {
      "ip": "192.168.1.5",
      "port": 8545,
      "enode": "enode://a979fb575495b8d6db44f750317d0f4622bf4c2aa3365d6af7c284339968eef29b69ad0dce72a4d8db5ebb4968de0e3bec910127f134779fbcb0cb6d3331163c@192.168.1.5:8545"
    }
  }
}`)
              }
            >
              Response with Internal IP
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-2 px-4 font-mono text-xs"
              onClick={() =>
                setJsonInput(`{
  "id": 3,
  "result": {
    "address": "0x1234567890123456789012345678901234567890",
    "privateKey": "0x07a1bb5c1ccec8657c4e1a9fa26e202ae6f6c6f89f2539744e6ed3535e85b9d0",
    "publicKey": "0x04b7a97a99595ed8e85cdf8faa3ada6c07dac213222c53d0f409d1df1fa2c8e9e9c5a83c6cb96feff45d8de2f696fa9f73283ab4789324458611d5d0e7a4b9017c"
  }
}`)
              }
            >
              Response with Private Key
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="guide" className="p-4 border rounded-md mt-2">
          <h3 className="text-lg font-medium mb-2">Ethereum Bug Bounty Hunting Guide</h3>
          <div className="space-y-4">
            <p>When hunting for bugs in Ethereum JSON-RPC implementations, look for:</p>

            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium">Information Disclosure</span> - Private keys, internal IPs, stack traces
              </li>
              <li>
                <span className="font-medium">Authentication Bypass</span> - Missing or weak authentication for
                sensitive methods
              </li>
              <li>
                <span className="font-medium">Access Control Issues</span> - Ability to access methods that should be
                restricted
              </li>
              <li>
                <span className="font-medium">Injection Vulnerabilities</span> - Malformed inputs that can cause
                unexpected behavior
              </li>
              <li>
                <span className="font-medium">Denial of Service</span> - Requests that can crash or slow down the node
              </li>
            </ul>

            <p className="mt-4">Common JSON-RPC methods to test:</p>

            <ul className="list-disc pl-5 space-y-2">
              <li>
                <code className="bg-muted px-1 rounded">eth_sendTransaction</code> - Check for transaction signing
                without proper authorization
              </li>
              <li>
                <code className="bg-muted px-1 rounded">personal_*</code> methods - Often contain sensitive operations
              </li>
              <li>
                <code className="bg-muted px-1 rounded">admin_*</code> methods - Administrative functions that should be
                restricted
              </li>
              <li>
                <code className="bg-muted px-1 rounded">debug_*</code> methods - Can reveal internal state information
              </li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="about" className="p-4 border rounded-md mt-2">
          <h3 className="text-lg font-medium mb-2">About This Tool</h3>
          <p className="mb-4">
            This Ethereum JSON-RPC Response Analyzer is designed to help security researchers and bug bounty hunters
            identify potential vulnerabilities in Ethereum node responses.
          </p>

          <p className="mb-4">
            The tool performs static analysis on JSON-RPC responses to detect common security issues such as:
          </p>

          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>Information disclosure vulnerabilities</li>
            <li>Stack trace leakage</li>
            <li>Private key exposure</li>
            <li>Internal network information disclosure</li>
            <li>Version information that could be used for targeted attacks</li>
          </ul>

          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> This tool is meant to assist in the bug hunting process but is not a replacement for
            thorough manual analysis. Always verify findings and conduct additional testing.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
