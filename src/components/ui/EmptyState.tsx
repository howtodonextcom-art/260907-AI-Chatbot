import { LabMark } from "@/components/ui/LabMark";

export function EmptyState(props: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`lab-empty mx-auto flex max-w-md flex-col items-center text-center ${
        props.compact ? "gap-2 py-6" : "gap-3 py-10"
      }`}
    >
      <LabMark size={props.compact ? 36 : 48} />
      <p
        className={props.compact ? "text-base" : "text-lg"}
        style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
      >
        {props.title}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {props.description}
      </p>
    </div>
  );
}
