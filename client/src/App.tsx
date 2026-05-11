import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Home from "@/pages/home";
import DashboardPage from "@/pages/dashboard";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import ContactsPage from "@/pages/contacts";
import CompaniesPage from "@/pages/companies";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { SiGoogle } from "react-icons/si";
import { FolderKanban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/auth/user"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Studio PM</h1>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <FolderKanban className="w-16 h-16 mx-auto mb-6 text-primary" data-testid="icon-login-logo" />
            <h2 className="text-2xl font-semibold mb-3" data-testid="text-login-title">Welcome to Studio PM</h2>
            <p className="text-sm text-muted-foreground mb-8" data-testid="text-login-description">
              Oliver Studios' project pipeline manager. Track every lead, proposal, project, and invoice from one place.
            </p>
            <Button
              variant="default"
              size="default"
              onClick={() => { window.location.href = "/auth/google"; }}
              className="gap-2"
              data-testid="button-google-login"
            >
              <SiGoogle className="w-4 h-4" />
              Sign in with Google
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

function AppLayout() {
  const { data: user } = useQuery<User | null>({
    queryKey: ["/auth/user"],
    retry: false,
  });

  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0 gap-2 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.picture || undefined} alt={user?.name || "User"} />
                  <AvatarFallback className="text-xs">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm hidden lg:inline text-muted-foreground" data-testid="text-user-name">
                  {user?.name || user?.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { window.location.href = "/auth/logout"; }}
                title="Sign out"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/projects" component={ProjectsPage} />
              <Route path="/projects/:id" component={ProjectDetailPage} />
              <Route path="/companies" component={CompaniesPage} />
              <Route path="/contacts" component={ContactsPage} />
              <Route path="/doc-builder" component={Home} />
              <Route path="/profile" component={ProfilePage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <AuthGate>
      <AppLayout />
    </AuthGate>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
