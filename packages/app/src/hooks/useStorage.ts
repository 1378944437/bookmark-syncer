import { useEffect, useState, useRef } from "react";
import browser from "webextension-polyfill";

export function useStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const initial = useRef(initialValue);

  useEffect(() => {
    let active = true;
    browser.storage.local.get([key]).then((result) => {
      if (active && result[key] !== undefined) {
        setValue(result[key] as T);
      }
    }).catch(error => console.error('[useStorage] Read failed:', error));

    const listener = (
      changes: Record<string, browser.Storage.StorageChange>,
      areaName?: string
    ) => {
      // 仅响应 local 域变更，防止 session 或 sync 域同名键触发意外状态抖动
      if ((!areaName || areaName === "local") && changes[key]) {
        active = false; // 新事件优先于尚未返回的初始读取。
        setValue(changes[key].newValue === undefined ? initial.current : changes[key].newValue as T);
      }
    };

    browser.storage.onChanged.addListener(listener);
    return () => { active = false; browser.storage.onChanged.removeListener(listener); };
  }, [key]);

  const setStorageValue = async (newValue: T) => {
    await browser.storage.local.set({ [key]: newValue });
    setValue(newValue);
  };

  return [value, setStorageValue] as const;
}
