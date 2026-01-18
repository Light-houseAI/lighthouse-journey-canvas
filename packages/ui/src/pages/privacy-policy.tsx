import { useEffect } from 'react';

import logoImage from '../assets/images/logo-1024.png';

/**
 * Privacy Policy Page
 * Publicly accessible page displaying Lighthouse AI's privacy policy
 */
export default function PrivacyPolicy() {
  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .privacy-page-wrapper {
          display: flex;
          min-height: 100vh;
        }

        .privacy-sidebar {
          width: 280px;
          background: #FFFFFF;
          border-right: 1px solid #E5E7EB;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 1px solid #E5E7EB;
        }

        .sidebar-logo {
          width: 36px;
          height: 36px;
        }

        .sidebar-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .sidebar-brand {
          font-weight: 600;
          font-size: 16px;
          color: #1D1E21;
        }

        .toc-title {
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #9CA3AF;
          margin-bottom: 12px;
        }

        .toc-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .toc-list li {
          margin-bottom: 4px;
        }

        .toc-list a {
          display: block;
          padding: 10px 12px;
          color: #5F6368;
          text-decoration: none;
          font-size: 14px;
          border-radius: 6px;
          transition: all 0.2s;
          border-left: 2px solid transparent;
        }

        .toc-list a:hover {
          background: #F0FDF4;
          color: #3D6E63;
        }

        .privacy-main-content {
          flex: 1;
          margin-left: 280px;
          padding: 48px;
          max-width: 900px;
        }

        .privacy-header {
          margin-bottom: 40px;
          padding-bottom: 32px;
          border-bottom: 1px solid #E5E7EB;
        }

        .privacy-header-title {
          font-weight: 700;
          font-size: 32px;
          line-height: 40px;
          color: #1D1E21;
          margin-bottom: 8px;
        }

        .privacy-header-subtitle {
          font-size: 16px;
          color: #5F6368;
        }

        .last-updated {
          font-size: 14px;
          color: #9CA3AF;
          margin-top: 12px;
        }

        .privacy-content {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0px 0px 42px rgba(0, 0, 0, 0.08);
        }

        .privacy-section {
          margin-bottom: 40px;
          padding-bottom: 32px;
          border-bottom: 1px solid #E5E7EB;
        }

        .privacy-section:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .section-title {
          font-weight: 700;
          font-size: 22px;
          line-height: 30px;
          color: #1D1E21;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-title .icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F0FDF4;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .section-title .icon svg {
          width: 18px;
          height: 18px;
          stroke: #3D6E63;
        }

        .privacy-section p {
          font-size: 15px;
          line-height: 24px;
          color: #5F6368;
          margin-bottom: 16px;
        }

        .privacy-section p:last-child {
          margin-bottom: 0;
        }

        .subsection {
          margin-top: 24px;
        }

        .subsection-title {
          font-weight: 600;
          font-size: 16px;
          color: #1D1E21;
          margin-bottom: 12px;
        }

        .privacy-section ul {
          margin-left: 20px;
          margin-bottom: 16px;
          padding: 0;
        }

        .privacy-section li {
          font-size: 15px;
          line-height: 24px;
          color: #5F6368;
          margin-bottom: 8px;
        }

        .privacy-section li:last-child {
          margin-bottom: 0;
        }

        .highlight-box {
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .highlight-box.info {
          background: #EEF2FF;
          border-left: 4px solid #6366F1;
        }

        .highlight-box.security {
          background: #F0FDF4;
          border-left: 4px solid #27AE60;
        }

        .highlight-box p {
          color: #1D1E21;
          margin-bottom: 0;
        }

        .highlight-box strong {
          font-weight: 600;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 14px;
        }

        .data-table th,
        .data-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #E5E7EB;
        }

        .data-table th {
          background: #F8F9FA;
          font-weight: 600;
          color: #1D1E21;
        }

        .data-table td {
          color: #5F6368;
        }

        .data-table tr:last-child td {
          border-bottom: none;
        }

        .contact-card {
          background: #F8F9FA;
          border-radius: 12px;
          padding: 24px;
          margin-top: 20px;
        }

        .contact-card p {
          margin-bottom: 8px;
        }

        .contact-card p:last-child {
          margin-bottom: 0;
        }

        .contact-card a {
          color: #3D6E63;
          text-decoration: none;
        }

        .contact-card a:hover {
          text-decoration: underline;
        }

        .privacy-footer {
          text-align: center;
          padding: 32px 24px;
          color: #9CA3AF;
          font-size: 14px;
          margin-top: 40px;
        }

        .privacy-footer a {
          color: #3D6E63;
          text-decoration: none;
        }

        .privacy-footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 1024px) {
          .privacy-sidebar {
            width: 240px;
          }

          .privacy-main-content {
            margin-left: 240px;
            padding: 32px;
          }
        }

        @media (max-width: 768px) {
          .privacy-page-wrapper {
            flex-direction: column;
          }

          .privacy-sidebar {
            position: relative;
            width: 100%;
            height: auto;
            border-right: none;
            border-bottom: 1px solid #E5E7EB;
          }

          .privacy-main-content {
            margin-left: 0;
            padding: 24px 16px;
          }

          .privacy-content {
            padding: 24px;
          }

          .privacy-header-title {
            font-size: 26px;
          }

          .section-title {
            font-size: 20px;
          }
        }
      `}</style>

      <div className="privacy-page-wrapper">
        {/* Sidebar Table of Contents */}
        <aside className="privacy-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src={logoImage} alt="Lighthouse AI logo" />
            </div>
            <span className="sidebar-brand">Lighthouse AI</span>
          </div>

          <h2 className="toc-title">Table of Contents</h2>
          <ul className="toc-list">
            <li><a href="#introduction">1. Introduction</a></li>
            <li><a href="#information-we-collect">2. Information We Collect</a></li>
            <li><a href="#how-we-use">3. How We Use Your Information</a></li>
            <li><a href="#data-storage">4. Data Storage & Security</a></li>
            <li><a href="#third-party">5. Third-Party Services</a></li>
            <li><a href="#your-rights">6. Your Rights & Controls</a></li>
            <li><a href="#data-retention">7. Data Retention</a></li>
            <li><a href="#cookies">8. Cookies & Tracking</a></li>
            <li><a href="#changes">9. Changes to This Policy</a></li>
            <li><a href="#contact">10. Contact Us</a></li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="privacy-main-content">
          <header className="privacy-header">
            <h1 className="privacy-header-title">Privacy Policy</h1>
            <p className="privacy-header-subtitle">How Lighthouse AI collects, uses, and protects your information</p>
            <p className="last-updated">Last Updated: January 18, 2026</p>
          </header>

          <div className="privacy-content">
            {/* Section 1: Introduction */}
            <section id="introduction" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                  </svg>
                </span>
                1. Introduction
              </h2>
              <p>Welcome to Lighthouse AI ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you understand how your personal information is collected, used, and safeguarded when you use our desktop application and related services (collectively, the "Service").</p>
              <p>Lighthouse AI is a productivity tool that captures screenshots of your work to help document your workflows and skills. This Privacy Policy explains our practices regarding the data we collect and how we handle it.</p>
            </section>

            {/* Section 2: Information We Collect */}
            <section id="information-we-collect" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </span>
                2. Information We Collect
              </h2>

              <div className="subsection">
                <h3 className="subsection-title">2.1 Screenshot Data</h3>
                <p>Lighthouse AI captures periodic screenshots while you work in your selected applications. This is the core functionality of our Service.</p>
                <ul>
                  <li><strong>Screenshots:</strong> Images of your screen from applications you explicitly select for tracking</li>
                  <li><strong>Timestamps:</strong> When each screenshot was captured</li>
                  <li><strong>Application context:</strong> Which application was active, window titles, and application metadata</li>
                </ul>
              </div>

              <div className="subsection">
                <h3 className="subsection-title">2.2 AI-Generated Content</h3>
                <p>Our Service generates the following content based on your screenshots:</p>
                <ul>
                  <li>Text summaries describing your workflow activities</li>
                  <li>Skill and competency analyses</li>
                  <li>Workflow documentation and reports</li>
                </ul>
              </div>
            </section>

            {/* Section 3: How We Use Your Information */}
            <section id="how-we-use" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </span>
                3. How We Use Your Information
              </h2>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Purpose</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Core Service Delivery</strong></td>
                    <td>To capture, analyze, and summarize your workflows using AI technology</td>
                  </tr>
                  <tr>
                    <td><strong>Workflow Documentation</strong></td>
                    <td>To generate text summaries and reports of your work activities</td>
                  </tr>
                  <tr>
                    <td><strong>Account Management</strong></td>
                    <td>To create and manage your account, authenticate your identity, and provide customer support</td>
                  </tr>
                  <tr>
                    <td><strong>Service Improvement</strong></td>
                    <td>To analyze usage patterns and improve our Service's features and performance</td>
                  </tr>
                  <tr>
                    <td><strong>Communications</strong></td>
                    <td>To send you important updates, security alerts, and support messages</td>
                  </tr>
                  <tr>
                    <td><strong>Legal Compliance</strong></td>
                    <td>To comply with legal obligations and protect our rights</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Section 4: Data Storage & Security */}
            <section id="data-storage" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                </span>
                4. Data Storage & Security
              </h2>

              <div className="highlight-box security">
                <p><strong>Local-First Architecture:</strong> Your screenshots are stored locally on your device. Only AI-generated text summaries and metadata are synced to our servers—actual screenshot images never leave your machine unless you explicitly choose to share them.</p>
              </div>

              <div className="subsection">
                <h3 className="subsection-title">4.1 Security Measures</h3>
                <p>We implement industry-standard security measures to protect your data:</p>
                <ul>
                  <li>Encryption of data in transit using TLS/SSL</li>
                  <li>Encryption of data at rest</li>
                  <li>Secure authentication mechanisms</li>
                  <li>Regular security audits and monitoring</li>
                  <li>Access controls and employee data handling policies</li>
                </ul>
              </div>

              <div className="subsection">
                <h3 className="subsection-title">4.2 Built-in Privacy Protections</h3>
                <p>Lighthouse AI includes automatic protections to prevent capturing sensitive information:</p>
                <ul>
                  <li><strong>Password Field Detection:</strong> Screenshots are automatically skipped when you're typing in password fields or secure input dialogs</li>
                  <li><strong>Sensitive App Detection:</strong> Automatic skip for password managers (1Password, Bitwarden, LastPass), banking applications, and other sensitive apps</li>
                  <li><strong>Private Browsing Protection:</strong> Screenshots are skipped in incognito/private browser windows (Chrome Incognito, Safari Private, Firefox Private Browsing)</li>
                </ul>
              </div>
            </section>

            {/* Section 5: Third-Party Services */}
            <section id="third-party" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <path d="M20 8v6"/>
                    <path d="M23 11h-6"/>
                  </svg>
                </span>
                5. Third-Party Services
              </h2>

              <div className="subsection">
                <h3 className="subsection-title">5.1 AI Service Providers</h3>
                <div className="highlight-box info">
                  <p>Lighthouse AI utilizes business-grade API services provided by third-party large language model (LLM) providers, including <strong>OpenAI</strong> and <strong>Google Gemini</strong>. Data transmitted to these providers is processed exclusively to perform inference and generate responses for the Service, in accordance with their applicable API terms and data usage policies. <strong>Data submitted through these business-grade API services is excluded from use in model training and improvement.</strong></p>
                </div>
              </div>

              <div className="subsection">
                <h3 className="subsection-title">5.2 Other Third-Party Services</h3>
                <p>We may use additional third-party services for:</p>
                <ul>
                  <li><strong>Analytics:</strong> To understand how users interact with our Service (anonymized and aggregated data)</li>
                  <li><strong>Cloud Infrastructure:</strong> To securely store and process data</li>
                  <li><strong>Authentication:</strong> To verify user identity securely</li>
                  <li><strong>Payment Processing:</strong> To handle subscription payments (if applicable)</li>
                </ul>
                <p>We carefully select third-party providers who maintain appropriate security standards and contractual data protection commitments.</p>
              </div>
            </section>

            {/* Section 6: Your Rights & Controls */}
            <section id="your-rights" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                </span>
                6. Your Rights & Controls
              </h2>

              <div className="subsection">
                <h3 className="subsection-title">6.1 Application Controls</h3>
                <p>You have full control over how Lighthouse AI captures and processes your data:</p>
                <ul>
                  <li><strong>Choose Which Apps to Track:</strong> You select which applications Lighthouse monitors. We only capture screenshots from apps you explicitly choose for each work track.</li>
                  <li><strong>Configurable Privacy Settings:</strong> Customize which security protections are enabled in Settings. Toggle detection for password fields, sensitive apps, private browsing, and terminal applications.</li>
                  <li><strong>Review Before Syncing:</strong> Review AI-generated summaries before pushing them to your account. Edit or delete any content you don't want to keep.</li>
                  <li><strong>Pause/Resume Capture:</strong> Pause screenshot capture at any time</li>
                </ul>
              </div>

              <div className="subsection">
                <h3 className="subsection-title">6.2 Your Data Rights</h3>
                <p>Depending on your location, you may have the following rights:</p>
                <ul>
                  <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate personal data</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                  <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
                  <li><strong>Objection:</strong> Object to certain processing of your personal data</li>
                  <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
                  <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
                </ul>
                <p>To exercise any of these rights, please contact us using the information provided in the Contact section below.</p>
              </div>
            </section>

            {/* Section 7: Data Retention */}
            <section id="data-retention" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                7. Data Retention
              </h2>
              <p>We retain your data for as long as necessary to provide you with the Service and fulfill the purposes described in this Privacy Policy:</p>
              <ul>
                <li><strong>Screenshots:</strong> Stored locally on your device; you control deletion</li>
                <li><strong>AI-Generated Summaries:</strong> Retained while your account is active or as needed for service delivery</li>
                <li><strong>Account Information:</strong> Retained while your account is active</li>
                <li><strong>Usage Data:</strong> Retained for analytics purposes in anonymized/aggregated form</li>
              </ul>
            </section>

            {/* Section 8: Cookies & Tracking */}
            <section id="cookies" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <circle cx="15.5" cy="8.5" r="1.5"/>
                    <circle cx="15.5" cy="15.5" r="1.5"/>
                    <circle cx="8.5" cy="15.5" r="1.5"/>
                  </svg>
                </span>
                8. Cookies & Tracking Technologies
              </h2>
              <p>As a desktop application, Lighthouse AI does not use browser cookies. However, we may use:</p>
              <ul>
                <li><strong>Local Storage:</strong> To store your preferences and settings on your device</li>
                <li><strong>Analytics Tools:</strong> To collect anonymized usage statistics to improve our Service</li>
                <li><strong>Authentication Tokens:</strong> To maintain your logged-in session securely</li>
              </ul>
              <p>If you access any web-based components of our Service, standard web technologies may be used in accordance with industry practices.</p>
            </section>

            {/* Section 9: Changes to This Policy */}
            <section id="changes" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </span>
                9. Changes to This Policy
              </h2>
              <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons.</p>
              <p>When we make material changes, we will update the "Last Updated" date at the top of this policy.</p>
              <p>We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.</p>
            </section>

            {/* Section 10: Contact Us */}
            <section id="contact" className="privacy-section">
              <h2 className="section-title">
                <span className="icon">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                10. Contact Us
              </h2>
              <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>

              <div className="contact-card">
                <p><strong>Lighthouse AI</strong></p>
                <p>Email: <a href="mailto:support@light-houseai.com">support@light-houseai.com</a></p>
              </div>

              <p style={{ marginTop: '20px' }}>For data protection inquiries or to exercise your privacy rights, please include "Privacy Request" in your email subject line, and we will respond within 30 days.</p>
            </section>
          </div>

          <footer className="privacy-footer">
            <p>&copy; 2026 Lighthouse AI. All rights reserved.</p>
            <p style={{ marginTop: '8px' }}>
              <a href="/terms-of-service">Terms of Service</a> &bull;{' '}
              <a href="/privacy-policy">Privacy Policy</a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
