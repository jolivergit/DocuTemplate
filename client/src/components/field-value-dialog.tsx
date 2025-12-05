import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertFieldValueSchema, type FieldValue } from "@shared/schema";
import { z } from "zod";
import { useEffect } from "react";

type FormData = z.infer<typeof insertFieldValueSchema>;

interface FieldValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldValue?: FieldValue | null;
  prefilledName?: string;
}

export function FieldValueDialog({ open, onOpenChange, fieldValue, prefilledName }: FieldValueDialogProps) {
  const { toast } = useToast();
  const isEditing = !!fieldValue;

  const form = useForm<FormData>({
    resolver: zodResolver(insertFieldValueSchema),
    defaultValues: {
      name: prefilledName || "",
      value: "",
    },
  });

  useEffect(() => {
    if (fieldValue) {
      form.reset({
        name: fieldValue.name,
        value: fieldValue.value,
      });
    } else {
      form.reset({
        name: prefilledName || "",
        value: "",
      });
    }
  }, [fieldValue, prefilledName, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/field-values", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-values"] });
      toast({
        title: "Field value created",
        description: "Your field value has been saved.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create field value",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("PATCH", `/api/field-values/${fieldValue?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-values"] });
      toast({
        title: "Field value updated",
        description: "Your field value has been saved.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update field value",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-field-value">
        <DialogHeader>
          <DialogTitle data-testid="text-field-value-dialog-title">
            {isEditing ? "Edit Field Value" : "Add Field Value"}
          </DialogTitle>
          <DialogDescription data-testid="text-field-value-dialog-description">
            {isEditing
              ? "Update this field value."
              : "Create a reusable field value for template tags."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., company_name, contact_email"
                      {...field}
                      data-testid="input-field-value-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Acme Corporation"
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-field-value-value"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-field-value"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-field-value">
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Save Field"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
