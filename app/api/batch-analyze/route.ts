import { type NextRequest, NextResponse } from "next/server"
import { analyzeBatch } from "@/lib/analyzer"

export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Parse the batch of JSON strings from the request body
    const { jsonInputs } = await request.json()

    if (!Array.isArray(jsonInputs)) {
      return NextResponse.json({ error: "Request body must contain a jsonInputs array" }, { status: 400 })
    }

    // Process the batch
    const { results, errors, stats } = analyzeBatch(jsonInputs)

    return NextResponse.json({
      results,
      errors,
      stats,
    })
  } catch (error: any) {
    console.error("Error processing batch analysis:", error)

    return NextResponse.json({ error: `Server error: ${error.message || "Unknown error"}` }, { status: 500 })
  }
}
