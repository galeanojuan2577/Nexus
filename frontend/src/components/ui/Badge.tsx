import clsx from "clsx"

export type Severity = "critical" | "high" | "medium" | "low" | "info" | "pass"

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
  info: "Informativo",
  pass: "Sin hallazgos",
}

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

export const severityPill: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/15 text-red-400",
  high: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  medium: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
  low: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  info: "border-sky-500/30 bg-sky-500/15 text-sky-400",
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
}

export const severityBar: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-emerald-500",
  info: "border-l-sky-500",
  pass: "border-l-emerald-500",
}

export const statusPill: Record<string, string> = {
  online: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  offline: "border-red-500/30 bg-red-500/10 text-red-400",
  unknown: "border-line-strong bg-elevated text-faint",
}

type SeverityBadgeProps = {
  severity?: string | null
  label?: string
  size?: "xs" | "sm"
}

export function SeverityBadge({
  severity,
  label,
  size = "sm",
}: SeverityBadgeProps) {
  const key = severity ?? "pass"
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide",
        severityPill[key] ?? severityPill.info,
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      )}
    >
      {label ?? SEVERITY_LABEL[key] ?? key}
    </span>
  )
}

export function StatusBadge({
  status,
  label,
}: {
  status: string
  label?: string
}) {
  const key = status?.toLowerCase?.() ?? "unknown"
  const pill =
    key in statusPill
      ? statusPill[key]
      : key === "active"
        ? statusPill.online
        : key === "disabled" || key === "failed"
          ? statusPill.offline
          : statusPill.unknown
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        pill
      )}
    >
      {label ?? status}
    </span>
  )
}

export function NeutralBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border border-line bg-elevated px-2 py-0.5 font-mono text-[11px] text-dim",
        className
      )}
    >
      {children}
    </span>
  )
}

export default SeverityBadge
