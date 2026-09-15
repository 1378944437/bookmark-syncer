/**
 * 大屏控制台顶层容器 FullTabConsole.tsx
 * 聚合头部导航与三大核心全屏视图（仪表盘/快照时光机/设置工具）
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useActiveStorage } from '../../hooks/useActiveStorage'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { FullTabHeader, type FullTabNavKey } from './FullTabHeader'
import { FullTabDashboard } from './FullTabDashboard'
import { FullTabSnapshots } from './FullTabSnapshots'
import { FullTabSettings } from './FullTabSettings'

export function FullTabConsole() {
  const [activeNav, setActiveNav] = useState<FullTabNavKey>('dashboard')
  const { isConfigured } = useActiveStorage()
  const isOnline = useOnlineStatus()


  return (
    <div className="w-full flex-1 flex flex-col">
      {/* 控制台头部 */}
      <FullTabHeader
        activeNav={activeNav}
        onNavChange={setActiveNav}
        isOnline={isOnline}
        isConfigured={isConfigured}
      />

      {/* 视图内容切换 */}
      <div className="flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeNav}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeNav === 'dashboard' && <FullTabDashboard />}
            {activeNav === 'snapshots' && <FullTabSnapshots />}
            {activeNav === 'settings' && <FullTabSettings />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
