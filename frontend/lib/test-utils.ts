// Utility functions for test result handling

import { useAuth } from "@/lib/auth"

// Save test results to the server
export async function saveTestResults(testType: string, results: any) {
  try {
    const { user } = useAuth.getState()

    if (!user) {
      console.error("User not authenticated")
      return false
    }

    const response = await fetch("/api/test-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        testType,
        userId: user.id,
        results,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save test results: ${response.statusText}`)
    }

    return true
  } catch (error) {
    console.error("Error saving test results:", error)
    return false
  }
}

// Get test results from the server
export async function getTestResults(testType?: string) {
  try {
    const { user } = useAuth.getState()

    if (!user) {
      console.error("User not authenticated")
      return null
    }

    const url = new URL("/api/test-results", window.location.origin)

    if (testType) {
      url.searchParams.append("testType", testType)
    }

    url.searchParams.append("userId", user.id)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to get test results: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting test results:", error)
    return null
  }
}

// Get fatigue prediction from the server
export async function getFatiguePrediction() {
  try {
    const { user } = useAuth.getState()

    if (!user) {
      console.error("User not authenticated")
      return null
    }

    const url = new URL("/api/predict-fatigue", window.location.origin)
    url.searchParams.append("userId", user.id)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to get fatigue prediction: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting fatigue prediction:", error)
    return null
  }
}

