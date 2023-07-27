# Plugins

The iXBRL Viewer provides a simple plugin framework, to enable projects to
build JavaScript iXBRL viewers with additional functionality.

A plugin is a class with one or more of the following methods:

* `extendDisplayOptionsMenu(menu)` - provides a menu object that can be modified to add additional options.
* `preProcessiXBRL(body, docIndex)` - called once with the `<body>` DOM node for each document in the document set.
* `updateViewerStyleElements(styleElts)` - called on initialization with a jQuery object containing the `<style>` element from each document in the document set, allow additional styles to be registered.

To instantiate a viewer with a plugin, call `registerPlugin`:

```
import { iXBRLViewer } from 'ixbrl-viewer';
import { MyPlugin } from "./my-plugin.js";

const loadPlugin = () => {
    const iv = new iXBRLViewer(); // prefer const then let
    const ivp = new MyPlugin(iv);
    iv.registerPlugin(ivp);
    iv.load();
}

if (document.readyState === 'loading') {  // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", loadPlugin);
} else {
    loadPlugin();
}
```

The `ixbrl-viewer` project can be added as a dev dependency in `package.json`:

```
    "devDependencies": {
        "ixbrl-viewer": "^1.2.0"
    }
```

This will cause the project to be fetched from github by `npm install`.

