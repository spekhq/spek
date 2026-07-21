// 使用者的 jj workspace 聚合偏好，存於 localStorage。**實驗性功能，預設關閉（opt-in）。**
// 與 worktree 聚合偏好（aggregatePref）獨立，可單獨開關 jj workspace。
const KEY = "spek:aggregate-jj";

/** 讀取 jj workspace 聚合偏好。實驗性，localStorage 不可用或未設定時回傳 false（預設關閉）。 */
export function getJjWorkspacePref(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

/** 寫入 jj workspace 聚合偏好。 */
export function setJjWorkspacePref(value: boolean): void {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // localStorage 不可用時忽略
  }
}
