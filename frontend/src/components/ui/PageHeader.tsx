import clsx from "clsx"
import type { ReactNode } from "react"

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-faint">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export default PageHeader
