/**
 * 云端存储聚合配置页 (CloudStoragePage.tsx)
 * 允许用户在 WebDAV (坚果云/NAS) 与 GitHub Gist 之间无缝切换
 */
import { motion } from 'framer-motion'
import { Cloud, Github } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useStorage } from '../../hooks/useStorage'
import { cn } from '../../infrastructure/utils/format'
import { WebDAVPage } from './WebDAVPage'
import { GistSettingsPage } from './GistSettingsPage'

export function CloudStoragePage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [storageType, setStorageType] = useStorage<'webdav' | 'gist'>('storage_type', 'webdav')

  return (
    <div className="space-y-4">
      {/* 存储驱动类型切换 Pills */}
      <div className="flex bg-muted/80 backdrop-blur-md p-1 rounded-xl border border-border shadow-sm">
        <button
          type="button"
          onClick={() => setStorageType('webdav')}
          className={cn(
            'relative flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors z-10 flex items-center justify-center gap-1.5',
            storageType === 'webdav' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {storageType === 'webdav' && (
            <motion.div
              layoutId="storageTypeActive"
              className="absolute inset-0 bg-indigo-600 rounded-lg -z-10 shadow-sm"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <Cloud className="w-3.5 h-3.5" />
          <span>{t('settings.storage.tabWebdav')}</span>
        </button>

        <button
          type="button"
          onClick={() => setStorageType('gist')}
          className={cn(
            'relative flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors z-10 flex items-center justify-center gap-1.5',
            storageType === 'gist' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {storageType === 'gist' && (
            <motion.div
              layoutId="storageTypeActive"
              className="absolute inset-0 bg-indigo-600 rounded-lg -z-10 shadow-sm"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <Github className="w-3.5 h-3.5" />
          <span>{t('settings.storage.tabGist')}</span>
        </button>
      </div>

      {/* 具体存储配置视图 */}
      {storageType === 'webdav' ? (
        <WebDAVPage onBack={onBack} />
      ) : (
        <GistSettingsPage onBack={onBack} />
      )}
    </div>
  )
}
