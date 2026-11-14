import { useRef } from "react";
import { createPickerDismissGuard } from "@/lib/google-picker-lifecycle";

export function useGooglePickerDialog(onOpenChange: (open: boolean) => void) {
  const guard = useRef(createPickerDismissGuard()).current;
  return {
    onPickerOpenChange: guard.setActive,
    dialogProps: {
      onOpenChange: (open: boolean) => { if (open || !guard.isActive()) onOpenChange(open); },
    },
    contentProps: {
      onInteractOutside: guard.preventDismiss,
      onEscapeKeyDown: guard.preventDismiss,
    },
  };
}
