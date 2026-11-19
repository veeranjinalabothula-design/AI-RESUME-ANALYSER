import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, FileText, FileUp, Gauge, Lightbulb, LockKeyhole,
  LogOut, Menu, Plus, ScanSearch, ShieldCheck, Sparkles, Target, Trash2, Upload
} from "lucide-react";
import Modal from "./components/Modal.jsx";
import { analyze, deleteAnalysis, getAnalyses, saveAnalysis } from "./lib/api.js";
import { localAnalyze, readHistory, writeHistory } from "./lib/localAnalyzer.js";

const emptyResult = null;
const dateLabel = (date) => new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function App() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(emptyResult);
  const [active, setActive] = useState("analyzer");
  const [history, setHistory] = useState(readHistory);
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("resume-insight-user") || "null"); } catch { return null; } });
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const resultsRef = useRef(null);
  const authSessionRef = useRef(0);
  const token = user?.token;

  useEffect(() => { writeHistory(history); }, [history]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const authSession = authSessionRef.current;
    getAnalyses(token).then(({ analyses }) => {
      if (cancelled || authSession !== authSessionRef.current) return;
      const remote = analyses.map((item) => ({ id: item._id, title: item.title, date: item.createdAt, result: item.result, remote: true }));
      setHistory((previous) => {
        const merged = [...remote, ...previous.filter((item) => !item.remote && !remote.some((saved) => saved.id === item.id))];
        return merged.slice(0, 20);
      });
    }).catch((err) => {
      if (!cancelled && authSession === authSessionRef.current) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [token]);

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (nextFile.type !== "application/pdf") { setError("Please choose a PDF file."); return; }
    if (nextFile.size > 5 * 1024 * 1024) { setError("PDF must be 5 MB or smaller."); return; }
    setFile(nextFile);
    setResumeText("");
    setError("");
  }

  async function runAnalysis(event) {
    event?.preventDefault();
    setError("");
    if (!file && resumeText.trim().length < 80) {
      setError("Paste at least 80 characters of resume text or upload a PDF.");
      return;
    }
    const authSession = authSessionRef.current;
    setLoading(true);
    try {
      let nextResult;
      try {
        ({ result: nextResult } = await analyze(resumeText, jobDescription, file));
      } catch (apiError) {
        if (file) throw apiError;
        if (apiError.message.includes("Start the server")) nextResult = localAnalyze(resumeText, jobDescription);
        else throw apiError;
      }
      if (authSession !== authSessionRef.current) return;
      setResult(nextResult);
      const entry = { id: crypto.randomUUID(), title: file?.name?.replace(/\.pdf$/i, "") || "Resume review", date: new Date().toISOString(), result: nextResult };
      setHistory((previous) => [entry, ...previous.filter((item) => item.id !== entry.id)].slice(0, 20));
      if (token) {
        try {
          const { analysis } = await saveAnalysis(token, nextResult, entry.title);
          if (authSession !== authSessionRef.current) return;
          setHistory((previous) => [{ ...entry, id: analysis._id, date: analysis.createdAt, remote: true }, ...previous.filter((item) => item.id !== entry.id)].slice(0, 20));
        } catch (saveError) {
          if (authSession === authSessionRef.current) {
            setError(`Analysis is ready, but it could not be saved: ${saveError.message}`);
          }
        }
      }
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      if (authSession === authSessionRef.current) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function signedIn(session) {
    authSessionRef.current += 1;
    const nextUser = { ...session.user, token: session.token };
    setUser(nextUser);
    localStorage.setItem("resume-insight-user", JSON.stringify(nextUser));
    setModal(false);
  }

  function signOut() {
    authSessionRef.current += 1;
    localStorage.removeItem("resume-insight-user");
    setUser(null);
    setHistory(readHistory().filter((item) => !item.remote));
    setResumeText("");
    setJobDescription("");
    setFile(null);
    setResult(null);
    setError("");
    setDragging(false);
    setActive("analyzer");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removeEntry(item) {
    if (item.remote && token) {
      try { await deleteAnalysis(token, item.id); } catch (err) { setError(err.message); return; }
    }
    setHistory((previous) => previous.filter((entry) => entry.id !== item.id));
    if (result === item.result) setResult(null);
  }

  function openEntry(item) {
    setResult(item.result);
    setActive("analyzer");
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function exportResult() {
    if (!result) return;
    const content = `<!doctype html><html><head><meta charset="utf-8"><title>Resume Insight report</title><style>body{font:15px Arial,sans-serif;max-width:760px;margin:48px auto;color:#20251f;line-height:1.6}h1{font-size:30px}h2{margin-top:30px;color:#245c45}.score{font-size:44px;font-weight:bold;color:#245c45}li{margin:8px 0}.muted{color:#657068}</style></head><body><p class="muted">RESUME INSIGHT · PERSONAL REPORT</p><h1>Your resume review</h1><p class="score">${result.score}<small>/100</small></p><p>${escapeHtml(result.summary)}</p><h2>Strengths</h2><ul>${result.strengths.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul><h2>Suggestions</h2><ul>${result.suggestions.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul><h2>Keywords to highlight</h2><p>${result.matchedKeywords.map(escapeHtml).join(", ") || "No job description provided"}</p><h2>Consider adding</h2><p>${result.missingKeywords.map(escapeHtml).join(", ") || "No missing keywords detected"}</p><p class="muted">This is an advisory tool, not a hiring decision.</p><script>window.onload=()=>window.print()</script></body></html>`;
    const report = window.open("", "_blank");
    if (!report) { setError("Allow pop-ups to export your report."); return; }
    report.document.write(content);
    report.document.close();
  }

  const wordCount = resumeText.trim() ? resumeText.trim().split(/\s+/).length : 0;
  const shownHistory = history;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActive("analyzer"); }} aria-label="Resume Insight home">
          <span className="brand-mark"><Sparkles size={17} fill="currentColor" /></span><span>resume<span className="brand-light">insight</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={active === "analyzer" ? "nav-link selected" : "nav-link"} onClick={() => setActive("analyzer")}>Analyzer</button>
          <button className={active === "history" ? "nav-link selected" : "nav-link"} onClick={() => setActive("history")}>My reviews <span className="nav-count">{shownHistory.length}</span></button>
        </nav>
        <div className="top-actions">
          <span className="privacy-chip"><ShieldCheck size={14} /> Private by design</span>
          {user ? <button className="account-button" onClick={signOut}><span className="avatar">{user.name?.[0]?.toUpperCase() || "Y"}</span><span className="account-name">{user.name}</span><LogOut size={15} /></button> : <button className="button button-outline sign-in" onClick={() => setModal(true)}>Sign in <ArrowUpRight size={14} /></button>}
        </div>
        <button className="mobile-menu" onClick={() => setActive(active === "history" ? "analyzer" : "history")} aria-label="Toggle navigation"><Menu size={20} /></button>
      </header>

      <main>
        {active === "history" ? (
          <section className="history-page">
            <p className="eyebrow"><Clock3 size={14} /> YOUR WORKSPACE</p>
            <div className="history-heading"><div><h1>Your resume reviews</h1><p>Every review, all in one place. Keep getting better.</p></div><button className="button button-primary" onClick={() => { setActive("analyzer"); setResult(null); }}><Plus size={16} /> New review</button></div>
            {shownHistory.length ? <div className="history-list">{shownHistory.map((item) => <article className="history-card" key={item.id}><div className="history-icon"><FileText size={20} /></div><button className="history-main" onClick={() => openEntry(item)}><strong>{item.title}</strong><span>{dateLabel(item.date)} <i>·</i> {item.result.source === "openai" ? "AI review" : "Resume review"}</span></button><div className="history-score"><strong>{item.result.score}</strong><span>score</span></div><button className="icon-button delete-button" onClick={() => removeEntry(item)} aria-label={`Delete ${item.title}`}><Trash2 size={16} /></button></article>)}</div> : <div className="empty-history"><div><FileText size={28} /></div><h2>Your next review starts here</h2><p>Analyze a resume and it will appear here, ready whenever you need it.</p><button className="button button-primary" onClick={() => { setActive("analyzer"); setResult(null); }}>Analyze a resume <ArrowRight size={16} /></button></div>}
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow hero-label"><span className="live-dot" /> YOUR CAREER, A LITTLE CLEARER</div>
                <h1>Good work deserves<br />a <span>great resume.</span></h1>
                <p className="hero-description">A thoughtful second look at your resume, so the right people notice what you bring.</p>
                <div className="hero-trust"><span><Check size={14} /> Useful, honest feedback</span><span><Check size={14} /> No recruiter guesswork</span></div>
              </div>
              <div className="hero-art" aria-label="Resume review illustration">
                <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
                <div className="art-glow"></div>
                <div className="resume-paper">
                  <div className="paper-top"><span></span><i></i><i></i></div>
                  <div className="paper-person"><span></span><div><b></b><small></small></div></div>
                  <div className="paper-section"><strong>EXPERIENCE</strong><i></i><i></i><i></i></div>
                  <div className="paper-section"><strong>EDUCATION</strong><i></i><i></i></div>
                  <div className="paper-section"><strong>SKILLS</strong><div className="paper-pills"><b></b><b></b><b></b></div></div>
                  <div className="paper-check"><Check size={18} /></div>
                </div>
                <div className="floating-note note-score"><span className="note-icon"><Target size={16} /></span><span><b>Clear direction</b><small>One step at a time</small></span></div>
                <div className="floating-note note-match"><span className="note-icon note-icon-green"><BadgeCheck size={17} /></span><span><b>A better match</b><small>Skills, made visible</small></span></div>
                <div className="art-sparkle sparkle-a">✳</div><div className="art-sparkle sparkle-b">✳</div>
              </div>
              <div className="hero-index"><span>01</span> / A BETTER FIRST IMPRESSION</div>
            </section>

            <section className="workspace" id="analyzer">
              <div className="section-heading">
                <div><p className="eyebrow"><span className="step-number">01</span> START WITH THE BASICS</p><h2>Let’s take a look.</h2><p className="section-subtitle">A little context makes for much more useful feedback.</p></div>
                <div className="demo-pill"><span></span> Free to try · no account needed</div>
              </div>

              <form className="analyzer-grid" onSubmit={runAnalysis}>
                <div className="input-column">
                  <div className="input-card resume-card">
                    <div className="field-heading"><div className="field-icon"><FileText size={17} /></div><div><label htmlFor="resume">Your resume</label><p>Paste your text or add a PDF</p></div><span className="required-tag">REQUIRED</span></div>
                    <label className={`upload-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
                      <input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files[0])} hidden />
                      {file ? <><div className="upload-icon upload-success"><CheckCircle2 size={20} /></div><div className="upload-copy"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to review</span></div><button type="button" className="remove-file" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFile(null); if (fileInput.current) fileInput.current.value = ""; }}>Remove</button></> : <><div className="upload-icon"><Upload size={19} /></div><div className="upload-copy"><strong>Drop your resume here, or <em>browse</em></strong><span>PDF only · Up to 5 MB</span></div><FileUp className="upload-trailing" size={18} /></>}
                    </label>
                    <div className="or-divider"><span>OR PASTE YOUR RESUME</span></div>
                    <textarea id="resume" className="resume-textarea" placeholder="Paste your resume text here — experience, skills, education, anything you’d like feedback on…" value={resumeText} onChange={(event) => { setResumeText(event.target.value); setFile(null); if (fileInput.current) fileInput.current.value = ""; setError(""); }} maxLength={30000} />
                    <div className="textarea-footer"><span>{file ? "PDF text is extracted securely for analysis" : "Your resume stays yours. We don’t store demo reviews."}</span><span>{wordCount} words</span></div>
                  </div>

                  <div className="input-card job-card">
                    <div className="field-heading"><div className="field-icon field-icon-blue"><BriefcaseBusiness size={17} /></div><div><label htmlFor="job">The role you’re after</label><p>We’ll look for the right things</p></div><span className="optional-tag">OPTIONAL</span></div>
                    <textarea id="job" className="job-textarea" placeholder="Paste the job description for a more tailored review…" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} maxLength={12000} />
                    <div className="job-hint"><Lightbulb size={14} /><span>No job description? We’ll still review your resume’s structure and clarity.</span></div>
                  </div>
                  {error && <p className="inline-error" role="alert"><CircleHelp size={15} />{error}</p>}
                  <button className="button button-primary analyze-button" type="submit" disabled={loading}><span>{loading ? "Taking a closer look…" : "Review my resume"}</span>{loading ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
                  <p className="submit-note"><LockKeyhole size={13} /> Private by design. Your resume isn’t used to train AI.</p>
                </div>

                <aside className="side-column">
                  <div className="side-card how-card"><p className="eyebrow"><Sparkles size={13} /> A THOUGHTFUL REVIEW</p><h3>Not just a score.<br />A clearer next step.</h3><div className="how-step"><span>1</span><p><strong>See what’s working</strong><small>Get credit for the strengths you already have.</small></p></div><div className="how-step"><span>2</span><p><strong>Spot what’s missing</strong><small>Understand where your resume could land better.</small></p></div><div className="how-step"><span>3</span><p><strong>Make it more you</strong><small>Leave with practical ideas, never generic advice.</small></p></div><div className="side-card-foot"><span className="avatar-stack"><i>R</i><i>J</i><i>A</i></span><span>Made for real people, not perfect resumes.</span></div></div>
                  <div className="side-card privacy-card"><div className="privacy-icon"><ShieldCheck size={18} /></div><div><strong>Your story stays yours.</strong><p>Demo reviews stay in this browser. You choose if you want to save them to an account.</p></div><ChevronDown size={15} /></div>
                  <div className="side-note"><span>“</span><p>The best resume isn’t the fanciest one. It’s the one that sounds like you, on your very best day.</p><small>A GENTLE REMINDER</small></div>
                </aside>
              </form>
            </section>

            {result && <section className="results-section" ref={resultsRef}>
              <div className="results-title"><div><p className="eyebrow"><span className="step-number">02</span> YOUR PERSONAL REVIEW</p><h2>Here’s your starting point.</h2><p className="section-subtitle">{result.summary}</p></div><div className="result-actions"><span className={result.source === "openai" ? "source-chip ai-source" : "source-chip"}><Sparkles size={13} />{result.source === "openai" ? "AI-assisted" : "Instant review"}</span><button className="button button-outline export-button" onClick={exportResult}>Export report <ArrowDown size={15} /></button></div></div>
              <div className="result-grid">
                <article className="result-card score-card"><div className="result-card-label"><Gauge size={16} /> RESUME READINESS</div><div className="score-display"><span>{result.score}</span><small>/ 100</small></div><div className="score-track"><i style={{ width: `${result.score}%` }} /></div><p>{result.score >= 80 ? "You’ve built a strong foundation. Let’s polish the details." : result.score >= 60 ? "There’s good material here. A few thoughtful changes can help." : "A solid first draft. Let’s make your best work easier to see."}</p><div className="score-foot"><ShieldCheck size={14} /> A guide, not a verdict</div></article>
                <article className="result-card sections-card"><div className="result-card-label"><ScanSearch size={16} /> THE ESSENTIALS</div><h3>A well-rounded story</h3><p className="result-muted">Core sections recruiters typically look for.</p><div className="section-checks">{result.sections.map((section) => <div key={section.name} className={section.present ? "section-row present" : "section-row"}><span className="check-box">{section.present ? <Check size={12} /> : <Plus size={12} />}</span>{section.name}<span className="section-state">{section.present ? "There" : "Add"}</span></div>)}</div></article>
                <article className="result-card keyword-card"><div className="result-card-label"><Target size={16} /> YOUR SKILLS, IN CONTEXT</div><h3>Language that connects</h3><p className="result-muted">The overlap between your resume and the role.</p><div className="keyword-label"><CheckCircle2 size={14} /> Already shining through <span>{result.matchedKeywords.length}</span></div><div className="keyword-chips">{result.matchedKeywords.length ? result.matchedKeywords.map((word) => <span className="keyword-chip matched" key={word}>{word}</span>) : <span className="muted-small">Add a role description to see matching terms.</span>}</div><div className="keyword-label missing-label"><Plus size={14} /> Worth weaving in <span>{result.missingKeywords.length}</span></div><div className="keyword-chips">{result.missingKeywords.length ? result.missingKeywords.slice(0, 8).map((word) => <span className="keyword-chip missing" key={word}>{word}</span>) : <span className="muted-small">No gaps surfaced yet.</span>}</div></article>
                <article className="result-card feedback-card"><div className="result-card-label"><Lightbulb size={16} /> A FEW THOUGHTFUL NOTES</div><h3>Small shifts, real impact.</h3><div className="feedback-columns"><div><p className="feedback-label positive-label"><CheckCircle2 size={14} /> What’s already working</p>{result.strengths.map((text, index) => <p className="feedback-item" key={index}><span className="feedback-bullet positive-bullet">✓</span>{text}</p>)}</div><div><p className="feedback-label"><ArrowUpRight size={14} /> A place to start</p>{result.suggestions.map((text, index) => <p className="feedback-item" key={index}><span className="feedback-bullet">{String(index + 1).padStart(2, "0")}</span>{text}</p>)}</div></div><div className="feedback-foot"><span>This is a starting point, not a verdict. You know your story best.</span><button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Make a change <ArrowUpRight size={14} /></button></div></article>
              </div>
            </section>}

            <section className="bottom-cta"><div className="cta-mark"><Sparkles size={19} /></div><div><strong>Your next chapter is yours to write.</strong><p>Keep a record of your progress and come back whenever you’re ready.</p></div><button className="button button-outline" onClick={() => user ? setActive("history") : setModal(true)}>{user ? "View your reviews" : "Save your reviews"} <ArrowRight size={15} /></button></section>
          </>
        )}
      </main>
      <footer className="footer"><a className="brand footer-brand" href="#" onClick={(event) => { event.preventDefault(); setActive("analyzer"); }}><span className="brand-mark"><Sparkles size={14} fill="currentColor" /></span><span>resume<span className="brand-light">insight</span></span></a><span>Thoughtful tools for your next chapter.</span><span className="footer-right">A LITTLE MORE CONFIDENCE, ONE STEP AT A TIME <span>✳</span></span></footer>
      {modal && <Modal onClose={() => setModal(false)} onSignedIn={signedIn} />}
    </div>
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
