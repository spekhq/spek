## 1. README 更新

- [x] 1.1 將 `README.md` 中所有 `kewang/spek@master` 替換為 `kewang/spek@v1`
- [x] 1.2 將 `README.zh-TW.md` 中所有 `kewang/spek@master` 替換為 `kewang/spek@v1`

## 2. Release Skill 更新

- [x] 2.1 在 `.agents/skills/release/SKILL.md` 新增步驟：release 後更新 `v1` tag 指向新版本 commit 並 force push
- [x] 2.2 在 release skill 新增步驟：使用 `gh release create` 建立 GitHub Release 並勾選 Marketplace 發布

## 3. 首次發布

- [x] 3.1 使用 release skill 執行 `npm version major`，將版本從 0.7.9 bump 到 1.0.0（自動產生 `v1.0.0` tag）
- [x] 3.2 透過 `gh release create` 建立 GitHub Release，包含 Marketplace 發布旗標
- [x] 3.3 建立 `v1` 浮動 tag 指向 `v1.0.0` commit 並推送
