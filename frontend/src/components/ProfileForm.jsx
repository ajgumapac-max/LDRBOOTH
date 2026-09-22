import { useState } from "react";

export default function ProfileForm({ mode, onSubmit, onBack, submitting, error }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState("");

  const isJoin = mode === "join";

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedEmail = email.trim();
    if (!trimmedUser) return setLocalError("Enter your name.");
    if (trimmedUser.length > 40) return setLocalError("Name is too long.");
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return setLocalError("Enter a valid email.");
    if (isJoin && !roomCode.trim()) return setLocalError("Enter your booth code.");
    setLocalError("");
    onSubmit({ username: trimmedUser, email: trimmedEmail, roomCode: roomCode.trim().toUpperCase() });
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onBack} aria-label="Back">
        ← Back
      </button>
      <h2 className="section-title">{isJoin ? "Join a booth" : "Tell us who you are"}</h2>
      <p className="section-hint">
        {isJoin ? "Enter your details and the booth code your person shared." : "This appears to your partner during the session."}
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Your name</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Josh"
            maxLength={40}
            autoComplete="name"
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {isJoin && (
          <label className="field">
            <span>Booth code</span>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="LDR-XXXXX"
              autoCapitalize="characters"
            />
          </label>
        )}

        {(localError || error) && <p className="field-error">{localError || error}</p>}

        <button className="btn btn--primary btn--lg" type="submit" disabled={submitting}>
          {submitting ? "One moment…" : isJoin ? "Join booth" : "Create booth"}
        </button>
      </form>
    </div>
  );
}
