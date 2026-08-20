import type { ReactNode } from "react";

export type StatusTone = "info" | "success" | "warning" | "error";

export interface StatusMessageProps {
  tone: StatusTone;
  title: string;
  children?: ReactNode;
}

const TONE_LABEL: Record<StatusTone, string> = {
  info: "Info",
  success: "Success",
  warning: "Attention",
  error: "Error",
};

export function StatusMessage({ tone, title, children }: StatusMessageProps) {
  return (
    <section className={`status-message status-message--${tone}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>
      <p className="status-message__eyebrow">{TONE_LABEL[tone]}</p>
      <h2 className="status-message__title">{title}</h2>
      {children ? <div className="status-message__body">{children}</div> : null}
    </section>
  );
}
