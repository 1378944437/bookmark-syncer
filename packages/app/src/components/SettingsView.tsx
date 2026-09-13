import { AnimatePresence, motion } from 'framer-motion'
import { Globe, Info, Link2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { SettingsItem } from './settings/SettingsShared'
import { WebDAVPage } from './settings/WebDAVPage'
import { SyncSettingsPage } from './settings/SyncSettingsPage'
import { GeneralSettingsPage } from './settings/GeneralSettingsPage'
import { AboutPage } from './settings/AboutPage'

type SubPage = 'main' | 'webdav' | 'sync' | 'general' | 'about'

// 主设置视图
export function SettingsView() {
  const { t } = useI18n()
  const [subPage, setSubPage] = useState<SubPage>('main')

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  const direction = subPage === 'main' ? -1 : 1

  return (
    <div className="flex flex-col h-full pt-4">
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
            className="flex-1"
          >
            <div className="space-y-3">
              <SettingsItem
                icon={Link2}
                label={t('settings.item.webdav.label')}
                description={t('settings.item.webdav.desc')}
                onClick={() => setSubPage('webdav')}
              />
              <SettingsItem
                icon={RefreshCw}
                label={t('settings.item.sync.label')}
                description={t('settings.item.sync.desc')}
                onClick={() => setSubPage('sync')}
              />
              <SettingsItem
                icon={Globe}
                label={t('settings.item.general.label')}
                description={t('settings.item.general.desc')}
                onClick={() => setSubPage('general')}
              />
              <SettingsItem
                icon={Info}
                label={t('settings.item.about.label')}
                description={t('settings.item.about.desc')}
                onClick={() => setSubPage('about')}
              />
            </div>
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
            <WebDAVPage onBack={() => setSubPage('main')} />
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
