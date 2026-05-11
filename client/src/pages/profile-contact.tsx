import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile } from "@shared/schema";

const contactSchema = z.object({
  contactName: z.string().optional().nullable(),
  contactTitle: z.string().optional().nullable(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactProfilePage() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const r = await fetch("/api/profile");
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load profile");
      return r.json();
    },
  });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { contactName: "", contactTitle: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        contactName: profile.contactName ?? "",
        contactTitle: profile.contactTitle ?? "",
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      // Merge with existing firm fields so we don't wipe them
      const merged = {
        name: profile?.name ?? "",
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
        addressLine1: profile?.addressLine1 ?? null,
        addressLine2: profile?.addressLine2 ?? null,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        zip: profile?.zip ?? null,
        contactName: values.contactName,
        contactTitle: values.contactTitle,
      };
      const saved = await apiRequest("PATCH", "/api/profile", merged);
      const savedProfile: Profile = await saved.json();

      // Sync contact field values to Doc Builder
      const contactFields = [
        { name: "firm_contact_name", value: savedProfile.contactName || "" },
        { name: "firm_contact_title", value: savedProfile.contactTitle || "" },
      ];
      await Promise.all(
        contactFields.filter((f) => f.value).map((f) =>
          fetch("/api/field-values/upsert-by-name", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(f),
          })
        )
      );
      return savedProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/field-values"] });
      toast({ title: "Contact info saved", description: "Synced to Doc Builder field values." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-contact-title">Contact</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Primary contact person — appears on proposals and documents.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Primary Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="contactName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Oliver" data-testid="input-contact-name" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contactTitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Principal Architect" data-testid="input-contact-title" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-contact">
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
