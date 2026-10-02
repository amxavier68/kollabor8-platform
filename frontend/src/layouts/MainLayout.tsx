import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Sun, Moon, LayoutDashboard, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider"; // new small hook for theme toggling
import { cn } from "@/lib/utils"; // if you have a className merge helper
import { NavLink } from "react-router-dom";

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col transition-colors duration-300",
        "bg-background text-foreground"
      )}
    >
      <nav
        className={cn(
          "border-b border-border/50 backdrop-blur-sm sticky top-0 z-20",
          "bg-card/70"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side — Brand */}
            <div className="flex items-center gap-5">
              <h1 className="text-xl font-bold text-primary">Kollabor8 Platform</h1>
              <div className="hidden md:flex items-center gap-1">
                <NavLink to="/dashboard" className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-slate-100")}>
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </NavLink>
                {(user?.role === "admin" || user?.role === "developer") && (
                  <NavLink to="/operations" className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-slate-100")}>
                    <LifeBuoy className="h-4 w-4" /> Operations Control
                  </NavLink>
                )}
              </div>
            </div>

            {/* Right side — User + Controls */}
            <div className="flex items-center space-x-3">
              {user && (
                <span className="text-sm text-muted-foreground">
                  Hey, {user.name}
                </span>
              )}

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </Button>

              {/* Logout */}
              <Button
                variant="destructive"
                size="sm"
                className="flex items-center space-x-1"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page body */}
      <main className="flex-1 max-w-7xl mx-auto w-full py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
