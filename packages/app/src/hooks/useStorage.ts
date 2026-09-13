import { useEffect, useState } from "react";
import browser from "webextension-polyfill";

export function useStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    browser.storage.local.get([key]).then((result) => {
      if (result[key] !== undefined) {
        setValue(result[key] as T);
      }
    });

    const listener = (
      changes: Record<string, browser.Storage.StorageChange>,
      areaName?: string
    ) => {
      // 仅响应 local 域变更，防止 session 或 sync 域同名键触发意外状态抖动
      if ((!areaName || areaName === "local") && changes[key]) {
        setValue(changes[key].newValue as T);
      }
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, [key]);

  const setStorageValue = (newValue: T) => {
    setValue(newValue);
    browser.storage.local.set({ [key]: newValue });
  };

  return [value, setStorageValue] as const;
}
