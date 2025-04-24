"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Download, BarChart3, Clock, AlertTriangle, FileJson, Users, Wallet } from "lucide-react"
import { type Statistics, serializeStatistics } from "@/lib/statistics"
import { Progress } from "@/components/ui/progress"

interface StatisticsPanelProps {
  statistics: Statistics
  onReset: () => void
}

export function StatisticsPanel({ statistics, onReset }: StatisticsPanelProps) {
  const [activeTab, setActiveTab] = useState("test")

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const handleExport = () => {
    const serialized = serializeStatistics(statistics)
    const blob = new Blob([JSON.stringify(serialized, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `eth-rpc-statistics-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderTestStatistics = () => {
    const { test } = statistics
    const isTestActive = !test.endTime

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <FileJson className="h-4 w-4 mr-2" />
                Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{test.requestsSent}</div>
              <p className="text-xs text-muted-foreground">{test.responsesReceived} responses received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(test.responseTimeAvg)}</div>
              <p className="text-xs text-muted-foreground">
                Min: {formatDuration(test.responseTimeMin)} / Max: {formatDuration(test.responseTimeMax)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{test.errors.total}</div>
              <p className="text-xs text-muted-foreground">
                {Object.keys(test.errors.byType).length} different error types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <BarChart3 className="h-4 w-4 mr-2" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {test.endTime ? formatDuration(test.totalDuration * 1000) : "Running..."}
              </div>
              <p className="text-xs text-muted-foreground">{isTestActive ? "Test in progress" : "Test completed"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Methods Called</h3>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {Object.entries(test.methods).map(([method, count]) => (
                  <div key={method} className="flex justify-between items-center">
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{method}</code>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
                {Object.keys(test.methods).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No methods called yet</p>
                )}
              </div>
            </ScrollArea>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Error Types</h3>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {Object.entries(test.errors.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-xs text-red-500">{type}</span>
                    <Badge variant="destructive">{count}</Badge>
                  </div>
                ))}
                {Object.keys(test.errors.byType).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No errors detected</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    )
  }

  const renderTransactionStatistics = () => {
    const { transactions } = statistics
    const { fields } = transactions

    // Calculate percentages for field coverage
    const totalTx = transactions.totalTransactions || 1 // Avoid division by zero
    const fieldPercentages = Object.entries(fields)
      .map(([field, count]) => ({
        field,
        count,
        percentage: (count / totalTx) * 100,
      }))
      .sort((a, b) => b.percentage - a.percentage)

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <FileJson className="h-4 w-4 mr-2" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                {transactions.pending} pending / {transactions.queued} queued
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Addresses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.addresses.unique}</div>
              <p className="text-xs text-muted-foreground">{transactions.addresses.total} total occurrences</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Wallet className="h-4 w-4 mr-2" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.pending}</div>
              <p className="text-xs text-muted-foreground">Transactions in pending pool</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Queued
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.queued}</div>
              <p className="text-xs text-muted-foreground">Transactions in queue</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Transaction Fields</h3>
          <div className="space-y-3 border rounded-md p-4">
            {fieldPercentages.map(({ field, count, percentage }) => (
              <div key={field} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{field}</span>
                  <span>
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-1" />
              </div>
            ))}
            {transactions.totalTransactions === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No transaction data available</p>
            )}
          </div>
        </div>

        {transactions.addresses.unique > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Unique Addresses ({transactions.addresses.unique})</h3>
            <ScrollArea className="h-[150px] border rounded-md p-2">
              <div className="space-y-1">
                {Array.from(transactions.addresses.list).map((address) => (
                  <div key={address} className="text-xs font-mono">
                    {address}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Statistics Dashboard</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              Reset Stats
            </Button>
          </div>
        </CardTitle>
        <CardDescription>Detailed metrics about your JSON-RPC testing session</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="test">Test Statistics</TabsTrigger>
            <TabsTrigger value="transactions">Transaction Data</TabsTrigger>
          </TabsList>
          <TabsContent value="test" className="pt-4">
            {renderTestStatistics()}
          </TabsContent>
          <TabsContent value="transactions" className="pt-4">
            {renderTransactionStatistics()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
