import { useState } from "react";
import gcashQr from "../assets/gcash-qr.jpeg";

export default function Payment({
  status,
  startedByUsername,
  isStartedByMe,
  myUsername,
  onStartPayment,
  onConfirmPayment,
  paymentMode,
}) {
  const [reference, setReference] = useState("");
  const [referenceError, setReferenceError] = useState("");

  /*
   * Reference validation
   *
   * We intentionally validate the INPUT format only.
   * The server/Xendit should be responsible for confirming
   * whether an actual payment succeeded.
   *
   * Rules:
   * - required
   * - 8 to 30 characters
   * - letters and numbers only
   * - no spaces
   * - no punctuation/symbols
   */
  const validateReference = (value) => {
    const clean = value.trim();

    if (!clean) {
      return "Please enter your GCash reference number.";
    }

    if (clean.length < 8) {
      return "Reference number is too short. Enter the complete reference number from your receipt.";
    }

    if (clean.length > 30) {
      return "Reference number is too long. Enter only the reference number shown on your receipt.";
    }

    if (!/^[A-Za-z0-9]+$/.test(clean)) {
      return "Reference number can only contain letters and numbers.";
    }

    return "";
  };

  const handleReferenceChange = (e) => {
    const value = e.target.value;

    setReference(value);

    /*
     * Don't immediately show an error while the user is typing
     * an incomplete value. Once they reach an invalid character,
     * show the error.
     */
    if (/[^A-Za-z0-9]/.test(value)) {
      setReferenceError(
        "Reference number can only contain letters and numbers."
      );
      return;
    }

    if (value.length > 30) {
      setReferenceError(
        "Reference number is too long. Maximum 30 characters."
      );
      return;
    }

    setReferenceError("");
  };

  const handleConfirm = () => {
    const error = validateReference(reference);

    if (error) {
      setReferenceError(error);
      return;
    }

    setReferenceError("");

    const cleanReference = reference.trim();

    onConfirmPayment(cleanReference);
  };

  if (status === "success") {
    return (
      <div className="screen screen--center">
        <h2 className="section-title">
          Payment successful ❤️
        </h2>

        <p className="section-hint">
          Preparing your memory…
        </p>
      </div>
    );
  }

  if (status === "processing" && !isStartedByMe) {
    return (
      <div className="screen screen--center">
        <h2 className="section-title">
          {startedByUsername} is completing the payment…
        </h2>

        <p className="section-hint">
          You'll both see the confirmation once it's done.
        </p>
      </div>
    );
  }

  if (status === "processing" && isStartedByMe) {
    const isReferenceValid =
      reference.trim().length >= 8 &&
      reference.trim().length <= 30 &&
      /^[A-Za-z0-9]+$/.test(reference.trim());

    return (
      <div className="screen">
        <p className="payment-eyebrow">
          Secure checkout
        </p>

        <h2 className="section-title">
          Pay with GCash
        </h2>

        <p className="section-hint">
          Scan the QR code, send ₱49.00, then enter the
          reference number shown on your GCash receipt.
        </p>

        <div className="payment-card payment-card--gcash">

          <div className="payment-amount">
            <span>Amount due</span>
            <strong>₱49.00</strong>
          </div>

          <img
            className="payment-card__qr"
            src={gcashQr}
            alt="GCash QR code for a ₱49.00 LDRBOOTH payment"
          />

          <ol className="payment-steps">
            <li>
              Open GCash and scan this QR code.
            </li>

            <li>
              Send exactly <strong>₱49.00</strong>.
            </li>

            <li>
              Copy the complete reference number from
              your GCash receipt.
            </li>
          </ol>

          <label className="field">
            <span>
              GCash reference number
            </span>

            <input
              value={reference}
              onChange={handleReferenceChange}
              onBlur={() => {
                if (reference.trim()) {
                  setReferenceError(
                    validateReference(reference)
                  );
                }
              }}
              placeholder="Enter your payment reference"
              inputMode="text"
              autoComplete="off"
              maxLength={30}
              aria-invalid={Boolean(referenceError)}
            />
          </label>

          {referenceError && (
            <p
              className="payment-reference-error"
              role="alert"
            >
              {referenceError}
            </p>
          )}

          <button
            className="btn btn--primary btn--lg"
            onClick={handleConfirm}
            disabled={!isReferenceValid}
          >
            I've sent the payment
          </button>

          <p className="payment-reference-help">
            Enter the complete reference exactly as shown
            on your payment receipt.
          </p>

          {paymentMode === "mock" && (
            <p className="payment-test-note">
              Input your payment reference number here.
            </p>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--center">
      <h2 className="section-title">
        Payment
      </h2>

      <p className="section-hint">
        One of you can pay — either {myUsername} or your
        partner.
      </p>

      <button
        className="btn btn--primary btn--lg"
        onClick={onStartPayment}
      >
        Continue to GCash payment
      </button>
    </div>
  );
}