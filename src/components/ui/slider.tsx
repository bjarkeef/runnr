"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
    value: number[]
    min: number
    max: number
    step?: number
    onValueChange: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, value, min, max, step = 1, onValueChange, ...props }, ref) => {
        const [localValue, setLocalValue] = React.useState(value)

        React.useEffect(() => {
            setLocalValue(value)
        }, [value])

        const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = Math.min(parseFloat(e.target.value), localValue[1] - step)
            const nextValues = [newValue, localValue[1]]
            setLocalValue(nextValues)
            onValueChange(nextValues)
        }

        const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = Math.max(parseFloat(e.target.value), localValue[0] + step)
            const nextValues = [localValue[0], newValue]
            setLocalValue(nextValues)
            onValueChange(nextValues)
        }

        const minPercentage = ((localValue[0] - min) / (max - min)) * 100
        const maxPercentage = ((localValue[1] - min) / (max - min)) * 100

        return (
            <div className={cn("relative flex w-full touch-none select-none items-center h-5", className)}>
                {/* Track Background */}
                <div className="absolute w-full h-2 rounded-full bg-secondary overflow-hidden z-10">
                    {/* Active Range */}
                    <div
                        className="absolute h-full bg-primary"
                        style={{ left: `${minPercentage}%`, right: `${100 - maxPercentage}%` }}
                    />
                </div>

                {/* Inputs */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue[0]}
                    onChange={handleMinChange}
                    className={cn(
                        "absolute w-full h-full appearance-none bg-transparent pointer-events-none z-20",
                        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform",
                        "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:transition-transform"
                    )}
                    {...props}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue[1]}
                    onChange={handleMaxChange}
                    className={cn(
                        "absolute w-full h-full appearance-none bg-transparent pointer-events-none z-20",
                        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform",
                        "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:transition-transform"
                    )}
                    {...props}
                />
            </div>
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
