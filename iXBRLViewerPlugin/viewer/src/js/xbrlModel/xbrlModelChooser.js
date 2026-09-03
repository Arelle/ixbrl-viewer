// See COPYRIGHT.md for copyright information

import $ from 'jquery';

// Landing UI shown when the viewer is in XbrlModel mode but no model source is
// configured or given on the URL.  Lets the user pick a compiled XbrlModel
// object file (.json) from the local disk — and, when the source document (HTML
// or PDF) is also a local file, pick that too — then hands off to
// iXBRLViewer._loadXbrlModelDoc with the file content.
export function showXbrlModelChooser(iv) {
    const cfg = iv.runtimeConfig?.xbrlModel ?? {};
    const $loader = $('#ixv .loader').removeClass('loading').empty();

    const card = document.createElement("div");
    card.className = "xbrl-model-chooser";
    Object.assign(card.style, {
        maxWidth: "44rem", margin: "0 auto", padding: "2.4rem",
        textAlign: "center", color: "var(--colour-text, #333)",
        font: "1.4rem/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    });
    card.innerHTML = `
        <h1 style="font-size:2rem; margin:0 0 0.8rem;">XBRL Model Viewer</h1>
        <p style="margin:0 0 1.6rem; color:var(--colour-text-light,#737373);">
            Choose a compiled <strong>XBRL Model</strong> file (<code>.json</code>) to view.
            If its source document (HTML or PDF) is a local file, select it as well.
        </p>
        <label class="xmc-drop" style="display:block; padding:2.4rem 1.6rem; cursor:pointer;
                border:2px dashed var(--colour-border-grey,#ccc); border-radius:0.8rem;
                background:var(--colour-button-bg,#f8f8f8);">
            <input type="file" multiple accept=".json,application/json,.htm,.html,.pdf" style="display:none">
            <span class="xmc-drop-text">Click to choose files, or drop them here</span>
        </label>
        <div class="xmc-files" style="margin-top:1.2rem; color:var(--colour-text-light,#737373); word-break:break-all;"></div>
        <div class="xmc-error" style="margin-top:1.2rem; color:#c0392b; display:none;"></div>
    `;
    card.querySelector(".xmc-drop").appendChild(document.createTextNode("")); // keep label clickable in all browsers
    $loader.append(card);

    const $input = $(card).find("input[type=file]");
    const $drop = $(card).find(".xmc-drop");
    const $files = $(card).find(".xmc-files");
    const $error = $(card).find(".xmc-error");

    const showError = (msg) => $error.text(msg).show();

    async function handleFiles(fileList) {
        $error.hide();
        const files = Array.from(fileList || []);
        const modelFile = files.find(f => /\.json$/i.test(f.name))
            || files.find(f => f.type === "application/json");
        const docFile = files.find(f => /\.(html?|pdf)$/i.test(f.name));
        if (!modelFile) {
            showError("Please choose a compiled XBRL Model .json file.");
            return;
        }
        $files.text(modelFile.name + (docFile ? "  +  " + docFile.name : ""));
        try {
            const modelDoc = JSON.parse(await modelFile.text());
            let documentSource;
            if (docFile) {
                if (/\.pdf$/i.test(docFile.name)) {
                    documentSource = { data: await docFile.arrayBuffer(), filename: docFile.name, isPdf: true };
                }
                else {
                    documentSource = { text: await docFile.text(), filename: docFile.name, isPdf: false, baseUrl: "" };
                }
            }
            // Switch to the loading state and hand off to the loader (which
            // removes the loader when done).
            $loader.empty().addClass("loading").append($('<span class="text">Loading XbrlModel Viewer</span>'));
            await iv._loadXbrlModelDoc(modelDoc, "", cfg, documentSource);
        }
        catch (e) {
            console.log(e);
            $('#ixv #iframe-container').empty();
            showXbrlModelChooser(iv);
            $('#ixv .xbrl-model-chooser .xmc-error').text("Could not load: " + (e.message ?? e)).show();
        }
    }

    $input.on("change", (e) => handleFiles(e.target.files));
    $drop
        .on("dragover", (e) => { e.preventDefault(); $drop.css("border-color", "var(--colour-button-primary-border, #4a90d9)"); })
        .on("dragleave", () => $drop.css("border-color", "var(--colour-border-grey, #ccc)"))
        .on("drop", (e) => {
            e.preventDefault();
            $drop.css("border-color", "var(--colour-border-grey, #ccc)");
            handleFiles(e.originalEvent.dataTransfer.files);
        });

    return Promise.resolve();
}
