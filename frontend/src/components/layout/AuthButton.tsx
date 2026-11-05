"use client";

import { signIn, signOut, useSession } from "@/components/auth/AuthProvider";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import styles from "./LayoutChrome.module.css";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (status === "loading") return <span className={styles.avatarSkeleton} role="status" aria-label="Loading account" />;
  if (status === "error") return <span role="alert" className={styles.authError}>Sign-in service unavailable</span>;
  if (!session) return <button onClick={() => signIn()} className={styles.signInButton}><UserRound size={16} aria-hidden="true" /> Sign in with Google</button>;

  return (
    <div ref={ref} className={styles.accountMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <button ref={triggerRef} onClick={() => setOpen((value) => !value)} className={styles.accountTrigger} aria-label="User menu" aria-expanded={open} aria-controls="account-dropdown">
        <span className={styles.avatar}>{session.user?.image ? <Image src={session.user.image} alt="" width={34} height={34} /> : session.user?.name?.[0] ?? "U"}</span>
        <span className={styles.headerAccountName}>{session.user?.name?.trim().split(/\s+/)[0] ?? "Account"}</span>
        <ChevronDown size={14} className={styles.accountChevron} data-open={open} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.accountDropdown} id="account-dropdown">
          <div className={styles.dropdownHeading}><strong>{session.user?.name}</strong><span>{session.user?.email}</span></div>
          <div className={styles.dropdownItems}>
            <Link ref={firstItemRef} href="/settings" onClick={() => setOpen(false)}><Settings size={16} aria-hidden="true" /> Account settings</Link>
            <button onClick={() => { setOpen(false); void signOut(); }} className={styles.signOutButton}><LogOut size={16} aria-hidden="true" /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
