"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") || "light"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-[var(--line)] !bg-[var(--surface)] !text-[var(--ink)] !shadow-[var(--shadow-pop)]",
          description: "!text-[var(--muted)]",
          actionButton: "!bg-[var(--ink)] !text-[var(--bg)]",
          cancelButton: "!bg-[var(--surface-muted)] !text-[var(--muted)]",
        },
      }}
    />
  );
}
