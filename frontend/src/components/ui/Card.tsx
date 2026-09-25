import clsx from "clsx"
import type { HTMLAttributes, ReactNode } from "react"

type CardProps = HTMLAttributes<HTMLDivElement> & {
  pad?: boolean
  children: ReactNode
}

export function Card({ pad = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-line bg-surface",
        pad && "p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className,
  icon,
}: {
  children: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <h3
      className={clsx(
        "flex items-center gap-2 text-sm font-semibold text-ink",
        className
      )}
    >
      {icon}
      {children}
    </h3>
  )
}

export default Card
