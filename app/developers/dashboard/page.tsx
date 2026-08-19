"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  signInWithEmail,
  signUpWithEmail,
  startGoogleSignIn,
  signOut,
  getAuthErrorMessage,
  isFirebaseError,
} from "@/lib/firebase/auth-client";

type PlanKey = "starter" | "growth" | "scale";

interface MeData {
  user: {
    email: string;
    name: string | null;
    plan: PlanKey | null;
    planName: string | null;
    monthlyQuota: number | null;
  };
  apiKey: {
    id: string;
    name: string;
    plainKeyTemp: string | null;
    dailyLimit: number;
    perMinuteLimit: number;
    lastUsedAt: string | null;
  } | null;
  usage: { used: number; limit: number };
}

const PLAN_DETAILS = {
  starter: { label: "Starter", price: "$10/mo", queries: "1,000 queries",  rate: "10 req/min",  planKey: "starter" as PlanKey },
  growth:  { label: "Growth",  price: "$20/mo", queries: "2,500 queries",  rate: "20 req/min",  planKey: "growth" as PlanKey },
  scale:   { label: "Scale",   price: "$50/mo", queries: "10,000 queries", rate: "60 req/min",  planKey: "scale" as PlanKey },
};

type PlanDetails = (typeof PLAN_DETAILS)[PlanKey];

function switchPlanMessage(data: MeData | null, target: PlanDetails): { subject: string; body: string } {
  const currentLabel = data?.user.planName ?? "unknown";
  const email = data?.user.email ?? "";
  const subject = `Switch my Linkpricer API plan: ${currentLabel} → ${target.label}`;
  const body = [
    `Account email: ${email}`,
    `Current plan: ${currentLabel}`,
    `Requested plan: ${target.label} (${target.price}, ${target.queries}/mo, ${target.rate})`,
    "",
    "Please switch my subscription to the plan above.",
  ].join("\n");
  return { subject, body };
}

export default function DeveloperDashboardPage() {
  return (
    <Suspense fallback={<CenteredSpinner />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<MeData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usageRefreshing, setUsageRefreshing] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanKey | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [switchPlanTarget, setSwitchPlanTarget] = useState<PlanDetails | null>(null);
  const [switchSending, setSwitchSending] = useState(false);
  const [switchSendError, setSwitchSendError] = useState("");
  const [switchSent, setSwitchSent] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // fetchMe (initial load), pollForKey (post-checkout polling), and
  // refreshUsage (manual refresh) all hit GET /api/developers/me
  // independently and each used to overwrite `data` wholesale with whatever
  // it got back. With no ordering guarantee between them, a slow response
  // from an earlier call could land after a newer one and stomp fresher
  // state with stale numbers (e.g. usage briefly regressing, or the just-
  // revealed key flipping back to masked). requestSeq tags every outgoing
  // call and setData calls only apply if their tag is still the latest.
  const requestSeq = useRef(0);
  const ackedKeyRef = useRef(false);

  const applyIfLatest = useCallback((seq: number, d: MeData) => {
    if (seq !== requestSeq.current) return; // a newer request has since started — drop this stale response
    setData(d);
  }, []);

  const fetchMe = useCallback(async () => {
    const seq = ++requestSeq.current;
    setDataLoading(true);
    try {
      // Transient 401s happen in clusters (same warm serverless instance
      // failing back-to-back), so retries need real spacing to land on a
      // different instance rather than hitting the same cluster.
      const delays = [1500, 3000, 5000];
      let res = await fetch("/api/developers/me");
      for (const delay of delays) {
        if (res.ok) break;
        await new Promise((r) => setTimeout(r, delay));
        res = await fetch("/api/developers/me");
      }
      if (res.ok) {
        const d: MeData = await res.json();
        applyIfLatest(seq, d);
      }
    } finally {
      setDataLoading(false);
    }
  }, [applyIfLatest]);

  // Poll after checkout until the key appears (webhook is async)
  const pollForKey = useCallback(() => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const seq = ++requestSeq.current;
      const res = await fetch("/api/developers/me");
      if (res.ok) {
        const d: MeData = await res.json();
        applyIfLatest(seq, d);
        if (d.apiKey) return;
      }
      if (attempts < 8) {
        pollingRef.current = setTimeout(poll, 2500);
      }
    };
    pollingRef.current = setTimeout(poll, 2000);
  }, [applyIfLatest]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        } catch {
          // session creation failed — fetchMe will 401 and show login
        }
      }
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Chrome/Safari can restore this page from the back-forward cache (bfcache)
  // on a back-navigation -- repainting the exact signed-in `firebaseUser`
  // state from before the tab was left, without re-running the effect above
  // or re-checking Firebase. That's how "I signed out, then came back to the
  // dashboard and it still showed me logged in" happens. A real reload is the
  // only thing that discards the frozen heap and forces a fresh check.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      if (sessionId) {
        // Fresh from checkout — start polling for the key
        fetchMe();
        pollForKey();
      } else {
        fetchMe();
      }
    }
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [firebaseUser, sessionId, fetchMe, pollForKey]);

  async function refreshUsage() {
    const seq = ++requestSeq.current;
    setUsageRefreshing(true);
    try {
      const res = await fetch("/api/developers/me");
      if (res.ok) {
        const d: MeData = await res.json();
        if (seq !== requestSeq.current) return; // superseded by a newer request — drop
        setData((prev) => prev ? { ...prev, usage: d.usage } : d);
      }
    } finally {
      setUsageRefreshing(false);
    }
  }

  // Once a plaintext key has actually rendered on screen, tell the server it's
  // been shown so it can clear the one-time reveal — deliberately, exactly
  // once, instead of as a side effect of every background /me read.
  useEffect(() => {
    if (data?.apiKey?.plainKeyTemp && !ackedKeyRef.current) {
      ackedKeyRef.current = true;
      fetch("/api/developers/ack-key-reveal", { method: "POST" }).catch(() => {
        ackedKeyRef.current = false; // allow retry on the next render if the ack failed
      });
    }
  }, [data?.apiKey?.plainKeyTemp]);

  async function handleSignOut() {
    await signOut();
    setFirebaseUser(null);
    setData(null);
  }

  async function regenerateKey() {
    ackedKeyRef.current = false; // the new key will need its own reveal acked once shown
    setRegenerating(true);
    try {
      const res = await fetch("/api/developers/regenerate-key", { method: "POST" });
      if (res.ok) {
        await fetchMe();
      } else {
        const { error } = await res.json();
        alert(error ?? "Could not regenerate key.");
      }
    } finally {
      setRegenerating(false);
    }
  }

  async function openBillingPortal() {
    if (!firebaseUser) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/developers/billing-portal", { method: "POST" });
      const { url, error } = await res.json();
      if (url) window.location.href = url;
      else alert(error ?? "Could not open billing portal.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function startCheckout(plan: PlanKey) {
    if (!firebaseUser) return;
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/developers/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const { url, error } = await res.json();
      if (url) window.location.href = url;
      else alert(error ?? "Could not start checkout.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (authLoading) return <CenteredSpinner />;
  if (!firebaseUser) return <SignUpView onAuth={setFirebaseUser} />;
  if (dataLoading && !data) return <CenteredSpinner />;

  const usagePct = data ? Math.min(100, Math.round((data.usage.used / (data.usage.limit || 1)) * 100)) : 0;
  const currentPlanKey = data?.user.plan ?? null;
  const maskedKey = "lp_live_" + "•".repeat(24);

  return (
    <>
      <style>{`
        .db-wrap { max-width: 960px; margin: 0 auto; padding: 40px 32px 80px; }
        .db-success-banner { background: #dcfce7; border: 1px solid #86efac; border-radius: 10px; padding: 14px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; font-size: 14px; color: #166534; font-weight: 600; }
        .db-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 36px; }
        .db-welcome { font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.4px; }
        .db-welcome span { color: #6b7280; font-weight: 500; font-size: 14px; margin-left: 8px; }
        .db-plan-badge { background: #e6f2ff; color: #0052cc; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; }
        .db-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .db-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }
        .db-card-full { grid-column: 1 / -1; }
        .db-card-label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 16px; }
        .db-key-row { display: flex; align-items: center; gap: 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 9px; padding: 12px 14px; }
        .db-key-text { flex: 1; font-family: "JetBrains Mono", monospace; font-size: 13px; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .db-key-btn { padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; border: 1px solid #e5e7eb; background: #fff; color: #374151; cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0; }
        .db-key-btn:hover { background: #f3f4f6; }
        .db-key-btn.primary { background: #0052cc; color: #fff; border-color: #0052cc; }
        .db-key-btn.primary:hover { background: #003a99; }
        .db-key-btn.success { background: #dcfce7; color: #166534; border-color: #86efac; }
        .db-key-warn { font-size: 12px; color: #9ca3af; margin-top: 10px; }
        .db-no-key { text-align: center; padding: 32px; }
        .db-no-key p { color: #6b7280; font-size: 14px; margin-bottom: 20px; }

        .db-refresh-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 2px; border-radius: 4px; display: flex; align-items: center; transition: color 0.15s; }
        .db-refresh-btn:hover { color: #0052cc; }
        .db-refresh-btn.spinning svg { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .db-usage-nums { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
        .db-usage-used { font-size: 28px; font-weight: 900; color: #111827; letter-spacing: -0.5px; }
        .db-usage-limit { font-size: 14px; color: #9ca3af; }
        .db-bar-track { background: #f3f4f6; border-radius: 99px; height: 10px; overflow: hidden; margin-bottom: 10px; }
        .db-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #0052cc, #3b82f6); transition: width 0.6s ease; }
        .db-bar-fill.warn { background: linear-gradient(90deg, #f59e0b, #ef4444); }
        .db-usage-meta { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; }

        .db-billing-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f3f4f6; }
        .db-billing-row:last-child { border-bottom: none; padding-bottom: 0; }
        .db-billing-label { font-size: 13px; color: #6b7280; }
        .db-billing-value { font-size: 13px; font-weight: 600; color: #111827; }
        .db-billing-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #166534; background: #dcfce7; padding: 3px 9px; border-radius: 20px; }
        .db-billing-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #16a34a; display: inline-block; }
        .db-billing-none { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #92400e; background: #fef3c7; padding: 3px 9px; border-radius: 20px; }
        .db-manage-btn { display: flex; align-items: center; gap: 8px; padding: 11px 20px; background: #fff; border: 1.5px solid #0052cc; color: #0052cc; border-radius: 9px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.15s; text-decoration: none; margin-top: 20px; justify-content: center; }
        .db-manage-btn:hover { background: #f0f7ff; }
        .db-manage-btn:disabled { opacity: 0.6; cursor: default; }

        .db-plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .db-plan { border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 20px; position: relative; transition: all 0.15s; }
        .db-plan.current { border-color: #0052cc; background: #f0f7ff; }
        .db-plan-current-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #0052cc; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 20px; white-space: nowrap; }
        .db-plan-name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 2px; }
        .db-plan-price { font-size: 20px; font-weight: 900; color: #111827; letter-spacing: -0.5px; margin-bottom: 6px; }
        .db-plan-queries { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
        .db-plan-rate { font-size: 11px; color: #9ca3af; }
        .db-plan-btn { display: block; margin-top: 14px; padding: 8px; text-align: center; border-radius: 7px; font-size: 12px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; transition: all 0.15s; width: 100%; }
        .db-plan-btn-outline { background: #fff; color: #0052cc; border: 1px solid #0052cc; }
        .db-plan-btn-outline:hover { background: #f0f7ff; }
        .db-plan-btn-disabled { background: #f3f4f6; color: #9ca3af; cursor: default; }
        .db-plan-btn:disabled { opacity: 0.6; cursor: default; }

        .db-logout { font-size: 13px; color: #9ca3af; cursor: pointer; background: none; border: none; font-family: inherit; }
        .db-logout:hover { color: #ef4444; }

        @media (max-width: 768px) {
          .db-grid { grid-template-columns: 1fr; }
          .db-plans-grid { grid-template-columns: 1fr; }
          .db-wrap { padding: 24px 16px 60px; }
          .db-card-full { grid-column: 1; }
        }

        .db-modal-overlay { position: fixed; inset: 0; background: rgba(17,24,39,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
        .db-modal { background: #fff; border-radius: 14px; padding: 28px; max-width: 400px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
        .db-modal h3 { margin: 0 0 10px; font-size: 17px; font-weight: 800; color: #111827; }
        .db-modal p { margin: 0 0 22px; font-size: 14px; color: #6b7280; line-height: 1.5; }
        .db-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .db-modal-btn { padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; }
        .db-modal-btn:hover { background: #f3f4f6; }
        .db-modal-btn.danger { background: #dc2626; border-color: #dc2626; color: #fff; }
        .db-modal-btn.danger:hover { background: #b91c1c; }
        .db-modal-btn.primary { background: #0052cc; border-color: #0052cc; color: #fff; }
        .db-modal-btn.primary:hover { background: #003a99; }
        .db-modal-wide { max-width: 460px; }
        .db-modal-msg { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; font-family: "JetBrains Mono", monospace; font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; color: #111827; margin-bottom: 18px; max-height: 240px; overflow-y: auto; }
      `}</style>

      {switchPlanTarget && (
        <div className="db-modal-overlay" onClick={() => setSwitchPlanTarget(null)}>
          <div className="db-modal db-modal-wide" onClick={(e) => e.stopPropagation()}>
            {switchSent ? (
              <>
                <h3>Request sent</h3>
                <p>We&apos;ve got your request to switch to {switchPlanTarget.label} — our team will follow up by email shortly.</p>
                <div className="db-modal-actions">
                  <button className="db-modal-btn primary" onClick={() => setSwitchPlanTarget(null)}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h3>Switch to {switchPlanTarget.label}</h3>
                <p>Plan changes go through our team right now, not self-service. Send the request below and we&apos;ll follow up by email.</p>
                <div className="db-modal-msg">
                  {`Subject: ${switchPlanMessage(data, switchPlanTarget).subject}\n\n${switchPlanMessage(data, switchPlanTarget).body}`}
                </div>
                {switchSendError && <div className="signup-error" style={{ marginBottom: 16 }}>{switchSendError}</div>}
                <div className="db-modal-actions">
                  <button className="db-modal-btn" onClick={() => setSwitchPlanTarget(null)}>Cancel</button>
                  <button
                    className="db-modal-btn primary"
                    disabled={switchSending}
                    onClick={async () => {
                      const { subject, body } = switchPlanMessage(data, switchPlanTarget);
                      setSwitchSending(true);
                      setSwitchSendError("");
                      try {
                        const res = await fetch("/api/developers/support-request", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ topic: "plan_change", subject, message: body }),
                        });
                        if (res.ok) {
                          setSwitchSent(true);
                        } else {
                          const { error } = await res.json().catch(() => ({ error: null }));
                          setSwitchSendError(error ?? "Could not send request. Please try again.");
                        }
                      } catch {
                        setSwitchSendError("Could not send request. Please try again.");
                      } finally {
                        setSwitchSending(false);
                      }
                    }}
                  >
                    {switchSending ? "Sending…" : "Send request"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmRegen && (
        <div className="db-modal-overlay" onClick={() => setConfirmRegen(false)}>
          <div className="db-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Regenerate API key?</h3>
            <p>This immediately invalidates your current key — anything using it will stop working.</p>
            <div className="db-modal-actions">
              <button className="db-modal-btn" onClick={() => setConfirmRegen(false)}>Cancel</button>
              <button
                className="db-modal-btn danger"
                onClick={() => {
                  setConfirmRegen(false);
                  regenerateKey();
                }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="db-wrap">
        {sessionId && (
          <div className="db-success-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {data?.apiKey ? "Payment successful! Your API key is active." : "Payment successful! Your API key is being generated…"}
          </div>
        )}

        <div className="db-topbar">
          <div>
            <div className="db-welcome">
              {data?.user.name || data?.user.email?.split("@")[0] || "Developer"}
              <span>{data?.user.email || firebaseUser.email}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentPlanKey && (
              <span className="db-plan-badge">{data?.user.planName} plan</span>
            )}
            <button className="db-logout" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        <div className="db-grid">
          {/* API Key */}
          <div className="db-card db-card-full">
            <div className="db-card-label">Your API Key</div>
            {data?.apiKey ? (
              data.apiKey.plainKeyTemp ? (
                <>
                  <div className="db-key-row">
                    {/* The real value only ever leaves the client via the Copy
                        button's clipboard write — it's never rendered as text,
                        so it can't be shoulder-surfed or captured in a
                        screenshot/recording. */}
                    <span className="db-key-text">{maskedKey}</span>
                    <button
                      className={`db-key-btn${copied ? " success" : ""}`}
                      onClick={() => copyKey(data.apiKey!.plainKeyTemp!)}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button className="db-key-btn" onClick={() => setConfirmRegen(true)} disabled={regenerating}>
                      {regenerating ? "Regenerating…" : "Regenerate"}
                    </button>
                  </div>
                  <div className="db-key-warn">
                    Never share this key or expose it in client-side code. Pass it as{" "}
                    <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>x-api-key</code>{" "}
                    in every server-to-server request.
                  </div>
                </>
              ) : (
                <>
                  <div className="db-key-row">
                    <span className="db-key-text">{maskedKey}</span>
                    <button className="db-key-btn" onClick={() => setConfirmRegen(true)} disabled={regenerating}>
                      {regenerating ? "Regenerating…" : "Regenerate key"}
                    </button>
                  </div>
                  <div className="db-key-warn">
                    This key was issued before we started keeping it visible here. Regenerate it to get a copyable key.
                  </div>
                </>
              )
            ) : (
              <div className="db-no-key">
                <p>You don't have an API key yet. Subscribe to a plan to get one.</p>
                <button
                  className="db-manage-btn"
                  style={{ maxWidth: 220, margin: "0 auto" }}
                  onClick={() => startCheckout("starter")}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading ? "Redirecting…" : "Subscribe to Starter — $10/mo"}
                </button>
              </div>
            )}
          </div>

          {/* Usage */}
          <div className="db-card">
            <div className="db-card-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              Usage this month
              <button className={`db-refresh-btn${usageRefreshing ? " spinning" : ""}`} onClick={refreshUsage} title="Refresh usage">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
            </div>
            {data ? (
              <>
                <div className="db-usage-nums">
                  <div className="db-usage-used">{data.usage.used.toLocaleString()}</div>
                  <div className="db-usage-limit">/ {data.usage.limit.toLocaleString()} queries</div>
                </div>
                <div className="db-bar-track">
                  <div className={`db-bar-fill${usagePct > 80 ? " warn" : ""}`} style={{ width: `${usagePct}%` }} />
                </div>
                <div className="db-usage-meta">
                  <span style={{ fontWeight: 700, color: usagePct > 80 ? "#ef4444" : "#0052cc" }}>{usagePct}% used</span>
                  <span>Resets {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </>
            ) : <div style={{ color: "#9ca3af", fontSize: 14 }}>No active plan</div>}
          </div>

          {/* Billing */}
          <div className="db-card">
            <div className="db-card-label">Billing</div>
            <div className="db-billing-row">
              <span className="db-billing-label">Status</span>
              {data?.apiKey
                ? <span className="db-billing-status">Active</span>
                : <span className="db-billing-none">No subscription</span>}
            </div>
            <div className="db-billing-row">
              <span className="db-billing-label">Plan</span>
              <span className="db-billing-value">{data?.user.planName ?? "—"}</span>
            </div>
            {currentPlanKey && (
              <button
                className="db-manage-btn"
                onClick={openBillingPortal}
                disabled={billingLoading}
                style={{ border: "none" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 4H3a2 2 0 00-2 2v13a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                  <path d="M1 10h22"/>
                </svg>
                {billingLoading ? "Opening…" : "Manage billing & invoices"}
              </button>
            )}
          </div>

          {/* Plan */}
          <div className="db-card db-card-full">
            <div className="db-card-label">Plan</div>
            <div className="db-plans-grid">
              {Object.values(PLAN_DETAILS).map((plan) => {
                const isCurrent = currentPlanKey === plan.planKey;
                return (
                  <div key={plan.planKey} className={`db-plan${isCurrent ? " current" : ""}`}>
                    {isCurrent && <div className="db-plan-current-badge">Current plan</div>}
                    <div className="db-plan-name">{plan.label}</div>
                    <div className="db-plan-price">{plan.price}</div>
                    <div className="db-plan-queries">{plan.queries}/mo</div>
                    <div className="db-plan-rate">{plan.rate}</div>
                    {isCurrent ? (
                      <button className="db-plan-btn db-plan-btn-disabled" disabled>Current</button>
                    ) : currentPlanKey ? (
                      // Plan changes aren't self-service yet — switching would
                      // start a second Stripe subscription alongside the
                      // existing one instead of replacing it. Route to support
                      // until in-place, prorated plan changes are built.
                      // Pre-fill the account's email/current plan/target plan
                      // so support has everything needed to act. A bare
                      // mailto: link silently does nothing when the browser
                      // has no registered mail handler (common — e.g. Gmail
                      // used via the web, not as the OS default) — so this
                      // opens an in-app modal with the same content plus a
                      // Copy button, and mailto is offered only as a bonus
                      // shortcut for people who do have one configured.
                      <button
                        className="db-plan-btn db-plan-btn-outline"
                        onClick={() => { setSwitchSent(false); setSwitchSendError(""); setSwitchPlanTarget(plan); }}
                      >
                        Contact us to switch
                      </button>
                    ) : (
                      <button
                        className="db-plan-btn db-plan-btn-outline"
                        disabled={!!checkoutLoading}
                        onClick={() => startCheckout(plan.planKey)}
                      >
                        {checkoutLoading === plan.planKey ? "Redirecting…" : "Get started"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CenteredSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#0052cc", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SignUpView({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let user;
      if (mode === "signup") {
        const namePart = email.split("@")[0];
        user = await signUpWithEmail(namePart, "", email, password);
      } else {
        user = await signInWithEmail(email, password);
      }
      onAuth(user);
    } catch (err) {
      if (isFirebaseError(err)) setError(getAuthErrorMessage(err.code));
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const { user } = await startGoogleSignIn();
      onAuth(user);
    } catch (err) {
      if (isFirebaseError(err)) setError(getAuthErrorMessage(err.code));
      else setError("Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .signup-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 900px; margin: 40px auto 40px; padding: 0 32px; }
        .signup-step { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; }
        .signup-step-num { width: 36px; height: 36px; border-radius: 50%; background: #e6f2ff; color: #0052cc; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
        .signup-step h3 { font-size: 14px; font-weight: 700; color: #111827; margin: 0 0 6px; }
        .signup-step p { font-size: 12px; color: #6b7280; margin: 0; line-height: 1.5; }
        .signup-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 40px; max-width: 460px; margin: 0 auto 80px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
        .signup-title { font-size: 20px; font-weight: 800; color: #111827; margin: 0 0 6px; text-align: center; }
        .signup-sub { font-size: 13px; color: #6b7280; text-align: center; margin: 0 0 28px; }
        .signup-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
        .signup-divider-line { flex: 1; border-top: 1px solid #e5e7eb; }
        .signup-divider-text { font-size: 12px; color: #9ca3af; }
        .signup-input { width: 100%; padding: 11px 14px; border: 1px solid #e5e7eb; border-radius: 9px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; color: #111827; }
        .signup-input:focus { border-color: #0052cc; box-shadow: 0 0 0 3px rgba(0,82,204,0.1); }
        .signup-label { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
        .signup-field { margin-bottom: 16px; }
        .signup-btn { width: 100%; padding: 12px; background: #0052cc; color: #fff; border: none; border-radius: 9px; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.15s; }
        .signup-btn:hover { background: #003a99; }
        .signup-btn:disabled { opacity: 0.6; cursor: default; }
        .signup-btn-google { width: 100%; padding: 11px; background: #fff; color: #374151; border: 1px solid #e5e7eb; border-radius: 9px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s; }
        .signup-btn-google:hover { background: #f9fafb; }
        .signup-btn-google:disabled { opacity: 0.6; cursor: default; }
        .signup-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-bottom: 16px; }
        .signup-toggle { font-size: 13px; color: #9ca3af; text-align: center; margin-top: 16px; }
        .signup-toggle a { color: #0052cc; font-weight: 600; cursor: pointer; text-decoration: none; }
        @media (max-width: 768px) {
          .signup-steps { grid-template-columns: 1fr; padding: 0 16px; }
        }
      `}</style>

      <div className="signup-steps">
        {[
          { num: "1", title: "Create your account", body: "Sign up with email or Google. Free to start." },
          { num: "2", title: "Choose a plan", body: "Pick the tier that fits your usage. Upgrade anytime." },
          { num: "3", title: "Get your API key", body: "Copy your key and start querying immediately." },
        ].map((s) => (
          <div key={s.num} className="signup-step">
            <div className="signup-step-num">{s.num}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <div className="signup-box">
        <div className="signup-title">{mode === "signup" ? "Get your API key" : "Welcome back"}</div>
        <div className="signup-sub">
          {mode === "signup" ? "Create a developer account to get started." : "Sign in to your developer account."}
        </div>

        <button className="signup-btn-google" onClick={handleGoogle} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        <div className="signup-divider">
          <div className="signup-divider-line" />
          <span className="signup-divider-text">or</span>
          <div className="signup-divider-line" />
        </div>

        {error && <div className="signup-error">{error}</div>}

        <form onSubmit={handleEmailSubmit}>
          <div className="signup-field">
            <label className="signup-label">Email address</label>
            <input
              className="signup-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="signup-field">
            <label className="signup-label">Password</label>
            <input
              className="signup-input"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="signup-btn" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="signup-toggle">
          {mode === "signup" ? (
            <>Already have an account? <a onClick={() => setMode("login")}>Sign in</a></>
          ) : (
            <>New here? <a onClick={() => setMode("signup")}>Create account</a></>
          )}
        </div>
      </div>
    </>
  );
}
