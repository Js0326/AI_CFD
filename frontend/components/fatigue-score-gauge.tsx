"use client"

import { cn } from "@/lib/utils"

interface FatigueScoreGaugeProps {
  value: number
  className?: string
}

export function FatigueScoreGauge({ value, className }: FatigueScoreGaugeProps) {
  // Calculate the rotation angle based on the value (0-100)
  const rotation = (value / 100) * 180

  // Determine the color based on the value
  const getColor = () => {
    if (value < 30) return "text-green-500"
    if (value < 60) return "text-amber-500"
    if (value < 80) return "text-orange-500"
    return "text-red-500"
  }

  // Determine the label based on the value
  const getLabel = () => {
    if (value < 30) return "Low"
    if (value < 60) return "Moderate"
    if (value < 80) return "High"
    return "Severe"
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Gauge background */}
        <div className="absolute w-48 h-48 rounded-full border-8 border-muted bottom-0"></div>

        {/* Gauge colored sections */}
        <div className="absolute w-48 h-48 rounded-full border-8 border-transparent border-t-green-500 border-l-green-500 bottom-0 rotate-[225deg]"></div>
        <div className="absolute w-48 h-48 rounded-full border-8 border-transparent border-t-amber-500 bottom-0 rotate-[270deg]"></div>
        <div className="absolute w-48 h-48 rounded-full border-8 border-transparent border-t-orange-500 bottom-0 rotate-[315deg]"></div>
        <div className="absolute w-48 h-48 rounded-full border-8 border-transparent border-t-red-500 border-r-red-500 bottom-0 rotate-[360deg]"></div>

        {/* Gauge needle */}
        <div
          className="absolute bottom-0 left-1/2 w-1 h-20 bg-foreground origin-bottom rounded-t-full -translate-x-1/2 transition-transform duration-1000"
          style={{ transform: `translateX(-50%) rotate(${rotation - 90}deg)` }}
        ></div>

        {/* Center point */}
        <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-foreground rounded-full -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="mt-4 text-center">
        <div className={cn("text-4xl font-bold", getColor())}>{value}</div>
        <div className={cn("text-sm font-medium", getColor())}>{getLabel()} Fatigue</div>
      </div>
    </div>
  )
}

