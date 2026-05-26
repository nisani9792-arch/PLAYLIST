import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

import { fetchAccessStatus, getOperatorName, setOperatorName, type AccessStatus } from "@/lib/operator";
import { useAppContext } from "@/context/AppContext";

const GATE_ACCESS_CODE = "JUSIC";

type PinLoginResponse = {
  state: "ready" | "locked";
  operatorName: string | null;
  auth?: "session" | "ip";
};

async function pinLogin(params: { pin: string; operatorName: string }): Promise<PinLoginResponse> {
  const res = await fetch("/api/access/pin-login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: params.pin,
      operatorName: params.operatorName,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const message = body.error ?? "PIN לא תקין";
    throw new Error(message);
  }
  return body as PinLoginResponse;
}

export default function LoginGateway() {
  const [location, setLocation] = useLocation();
  const { auth, setAuth } = useAppContext();

  const [gateCode, setGateCode] = useState<string>("");
  const [operatorNameInput, setOperatorNameInput] = useState<string>("");
  const [pin, setPin] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const cachedOperatorName = useMemo(() => getOperatorName(), []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const status = (await fetchAccessStatus()) as AccessStatus;
        if (!mounted) return;
        setAuth(status);

        if (status.state === "ready") {
          setOperatorName(status.operatorName);
          setLocation("/dashboard");
        } else if (status.state === "offline" && status.operatorName) {
          setLocation("/dashboard");
        }
      } catch {
        if (!mounted) return;
        // Server unreachable: keep offline mode if we have a cached operator name.
        if (cachedOperatorName) {
          setAuth({ state: "offline", operatorName: cachedOperatorName });
          setLocation("/dashboard");
        } else {
          setAuth({ state: "locked", operatorName: null });
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    void boot();
    return () => {
      mounted = false;
    };
  }, [cachedOperatorName, setAuth, setLocation]);

  useEffect(() => {
    if (auth.state === "ready" || auth.state === "offline") {
      // Route is controlled by the context auth resolution.
      // If user arrived here directly, push them to the unified dashboard.
      if (location !== "/dashboard" && location !== "/playlist") setLocation("/dashboard");
    }
  }, [auth.state, location, setLocation]);

  useEffect(() => {
    if (!operatorNameInput && cachedOperatorName) setOperatorNameInput(cachedOperatorName);
  }, [cachedOperatorName, operatorNameInput]);

  const canSubmit = !busy && auth.state !== "loading" && auth.state !== "ready";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedGateCode = gateCode.trim().toUpperCase();
    const trimmedOperatorName = operatorNameInput.trim().slice(0, 80);
    const trimmedPin = pin.trim();

    if (trimmedGateCode !== GATE_ACCESS_CODE) {
      setError("קוד כניסה שגוי");
      return;
    }

    if (!trimmedOperatorName || trimmedOperatorName.length < 2) {
      setError("הזן שם מפעיל (לפחות 2 תווים)");
      return;
    }

    if (!trimmedPin) {
      setError("הזן PIN למפעיל");
      return;
    }

    setBusy(true);
    try {
      const result = await pinLogin({ pin: trimmedPin, operatorName: trimmedOperatorName });
      if (result.state !== "ready" || !result.operatorName) {
        throw new Error("לא ניתן להשלים כניסה");
      }

      setOperatorName(result.operatorName);
      setAuth({ state: "ready", operatorName: result.operatorName } as AccessStatus);
      setLocation("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell-bg min-h-[100dvh] w-full flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-xl j-glass-panel j-gradient-border border-primary/15 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-2xl bg-primary/10 border border-primary/20 p-3">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-bold tracking-tight">דף כניסה מאובטח</CardTitle>
              <CardDescription className="text-sm">
                אימות IP, קוד כניסה, ושם מפעיל + PIN — ואז נכנסים ליישום.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {checking && auth.state === "loading" ? (
            <div className="flex items-center justify-center py-10" aria-busy="true">
              <Spinner className="h-6 w-6" />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>כניסה נכשלה</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {auth.state === "offline" && auth.operatorName ? (
            <div className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>אין חיבור לשרת</AlertTitle>
                <AlertDescription>
                  ממשיכים במצב מקומי בשם השמור: <span className="font-semibold">{auth.operatorName}</span>
                </AlertDescription>
              </Alert>

              <Button
                className="w-full rounded-full"
                onClick={() => setLocation("/dashboard")}
                disabled={busy}
              >
                <CheckCircle2 className="h-4 w-4" />
                כניסה למצב Offline
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gateCode">Gate Access Code</Label>
                <Input
                  id="gateCode"
                  value={gateCode}
                  onChange={(e) => setGateCode(e.target.value)}
                  placeholder="JUSIC"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={20}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="operatorName">Operator Name</Label>
                <Input
                  id="operatorName"
                  value={operatorNameInput}
                  onChange={(e) => setOperatorNameInput(e.target.value)}
                  placeholder="שם מפעיל"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={80}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="pin">Operator PIN</Label>
                  <Badge variant="outline">ה-PIN נבדק בשרת</Badge>
                </div>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={32}
                  disabled={busy}
                />
              </div>

              <Button
                className="w-full rounded-full"
                type="submit"
                disabled={!canSubmit || !gateCode.trim() || !operatorNameInput.trim() || !pin.trim()}
              >
                {busy ? "מאמת..." : "כניסה למערכת"}
              </Button>

              <div className="text-center text-xs text-secondary pt-1">
                סטטוס IP:{" "}
                <span className="font-semibold">
                  {auth.state === "locked"
                    ? "נעול"
                    : auth.state === "register"
                      ? "נדרש רישום"
                      : auth.state === "offline"
                        ? "Offline"
                        : "Ready"}
                </span>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

