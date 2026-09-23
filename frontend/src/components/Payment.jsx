import { useState } from "react";
import gcashQr from "../assets/gcash-qr.jpeg";

export default function Payment({ status, startedByUsername, isStartedByMe, myUsername, onStartPayment, onConfirmPayment, paymentMode }) {
  const [reference, setReference] = useState("");

  if (status === "success") {
    return (
      <div className="screen screen--center">
        <h2 className="section-title">Payment successful ❤️</h2>
        <p className="section-hint">Preparing your memory…</p>
      </div>
    );
  }

  if (status === "processing" && !isStartedByMe) {
    return (
      <div className="screen screen--center">
        <h2 className="section-title">{startedByUsername} is completing the payment…</h2>
        <p className="section-hint">You'll both see the confirmation once it's done.</p>
      </div>
    );
  }

  if (status === "processing" && isStartedByMe) {
    return (
      <div className="screen">
        <p className="payment-eyebrow">Secure checkout</p>
        <h2 className="section-title">Pay with GCash</h2>
        <p className="section-hint">Scan the QR code, send ₱49.00, then enter the reference number from your GCash receipt.</p>
        <div className="payment-card payment-card--gcash">
          <div className="payment-amount"><span>Amount due</span><strong>₱49.00</strong></div>
          <img className="payment-card__qr" src={gcashQr} alt="GCash QR code for a ₱49.00 LDRBOOTH payment" />
          <ol className="payment-steps">
            <li>Open GCash and scan this QR code.</li>
            <li>Send exactly <strong>₱49.00</strong>.</li>
            <li>Enter your payment reference below.</li>
          </ol>
          <label className="field">
            <span>GCash reference number</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. 000123456789"
            />
          </label>
          <button
            className="btn btn--primary btn--lg"
            onClick={() => onConfirmPayment(reference)}
            disabled={!reference.trim()}
          >
            I've sent the payment
          </button>
          {paymentMode === "mock" && <p className="payment-test-note">Must be your payment's reference number.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--center">
      <h2 className="section-title">Payment</h2>
      <p className="section-hint">One of you can pay — either {myUsername} or your partner.</p>
      <button className="btn btn--primary btn--lg" onClick={onStartPayment}>
        Continue to GCash payment
      </button>
    </div>
  );
}
