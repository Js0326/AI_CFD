"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ArrowRight, Brain, Clock, Eye, MousePointer, Camera, AlertCircle, 
  CheckCircle, Keyboard, Activity, Calculator, Layers, ArrowUp, ArrowDown, 
  BarChart3, ChevronDown, ExternalLink, AlertTriangle, Info, X
} from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { FatigueScoreGauge } from "@/components/fatigue-score-gauge"
import { FatigueChart } from "@/components/fatigue-chart"
import { ActivityLog } from "@/components/activity-log"
import { EyeTrackingTest } from "@/components/eye-tracking-test"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTestResults } from "@/lib/test-utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// Types for backend data
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

// Test Result Interfaces
interface TypingTestResult {
  wpm: number;
  accuracy: number;
  totalChars: number;
  errors: number;
  timestamp: string;
}

interface ReactionTestResult {
  averageReactionTime: number;
  fastestReaction: number;
  slowestReaction: number;
  completedRounds: number;
  timestamp: string;
}

interface MemoryTestResult {
  score: number;
  correctSequences: number;
  longestSequence: number;
  timestamp: string;
}

interface MathTestResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  averageTime: number;
  timestamp: string;
}

interface EyeTrackingResult {
  blink_rate: number;
  fixation_duration: number;
  saccade_speed: number;
  timestamp: string;
}

interface MultitaskingTestResult {
  score: number;
  targetsClicked: number;
  equationsSolved: number;
  accuracy: number;
  averageReactionTime: number;
  multitaskingIndex: number;
  timestamp: string;
}

interface TestResults {
  typing?: TypingTestResult;
  reaction?: ReactionTestResult;
  memory?: MemoryTestResult;
  math?: MathTestResult;
  "eye-tracking"?: EyeTrackingResult;
  multitasking?: MultitaskingTestResult;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FatigueData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiAvailable, setApiAvailable] = useState(true)
  const [eyeTrackingActive, setEyeTrackingActive] = useState(false)
  const [eyeTrackingStatus, setEyeTrackingStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle')
  const [showEyeTrackingDialog, setShowEyeTrackingDialog] = useState(false)
  
  // Use refs to store tracker instances
  const activityTrackerRef = useRef<any>(null);
  const eyeTrackingSimulatorRef = useRef<any>(null);
  const apiServiceRef = useRef<any>(null);

  // Function to generate mock data when backend is unavailable
  const generateMockData = (): FatigueData => {
    return {
      fatigue_score: Math.floor(Math.random() * 100),
      fatigue_level: ["Low", "Moderate", "High"][Math.floor(Math.random() * 3)],
      eye_metrics: {
        blink_rate: Math.floor(Math.random() * 20) + 10,
        fixation_duration: parseFloat((Math.random() * 0.5 + 0.1).toFixed(1)),
        saccade_speed: Math.floor(Math.random() * 200) + 300
      },
      activity_summary: {
        mouse_activity: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
        active_time: `${Math.floor(Math.random() * 120) + 30} mins`,
        cognitive_load: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
        blink_rate: `${Math.floor(Math.random() * 15) + 10} bpm`
      },
      trend_data: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString().split('T')[0],
          fatigue: Math.floor(Math.random() * 100),
          eyeStrain: Math.floor(Math.random() * 100)
        };
      }),
      recent_activity: Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        type: ["warning", "info", "alert"][Math.floor(Math.random() * 3)],
        message: [
          "Decreased blink rate detected",
          "Completed multitasking test",
          "High cognitive load period",
          "Extended screen time detected",
          "Recommended break time"
        ][Math.floor(Math.random() * 5)],
        time: `${Math.floor(Math.random() * 60)} min ago`,
        severity: ["low", "medium", "high"][Math.floor(Math.random() * 3)]
      }))
    };
  };

  // Initialize trackers but NEVER start eye tracking automatically
  useEffect(() => {
    let isMounted = true;
    
    const initializeTrackers = async () => {
      try {
        // Only import activity tracker and API service initially
        const { default: activityTracker } = await import('@/lib/activity-tracker')
        const { default: apiService } = await import('@/lib/api-service')
        
        // Store references
        activityTrackerRef.current = activityTracker;
        apiServiceRef.current = apiService;
        
        // Check if API is available
        let isApiAvailable = false;
        
        try {
          isApiAvailable = await apiService.checkApiHealth()
        } catch (error) {
          console.log('API health check failed, using mock data')
          isApiAvailable = false;
        }
        
        if (isMounted) {
          setApiAvailable(isApiAvailable)
          
          // Start activity tracking regardless of API availability
          activityTracker?.startTracking()
          
          // Now that we have the API service initialized, fetch the data
          fetchData(apiService, isApiAvailable);
        }
      } catch (err) {
        console.log('Failed to initialize trackers, using mock data')
        if (isMounted) {
          setApiAvailable(false)
          // If we couldn't initialize the services, still fetch mock data
          fetchData(null, false);
        }
      }
    }
    
    initializeTrackers()
    
    // Cleanup function
    return () => {
      isMounted = false;
      
      const cleanup = async () => {
        try {
          if (activityTrackerRef.current) {
            await activityTrackerRef.current.stopTracking();
          }
          // Only cleanup eye tracking if it was started
          if (eyeTrackingSimulatorRef.current && eyeTrackingActive) {
            await eyeTrackingSimulatorRef.current.stop();
            setEyeTrackingActive(false);
          }
        } catch (err) {
          console.log('Error during cleanup');
        }
      };
      
      cleanup();
    };
  }, [])

  // Function to start eye tracking only when explicitly requested
  const startEyeTracking = async () => {
    setShowEyeTrackingDialog(true)
  }

  // Handle eye tracking test completion
  const handleEyeTrackingComplete = async (testResults: any) => {
    // Update dashboard with new eye tracking data
    if (testResults) {
      await fetchData(apiServiceRef.current, apiAvailable);
    }
    setEyeTrackingStatus('completed');
    setEyeTrackingActive(false);
  }

  // Handle eye tracking test error
  const handleEyeTrackingError = (error: Error) => {
    console.error('Eye tracking test error:', error);
    setEyeTrackingStatus('error');
    setEyeTrackingActive(false);
  }

  // Fetch data from API or generate mock data
  const fetchData = async (apiService = apiServiceRef.current, isApiAvailable = apiAvailable) => {
    try {
      setLoading(true)
      setError(null)
      
      if (!isApiAvailable) {
        // If API is not available, use mock data
        setTimeout(() => {
          const mockData = generateMockData();
          setData(mockData);
          setLoading(false)
          setError("API service is currently unavailable. Using simulated data.")
        }, 1000)
        return
      }
      
      // Use the provided apiService reference to fetch data
      if (apiService) {
        try {
          const fatigueData = await apiService.getFatigueData() as FatigueData;
          setData(fatigueData)
          setLoading(false)
        } catch (error) {
          // If API call fails, use mock data
          const mockData = generateMockData();
          setData(mockData);
          setLoading(false)
          setError("Failed to fetch data from server. Using simulated data.")
        }
      } else {
        // If apiService is not available yet, use mock data
        const mockData = generateMockData();
        setData(mockData);
        setLoading(false)
        setError("API service not initialized. Using simulated data.")
      }
    } catch (err) {
      // Final fallback to mock data
      const mockData = generateMockData();
      setData(mockData);
      setLoading(false)
      setError("Failed to load dashboard data. Using simulated data.")
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your cognitive fatigue levels and eye tracking metrics</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={startEyeTracking} 
            disabled={eyeTrackingActive}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            {eyeTrackingStatus === 'idle' && 'Run Eye Tracking'}
            {eyeTrackingStatus === 'running' && 'Running...'}
            {eyeTrackingStatus === 'completed' && 'Run Again'}
            {eyeTrackingStatus === 'error' && 'Try Again'}
          </Button>
          <Button asChild>
            <Link href="/tests">
              Take Fatigue Test <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {eyeTrackingStatus === 'running' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Eye tracking in progress</AlertTitle>
          <AlertDescription>
            Please look at the camera while we collect eye data. This will take a few seconds.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Current Fatigue Score</CardTitle>
                <CardDescription>Based on recent activity and eye tracking</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center items-center py-6">
                {data?.fatigue_score !== null && data?.fatigue_score !== undefined ? (
                  <FatigueScoreGauge value={data.fatigue_score} />
                ) : (
                  <div className="text-center">
                    <div className="text-5xl font-bold mb-2">--</div>
                    <div className="text-sm text-muted-foreground">No data available</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Eye Tracking Metrics</CardTitle>
                <CardDescription>Last 30 minutes of activity</CardDescription>
              </CardHeader>
              <CardContent className="py-6">
                {data?.eye_metrics ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Blink Rate</span>
                        <span className="font-medium">{data.eye_metrics.blink_rate ?? '--'} {data.eye_metrics.blink_rate ? 'blinks/min' : ''}</span>
                      </div>
                      <Progress value={data.eye_metrics.blink_rate ? data.eye_metrics.blink_rate * 3 : 0} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Fixation Duration</span>
                        <span className="font-medium">{data.eye_metrics.fixation_duration ? `${data.eye_metrics.fixation_duration.toFixed(1)} sec` : '--'}</span>
                      </div>
                      <Progress value={data.eye_metrics.fixation_duration ? data.eye_metrics.fixation_duration * 20 : 0} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Saccade Speed</span>
                        <span className="font-medium">{data.eye_metrics.saccade_speed ?? '--'}</span>
                      </div>
                      <Progress value={data.eye_metrics.saccade_speed ?? 0} className="h-2" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Blink Rate</span>
                        <span className="font-medium">--</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Fixation Duration</span>
                        <span className="font-medium">--</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Saccade Speed</span>
                        <span className="font-medium">--</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                    
                    {eyeTrackingStatus === 'idle' && (
                      <Button onClick={startEyeTracking} variant="secondary" className="w-full mt-2">
                        <Camera className="mr-2 h-4 w-4" />
                        Run Eye Tracking
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Activity Summary</CardTitle>
                <CardDescription>Today's monitoring data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-6">
                {data?.activity_summary ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MousePointer className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Mouse Activity</span>
                      </div>
                      <span className="font-medium">{data.activity_summary.mouse_activity ?? '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Active Time</span>
                      </div>
                      <span className="font-medium">{data.activity_summary.active_time ?? '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Brain className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Cognitive Load</span>
                      </div>
                      <span className="font-medium">{data.activity_summary.cognitive_load ?? '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Blink Rate</span>
                      </div>
                      <span className="font-medium">{data.activity_summary.blink_rate ?? '--'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MousePointer className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Mouse Activity</span>
                      </div>
                      <span className="font-medium">--</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Active Time</span>
                      </div>
                      <span className="font-medium">--</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Brain className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Cognitive Load</span>
                      </div>
                      <span className="font-medium">--</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Blink Rate</span>
                      </div>
                      <span className="font-medium">--</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Fatigue Trend</CardTitle>
                <CardDescription>7-day fatigue score history</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {data?.trend_data?.length ? (
                  <FatigueChart data={data.trend_data} />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No historical data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>System monitoring events</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {data?.recent_activity?.length ? (
                  <ActivityLog activities={data.recent_activity} />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-muted-foreground">No activity data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={showEyeTrackingDialog} onOpenChange={setShowEyeTrackingDialog}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">Eye Tracking Test</DialogTitle>
          <EyeTrackingTest
            onComplete={handleEyeTrackingComplete}
            onError={handleEyeTrackingError}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-60 mt-1" />
            </CardHeader>
            <CardContent className="py-6">
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

