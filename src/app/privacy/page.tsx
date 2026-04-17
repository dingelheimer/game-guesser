// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    absolute: "Privacy Policy | Game Guesser",
  },
  description:
    "Game Guesser privacy policy. Learn what data we collect, how we use it, and your rights under GDPR and other privacy regulations.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-text-primary text-xl font-bold">
        {title}
      </h2>
      <div className="text-text-secondary space-y-3 text-sm leading-7">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="border-border/50 w-full min-w-[500px] border text-sm">
        <thead>
          <tr className="border-border/50 bg-surface-800 border-b">
            {headers.map((h) => (
              <th key={h} className="text-text-primary px-4 py-3 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-border/30 border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="text-text-secondary px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Static privacy policy page covering all current and planned data practices. */
export default function PrivacyPage() {
  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <article className="w-full max-w-3xl space-y-10">
        {/* Header */}
        <header className="space-y-3">
          <p className="text-primary-300 text-sm font-semibold tracking-[0.22em] uppercase">
            Legal
          </p>
          <h1 className="font-display text-text-primary text-4xl font-bold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-text-secondary text-sm">
            Last updated: <time dateTime="2026-04-17">17 April 2026</time>
          </p>
          <p className="text-text-secondary text-sm leading-7">
            This privacy policy explains what data Game Guesser collects, why we collect it, and
            your rights regarding that data. We aim to be clear and honest — no legalese.
          </p>
        </header>

        {/* 1. Data Controller */}
        <Section id="controller" title="1. Data Controller">
          <p>
            Game Guesser is operated by <strong className="text-text-primary">Garbage Apps</strong>.
          </p>
          <p>
            <strong className="text-text-primary">Contact for privacy inquiries:</strong>{" "}
            <a
              href="mailto:garbag3.apps@gmail.com"
              className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
            >
              garbag3.apps@gmail.com
            </a>
          </p>
          <p className="text-text-disabled text-xs">
            We plan to migrate to a dedicated privacy address (privacy@gameguesser.com) via
            Cloudflare Email Routing in the future.
          </p>
        </Section>

        {/* 2. Data We Collect */}
        <Section id="data-collected" title="2. Data We Collect">
          <p>We collect only what we need to operate the service:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-text-primary">Account data</strong> — If you sign up, we
              store your email address and chosen username via Supabase Auth. Guest sessions use an
              anonymous identifier only.
            </li>
            <li>
              <strong className="text-text-primary">Game scores</strong> — When you submit a score
              to the leaderboard, we store your score, timestamp, and user ID.
            </li>
            <li>
              <strong className="text-text-primary">Preferences</strong> — Your cookie consent
              choice is stored in a browser cookie (<code className="font-mono">cc_cookie</code>).
              No personal data is in this cookie.
            </li>
            <li>
              <strong className="text-text-primary">Analytics</strong> — If you consent, Vercel
              Analytics collects aggregated page view and performance data. No individually
              identifying data is linked to you.
            </li>
          </ul>
          <p>We do not sell your data. We do not build advertising profiles.</p>
        </Section>

        {/* 3. Legal Basis */}
        <Section id="legal-basis" title="3. Legal Basis for Processing">
          <Table
            headers={["Processing Activity", "Legal Basis"]}
            rows={[
              ["Auth session (login, anonymous play)", "Contract — necessary to provide the service"],
              [
                "Leaderboard score submission",
                "Legitimate interest — expected feature of the game",
              ],
              ["Vercel Analytics", "Consent — only when analytics category is accepted"],
              [
                "Cookie consent record (cc_cookie)",
                "Legal obligation — required to demonstrate GDPR compliance",
              ],
              ["Ad serving (future)", "Consent — only when ads category is accepted"],
            ]}
          />
        </Section>

        {/* 4. Cookie Policy */}
        <Section id="cookies" title="4. Cookie Policy">
          <Table
            headers={["Cookie", "Purpose", "Duration", "Category"]}
            rows={[
              ["sb-* (Supabase)", "Auth session token", "Session / 1 week", "Necessary"],
              [
                "cc_cookie (vanilla-cookieconsent)",
                "Stores your consent choice",
                "6 months",
                "Necessary",
              ],
              ["va_* (Vercel Analytics)", "Aggregated analytics", "Session", "Analytics (opt-in)"],
              ["Ad network cookies (future)", "Ad serving & capping", "Varies", "Ads (opt-in)"],
            ]}
          />
          <p>
            You can update your cookie preferences at any time using the{" "}
            <strong className="text-text-primary">Privacy Settings</strong> link in the footer.
          </p>
        </Section>

        {/* 5. Third-Party Services */}
        <Section id="third-parties" title="5. Third-Party Services">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-text-primary">Supabase</strong> — Database and authentication
              provider. Processes auth data on our behalf under their{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
              >
                privacy policy
              </a>
              .
            </li>
            <li>
              <strong className="text-text-primary">Vercel</strong> — Hosting and analytics
              provider. See{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
              >
                Vercel&apos;s privacy policy
              </a>
              . Analytics only collected with your consent.
            </li>
            <li>
              <strong className="text-text-primary">IGDB / Twitch</strong> — Game database. We
              fetch game metadata (titles, release dates, screenshots) from the IGDB API at build /
              import time. No user data is sent to IGDB.
            </li>
            <li>
              <strong className="text-text-primary">Ad networks (future)</strong> — We may
              integrate ad networks in a future update. Ads will only load with your explicit
              consent. This policy will be updated before that change goes live.
            </li>
          </ul>
        </Section>

        {/* 6. Your Rights Under GDPR */}
        <Section id="gdpr-rights" title="6. Your Rights Under GDPR">
          <p>
            If you are in the European Economic Area (EEA), you have the following rights regarding
            your personal data:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-text-primary">Access</strong> — Request a copy of the
              personal data we hold about you.
            </li>
            <li>
              <strong className="text-text-primary">Rectification</strong> — Ask us to correct
              inaccurate data.
            </li>
            <li>
              <strong className="text-text-primary">Erasure</strong> — Ask us to delete your
              account and associated data (&ldquo;right to be forgotten&rdquo;).
            </li>
            <li>
              <strong className="text-text-primary">Portability</strong> — Request your data in a
              machine-readable format.
            </li>
            <li>
              <strong className="text-text-primary">Objection</strong> — Object to processing based
              on legitimate interest.
            </li>
            <li>
              <strong className="text-text-primary">Restriction</strong> — Ask us to restrict
              processing while a dispute is being resolved.
            </li>
            <li>
              <strong className="text-text-primary">Withdraw consent</strong> — Change your cookie
              and analytics preferences at any time via{" "}
              <strong className="text-text-primary">Privacy Settings</strong> in the footer.
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:garbag3.apps@gmail.com"
              className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
            >
              garbag3.apps@gmail.com
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        {/* 7. Children's Privacy */}
        <Section id="children" title="7. Children's Privacy">
          <p>
            Game Guesser is not directed at children under the age of 13. We do not knowingly
            collect personal data from children under 13 (COPPA). Under GDPR, users under 16 must
            have parental consent for data processing.
          </p>
          <p>
            If you believe a child has provided personal data without appropriate consent, please
            contact us and we will delete it promptly.
          </p>
        </Section>

        {/* 8. Data Retention */}
        <Section id="data-retention" title="8. Data Retention">
          <Table
            headers={["Data", "Retention Period"]}
            rows={[
              ["Auth account (email, username)", "Until account deletion"],
              ["Anonymous session", "Expires after session ends; no persistent data"],
              ["Leaderboard scores", "Indefinitely (they are public game records)"],
              ["Consent cookie (cc_cookie)", "6 months, then consent is re-requested"],
              ["Vercel analytics data", "Per Vercel's retention policy (typically 90 days)"],
            ]}
          />
          <p>
            You can delete your account at any time from your{" "}
            <Link
              href="/profile"
              className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
            >
              profile page
            </Link>
            . Account deletion removes your email, username, and associated scores.
          </p>
        </Section>

        {/* 9. CCPA */}
        <Section id="ccpa" title="9. California Privacy Rights (CCPA)">
          <p>
            Game Guesser does not sell personal information. Phase 0 of our ad rollout uses a
            NullProvider — no ad network receives any user data.
          </p>
          <p>
            When ad networks are integrated in a future update, we will add a &ldquo;Do Not Sell or
            Share My Personal Information&rdquo; control and update this policy accordingly.
          </p>
        </Section>

        {/* 10. Changes */}
        <Section id="changes" title="10. Policy Changes">
          <p>
            We may update this policy when our data practices change (e.g., when we add ad
            networks). Material changes will be announced on the site and the &ldquo;Last
            updated&rdquo; date at the top will be revised.
          </p>
          <p>
            If we make a change that requires re-consent for analytics or ads, the cookie consent
            banner will reappear to collect a fresh consent.
          </p>
        </Section>

        {/* 11. Contact */}
        <Section id="contact" title="11. Contact Us">
          <p>
            For any privacy-related questions, data subject requests, or concerns, please contact:
          </p>
          <p>
            <strong className="text-text-primary">Garbage Apps</strong>
            <br />
            Email:{" "}
            <a
              href="mailto:garbag3.apps@gmail.com"
              className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
            >
              garbag3.apps@gmail.com
            </a>
          </p>
          <p>
            You also have the right to lodge a complaint with your local data protection authority
            if you believe we are not handling your data correctly.
          </p>
        </Section>

        {/* Footer nav */}
        <div className="border-border/30 text-text-disabled border-t pt-6 text-xs">
          <Link
            href="/"
            className="hover:text-text-secondary transition-colors"
          >
            ← Back to Game Guesser
          </Link>
        </div>
      </article>
    </div>
  );
}
