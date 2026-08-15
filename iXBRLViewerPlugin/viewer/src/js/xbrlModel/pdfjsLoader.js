// See COPYRIGHT.md for copyright information
//
// PDF.js loader, isolated in its own module so that it is only ever reached via
// a runtime dynamic import() (from PdfDocumentSurface).  This keeps `import.meta`
// and the web-worker construction out of the statically-imported module graph,
// so the (CommonJS) jest test environment never has to parse them, and pulls the
// large PDF.js/worker bundles only when the PDF surface is actually used.

let pdfjsLibPromise = null;

export function loadPdfjs() {
    if (pdfjsLibPromise === null) {
        pdfjsLibPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjsLib) => {
            pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
                new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
                { type: 'module' },
            );
            return pdfjsLib;
        });
    }
    return pdfjsLibPromise;
}
