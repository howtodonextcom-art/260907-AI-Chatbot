/** SVG mark: decision nodes → judgment — visual identity for Decision Lab */
export function LabMark(props: {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const size = props.size ?? 40;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={props.className}
      aria-hidden={props["aria-hidden"] ?? true}
    >
      <rect
        x="4"
        y="8"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <rect
        x="4"
        y="30"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <rect
        x="30"
        y="19"
        width="14"
        height="10"
        rx="2"
        stroke="var(--accent)"
        strokeWidth="1.75"
        fill="color-mix(in oklab, var(--accent) 18%, transparent)"
      />
      <path
        d="M18 13H24C26 13 28 15 28 17V24C28 26 26 28 24 28H18"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path
        d="M18 35H24C26 35 28 33 28 31V24"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
}
