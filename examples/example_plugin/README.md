# Example Plugin
![example-plugin](example-plugin.gif)

Example plugin provides an example usage of the ixbrl-viewer plugin infrastructure.

## Highlighting
The example plugin is able to highlight any section containing the letter 'T' with the color red.
Click the settings and select the toggle on and off to see it in action.

## Running
From the `example_plugin` directory

```bash
npm install
npm run build
```

Then using arelle

```bash
python arelleCmdLine.py --plugins=<PATH_TO>/iXBRLViewerPlugin/__init__.py -f <FILING>.htm --save-viewer <VIEWER>.html --viewer-url <PATH_TO>/examples/example_plugin/dist/example-extended-ixbrl-viewer.js
```
