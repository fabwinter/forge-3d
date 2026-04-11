import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box } from "lucide-react";

const Navbar = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";

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
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link to="/generate">
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
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
