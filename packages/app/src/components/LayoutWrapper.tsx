import { ReactNode } from 'react';

export const LayoutWrapper = ({ children }: { children: ReactNode }) => (
  <div className="relative w-[360px] h-[520px] bg-background text-foreground font-sans overflow-hidden rounded-xl flex flex-col transition-colors duration-300 border border-border/70 dark:border-white/[0.08]">
    {/* Ambient Background Lights */}
    {/* Primary Blob */}
    <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full filter blur-[100px] pointer-events-none 
      bg-indigo-500/20 dark:bg-indigo-500/20 transition-all duration-700" 
    />
    
    {/* Secondary Blob */}
    <div className="absolute top-40 -right-20 w-60 h-60 rounded-full filter blur-[80px] pointer-events-none
      bg-violet-500/15 dark:bg-violet-600/15 transition-all duration-700"
    />

    {/* 顶部高光：让面板与背景有分层感（深色下尤其明显） */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/15 pointer-events-none" />

    <div className="relative z-10 flex flex-col h-full">
        {children}
    </div>
  </div>
);
