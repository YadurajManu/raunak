"use client";

import { Reveal, Magnetic } from "@/lib/motion/primitives";
import { Download, Zap, QrCode, Sparkles, ShieldCheck } from "lucide-react";

export function AppDownload() {
  return (
    <section id="app" className="m-section m-app-section" aria-labelledby="app-title">
      <div className="m-container">
        <div className="m-app-card">
          <div className="m-app-content">
            <Reveal>
              <div className="m-eyebrow">
                <span className="m-pulse" />
                <span>RAUNAK FOR ANDROID &amp; IOS</span>
              </div>
              <h2 id="app-title" className="m-heading">
                Good plans,
                <br />
                <em className="m-serif">now in your pocket.</em>
              </h2>
              <p className="m-lead">
                Discover the best cultural gatherings, concerts, and workshops across India.
                Fast UPI reservations, gate-ready offline QR passes, and fluid iOS 26 Liquid Glass navigation.
              </p>
            </Reveal>

            <div className="m-app-features">
              <div className="m-app-feature-item">
                <div className="m-app-feature-icon">
                  <Zap size={18} />
                </div>
                <div>
                  <strong>UPI-First Instant Booking</strong>
                  <p>Google Pay, PhonePe, and Paytm with zero friction.</p>
                </div>
              </div>

              <div className="m-app-feature-item">
                <div className="m-app-feature-icon">
                  <QrCode size={18} />
                </div>
                <div>
                  <strong>Gate-Ready QR Passes</strong>
                  <p>Walk right in. High-contrast tickets work smoothly offline.</p>
                </div>
              </div>

              <div className="m-app-feature-item">
                <div className="m-app-feature-icon">
                  <Sparkles size={18} />
                </div>
                <div>
                  <strong>iOS 26 Liquid Glass UI</strong>
                  <p>Floating frosted navigation, tactile haptics, and zero layout shift.</p>
                </div>
              </div>
            </div>

            <div className="m-app-actions">
              <Magnetic>
                <a
                  href="/downloads/raunak-v1.0.0.apk"
                  download="raunak-v1.0.0.apk"
                  className="m-button m-app-download-btn"
                >
                  <Download size={18} aria-hidden="true" />
                  <span>Download Android APK</span>
                  <span className="m-app-version-badge">v1.0.0</span>
                </a>
              </Magnetic>

              <div className="m-app-specs">
                <span className="m-app-spec-tag">
                  <ShieldCheck size={14} /> Verified &amp; Signed
                </span>
                <span className="m-app-spec-tag">58.1 MB</span>
                <span className="m-app-spec-tag">Android 8.0+</span>
              </div>
            </div>
          </div>

          <div className="m-app-visual" aria-hidden="true">
            <div className="m-phone-mockup">
              <div className="m-phone-notch" />
              <div className="m-phone-screen">
                <div className="m-mockup-header">
                  <span className="m-mockup-logo">Raunak</span>
                  <span className="m-mockup-avatar" />
                </div>
                <div className="m-mockup-body">
                  <p className="m-mockup-eyebrow">CURATED DISCOVERY</p>
                  <h4>Find your next raunak.</h4>
                  <div className="m-mockup-search">
                    <span>Search events, venues, vibes…</span>
                  </div>
                  <div className="m-mockup-card">
                    <div className="m-mockup-card-art" />
                    <div className="m-mockup-card-details">
                      <strong>The Midnight Raga</strong>
                      <span>Friday · Hauz Khas, Delhi</span>
                      <div className="m-mockup-card-price">
                        <span>From ₹499</span>
                        <span className="m-mockup-pill">Get Tickets</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="m-mockup-nav">
                  <span className="m-nav-dot is-active" />
                  <span className="m-nav-dot" />
                  <span className="m-nav-dot" />
                  <span className="m-nav-dot" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
