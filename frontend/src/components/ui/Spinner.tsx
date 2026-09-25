import clsx from "clsx"

export function Spinner({
  size = 20,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={clsx(
        "inline-block animate-spin rounded-full border-2 border-accent/25 border-t-accent",
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-faint">
      <Spinner size={28} />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

export default Spinner
