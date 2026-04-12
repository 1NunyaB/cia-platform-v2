"use client";

import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { CreateCaseDialog } from "@/components/create-case-dialog";
import { cn } from "@/lib/utils";

export function WorkspaceNewCaseButton({
  className,
  size = "sm",
  variant = "default",
  disabled,
  fullWidth,
}: Pick<ButtonProps, "size" | "variant" | "disabled" | "className"> & { fullWidth?: boolean }) {
  return (
    <CreateCaseDialog disabled={disabled}>
      <Button size={size} variant={variant} className={cn(fullWidth && "w-full", "gap-2", className)} disabled={disabled}>
        <Plus className="h-4 w-4" />
        New case
      </Button>
    </CreateCaseDialog>
  );
}
