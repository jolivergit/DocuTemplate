import { Link, useLocation } from "wouter";
import { FileText, Briefcase, LayoutDashboard, Users, Building2, Settings } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User } from "@shared/schema";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Briefcase,
    exact: false,
  },
  {
    title: "Companies",
    url: "/companies",
    icon: Building2,
    exact: false,
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Users,
    exact: false,
  },
  {
    title: "Doc Builder",
    url: "/doc-builder",
    icon: FileText,
    exact: false,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: Settings,
    exact: false,
  },
];

interface AppSidebarProps {
  user?: User | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs font-medium uppercase tracking-widest">Studio PM</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location === item.url || location === ""
                  : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span className="tracking-wide uppercase">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center justify-between gap-2">
          {user && (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={user.picture || undefined} alt={user.name} />
                <AvatarFallback className="text-xs">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground truncate" data-testid="text-sidebar-user">
                {user.name}
              </span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
