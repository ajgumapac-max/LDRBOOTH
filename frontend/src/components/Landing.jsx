import { useState } from "react";

const steps = [
  ["01", "Create or join", "Start a private booth or enter your invite code.", "⌁"],
  ["02", "Pose together", "See each other live and follow playful prompts.", "♡"],
  ["03", "Capture memories", "Snap in sync, wherever you both are.", "◉"],
  ["04", "Get your photos", "Pick your favorites to download or print.", "✦"],
];
const features = [
  ["↗", "Designed for two people", "A shared space that feels easy from the first hello."],
  ["◉", "Live camera connection", "See the reaction, not just the result."],
  ["✦", "Fun pose prompts", "Never wonder what to do with your hands again."],
  ["⌁", "Synchronized photos", "One moment, captured together."],
  ["♡", "Shared photo selection", "Choose your favorites as a team."],
  ["↓", "Download and print", "Keep the memory close, online or on your wall."],
];

export default function Landing({ onCreate, onJoin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (action) => { setMenuOpen(false); action(); };

  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Main navigation">
      <a className="landing-logo" href="#top" aria-label="LDRBOOTH home"><LogoMark /><span>LDRBOOTH</span></a>
      <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="landing-menu"><span className="sr-only">Toggle menu</span><i /><i /><i /></button>
      <div className={`landing-menu ${menuOpen ? "landing-menu--open" : ""}`} id="landing-menu">
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a><a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <button className="nav-link-button" onClick={() => go(onCreate)}>Create Booth</button><button className="nav-join" onClick={() => go(onJoin)}>Join Booth</button>
      </div>
    </nav>

    <section className="hero" id="top"><div className="hero-copy"><p className="landing-kicker"><span /> Made for moments apart</p><h1>Two places.<br /><em>One memory.</em></h1><p className="hero-description">Create a photobooth memory together, even when you’re miles apart. Just open a booth, connect, and make it yours.</p><div className="hero-actions"><button className="landing-button landing-button--primary" onClick={onCreate}>Create a Booth <span>→</span></button><button className="landing-button landing-button--secondary" onClick={onJoin}>Join a Booth</button></div><p className="hero-note">✦ No app download needed</p></div><HeroVisual /></section>

    <section className="landing-section how-section" id="how-it-works"><p className="landing-kicker"><span /> How it works</p><h2>Long distance,<br /><em>close moments.</em></h2><p className="section-intro">A little shared ritual for the people you want to feel closer to.</p><div className="steps-grid">{steps.map(([number, title, text, icon]) => <article className="step-card" key={number}><span>{number}</span><div className="step-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="memory-section"><div className="memory-copy"><p className="landing-kicker"><span /> Yours to keep</p><h2>More than<br />a screenshot.</h2><p>Turn a shared laugh into a little keepsake — ready to save, send, or print.</p><a href="#features">See what makes it special <b>→</b></a></div><PhotoStrip /></section>
    <section className="landing-section feature-section" id="features"><p className="landing-kicker"><span /> Why LDRBOOTH</p><h2>A booth built for<br /><em>the two of you.</em></h2><div className="feature-list">{features.map(([icon, title, text]) => <article className="feature-card" key={title}><div>{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="people-section"><div><p className="landing-kicker"><span /> For your people</p><h2>Who will you<br /><em>booth with?</em></h2></div><div className="people-tags"><span>Long-distance couples</span><span>Best friends</span><span>Siblings</span><span>Two creators</span><span>Anyone making memories remotely</span></div></section>
    <section className="final-cta"><div className="final-cta__spark">✦</div><p className="landing-kicker"><span /> Your moment is waiting</p><h2>Ready to make<br /><em>a memory?</em></h2><button className="landing-button landing-button--primary" onClick={onCreate}>Create Your Booth <span>→</span></button></section>
    <footer className="landing-footer"><a className="landing-logo" href="#top"><LogoMark /><span>LDRBOOTH</span></a><p>Two places. One memory.</p><small>Made for shared moments, wherever you are.</small></footer>
  </main>;
}

function LogoMark() { return <svg viewBox="0 0 30 24" aria-hidden="true"><path d="M14.8 21.2C8.8 18.2 3 13.5 3 7.9 3 3 9 .9 14.8 7.2 20.6.9 27 3 27 7.9c0 5.6-6 10.3-12.2 13.3Z" fill="currentColor" /><path d="M14.8 7.2v14" stroke="#fff5ef" strokeWidth="1.5" /></svg>; }
function PersonOne() { return <svg viewBox="0 0 170 215" aria-hidden="true"><rect width="170" height="215" fill="#F6B5AB"/><circle cx="88" cy="79" r="41" fill="#C87855"/><path d="M43 78c-1-53 86-62 91-6-16-20-54-28-91 6Z" fill="#482D34"/><path d="M26 216c5-52 29-75 63-75s61 23 68 75" fill="#E66480"/><circle cx="74" cy="82" r="3" fill="#3A272C"/><circle cx="103" cy="82" r="3" fill="#3A272C"/><path d="M79 101c7 5 15 5 22 0" fill="none" stroke="#803D46" strokeWidth="3" strokeLinecap="round"/></svg>; }
function PersonTwo() { return <svg viewBox="0 0 170 215" aria-hidden="true"><rect width="170" height="215" fill="#A9C8C6"/><circle cx="82" cy="80" r="41" fill="#9B6247"/><path d="M38 72c7-50 91-55 94 1-25-23-67-24-94-1Z" fill="#2F333A"/><path d="M17 215c8-50 30-74 66-74 35 0 64 25 71 74" fill="#F2D878"/><circle cx="68" cy="83" r="3" fill="#302629"/><circle cx="97" cy="83" r="3" fill="#302629"/><path d="M74 103c7 5 15 5 22 0" fill="none" stroke="#754038" strokeWidth="3" strokeLinecap="round"/></svg>; }
function HeroVisual() { return <div className="hero-visual" aria-label="Illustration of two people connected in a virtual photobooth"><div className="orbit orbit--one"/><div className="orbit orbit--two"/><div className="video-card video-card--left"><PersonOne /><span className="video-name">Kristel <b /></span></div><div className="video-card video-card--right"><PersonTwo /><span className="video-name">Josh <b /></span></div><div className="connection-line"><span>♡</span></div><div className="countdown-bubble">3</div><div className="heart-sticker">♥</div><div className="snap-label">SAY CHEESE!</div></div>; }
function PhotoStrip() { return <div className="photo-strip"><div className="photo-strip__top">LDRBOOTH <span>09.22.26</span></div><div className="strip-photo strip-photo--one"><PersonOne /><PersonTwo /></div><div className="strip-photo strip-photo--two"><span>♡</span><PersonTwo /><PersonOne /></div><div className="strip-photo strip-photo--three"><PersonOne /><PersonTwo /></div><p>still my favorite place<br />to be with you <b>♥</b></p></div>; }
