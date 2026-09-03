import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FleslandMark } from "@/components/board/FleslandMark";
import { SplitFlapText } from "@/components/board/SplitFlapText";
import { api, ApiError } from "@/lib/api";

/**
 * Single shared team login — one username/password for everyone, deliberately
 * simple (see backend/src/lib/auth.ts). On success the backend sets a
 * 400-day sliding-expiry cookie that refreshes on every authenticated
 * request, so this screen is normally a one-time thing per device.
 *
 * Styled dark (bg-board-deep) to match the always-dark split-flap board
 * itself, with the signage-yellow "plate" accent (see index.css --plate)
 * on the logo mark and the submit button, echoing the yellow header plates
 * on the board.
 */
const Login = () => {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/login", { username, password });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Kunne ikke logge inn. Prøv igjen."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-board-deep px-5">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center text-center">
          <FleslandMark className="h-10 w-10 text-plate" />
          <h1 className="mt-4 flex justify-center">
            <SplitFlapText
              value="FLESLAND"
              width={8}
              className="flap-title text-[1.65rem] text-flap-ink"
              ariaLabel="Flesland"
            />
          </h1>
          <p className="mt-2 font-signage text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Bergen lufthavn · Inn og ut av Schengen
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="font-signage text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Brukernavn
            </Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="font-signage text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Passord
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? (
            <div className="flex items-start gap-2.5 border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting || !username || !password}
            className="mt-1 bg-plate text-plate-ink hover:bg-plate/90 font-signage text-[12px] uppercase tracking-[0.14em]"
          >
            {submitting ? "Logger inn…" : "Logg inn"}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default Login;
