import { useEffect, useState } from "react";

const INTRO_TEXT = "PORTFOLIO";

export function PortfolioIntro() {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), 5000);
    const removeTimer = window.setTimeout(() => setVisible(false), 5700);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`portfolio-intro${exiting ? " is-exiting" : ""}`}
      role="status"
      aria-label="Kottu Saikumar portfolio"
    >
      <div className="portfolio-intro-orb" aria-hidden="true" />
      <div className="portfolio-intro-grid" aria-hidden="true" />
      <div className="portfolio-intro-content">
        <p className="portfolio-intro-kicker">KOTTU SAIKUMAR</p>
        <div className="portfolio-intro-loader" aria-hidden="true">
          {Array.from(INTRO_TEXT).map((letter, index) => (
            <span
              className="portfolio-intro-letter"
              key={`${letter}-${index}`}
              style={{ animationDelay: `${0.1 + index * 0.105}s` }}
            >
              {letter}
            </span>
          ))}
          <div className="portfolio-intro-scan" />
        </div>
        <p className="portfolio-intro-subtitle">FULL-STACK AI DEVELOPER</p>
        <div className="portfolio-intro-line" aria-hidden="true" />
      </div>
    </div>
  );
}
