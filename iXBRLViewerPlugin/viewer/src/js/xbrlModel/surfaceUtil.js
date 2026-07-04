// See COPYRIGHT.md for copyright information

// Resolve once an iframe's document has finished loading and has body content.
// There is no single reliable load event for a document written via
// document.write, so we poll (matching the approach used for the iXBRL path).
export function iframeReady(iframe) {
    return new Promise((resolve) => {
        const timer = setInterval(() => {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if ((doc.readyState === "complete" || doc.readyState === "interactive")
                    && doc.body && doc.body.children.length > 0) {
                clearInterval(timer);
                resolve();
            }
        }, 100);
    });
}
