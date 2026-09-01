import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AuthStatus {
  authenticated: boolean;
}

/**
 * Whether this browser already carries a valid session cookie. The cookie
 * itself never expires in practice (400-day sliding-expiry cookie, refreshed
 * on every authenticated request — see backend/src/lib/auth.ts), so this
 * really only needs to run once per page load. A failure here means the
 * network request itself failed, not "not logged in" (the endpoint always
 * answers 200 with `authenticated: false` for that) — so one retry is worth
 * it, to avoid flashing the login screen at an already-logged-in person over
 * a one-off network hiccup.
 */
export function useAuthStatus() {
  return useQuery<AuthStatus>({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<AuthStatus>("/api/auth/me"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
