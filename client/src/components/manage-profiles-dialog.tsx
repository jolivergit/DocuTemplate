import { useState } from "react";
import { Trash2, Loader2, Building2, Edit2, Plus, MapPin, Phone, Mail } from "lucide-react";
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
import { ProfileDialog } from "./profile-dialog";
import type { Profile } from "@shared/schema";

interface ManageProfilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageProfilesDialog({
  open,
  onOpenChange,
}: ManageProfilesDialogProps) {
  const { toast } = useToast();
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [profileToEdit, setProfileToEdit] = useState<Profile | null>(null);
  const [showAddProfile, setShowAddProfile] = useState(false);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
    enabled: open,
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Field set deleted",
        description: "The field set has been removed.",
      });
      setProfileToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete field set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatAddress = (profile: Profile) => {
    const parts = [];
    if (profile.addressLine1) parts.push(profile.addressLine1);
    if (profile.addressLine2) parts.push(profile.addressLine2);
    const cityStateZip = [profile.city, profile.state, profile.zip]
      .filter(Boolean)
      .join(", ");
    if (cityStateZip) parts.push(cityStateZip);
    return parts.join(" ");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh]"
          data-testid="dialog-manage-profiles"
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle data-testid="text-manage-fields-title">
                  Manage Fields
                </DialogTitle>
                <DialogDescription data-testid="text-manage-fields-description">
                  Create and manage reusable company and client field sets for your
                  documents.
                </DialogDescription>
              </div>
              <Button
                onClick={() => setShowAddProfile(true)}
                data-testid="button-add-field"
              >
                <Plus className="w-4 h-4" />
                Add Field Set
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2
                  className="w-12 h-12 mb-4 text-muted-foreground"
                  data-testid="icon-no-fields"
                />
                <p
                  className="text-sm font-medium mb-1"
                  data-testid="text-no-fields-title"
                >
                  No field sets yet
                </p>
                <p
                  className="text-xs text-muted-foreground mb-4"
                  data-testid="text-no-fields-description"
                >
                  Create field sets to store company and client information for your
                  templates
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowAddProfile(true)}
                  data-testid="button-add-field-empty"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Field Set
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-4 rounded-lg border hover-elevate"
                    data-testid={`card-profile-${profile.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-medium text-base mb-1"
                          data-testid={`text-profile-name-${profile.id}`}
                        >
                          {profile.name}
                        </h3>
                        {(profile.contactName || profile.contactTitle) && (
                          <p
                            className="text-sm text-muted-foreground mb-2"
                            data-testid={`text-profile-contact-${profile.id}`}
                          >
                            {[profile.contactName, profile.contactTitle]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {(profile.addressLine1 ||
                            profile.city ||
                            profile.state) && (
                            <span
                              className="flex items-center gap-1"
                              data-testid={`text-profile-address-${profile.id}`}
                            >
                              <MapPin className="w-3 h-3" />
                              {formatAddress(profile) || "No address"}
                            </span>
                          )}
                          {profile.phone && (
                            <span
                              className="flex items-center gap-1"
                              data-testid={`text-profile-phone-${profile.id}`}
                            >
                              <Phone className="w-3 h-3" />
                              {profile.phone}
                            </span>
                          )}
                          {profile.email && (
                            <span
                              className="flex items-center gap-1"
                              data-testid={`text-profile-email-${profile.id}`}
                            >
                              <Mail className="w-3 h-3" />
                              {profile.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setProfileToEdit(profile)}
                          data-testid={`button-edit-profile-${profile.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setProfileToDelete(profile)}
                          disabled={deleteProfileMutation.isPending}
                          data-testid={`button-delete-profile-${profile.id}`}
                        >
                          {deleteProfileMutation.isPending &&
                          profileToDelete?.id === profile.id ? (
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

      <ProfileDialog
        open={showAddProfile}
        onOpenChange={setShowAddProfile}
        profile={null}
      />

      <ProfileDialog
        open={!!profileToEdit}
        onOpenChange={(open) => !open && setProfileToEdit(null)}
        profile={profileToEdit}
      />

      <AlertDialog
        open={!!profileToDelete}
        onOpenChange={(open) => !open && setProfileToDelete(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-field">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field Set</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{profileToDelete?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-field">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                profileToDelete && deleteProfileMutation.mutate(profileToDelete.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-field"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
