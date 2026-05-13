import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FileText, Briefcase, LayoutDashboard, Users, Building2, User, LogOut, Settings, ChevronDown } from "lucide-react";
import headerImgLight from "@assets/studioarchheader_1778640146833.png";
import headerImgDark from "@assets/studioarchheaderdark_1778640849637.png";
import { useTheme } from "@/hooks/use-theme";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { User as UserType } from "@shared/schema";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Projects", url: "/projects", icon: Briefcase, exact: false },
  { title: "Companies", url: "/companies", icon: Building2, exact: false },
  { title: "Contacts", url: "/contacts", icon: Users, exact: false },
];

const settingsItems = [
  { title: "Firm", url: "/profile/firm", icon: Building2 },
  { title: "Contact", url: "/profile/contact", icon: User },
  { title: "Doc Builder", url: "/doc-builder", icon: FileText },
];

interface AppSidebarProps {
  user?: UserType | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(true);

  const loc = location || "/";
  const activeNavUrl = [...navItems]
    .filter(item => item.exact ? loc === item.url : loc.startsWith(item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  const theme = useTheme();
  const headerImg = theme === "dark" ? headerImgDark : headerImgLight;

  const activeSettingUrl = [...settingsItems]
    .filter(item => loc === item.url || loc.startsWith(item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  return (
    <Sidebar>
      <SidebarHeader className="border-b overflow-hidden">
        <img
          src={headerImg}
          alt="Studio PM"
          className="w-full h-20 object-contain object-left"
        />
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

        {/* Settings section — collapsible */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SidebarGroup className="py-1">
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex items-center justify-between w-full cursor-pointer select-none hover:text-foreground transition-colors">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3 h-3" />
                  Settings
                </div>
                <ChevronDown
                  className="w-3 h-3 transition-transform duration-200"
                  style={{ transform: settingsOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

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
