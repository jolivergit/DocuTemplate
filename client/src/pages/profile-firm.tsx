import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile } from "@shared/schema";

const firmSchema = z.object({
  name: z.string().min(1, "Firm name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
});

type FirmFormValues = z.infer<typeof firmSchema>;

export default function FirmProfilePage() {
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

  const form = useForm<FirmFormValues>({
    resolver: zodResolver(firmSchema),
    defaultValues: { name: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        addressLine1: profile.addressLine1 ?? "",
        addressLine2: profile.addressLine2 ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        zip: profile.zip ?? "",
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FirmFormValues) => {
      // Merge with existing contact fields so we don't wipe them
      const merged = {
        name: values.name,
        phone: values.phone,
        email: values.email,
        addressLine1: values.addressLine1,
        addressLine2: values.addressLine2,
        city: values.city,
        state: values.state,
        zip: values.zip,
        contactName: profile?.contactName ?? null,
        contactTitle: profile?.contactTitle ?? null,
      };
      const savedProfile: Profile = await apiRequest<Profile>("PATCH", "/api/profile", merged);

      // Sync firm field values to Doc Builder
      const firmFields = [
        { name: "firm_name", value: savedProfile.name || "" },
        { name: "firm_address", value: [savedProfile.addressLine1, savedProfile.addressLine2].filter(Boolean).join(", ") },
        { name: "firm_city", value: savedProfile.city || "" },
        { name: "firm_state", value: savedProfile.state || "" },
        { name: "firm_zip", value: savedProfile.zip || "" },
        { name: "firm_phone", value: savedProfile.phone || "" },
        { name: "firm_email", value: savedProfile.email || "" },
      ];
      await Promise.all(
        firmFields.filter((f) => f.value).map((f) =>
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
      toast({ title: "Firm info saved", description: "Synced to Doc Builder field values." });
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
          <Skeleton className="h-64 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-firm-title">Firm</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Studio name, phone, email, and address — used in proposals and documents.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Firm Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firm Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Oliver Studios" data-testid="input-firm-name" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 000-0000" data-testid="input-firm-phone" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="hello@oliverstudios.com" data-testid="input-firm-email" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="addressLine1" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Studio Lane" data-testid="input-address-line1" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="addressLine2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Suite 200" data-testid="input-address-line2" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" data-testid="input-city" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" data-testid="input-state" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="zip" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" data-testid="input-zip" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-firm">
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
