import { useModalDialog } from '../hooks/useModalDialog';
/**
 * 通用居中模态对话框组件
 * 提供带动画与毛玻璃遮罩的居中弹出层，常用于二次确认与关键警示
 */
import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from '../i18n';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
}: ModalProps) {
  const { t } = useI18n();
  const dialogRef = useModalDialog(isOpen);
  return (
    <dialog ref={dialogRef} aria-label={title || 'Dialog'} onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-0 h-full w-full max-h-none max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-transparent">
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
          />

          {/* 模态框主体卡片 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative z-10 w-full max-w-[340px] rounded-2xl bg-card/95 dark:bg-card/90 backdrop-blur-xl border border-border p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* 头部标题与关闭按钮 */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between pb-3 mb-1">
                {title ? (
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {title}
                  </h3>
                ) : (
                  <div />
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    aria-label={t('repair.close')}
                    className="p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* 内容区域 */}
            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </dialog>
  );
}
