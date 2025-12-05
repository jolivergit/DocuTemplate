import { useState } from "react";
import { Trash2, Loader2, Variable, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FieldValueDialog } from "./field-value-dialog";
import type { FieldValue } from "@shared/schema";

interface ManageFieldValuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageFieldValuesDialog({
  open,
  onOpenChange,
}: ManageFieldValuesDialogProps) {
  const { toast } = useToast();
  const [fieldValueToDelete, setFieldValueToDelete] = useState<FieldValue | null>(null);
  const [fieldValueToEdit, setFieldValueToEdit] = useState<FieldValue | null>(null);
  const [showAddFieldValue, setShowAddFieldValue] = useState(false);

  const { data: fieldValues = [] } = useQuery<FieldValue[]>({
    queryKey: ["/api/field-values"],
    enabled: open,
  });

  const deleteFieldValueMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/field-values/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-values"] });
      toast({
        title: "Field value deleted",
        description: "The field value has been removed.",
      });
      setFieldValueToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete field value",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh]"
          data-testid="dialog-manage-field-values"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle data-testid="text-manage-field-values-title">
                  Manage Field Values
                </DialogTitle>
                <DialogDescription data-testid="text-manage-field-values-description">
                  Create and manage reusable field values for template tags like {"{{company_name}}"}.
                </DialogDescription>
              </div>
              <Button
                onClick={() => setShowAddFieldValue(true)}
                data-testid="button-add-field-value"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {fieldValues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Variable
                  className="w-12 h-12 mb-4 text-muted-foreground"
                  data-testid="icon-no-field-values"
                />
                <p
                  className="text-sm font-medium mb-1"
                  data-testid="text-no-field-values-title"
                >
                  No field values yet
                </p>
                <p
                  className="text-xs text-muted-foreground mb-4"
                  data-testid="text-no-field-values-description"
                >
                  Create field values to store reusable data for your templates
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowAddFieldValue(true)}
                  data-testid="button-add-field-value-empty"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Field
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {fieldValues.map((fieldValue) => (
                  <div
                    key={fieldValue.id}
                    className="p-3 rounded-lg border hover-elevate"
                    data-testid={`card-field-value-${fieldValue.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code
                            className="text-sm font-mono bg-muted px-2 py-0.5 rounded"
                            data-testid={`text-field-value-name-${fieldValue.id}`}
                          >
                            {`{{${fieldValue.name}}}`}
                          </code>
                        </div>
                        <p
                          className="text-sm text-muted-foreground truncate"
                          data-testid={`text-field-value-value-${fieldValue.id}`}
                        >
                          {fieldValue.value}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFieldValueToEdit(fieldValue)}
                          data-testid={`button-edit-field-value-${fieldValue.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFieldValueToDelete(fieldValue)}
                          disabled={deleteFieldValueMutation.isPending}
                          data-testid={`button-delete-field-value-${fieldValue.id}`}
                        >
                          {deleteFieldValueMutation.isPending &&
                          fieldValueToDelete?.id === fieldValue.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <FieldValueDialog
        open={showAddFieldValue}
        onOpenChange={setShowAddFieldValue}
        fieldValue={null}
      />

      <FieldValueDialog
        open={!!fieldValueToEdit}
        onOpenChange={(open) => !open && setFieldValueToEdit(null)}
        fieldValue={fieldValueToEdit}
      />

      <AlertDialog
        open={!!fieldValueToDelete}
        onOpenChange={(open) => !open && setFieldValueToDelete(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-field-value">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field Value</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{`{{${fieldValueToDelete?.name}}}`}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-field-value">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                fieldValueToDelete && deleteFieldValueMutation.mutate(fieldValueToDelete.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-field-value"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
