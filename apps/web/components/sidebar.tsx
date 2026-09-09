"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DollarSign,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  Smartphone,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/apps", label: "Aplicativos", icon: Smartphone },
  { href: "/revenue", label: "Receita", icon: DollarSign },
  { href: "/acquisition", label: "Campanhas", icon: Megaphone },
  { href: "/banco", label: "Banco", icon: Landmark },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-2 z-50 rounded-lg p-2 text-zinc-400 transition-colors hover:text-white md:hidden"
        aria-label="Abrir menu"
        aria-expanded={open}
      >
        <Menu className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/5 bg-surface transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo + close button */}
        <div className="flex h-16 items-center justify-between px-6">
          <span className="text-2xl font-bold font-heading tracking-tight select-none">
            <span style={{ color: "#6848B3" }}>D</span>
            <span className="text-white">ICE</span>
            <span style={{ color: "#6848B3" }}>D</span>
          </span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-500/10 text-violet-400"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
