import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging tailwind classes
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProgressBarProps {
  current: number;
  goal: number;
  className?: string;
}

/**
 * Animated progress bar component for fundraising campaigns
 * Features smooth spring-based transitions and a clean percentage display
 */
export function ProgressBar({ current, goal, className }: ProgressBarProps) {
  // Calculate percentage, capped at 100%
  const rawPercentage = goal > 0 ? (current / goal) * 100 : 0;
  const percentage = Math.min(Math.round(rawPercentage), 100);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Progress
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-foreground font-mono">
              {percentage}%
            </span>
            <span className="text-xs text-muted-foreground">
              funded
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Goal
          </span>
          <div className="text-sm font-bold text-primary font-mono">
            ⟠ {goal.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary shadow-inner">
        {/* Progress Fill */}
        <motion.div
          className="h-full rounded-full bg-chart-2 shadow-[0_0_12px_rgba(var(--chart-2),0.3)]"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            type: "spring",
            stiffness: 80,
            damping: 20,
            mass: 1,
            delay: 0.1
          }}
          style={{
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, transparent 100%)'
          }}
        />
        
        {/* Subtle glass effect overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-full border border-white/10" />
      </div>

      {/* Tooltip or additional info if needed */}
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground/70 uppercase tracking-tighter">
        <span>Raised: ⟠ {current.toLocaleString()}</span>
        {percentage >= 100 ? (
          <span className="text-chart-2 font-bold">Goal Reached!</span>
        ) : (
          <span>Remaining: ⟠ {(goal - current > 0 ? goal - current : 0).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
