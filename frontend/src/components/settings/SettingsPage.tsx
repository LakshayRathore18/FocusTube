"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen, Check, CircleCheck, ExternalLink, FileText, Info, LoaderCircle, LogOut, Monitor, Play, RefreshCw, Sparkles, UserRound } from "lucide-react";
import styles from "./SettingsPage.module.css";

type LearningStats = {
  totalPlaylists: number;
  totalVideos: number;
  completedVideos: number;
  personalNotes: number;
  aiSummaries: number;
};
const version = process.env.NEXT_PUBLIC_APP_VERSION || "2.0.0";

export default function SettingsPageClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    async function loadStats() {
      setLoading(true);
      setStatsError(false);
      try {
        const response = await fetch("/api/stats/learning", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error("Learning overview unavailable");
        const data = await response.json();
        if (typeof data?.totalPlaylists !== "number") throw new Error("Invalid learning overview");
        if (!controller.signal.aborted) setStats(data);
      } catch {
        if (!controller.signal.aborted) setStatsError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadStats();
    return () => controller.abort();
  }, [status, attempt]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut({ callbackUrl: "/sign-in" }); }
    finally { setSigningOut(false); }
  }

  const user = session?.user;
  const pct = stats && stats.totalVideos > 0 ? Math.min(100, Math.round(stats.completedVideos / stats.totalVideos * 100)) : 0;
  const statItems = [
    { icon: BookOpen, label: "Courses", value: stats?.totalPlaylists },
    { icon: CircleCheck, label: "Lessons completed", value: stats?.completedVideos },
    { icon: FileText, label: "Personal notes", value: stats?.personalNotes },
    { icon: Sparkles, label: "AI summaries", value: stats?.aiSummaries },
  ];

  if (status === "unauthenticated") return null;

  return (
    <div className={styles.page}><div className={styles.inner}>
      <header className={styles.pageHeader}><div><p className={styles.kicker}><span /> MAKE YOURSELF AT HOME</p><h1>Settings<span>.</span></h1><p>Your account, your learning, and a little about FocusTube.</p></div><span className={styles.versionBadge}>v{version}</span></header>
      {status === "error" ? <div className={styles.errorCard} role="alert"><h2>We couldn’t reach your account.</h2><p>Please reload the page to reconnect to the sign-in service.</p><button className={styles.secondaryButton} onClick={() => window.location.reload()}><RefreshCw size={15} aria-hidden="true" /> Reload page</button></div> : status === "loading" || !user ? <div className={styles.loadingPage} role="status" aria-label="Loading your settings"><div /><div /><div /></div> : (
        <div className={styles.settingsGrid}>
          <aside className={styles.sectionSidebar} aria-label="Settings sections">
            <p className={styles.sidebarLabel}>IN THIS SPACE</p>
            <nav><a href="#account"><UserRound size={17} aria-hidden="true" /> Account</a><a href="#your-learning"><BookOpen size={17} aria-hidden="true" /> Your learning</a><a href="#about"><Info size={17} aria-hidden="true" /> About FocusTube</a></nav>
            <div className={styles.sidebarNote}><span className={styles.brandMark}><Play size={18} fill="currentColor" aria-hidden="true" /></span><strong>FocusTube v2</strong><p>A calmer space for<br />your next big idea.</p><Link href="/courses">Back to learning <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
          </aside>
          <div className={styles.sections}>
            <section className={styles.sectionCard} id="account" aria-labelledby="account-heading">
              <div className={styles.sectionHeader}><span className={styles.sectionIcon}><UserRound size={19} aria-hidden="true" /></span><div><h2 id="account-heading">Your account</h2><p>A familiar face in your personal workspace.</p></div><span className={styles.connectedBadge}><span /> Connected</span></div>
              <div className={styles.profile}>
                <span className={styles.avatar}>{user.image ? <Image src={user.image} alt="" width={65} height={65} /> : user.name?.[0] ?? "U"}</span>
                <div><h3>{user.name ?? "Your workspace"}</h3><p>{user.email}</p><span className={styles.googleBadge}><Check size={11} aria-hidden="true" /> Signed in with Google</span></div>
              </div>
              <div className={styles.profileFields}><div><span>Full name</span><strong>{user.name ?? "Not provided"}</strong></div><div><span>Email address</span><strong>{user.email}</strong></div></div>
              <p className={styles.profileHint}>Your name and photo come from your Google account.</p>
              <div className={styles.appearanceRow}><span className={styles.rowIcon}><Monitor size={18} aria-hidden="true" /></span><div><strong>Appearance</strong><p>Follows your device’s light or dark setting.</p></div><span className={styles.systemBadge}><span className={styles.lightLabel}>Light</span><span className={styles.darkLabel}>Dark</span><span className={styles.systemSuffix}> · System</span></span></div>
              <div className={styles.sessionRow}><div><strong>Need a break?</strong><p>Your courses and notes will be here when you’re back.</p></div><button className={styles.signOutButton} onClick={handleSignOut} disabled={signingOut}>{signingOut ? <LoaderCircle size={15} className={styles.spinner} aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}{signingOut ? "Signing out…" : "Sign out"}</button></div>
            </section>

            <section className={styles.sectionCard} id="your-learning" aria-labelledby="learning-heading">
              <div className={styles.sectionHeader}><span className={styles.sectionIcon}><BookOpen size={19} aria-hidden="true" /></span><div><h2 id="learning-heading">Your learning, at a glance</h2><p>A little effort. A growing collection of knowledge.</p></div></div>
              {statsError ? <div className={styles.statsError} role="alert"><p>Your learning overview couldn’t be loaded.</p><button className={styles.secondaryButton} onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={14} aria-hidden="true" /> Try again</button></div> : (
                <div className={styles.learningBody} aria-busy={loading}>
                  <div className={styles.progressHeading}><div><strong>Overall course progress</strong><p>{loading ? "Gathering your learning progress…" : stats?.totalVideos ? `${stats.completedVideos} of ${stats.totalVideos} lessons completed` : "Your first lesson is the start of something."}</p></div><span>{loading ? "—" : pct}<small>{loading ? "" : "%"}</small></span></div>
                  <progress value={pct} max={100} aria-label="Overall course progress" />
                  <div className={styles.statsGrid}>{statItems.map(({icon:Icon,label,value}) => <div key={label}><Icon size={17} aria-hidden="true" /><strong>{loading ? <span className={styles.numberSkeleton} /> : value?.toLocaleString() ?? "—"}</strong><span>{label}</span></div>)}</div>
                  <div className={styles.learningLinks}><Link href="/courses">Your course library <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/study-library">Your study library <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
                </div>
              )}
            </section>

            <section className={styles.sectionCard} id="about" aria-labelledby="about-heading">
              <div className={styles.sectionHeader}><span className={styles.sectionIcon}><Info size={19} aria-hidden="true" /></span><div><h2 id="about-heading">Made for a little more focus</h2><p>Meet FocusTube, version 2.</p></div></div>
              <div className={styles.aboutBody}><div className={styles.aboutBrand}><span className={styles.brandMark}><Play size={17} fill="currentColor" aria-hidden="true" /></span><strong>FocusTube</strong><span className={styles.versionBadge}>v{version}</span></div><p>Turn YouTube playlists into your own learning space. Keep your lessons, progress, personal notes, and AI study tools together, so you can spend more time understanding what interests you.</p><a href="https://github.com/LakshayRathore18/FocusTube" target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}><ExternalLink size={14} aria-hidden="true" /> View source on GitHub</a></div>
            </section>
            <p className={styles.footerNote}><Sparkles size={13} aria-hidden="true" /> A little focus goes a long way.</p>
          </div>
        </div>
      )}
    </div></div>
  );
}
