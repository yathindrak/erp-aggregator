"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAction } from "next-safe-action/hooks";
import { createClient } from "@/actions/client.actions";

interface Client {
  id: string;
  name: string;
}

export function ClientCreationModal({
  open,
  onCreated,
  cancellable = false,
  onOpenChange,
}: {
  open: boolean;
  onCreated: (client: Client) => void;
  cancellable?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { executeAsync } = useAction(createClient);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Client name cannot be empty.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await executeAsync({ name: name.trim() });

      if (res?.serverError || res?.validationErrors) {
        setError(res.serverError || "Failed to create client.");
      } else if (res?.data) {
        onCreated(res.data as Client);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        // Prevent closing by clicking outside or pressing Escape if not cancellable
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => {
          if (!cancellable) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (!cancellable) e.preventDefault();
        }}
        showCloseButton={cancellable}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Welcome to Taxxa
          </DialogTitle>
          <DialogDescription className="text-center">
            Create your client workspace to get started.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label className="font-medium text-sm" htmlFor="client-name-input">
              Client name
            </Label>
            <Input
              className="h-10"
              disabled={loading}
              id="client-name-input"
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Acme Corp, Maria Hansen AS…"
              ref={inputRef}
              value={name}
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>
          <Button
            className="h-10 w-full gap-2"
            disabled={loading || !name.trim()}
            id="create-client-submit-btn"
            type="submit"
          >
            {loading && <IconLoader2 className="h-4 w-4 animate-spin" />}
            Create workspace
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
