"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useValidatedAction } from "./use-validated-action";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * A button that posts hidden fields to a server action. With `confirm`, a
 * dialog asks for confirmation first (used for destructive actions).
 */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  showMessage = true,
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  confirm?: { title: string; description: string; confirmLabel?: string };
  showMessage?: boolean;
  className?: string;
}) {
  const { state, pending, formProps } = useValidatedAction(action);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const hidden = Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className={className}>
      <form ref={formRef} {...formProps} className="inline">
        {hidden}
        {confirm ? (
          <AlertDialog.Root open={open} onOpenChange={setOpen}>
            <AlertDialog.Trigger asChild>
              <Button type="button" variant={variant} size={size} disabled={pending}>
                {children}
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
              <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-xl">
                <AlertDialog.Title className="text-lg font-bold">{confirm.title}</AlertDialog.Title>
                <AlertDialog.Description className="text-muted mt-2 text-sm">
                  {confirm.description}
                </AlertDialog.Description>
                <div className="mt-5 flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </AlertDialog.Cancel>
                  <Button
                    type="button"
                    variant={variant === "danger" ? "danger" : "primary"}
                    onClick={() => {
                      setOpen(false);
                      formRef.current?.requestSubmit();
                    }}
                  >
                    {confirm.confirmLabel ?? "Confirm"}
                  </Button>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ) : (
          <SubmitButton variant={variant} size={size} pending={pending} pendingText="Working…">
            {children}
          </SubmitButton>
        )}
      </form>
      {showMessage ? (
        <div className="mt-2 empty:hidden" aria-live="polite">
          <FormMessage state={state} />
        </div>
      ) : null}
    </div>
  );
}
