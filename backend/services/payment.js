const MODE = process.env.PAYMENT_MODE || "mock";

/**
 * Confirms a payment. This is the server-authoritative source of truth —
 * the frontend can never just declare `paid = true` on its own.
 *
 * mock mode: any non-empty reference number is accepted. This exists purely
 * so the whole booth flow is testable without a real payment account.
 *
 * live mode: this is a placeholder. Wiring up a real GCash-compatible
 * gateway (webhook verification, signature checks, idempotency) is
 * production integration work that has to be done against that provider's
 * real API — it is intentionally NOT faked here.
 */
export async function confirmPayment({ reference }) {
  if (MODE === "mock") {
    if (!reference || !String(reference).trim()) {
      return { ok: false, reason: "A reference number is required, even in test mode." };
    }
    return { ok: true, status: "success", reference: String(reference).trim() };
  }

  if (MODE === "live") {
    throw new Error(
      "PAYMENT_MODE=live is not implemented. Integrate a real GCash-compatible " +
        "gateway here (verify the transaction server-side against the provider's " +
        "API/webhook) before enabling live payments."
    );
  }

  return { ok: false, reason: `Unknown PAYMENT_MODE "${MODE}"` };
}

export function getPaymentMode() {
  return MODE;
}
