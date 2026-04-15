"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean) {
  return active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground";
}

function timelineSectionActive(pathname: string) {
  if (pathname === "/timeline") return true;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "cases" || !parts[1]) return false;
  return parts[2] === "timeline" || parts[2] === "timelines";
}

function casesNavActive(pathname: string) {
  if (pathname === "/cases") return true;
  if (!pathname.startsWith("/cases/")) return false;
  return !timelineSectionActive(pathname);
}

function compareNavActive(pathname: string) {
  return pathname.startsWith("/evidence/compare");
}

function evidenceNavActive(pathname: string) {
  if (compareNavActive(pathname)) return false;
  return pathname === "/evidence" || pathname.startsWith("/evidence/");
}

export function WorkspaceMainNav({ showInvestigators }: { showInvestigators: boolean }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm justify-self-center"
      aria-label="Main"
    >
      <Link href="/dashboard" className={linkClass(pathname === "/dashboard" || pathname.startsWith("/dashboard/"))}>
        Dashboard
      </Link>
      <Link href="/cases" className={linkClass(casesNavActive(pathname))}>
        Cases
      </Link>
      <Link href="/evidence" className={linkClass(evidenceNavActive(pathname))}>
        Evidence
      </Link>
      <Link href="/evidence/compare" className={linkClass(compareNavActive(pathname))}>
        Compare Files
      </Link>
      <Link href="/analyze" className={linkClass(pathname === "/analyze" || pathname.startsWith("/analyze/"))}>
        Analyze
      </Link>
      <Link href="/timeline" className={linkClass(timelineSectionActive(pathname))}>
        Timeline
      </Link>
      {showInvestigators ? (
        <Link href="/investigators" className={linkClass(pathname === "/investigators")}>
          Investigators
        </Link>
      ) : null}
    </nav>
  );
}
