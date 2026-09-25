import clsx from "clsx"

type NexusLogoProps = {
  className?: string
  size?: number
  showWordmark?: boolean
}

export function NexusLogo({
  className,
  size = 32,
  showWordmark = false,
}: NexusLogoProps) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="64" height="64" rx="14" fill="#101014" />
        <rect
          x="1"
          y="1"
          width="62"
          height="62"
          rx="13"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2"
        />
        <path
          d="M18 46V18h6.6l14.8 19.4V18H46v28h-6.6L24.6 26.6V46H18z"
          fill="#22d3ee"
        />
      </svg>
      {showWordmark && (
        <span className="text-[15px] font-bold tracking-[0.22em] text-ink">
          NEXUS
        </span>
      )}
    </span>
  )
}

export default NexusLogo
