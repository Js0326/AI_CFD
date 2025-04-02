import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"

const execAsync = promisify(exec)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 })
    }

    const userDir = path.join(process.cwd(), "data", userId)

    if (!fs.existsSync(userDir)) {
      return NextResponse.json({ error: "No test results found for this user" }, { status: 404 })
    }

    // Check if we have enough test data
    const pklFiles = fs.readdirSync(userDir).filter((file) => file.endsWith(".pkl"))

    if (pklFiles.length < 1) {
      return NextResponse.json({ error: "Not enough test data to make a prediction" }, { status: 400 })
    }

    // Call Python script to run the prediction model
    const outputPath = path.join(userDir, "prediction.json")

    await execAsync(`python -c "
import pickle
import json
import os
import numpy as np
from pathlib import Path

user_dir = '${userDir.replace(/\\/g, "\\\\")}'
pkl_files = [f for f in os.listdir(user_dir) if f.endswith('.pkl')]

# Load all test data
test_data = {}
for pkl_file in pkl_files:
    test_type = os.path.splitext(pkl_file)[0]
    with open(os.path.join(user_dir, pkl_file), 'rb') as f:
        test_data[test_type] = pickle.load(f)

# Simple model to predict fatigue level
def predict_fatigue(test_data):
    # In a real implementation, this would use a trained ML model
    # For now, we'll use a simple heuristic
    
    fatigue_score = 0
    confidence = 0.7  # Base confidence
    
    # Reaction test
    if 'reaction' in test_data:
        avg_reaction = test_data['reaction'].get('averageReactionTime', 250)
        if avg_reaction > 300:
            fatigue_score += 20
        elif avg_reaction > 250:
            fatigue_score += 10
    
    # Typing test
    if 'typing' in test_data:
        accuracy = test_data['typing'].get('accuracy', 90)
        wpm = test_data['typing'].get('wpm', 40)
        if accuracy < 85 or wpm < 30:
            fatigue_score += 15
    
    # Memory test
    if 'memory' in test_data:
        accuracy = test_data['memory'].get('accuracy', 80)
        if accuracy < 70:
            fatigue_score += 20
    
    # Math test
    if 'math' in test_data:
        accuracy = test_data['math'].get('accuracy', 80)
        response_time = test_data['math'].get('averageResponseTime', 5)
        if accuracy < 70 or response_time > 8:
            fatigue_score += 15
    
    # Eye tracking test
    if 'eye-tracking' in test_data:
        blink_rate = test_data['eye-tracking'].get('blinkRate', 15)
        fixation = test_data['eye-tracking'].get('fixationDuration', 1.5)
        if blink_rate > 20 or fixation > 2:
            fatigue_score += 25
    
    # Multitasking test
    if 'multitasking' in test_data:
        accuracy = test_data['multitasking'].get('accuracy', 80)
        index = test_data['multitasking'].get('multitaskingIndex', 50)
        if accuracy < 70 or index < 40:
            fatigue_score += 20
    
    # Adjust confidence based on number of tests
    confidence = min(0.95, 0.5 + (len(test_data) * 0.08))
    
    # Determine fatigue level
    if fatigue_score < 20:
        level = 'Low'
    elif fatigue_score < 40:
        level = 'Moderate'
    elif fatigue_score < 60:
        level = 'High'
    else:
        level = 'Severe'
    
    return {
        'score': min(100, fatigue_score),
        'level': level,
        'confidence': confidence,
        'timestamp': str(np.datetime64('now'))
    }

# Make prediction
prediction = predict_fatigue(test_data)

# Save prediction
with open('${outputPath.replace(/\\/g, "\\\\")}', 'w') as f:
    json.dump(prediction, f)
"`)

    // Read the prediction result
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({ error: "Failed to generate prediction" }, { status: 500 })
    }

    const prediction = JSON.parse(fs.readFileSync(outputPath, "utf8"))
    return NextResponse.json(prediction)
  } catch (error) {
    console.error("Error predicting fatigue:", error)
    return NextResponse.json({ error: "Failed to predict fatigue level" }, { status: 500 })
  }
}

