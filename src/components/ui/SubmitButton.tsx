"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";

export function SubmitButton({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "navy" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {children}
    </Button>
  );
}
