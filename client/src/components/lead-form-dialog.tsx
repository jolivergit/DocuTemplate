import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LEAD_STATUSES, LEAD_PROBABILITIES, type LeadProbability, type LeadStatus, type LeadWithCompanies } from "@shared/schema";
import { formSchema, buildDefaultCompanies, type FormValues } from "./lead-form/types";
import { CompanyEntry } from "./lead-form/company-entry";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: LeadWithCompanies | null;
}

export function LeadFormDialog({ open, onOpenChange, lead }: Props) {
  const { toast } = useToast();
  const isEditing = !!lead;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: lead?.projectName || "",
      description: lead?.description || "",
      squareFootage: lead?.squareFootage ? String(lead.squareFootage) : "",
      probability: LEAD_PROBABILITIES.includes(lead?.probability as LeadProbability)
        ? (lead!.probability as LeadProbability)
        : "LOW",
      potentialFee: lead?.potentialFee ? String(lead.potentialFee) : "",
      status: LEAD_STATUSES.includes(lead?.status as LeadStatus)
        ? (lead!.status as LeadStatus)
        : "Lead",
      companies: buildDefaultCompanies(lead?.companies),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "companies",
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const companiesPayload = values.companies.map((c) => ({
        companyRole: c.companyRole,
        companyId: c.companyId || null,
        contactId: c.contactId || null,
        companyName: c.companyName || null,
        addressLine1: c.addressLine1 || null,
        addressLine2: c.addressLine2 || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
      }));
      const payload = {
        projectName: values.projectName,
        description: values.description || null,
        squareFootage: values.squareFootage || null,
        probability: values.probability,
        potentialFee: values.potentialFee || null,
        status: values.status,
        companies: companiesPayload,
      };
      if (isEditing) {
        return apiRequest("PATCH", `/api/leads/${lead!.id}`, payload);
      }
      return apiRequest("POST", "/api/leads", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", lead!.id] });
      }
      toast({ title: isEditing ? "Project updated" : "Project created" });
      onOpenChange(false);
      if (!isEditing) form.reset();
    },
    onError: (err: Error) => {
      toast({
        title: isEditing ? "Failed to update project" : "Failed to create project",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function addCompany() {
    append({
      companyRole: "",
      companyId: null,
      contactId: null,
      companyName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0">
          <Form {...form}>
            <form id="lead-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="px-6 py-4 pb-8 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Project Details
                </h3>
                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Office Renovation – Acme Corp" data-testid="input-project-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Brief description of the project..." data-testid="input-description" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="squareFootage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="0" data-testid="input-square-footage" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="potentialFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potential Fee ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-potential-fee" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="probability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probability</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-probability">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_PROBABILITIES.map((p) => (
                              <SelectItem key={p} value={p} data-testid={`select-prob-${p}`}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} data-testid={`select-status-${s}`}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Companies
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCompany}
                    data-testid="button-add-company"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Company
                  </Button>
                </div>
                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-md">
                    No companies added yet. Click "Add Company" to get started.
                  </p>
                )}
                {fields.map((field, index) => (
                  <CompanyEntry
                    key={field.id}
                    index={index}
                    form={form}
                    onRemove={() => remove(index)}
                  />
                ))}
              </div>
            </form>
          </Form>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => { onOpenChange(false); if (!isEditing) form.reset(); }}
            data-testid="button-cancel-lead"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="lead-form"
            disabled={mutation.isPending}
            data-testid="button-submit-lead"
          >
            {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
