import $ from "jquery";
import FINGERPRINT_ICON_GREEN from "./assets/noun-fingerprint-5073647-007435.svg";
import FINGERPRINT_ICON_RED from "./assets/noun-fingerprint-5073647-FF001C.svg";

const SIG_HIGHLIGHT_FACT = "d6-sig-highlight-fact";
const SIG_HIGHLIGHT_DIV = "d6-sig-highlight-div";
const SIG_HIGHLIGHT_WHOLE = "d6-sig-highlight-whole";
export class D6ExtendedViewer {
  constructor(iv) {
    this._iv = iv;
    this._signatures = [];
    this._selectedId = null;
    this._activeFilters = new Set(["valid", "invalid", "revoked"]);
    this._detailOpen = false;
    this._sigNavIndex = {};
    this._sigTargetCache = {};
    this._sigStyleById = {};
    this._loaded = false;
    this._loadError = null;
    this._panelOpen = false;
    this._inspectorDrawerOpen = false;
    this._inspectorFullPageOpen = false;
    this._inspectorDetailLevel = "standard";
    this._currentFpNode = null;
  }

  preProcessiXBRL = async (_body, docIndex) => {
    if (docIndex !== 0 || this._loaded) return;
    this._loaded = true;

    this._injectAppStyles();
    this._injectUi();
    await this._loadSignatures();
    this._renderSignatures();
    this._renderInspectorDrawer();
    this._refreshWarningState();
  };

  updateViewerStyleElements = (styleElts) => {
    styleElts.append(
      document.createTextNode(`
        .${SIG_HIGHLIGHT_FACT} { outline: 7px solid #f6b200 !important; outline-offset: 2px !important; }
        .${SIG_HIGHLIGHT_FACT}.d6-sig-style-1 { outline: 7px solid #f59e0b !important; }
        .${SIG_HIGHLIGHT_FACT}.d6-sig-style-2 { outline: 7px dashed #9333ea !important; }
        .${SIG_HIGHLIGHT_FACT}.d6-sig-style-3 { outline: 7px dotted #0f766e !important; }
        .${SIG_HIGHLIGHT_DIV} { outline: 7px solid #1d6fb8 !important; outline-offset: -2px !important; }
        .${SIG_HIGHLIGHT_DIV}.d6-sig-style-1 { outline: 7px solid #1d4ed8 !important; }
        .${SIG_HIGHLIGHT_DIV}.d6-sig-style-2 { outline: 7px dashed #9333ea !important; }
        .${SIG_HIGHLIGHT_DIV}.d6-sig-style-3 { outline: 7px dotted #0f766e !important; }
        .${SIG_HIGHLIGHT_WHOLE} {
          border: 6px solid transparent !important;
          border-image: repeating-linear-gradient(-45deg, #8bc9ea 0 10px, #d9eef9 10px 20px) 1 !important;
          box-shadow: inset 0 0 0 2px rgba(26, 89, 143, 0.25) !important;
        }
        .${SIG_HIGHLIGHT_WHOLE}.d6-sig-style-1 {
          border-image: repeating-linear-gradient(-45deg, #1d4ed8 0 8px, #bfdbfe 8px 16px) 1 !important;
        }
        .${SIG_HIGHLIGHT_WHOLE}.d6-sig-style-2 {
          border-image: repeating-linear-gradient(45deg, #9333ea 0 8px, #f5d0fe 8px 16px) 1 !important;
        }
        .${SIG_HIGHLIGHT_WHOLE}.d6-sig-style-3 {
          border-image: radial-gradient(circle, #0f766e 40%, #a7f3d0 41% 100%) 1 !important;
        }
        .d6-sig-flash { animation: d6SigFlash 720ms ease; }
        @keyframes d6SigFlash {
          0% { filter: brightness(1.0); }
          35% { filter: brightness(1.35); }
          100% { filter: brightness(1.0); }
        }
      `)
    );
  };

  extendDisplayOptionsMenu = (menu) => {
    menu.addCheckboxItem(
      "Show D6 signatures pane",
      (checked) => {
        this._setPanelMode(checked);
      },
      "d6-signatures-pane-toggle",
      "visibility"
    );
  };

  _injectAppStyles() {
    if (document.getElementById("d6-plugin-style")) return;
    const style = document.createElement("style");
    style.id = "d6-plugin-style";
    style.textContent = `
      #d6-signatures-panel { border-top: 1px solid var(--colour-border-grey); padding: 1.1rem; background: var(--colour-bg); display: none; font-size: 1.4rem; line-height: 1.9rem; color: #1b1f24; }
      #d6-signatures-panel.hidden { display: none; }
      #inspector.d6-mode #d6-signatures-panel { display: block; }
      #inspector.d6-mode .inspector-container { display: none !important; }
      #d6-signatures-panel h3 { margin: 0; font-size: 1.9rem; letter-spacing: 0.01em; }
      #d6-signatures-panel .d6-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
      #d6-signatures-panel .d6-panel-close { border: 1px solid var(--colour-border-grey); border-radius: 0.34rem; background: #f8fafc; color: inherit; cursor: pointer; padding: 0.42rem 0.8rem; font-size: 1.2rem; }
      #d6-signatures-panel .d6-header-actions { display: inline-flex; gap: 0.4rem; align-items: center; }
      #d6-toggle-detail-btn { border: 1px solid #d6deea; background: #f8fafc; color: #334155; border-radius: 0.34rem; padding: 0.32rem 0.64rem; font-size: 1.1rem; cursor: pointer; }
      #d6-toggle-detail-btn.active { background: #eefaf8; border-color: #98d1cb; color: #115e59; font-weight: 700; }
      #d6-signature-tabs, #d6-signature-filters { display: flex; gap: 0.34rem; flex-wrap: wrap; margin-top: 0.55rem; }
      .d6-tab, .d6-filter { border: 1px solid #d6deea; background: #f8fafc; color: #4f6177; border-radius: 999px; padding: 0.36rem 0.72rem; font-size: 1.05rem; cursor: pointer; }
      .d6-tab.active, .d6-filter.active { background: #eefaf8; border-color: #98d1cb; color: #115e59; font-weight: 700; }
      #d6-signatures-summary { color: #4a5568; font-size: 1.2rem; margin: 0.65rem 0 0.72rem; }
      #d6-signature-legend { margin-top: 0.6rem; border: 1px dashed #d5deea; border-radius: 0.5rem; background: #fafcff; padding: 0.55rem 0.65rem; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; }
      .d6-legend-item { display: flex; align-items: center; gap: 0.42rem; font-size: 1rem; color: #42556b; }
      .d6-legend-swatch { width: 1.05rem; height: 1.05rem; border-radius: 0.2rem; border: 1px solid #c9d6e6; flex-shrink: 0; }
      .d6-legend-swatch.whole { background: repeating-linear-gradient(-45deg, #8bc9ea 0 5px, #d9eef9 5px 10px); border-color: #8bc9ea; }
      .d6-legend-swatch.section { background: #1d6fb8; border-color: #1d6fb8; }
      .d6-legend-swatch.fact { background: #f6b200; border-color: #f6b200; }
      .d6-sig-list { display: grid; gap: 0.52rem; padding-right: 0.2rem; }
      .d6-sig-card { border: 1px solid #d5dbe3; background: #fbfdff; border-radius: 0.6rem; padding: 0.65rem; cursor: pointer; color: #1b1f24; text-align: left; box-shadow: 0 1px 0 rgba(15,23,42,0.02); }
      .d6-sig-card:hover { background: #f6f9fd; border-color: #bfcbda; }
      .d6-sig-card.active { border-color: #0f766e; box-shadow: 0 0 0 2px rgba(15,118,110,0.14); background: #f0fbf9; }
      .d6-sig-line1 { display: flex; justify-content: space-between; gap: 0.45rem; font-size: 1.45rem; font-weight: 700; align-items: center; }
      .d6-sig-line1 .d6-name { display: inline-flex; align-items: center; gap: 0.42rem; min-width: 0; }
      .d6-sig-line1 .d6-avatar { width: 2.45rem; height: 2.45rem; border-radius: 50%; display: inline-grid; place-items: center; font-size: 1rem; font-weight: 700; background: #e9eff7; color: #30445c; flex-shrink: 0; }
      .d6-sig-line1 .d6-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .d6-sig-line2 { color: #4f6177; font-size: 1.1rem; margin-top: 0.28rem; }
      .d6-sig-line3 { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.35rem; }
      .d6-coverage-pill { border: 1px solid #d7dee8; border-radius: 999px; padding: 0.12rem 0.52rem; font-size: 0.98rem; background: #f6f8fb; color: #334155; }
      .d6-card-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; margin-top: 0.4rem; }
      .d6-card-nav { display: inline-flex; align-items: center; gap: 0.3rem; }
      .d6-nav-btn { border: 1px solid #d5dbe3; border-radius: 0.3rem; background: #f7fafc; color: #111111; cursor: pointer; padding: 0.08rem 0.32rem; font-size: 1rem; }
      .d6-nav-btn.enabled { color: #1a7f37; border-color: #bde1c6; background: #eef8e6; }
      .d6-nav-btn:disabled { opacity: 1; cursor: default; color: #111111; }
      .d6-nav-count { font-size: 0.95rem; color: #5f6f81; min-width: 3rem; text-align: center; }
      .d6-card-detail-btn { border: 1px solid #d5dbe3; border-radius: 0.3rem; background: #f7fafc; color: #334155; cursor: pointer; padding: 0.14rem 0.5rem; font-size: 0.95rem; }
      .d6-badge { border: 1px solid #d7dee8; border-radius: 999px; padding: 0.2rem 0.64rem; text-transform: none; font-size: 1rem; font-weight: 700; }
      .d6-badge.valid { color: #1a7f37; background: #edf8ef; border-color: #c9e7d0; }
      .d6-badge.invalid, .d6-badge.revoked { color: #a40d00; background: #fdeeee; border-color: #f5c8c2; }
      .d6-badge.unknown { color: #ad5f00; background: #fff7eb; border-color: #f3ddba; }
      #d6-signature-detail { margin-top: 0.8rem; border: 1px solid #d5dbe3; border-radius: 0.5rem; padding: 0.95rem; font-size: 1.22rem; line-height: 1.65rem; background: #ffffff; }
      #d6-signature-detail.hidden { display: none; }
      #d6-signature-detail .d6-detail-head { margin-bottom: 0.52rem; }
      #d6-signature-detail .d6-detail-title { font-size: 1.5rem; font-weight: 700; line-height: 1.25; }
      #d6-signature-detail .d6-detail-subtitle { font-size: 1.15rem; color: #5c6c7f; margin-top: 0.1rem; }
      #d6-signature-detail .d6-kv { display: grid; grid-template-columns: 8.6rem 1fr; gap: 0.36rem 0.62rem; align-items: start; margin-top: 0.45rem; }
      #d6-signature-detail .d6-k { color: #4f6177; font-size: 1.08rem; }
      #d6-signature-detail .d6-v { color: #1b1f24; font-size: 1.2rem; word-break: break-word; }
      #d6-signature-detail .d6-metrics { display: flex; flex-wrap: wrap; gap: 0.34rem; margin: 0.56rem 0 0.24rem; }
      #d6-signature-detail .d6-metric { border: 1px solid #dde4ed; border-radius: 999px; background: #f7f9fc; color: #334155; font-size: 0.86rem; padding: 0.24rem 0.56rem; }
      #d6-signature-detail .d6-links { margin-top: 0.42rem; display: grid; gap: 0.2rem; }
      #d6-signature-detail .d6-links a { color: #0f5ea8; text-decoration: none; font-size: 0.9rem; }
      #d6-signature-detail .d6-links a:hover { text-decoration: underline; }
      #d6-signature-detail details { margin-top: 0.56rem; border-top: 1px dashed #d9e0e8; padding-top: 0.5rem; }
      #d6-signature-detail summary { cursor: pointer; font-size: 1.12rem; font-weight: 600; color: #42556b; }
      #d6-signature-detail .d6-empty { color: #7b8796; font-style: italic; }
      #d6-signature-detail .d6-tab-section { display: none; }
      #d6-signature-detail .d6-tab-section.active { display: block; }
      #d6-signature-detail .d6-coverage-list { margin-top: 0.28rem; display: grid; gap: 0.3rem; }
      #d6-signature-detail .d6-coverage-row { display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; border: 1px solid #e0e7ef; border-radius: 0.4rem; padding: 0.28rem 0.42rem; }
      #d6-signature-detail .d6-coverage-label { font-size: 0.92rem; color: #1f2937; word-break: break-word; }
      #d6-signature-detail .d6-jump-btn { border: 1px solid #d5dbe3; border-radius: 0.3rem; background: #f8fafc; color: #334155; cursor: pointer; padding: 0.24rem 0.5rem; font-size: 0.84rem; flex-shrink: 0; }
      #d6-signature-detail .d6-jump-btn:hover { background: #eef3f8; }
      #d6-unresolved-targets { margin-top: 0.56rem; border-top: 1px dashed #d9e0e8; padding-top: 0.5rem; color: #9b1c1c; font-size: 0.9rem; white-space: pre-wrap; }
      #d6-hash-check-actions { display: flex; gap: 0.4rem; align-items: center; margin-top: 0.65rem; }
      #d6-check-hash-btn, #d6-open-hash-url-btn { border: 1px solid #d5dbe3; border-radius: 0.32rem; background: #f7fafc; color: inherit; cursor: pointer; padding: 0.34rem 0.66rem; font-size: 0.9rem; }
      #d6-check-hash-btn:hover, #d6-open-hash-url-btn:hover { background: #eef3f8; }
      #d6-hash-check-panel { margin-top: 0.55rem; display: none; border-top: 1px solid var(--colour-border-grey); padding-top: 0.5rem; }
      #d6-hash-check-panel.visible { display: block; }
      #d6-hash-check-panel img { width: 148px; height: 148px; border: 1px solid var(--colour-border-grey); border-radius: 0.25rem; background: #fff; }
      #d6-hash-check-panel .d6-caption { margin-top: 0.35rem; font-size: 0.7rem; color: var(--colour-text-light); word-break: break-all; }
      #inspector-head .controls #d6-panel-toggle .d6-fingerprint img { width: 100%; height: 100%; display: block; object-fit: contain; background: transparent; }
      #inspector-head .controls #d6-panel-toggle {
        width: 3.2rem;
        height: 3.2rem;
        text-align: center;
        color: var(--colour-icon-grey);
        box-sizing: border-box;
        cursor: pointer;
        font-size: 2.2rem;
        line-height: 3.2rem;
        user-select: none;
        border: none;
        padding: 0;
        border-radius: 3px;
        border: solid 0.1rem var(--colour-border-grey);
        background-color: var(--colour-button-bg);
        margin: 0 0.5rem;
        display: inline-block;
        vertical-align: top;
        position: relative;
      }
      #inspector-head .controls #d6-panel-toggle .d6-fingerprint { position: absolute; inset: 0.1rem; display: block; line-height: 0; }
      #d6-panel-toggle.active { outline: 2px solid #339900; outline-offset: 1px; }
      #inspector.d6-alert #d6-panel-toggle,
      #inspector.d6-alert #d6-panel-toggle.active { color: #b01a0b; outline-color: #b01a0b; }
      #d6-signature-tabs, #d6-signature-legend { display: none !important; }
      #d6-signature-filters { display: flex; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.55rem; }
      .d6-filter { font-size: 1.2rem; padding: 0.38rem 0.9rem; }
      .d6-filter.active { background: #e8f5ee; border-color: #9ccfb3; color: #116137; font-weight: 700; }
      .d6-filter.locked { cursor: default; }
      #d6-signatures-summary { margin: 0.6rem 0 0.6rem; font-size: 1.2rem; }
      .d6-sig-list { grid-template-columns: 1fr; gap: 0.5rem; }
      .d6-sig-card { padding: 0.56rem 0.62rem; border-radius: 0.55rem; }
      .d6-sig-line1 { align-items: center; font-size: 1.5rem; }
      .d6-sig-line1 .d6-avatar { width: 2.8rem; height: 2.8rem; font-size: 1.08rem; }
      .d6-sig-line3 { display: none; }
      .d6-sig-meta-row { margin-top: 0.3rem; display: flex; gap: 0.35rem; align-items: center; justify-content: flex-start; }
      .d6-sig-cov { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; flex-wrap: wrap; }
      .d6-sig-nav-inline { display: inline-flex; align-items: center; gap: 0.22rem; font-size: 1.1rem; color: #0f172a; margin-left: 0.45rem; padding-left: 0.45rem; border-left: 1px solid #cfd8e6; white-space: nowrap; }
      .d6-nav-btn-inline { border: 0; background: transparent; cursor: pointer; font-size: 1.35rem; line-height: 1; padding: 0 0.12rem; color: #111; }
      .d6-nav-btn-inline.enabled { color: #1a7f37; }
      .d6-nav-btn-inline:disabled { color: #1f2937; opacity: 0.75; cursor: default; }
      .d6-nav-count-inline { min-width: 2.8rem; text-align: center; font-weight: 700; font-size: 1rem; color: #334155; }
      .d6-coverage-pill { font-size: 1rem; padding: 0.18rem 0.56rem; display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
      .d6-coverage-pill.with-nav { padding-right: 0.38rem; }
      .d6-coverage-main { display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
      .d6-cov-swatch { width: 0.95rem; height: 0.95rem; border-radius: 0.18rem; border: 1px solid transparent; flex-shrink: 0; }
      .d6-cov-swatch.whole.d6-sig-style-1 { background: repeating-linear-gradient(-45deg, #1d4ed8 0 3px, #bfdbfe 3px 6px); border-color: #1d4ed8; }
      .d6-cov-swatch.whole.d6-sig-style-2 { background: repeating-linear-gradient(45deg, #9333ea 0 3px, #f5d0fe 3px 6px); border-color: #9333ea; }
      .d6-cov-swatch.whole.d6-sig-style-3 { background: radial-gradient(circle, #0f766e 40%, #a7f3d0 41% 100%); background-size: 4px 4px; border-color: #0f766e; }
      .d6-cov-swatch.section.d6-sig-style-1 { background: #1d4ed8; border-color: #1d4ed8; }
      .d6-cov-swatch.section.d6-sig-style-2 { background: repeating-linear-gradient(45deg, #9333ea 0 2px, #f5d0fe 2px 4px); border-color: #9333ea; }
      .d6-cov-swatch.section.d6-sig-style-3 { background: radial-gradient(circle, #0f766e 40%, #a7f3d0 41% 100%); background-size: 4px 4px; border-color: #0f766e; }
      .d6-cov-swatch.fact.d6-sig-style-1 { background: #f59e0b; border-color: #f59e0b; }
      .d6-cov-swatch.fact.d6-sig-style-2 { background: repeating-linear-gradient(45deg, #9333ea 0 2px, #f5d0fe 2px 4px); border-color: #9333ea; }
      .d6-cov-swatch.fact.d6-sig-style-3 { background: radial-gradient(circle, #0f766e 40%, #a7f3d0 41% 100%); background-size: 4px 4px; border-color: #0f766e; }
      #d6-tamper-watermark { position: absolute; inset: 0; display: none; z-index: 12; pointer-events: none; place-items: center; text-align: center;
        font-size: clamp(1.05rem, 2.6vw, 2rem); letter-spacing: 0.08em; font-weight: 800;
        color: rgba(220, 0, 0, 0.65);
        background: repeating-linear-gradient(-35deg, rgba(220,0,0,0.22), rgba(220,0,0,0.22) 10px, transparent 10px, transparent 20px);
      }
      #d6-tamper-watermark.visible { display: grid; }

      /* ── META-INF Inspector: header button ──────────────────────────────── */
      #d6-inspector-btn {
        width: 3.2rem; height: 3.2rem; text-align: center; cursor: pointer;
        font-size: 1.6rem; user-select: none;
        border: solid 0.1rem #cbcbcb; border-radius: 3px;
        background-color: #f8f8f8; color: #595959;
        padding: 0; box-sizing: border-box;
        flex-shrink: 0; align-self: center;
      }
      #d6-inspector-btn:hover { background-color: #e6e6e6; }
      #d6-inspector-btn.active {
        background-color: #026dce; border-color: #0158a5; color: #fff;
      }

      /* ── META-INF Inspector: drawer ──────────────────────────────────────── */
      #d6-inspector-drawer {
        position: fixed; top: var(--top-bar-height, 3.5rem); right: 0; bottom: 0; z-index: 300;
        width: 460px; background: #fff; border-left: 1px solid #cbcbcb;
        display: flex; flex-direction: column; overflow: hidden;
        transform: translateX(470px);
        transition: transform 0.25s cubic-bezier(.4,0,.2,1);
        box-shadow: -4px 0 20px rgba(0,0,0,.18);
      }
      #d6-inspector-drawer.open { transform: translateX(0); }
      .d6-insp-topbar {
        padding: 8px 10px; border-bottom: 1px solid #d0d7de;
        display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        background: #f6f8fa;
      }
      .d6-insp-title { font-size: 1.15rem; font-weight: 700; flex: 1; color: #1b1f24; }
      .d6-detail-level {
        display: flex; border: 1px solid #d0d7de; border-radius: 4px;
        overflow: hidden; font-size: 1rem;
      }
      .d6-detail-level button {
        padding: 2px 7px; background: #fff; border: none; cursor: pointer;
        color: #6e7781; border-right: 1px solid #d0d7de; font-size: 1rem;
      }
      .d6-detail-level button:last-child { border-right: none; }
      .d6-detail-level button.active { background: #0f5ea8; color: #fff; }
      .d6-insp-expand {
        background: #fff; border: 1px solid #d0d7de; border-radius: 4px;
        cursor: pointer; color: #6e7781; font-size: 1rem; padding: 2px 7px;
        white-space: nowrap;
      }
      .d6-insp-expand:hover { background: #f6f8fa; color: #1b1f24; }
      .d6-insp-close {
        background: none; border: none; cursor: pointer; color: #6e7781;
        font-size: 1.4rem; padding: 0 4px; line-height: 1; border-radius: 3px;
      }
      .d6-insp-close:hover { background: #f6f8fa; }
      .d6-insp-tabs {
        display: flex; border-bottom: 1px solid #d0d7de; background: #f6f8fa;
        flex-shrink: 0;
      }
      .d6-insp-tab {
        padding: 0 14px; height: 36px; line-height: 36px; font-size: 1.05rem;
        font-weight: 600; cursor: pointer; color: #6e7781;
        border-bottom: 2px solid transparent;
        background: none; border-top: none; border-left: none; border-right: none;
      }
      .d6-insp-tab:hover { color: #1b1f24; }
      .d6-insp-tab.active { color: #0f5ea8; border-bottom-color: #0f5ea8; }
      .d6-insp-body { flex: 1; overflow-y: auto; }
      .d6-insp-pane { display: none; padding: 12px; }
      .d6-insp-pane.active { display: block; }

      /* ── META-INF Inspector: field detail cards ──────────────────────────── */
      .d6-insp-json { background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 9px 11px; margin-bottom: 10px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 1.05rem; line-height: 1.8; }
      .d6-jk { color: #0550ae; cursor: pointer; }
      .d6-jk:hover { text-decoration: underline; }
      .d6-js { color: #0a3069; }
      .d6-ju { color: #6e40c9; word-break: break-all; }
      .d6-jh { color: #953800; font-size: 0.95rem; word-break: break-all; }
      .d6-exp-card {
        display: none; margin: 2px 0 6px 14px; border-radius: 5px;
        padding: 7px 10px; font-size: 1.05rem; line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      }
      .d6-exp-card.open { display: block; }
      .d6-exp-plain { background: #fffbdd; border: 1px solid #d4a72c; }
      .d6-exp-std   { background: #ddf4ff; border: 1px solid #a8c8e8; }
      .d6-exp-tech  { background: #161b22; border: 1px solid #30363d; color: #c9d1d9; font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.95rem; }
      .d6-exp-lbl { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; display: block; margin-bottom: 3px; }
      .d6-exp-plain .d6-exp-lbl { color: #735c0f; }
      .d6-exp-std   .d6-exp-lbl { color: #0550ae; }
      .d6-exp-tech  .d6-exp-lbl { color: #8b949e; }

      /* ── META-INF Inspector: full-page overlay ───────────────────────────── */
      #d6-inspector-fullpage {
        display: none; position: fixed; inset: 0; z-index: 200;
        background: #f6f8fa; flex-direction: column;
      }
      #d6-inspector-fullpage.open { display: flex; }
      .d6-fp-bar {
        height: 48px; background: #24292f; display: flex; align-items: center;
        gap: 10px; padding: 0 16px; flex-shrink: 0;
      }
      .d6-fp-back {
        color: #8b949e; font-size: 1.1rem; background: none;
        border: 1px solid #444c56; border-radius: 5px; padding: 3px 10px; cursor: pointer;
      }
      .d6-fp-back:hover { color: #cdd9e5; }
      .d6-fp-title { color: #fff; font-weight: 700; font-size: 1.3rem; }
      .d6-fp-sub { color: #8b949e; font-size: 1rem; }
      .d6-fp-body { flex: 1; display: flex; overflow: hidden; }
      .d6-fp-graph {
        width: 38%; min-width: 340px; background: #fff; border-right: 1px solid #d0d7de;
        display: flex; flex-direction: column; overflow: hidden;
      }
      .d6-fp-graph-hd {
        padding: 9px 14px; border-bottom: 1px solid #d0d7de;
        font-size: 1rem; font-weight: 700; color: #6e7781; flex-shrink: 0;
      }
      .d6-fp-graph-scroll { flex: 1; overflow-y: auto; padding: 16px; }
      .d6-fp-node {
        border: 2px solid #d0d7de; border-radius: 7px; padding: 7px 14px;
        text-align: center; cursor: pointer; background: #fff; user-select: none;
        transition: box-shadow .12s, border-color .12s; margin-bottom: 4px;
        position: relative;
      }
      .d6-fp-node:hover { box-shadow: 0 2px 7px rgba(0,0,0,.1); }
      .d6-fp-node.selected { border-color: #0f5ea8; box-shadow: 0 0 0 3px #ddf4ff; }
      .d6-fp-node.d6n-root { background: #0f5ea8; border-color: #0a4a87; }
      .d6-fp-node.d6n-valid { background: #f0fff4; border-color: #74c786; }
      .d6-fp-node.d6n-entry { background: #f0f4ff; border-color: #7c9eed; }
      .d6-fp-node .d6n-name { font-size: 1rem; font-weight: 700; font-family: "SFMono-Regular", Consolas, monospace; }
      .d6-fp-node.d6n-root .d6n-name { color: #fff; }
      .d6-fp-node.d6n-valid .d6n-name { color: #1a7f37; }
      .d6-fp-node.d6n-entry .d6n-name { color: #0550ae; }
      .d6-fp-node .d6n-sub { font-size: 0.9rem; margin-top: 1px; color: #6e7781; }
      .d6-fp-node.d6n-root .d6n-sub { color: #aac8f0; }
      .d6-fp-node.d6n-valid .d6n-sub { color: #2da44e; }
      .d6-fp-conn { text-align: center; font-size: 0.85rem; color: #6e7781; font-style: italic; padding: 2px 0; }
      .d6-fp-level { display: flex; gap: 10px; justify-content: center; margin-bottom: 2px; }
      .d6-fp-detail { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
      .d6-fp-tabs { display: flex; border-bottom: 1px solid #d0d7de; background: #fff; flex-shrink: 0; }
      .d6-fp-tab {
        padding: 0 16px; height: 40px; line-height: 40px; font-size: 1.1rem;
        font-weight: 600; cursor: pointer; color: #6e7781;
        border-bottom: 2px solid transparent;
        background: none; border-top: none; border-left: none; border-right: none;
      }
      .d6-fp-tab:hover { color: #1b1f24; }
      .d6-fp-tab.active { color: #0f5ea8; border-bottom-color: #0f5ea8; }
      .d6-fp-scroll { flex: 1; overflow-y: auto; }
      .d6-fp-panel { display: none; padding: 18px; }
      .d6-fp-panel.active { display: block; }
      .d6-sh { font-size: 0.9rem; font-weight: 700; color: #6e7781; text-transform: uppercase; letter-spacing: .06em; margin: 16px 0 6px; }
      .d6-sh:first-child { margin-top: 0; }
      .d6-sum-cards { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
      .d6-sum-card { flex: 1; min-width: 70px; background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 9px 11px; }
      .d6-sum-n { font-size: 2rem; font-weight: 800; }
      .d6-sum-l { font-size: 0.85rem; color: #6e7781; }
      .d6-nc-valid { color: #1a7f37; }
      .d6-nc-invalid { color: #cf222e; }

      /* ── Technical tab: step accordion ───────────────────────────────────── */
      .d6-step-list { list-style: none; }
      .d6-step { border: 1px solid #d0d7de; border-radius: 7px; overflow: hidden; margin-bottom: 8px; }
      .d6-step-head {
        display: flex; align-items: center; gap: 9px; padding: 8px 12px;
        cursor: pointer; background: #f6f8fa; user-select: none;
      }
      .d6-step-head:hover { background: #ddf4ff; }
      .d6-step-num {
        width: 22px; height: 22px; border-radius: 50%; font-size: 0.9rem;
        font-weight: 700; color: #fff; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0; background: #0f5ea8;
      }
      .d6-step-num.pass { background: #1a7f37; }
      .d6-step-num.fail { background: #cf222e; }
      .d6-step-title { flex: 1; font-size: 1.05rem; font-weight: 600; }
      .d6-step-out { font-size: 1rem; font-weight: 700; }
      .d6-step-out.pass { color: #1a7f37; }
      .d6-step-out.fail { color: #cf222e; }
      .d6-step-chv { color: #6e7781; transition: transform .13s; font-size: 0.9rem; }
      .d6-step-head.open .d6-step-chv { transform: rotate(90deg); }
      .d6-step-body { display: none; padding: 10px 12px; font-size: 1.05rem; line-height: 1.6; }
      .d6-step-body.open { display: block; }
      .d6-code {
        background: #161b22; color: #c9d1d9; border-radius: 5px;
        padding: 9px 11px; font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 0.95rem; line-height: 1.7; margin: 7px 0; overflow-x: auto;
      }
      .d6-tc { background: #dafbe1; border: 1px solid #74c786; border-radius: 5px; padding: 6px 10px; font-size: 0.95rem; color: #1a7f37; margin-top: 8px; }
      .d6-tid { font-family: "SFMono-Regular", Consolas, monospace; background: #fff; border: 1px solid #d0d7de; border-radius: 3px; padding: 0 4px; font-size: 0.9rem; color: #6e7781; }
      .d6-caveat { background: #fff8c5; border: 1px solid #d4a72c; border-radius: 6px; padding: 9px 11px; font-size: 1.05rem; color: #4b3b00; margin-bottom: 8px; }
      .d6-caveat strong { display: block; margin-bottom: 2px; }
      .d6-insp-hl-btn { border: 1px solid #d0d7de; border-radius: 4px; background: #f6f8fa; color: #0f5ea8; cursor: pointer; padding: 2px 8px; font-size: 0.95rem; margin-top: 5px; }
      .d6-insp-hl-btn:hover { background: #ddf4ff; }

      /* ── Validation Authority panel ──────────────────────────────────────── */
      .d6-va-deferred { margin-top: 0.75rem; background: #fffbdd; border: 1px solid #d4a72c; border-radius: 6px; padding: 0.7rem 0.85rem; font-size: 1.05rem; color: #4b3b00; line-height: 1.6; }
      .d6-va-deferred strong { display: block; margin-bottom: 0.25rem; }
      .d6-va-deferred code { background: #f0e8c8; border-radius: 3px; padding: 0 3px; font-size: 0.95rem; }
      .d6-va-panel { margin-top: 0.75rem; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; }
      .d6-va-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #f6f8fa; border-bottom: 1px solid #d0d7de; }
      .d6-va-head-label { font-size: 1rem; font-weight: 700; color: #1b1f24; }
      .d6-va-check-row { display: grid; grid-template-columns: 6rem 1fr; gap: 0.25rem 0.6rem; align-items: start; padding: 0.4rem 0.75rem; border-bottom: 1px solid #f0f3f7; font-size: 1rem; }
      .d6-va-check-row:last-of-type { border-bottom: none; }
      .d6-va-check-label { font-weight: 600; color: #1b1f24; }
      .d6-va-check-detail { grid-column: 2; font-size: 0.9rem; color: #6e7781; }
      .d6-va-identity { display: grid; grid-template-columns: 8rem 1fr; gap: 0.25rem 0.6rem; padding: 0.5rem 0.75rem; border-top: 1px solid #d0d7de; background: #fafcff; font-size: 1rem; }
      .d6-va-identity .d6-k { color: #6e7781; font-size: 0.95rem; }
      .d6-va-identity .d6-v { color: #1b1f24; word-break: break-word; }
    `;
    document.head.appendChild(style);
  }

  _injectUi() {
    if (document.getElementById("d6-signatures-panel")) return;

    const controls = document.querySelector("#inspector-head nav.controls");
    if (controls && !document.getElementById("d6-panel-toggle")) {
      const toggle = document.createElement("button");
      toggle.id = "d6-panel-toggle";
      toggle.type = "button";
      toggle.title = "D6 Signatures";
      toggle.innerHTML = `<span class="d6-fingerprint"><img id="d6-toggle-icon" src="${FINGERPRINT_ICON_GREEN}" alt=""/></span>`;
      toggle.addEventListener("click", () => this._setPanelMode(!this._panelOpen));
      controls.appendChild(toggle);
    }

    const panel = document.createElement("section");
    panel.id = "d6-signatures-panel";
    panel.className = "hidden";
    panel.innerHTML = `
      <div class="d6-panel-head">
        <h3>D6 Signatures</h3>
        <div class="d6-header-actions">
          <button type="button" id="d6-toggle-detail-btn">Details</button>
          <button class="d6-panel-close" type="button" id="d6-panel-close">Close</button>
        </div>
      </div>
      <div id="d6-signature-filters"></div>
      <div id="d6-signatures-summary">Loading signatures...</div>
      <div id="d6-signatures-list" class="d6-sig-list"></div>
      <div id="d6-signature-detail" class="hidden"></div>
    `;

    const inspector = document.getElementById("inspector");
    inspector.appendChild(panel);
    $("#d6-signature-filters").on("click", ".d6-filter", (ev) => {
      const filter = String($(ev.currentTarget).data("filter") || "");
      if (!filter) return;
      if (filter === "valid") {
        this._activeFilters.add("valid");
        this._renderSignatures();
        return;
      }
      if (this._activeFilters.has(filter)) this._activeFilters.delete(filter);
      else this._activeFilters.add(filter);
      this._activeFilters.add("valid");
      this._renderSignatures();
    });
    $("#d6-toggle-detail-btn").on("click", () => this._toggleDetailVisibility());
    const close = document.getElementById("d6-panel-close");
    if (close) close.addEventListener("click", () => this._setPanelMode(false));

    const wm = document.createElement("div");
    wm.id = "d6-tamper-watermark";
    wm.textContent = "DOCUMENT MODIFIED SINCE SIGNING";
    document.getElementById("viewer-pane").appendChild(wm);

    // ── META-INF Inspector button ────────────────────────────────────────────
    if (controls && !document.getElementById("d6-inspector-btn")) {
      const btn = document.createElement("button");
      btn.id = "d6-inspector-btn";
      btn.type = "button";
      btn.title = "META-INF Inspector";
      btn.textContent = "⊞";
      btn.addEventListener("click", () => this._setInspectorDrawerOpen(!this._inspectorDrawerOpen));
      controls.appendChild(btn);
    }

    // ── Inspector drawer ─────────────────────────────────────────────────────
    const drawer = document.createElement("div");
    drawer.id = "d6-inspector-drawer";
    drawer.innerHTML = `
      <div class="d6-insp-topbar">
        <span class="d6-insp-title">META-INF Inspector</span>
        <div class="d6-detail-level" id="d6-insp-level">
          <button data-lvl="simple" title="Plain language">S</button>
          <button data-lvl="standard" class="active" title="Standard">N</button>
          <button data-lvl="technical" title="Technical">T</button>
        </div>
        <button class="d6-insp-expand" id="d6-insp-expand-btn" title="Full view">\u2922 Full view</button>
        <button class="d6-insp-close" id="d6-insp-close-btn" title="Close">\u00d7</button>
      </div>
      <div class="d6-insp-tabs">
        <button class="d6-insp-tab active" data-tab="files">Files</button>
        <button class="d6-insp-tab" data-tab="signers">Signers</button>
        <button class="d6-insp-tab" data-tab="conformance">Conformance</button>
      </div>
      <div class="d6-insp-body">
        <div class="d6-insp-pane active" id="d6-insp-pane-files"></div>
        <div class="d6-insp-pane" id="d6-insp-pane-signers"></div>
        <div class="d6-insp-pane" id="d6-insp-pane-conformance"></div>
      </div>
    `;
    document.body.appendChild(drawer);

    document.getElementById("d6-insp-close-btn").addEventListener("click", () => this._setInspectorDrawerOpen(false));
    document.getElementById("d6-insp-expand-btn").addEventListener("click", () => this._setInspectorFullPageOpen(true));
    document.getElementById("d6-insp-level").addEventListener("click", (ev) => {
      const lvl = ev.target.dataset.lvl;
      if (lvl) this._setInspectorDetailLevel(lvl);
    });
    document.querySelector("#d6-inspector-drawer .d6-insp-tabs").addEventListener("click", (ev) => {
      const tab = ev.target.dataset.tab;
      if (tab) this._showDrawerTab(tab);
    });

    // ── Full-page overlay ────────────────────────────────────────────────────
    const fp = document.createElement("div");
    fp.id = "d6-inspector-fullpage";
    fp.innerHTML = `
      <div class="d6-fp-bar">
        <button class="d6-fp-back" id="d6-fp-back-btn">\u2190 Back</button>
        <span class="d6-fp-title">META-INF Inspector</span>
        <span class="d6-fp-sub" id="d6-fp-subtitle"></span>
        <div style="flex:1"></div>
        <div class="d6-detail-level" id="d6-fp-level">
          <button data-lvl="simple" title="Plain language">S</button>
          <button data-lvl="standard" class="active" title="Standard">N</button>
          <button data-lvl="technical" title="Technical">T</button>
        </div>
      </div>
      <div class="d6-fp-body">
        <div class="d6-fp-graph">
          <div class="d6-fp-graph-hd">Package structure</div>
          <div class="d6-fp-graph-scroll" id="d6-fp-graph-scroll"></div>
        </div>
        <div class="d6-fp-detail">
          <div class="d6-fp-tabs">
            <button class="d6-fp-tab active" data-tab="overview">Overview</button>
            <button class="d6-fp-tab" data-tab="fields">Fields</button>
            <button class="d6-fp-tab" data-tab="coverage">Coverage</button>
            <button class="d6-fp-tab" data-tab="technical">Technical</button>
            <button class="d6-fp-tab" data-tab="conformance">Conformance</button>
          </div>
          <div class="d6-fp-scroll">
            <div class="d6-fp-panel active" id="d6-fp-panel-overview"></div>
            <div class="d6-fp-panel" id="d6-fp-panel-fields"></div>
            <div class="d6-fp-panel" id="d6-fp-panel-coverage"></div>
            <div class="d6-fp-panel" id="d6-fp-panel-technical"></div>
            <div class="d6-fp-panel" id="d6-fp-panel-conformance"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(fp);

    document.getElementById("d6-fp-back-btn").addEventListener("click", () => this._setInspectorFullPageOpen(false));
    document.getElementById("d6-fp-level").addEventListener("click", (ev) => {
      const lvl = ev.target.dataset.lvl;
      if (lvl) this._setInspectorDetailLevel(lvl);
    });
    document.querySelector("#d6-inspector-fullpage .d6-fp-tabs").addEventListener("click", (ev) => {
      const tab = ev.target.dataset.tab;
      if (tab) this._showFpTab(tab);
    });
  }

  async _loadSignatures() {
    const url = this._resolveD6Url();
    if (!url) {
      this._signatures = [];
      return;
    }

    try {
      const d6Url = new URL(url, window.location.href).href;
      const resp = await fetch(d6Url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      this._signatures = await this._normalizeSignatures(json, d6Url);
      this._sigTargetCache = {};
      this._assignSignatureStyles();
      this._loadError = null;
    } catch (e) {
      this._signatures = [];
      this._loadError = `Failed to load D6 signatures: ${e.message}`;
      this._setSummary(this._loadError);
    }
  }

  _resolveD6Url() {
    const qp = new URLSearchParams(window.location.search).get("d6-signatures-url");
    if (qp) return qp;
    return this._iv.runtimeConfig?.d6?.signaturesUrl || "META-INF/d6.json";
  }

  async _normalizeSignatures(data, d6Url) {
    const list = data?.signatures || data?.digitalSignatures || [];
    const out = [];
    for (const [i, sig] of list.entries()) {
      const sigFile = await this._loadSignatureFile(sig, d6Url);
      const subsetFile = await this._loadSubsetFile(sig, sigFile);
      const coverage = this._coverageFromSubset(sig, subsetFile);
      const verify = await this._verifySignature(sig, sigFile, subsetFile);
      const vaResult = await this._fetchVaResult(sig, sigFile);
      const vaInvalid = vaResult?.overallStatus === "invalid";
      const status = this._mapStatus(
        (vaInvalid ? "invalid" : verify.status || sig.verificationStatus || sig.status || "unknown").toLowerCase()
      );
      const revoked = Boolean(sig.revoked || sig.revocationStatus === "revoked");
      const signer = sig.signer || sig.subject || {};
      const selectorList = this._selectorsFromMap(coverage.cssSelectors);
      const selectorFactIds = this._factIdsFromSelectors(selectorList);
      out.push({
        id: sig.id || sig.signatureId || `sig-${i + 1}`,
        signerName: signer.name || sig.signerName || "Unknown signer",
        role: signer.role || sig.role || "role not present",
        type: sig.type || "unknown",
        status,
        revoked,
        signedAt: sig.signedAt || sig.timestamp || "not provided",
        frameworks: Array.isArray(sig.frameworks) ? sig.frameworks.map((f) => f.url || f).filter(Boolean) : [],
        facts: this._unique([
          ...this._asArray(coverage.facts || sig.factIds).map((x) => String(x)),
          ...selectorFactIds
        ]),
        divs: this._asArray(coverage.divs || sig.divIds),
        selectors: selectorList,
        wholeReport: Boolean(coverage.wholeReport || sig.wholeReport),
        verificationReason: verify.reason,
        verificationTrace: verify.trace || [],
        d6Url,
        signatureFileUrl: sigFile?.url || null,
        subsetFileUrl: subsetFile?.url || null,
        targetDigest: sigFile?.json?.targetDigest || null,
        subsetDigest: subsetFile?.json?.digest || null,
        pkiStatus: verify.pkiStatus || null,
        vaResult: vaResult || null
      });
    }
    return out;
  }

  _asArray(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  _mapStatus(status) {
    if (["valid", "ok", "passed"].includes(status)) return "valid";
    if (["invalid", "failed", "tampered"].includes(status)) return "invalid";
    if (status === "revoked") return "revoked";
    return "unknown";
  }

  async _loadSignatureFile(sig, d6Url) {
    const filename = sig?.filename;
    if (!filename) return null;
    const d6Base = new URL(".", new URL(d6Url, window.location.href));
    const candidates = [
      new URL(`signatures/${filename}`, d6Base).href,
      new URL(filename, d6Base).href
    ];
    for (const url of candidates) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const json = await resp.json();
        return { url, json };
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  async _loadSubsetFile(sig, sigFile) {
    if (!sigFile?.json) return null;
    const targetRef = sigFile.json.signatureTarget || this._asArray(sig.targets)[0];
    if (!targetRef) return null;
    const sigBase = new URL(".", new URL(sigFile.url, window.location.href));
    const candidates = [
      new URL(targetRef, sigBase).href,
      new URL(`signatures/${targetRef}`, new URL("..", sigBase)).href
    ];
    for (const url of candidates) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const json = await resp.json();
        return { url, json };
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  _coverageFromSubset(sig, subsetFile) {
    const fallback = sig.coverage || sig.targets || {};
    if (!subsetFile?.json) return fallback;
    const s = subsetFile.json.selection || {};
    return {
      wholeReport: Boolean(s.wholeReport || s.fullReport || this._selectorsFromMap(s.cssSelectors).some((x) => x.selector === "body")),
      facts: this._asArray(s.facts || s.factIds || fallback.facts || sig.factIds),
      divs: this._asArray(s.divs || s.sectionIds || fallback.divs || sig.divIds),
      cssSelectors: s.cssSelectors || fallback.cssSelectors || {}
    };
  }

  async _fetchArrayBuffer(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${url}`);
    return resp.arrayBuffer();
  }

  _parseDigest(value) {
    const v = String(value || "").trim();
    const m = v.match(/^(sha256|sha384|sha512)-([0-9a-f]+)$/);
    if (!m) return null;
    return { alg: m[1], hex: m[2] };
  }

  async _digestHex(buf, alg) {
    const map = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
    const subtleAlg = map[alg];
    if (!subtleAlg) return null;
    const digest = await crypto.subtle.digest(subtleAlg, buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async _verifySignature(sig, sigFile, subsetFile) {
    const trace = [];
    let _pkiStatus = null;
    const pass = (name, detail, specRef, testCases) => { trace.push({ name, outcome: "pass", detail: detail || {}, specRef: specRef || "", testCases: testCases || [] }); };
    const fail = (name, reason, detail, specRef, testCases) => { trace.push({ name, outcome: "fail", detail: { reason, ...(detail || {}) }, specRef: specRef || "", testCases: testCases || [] }); };
    const done = (status, reason) => ({ status, reason, trace, pkiStatus: _pkiStatus });

    // Step 0: algorithm type check
    const sigType = String(sig?.type || "").toLowerCase();
    const ALG_MAP = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
    const algSuffix = ["/d6/conformance/sha256", "/d6/conformance/sha384", "/d6/conformance/sha512"].find((s) => sigType.endsWith(s));
    if (!algSuffix) {
      fail("Type check", "Unsupported signature type", { type: sig?.type }, "D6 §5.1", ["V-204"]);
      return done("unknown", "Unsupported signature type");
    }
    const algKey = algSuffix.split("/").pop();
    const subtleAlg = ALG_MAP[algKey];
    pass("Type check", { type: sig.type, algorithm: subtleAlg }, "D6 §5.1", ["V-000", "V-001", "V-002", "V-204"]);

    // Step 1: files present
    if (!sigFile?.json || !subsetFile?.json) {
      fail("Files present", "Missing signature or subset file", { sigFile: !!sigFile, subsetFile: !!subsetFile }, "D6 §5.2", ["V-100", "V-102"]);
      return done("invalid", "Missing signature/subset file");
    }
    pass("Files present", { signatureFile: sigFile.url, subsetFile: subsetFile.url }, "D6 §5.2", ["V-100", "V-101", "V-102", "V-103"]);

    // Step 2: parse targetDigest
    const td = this._parseDigest(sigFile.json.targetDigest);
    if (!td) {
      fail("Parse targetDigest", "Invalid targetDigest format", { value: sigFile.json.targetDigest }, "D6 §5.3", ["V-010", "V-011"]);
      return done("invalid", "Invalid targetDigest format");
    }
    pass("Parse targetDigest", { raw: sigFile.json.targetDigest, algorithm: td.alg, hexLength: td.hex.length }, "D6 §5.3", ["V-010", "V-011"]);

    // Step 3: fetch subset file and verify hash
    const subsetBytes = await this._fetchArrayBuffer(subsetFile.url);
    const subsetSize = subsetBytes.byteLength;
    const subsetHash = await this._digestHex(subsetBytes, td.alg);
    if (subsetHash !== td.hex) {
      fail("Subset file hash", "Signature target digest mismatch", { expected: td.hex, computed: subsetHash, file: subsetFile.url, bytes: subsetSize }, "D6 §5.4", ["V-200", "V-201", "V-300"]);
      return done("invalid", "Signature target digest mismatch");
    }
    pass("Subset file hash", { file: subsetFile.url, bytes: subsetSize, algorithm: subtleAlg, expected: td.hex, computed: subsetHash }, "D6 §5.4", ["V-200", "V-201", "V-300", "V-304"]);

    // Step 4: parse subset — report reference and selection
    const subset = subsetFile.json;
    const entryRef = subset.report;
    const subsetBase = new URL(".", subsetFile.url);
    if (!entryRef) {
      fail("Parse subset", "Subset missing report target", {}, "D6 §5.5", ["V-305"]);
      return done("invalid", "Subset missing report target");
    }
    const hasSelection = subset.selection && (
      subset.selection.wholeReport || subset.selection.fullReport ||
      (subset.selection.facts && subset.selection.facts.length) ||
      (subset.selection.sectionIds && subset.selection.sectionIds.length) ||
      (subset.selection.cssSelectors && Object.keys(subset.selection.cssSelectors).length)
    );
    if (!hasSelection) {
      fail("Parse subset", "Subset selection is empty", { selection: subset.selection }, "D6 §5.5", ["V-401"]);
      return done("invalid", "Subset selection is empty");
    }
    pass("Parse subset", { report: entryRef, selectionKeys: Object.keys(subset.selection || {}) }, "D6 §5.5", ["V-305", "V-401", "V-407", "V-408", "V-409"]);

    // Step 5: fetch entry point, optionally verify root digest
    const entryUrl = new URL(entryRef, subsetBase).href;
    const entryResp = await fetch(entryUrl);
    if (!entryResp.ok) {
      fail("Fetch entry point", "Report root target not found", { url: entryUrl, status: entryResp.status }, "D6 §5.6", ["V-104", "V-302"]);
      return done("invalid", "Report root target not found");
    }
    const entryBuf = await entryResp.arrayBuffer();
    const entryText = new TextDecoder().decode(entryBuf);
    let entryJson = {};
    try {
      entryJson = JSON.parse(entryText);
    } catch {
      fail("Fetch entry point", "Report root JSON invalid", { url: entryUrl }, "D6 §5.6", []);
      return done("invalid", "Report root JSON invalid");
    }

    const rd = this._parseDigest(subset.digest);
    if (rd) {
      const entryHash = await this._digestHex(entryBuf, rd.alg);
      if (entryHash !== rd.hex) {
        fail("Entry point digest", "Report root digest mismatch", { expected: rd.hex, computed: entryHash, url: entryUrl, bytes: entryBuf.byteLength }, "D6 §5.6", ["V-411"]);
        return done("invalid", "Report root digest mismatch");
      }
      pass("Entry point digest", { url: entryUrl, bytes: entryBuf.byteLength, algorithm: ALG_MAP[rd.alg] || rd.alg, expected: rd.hex, computed: entryHash }, "D6 §5.6", ["V-302", "V-411"]);
    } else {
      pass("Fetch entry point", { url: entryUrl, bytes: entryBuf.byteLength, digestCheck: "not present — optional" }, "D6 §5.6", ["V-302"]);
    }

    // Step 6: supporting document digests
    const docs =
      (entryJson["d6:resources"] && entryJson["d6:resources"].documents) ||
      (entryJson["d6:supportingDocuments"] && entryJson["d6:supportingDocuments"].documents) ||
      {};

    for (const [docRef, dig] of Object.entries(docs)) {
      const parsed = this._parseDigest(dig);
      if (!parsed) {
        fail("Supporting doc digest", `Invalid digest string for ${docRef}`, { docRef, digest: dig }, "D6 §5.7", []);
        return done("invalid", `Invalid digest string for ${docRef}`);
      }
      const docUrl = new URL(docRef, new URL(".", entryUrl)).href;
      const docResp = await fetch(docUrl);
      if (!docResp.ok) {
        fail("Supporting doc digest", `Missing file for digest ${docRef}`, { docRef, url: docUrl }, "D6 §5.7", ["V-302"]);
        return done("invalid", `Missing file for digest ${docRef}`);
      }
      const docBuf = await docResp.arrayBuffer();
      const docHash = await this._digestHex(docBuf, parsed.alg);
      if (docHash !== parsed.hex) {
        fail("Supporting doc digest", `Document digest mismatch ${docRef}`, { docRef, expected: parsed.hex, computed: docHash }, "D6 §5.7", ["V-300"]);
        return done("invalid", `Document digest mismatch ${docRef}`);
      }
      pass("Supporting doc digest", { docRef, bytes: docBuf.byteLength, algorithm: ALG_MAP[parsed.alg] || parsed.alg, match: true }, "D6 §5.7", ["V-300", "V-302"]);
    }

    // Step 7: PKI signature verification
    const pkiResult = await this._verifyPkiSignature(sig, sigFile);
    _pkiStatus = pkiResult.status;
    if (pkiResult.status === "invalid") {
      fail("PKI signature verify", pkiResult.reason, { pkiStatus: "invalid", algorithm: sig.algorithm }, "D6 §5.1", ["TC-PKI-02"]);
      return done("invalid", pkiResult.reason);
    }
    if (pkiResult.status === "skipped") {
      trace.push({ name: "PKI signature verify", outcome: "skipped", detail: { pkiStatus: "skipped", reason: pkiResult.reason }, specRef: "D6 §5.1", testCases: ["TC-PKI-03", "TC-PKI-04"] });
    } else {
      pass("PKI signature verify", { pkiStatus: "valid", algorithm: sig.algorithm }, "D6 §5.1", ["TC-PKI-01"]);
    }

    return done("valid", "Conformance digest checks passed");
  }

  /**
   * _verifyPkiSignature — verify a D6 PKI signature using the browser WebCrypto API.
   *
   * Supported algorithms (mapped from the `algorithm` field in the sig manifest):
   *   RSA-PSS/SHA-256, RSA-PSS/SHA-384, RSA-PSS/SHA-512
   *   ECDSA/P-256  (uses SHA-256), ECDSA/P-384  (uses SHA-384)
   *
   * The signing input is:
   *   - `signingInput` (base64url) from sigFile.json when present, OR
   *   - the UTF-8 encoding of `targetDigest` from sigFile.json.
   *
   * Returns { status: "valid"|"invalid"|"skipped", reason }
   */
  async _verifyPkiSignature(sig, sigFile) {
    const json = sigFile?.json || sig;

    // Extract fields from the sig file (preferred) falling back to the manifest entry
    const publicKeyJwk = json.publicKey || sig.publicKey;
    const signatureValueB64 = json.signatureValue || sig.signatureValue;

    if (!publicKeyJwk) {
      return { status: "skipped", reason: "No publicKey in signature file — PKI verification skipped" };
    }
    if (!signatureValueB64) {
      return { status: "skipped", reason: "No signatureValue in signature file — PKI verification skipped" };
    }

    // Build the signing input bytes
    let signingInputBytes;
    if (json.signingInput || sig.signingInput) {
      const b64 = json.signingInput || sig.signingInput;
      try {
        signingInputBytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      } catch {
        return { status: "invalid", reason: "signingInput is not valid base64url" };
      }
    } else {
      // Default: UTF-8 encode the targetDigest string
      const targetDigest = json.targetDigest || sig.targetDigest || "";
      signingInputBytes = new TextEncoder().encode(targetDigest);
    }

    // Decode the signature value
    let signatureBytes;
    try {
      const b64std = signatureValueB64.replace(/-/g, "+").replace(/_/g, "/");
      signatureBytes = Uint8Array.from(atob(b64std), (c) => c.charCodeAt(0));
    } catch {
      return { status: "invalid", reason: "signatureValue is not valid base64url" };
    }

    // Map algorithm string → WebCrypto import params + verify params
    const algorithmStr = String(json.algorithm || sig.algorithm || "").trim();
    let importParams, verifyParams;
    if (/^RSA-PSS\/(SHA-256|SHA-384|SHA-512)$/i.test(algorithmStr)) {
      const hash = algorithmStr.split("/")[1].toUpperCase();
      const saltLength = hash === "SHA-256" ? 32 : hash === "SHA-384" ? 48 : 64;
      importParams = { name: "RSA-PSS", hash };
      verifyParams = { name: "RSA-PSS", saltLength };
    } else if (/^ECDSA\/(P-256|P-384)$/i.test(algorithmStr)) {
      const curve = algorithmStr.split("/")[1].toUpperCase();
      const hash = curve === "P-256" ? "SHA-256" : "SHA-384";
      importParams = { name: "ECDSA", namedCurve: curve };
      verifyParams = { name: "ECDSA", hash };
    } else if (!algorithmStr) {
      return { status: "skipped", reason: "No algorithm specified — PKI verification skipped" };
    } else {
      return { status: "skipped", reason: `Unsupported PKI algorithm "${algorithmStr}" — PKI verification skipped` };
    }

    try {
      const cryptoKey = await crypto.subtle.importKey("jwk", publicKeyJwk, importParams, false, ["verify"]);
      const valid = await crypto.subtle.verify(verifyParams, cryptoKey, signatureBytes, signingInputBytes);
      if (!valid) {
        return { status: "invalid", reason: "Signature value does not match public key" };
      }
      return { status: "valid", reason: "PKI signature verified successfully" };
    } catch (e) {
      return { status: "invalid", reason: `PKI verification error: ${e.message}` };
    }
  }

  async _fetchVaResult(sig, sigFile) {
    const vaUrl = this._iv.runtimeConfig?.d6?.validationAuthorityUrl;
    if (!vaUrl) return { overallStatus: "not-configured" };

    const body = {
      version: 1,
      signatureId: sig.id || sig.signatureId,
      algorithm: sigFile?.json?.algorithm || sig.algorithm || null,
      publicKey: sigFile?.json?.publicKey || sig.publicKey || null,
      signatureValue: sigFile?.json?.signatureValue || sig.signatureValue || null,
      certificateChain: sigFile?.json?.certificateChain || sig.certificateChain || null,
      d6Url: sig.d6Url || null,
      requestedChecks: ["chain", "revocation", "trustAnchor"]
    };

    const token = this._iv.runtimeConfig?.d6?.validationAuthorityToken;
    const headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`${vaUrl.replace(/\/$/, "")}/validate`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) return { overallStatus: "unknown", errorCode: `HTTP_${resp.status}` };
      const json = await resp.json();
      // VR-13: validate required fields
      if (typeof json.version !== "number" || !json.signatureId || !json.overallStatus) {
        return { overallStatus: "error", errorCode: "INVALID_RESPONSE", errorMessage: "VA response missing required fields" };
      }
      return json;
    } catch (e) {
      const isTimeout = e.name === "AbortError";
      return { overallStatus: "unknown", errorCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR", errorMessage: e.message };
    }
  }

  _vaStatusLabel(vaResult) {
    if (!vaResult) return null;
    const s = vaResult.overallStatus;
    if (s === "not-configured") return null;
    if (s === "valid") return "Chain valid";
    if (s === "invalid") return "Chain invalid";
    if (s === "partial") return "Chain partial";
    if (s === "skipped") return "Chain not checked";
    if (s === "error") return "VA error";
    return "Chain unknown";
  }

  _renderVaPanel(vaResult) {
    if (!vaResult || vaResult.overallStatus === "not-configured") {
      return `<div class="d6-va-deferred">
        <strong>Certificate chain validation is not available in this session.</strong>
        The cryptographic signature has been verified against the embedded public key,
        but the signing certificate has not been checked against a trusted CA,
        revocation lists, or eIDAS / vLEI trust anchors.
        To enable full validation, configure <code>d6.validationAuthorityUrl</code>
        in <code>ixbrlviewer.config.json</code>.
      </div>`;
    }

    const statusClass = { valid: "valid", invalid: "invalid", partial: "unknown", skipped: "unknown", error: "unknown" }[vaResult.overallStatus] || "unknown";
    const checks = vaResult.checks || {};

    const checkRow = (key, label) => {
      const c = checks[key];
      if (!c) return "";
      const cls = { valid: "valid", invalid: "invalid", unknown: "unknown", skipped: "unknown" }[c.status] || "unknown";
      const extra = c.family ? ` · ${this._esc(c.family)}${c.level ? " " + this._esc(c.level) : ""}` : "";
      return `<div class="d6-va-check-row">
        <span class="d6-badge ${cls}" style="font-size:0.9rem">${this._esc(c.status)}</span>
        <span class="d6-va-check-label">${this._esc(label)}${extra}</span>
        ${c.detail ? `<span class="d6-va-check-detail">${this._esc(c.detail)}</span>` : ""}
      </div>`;
    };

    const certInfo = vaResult.certInfo;
    const vLeiInfo = vaResult.vLeiInfo;
    let identityHtml = "";
    if (vLeiInfo) {
      identityHtml = `<div class="d6-va-identity">
        <div class="d6-k">Legal name</div><div class="d6-v">${this._esc(vLeiInfo.legalName || "—")}</div>
        <div class="d6-k">Role</div><div class="d6-v">${this._esc(vLeiInfo.role || "—")}</div>
        <div class="d6-k">LEI</div><div class="d6-v">${this._esc(vLeiInfo.lei || "—")}</div>
        <div class="d6-k">QVI</div><div class="d6-v">${this._esc(vLeiInfo.qvi || "—")}</div>
        <div class="d6-k">vLEI status</div><div class="d6-v">${this._esc(vLeiInfo.credentialStatus || "—")}</div>
      </div>`;
    } else if (certInfo) {
      identityHtml = `<div class="d6-va-identity">
        <div class="d6-k">Subject</div><div class="d6-v">${this._esc(certInfo.subject || "—")}</div>
        <div class="d6-k">Issuer</div><div class="d6-v">${this._esc(certInfo.issuer || "—")}</div>
        <div class="d6-k">Valid from</div><div class="d6-v">${this._esc(certInfo.notBefore || "—")}</div>
        <div class="d6-k">Valid to</div><div class="d6-v">${this._esc(certInfo.notAfter || "—")}</div>
      </div>`;
    }

    return `<div class="d6-va-panel">
      <div class="d6-va-head">
        <span class="d6-badge ${statusClass}">${this._esc(this._vaStatusLabel(vaResult) || vaResult.overallStatus)}</span>
        <span class="d6-va-head-label">Validation Authority</span>
      </div>
      ${checkRow("chain", "Certificate chain")}
      ${checkRow("revocation", "Revocation")}
      ${checkRow("trustAnchor", "Trust anchor")}
      ${identityHtml}
    </div>`;
  }

  _selectorsFromMap(cssSelectors) {
    if (!cssSelectors || typeof cssSelectors !== "object") return [];
    const selectors = [];
    for (const [docPath, list] of Object.entries(cssSelectors)) {
      for (const selector of this._asArray(list)) {
        selectors.push({ docPath, selector });
      }
    }
    return selectors;
  }

  _selectorToId(selector) {
    const s = String(selector || "").trim();
    if (!s) return null;
    const hash = s.match(/^#([A-Za-z0-9:_-]+)$/);
    if (hash) return hash[1];
    const attr = s.match(/^\[id=(?:"|')?([A-Za-z0-9:_-]+)(?:"|')?\]$/);
    if (attr) return attr[1];
    return null;
  }

  _normalizeFactId(raw) {
    const id = String(raw || "").trim();
    if (!id) return null;
    if (/^f\d+$/.test(id)) return id.slice(1);
    if (/^\d+$/.test(id)) return id;
    return null;
  }

  _factIdsFromSelectors(selectors) {
    const out = [];
    for (const item of selectors || []) {
      const id = this._selectorToId(item?.selector);
      const fact = this._normalizeFactId(id);
      if (fact) out.push(fact);
    }
    return this._unique(out);
  }

  _unique(list) {
    return [...new Set((list || []).filter((x) => this._isPresent(x)))];
  }

  _coverageLabels(sig) {
    const labels = [];
    if (sig.wholeReport) labels.push("Whole report");
    const selectorFacts = new Set(this._factIdsFromSelectors(sig.selectors));

    for (const item of sig.selectors || []) {
      const selector = item.selector || "";
      const selectorId = this._selectorToId(selector);
      const selectorFact = this._normalizeFactId(selectorId);
      if (selectorFact) {
        labels.push(`Fact ${selectorFact}`);
        continue;
      }
      if (selector === "div.page.audit-report") labels.push("Audit report section");
      else if (selector === "body") labels.push("Whole report");
      else if (selector) labels.push(`Selector ${selector}`);
    }

    for (const id of sig.facts || []) {
      if (selectorFacts.has(String(id))) continue;
      labels.push(`Fact ${id}`);
    }
    for (const id of sig.divs || []) labels.push(`Section ${id}`);
    return [...new Set(labels)];
  }

  _coverageKey(sig) {
    if (sig.wholeReport) return "whole:body";
    const items = this._coverageItems(sig)
      .filter((x) => x.type !== "whole")
      .map((x) => `${x.type}:${x.value}`)
      .sort();
    return items.join("|") || "unknown";
  }

  _assignSignatureStyles() {
    const styleClasses = ["d6-sig-style-1", "d6-sig-style-2", "d6-sig-style-3"];
    const nextByCoverage = new Map();
    const byId = {};
    for (const sig of this._signatures) {
      const key = this._coverageKey(sig);
      const next = nextByCoverage.get(key) || 0;
      byId[sig.id] = styleClasses[next % styleClasses.length];
      nextByCoverage.set(key, next + 1);
    }
    this._sigStyleById = byId;
  }

  _renderSignatures() {
    const listEl = $("#d6-signatures-list");
    listEl.empty();
    this._renderFilters();

    if (!this._signatures.length) {
      if (!this._loadError) {
        this._setSummary("No D6 signatures discovered.");
      }
      $("#d6-signature-detail").addClass("hidden").html("");
      this._refreshWarningState();
      return;
    }

    const visible = this._signatures.filter((sig) => this._filterSignature(sig));
    this._setSummary(`${visible.length} of ${this._signatures.length} signature(s) shown`);

    if (!visible.length) {
      $("#d6-signature-detail").addClass("hidden").html("");
      this._refreshWarningState();
      return;
    }

    visible.forEach((sig) => {
      const badge = sig.revoked ? "revoked" : sig.status;
      const initial = this._nameInitials(sig.signerName);
      const navTargets = this._signatureTargetSequence(sig);
      if (this._sigNavIndex[sig.id] === undefined) this._sigNavIndex[sig.id] = 0;
      const navIndex = this._sigNavIndex[sig.id];
      const styleClass = this._sigStyleById[sig.id] || "d6-sig-style-1";
      const prevEnabled = navTargets.length > 1 && navIndex > 0;
      const nextEnabled = navTargets.length > 1 && navIndex < navTargets.length - 1;
      const coveragePills = this._coverageBadges(sig).map((item, idx) => `
        <span class="d6-coverage-pill ${idx === 0 ? "with-nav" : ""}" title="${this._esc(item.tooltip)}">
          <span class="d6-coverage-main"><span class="d6-cov-swatch ${item.kind} ${styleClass}"></span>${this._esc(item.label)}</span>
          ${idx === 0 ? `
            <span class="d6-sig-nav-inline">
              <button type="button" class="d6-nav-btn-inline ${prevEnabled ? "enabled" : ""}" data-nav-delta="-1" ${prevEnabled ? "" : "disabled"}>&lt;</button>
              <span class="d6-nav-count-inline">${navTargets.length ? `${Math.min(navIndex + 1, navTargets.length)}/${navTargets.length}` : "0/0"}</span>
              <button type="button" class="d6-nav-btn-inline ${nextEnabled ? "enabled" : ""}" data-nav-delta="1" ${nextEnabled ? "" : "disabled"}>&gt;</button>
            </span>
          ` : ""}
        </span>
      `).join("");
      const card = $(
        `<div class="d6-sig-card" role="button" tabindex="0" data-sig-id="${this._esc(sig.id)}">
          <div class="d6-sig-line1">
            <span class="d6-name"><span class="d6-avatar">${this._esc(initial)}</span><span class="d6-name-text">${this._esc(sig.signerName)}</span></span>
            <span class="d6-badge ${badge}">${this._esc(this._statusLabel(sig))}</span>
          </div>
          <div class="d6-sig-meta-row">
            <span class="d6-sig-cov">${coveragePills}</span>
          </div>
        </div>`
      );
      card.on("click", () => this._selectSignature(sig.id, { fromUser: true, openDetails: false }));
      card.on("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._selectSignature(sig.id, { fromUser: true, openDetails: false });
        }
      });
      card.find(".d6-nav-btn-inline").on("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const delta = Number($(ev.currentTarget).data("nav-delta") || 0);
        this._navigateSignatureTarget(sig.id, delta);
      });
      listEl.append(card);
    });

    if (!visible.some((x) => x.id === this._selectedId)) {
      this._selectedId = visible[0].id;
    }
    this._selectSignature(this._selectedId, { fromUser: false, openDetails: this._detailOpen });
  }

  _setSummary(text) {
    $("#d6-signatures-summary").text(text);
  }

  _selectSignature(sigId, options = {}) {
    const fromUser = Boolean(options.fromUser);
    const openDetails = options.openDetails === undefined ? this._detailOpen : Boolean(options.openDetails);
    this._selectedId = sigId;
    const sig = this._signatures.find((x) => x.id === sigId);
    if (!sig) return;

    $(".d6-sig-card").removeClass("active");
    const selectedCard = $(`.d6-sig-card[data-sig-id="${CSS.escape(sigId)}"]`);
    selectedCard.addClass("active");

    const coverageLabels = this._coverageLabels(sig);
    const presentFrameworks = sig.frameworks.filter((x) => this._isPresent(x));
    const coverageText = coverageLabels.length ? coverageLabels.join("; ") : "none declared";
    const signatureType = this._isPresent(sig.type) ? sig.type : "not provided";
    const verificationText = this._isPresent(sig.verificationReason) ? sig.verificationReason : "not available";
    const signedAtText = this._isPresent(sig.signedAt) ? sig.signedAt : "not provided";
    const missingFields = [];
    if (!this._isPresent(sig.role) || sig.role === "role not present") missingFields.push("Role");
    if (!this._isPresent(sig.signedAt) || sig.signedAt === "not provided") missingFields.push("Signed At");
    if (!presentFrameworks.length) missingFields.push("Framework Links");
    if (!this._isPresent(sig.verificationReason) || sig.verificationReason === "not available") missingFields.push("Verification Reason");

    const frameworkHtml = presentFrameworks.length
      ? `<div class="d6-links">${presentFrameworks.map((url) => `<a href="${this._esc(url)}" target="_blank" rel="noopener">${this._esc(url)}</a>`).join("")}</div>`
      : `<div class="d6-empty">No framework links.</div>`;

    const missingHtml = missingFields.length
      ? `<div class="d6-empty">${this._esc(missingFields.join(", "))}</div>`
      : `<div class="d6-empty">None</div>`;
    const coverageItems = this._coverageItems(sig);
    const coverageHtml = coverageItems.length
      ? `<div class="d6-coverage-list">${coverageItems.map((item) => `
        <div class="d6-coverage-row">
          <div class="d6-coverage-label">${this._esc(item.label)}</div>
          <button type="button" class="d6-jump-btn" data-jump-type="${this._esc(item.type)}" data-jump-value="${this._esc(item.value || "")}">Jump</button>
        </div>
      `).join("")}</div>`
      : `<div class="d6-empty">No explicit coverage targets were declared.</div>`;

    const detailEl = $("#d6-signature-detail");
    detailEl.html(`
      <div class="d6-detail-head">
        <div class="d6-detail-title">${this._esc(sig.signerName)}</div>
        <div class="d6-detail-subtitle">Signature ID ${this._esc(sig.id)}</div>
      </div>
      <div class="d6-kv">
        <div class="d6-k">Integrity</div><div class="d6-v">${this._esc(sig.status)}</div>
        <div class="d6-k">Revocation</div><div class="d6-v">${sig.revoked ? "revoked" : "not revoked/unknown"}</div>
        <div class="d6-k">Role</div><div class="d6-v">${this._esc(sig.role)}</div>
        <div class="d6-k">Signed At</div><div class="d6-v">${this._esc(signedAtText)}</div>
        <div class="d6-k">Type</div><div class="d6-v">${this._esc(signatureType)}</div>
        <div class="d6-k">Verification</div><div class="d6-v">${this._esc(verificationText)}</div>
      </div>
      <div class="d6-metrics">
        <span class="d6-metric">Whole report: ${sig.wholeReport ? "yes" : "no"}</span>
        <span class="d6-metric">Facts: ${sig.facts.length}</span>
        <span class="d6-metric">Sections: ${sig.divs.length}</span>
        <span class="d6-metric">Selectors: ${sig.selectors.length}</span>
      </div>
      <div class="d6-kv">
        <div class="d6-k">Coverage</div><div class="d6-v">${this._esc(coverageText)}</div>
        <div class="d6-k">Frameworks</div><div class="d6-v">${frameworkHtml}</div>
      </div>
      <details>
        <summary>Coverage targets</summary>
        ${coverageHtml}
      </details>
      <details>
        <summary>Missing or empty fields (${missingFields.length})</summary>
        ${missingHtml}
      </details>
      <details open>
        <summary>Certificate chain &amp; trust anchor</summary>
        ${this._renderVaPanel(sig.vaResult)}
      </details>
      <div id="d6-hash-check-actions">
        <button id="d6-check-hash-btn" type="button">Check Hash</button>
        <button id="d6-open-hash-url-btn" type="button">Open Verifier</button>
      </div>
      <div id="d6-hash-check-panel"></div>
      <div id="d6-unresolved-targets" style="display:none;"></div>
    `);

    $(".d6-jump-btn").on("click", (ev) => {
      const target = $(ev.currentTarget);
      this._jumpToTarget(sig, { type: String(target.data("jump-type")), value: String(target.data("jump-value") || "") });
    });
    detailEl.find("#d6-check-hash-btn").on("click", () => this._renderHashCheck(sig));
    detailEl.find("#d6-open-hash-url-btn").on("click", () => {
      const payload = this._buildHashCheckPayload(sig);
      const verifyUrl = this._buildHashCheckUrl(payload);
      window.open(verifyUrl, "_blank", "noopener");
    });
    this._detailOpen = openDetails;
    selectedCard.append(detailEl);
    detailEl.toggleClass("hidden", !this._detailOpen);
    $("#d6-toggle-detail-btn").toggleClass("active", this._detailOpen).text(this._detailOpen ? "Hide Details" : "Details");
    if (fromUser) this._ensureDomSortedTargets(sig);
    this._updateCardNav(sig);
    const shouldScroll = fromUser && this._shouldAutoJumpOnSelect(sig);
    this._applyHighlights(sig, { scroll: false });
    if (shouldScroll) {
      this._sigNavIndex[sig.id] = 0;
      this._updateCardNav(sig);
      this._jumpToTarget(sig, this._currentSignatureTarget(sig), { preserveNavIndex: true });
    }
    this._refreshWarningState();
  }

  _renderTabs() {
    // Deprecated in compact mode.
  }

  _renderLegend() {
    // Deprecated in compact mode.
  }

  _renderFilters() {
    const counts = {
      valid: this._signatures.filter((s) => s.status === "valid").length,
      invalid: this._signatures.filter((s) => s.status === "invalid").length,
      revoked: this._signatures.filter((s) => s.revoked).length
    };
    const filters = [
      { id: "valid", label: `Valid (${counts.valid})`, locked: true },
      { id: "invalid", label: `Invalid (${counts.invalid})` },
      { id: "revoked", label: `Revoked (${counts.revoked})` }
    ];
    $("#d6-signature-filters").html(
      filters.map((f) => `<button type="button" class="d6-filter ${this._activeFilters.has(f.id) ? "active" : ""} ${f.locked ? "locked" : ""}" data-filter="${f.id}" ${f.locked ? "title=\"Valid signatures are always shown\"" : ""}>${f.label}</button>`).join("")
    );
  }

  _applyActiveTab() {
    // Deprecated in compact mode.
  }

  _filterSignature(sig) {
    if (sig.status === "valid") return true;
    if (this._activeFilters.has("invalid") && sig.status === "invalid") return true;
    if (this._activeFilters.has("revoked") && sig.revoked) return true;
    return false;
  }

  _coverageItems(sig) {
    const items = [];
    if (sig.wholeReport) items.push({ type: "whole", value: "body", label: "Whole report" });
    for (const id of sig.facts) items.push({ type: "fact", value: String(id), label: `Fact ${id}` });
    for (const id of sig.divs) items.push({ type: "div", value: String(id), label: `Section ${id}` });
    for (const item of sig.selectors || []) {
      const selector = item?.selector;
      const selectorId = this._selectorToId(selector);
      const selectorFact = this._normalizeFactId(selectorId);
      if (selectorFact) continue;
      if (selector) items.push({ type: "selector", value: selector, label: `Selector ${selector}` });
    }
    return this._dedupeCoverageItems(items);
  }

  _coverageBadges(sig) {
    if (sig.wholeReport) {
      return [{
        kind: "whole",
        label: "Entire Report",
        tooltip: "This border indicates that this person signed the entire report"
      }];
    }
    const out = [];
    if (sig.divs.length || sig.selectors.some((s) => !this._normalizeFactId(this._selectorToId(s.selector)))) {
      out.push({
        kind: "section",
        label: "Section(s)",
        tooltip: "This border indicates that this person signed one or more sections"
      });
    }
    if (sig.facts.length) {
      out.push({
        kind: "fact",
        label: "Facts",
        tooltip: "This border indicates that this person signed one or more facts"
      });
    }
    return out.length ? out : [{
      kind: "section",
      label: "Coverage Unknown",
      tooltip: "No explicit coverage targets were declared"
    }];
  }

  _statusLabel(sig) {
    if (sig.revoked) return "Revoked";
    if (sig.status === "valid") return "Valid";
    if (sig.status === "invalid") return "Invalid";
    return "Unknown";
  }

  _shouldAutoJumpOnSelect(sig) {
    return !sig.wholeReport && this._signatureTargetSequence(sig).length > 0;
  }

  _signatureTargetSequence(sig, options = {}) {
    const preferDomOrder = Boolean(options.preferDomOrder);
    const cached = this._sigTargetCache[sig.id];
    if (cached && (!preferDomOrder || cached._domSorted)) return cached;
    const items = this._coverageItems(sig).filter((item) => item.type !== "whole");
    if (!items.length && sig.wholeReport) {
      const seq = [{ type: "whole", value: "body", label: "Whole report", _domPos: Number.MAX_SAFE_INTEGER }];
      seq._domSorted = true;
      this._sigTargetCache[sig.id] = seq;
      return seq;
    }
    let seq = items.map((item) => ({ ...item, _domPos: Number.MAX_SAFE_INTEGER }));
    if (preferDomOrder && this._canResolveDomOrder()) {
      seq = seq.map((item) => {
        const el = this._findTargetElement(item);
        return { ...item, _domPos: this._documentOrderPosition(el) };
      }).sort((a, b) => a._domPos - b._domPos);
      seq._domSorted = true;
    } else {
      seq._domSorted = false;
    }
    this._sigTargetCache[sig.id] = seq;
    return seq;
  }

  _canResolveDomOrder() {
    try {
      if (!this._iv || !this._iv.viewer || typeof this._iv.viewer.contents !== "function") return false;
      const frames = this._iv.viewer.contents();
      return Boolean(frames && typeof frames.find === "function" && frames.find("body").length);
    } catch {
      return false;
    }
  }

  _documentOrderPosition(el) {
    if (!el || !el.ownerDocument || typeof el.ownerDocument.createTreeWalker !== "function") return Number.MAX_SAFE_INTEGER;
    const walker = el.ownerDocument.createTreeWalker(el.ownerDocument.body || el.ownerDocument, NodeFilter.SHOW_ELEMENT);
    let idx = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === el) return idx;
      idx += 1;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  _ensureDomSortedTargets(sig) {
    delete this._sigTargetCache[sig.id];
    return this._signatureTargetSequence(sig, { preferDomOrder: true });
  }

  _updateCardNav(sig) {
    const card = $(`.d6-sig-card[data-sig-id="${CSS.escape(sig.id)}"]`);
    if (!card.length) return;
    const seq = this._signatureTargetSequence(sig);
    const raw = this._sigNavIndex[sig.id] || 0;
    const idx = Math.max(0, Math.min(raw, Math.max(0, seq.length - 1)));
    this._sigNavIndex[sig.id] = idx;
    const prevEnabled = seq.length > 1 && idx > 0;
    const nextEnabled = seq.length > 1 && idx < seq.length - 1;
    card.find(".d6-nav-count-inline").text(seq.length ? `${idx + 1}/${seq.length}` : "0/0");
    card.find(".d6-nav-btn-inline[data-nav-delta='-1']").prop("disabled", !prevEnabled).toggleClass("enabled", prevEnabled);
    card.find(".d6-nav-btn-inline[data-nav-delta='1']").prop("disabled", !nextEnabled).toggleClass("enabled", nextEnabled);
  }

  _findTargetElement(target) {
    if (!this._iv || !this._iv.viewer || typeof this._iv.viewer.contents !== "function") return null;
    const frames = this._iv.viewer.contents();
    if (!frames || typeof frames.each !== "function") return null;
    let match = null;
    if (!target) return null;
    const type = target.type;
    const value = target.value || "";
    if (type === "whole") {
      const body = frames.find("body");
      if (body.length) return body.get(0);
      return null;
    }
    if (type === "fact") {
      const alt = /^f\d+$/.test(value) ? value.slice(1) : `f${value}`;
      frames.each((_, doc) => {
        const root = $(doc);
        const byId = root.find(`#${CSS.escape(value)}`);
        const byAlt = root.find(`#${CSS.escape(alt)}`);
        if (byId.length || byAlt.length) {
          match = (byId.length ? byId : byAlt).get(0);
          return false;
        }
        root.find(".ixbrl-element").each((__, el) => {
          const ids = $(el).data("ivids") || [];
          if (Array.isArray(ids) && ids.some((v) => v === value || v === alt || String(v).endsWith(`:${value}`) || String(v).endsWith(`:${alt}`))) {
            match = el;
            return false;
          }
          return true;
        });
        return match ? false : undefined;
      });
      return match;
    }
    if (type === "div") {
      frames.each((_, doc) => {
        const byId = $(doc).find(`#${CSS.escape(value)}`);
        if (byId.length) {
          match = byId.get(0);
          return false;
        }
        return undefined;
      });
      return match;
    }
    if (type === "selector") {
      frames.each((_, doc) => {
        try {
          const found = $(doc).find(value);
          if (found.length) {
            match = found.get(0);
            return false;
          }
        } catch {
          return undefined;
        }
        return undefined;
      });
      return match;
    }
    return null;
  }

  _currentSignatureTarget(sig) {
    const seq = this._signatureTargetSequence(sig);
    if (!seq.length) return null;
    const raw = this._sigNavIndex[sig.id] || 0;
    const index = Math.max(0, Math.min(raw, seq.length - 1));
    this._sigNavIndex[sig.id] = index;
    return seq[index];
  }

  _navigateSignatureTarget(sigId, delta) {
    const sig = this._signatures.find((x) => x.id === sigId);
    if (!sig) return;
    const seq = this._signatureTargetSequence(sig, { preferDomOrder: true });
    if (!seq.length) return;
    const current = this._sigNavIndex[sig.id] || 0;
    const next = Math.max(0, Math.min(current + delta, seq.length - 1));
    this._sigNavIndex[sig.id] = next;
    this._selectSignature(sig.id, { fromUser: false, openDetails: this._detailOpen });
    this._updateCardNav(sig);
    this._jumpToTarget(sig, seq[next], { preserveNavIndex: true });
  }

  _dedupeCoverageItems(items) {
    const seen = new Set();
    const out = [];
    for (const item of items || []) {
      const key = `${item.type}:${item.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  _jumpToTarget(sig, target, options = {}) {
    if (!target) return;
    const preserveNavIndex = Boolean(options.preserveNavIndex);
    const type = target.type;
    const value = target.value || "";
    const match = this._findTargetElement(target);

    this._applyHighlights(sig, { scroll: false });
    if (match) {
      $(match).addClass("d6-sig-flash");
      setTimeout(() => {
        try { $(match).removeClass("d6-sig-flash"); } catch { /* no-op */ }
      }, 760);
    }
    if (match && typeof match.scrollIntoView === "function") {
      match.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    if (!preserveNavIndex) {
      const seq = this._signatureTargetSequence(sig);
      const idx = seq.findIndex((x) => x.type === type && x.value === value);
      if (idx >= 0) this._sigNavIndex[sig.id] = idx;
    }
  }

  _applyHighlights(sig, options = {}) {
    const shouldScroll = Boolean(options.scroll);
    const frames = this._iv.viewer.contents();
    const styleClasses = "d6-sig-style-1 d6-sig-style-2 d6-sig-style-3";
    const styleClass = this._sigStyleById[sig.id] || "d6-sig-style-1";
    frames.find(`.${SIG_HIGHLIGHT_FACT}`).removeClass(SIG_HIGHLIGHT_FACT);
    frames.find(`.${SIG_HIGHLIGHT_DIV}`).removeClass(SIG_HIGHLIGHT_DIV);
    frames.find(`.${SIG_HIGHLIGHT_WHOLE}`).removeClass(SIG_HIGHLIGHT_WHOLE);
    frames.find(".d6-sig-style-1, .d6-sig-style-2, .d6-sig-style-3").removeClass(styleClasses);
    let firstMatch = null;

    if (sig.wholeReport) {
      const bodies = frames.find("body");
      bodies.addClass(`${SIG_HIGHLIGHT_WHOLE} ${styleClass}`);
      if (!firstMatch && bodies.length) firstMatch = bodies.get(0);
    }

    const unresolved = [];

    sig.facts.forEach((id) => {
      let found = false;
      const alt = /^f\d+$/.test(String(id)) ? String(id).slice(1) : `f${id}`;
      frames.each((_, doc) => {
        const root = $(doc);
        const byId = root.find(`#${CSS.escape(id)}`);
        const byAlt = root.find(`#${CSS.escape(alt)}`);
        const foundEl = byId.length ? byId : byAlt;
        if (foundEl.length) {
          foundEl.addClass(`${SIG_HIGHLIGHT_FACT} ${styleClass}`);
          if (!firstMatch) firstMatch = foundEl.get(0);
          found = true;
          return;
        }

        root.find(".ixbrl-element").each((__, el) => {
          const ids = $(el).data("ivids") || [];
          if (Array.isArray(ids) && ids.some((v) => v === id || v === alt || String(v).endsWith(`:${id}`) || String(v).endsWith(`:${alt}`))) {
            $(el).addClass(`${SIG_HIGHLIGHT_FACT} ${styleClass}`);
            if (!firstMatch) firstMatch = el;
            found = true;
            return false;
          }
          return true;
        });
      });
      if (!found) unresolved.push(`fact:${id}`);
    });

    sig.divs.forEach((id) => {
      let found = false;
      frames.each((_, doc) => {
        const root = $(doc);
        const byId = root.find(`#${CSS.escape(id)}`);
        if (byId.length) {
          byId.addClass(`${SIG_HIGHLIGHT_DIV} ${styleClass}`);
          if (!firstMatch) firstMatch = byId.get(0);
          found = true;
        }
      });
      if (!found) unresolved.push(`div:${id}`);
    });

    sig.selectors.forEach((item) => {
      const selector = item.selector;
      let found = false;
      if (!selector) return;
      if (this._normalizeFactId(this._selectorToId(selector))) return;
      frames.each((_, doc) => {
        const root = $(doc);
        const matches = root.find(selector);
        if (matches.length) {
          matches.addClass(`${SIG_HIGHLIGHT_DIV} ${styleClass}`);
          if (!firstMatch) firstMatch = matches.get(0);
          found = true;
        }
      });
      if (!found) unresolved.push(`css:${selector}`);
    });

    if (unresolved.length) {
      $("#d6-unresolved-targets")
        .css("display", "block")
        .text(`Unresolved targets:\n${unresolved.join("\n")}`);
    } else {
      $("#d6-unresolved-targets").css("display", "none").text("");
    }

    if (shouldScroll && firstMatch && typeof firstMatch.scrollIntoView === "function") {
      firstMatch.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  _toggleDetailVisibility() {
    this._detailOpen = !this._detailOpen;
    const detailEl = $("#d6-signature-detail");
    const selected = this._selectedId ? $(`.d6-sig-card[data-sig-id="${CSS.escape(this._selectedId)}"]`) : $();
    if (this._detailOpen && selected.length) selected.append(detailEl);
    detailEl.toggleClass("hidden", !this._detailOpen);
    $("#d6-toggle-detail-btn").toggleClass("active", this._detailOpen).text(this._detailOpen ? "Hide Details" : "Details");
  }

  _refreshWarningState() {
    const hasInvalid = this._signatures.some((s) => s.status === "invalid");
    const wm = $("#d6-tamper-watermark");
    if (hasInvalid) wm.addClass("visible");
    else wm.removeClass("visible");

    const toggleIcon = $("#d6-toggle-icon");
    const inspector = $("#inspector");
    inspector.removeClass("d6-alert");
    toggleIcon.attr("src", FINGERPRINT_ICON_GREEN);

    if (!this._signatures.length) {
      return;
    }

    if (hasInvalid) {
      inspector.addClass("d6-alert");
      toggleIcon.attr("src", FINGERPRINT_ICON_RED);
      return;
    }
  }

  // ── META-INF Inspector: state management ──────────────────────────────────

  _setInspectorDrawerOpen(open) {
    this._inspectorDrawerOpen = Boolean(open);
    const drawer = document.getElementById("d6-inspector-drawer");
    if (drawer) drawer.classList.toggle("open", this._inspectorDrawerOpen);
    const btn = document.getElementById("d6-inspector-btn");
    if (btn) btn.classList.toggle("active", this._inspectorDrawerOpen);
    if (this._inspectorDrawerOpen) this._renderInspectorDrawer();
  }

  _setInspectorFullPageOpen(open) {
    this._inspectorFullPageOpen = Boolean(open);
    const fp = document.getElementById("d6-inspector-fullpage");
    if (fp) fp.classList.toggle("open", this._inspectorFullPageOpen);
    if (this._inspectorFullPageOpen) this._renderFullPage();
  }

  _setInspectorDetailLevel(lvl) {
    this._inspectorDetailLevel = lvl;
    // Sync both toggle widgets
    for (const el of document.querySelectorAll(".d6-detail-level button")) {
      el.classList.toggle("active", el.dataset.lvl === lvl);
    }
    this._renderInspectorDrawer();
    if (this._inspectorFullPageOpen) this._renderFullPage();
  }

  _showDrawerTab(name) {
    for (const t of document.querySelectorAll("#d6-inspector-drawer .d6-insp-tab")) {
      t.classList.toggle("active", t.dataset.tab === name);
    }
    for (const p of document.querySelectorAll("#d6-inspector-drawer .d6-insp-pane")) {
      p.classList.toggle("active", p.id === `d6-insp-pane-${name}`);
    }
  }

  _showFpTab(name) {
    for (const t of document.querySelectorAll("#d6-inspector-fullpage .d6-fp-tab")) {
      t.classList.toggle("active", t.dataset.tab === name);
    }
    for (const p of document.querySelectorAll("#d6-inspector-fullpage .d6-fp-panel")) {
      p.classList.toggle("active", p.id === `d6-fp-panel-${name}`);
    }
    if (name === "technical" || name === "fields") this._renderFpRightPanel(name);
  }

  _toggleInspectorStep(head) {
    head.classList.toggle("open");
    const body = head.nextElementSibling;
    if (body) body.classList.toggle("open");
  }

  // ── META-INF Inspector: drawer rendering ──────────────────────────────────

  _renderInspectorDrawer() {
    const files = document.getElementById("d6-insp-pane-files");
    const signers = document.getElementById("d6-insp-pane-signers");
    const conf = document.getElementById("d6-insp-pane-conformance");
    if (!files) return;

    files.innerHTML = this._renderDrawerFiles();
    signers.innerHTML = this._renderDrawerSigners();
    conf.innerHTML = this._renderDrawerConformance();

    // Wire up step accordion
    for (const head of document.querySelectorAll("#d6-inspector-drawer .d6-step-head")) {
      head.addEventListener("click", () => this._toggleInspectorStep(head));
    }
    // Wire up JSON key expansion
    for (const key of document.querySelectorAll("#d6-inspector-drawer .d6-jk")) {
      key.addEventListener("click", (ev) => this._toggleJsonExplanation(ev.currentTarget));
    }
    // Wire up highlight buttons
    for (const btn of document.querySelectorAll("#d6-inspector-drawer .d6-insp-hl-btn")) {
      btn.addEventListener("click", () => {
        const sigId = btn.dataset.sigId;
        const sig = this._signatures.find(s => s.id === sigId);
        if (sig) this._applyHighlights(sig, { fromInspector: true });
      });
    }
  }

  _renderDrawerFiles() {
    if (!this._signatures.length) {
      return `<p style="color:#6e7781;font-size:1.05rem;padding:8px 0">No signature data loaded.</p>`;
    }
    const lvl = this._inspectorDetailLevel;
    const sig = this._signatures[0]; // representative — shows shared files

    let out = `<div class="d6-sh">Package structure</div>`;
    out += `<div class="d6-insp-json">`;
    out += `<div class="d6-json-tree">`;
    out += this._renderJsonKV("d6.json", null, {
      simple: "The index file listing all signatures.",
      standard: "The <code>META-INF/d6.json</code> file is the root of the D6 signature manifest. It lists each signature object with its file references.",
      technical: `Schema root: <code>{ signatures: [...] }</code> per D6 §4.1. Served from same origin as the report.`
    }, lvl);
    for (const s of this._signatures) {
      out += this._renderJsonKV(s.sigFile || `sig-${s.id}.json`, s.id, {
        simple: `Signature file for ${s.signerName || "signer"}.`,
        standard: `The signature JSON file for ${s.signerName || "this signer"}, containing the cryptographic digest value and metadata.`,
        technical: `File referenced by <code>signature.signatureFile</code>. Contains <code>{ targetDigest, signerName, ... }</code>.`
      }, lvl);
    }
    if (sig.subsetFile) {
      out += this._renderJsonKV(sig.subsetFile, null, {
        simple: "Defines which parts of the report are covered by each signature.",
        standard: "The subset definition file specifies the report root and optional CSS/fact selectors that narrow the signed scope.",
        technical: `<code>{ report, selection: { css?, factIds? } }</code> per D6 §4.3. All signers sharing the same subset may reference one file.`
      }, lvl);
    }
    out += `</div></div>`;
    return out;
  }

  _renderJsonKV(label, sigId, explanations, lvl) {
    const card = lvl === "simple"
      ? `<div class="d6-exp-card d6-exp-plain"><span class="d6-exp-lbl">Plain</span>${explanations.simple}</div>`
      : lvl === "technical"
        ? `<div class="d6-exp-card d6-exp-tech"><span class="d6-exp-lbl">Technical</span>${explanations.technical}</div>`
        : `<div class="d6-exp-card d6-exp-std"><span class="d6-exp-lbl">Standard</span>${explanations.standard}</div>`;

    const hlBtn = sigId ? `<button class="d6-insp-hl-btn" data-sig-id="${this._esc(sigId)}">Highlight in report</button>` : "";
    return `<div>
      <span class="d6-jk" data-open="0">&#x25B8; <span class="d6-js">"${this._esc(label)}"</span></span>
      ${card}${hlBtn}
    </div>`;
  }

  _toggleJsonExplanation(el) {
    const open = el.dataset.open === "1";
    el.dataset.open = open ? "0" : "1";
    el.textContent = (open ? "\u25B8 " : "\u25BE ") + el.querySelector(".d6-js")?.outerHTML;
    // Replace inner HTML properly
    el.innerHTML = `${open ? "\u25B8" : "\u25BE"} <span class="d6-js">"${el.querySelector(".d6-js")?.textContent || ""}"</span>`;
    const card = el.parentElement.querySelector(".d6-exp-card");
    if (card) card.classList.toggle("open", !open);
  }

  _renderDrawerSigners() {
    if (!this._signatures.length) return "";
    const lvl = this._inspectorDetailLevel;
    let out = "";
    for (const sig of this._signatures) {
      const statusCls = sig.status === "valid" ? "d6-nc-valid" : "d6-nc-invalid";
      const statusIcon = sig.status === "valid" ? "✔" : "✘";
      out += `<div style="border:1px solid #d0d7de;border-radius:7px;padding:10px;margin-bottom:10px;">`;
      out += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:28px;height:28px;border-radius:50%;background:#0f5ea8;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.95rem;flex-shrink:0">${this._nameInitials(sig.signerName)}</span>
        <span style="font-weight:700;font-size:1.05rem;flex:1">${this._esc(sig.signerName || "Unknown")}</span>
        <span class="${statusCls}" style="font-weight:700">${statusIcon} ${this._esc(this._mapStatus(sig.status))}</span>
      </div>`;
      if (lvl !== "simple") {
        out += `<div style="font-size:0.95rem;color:#6e7781;">Algorithm: <code>${this._esc(sig.algorithm || "–")}</code></div>`;
      }
      if (lvl === "technical" && sig.targetDigest) {
        out += `<div class="d6-code" style="margin-top:6px;font-size:0.85rem;word-break:break-all;">${this._esc(sig.targetDigest)}</div>`;
      }
      if (sig.coverageLabel) {
        out += `<div style="font-size:0.95rem;color:#6e7781;margin-top:4px;">Coverage: ${this._esc(sig.coverageLabel)}</div>`;
      }
      out += `<button class="d6-insp-hl-btn" data-sig-id="${this._esc(sig.id)}" style="margin-top:6px;">Highlight in report</button>`;
      out += `</div>`;
    }
    return out;
  }

  _renderDrawerConformance() {
    if (!this._signatures.length) return "";
    let out = `<div class="d6-sh">Verification results</div>`;
    for (const sig of this._signatures) {
      const trace = sig.verificationTrace || [];
      if (!trace.length) {
        out += `<p style="color:#6e7781;font-size:1rem;">(No trace available for ${this._esc(sig.signerName || sig.id)})</p>`;
        continue;
      }
      out += `<div style="font-weight:700;font-size:1rem;margin:10px 0 4px;">${this._esc(sig.signerName || sig.id)}</div>`;
      out += `<ul class="d6-step-list">`;
      for (const [i, step] of trace.entries()) {
        const pass = step.outcome === "pass";
        out += `<li class="d6-step">
          <div class="d6-step-head">
            <span class="d6-step-num ${pass ? "pass" : "fail"}">${i + 1}</span>
            <span class="d6-step-title">${this._esc(step.name)}</span>
            <span class="d6-step-out ${pass ? "pass" : "fail"}">${pass ? "✔ Pass" : "✘ Fail"}</span>
            <span class="d6-step-chv">&#x25B8;</span>
          </div>
          <div class="d6-step-body">
            ${step.specRef ? `<span style="font-size:0.85rem;background:#fff8c5;border:1px solid #d4a72c;border-radius:3px;padding:1px 5px;font-family:monospace;color:#735c0f;">${this._esc(step.specRef)}</span> ` : ""}
            ${step.detail?.reason ? `<strong style="color:#cf222e">${this._esc(step.detail.reason)}</strong><br>` : ""}
            ${this._inspectorDetailLevel === "technical" ? `<div class="d6-code">${this._esc(JSON.stringify(step.detail, null, 2))}</div>` : ""}
            ${step.testCases?.length ? `<div class="d6-tc">Test cases: ${step.testCases.map(t => `<span class="d6-tid">${this._esc(t)}</span>`).join(" ")}</div>` : ""}
          </div>
        </li>`;
      }
      out += `</ul>`;
    }
    return out;
  }

  // ── META-INF Inspector: full-page rendering ───────────────────────────────

  _renderFullPage() {
    this._renderFpGraph();
    this._renderFpPanel("overview");
    this._renderFpPanel("conformance");
    // Fields and technical are rendered on-demand via _showFpTab
  }

  _renderFpGraph() {
    const el = document.getElementById("d6-fp-graph-scroll");
    if (!el || !this._signatures.length) return;

    let out = ``;
    // Root node: d6.json
    out += `<div class="d6-fp-level">
      <div class="d6-fp-node d6n-root selected" data-node="d6-json">
        <div class="d6n-name">d6.json</div>
        <div class="d6n-sub">Signature manifest</div>
      </div>
    </div>`;
    out += `<div class="d6-fp-conn">&#x25BC; defines</div>`;

    // Signature nodes
    const sigNodes = this._signatures.map((sig, i) => {
      const valid = sig.status === "valid";
      return `<div class="d6-fp-node ${valid ? "d6n-valid" : ""}" data-node="sig-${this._esc(sig.id)}" data-sig-id="${this._esc(sig.id)}">
        ${valid ? `<span style="position:absolute;top:-7px;right:-7px;background:#1a7f37;color:#fff;border-radius:50%;width:16px;height:16px;font-size:0.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${this._signatures.filter(s=>s.status==="valid").length}</span>` : ""}
        <div class="d6n-name">${this._esc(sig.sigFile || `sig-${i+1}.json`)}</div>
        <div class="d6n-sub">${this._esc(sig.signerName || "Signer")}</div>
      </div>`;
    });
    out += `<div class="d6-fp-level" style="flex-wrap:wrap;gap:10px;">${sigNodes.join("")}</div>`;

    // Subset node (if present)
    const subsetFile = this._signatures[0]?.subsetFile;
    if (subsetFile) {
      out += `<div class="d6-fp-conn">&#x25BC; references</div>`;
      out += `<div class="d6-fp-level">
        <div class="d6-fp-node d6n-entry" data-node="subset">
          <div class="d6n-name">${this._esc(subsetFile)}</div>
          <div class="d6n-sub">Subset / scope definition</div>
        </div>
      </div>`;
    }

    el.innerHTML = out;

    // Wire node clicks
    for (const node of el.querySelectorAll(".d6-fp-node")) {
      node.addEventListener("click", () => {
        for (const n of el.querySelectorAll(".d6-fp-node")) n.classList.remove("selected");
        node.classList.add("selected");
        this._currentFpNode = node.dataset.node;
        const sigId = node.dataset.sigId;
        if (sigId) {
          const sig = this._signatures.find(s => s.id === sigId);
          if (sig) this._showFpTab("technical");
        } else {
          this._showFpTab("fields");
        }
      });
    }
  }

  _renderFpPanel(name) {
    const el = document.getElementById(`d6-fp-panel-${name}`);
    if (!el) return;
    if (name === "overview") el.innerHTML = this._buildFpOverview();
    if (name === "conformance") el.innerHTML = this._buildFpConformance();
    // Wire events in overview
    if (name === "overview") {
      for (const btn of el.querySelectorAll(".d6-insp-hl-btn")) {
        btn.addEventListener("click", () => {
          const sigId = btn.dataset.sigId;
          const sig = this._signatures.find(s => s.id === sigId);
          if (sig) this._applyHighlights(sig, { fromInspector: true });
        });
      }
    }
    if (name === "conformance") {
      for (const head of el.querySelectorAll(".d6-step-head")) {
        head.addEventListener("click", () => this._toggleInspectorStep(head));
      }
    }
  }

  _renderFpRightPanel(tabName) {
    if (tabName === "fields") {
      const el = document.getElementById("d6-fp-panel-fields");
      if (el) {
        el.innerHTML = this._buildFpFields();
        for (const key of el.querySelectorAll(".d6-jk")) {
          key.addEventListener("click", (ev) => this._toggleJsonExplanation(ev.currentTarget));
        }
      }
    }
    if (tabName === "technical") {
      const el = document.getElementById("d6-fp-panel-technical");
      if (el) {
        el.innerHTML = this._buildFpTechnical();
        for (const head of el.querySelectorAll(".d6-step-head")) {
          head.addEventListener("click", () => this._toggleInspectorStep(head));
        }
        for (const btn of el.querySelectorAll(".d6-insp-hl-btn")) {
          btn.addEventListener("click", () => {
            const sigId = btn.dataset.sigId;
            const sig = this._signatures.find(s => s.id === sigId);
            if (sig) this._applyHighlights(sig, { fromInspector: true });
          });
        }
      }
    }
  }

  _buildFpOverview() {
    const sigs = this._signatures;
    const nValid = sigs.filter(s => s.status === "valid").length;
    const nInvalid = sigs.length - nValid;
    let out = `<div class="d6-sum-cards">
      <div class="d6-sum-card"><div class="d6-sum-n">${sigs.length}</div><div class="d6-sum-l">Signatures</div></div>
      <div class="d6-sum-card"><div class="d6-sum-n d6-nc-valid">${nValid}</div><div class="d6-sum-l">Valid</div></div>
      ${nInvalid ? `<div class="d6-sum-card"><div class="d6-sum-n d6-nc-invalid">${nInvalid}</div><div class="d6-sum-l">Invalid</div></div>` : ""}
    </div>`;

    out += `<div class="d6-sh">Signers</div>`;
    for (const sig of sigs) {
      const valid = sig.status === "valid";
      out += `<div style="border:1px solid #d0d7de;border-radius:7px;padding:10px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:28px;height:28px;border-radius:50%;background:#0f5ea8;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;">${this._nameInitials(sig.signerName)}</span>
          <span style="font-weight:700;font-size:1.05rem;flex:1;">${this._esc(sig.signerName || "Unknown")}</span>
          <span style="${valid ? "color:#1a7f37" : "color:#cf222e"};font-weight:700;">${valid ? "✔ Valid" : "✘ " + this._esc(this._mapStatus(sig.status))}</span>
        </div>
        <div style="margin-top:6px;font-size:0.95rem;color:#6e7781;">${this._esc(sig.coverageLabel || "Whole report")}</div>
        <button class="d6-insp-hl-btn" data-sig-id="${this._esc(sig.id)}" style="margin-top:5px;">Highlight in report</button>
      </div>`;
    }
    return out;
  }

  _buildFpFields() {
    const lvl = this._inspectorDetailLevel;
    const sigs = this._signatures;
    if (!sigs.length) return `<p style="color:#6e7781">No data.</p>`;

    const sig = sigs[0];
    const sigFile = sig.sigFile ? JSON.stringify({ signatureFile: sig.sigFile }) : "{}";

    const fieldDefs = [
      { key: "signatureFile", val: sig.sigFile, exp: {
        simple: "Which file contains this signer\u2019s cryptographic signature.",
        standard: "Path to the JSON file containing the <code>targetDigest</code> and optional signer metadata.",
        technical: "Relative URI resolving from <code>META-INF/d6.json</code> base. Must be within the same package."
      }},
      { key: "targetDigest", val: sig.targetDigest, exp: {
        simple: "A fingerprint of the signed content. If the report was changed, this won\u2019t match.",
        standard: "Algorithm-prefixed hex digest of the subset file (e.g., <code>sha256-abc123\u2026</code>). Verified by the viewer on load.",
        technical: "Format: <code>&lt;alg&gt;-&lt;hex&gt;</code>. Supported algorithms: SHA-256 (32 bytes), SHA-384 (48 bytes), SHA-512 (64 bytes). Verified against the fetched subset file bytes."
      }},
      { key: "signerName", val: sig.signerName, exp: {
        simple: "The display name of the person who signed.",
        standard: "Human-readable name of the signer. Informational \u2014 not cryptographically bound in the current D6 baseline.",
        technical: "Free-form string. In a PKI extension, this would be bound to a certificate subject DN. See ch.11 for future requirements."
      }},
    ];

    let out = `<div class="d6-sh">Signature fields</div>`;
    out += `<div class="d6-insp-json"><div class="d6-json-tree">`;
    for (const fd of fieldDefs) {
      const card = lvl === "simple"
        ? `<div class="d6-exp-card d6-exp-plain open"><span class="d6-exp-lbl">Plain</span>${fd.exp.simple}</div>`
        : lvl === "technical"
          ? `<div class="d6-exp-card d6-exp-tech open"><span class="d6-exp-lbl">Technical</span>${fd.exp.technical}</div>`
          : `<div class="d6-exp-card d6-exp-std open"><span class="d6-exp-lbl">Standard</span>${fd.exp.standard}</div>`;
      out += `<div style="margin-bottom:6px;">
        <span class="d6-jk" data-open="1">\u25BE <span class="d6-js">"${this._esc(fd.key)}"</span></span>: <span class="d6-jh" style="font-size:0.9rem;">${fd.val ? `"${this._esc(String(fd.val).substring(0, 60))}${String(fd.val).length > 60 ? '...' : ''}"` : "<em>absent</em>"}</span>
        ${card}
      </div>`;
    }
    out += `</div></div>`;
    return out;
  }

  _buildFpTechnical() {
    const sigs = this._signatures;
    if (!sigs.length) return `<p style="color:#6e7781">No data.</p>`;

    // Find the selected sig (by current node) or default to first
    let activeSig = sigs[0];
    if (this._currentFpNode) {
      const match = sigs.find(s => `sig-${s.id}` === this._currentFpNode);
      if (match) activeSig = match;
    }

    const caveat = `<div class="d6-caveat"><strong>Prototype caveat</strong>This viewer performs digest-based verification only. No cryptographic signature validation (PKI/JWT) is performed in this release. See Chapter 11 for planned PKI extension.</div>`;

    const trace = activeSig.verificationTrace || [];
    if (!trace.length) return caveat + `<p style="color:#6e7781;">No verification trace available for ${this._esc(activeSig.signerName || activeSig.id)}.</p>`;

    let out = caveat;
    out += `<div style="font-weight:700;font-size:1rem;margin-bottom:8px;">Verification trace: ${this._esc(activeSig.signerName || activeSig.id)}</div>`;
    out += `<ul class="d6-step-list">`;
    for (const [i, step] of trace.entries()) {
      const pass = step.outcome === "pass";
      out += `<li class="d6-step">
        <div class="d6-step-head">
          <span class="d6-step-num ${pass ? "pass" : "fail"}">${i + 1}</span>
          <span class="d6-step-title">${this._esc(step.name)}</span>
          <span class="d6-step-out ${pass ? "pass" : "fail"}">${pass ? "✔ Pass" : "✘ Fail"}</span>
          <span class="d6-step-chv">&#x25B8;</span>
        </div>
        <div class="d6-step-body">
          ${step.specRef ? `<span style="font-size:0.85rem;background:#fff8c5;border:1px solid #d4a72c;border-radius:3px;padding:1px 5px;font-family:monospace;color:#735c0f;">${this._esc(step.specRef)}</span> ` : ""}
          ${step.detail?.reason ? `<strong style="color:#cf222e">${this._esc(step.detail.reason)}</strong><br>` : ""}
          <div class="d6-code">${this._esc(JSON.stringify(step.detail, null, 2))}</div>
          ${step.testCases?.length ? `<div class="d6-tc">Test cases: ${step.testCases.map(t => `<span class="d6-tid">${this._esc(t)}</span>`).join(" ")}</div>` : ""}
        </div>
      </li>`;
    }
    out += `</ul>`;
    out += `<button class="d6-insp-hl-btn" data-sig-id="${this._esc(activeSig.id)}" style="margin-top:8px;">Highlight coverage in report</button>`;
    return out;
  }

  _buildFpConformance() {
    const sigs = this._signatures;
    if (!sigs.length) return `<p style="color:#6e7781">No data.</p>`;
    let out = `<div class="d6-sh">All signers &mdash; conformance summary</div>`;
    for (const sig of sigs) {
      const trace = sig.verificationTrace || [];
      const nPass = trace.filter(s => s.outcome === "pass").length;
      const nFail = trace.filter(s => s.outcome === "fail").length;
      out += `<div style="border:1px solid #d0d7de;border-radius:7px;padding:10px;margin-bottom:10px;">`;
      out += `<div style="font-weight:700;font-size:1rem;margin-bottom:4px;">${this._esc(sig.signerName || sig.id)}</div>`;
      out += `<div style="font-size:0.95rem;color:#6e7781;margin-bottom:6px;">${nPass} step${nPass !== 1 ? "s" : ""} passed${nFail ? `, ${nFail} failed` : ""}</div>`;
      out += `<ul class="d6-step-list">`;
      for (const [i, step] of trace.entries()) {
        const pass = step.outcome === "pass";
        out += `<li class="d6-step">
          <div class="d6-step-head">
            <span class="d6-step-num ${pass ? "pass" : "fail"}">${i + 1}</span>
            <span class="d6-step-title">${this._esc(step.name)}</span>
            <span class="d6-step-out ${pass ? "pass" : "fail"}">${pass ? "✔" : "✘"}</span>
            <span class="d6-step-chv">&#x25B8;</span>
          </div>
          <div class="d6-step-body">
            ${step.specRef ? `<span style="font-size:0.85rem;background:#fff8c5;border:1px solid #d4a72c;border-radius:3px;padding:1px 5px;font-family:monospace;color:#735c0f;">${this._esc(step.specRef)}</span> ` : ""}
            ${step.detail?.reason ? `<strong style="color:#cf222e">${this._esc(step.detail.reason)}</strong><br>` : ""}
            ${step.testCases?.length ? `<div class="d6-tc">Test cases: ${step.testCases.map(t => `<span class="d6-tid">${this._esc(t)}</span>`).join(" ")}</div>` : ""}
          </div>
        </li>`;
      }
      out += `</ul></div>`;
    }
    return out;
  }

  _setPanelMode(open) {
    this._panelOpen = Boolean(open);
    $("#d6-signatures-panel").toggleClass("hidden", !this._panelOpen);
    $("#inspector").toggleClass("d6-mode", this._panelOpen);
    $("#d6-panel-toggle").toggleClass("active", this._panelOpen);
  }

  _resolveHashVerifierBaseUrl() {
    const qp = new URLSearchParams(window.location.search).get("d6-hash-verifier-url");
    if (qp) return qp;
    return this._iv.runtimeConfig?.d6?.hashVerifierUrl || "https://xbrl.org/verify-hash";
  }

  _buildHashCheckPayload(sig) {
    return {
      v: 1,
      signatureId: sig.id,
      signerName: sig.signerName,
      signatureType: sig.type,
      status: sig.status,
      reportPageUrl: window.location.href,
      d6Url: sig.d6Url,
      signatureFileUrl: sig.signatureFileUrl,
      subsetFileUrl: sig.subsetFileUrl,
      targetDigest: sig.targetDigest,
      subsetDigest: sig.subsetDigest,
      generatedAt: new Date().toISOString()
    };
  }

  _buildHashCheckUrl(payload) {
    const base = this._resolveHashVerifierBaseUrl();
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const url = new URL(base);
    url.searchParams.set("payload", b64);
    return url.toString();
  }

  _renderHashCheck(sig) {
    const payload = this._buildHashCheckPayload(sig);
    const verifyUrl = this._buildHashCheckUrl(payload);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(verifyUrl)}`;
    $("#d6-hash-check-panel")
      .addClass("visible")
      .html(`
        <img src="${this._esc(qrUrl)}" alt="Hash check QR code" />
        <div class="d6-caption">Scan with phone for out-of-band hash check.</div>
        <div class="d6-caption">${this._esc(verifyUrl)}</div>
      `);
  }

  _esc(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _isPresent(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  _nameInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }
}
