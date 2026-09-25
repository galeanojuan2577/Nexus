import clsx from "clsx"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md"

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-void font-semibold hover:bg-accent-soft active:brightness-95",
  secondary:
    "border border-line-strong bg-elevated text-ink hover:border-accent/40 hover:text-accent",
  ghost:
    "border border-transparent text-dim hover:bg-elevated hover:text-ink",
  danger:
    "border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300",
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export default Button
