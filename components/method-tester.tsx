"use client"

import { useState, useEffect } from "react"
import { AlertCircle, Check, Copy, Play, Plus, Send, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ETH_METHODS, type MethodPayload, generateJsonRpcPayload, generateBatchJsonRpcPayload } from "@/lib/eth-methods"
import { analyzeJsonRpc, type AnalysisResult } from "@/lib/analyzer"
import {
  createInitialStatistics,
  updateTestStatistics,
  finalizeTestStatistics,
  extractTransactionData,
  type Statistics,
} from "@/lib/statistics"
import { StatisticsPanel } from "@/components/statistics-panel"

interface TestResult {
  id: string
  method: string
  request: string
  response: string
  timestamp: string
  duration: number
  status: "success" | "error"
  analysis: AnalysisResult[]
}

export function MethodTester() {
  const [endpoint, setEndpoint] = useState("")
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([
    { key: "Content-Type", value: "application/json" },
  ])
  const [selectedMethods, setSelectedMethods] = useState<MethodPayload[]>([])
  const [currentRequest, setCurrentRequest] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"tester" | "results" | "stats">("tester")
  const [statistics, setStatistics] = useState<Statistics>(createInitialStatistics())
  const [showStatistics, setShowStatistics] = useState(false)

  // Reset statistics when component unmounts or when explicitly reset
  useEffect(() => {
    return () => {
      // Finalize statistics when component unmounts
      setStatistics((stats) => finalizeTestStatistics(stats))
    }
  }, [])

  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: "", value: "" }])
  }

  const handleHeaderChange = (index: number, field: "key" | "value", value: string) => {
    const newHeaders = [...customHeaders]
    newHeaders[index][field] = value
    setCustomHeaders(newHeaders)
  }

  const handleRemoveHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index))
  }

  const handleMethodSelect = (method: MethodPayload) => {
    if (selectedMethods.some((m) => m.id === method.id)) {
      setSelectedMethods(selectedMethods.filter((m) => m.id !== method.id))
    } else {
      setSelectedMethods([...selectedMethods, method])
    }
  }

  const handleGenerateRequest = () => {
    if (selectedMethods.length === 1) {
      setCurrentRequest(generateJsonRpcPayload(selectedMethods[0]))
    } else if (selectedMethods.length > 1) {
      setCurrentRequest(generateBatchJsonRpcPayload(selectedMethods))
    }
  }

  const handleCopyRequest = () => {
    navigator.clipboard.writeText(currentRequest)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendRequest = async () => {
    if (!endpoint) {
      setError("Please enter an endpoint URL")
      return
    }

    if (!currentRequest) {
      setError("Please generate a request payload first")
      return
    }

    setIsLoading(true)
    setError("")
    setShowStatistics(true)

    const startTime = performance.now()

    try {
      // Convert headers array to object
      const headerObj: Record<string, string> = {}
      customHeaders.forEach((h) => {
        if (h.key && h.value) {
          headerObj[h.key] = h.value
        }
      })

      const response = await fetch(endpoint, {
        method: "POST",
        headers: headerObj,
        body: currentRequest,
      })

      const responseText = await response.text()
      const endTime = performance.now()
      const duration = endTime - startTime

      let responseJson
      let isError = false
      let errorType = ""

      try {
        responseJson = JSON.parse(responseText)

        // Check if it's an error response
        if (responseJson.error) {
          isError = true
          errorType = responseJson.error.code ? `Error ${responseJson.error.code}` : "JSON-RPC Error"
        } else if (Array.isArray(responseJson)) {
          // Check for errors in batch response
          const hasErrors = responseJson.some((item) => item.error)
          if (hasErrors) {
            isError = true
            errorType = "Batch Error"
          }
        }

        // Extract transaction data for statistics
        setStatistics((prevStats) => extractTransactionData(prevStats, responseJson))
      } catch (e) {
        // If not valid JSON, use as text
        responseJson = { error: "Invalid JSON response", text: responseText }
        isError = true
        errorType = "Invalid JSON"
      }

      // Analyze the response
      const { results } = analyzeJsonRpc(responseText)

      // Determine which method was used
      const methodName =
        selectedMethods.length === 1 ? selectedMethods[0].method : `Batch (${selectedMethods.length} methods)`

      // Update statistics
      setStatistics((prevStats) => updateTestStatistics(prevStats, methodName, duration, isError, errorType))

      const newResult: TestResult = {
        id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        method: methodName,
        request: currentRequest,
        response: JSON.stringify(responseJson, null, 2),
        timestamp: new Date().toISOString(),
        duration,
        status: response.ok && !isError ? "success" : "error",
        analysis: results,
      }

      setTestResults([newResult, ...testResults])

      // Switch to results tab after successful request
      setActiveTab("results")
    } catch (err: any) {
      setError(`Request failed: ${err.message}`)

      // Update statistics for failed request
      setStatistics((prevStats) =>
        updateTestStatistics(
          prevStats,
          selectedMethods.length === 1 ? selectedMethods[0].method : "Batch",
          performance.now() - startTime,
          true,
          "Network Error",
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearResults = () => {
    setTestResults([])
  }

  const handleResetStatistics = () => {
    setStatistics(createInitialStatistics())
  }

  const renderTesterTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Method Testing</CardTitle>
        <CardDescription>Test Ethereum JSON-RPC endpoints with various methods and payloads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="endpoint">JSON-RPC Endpoint</Label>
          <Input
            id="endpoint"
            placeholder="https://example.com/v1/jsonrpc"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Headers</Label>
            <Button variant="outline" size="sm" onClick={handleAddHeader}>
              <Plus className="h-4 w-4 mr-1" /> Add Header
            </Button>
          </div>
          <div className="space-y-2">
            {customHeaders.map((header, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => handleHeaderChange(index, "key", e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(index, "value", e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveHeader(index)}
                  disabled={index === 0} // Don't allow removing the first header (Content-Type)
                >
                  <AlertCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Select Methods</Label>
          <ScrollArea className="h-[200px] border rounded-md p-2">
            <Accordion type="multiple" className="w-full">
              {ETH_METHODS.map((category) => (
                <AccordionItem key={category.name} value={category.name}>
                  <AccordionTrigger className="text-sm font-medium">
                    {category.name}
                    <Badge variant="outline" className="ml-2">
                      {category.methods.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-2">
                      {category.methods.map((method) => (
                        <div key={method.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={`method-${method.id}`}
                            checked={selectedMethods.some((m) => m.id === method.id)}
                            onCheckedChange={() => handleMethodSelect(method)}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <Label htmlFor={`method-${method.id}`} className="text-sm font-medium cursor-pointer">
                              {method.method}
                            </Label>
                            <p className="text-xs text-muted-foreground">{method.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
          <div className="text-sm text-muted-foreground">
            Selected: {selectedMethods.length} method{selectedMethods.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="request">Request Payload</Label>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateRequest}
                disabled={selectedMethods.length === 0}
              >
                <Play className="h-4 w-4 mr-1" /> Generate
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyRequest} disabled={!currentRequest}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>
          <Textarea
            id="request"
            placeholder="JSON-RPC request will appear here"
            value={currentRequest}
            onChange={(e) => setCurrentRequest(e.target.value)}
            className="font-mono text-sm min-h-[200px]"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSendRequest} disabled={isLoading || !endpoint || !currentRequest} className="w-full">
          {isLoading ? (
            "Sending Request..."
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" /> Send Request
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )

  const renderResultsTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Test Results</CardTitle>
        <CardDescription>
          {testResults.length > 0
            ? `${testResults.length} test${testResults.length !== 1 ? "s" : ""} executed`
            : "Results will appear here after testing"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {testResults.length > 0 ? (
            <div className="space-y-4">
              {testResults.map((result) => (
                <div key={result.id} className="border rounded-lg overflow-hidden">
                  <div
                    className={`px-4 py-2 text-white ${result.status === "success" ? "bg-green-600" : "bg-red-600"}`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">{result.method}</h3>
                      <Badge variant="outline" className="text-white border-white">
                        {result.duration.toFixed(0)}ms
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-sm text-muted-foreground">{new Date(result.timestamp).toLocaleString()}</div>

                    <Tabs defaultValue="response">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="response">Response</TabsTrigger>
                        <TabsTrigger value="request">Request</TabsTrigger>
                        <TabsTrigger value="analysis">Analysis</TabsTrigger>
                      </TabsList>
                      <TabsContent value="response" className="mt-2">
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {result.response}
                        </pre>
                      </TabsContent>
                      <TabsContent value="request" className="mt-2">
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {result.request}
                        </pre>
                      </TabsContent>
                      <TabsContent value="analysis" className="mt-2">
                        {result.analysis.length > 0 ? (
                          <div className="space-y-2">
                            {result.analysis.map((finding) => (
                              <div key={finding.id} className="border rounded p-2">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-sm font-medium">{finding.title}</h4>
                                  <Badge variant={finding.severity === "info" ? "secondary" : "outline"}>
                                    {finding.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs mt-1">{finding.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No issues detected</p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Send className="h-12 w-12 mb-2 opacity-20" />
              <p>No test results yet. Send a request to see results here.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={testResults.length === 0}>
              Export Results
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Test Results</DialogTitle>
              <DialogDescription>Download your test results in JSON format</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                This will export {testResults.length} test result{testResults.length !== 1 ? "s" : ""} with all request
                and response data.
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(testResults, null, 2)], { type: "application/json" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `eth-rpc-tests-${new Date().toISOString().slice(0, 10)}.json`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                >
                  Download JSON
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" onClick={handleClearResults} disabled={testResults.length === 0}>
          Clear Results
        </Button>
      </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ethereum JSON-RPC Method Tester</h2>
          <p className="text-muted-foreground">Test endpoints with various methods and analyze responses</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowStatistics(!showStatistics)}>
          <BarChart3 className="h-4 w-4" />
          {showStatistics ? "Hide Statistics" : "Show Statistics"}
        </Button>
      </div>

      {showStatistics && <StatisticsPanel statistics={statistics} onReset={handleResetStatistics} />}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tester">Method Tester</TabsTrigger>
          <TabsTrigger value="results">Results ({testResults.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="tester" className="mt-4">
          {renderTesterTab()}
        </TabsContent>
        <TabsContent value="results" className="mt-4">
          {renderResultsTab()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
