import { useEffect, useRef } from 'react';

/** 原生 dialog 提供焦点圈定、Escape、背景 inert 与关闭后焦点恢复。 */
export function useModalDialog(isOpen: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog.open) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', trapTab);
    return () => { dialog.removeEventListener('keydown', trapTab); if (dialog.open) dialog.close(); };
  }, [isOpen]);
  return ref;
}
