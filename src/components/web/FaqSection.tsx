import React from "react";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "What does it actually check?",
    a: "Local rules read the structure of a link and the wording of a message. After you sign in, an AI model researches the submission, and it may read the public page you linked. Anything it cannot tie to a retrieved source is marked unverified.",
  },
  {
    q: "Is a risk signal proof of a scam?",
    a: "No. It's a reason to look closer. Legitimate employers sometimes trigger signals too.",
  },
  {
    q: "Does a clean result mean it's safe?",
    a: "No. The best result is “No major red flags found” in the evidence reviewed. Internyra never says an offer is safe or certified. Without a source to support the company, the result is “Insufficient evidence”.",
  },
  {
    q: "Where does my data go?",
    a: "Your account and reports are stored in Google Cloud Firestore. The submission is sent to an AI provider (Gemini or OpenAI) for research. Pasted message text is removed from storage when your report completes. The administrator of this test deployment can review activity for operations and abuse prevention. You can delete a report or your whole account any time.",
  },
];

export function FaqSection() {
  return (
    <div id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
      <h2 className="display text-3xl sm:text-4xl">Questions</h2>
      <div className="mt-8 divide-y divide-[var(--ink-primary)]/10 border-y border-[var(--ink-primary)]/10">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-[var(--ink-primary)] [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus className="h-5 w-5 shrink-0 text-[var(--brand-primary)] transition-transform duration-300 group-open:rotate-45" />
            </summary>
            <p className="mt-3 max-w-2xl leading-relaxed text-[var(--ink-secondary)]">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
