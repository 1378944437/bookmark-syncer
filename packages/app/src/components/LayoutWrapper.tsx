/**
 * 扩展弹窗主容器
 * 统一基准视口尺寸（380x560），采用径向渐变优化光晕渲染性能，避免动态高斯模糊 GPU 掉帧
 */
import type { ReactNode } from 'react'

export const LayoutWrapper = ({ children }: { children: ReactNode }) => (
  <div className="relative w-[380px] h-[560px] bg-background text-foreground font-sans overflow-hidden rounded-xl flex flex-col transition-colors duration-300 border border-border/70 dark:border-white/[0.08]">
    {/* 环境背景微光：使用径向渐变预渲染替代 100px 动态高斯模糊滤镜，极大释放 GPU 显存与重绘开销 */}
    {/* Primary Glow */}
    <div
      className="absolute -top-20 -left-20 w-80 h-80 rounded-full pointer-events-none transition-opacity duration-700 opacity-90 dark:opacity-80"
      style={{
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.20) 0%, rgba(99, 102, 241, 0.06) 45%, transparent 70%)',
      }}
    />

    {/* Secondary Glow */}
    <div
      className="absolute top-36 -right-20 w-64 h-64 rounded-full pointer-events-none transition-opacity duration-700 opacity-80 dark:opacity-75"
      style={{
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, rgba(139, 92, 246, 0.05) 45%, transparent 70%)',
      }}
    />

    {/* 顶部高光：让面板与背景有分层感（深色下尤其明显） */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/15 pointer-events-none" />

    <div className="relative z-10 flex flex-col h-full">
      {children}
    </div>
  </div>
)
