import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { useAuthStatus } from "@/hooks/use-auth";

/**
 * Two things every board/jets query needs, wired up once here rather than
 * repeated per hook:
 *
 * 1. A 401 (session no longer valid — cookie cleared, secret rotated, or the
 *    very rare case of missing the 400-day window) should send the app back
 *    to the login screen, not sit there as a broken/erroring board. Every
 *    query already shares the ["auth", "me"] result via RequireAuth below,
 *    so invalidating it here is enough to flip the whole app back to Login.
 * 2. Retrying a 401 is pointless — it will just 401 again — so it skips the
 *    default retry-with-backoff and fails fast instead, while genuine
 *    network hiccups on other errors still get the normal retries.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status === 401 ? false : failureCount < 3,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    },
  }),
});

/** Gates the board behind the shared team login (see backend/src/lib/auth.ts). */
const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { data, isLoading } = useAuthStatus();

  // Nothing to show yet either way — avoid flashing the login form for a
  // fraction of a second on every page load for people who are already in.
  if (isLoading) return <div className="min-h-screen bg-background" />;

  return data?.authenticated ? children : <Login />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Index />
              </RequireAuth>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
