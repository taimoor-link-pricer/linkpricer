"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";

// ── Data ─────────────────────────────────────────────────────────────────────

const USER_TYPE_OPTIONS = ["SEO agency", "Freelancer", "In-house marketer", "Brand owner", "Other"] as const;
type UserType = typeof USER_TYPE_OPTIONS[number];

const BUDGET_OPTIONS = ["Under €1,000", "€1,000–€5,000", "€5,000–€20,000", "€20,000+"] as const;
type Budget = typeof BUDGET_OPTIONS[number];

const PRIORITY_OPTIONS = ["Price", "Website quality", "Niche relevance", "Speed", "Transparency"] as const;
type Priority = typeof PRIORITY_OPTIONS[number];

const METHOD_OPTIONS = ["Manually contacting sites", "Using marketplaces", "Through agencies", "Mixed methods"] as const;
type Method = typeof METHOD_OPTIONS[number];

interface FormData {
  userType: UserType | "";
  userTypeOther: string;
  monthlySpend: Budget | "";
  biggestChallenge: string;
  priorityFactors: Priority[];
  currentMethod: Method[];
}

interface Benefit { badge: string; title: string; text: string }

// Verbatim from the design handoff (onboarding-modal.html `benefits.user_type`).
// Each role has 2–3 angles; one is picked at random when the user selects that role,
// matching the source's getRandomBenefit() behaviour.
const USER_TYPE_BENEFITS: Record<string, Benefit[]> = {
  "SEO agency": [
    {
      badge: "Option A",
      title: "Savings focus",
      text: "Built for agencies like yours. Agencies save up to 46% on link costs by comparing prices across 20+ websites in one place. Use our relevance filter to quickly find high-quality sites that match each client's industry.",
    },
    {
      badge: "Option B",
      title: "Scale focus",
      text: "Run more client campaigns in less time. Source backlinks for all your clients from one dashboard. Includes shared team access, bulk price comparison, and exportable reports for client reviews.",
    },
    {
      badge: "Option C",
      title: "Margin focus",
      text: "Protect your margins. Stop overpaying when buying through middlemen. See the real price of every link so you can charge clients fairly and keep more profit per project.",
    },
  ],
  "Freelancer": [
    {
      badge: "Option A",
      title: "Budget focus",
      text: "Compete with bigger players. Freelancers using Linkpricer manage 6× larger budgets while saving up to 68% compared to buying direct. Win bigger clients without the agency overhead.",
    },
    {
      badge: "Option B",
      title: "Time focus",
      text: "Get hours back every week. No more switching between 15 different websites and price lists. Search once, compare everything, order in one place.",
    },
    {
      badge: "Option C",
      title: "Client-trust focus",
      text: "Look professional to your clients. Export clean comparison reports that show exactly why you chose each website. Clients see the value you bring, not just the invoice.",
    },
  ],
  "In-house marketer": [
    {
      badge: "Option A",
      title: "Budget-justification focus",
      text: "Justify every euro to your finance team. In-house teams report 42% lower costs per backlink and get clean reports for budget reviews. Defend your spending with real data.",
    },
    {
      badge: "Option B",
      title: "Efficiency focus",
      text: "One tool instead of five. Replace multiple vendor logins with a single dashboard. Track every link, every supplier, every invoice in one place.",
    },
    {
      badge: "Option C",
      title: "Quality focus",
      text: "Stop guessing about link quality. Filter by real traffic, industry relevance, and verified data — not just surface-level scores that can mislead.",
    },
  ],
  "Brand owner": [
    {
      badge: "Option A",
      title: "Simplicity focus",
      text: "Built for people who aren't SEO specialists. Brand owners save 52% on average by seeing every backlink option in one place. All the prices, all the website data laid out clearly so you can decide what's worth buying for your brand.",
    },
    {
      badge: "Option B",
      title: "Visibility focus",
      text: "See everything in one place. Instead of checking dozens of websites, get all the prices and metrics on a single screen. You stay in control of what to buy — we just make sure you have the full picture before you spend.",
    },
    {
      badge: "Option C",
      title: "Confidence focus",
      text: "Buy with full information, not guesswork. Every backlink option shown with its real price and key data points. No pressure, no recommendations — just everything you need to make your own call.",
    },
  ],
  "Other": [
    {
      badge: "For Everyone",
      title: "Adaptable solutions",
      text: "Whatever your role, Linkpricer adapts. Whether you're a consultant, a platform, or running something different — our users typically save 40 to 65% on link spend and cut sourcing time significantly. Tell us your use case and we'll show you exactly how we can help.",
    },
  ],
};

function pickRandomBenefit(userType: string): Benefit | null {
  const options = USER_TYPE_BENEFITS[userType];
  if (!options || options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

const BUDGET_INSIGHTS: Record<string, string> = {
  "Under €1,000": "Every euro matters at this stage. Users in this range save an average of €340 per month by avoiding overpriced sources. That's roughly 3–4 extra links per month for the same budget.",
  "€1,000–€5,000": "The sweet spot for growth. Mid-budget users save €1,200–€2,400 per month on average. That's a full extra campaign's worth of backlinks at no additional cost.",
  "€5,000–€20,000": "Serious budgets deserve serious tools. Power users at this level save €8,000+ per month by comparing prices across all major sources. Bulk discounts and priority support included.",
  "€20,000+": "Enterprise-level savings. Top-tier users save €15,000–€40,000 per month with custom data access, a dedicated account manager, and priority support. Let's talk about an enterprise plan tailored to your volume.",
};

const PRIORITY_INSIGHTS: Record<string, string> = {
  "Price": "Pricing is our specialty. Compare the same website across 60+ sources in seconds. The average price difference for the same backlink is 38% — so you'll always know you're not overpaying.",
  "Website quality": "Quality, verified. Every website is checked for real visitor traffic, industry fit, and overall trustworthiness. No more surprises where a site looks strong on paper but delivers nothing.",
  "Niche relevance": "Relevance done right. We match every website to your exact industry by analysing the actual content — not just category labels. Find the one perfect site, not a hundred maybes.",
  "Speed": "From hours to seconds. Find, compare, and order in one flow. Users report sourcing backlinks 10× faster than reaching out manually.",
  "Transparency": "No hidden costs. See the real price, any added fees, and the original publisher cost upfront — all in one view. The first fully transparent pricing layer for the link-buying industry.",
};

const METHOD_INSIGHTS: Record<string, string> = {
  "Manually contacting sites": "Skip the inbox grind. Reaching out manually takes 40+ hours a month on average. Linkpricer users do the same volume in under 4 hours — and pay 30% less.",
  "Using marketplaces": "Compare them all at once. Why log into 8 different websites when you can see them side by side on one screen? Same sites, real prices, instant comparison.",
  "Through agencies": "Cut the middleman markup. Agencies typically mark up backlinks 2–3× the original price. Linkpricer gives you direct pricing while keeping the quality control you'd expect from an agency.",
  "Mixed methods": "Bring it all together. Stop juggling spreadsheets, emails, and supplier portals. Linkpricer becomes your single source of truth for every backlink, no matter where it came from.",
};

const TOTAL_STEPS = 5;

// ── Wizard ────────────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>({
    userType: "", userTypeOther: "", monthlySpend: "",
    biggestChallenge: "", priorityFactors: [], currentMethod: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  function update(patch: Partial<FormData>) {
    setData(prev => ({ ...prev, ...patch }));
  }

  function isValid(): boolean {
    switch (step) {
      case 1: return !!data.userType && (data.userType !== "Other" || data.userTypeOther.trim() !== "");
      case 2: return !!data.monthlySpend;
      case 3: return data.biggestChallenge.trim() !== "";
      case 4: return data.priorityFactors.length > 0;
      case 5: return data.currentMethod.length > 0;
      default: return false;
    }
  }

  async function handleNext() {
    if (!isValid()) return;
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch("/api/user/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userType: data.userType,
            userTypeOther: data.userTypeOther || undefined,
            monthlySpend: data.monthlySpend,
            biggestChallenge: data.biggestChallenge,
            priorityFactors: data.priorityFactors,
            currentMethod: data.currentMethod,
          }),
        });
        if (!res.ok) {
          setSubmitError("Something went wrong. Please try again.");
          setSubmitting(false);
          return;
        }
      } catch {
        setSubmitError("Network error. Please check your connection and try again.");
        setSubmitting(false);
        return;
      }
      router.push(ROUTES.search);
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1);
  }

  const pct = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.52)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
      fontFamily: "inherit",
    }}>
      <style>{`
        @keyframes lp-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lp-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-ob-modal {
          animation: lp-slide-up 0.3s ease-out;
        }
        .lp-ob-content {
          animation: lp-fade-in 0.25s ease-out;
        }
        .lp-ob-benefit {
          animation: lp-slide-in 0.35s ease-out;
        }
        .lp-ob-radio:not(:checked) + .lp-ob-radio-label:hover {
          border-color: #0052cc;
          background: #f0f7ff;
        }
        .lp-ob-checkbox-label:hover { border-color: #9ca3af; }
        .lp-ob-textarea:focus { outline: none; border-color: #0052cc; box-shadow: 0 0 0 3px rgba(0,82,204,0.1); }
        .lp-ob-textarea::placeholder { color: #9ca3af; }
        .lp-ob-input:focus { outline: none; border-color: #0052cc; box-shadow: 0 0 0 3px rgba(0,82,204,0.1); }
        .lp-ob-input::placeholder { color: #9ca3af; }
        .lp-ob-modal::-webkit-scrollbar { width: 6px; }
        .lp-ob-modal::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        @media (max-width: 640px) {
          .lp-ob-label-text { font-size: 0 !important; }
          .lp-ob-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="lp-ob-modal" style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        width: "100%",
        maxWidth: 560,
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Progress */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", letterSpacing: 0.3, textTransform: "uppercase" }}>
              Step {step} of {TOTAL_STEPS}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0052cc" }}>{pct}% complete</span>
          </div>
          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#0052cc", borderRadius: 2, transition: "width 0.3s ease-out" }} />
          </div>
        </div>

        {/* Content */}
        <div key={step} className="lp-ob-content" style={{ flex: 1, overflowY: "auto", padding: "32px 32px 24px" }}>
          {step === 1 && <Step1 data={data} update={update} />}
          {step === 2 && <Step2 data={data} update={update} />}
          {step === 3 && <Step3 data={data} update={update} />}
          {step === 4 && <Step4 data={data} update={update} />}
          {step === 5 && <Step5 data={data} update={update} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <button
            onClick={handleBack}
            disabled={step === 1}
            style={{
              padding: "11px 20px", borderRadius: 10,
              border: step === 1 ? "1px solid #e5e7eb" : "1px solid #0052cc",
              background: "transparent",
              color: step === 1 ? "#9ca3af" : "#0052cc",
              fontSize: 14, fontWeight: 600, cursor: step === 1 ? "default" : "pointer",
              minWidth: 80, transition: "all 0.15s",
            }}
          >
            Back
          </button>
          {submitError && (
            <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 500, margin: "0 0 8px", textAlign: "center" }}>{submitError}</p>
          )}
          <button
            onClick={handleNext}
            disabled={!isValid() || submitting}
            style={{
              flex: 1, padding: "11px 20px", borderRadius: 10, border: "none",
              background: isValid() && !submitting ? "#0052cc" : "#d1d5db",
              color: isValid() && !submitting ? "#fff" : "#9ca3af",
              fontSize: 14, fontWeight: 600,
              cursor: isValid() && !submitting ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {submitting ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "lp-slide-up 0.8s linear infinite" }} />
                Setting up…
              </>
            ) : step === TOTAL_STEPS ? "Complete →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function StepTitle({ title, subtitle, question }: { title: string; subtitle: string; question: string }) {
  return (
    <>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", color: "#111827", letterSpacing: -0.4 }}>{title}</h1>
      <p style={{ fontSize: 14, color: "#4b5563", margin: "0 0 28px", fontWeight: 500 }}>{subtitle}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>{question}</p>
    </>
  );
}

function Step1({ data, update }: { data: FormData; update: (p: Partial<FormData>) => void }) {
  // The source design re-randomises which benefit angle shows every time the
  // user (re)selects a role — keep a local pick that updates on selection.
  const [benefit, setBenefit] = useState<Benefit | null>(() =>
    data.userType ? pickRandomBenefit(data.userType) : null
  );

  function selectUserType(opt: UserType) {
    update({ userType: opt, userTypeOther: opt !== "Other" ? "" : data.userTypeOther });
    setBenefit(pickRandomBenefit(opt));
  }

  return (
    <>
      <StepTitle title="Welcome to Linkpricer! 👋" subtitle="Let's personalise your experience" question="What best describes you?" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {USER_TYPE_OPTIONS.map(opt => (
          <RadioPill
            key={opt}
            label={opt}
            checked={data.userType === opt}
            onChange={() => selectUserType(opt)}
          />
        ))}
      </div>
      {data.userType === "Other" && (
        <div style={{ marginTop: 14, transition: "all 0.2s" }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Please specify</label>
          <input
            type="text"
            className="lp-ob-input"
            value={data.userTypeOther}
            onChange={e => update({ userTypeOther: e.target.value })}
            placeholder="Tell us about yourself..."
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, color: "#111827", boxSizing: "border-box" }}
          />
        </div>
      )}
      {benefit && (
        <div className="lp-ob-benefit" style={{
          marginTop: 20, padding: 18, borderRadius: 12,
          background: "linear-gradient(135deg, #f0f7ff 0%, #e6f2ff 100%)",
          border: "1px solid #0052cc",
        }}>
          <span style={{
            display: "inline-block", background: "#0052cc", color: "#fff",
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase",
          }}>
            {benefit.badge}
          </span>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0052cc", marginBottom: 6 }}>{benefit.title}</div>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{benefit.text}</p>
        </div>
      )}
    </>
  );
}

function Step2({ data, update }: { data: FormData; update: (p: Partial<FormData>) => void }) {
  const insight = data.monthlySpend ? BUDGET_INSIGHTS[data.monthlySpend] : null;
  return (
    <>
      <StepTitle title="Budget Information" subtitle="Help us understand your budget" question="How much do you usually spend on link building each month?" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {BUDGET_OPTIONS.map(opt => (
          <RadioPill key={opt} label={opt} checked={data.monthlySpend === opt} onChange={() => update({ monthlySpend: opt })} />
        ))}
      </div>
      {insight && (
        <div className="lp-ob-benefit" style={{
          marginTop: 20, padding: 16, borderRadius: 10,
          background: "linear-gradient(135deg, #f0f7ff 0%, #e6f2ff 100%)",
          border: "1px solid #0052cc",
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{insight}</p>
        </div>
      )}
    </>
  );
}

function Step3({ data, update }: { data: FormData; update: (p: Partial<FormData>) => void }) {
  return (
    <>
      <StepTitle title="Your Challenges" subtitle="Share your biggest pain point" question="What's your biggest challenge when buying backlinks?" />
      <textarea
        className="lp-ob-textarea"
        value={data.biggestChallenge}
        onChange={e => update({ biggestChallenge: e.target.value })}
        placeholder="Tell us about your main challenge..."
        rows={5}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 10,
          border: "1px solid #e5e7eb", fontSize: 14, color: "#111827",
          fontFamily: "inherit", resize: "none", boxSizing: "border-box",
          minHeight: 120, lineHeight: 1.6,
        }}
      />
      <div style={{
        marginTop: 16, padding: "12px 14px", borderRadius: 8,
        background: "#f9fafb", borderLeft: "3px solid #0052cc",
        fontSize: 13, color: "#374151", lineHeight: 1.5,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#0052cc", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
          💡 You&apos;re in good company
        </div>
        You&apos;re not alone. 78% of our users described a similar challenge in their first week. Whatever your pain point — unclear pricing, hard-to-verify quality, or managing too many suppliers — Linkpricer was built to solve exactly this.
      </div>
    </>
  );
}

function Step4({ data, update }: { data: FormData; update: (p: Partial<FormData>) => void }) {
  function toggle(opt: Priority) {
    const next = data.priorityFactors.includes(opt)
      ? data.priorityFactors.filter(x => x !== opt)
      : [...data.priorityFactors, opt];
    update({ priorityFactors: next });
  }
  return (
    <>
      <StepTitle title="What Matters Most" subtitle="What do you prioritise?" question="What matters most to you when choosing backlinks?" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {PRIORITY_OPTIONS.map(opt => (
          <CheckChip key={opt} label={opt} checked={data.priorityFactors.includes(opt)} onChange={() => toggle(opt)} />
        ))}
      </div>
      {data.priorityFactors.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {data.priorityFactors.map(f => (
            <div key={f} className="lp-ob-benefit" style={{
              padding: "12px 14px", borderRadius: 8,
              background: "#f9fafb", borderLeft: "3px solid #0052cc",
              fontSize: 13, color: "#374151", lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0052cc", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
                ✓ {f}
              </div>
              {PRIORITY_INSIGHTS[f]}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Step5({ data, update }: { data: FormData; update: (p: Partial<FormData>) => void }) {
  function toggle(opt: Method) {
    const next = data.currentMethod.includes(opt)
      ? data.currentMethod.filter(x => x !== opt)
      : [...data.currentMethod, opt];
    update({ currentMethod: next });
  }
  return (
    <>
      <StepTitle title="Current Workflow" subtitle="How do you currently work?" question="How do you currently find and order backlinks?" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {METHOD_OPTIONS.map(opt => (
          <CheckChip key={opt} label={opt} checked={data.currentMethod.includes(opt)} onChange={() => toggle(opt)} />
        ))}
      </div>
      {data.currentMethod.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {data.currentMethod.map(m => (
            <div key={m} className="lp-ob-benefit" style={{
              padding: "12px 14px", borderRadius: 8,
              background: "#f9fafb", borderLeft: "3px solid #0052cc",
              fontSize: 13, color: "#374151", lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0052cc", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
                ✓ {m}
              </div>
              {METHOD_INSIGHTS[m]}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Shared input primitives ───────────────────────────────────────────────────

function RadioPill({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "block", cursor: "pointer" }}>
      <input type="radio" className="lp-ob-radio" checked={checked} onChange={onChange} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
      <span className="lp-ob-radio-label" style={{
        display: "block", padding: "12px 16px",
        border: `2px solid ${checked ? "#0052cc" : "#e5e7eb"}`,
        borderRadius: 10,
        background: checked ? "#0052cc" : "#fff",
        color: checked ? "#fff" : "#374151",
        fontSize: 14, fontWeight: 500,
        textAlign: "center",
        transition: "all 0.15s",
        userSelect: "none",
      }}>
        {label}
      </span>
    </label>
  );
}

function CheckChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="lp-ob-checkbox-label" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "10px 14px",
      border: `2px solid ${checked ? "#0052cc" : "#e5e7eb"}`,
      borderRadius: 8,
      background: checked ? "#e6f2ff" : "#fff",
      color: checked ? "#0052cc" : "#374151",
      fontSize: 13, fontWeight: 500,
      cursor: "pointer", userSelect: "none",
      transition: "all 0.15s",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `2px solid ${checked ? "#0052cc" : "#d1d5db"}`,
        background: checked ? "#0052cc" : "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff",
        transition: "all 0.15s",
      }}>
        {checked ? "✓" : ""}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
      {label}
    </label>
  );
}
