/**
 * The stand-in the single-file builds resolve `mermaid` to.
 *
 * The VS Code webview, the IntelliJ webview and `docs/demo.html` are single-file IIFE bundles that
 * cannot code-split, so a dynamic import of Mermaid is *inlined* there rather than deferred — measured
 * at 5.23 MB on top of a 719 KB bundle, which would more than double a `docs/demo.html` that is
 * committed to the repository on every release. Those three builds alias `mermaid` here instead, so the
 * bytes are absent rather than merely unused.
 *
 * This module is the guarantee; `__SPEK_DRAWS_DIAGRAMS__` is the behaviour. They are separate on
 * purpose: the flag is what lets the diagram view show its source calmly instead of reporting a load
 * failure, and an alias alone could only ever produce the failure path. Neither is a substitute for the
 * other — without the alias, tree-shaking a dynamic import behind a flag is a hope rather than a
 * guarantee, and the one thing this is buying is bytes.
 */
export default null;
