/**
 * 设置主视图
 * 采用分组式卡片架构（Grouped Section Cards），划分为四大清晰领域：
 * 1. 云端与安全 (WebDAV / 端到端加密)
 * 2. 同步与范围 (同步策略)
 * 3. 偏好与设备 (外观/语言/设备标识)
 * 4. 关于与支持 (版本/更新)
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Cloud, Info, RefreshCw, ShieldCheck, Sliders } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { useStorage } from '../hooks/useStorage'
import { useActiveStorage } from '../hooks/useActiveStorage'
import { SettingGroup, SettingRow } from './settings/SettingRow'
import { CloudStoragePage } from './settings/CloudStoragePage'
import { SecuritySettingsPage } from './settings/SecuritySettingsPage'
import { SyncSettingsPage } from './settings/SyncSettingsPage'
import { GeneralSettingsPage } from './settings/GeneralSettingsPage'
import { AboutPage } from './settings/AboutPage'

type SubPage = 'main' | 'webdav' | 'security' | 'sync' | 'general' | 'about'

export function SettingsView() {
  const { t } = useI18n()
  const [subPage, setSubPage] = useState<SubPage>('main')
  const { isConfigured, hostLabel } = useActiveStorage()
  const [e2eEnabled] = useStorage('e2e_enabled', false)
  const [autoSyncEnabled] = useStorage('auto_sync_enabled', true)
  const [deviceName] = useStorage('device_name', '')

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  const direction = subPage === 'main' ? -1 : 1

  return (
    <div className="flex flex-col h-full pt-3">
      <AnimatePresence mode="wait" custom={direction}>
        {subPage === 'main' && (
          <motion.div
            key="main"
            custom={-1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-y-auto space-y-3.5 pb-4"
          >
            {/* 1. 云端存储服务 */}
            <SettingGroup title={t('settings.section.cloud')}>
              <SettingRow
                icon={Cloud}
                iconColor="text-indigo-600 bg-indigo-500/10 dark:text-indigo-400"
                label={t('settings.item.webdav.label')}
                description={isConfigured ? `已连接: ${hostLabel}` : t('settings.item.webdav.desc')}
                type="navigation"
                onClick={() => setSubPage('webdav')}
              />
            </SettingGroup>

            {/* 2. 同步策略与范围 */}
            <SettingGroup title={t('settings.section.sync')}>
              <SettingRow
                icon={RefreshCw}
                iconColor="text-sky-600 bg-sky-500/10 dark:text-sky-400"
                label={t('settings.item.sync.label')}
                description={autoSyncEnabled ? '自动静默同步已开启 · 容灾配额' : t('settings.item.sync.desc')}
                type="navigation"
                onClick={() => setSubPage('sync')}
              />
            </SettingGroup>

            {/* 3. 安全与加密防御 */}
            <SettingGroup title={t('settings.section.security')}>
              <SettingRow
                icon={ShieldCheck}
                iconColor="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                label={t('settings.item.security.label')}
                description={e2eEnabled ? '端到端加密已生效 (AES-256-GCM)' : t('settings.item.security.desc')}
                type="navigation"
                onClick={() => setSubPage('security')}
              />
            </SettingGroup>

            {/* 4. 偏好与工具箱 */}
            <SettingGroup title={t('settings.section.preferences')}>
              <SettingRow
                icon={Sliders}
                iconColor="text-violet-600 bg-violet-500/10 dark:text-violet-400"
                label={t('settings.item.general.label')}
                description={deviceName ? `设备: ${deviceName} · 主题与迁移` : t('settings.item.general.desc')}
                type="navigation"
                onClick={() => setSubPage('general')}
              />
            </SettingGroup>

            {/* 5. 关于与支持 */}
            <SettingGroup title={t('settings.section.system')}>
              <SettingRow
                icon={Info}
                iconColor="text-zinc-600 bg-zinc-500/10 dark:text-zinc-400"
                label={t('settings.item.about.label')}
                description={t('settings.item.about.desc')}
                type="navigation"
                onClick={() => setSubPage('about')}
              />
            </SettingGroup>
          </motion.div>
        )}

        {subPage === 'webdav' && (
          <motion.div
            key="webdav"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <CloudStoragePage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'security' && (
          <motion.div
            key="security"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <SecuritySettingsPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'sync' && (
          <motion.div
            key="sync"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <SyncSettingsPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'general' && (
          <motion.div
            key="general"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <GeneralSettingsPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}

        {subPage === 'about' && (
          <motion.div
            key="about"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <AboutPage onBack={() => setSubPage('main')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
