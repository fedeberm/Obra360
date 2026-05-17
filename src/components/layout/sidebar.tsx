"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, FolderOpen, LogOut, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Proyectos", icon: FolderOpen },
];

const STORAGE_KEY = "obra360-sidebar-open";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Desktop: collapsible, persisted
  const [desktopOpen, setDesktopOpen] = useState(true);
  // Mobile: drawer overlay, default closed
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore desktop state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setDesktopOpen(stored === "true");
  }, []);

  function toggleDesktop() {
    setDesktopOpen((prev) => {
      localStorage.setItem(STORAGE_KEY, String(!prev));
      return !prev;
    });
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 flex items-center px-4 gap-3 shadow-md">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <p className="font-bold text-white text-sm">Obra360</p>
        </div>
      </header>

      {/* ── Mobile backdrop ────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">Obra360</p>
              <p className="text-xs text-slate-400">Seguimiento de obra</p>
            </div>
          </div>
          <button
            onClick={closeMobile}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMobile}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-slate-900 text-white min-h-screen transition-all duration-300 ease-in-out relative flex-shrink-0",
          desktopOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className={cn("p-4 border-b border-slate-700 flex items-center", desktopOpen ? "gap-3" : "justify-center")}>
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {desktopOpen && (
            <div className="overflow-hidden">
              <p className="font-bold text-white whitespace-nowrap">Obra360</p>
              <p className="text-xs text-slate-400 whitespace-nowrap">Seguimiento de obra</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={!desktopOpen ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                !desktopOpen && "justify-center",
                pathname === href
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {desktopOpen && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 space-y-1">
          <button
            onClick={handleLogout}
            title={!desktopOpen ? "Cerrar sesión" : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
              !desktopOpen && "justify-center"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {desktopOpen && <span className="whitespace-nowrap">Cerrar sesión</span>}
          </button>
        </div>

        {/* Toggle button */}
        <button
          onClick={toggleDesktop}
          className="absolute -right-3 top-20 z-10 w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
          aria-label={desktopOpen ? "Colapsar sidebar" : "Expandir sidebar"}
        >
          {desktopOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  );
}
