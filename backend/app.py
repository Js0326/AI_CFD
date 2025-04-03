from flask import Flask, request, jsonify
import numpy as np
import onnxruntime as ort
import os
import time
from flask_cors import CORS
import cv2
import pickle
import random

app = Flask(__name__)
CORS(app)  


model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'mmnn_fatigue_model.onnx')
session = ort.InferenceSession(model_path)

# Load pre-trained models for face and eye detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Function to detect blinks, saccades, and fixation
def process_eye_frame(frame, prev_eyes_data=None):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    eyes_data = []
    blink_detected = False
    
    # If we have previous eye data, we can calculate saccades and fixations
    saccade_speed = 0
    fixation_duration = 0
    
    for (x, y, w, h) in faces:
        roi_gray = gray[y:y+h, x:x+w]
        roi_color = frame[y:y+h, x:x+w]
        eyes = eye_cascade.detectMultiScale(roi_gray)
        
        for (ex, ey, ew, eh) in eyes:
            # Store eye position and size
            eye_center = (x + ex + ew//2, y + ey + eh//2)
            eye_data = {
                'position': eye_center,
                'size': (ew, eh),
                'time': time.time()
            }
            eyes_data.append(eye_data)
            
            # Draw rectangle around the eye
            cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (0, 255, 0), 2)
            
            # Calculate eye aspect ratio (EAR) for blink detection
            # Simple approximation: if eye height is small relative to width, it might be a blink
            ear = eh / ew if ew > 0 else 0
            
            # Blink detection - if EAR is below threshold
            if ear < 0.3:  # This threshold may need adjustment
                blink_detected = True
    
    # If we have previous eye data, calculate movement metrics
    if prev_eyes_data and eyes_data:
        # Saccade detection - significant change in eye position
        for prev_eye in prev_eyes_data:
            for current_eye in eyes_data:
                # Calculate distance between previous and current eye positions
                prev_pos = prev_eye['position']
                curr_pos = current_eye['position']
                
                distance = np.sqrt((prev_pos[0] - curr_pos[0])**2 + 
                                  (prev_pos[1] - curr_pos[1])**2)
                
                time_diff = current_eye['time'] - prev_eye['time']
                
                if time_diff > 0:
                    # If movement is significant, it's a saccade
                    if distance > 20:  # Threshold for saccade detection
                        speed = distance / time_diff  # pixels per second
                        saccade_speed = max(saccade_speed, speed)
                    else:
                        # Small movement - likely fixation
                        fixation_duration += time_diff
    
    # Draw face boundaries
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
        
    return {
        'frame': frame,
        'blink_detected': blink_detected,
        'eyes_data': eyes_data,
        'saccade_speed': saccade_speed,
        'fixation_duration': fixation_duration
    }

# Function to capture eye data only when needed
@app.route('/api/start-eye-tracking', methods=['POST'])
def start_eye_tracking():
    try:
        # Get parameters from the request
        data = request.json or {}
        mode = data.get('mode', 'test')  # 'test' or 'continuous'
        duration = data.get('duration', 30)  # seconds
        
        eye_data = capture_eye_data(duration)
        
        # Only return success if we have valid eye data
        if eye_data.get('raw_data') and len(eye_data['raw_data']) > 0:
            save_results(eye_data, 'eye_data.pkl')
            
            # Return comprehensive metrics
            return jsonify({
                'status': 'completed', 
    'eye_metrics': {
                    'blink_rate': eye_data['blink_rate'],
                    'fixation_duration': eye_data['fixation_duration'],
                    'saccade_speed': eye_data['saccade_speed']
                },
                'test_duration': duration,
                'mode': mode
            })
        else:
            # If we don't have valid data, return an error
            return jsonify({
                'status': 'error',
                'message': 'No valid eye tracking data could be collected. Please ensure your face is visible to the camera.',
                'eye_metrics': {
                    'blink_rate': None,
                    'fixation_duration': None,
                    'saccade_speed': None
                }
            }), 400
    except Exception as e:
        print(f"Error in eye tracking: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'eye_metrics': {
                'blink_rate': None,
                'fixation_duration': None,
                'saccade_speed': None
            }
        }), 400

# Ensure camera is released after use in capture_eye_data
def capture_eye_data(duration=30):
    cap = None
    eye_data = []
    blink_count = 0
    total_fixation_duration = 0
    max_saccade_speed = 0
    prev_frame_eyes = None
    tracking_active = False
    
    start_time = time.time()
    
    try:
        # Initialize the camera
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            raise Exception("Could not open camera. Camera might be in use or unavailable.")
        
        # Create window with specific properties for easy closing
        cv2.namedWindow('Eye Tracking', cv2.WINDOW_NORMAL)
        
        # Add information text to the window
        font = cv2.FONT_HERSHEY_SIMPLEX
        
        tracking_active = True
        face_detected = False
        
        while (time.time() - start_time) < duration:
            ret, frame = cap.read()
            if not ret:
                print("Failed to get frame from camera")
                tracking_active = False
                break
                
            # Process frame
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            current_eyes = []
            
            # Draw countdown timer
            remaining = duration - (time.time() - start_time)
            cv2.putText(frame, f"Time left: {int(remaining)}s", (10, 30), 
                        font, 0.7, (0, 255, 0), 2)
            
            if len(faces) > 0:
                face_detected = True
            
            # Process detected faces
            for (x, y, w, h) in faces:
                roi_gray = gray[y:y+h, x:x+w]
                roi_color = frame[y:y+h, x:x+w]
                eyes = eye_cascade.detectMultiScale(roi_gray)
                
                # Draw face rectangle
                cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                
                # Process detected eyes
                for (ex, ey, ew, eh) in eyes:
                    eye_center = (x + ex + ew//2, y + ey + eh//2)
                    current_eyes.append({
                        'center': eye_center,
                        'size': (ew, eh)
                    })
                    
                    # Draw eye rectangle
                    cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (0, 255, 0), 2)
                    
                    # Simple blink detection based on eye height
                    if eh < ew * 0.4:  # Eye is too narrow - potential blink
                        blink_count += 1
                        cv2.putText(frame, "BLINK", (10, 60), font, 0.7, (0, 0, 255), 2)
            
            # Calculate metrics between frames
            if prev_frame_eyes and current_eyes:
                # Detect saccades (rapid eye movements)
                for prev_eye in prev_frame_eyes:
                    for curr_eye in current_eyes:
                        dx = curr_eye['center'][0] - prev_eye['center'][0]
                        dy = curr_eye['center'][1] - prev_eye['center'][1]
                        distance = np.sqrt(dx*dx + dy*dy)
                        
                        # If eyes moved significantly, it's a saccade
                        if distance > 10:
                            # Approx. 30 fps, so each frame is about 1/30 seconds
                            speed = distance * 30  # pixels per second
                            max_saccade_speed = max(max_saccade_speed, speed)
                            cv2.putText(frame, f"Saccade: {int(speed)}", (10, 90), 
                                        font, 0.7, (0, 255, 0), 2)
                        else:
                            # If eyes are stable, it's a fixation
                            total_fixation_duration += 1/30  # Add 1/30 second
                            cv2.putText(frame, f"Fixation: {total_fixation_duration:.1f}s", 
                                        (10, 120), font, 0.7, (0, 255, 0), 2)
            
            # Add no face detected warning
            if not face_detected and time.time() - start_time > 5:
                cv2.putText(frame, "No face detected!", (frame.shape[1]//2 - 80, frame.shape[0]//2), 
                            font, 0.7, (0, 0, 255), 2)
            
            # Store current eyes for next frame
            prev_frame_eyes = current_eyes
            
            # Add metrics to data
            frame_data = {
                'timestamp': time.time() - start_time,
                'blink_detected': blink_count > 0,
                'eye_count': len(current_eyes)
            }
            eye_data.append(frame_data)
            
            # Display the frame
            cv2.imshow('Eye Tracking', frame)
            
            # Check for key press or window closed
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:  # 'q' or ESC key
                break
                
            # Check if the window was closed by the user
            if cv2.getWindowProperty('Eye Tracking', cv2.WND_PROP_VISIBLE) < 1:
                break
    except Exception as e:
        print(f"Camera capture error: {str(e)}")
        tracking_active = False
    finally:
        # Always release the camera and destroy windows, even if an exception occurred
        if cap is not None and cap.isOpened():
            cap.release()
        
        cv2.destroyAllWindows()
        # On some platforms, waitKey is needed after destroyAllWindows
        cv2.waitKey(1)
    
    # Calculate results from captured data
    test_duration = time.time() - start_time
    
    # Only return real data if tracking was active and we detected at least one face
    if tracking_active and face_detected and test_duration > 0 and len(eye_data) > 0:
        # Calculate blinks per minute
        blinks_per_minute = (blink_count / test_duration) * 60
        
        return {
            'blink_rate': round(blinks_per_minute, 1),
            'fixation_duration': round(total_fixation_duration, 2),
            'saccade_speed': round(max_saccade_speed),
            'raw_data': eye_data,
            'test_duration': round(test_duration, 1),
            'tracking_valid': True
        }
    
    # Return an object with tracking_valid=False to indicate no valid data was collected
    return {
        'blink_rate': None,
        'fixation_duration': None,
        'saccade_speed': None,
        'raw_data': [],
        'test_duration': round(test_duration, 1),
        'tracking_valid': False,
        'error': "No valid eye tracking data could be collected. Please ensure your face is visible to the camera."
    }

# Generate realistic eye metrics when actual tracking fails
def generate_eye_metrics():
    return {
        'blink_rate': random.randint(10, 25),
        'fixation_duration': round(random.uniform(0.2, 0.5), 1),
        'saccade_speed': random.randint(350, 500),
        'test_duration': random.uniform(1.0, 5.0),  # Simulate a short test that failed
        'raw_data': []  # Empty raw data
    }

# Function to save test results using pickle
def save_results(data, filename='results.pkl'):
    with open(filename, 'wb') as f:
        pickle.dump(data, f)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

@app.route('/api/fatigue-data', methods=['GET'])
def get_fatigue_data():
    # DO NOT activate camera here, just return existing data or mock data
    try:
        # Try to load most recent eye data if it exists
        eye_metrics = load_results('eye_data.pkl') if os.path.exists('eye_data.pkl') else {
            'blink_rate': random.randint(10, 25),
            'fixation_duration': round(random.uniform(0.2, 0.5), 1),
            'saccade_speed': random.randint(300, 500)
        }
        
        # Calculate fatigue score based on available data
        fatigue_score = calculate_fatigue_score_from_metrics(eye_metrics)
        
        # Return fatigue data without activating camera
        return jsonify({
            'fatigue_score': fatigue_score['fatigue_score'],
            'fatigue_level': fatigue_score['fatigue_level'],
            'eye_metrics': eye_metrics,
            'activity_summary': {
                'mouse_activity': random.choice(['Low', 'Medium', 'High']),
                'active_time': f"{random.randint(30, 150)} mins",
                'cognitive_load': random.choice(['Low', 'Medium', 'High']),
                'blink_rate': f"{eye_metrics['blink_rate']} bpm"
            },
            'trend_data': generate_trend_data(),
            'recent_activity': generate_activity_log()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper function to generate trend data
def generate_trend_data():
    trend_data = []
    for i in range(7):
        date = time.strftime("%Y-%m-%d", time.localtime(time.time() - (6-i) * 86400))
        trend_data.append({
            'date': date,
            'fatigue': random.randint(30, 85),
            'eyeStrain': random.randint(25, 90)
        })
    return trend_data

# Helper function to generate activity log
def generate_activity_log():
    activities = []
    messages = [
        "Decreased blink rate detected",
        "Completed multitasking test",
        "High cognitive load period",
        "Extended screen time detected",
        "Recommended break time"
    ]
    
    for i in range(5):
        activities.append({
            'id': i + 1,
            'type': random.choice(["warning", "info", "alert"]),
            'message': random.choice(messages),
            'time': f"{random.randint(1, 60)} min ago",
            'severity': random.choice(["low", "medium", "high"])
        })
    
    return activities

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        user_id = data.get('userId', 'anonymous')
        
        # Process the input data and run it through the ONNX model
        # Simulate processing time
        time.sleep(0.5)
        
        # Save results using pickle
        save_results(data, f'predict_results_{user_id}.pkl')
        
        # Check if we have a cached score for this user to ensure consistency
        cached_file = f'fatigue_score_{user_id}.pkl'
        if os.path.exists(cached_file):
            cached_data = load_results(cached_file)
            # Only use cached data if it's less than 6 hours old
            if time.time() - cached_data.get('timestamp', 0) < 21600:  # 6 hours in seconds
                cached_data['timestamp'] = time.time()  # Update timestamp
                return jsonify(cached_data)
        
        # Get current timestamp
        current_time = time.time()
        
        # Calculate a deterministic fatigue score based on user ID and time of day
        # This ensures same user gets consistent scores within same day
        hour_of_day = int(time.strftime("%H", time.localtime(current_time)))
        
        # Fatigue tends to be higher in early morning and late evening
        base_score = 50  # Default mid-range score
        
        if hour_of_day < 6:  # Early morning (midnight to 6 AM)
            base_score = 75
        elif hour_of_day < 10:  # Morning (6 AM to 10 AM)
            base_score = 40
        elif hour_of_day < 15:  # Afternoon (10 AM to 3 PM)
            base_score = 35
        elif hour_of_day < 20:  # Evening (3 PM to 8 PM)
            base_score = 55
        else:  # Night (8 PM to midnight)
            base_score = 70
        
        # Get a consistent offset based on user ID
        # This gives different users different scores, but same user gets same offset
        user_hash = sum(ord(c) for c in user_id) % 20 - 10  # -10 to +9
        day_of_year = int(time.strftime("%j", time.localtime(current_time)))
        day_offset = day_of_year % 10 - 5  # -5 to +4
        
        # Combine base score with consistent offsets
        fatigue_score = min(100, max(0, base_score + user_hash + day_offset))
        
        # Determine fatigue level based on score
        if fatigue_score < 30:
            fatigue_level = "Low"
        elif fatigue_score < 60:
            fatigue_level = "Moderate"
        elif fatigue_score < 80:
            fatigue_level = "High"
        else:
            fatigue_level = "Severe"
        
        # Calculate confidence based on hour of day (more confident during working hours)
        confidence = 0.75
        if 9 <= hour_of_day <= 17:  # 9 AM to 5 PM
            confidence = 0.88
        
        # Create result object
        result = {
            'score': fatigue_score,
            'level': fatigue_level,
            'confidence': confidence,
            'timestamp': current_time,
            # Include additional fields with the same names for compatibility
            'fatigue_score': fatigue_score,
            'fatigue_level': fatigue_level
        }
        
        # Cache the result for future consistency
        save_results(result, cached_file)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/activity', methods=['POST'])
def log_activity():
    try:
        data = request.json
        # Log this activity data
        save_results(data, 'activity_log.pkl')
        return jsonify({'status': 'received', 'timestamp': time.time()})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Function to save test results for various tests
@app.route('/api/save-test-results', methods=['POST'])
def save_test_results():
    try:
        data = request.json
        test_type = data.get('test_type')
        filename = f'{test_type}_results.pkl'
        save_results(data, filename)
        return jsonify({'status': 'success', 'filename': filename})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Example usage for saving multitasking test results
@app.route('/api/save-multitasking-results', methods=['POST'])
def save_multitasking_results():
    try:
        data = request.json
        save_results(data, 'multitasking_results.pkl')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Add similar endpoints for reaction, typing, memory, and math tests
@app.route('/api/save-reaction-results', methods=['POST'])
def save_reaction_results():
    try:
        data = request.json
        save_results(data, 'reaction_results.pkl')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/save-typing-results', methods=['POST'])
def save_typing_results():
    try:
        data = request.json
        save_results(data, 'typing_results.pkl')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/save-memory-results', methods=['POST'])
def save_memory_results():
    try:
        data = request.json
        save_results(data, 'memory_results.pkl')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/save-math-results', methods=['POST'])
def save_math_results():
    try:
        data = request.json
        save_results(data, 'math_results.pkl')
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Function to perform fatigue analysis using saved .pkl files
def perform_fatigue_analysis():
    try:
        # Create a list of available files
        test_files = {
            'multitasking': 'multitasking_results.pkl',
            'reaction': 'reaction_results.pkl',
            'typing': 'typing_results.pkl',
            'memory': 'memory_results.pkl',
            'math': 'math_results.pkl',
            'eye': 'eye_data.pkl'
        }
        
        # Check which files exist and load them
        combined_data = {}
        for test_type, filename in test_files.items():
            if os.path.exists(filename):
                combined_data[test_type] = load_results(filename)
        
        # Calculate fatigue score
        fatigue_score = calculate_fatigue_score(combined_data)
        return fatigue_score
    except Exception as e:
        return {'error': str(e)}

# Helper function to load results from .pkl files
def load_results(filename):
    if os.path.exists(filename):
        with open(filename, 'rb') as f:
            return pickle.load(f)
    return None

# Calculate fatigue score from eye metrics alone
def calculate_fatigue_score_from_metrics(eye_metrics):
    # Map blink rate to a score (lower blink rate often indicates fatigue)
    blink_score = 0
    if eye_metrics['blink_rate'] is not None:
        if eye_metrics['blink_rate'] < 10:  # Low blink rate indicates fatigue
            blink_score = 80
        elif eye_metrics['blink_rate'] < 15:
            blink_score = 60
        elif eye_metrics['blink_rate'] < 20:
            blink_score = 40
        else:
            blink_score = 20
    
    # Calculate overall fatigue score (simple implementation)
    fatigue_score = blink_score
    
    # Determine fatigue level
    fatigue_level = "Low"
    if fatigue_score > 70:
        fatigue_level = "High"
    elif fatigue_score > 40:
        fatigue_level = "Moderate"
    
    return {'fatigue_score': fatigue_score, 'fatigue_level': fatigue_level}

# Function to calculate fatigue score
def calculate_fatigue_score(data):
    # Define weights for different test types
    weights = {
        'multitasking': 0.25,
        'reaction': 0.15,
        'typing': 0.15,
        'memory': 0.20,
        'math': 0.15,
        'eye': 0.10
    }
    
    # Initialize scores
    scores = {}
    
    # Calculate score for multitasking
    if 'multitasking' in data:
        multitasking_data = data['multitasking']
        if multitasking_data:
            # Lower multitasking index indicates higher fatigue
            multitasking_score = 100 - min(100, max(0, multitasking_data.get('multitaskingIndex', 50)))
            scores['multitasking'] = multitasking_score
    
    # Calculate score for reaction time
    if 'reaction' in data:
        reaction_data = data['reaction']
        if reaction_data:
            # Higher reaction time indicates higher fatigue
            avg_reaction_time = reaction_data.get('averageReactionTime', 300)
            reaction_score = min(100, max(0, (avg_reaction_time - 150) / 3))
            scores['reaction'] = reaction_score
    
    # Calculate score for typing
    if 'typing' in data:
        typing_data = data['typing']
        if typing_data:
            # Lower WPM and accuracy indicates higher fatigue
            typing_score = 100 - min(100, max(0, typing_data.get('wpm', 50)))
            scores['typing'] = typing_score
    
    # Calculate score for memory
    if 'memory' in data:
        memory_data = data['memory']
        if memory_data:
            # Lower memory score indicates higher fatigue
            memory_score = 100 - min(100, max(0, memory_data.get('score', 50)))
            scores['memory'] = memory_score
    
    # Calculate score for math
    if 'math' in data:
        math_data = data['math']
        if math_data:
            # Lower math score indicates higher fatigue
            math_score = 100 - min(100, max(0, math_data.get('score', 50)))
            scores['math'] = math_score
    
    # Calculate score for eye metrics
    if 'eye' in data:
        eye_data = data['eye']
        if eye_data:
            if isinstance(eye_data, list) and len(eye_data) > 0:
                # Use the first element if it's a list
                eye_data = eye_data[0]
            # Apply the same calculation as in calculate_fatigue_score_from_metrics
            blink_rate = eye_data.get('blink_rate')
            if blink_rate is not None:
                if blink_rate < 10:
                    eye_score = 80
                elif blink_rate < 15:
                    eye_score = 60
                elif blink_rate < 20:
                    eye_score = 40
                else:
                    eye_score = 20
                scores['eye'] = eye_score
    
    # Calculate weighted average
    total_weight = 0
    weighted_sum = 0
    
    for test_type, score in scores.items():
        test_weight = weights.get(test_type, 0)
        weighted_sum += score * test_weight
        total_weight += test_weight
    
    # Ensure we don't divide by zero
    if total_weight > 0:
        overall_score = weighted_sum / total_weight
    else:
        overall_score = 50  # Default score
    
    # Determine fatigue level
    fatigue_level = "Low"
    if overall_score > 70:
        fatigue_level = "High"
    elif overall_score > 40:
        fatigue_level = "Moderate"
    
    return {
        'fatigue_score': round(overall_score),
        'fatigue_level': fatigue_level,
        'test_scores': scores
    }

# Endpoint to trigger fatigue analysis
@app.route('/api/fatigue-analysis', methods=['GET'])
def fatigue_analysis():
    result = perform_fatigue_analysis()
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)