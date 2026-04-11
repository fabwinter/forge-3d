import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { user, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Box className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold tracking-tight">MeshForge</span>
        </Link>

        <div className="flex items-center gap-4">
          {isHome ? (
            <>
              {user && (
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
              )}
              <Link to={user ? "/generate" : "/login"}>
                <Button variant="hero" size="sm">Start Creating</Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard">
                <Button variant={location.pathname === "/dashboard" ? "secondary" : "ghost"} size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link to="/generate">
                <Button variant={location.pathname === "/generate" ? "hero" : "hero-outline"} size="sm">
                  New Asset
                </Button>
              </Link>
            </>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-secondary">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="hidden max-w-[140px] truncate sm:block text-muted-foreground">
                    {user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
