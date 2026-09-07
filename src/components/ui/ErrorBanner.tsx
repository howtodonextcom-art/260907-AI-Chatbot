"use client";

export function ErrorBanner(props: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
      style={{ background: "#3a221e", color: "#f0c2ba" }}
      role="alert"
    >
      <span>{props.message}</span>
      {props.onRetry ? (
        <button
          type="button"
          onClick={props.onRetry}
          className="underline underline-offset-2"
        >
          Đóng
        </button>
      ) : null}
    </div>
  );
}
