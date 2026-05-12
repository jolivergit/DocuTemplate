import { Link, useLocation } from "wouter";
import { FileText, Briefcase, Compass, Users, Building2, User, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { User as UserType } from "@shared/schema";

const navItems = [
  { title: "Dashboard", url: "/", icon: Compass, exact: true },
  { title: "Projects", url: "/projects", icon: Briefcase, exact: false },
  { title: "Companies", url: "/companies", icon: Building2, exact: false },
  { title: "Contacts", url: "/contacts", icon: Users, exact: false },
  { title: "Doc Builder", url: "/doc-builder", icon: FileText, exact: false },
];

const settingsItems = [
  { title: "Firm", url: "/profile/firm", icon: Building2 },
  { title: "Contact", url: "/profile/contact", icon: User },
];

interface AppSidebarProps {
  user?: UserType | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();

  // Only the single most-specific matching nav item should be active
  const loc = location || "/";
  const activeNavUrl = [...navItems]
    .filter(item => item.exact ? loc === item.url : loc.startsWith(item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  const activeSettingUrl = [...settingsItems]
    .filter(item => loc === item.url || loc.startsWith(item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium uppercase tracking-widest">Studio PM</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={item.url === activeNavUrl}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span className="tracking-wide uppercase">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-3">
        <SidebarSeparator />

        {/* Settings section */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={item.url === activeSettingUrl}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span className="tracking-wide uppercase">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User identity + sign out */}
        {user && (
          <>
            <SidebarSeparator />
            <div className="px-3 pt-3 pb-1 space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={user.picture || undefined} alt={user.name} />
                  <AvatarFallback className="text-xs">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate" data-testid="text-sidebar-user">
                  {user.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-xs text-muted-foreground px-1"
                onClick={() => { window.location.href = "/auth/logout"; }}
                data-testid="button-logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            </div>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
