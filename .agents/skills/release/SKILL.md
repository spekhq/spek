---
name: release
description: Automate spek release — update CHANGELOGs, bump version, and push tag to trigger CI/CD publish. Use when the user wants to release a new version.
license: MIT
compatibility: Requires npm, git.
metadata:
  author: spek
  version: "1.2"
---

Automate the spek release process — update CHANGELOGs, bump version, create tag, and push to trigger CI/CD.

**Input**: Optionally specify a version bump type (`patch`, `minor`, `major`) or an explicit version (e.g., `0.3.0`). If omitted, ask.

**Steps**

1. **Determine version bump**

   If the user provided a bump type or version, use it. Otherwise, use **AskUserQuestion** to ask:

   Options: `patch`, `minor`, `major`

   Show the current version from root `package.json` and what each option would result in.

2. **Gather changelog content**

   Look at archived changes since the last release to identify what's new:
   - Check `openspec/changes/archive/` for changes archived after the last release
   - Check recent git commits for context
   - Draft changelog bullet points summarizing user-facing changes

   Show the draft and ask the user to confirm or edit.

3. **Update CHANGELOGs**

   Update ALL THREE changelog files (they must stay in sync per project convention):
   - `CHANGELOG.md` (root)
   - `packages/vscode/CHANGELOG.md`
   - `packages/intellij/CHANGELOG.md`

   Add a new version section at the top with the changelog content.

4. **Update plugin.xml change-notes**

   Update `packages/intellij/src/main/resources/META-INF/plugin.xml` — replace the `<change-notes>` block with the new version's changelog content in HTML format:

   ```xml
   <change-notes><![CDATA[
       <p><b><version></b></p>
       <ul>
           <li>...</li>
       </ul>
   ]]></change-notes>
   ```

   Only include the latest version's changes (not cumulative history).

5. **Commit changelog updates**

   ```bash
   git add CHANGELOG.md packages/vscode/CHANGELOG.md packages/intellij/CHANGELOG.md packages/intellij/src/main/resources/META-INF/plugin.xml
   git commit -m "Update CHANGELOG for v<version>"
   ```

6. **Rebuild demo page**

   Rebuild `docs/demo.html` and badges so they reflect the latest code and openspec content:

   ```bash
   npm run build:demo
   npm run build:badges
   ```

   Stage the updated files:

   ```bash
   git add docs/demo.html docs/badges/
   git commit -m "Rebuild demo for v<version>"
   ```

7. **Run npm version**

   ```bash
   npm version <type-or-version> --no-git-tag-version
   ```

   Wait — the `version` lifecycle script in package.json auto-syncs to `packages/vscode/package.json` and `packages/intellij/gradle.properties`.

   Actually, use the standard flow which auto-commits and tags:
   ```bash
   npm version <type-or-version>
   ```

   This will:
   - Bump root `package.json` version
   - Run `version` script (syncs `packages/vscode/package.json` + `packages/intellij/gradle.properties` + git add)
   - Create git commit with version
   - Create `v<version>` git tag

8. **Push to trigger CI/CD**

   Ask the user for confirmation before pushing:
   > "Ready to push v<version> to origin? This will trigger the CI/CD pipelines to publish to VS Code Marketplace and JetBrains Marketplace."

   ```bash
   git push --follow-tags
   ```

9. **Update `v1` major version tag**

   After push, update the `v1` floating tag to point to the new release commit:

   ```bash
   git tag -fa v1 -m "Update v1 tag to v<version>"
   git push origin v1 --force
   ```

   This follows the GitHub Action versioning convention — users referencing `spekhq/spek@v1` will automatically get the latest release.

10. **Create GitHub Release**

    Create a GitHub Release with Marketplace publishing:

    ```bash
    gh release create v<version> --title "v<version>" --notes "<changelog content>"
    ```

    The release will be published to the GitHub Actions Marketplace (action.yml with branding is auto-detected by GitHub).

11. **Show summary**

   Display:
   - New version number
   - Changelog content
   - Git tag created
   - CI/CD status: "Pushed. GitHub Actions will publish to VS Code Marketplace and JetBrains Marketplace."
   - GitHub Release: "Release created. Action published to GitHub Actions Marketplace."
   - Remind: "Monitor the workflows at: https://github.com/<owner>/<repo>/actions"

**Guardrails**
- ALWAYS update all three CHANGELOGs (root + vscode + intellij) — they must be identical
- ALWAYS confirm with user before `git push`
- If there are uncommitted changes, warn and ask to stash or commit first
- If the working tree is dirty after changelog update, stage only changelog files
- Do NOT push without explicit user confirmation
