"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Box,
  Bell,
  Users,
  FileClock,
  FileText,
  BookOpen,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/preview-slip", label: "Preview Slip", icon: FileText },
  { href: "/products", label: "Products", icon: Box },
  { href: "/expenses", label: "Expenses", icon: FileText },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/logs", label: "Logs", icon: FileClock, adminOnly: true },
];

export default function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleNav = (href: string) => {
    router.push(href);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-indigo-600 text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-40 h-screen bg-white border-r 
        transform transition-all duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${collapsed ? "md:w-16" : "md:w-64"}
        w-64`}
      >
        {/* Header + Collapse Button */}
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              PS
            </div>
            {!collapsed && <span className="font-semibold text-gray-800">Panel</span>}
          </div>

          {/* Collapse Button (Desktop Only) */}
          <button
            className="hidden md:flex p-1 text-gray-600 hover:text-indigo-600"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {nav
            .filter((i) => !i.adminOnly || isAdmin)
            .map((item) => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;

              return (
                <button
                  key={item.href}
                  onClick={() => handleNav(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all
                    ${active
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  <Icon size={18} className={`${active ? "text-indigo-600" : "text-gray-500"}`} />
                  {!collapsed && item.label}
                </button>
              );
            })}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm md:hidden z-30"
        ></div>
      )}
    </>
  );
}
