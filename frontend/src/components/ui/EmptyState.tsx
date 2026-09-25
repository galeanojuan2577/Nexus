import clsx from "clsx"
import type { ReactNode } from "react"

type EmptyStateProps = {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  tone?: "default" | "success"
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-10 text-center",
        tone === "success"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-line bg-surface",
        className
      )}
    >
      {icon && (
        <div
          className={clsx(
            "mx-auto",
            tone === "success" ? "text-emerald-400" : "text-faint"
          )}
        >
          {icon}
        </div>
      )}
      <p className="mt-3 text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-faint">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export default EmptyState
