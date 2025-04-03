// API service module for backend communication

interface FatigueData {
  fatigue_score: number | null;
  fatigue_level: string | null;
  eye_metrics: {
    blink_rate: number | null;
    fixation_duration: number | null;
    saccade_speed: number | null;
  } | null;
  activity_summary: {
    mouse_activity: string | null;
    active_time: string | null;
    cognitive_load: string | null;
    blink_rate: string | null;
  } | null;
  trend_data: {
    date: string;
    fatigue: number;
    eyeStrain: number;
  }[] | null;
  recent_activity: {
    id: number;
    type: string;
    message: string;
    time: string;
    severity: string;
  }[] | null;
}

class ApiService {
  private baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch:', error);
      throw new Error(`Failed to connect to API at ${this.baseUrl}${endpoint}. Please check if the backend server is running.`);
    }
  }

  public async checkApiHealth(): Promise<boolean> {
    try {
      await this.request('/api/health');
      return true;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }

  public async getFatigueData(): Promise<FatigueData> {
    try {
      return await this.request<FatigueData>('/api/fatigue-data');
    } catch (error) {
      console.error('Failed to fetch fatigue data:', error);
      throw error;
    }
  }

  public async submitTestResults(testType: string, results: any): Promise<void> {
    try {
      await this.request(`/api/tests/${testType}`, {
        method: 'POST',
        body: JSON.stringify(results),
      });
    } catch (error) {
      console.error(`Failed to submit ${testType} test results:`, error);
      throw error;
    }
  }

  public async predictFatigue(features: any): Promise<any> {
    try {
      return await this.request<any>('/api/predict', {
        method: 'POST',
        body: JSON.stringify(features),
      });
    } catch (error) {
      console.error('Failed to predict fatigue:', error);
      throw error;
    }
  }
}

const apiService = new ApiService();
export default apiService;

// Export types for TypeScript module resolution
export type { FatigueData, ApiService };