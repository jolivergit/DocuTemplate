import { Switch, Route, useLocation } from "wouter";
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
import FirmProfilePage from "@/pages/profile-firm";
import ContactProfilePage from "@/pages/profile-contact";
import NotFound from "@/pages/not-found";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { SiGoogle } from "react-icons/si";
import squareLogo from "@assets/studioarchsquare_1778640146834.png";
import headerImg from "@assets/studioarchheader_1778640146833.png";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

function getPageTitle(location: string): string {
  if (location === "/" || location === "") return "Dashboard";
  if (location.startsWith("/projects/")) return "Project";
  if (location === "/projects") return "Projects";
  if (location === "/companies") return "Companies";
  if (location === "/contacts") return "Contacts";
  if (location === "/doc-builder") return "Doc Builder";
  if (location === "/profile/firm") return "Firm";
  if (location === "/profile/contact") return "Contact";
  return "";
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/auth/user"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <img src={squareLogo} alt="Studio PM" className="w-16 h-16 mx-auto mb-4 rounded-md opacity-80 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="h-16 border-b flex-shrink-0 flex items-center justify-between px-4 bg-[#0c0c0c]">
          <img src={headerImg} alt="Studio PM" className="h-full py-1.5 w-auto object-contain object-left" />
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <img src={squareLogo} alt="Studio PM" className="w-20 h-20 mx-auto mb-6 rounded-lg" data-testid="icon-login-logo" />
            <h2 className="text-2xl font-semibold mb-3" data-testid="text-login-title">Welcome to Studio PM</h2>
            <p className="text-sm text-muted-foreground mb-8" data-testid="text-login-description">
              The industries leading project pipeline manager. Track every lead, proposal, project, expense, and invoice from one place.
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

  const [location] = useLocation();
  const pageTitle = getPageTitle(location);

  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0 gap-4 bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {pageTitle && (
                <span className="text-base font-semibold uppercase tracking-widest" data-testid="text-page-title">
                  {pageTitle}
                </span>
              )}
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/projects" component={ProjectsPage} />
              <Route path="/projects/:id" component={ProjectDetailPage} />
              <Route path="/companies" component={CompaniesPage} />
              <Route path="/contacts" component={ContactsPage} />
              <Route path="/doc-builder" component={Home} />
              <Route path="/profile/firm" component={FirmProfilePage} />
              <Route path="/profile/contact" component={ContactProfilePage} />
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
