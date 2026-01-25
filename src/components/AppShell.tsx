"use client";

import { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  pageTitle: string;
  memoryStatus?: "supabase" | "static";
  buildStatus?: "live" | "local";
}

export function AppShell({ children, pageTitle, memoryStatus, buildStatus = "local" }: AppShellProps) {
  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-black border-r border-orange-500 flex flex-col fixed h-screen">
        <div className="p-6 border-b border-orange-500">
          <h1 className="text-2xl font-bold text-white">AgoraSim</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a
            href="#"
            className="block px-4 py-2 bg-orange-500 text-black rounded-lg font-medium"
          >
            Simulator
          </a>
          <a
            href="#"
            className="block px-4 py-2 text-orange-400 hover:bg-gray-900 rounded-lg transition-colors"
          >
            Runs
          </a>
          <a
            href="#"
            className="block px-4 py-2 text-orange-400 hover:bg-gray-900 rounded-lg transition-colors"
          >
            Personas
          </a>
          <a
            href="#"
            className="block px-4 py-2 text-orange-400 hover:bg-gray-900 rounded-lg transition-colors"
          >
            Settings
          </a>
        </nav>
        <div className="p-4 border-t border-orange-500">
          <p className="text-xs text-orange-400">YC Full Stack Hackathon</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-black border-b border-orange-500 flex items-center justify-between px-6">
          <h2 className="text-xl font-semibold text-white">{pageTitle}</h2>
          <div className="flex items-center gap-3">
            {memoryStatus && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  memoryStatus === "supabase"
                    ? "bg-orange-500 text-black"
                    : "bg-gray-800 text-orange-400"
                }`}
              >
                Memory: {memoryStatus === "supabase" ? "Supabase" : "Static"}
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                buildStatus === "live"
                  ? "bg-orange-500 text-black"
                  : "bg-gray-800 text-orange-400"
              }`}
            >
              Build: {buildStatus}
            </span>
            <button className="px-3 py-1 text-sm text-orange-400 hover:text-orange-500 transition-colors">
              Docs
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
