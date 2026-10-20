import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="text-6xl font-bold text-muted-foreground/40">404</p>
      <h1 className="text-xl font-bold text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: "default" }))}>
        Back to dashboard
      </Link>
    </div>
  );
}
