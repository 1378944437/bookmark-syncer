/**
 * 大屏控制台：设置与工具中心
 * 现代宽屏选项卡架构，整合 WebDAV 配置、安全防御、同步策略、配置迁移与危险操作区
 */
import { useState } from 'react'
import { Cloud, Info, RefreshCw, ShieldCheck, Sliders } from 'lucide-react'
import { cn } from '../../infrastructure/utils/format'
import { WebDAVPage } from '../settings/WebDAVPage'
import { SecuritySettingsPage } from '../settings/SecuritySettingsPage'
import { SyncSettingsPage } from '../settings/SyncSettingsPage'
import { GeneralSettingsPage } from '../settings/GeneralSettingsPage'
import { AboutPage } from '../settings/AboutPage'

type SettingsTabKey = 'webdav' | 'security' | 'sync' | 'general' | 'about'

export function FullTabSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('webdav')

  const tabs = [
    { key: 'webdav' as const, label: 'WebDAV 凭证', icon: Cloud },
    { key: 'security' as const, label: '安全与防误删', icon: ShieldCheck },
    { key: 'sync' as const, label: '同步策略与范围', icon: RefreshCw },
    { key: 'general' as const, label: '常规迁移与危险区', icon: Sliders },
    { key: 'about' as const, label: '关于扩展', icon: Info },
  ]

  const renderContent = () => {
    const noop = () => {}
    switch (activeTab) {
      case 'webdav':
        return <WebDAVPage onBack={noop} />
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
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-start">
      {/* 左侧垂直分类选项卡 */}
      <div className="md:col-span-4 lg:col-span-3 space-y-1 bg-card/60 backdrop-blur-md p-2 rounded-2xl border border-border">
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
      <div className="md:col-span-8 lg:col-span-9 bg-card/70 backdrop-blur-xl p-6 rounded-2xl border border-border shadow-sm min-h-[500px]">
        {renderContent()}
      </div>
    </div>
  )
}
