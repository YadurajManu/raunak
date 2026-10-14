"use client";
import { useEffect, useId, useRef } from "react";
export function MediaDialog({
  title,
  children,
  close,
  dirty = false,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  close(): void;
  dirty?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function dismiss() {
    if (!dirty || confirm("Discard your unsaved changes or remaining uploads?"))
      close();
  }
  return (
    <dialog
      ref={ref}
      className={`m-media-dialog ${wide ? "is-wide" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button type="button" aria-label={`Close ${title}`} onClick={dismiss}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
