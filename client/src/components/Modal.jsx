import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { authenticate } from "../lib/api.js";

export default function Modal({ onClose, onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      onSignedIn(await authenticate(mode === "register" ? "register" : "login", values));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="modal-mark"><Sparkles size={20} /></div>
        <p className="eyebrow">YOUR WORKSPACE, SAVED</p>
        <h2 id="modal-title">{mode === "register" ? "Create your account" : "Welcome back"}</h2>
        <p className="modal-copy">Save your resume reviews and pick up where you left off.</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <label>Your name<input autoComplete="name" required minLength="2" maxLength="60" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></label>}
          <label>Email address<input type="email" autoComplete="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
          <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" disabled={loading}>{loading ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"} <span>→</span></button>
        </form>
        <p className="auth-switch">{mode === "register" ? "Already have an account?" : "New to Resume Insight?"} <button onClick={() => { setError(""); setMode(mode === "register" ? "login" : "register"); }}>{mode === "register" ? "Sign in" : "Create an account"}</button></p>
      </section>
    </div>
  );
}
