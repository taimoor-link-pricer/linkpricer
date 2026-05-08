"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // TODO: wire up newsletter subscription
    setSubmitted(true);
    setEmail("");
  }

  if (submitted) {
    return (
      <p className="text-sm text-primary font-semibold">
        You&apos;re on the list. Welcome aboard.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
        className="w-full bg-surface-container-lowest border-none rounded-l-xl text-sm px-4 py-3 outline-none focus:ring-1 focus:ring-primary/20 text-on-surface placeholder:text-outline/50"
      />
      <button
        type="submit"
        aria-label="Subscribe"
        className="bg-primary text-on-primary px-4 rounded-r-xl hover:bg-primary-container transition-colors flex items-center"
      >
        <span className="material-symbols-outlined text-[20px]">send</span>
      </button>
    </form>
  );
}
