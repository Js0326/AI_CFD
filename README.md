# Cognitive Fatigue Detection System

This application integrates a Next.js frontend with a Flask backend to detect and monitor cognitive fatigue using the ONNX model.

## Project Structure

- `frontend/`: Next.js frontend application
- `backend/`: Flask backend API serving the ONNX model
- `mmnn_fatigue_model.onnx`: The ONNX model for fatigue prediction
- `fatigue_dataset.csv`: Dataset used for training the model

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Start the Flask server:
   ```
   python app.py
   ```
   The backend will run on http://localhost:5000

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```
   The frontend will run on http://localhost:3000

## Features

- Real-time data collection from user activities (mouse movements, keystrokes)
- Simulated eye tracking metrics (blink rate, fixation duration, saccade speed)
- Integration with ONNX model for cognitive fatigue prediction
- Dynamic dashboard updates with fatigue scores and metrics
- Historical fatigue trend visualization
- Activity logging and monitoring

## API Endpoints

- `GET /api/health`: Health check endpoint
- `GET /api/fatigue-data`: Get the current fatigue data for the user
- `POST /api/predict`: Get a prediction based on input features
- `POST /api/activity`: Log user activity data

## Technologies Used

- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Backend**: Flask, Python
- **Model**: ONNX Runtime
- **Data Visualization**: Recharts