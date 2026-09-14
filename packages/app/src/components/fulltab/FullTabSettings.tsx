/**
 * 大屏控制台：设置与工具中心
 * 现代宽屏选项卡架构，整合 WebDAV 配置、安全防御、同步策略、配置迁移与危险操作区
 */
import { useState } from 'react'
import { Cloud, Info, RefreshCw, ShieldCheck, Sliders } from 'lucide-react'
import { cn } from '../../infrastructure/utils/format'
import { CloudStoragePage } from '../settings/CloudStoragePage'
import { SecuritySettingsPage } from '../settings/SecuritySettingsPage'
import { SyncSettingsPage } from '../settings/SyncSettingsPage'
import { GeneralSettingsPage } from '../settings/GeneralSettingsPage'
import { AboutPage } from '../settings/AboutPage'

type SettingsTabKey = 'webdav' | 'security' | 'sync' | 'general' | 'about'

export function FullTabSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('webdav')

  const tabs = [
    { key: 'webdav' as const, label: '云端存储', icon: Cloud },
    { key: 'sync' as const, label: '同步策略', icon: RefreshCw },
    { key: 'security' as const, label: '安全加密', icon: ShieldCheck },
    { key: 'general' as const, label: '偏好工具', icon: Sliders },
    { key: 'about' as const, label: '关于扩展', icon: Info },
  ]

  const renderContent = () => {
    const noop = () => {}
    switch (activeTab) {
      case 'webdav':
        return <CloudStoragePage onBack={noop} />
      case 'security':
        return <SecuritySettingsPage onBack={noop} />
      case 'sync':
        return <SyncSettingsPage onBack={noop} />
      case 'general':
        return <GeneralSettingsPage onBack={noop} />
      case 'about':
        return <AboutPage onBack={noop} />
    }
  }

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-6 w-full items-start">
      {/* 移动端横向滑动的紧凑 Pills 导航（高度仅约 44px，不遮挡下方表单） */}
      <div className="flex md:hidden w-full overflow-x-auto py-1 px-1 bg-card/60 backdrop-blur-md rounded-xl border border-border gap-1.5 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 电脑端左侧垂直分类选项卡 */}
      <div className="hidden md:block md:col-span-4 lg:col-span-3 space-y-1 bg-card/60 backdrop-blur-md p-2 rounded-2xl border border-border w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 右侧主配置内容区 */}
      <div className="w-full md:col-span-8 lg:col-span-9 bg-card/70 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-border shadow-sm min-h-[460px]">
        {renderContent()}
      </div>
    </div>
  )
}
