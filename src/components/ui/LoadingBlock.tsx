export function LoadingBlock(props: { label: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6"
      role="status"
      aria-live="polite"
    >
      <div className="lab-spinner" aria-hidden />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {props.label}
      </p>
    </div>
  );
}
