"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, disabled, checked, onCheckedChange, ...props }, ref) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onCheckedChange) {
            onCheckedChange(e.target.checked)
        }
    }

    return (
      <div className="relative inline-flex items-center justify-center align-middle">
          <input
            type="checkbox"
            className={cn(
              "peer h-4 w-4 appearance-none shrink-0 rounded-sm border border-slate-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-slate-900 checked:text-slate-50",
              className
            )}
            ref={ref}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            {...props}
          />
          <Check className="absolute h-3 w-3 text-white pointer-events-none hidden peer-checked:block" />
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
