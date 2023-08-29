# Arelle iXBRL Viewer

![ixbrl-viewer](https://raw.githubusercontent.com/Arelle/ixbrl-viewer/master/examples/ixbrl-viewer-demo.gif)

The [Arelle](https://arelle.org/) iXBRL Viewer allows [Inline XBRL](https://www.xbrl.org/ixbrl) (or iXBRL) reports to be
viewed interactively in a web browser.  The viewer allows users to access the tagged XBRL data embedded in an iXBRL
report.  Key features include:

* Full text search on taxonomy labels and references
* View full details of tagged facts
* Export tables to Excel
* Visualize and navigate calculation relationships
* Produce on-the-fly graphs using XBRL data

A sample viewer is provided in the [examples](https://github.com/Arelle/ixbrl-viewer/blob/master/examples/README.md) for those interested.

The viewer project consists of two components:

* A plugin for the [Arelle](https://www.arelle.org) XBRL tool
* The Javascript viewer application

In order to view an iXBRL report in the viewer, it must first be prepared using
the Arelle plugin.  The preparation process updates the iXBRL file to include:

1. A link to the Javascript viewer
2. A block of JSON data that contains the results of processing the XBRL data and associated taxonomy

Once prepared, the resulting file provides an entirely standalone viewer.  Once
prepared, the viewer is entirely standalone, and does not require access to the
taxonomy, or to any online services.  The only dependency is on the javascript
viewer application, which is a single file which can be accessed directly online, downloaded or built locally.

The javascript viewer application is a single Javascript file called ixbrlviewer.js. It
contains all of the javascript that runs the viewer functionality.

## Installation

The python portion of this repo is developed using Python 3.11.

1. Clone the [iXBRL Viewer git repository][ixbrlviewer-github].
2. Download and install [Arelle][arelle-download]

## Accessing the JavaScript viewer application

### Accessing via the CDN

The JavaScript file is available via a CDN. It can be accessed via the following url:

```text
https://cdn.jsdelivr.net/npm/ixbrl-viewer@<version>/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js
```

Where `<version>` is the current version of ixbrl-viewer you are using. For instance [1.2.0][CDN].

### Accessing via Github

When a new version of ixbrl-viewer is released, the javascript is included as a
release asset. The asset can be found on the releases [page][ixbrlviewer-github-releases] for each version of
the ixbrl-viewer.  

### Building the JavaScript locally

1. Install npm. Instructions can be found here: <https://www.npmjs.com/get-npm>
2. Install the dependencies for javascript by running: `npm install`.  This
   command must be run from within the `ixbrl-viewer directory` (i.e. the root
   of your checkout of the repository).
3. Run `npm run prod`. This will create the ixbrlviewer.js in the
   iXBRLViewerPlugin/viewer/dist directory.

[ixbrlviewer-github]: https://github.com/Arelle/ixbrl-viewer
[CDN]: https://cdn.jsdelivr.net/npm/ixbrl-viewer@1.2.0/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js
[ixbrlviewer-github-releases]: https://github.com/Arelle/ixbrl-viewer/releases/tag/0.1.58
[arelle-download]: http://arelle.org/pub

## JavaScript Versioning

The ixbrl-viewer plugin embeds processed XBRL metadata in the HTML that has a specific format read
by the JavaScript. The metadata produced by a version will be broken if a major version bump is
released. The new javascript won't necessarily work with older versions of the generated metadata.
if a minor version bump is released, then the metadata format was updated, any ixbrl-viewer produced
on that minor version will have to use at least that minor version for the javascript.

## Producing an ixbrl-viewer via the Arelle GUI

### Preparing an iXBRL file via the GUI

1. Open Arelle and select **Manage Plugins** from the **Help** menu.
2. Press **Browse** under "Find plug-in modules".
3. Browse to the **iXBRLViewerPlugin** directory within your checkout of the iXBRL Viewer git repository and select
   the **\_\_init\_\_.py** file within it.
4. Press **Close** and then **Yes** when prompted to restart Arelle.
5. You should now have a **Save iXBRL Viewer instance** on the **Tools** menu.
6. Open the ixbrl filing zip in Arelle
7. Select **Save iXBRL Viewer instance** option on the **Tools** menu
8. Provide a **script URL** to the **ixbrlviewer.js** file.

   This url can be one of the following:

   1. `https://cdn.jsdelivr.net/npm/ixbrl-viewer@<version>/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js`
   2. A relative url to the downloaded ixviewer.js from github
   3. A relative url to the locally built ixviewer.js

9. Save the viewer iXBRL file to a new file in the newly created directory by
   selecting **Browse**, browsing to the directory, and providing a file name.

10. You should now be able to open the created file in Chrome, and the iXBRL viewer
    should load.

### Preparing an iXBRL document set using the Arelle GUI

To prepare an iXBRL document set, open the document set in Arelle.  The process
is as for a single file, except that a directory should be selected as the
output location, rather than a file.

## Producing an ixbrl-viewer via the Arelle command line

### Preparing an iXBRL file via the command line

The plugin can also be used on the command line:

```shell
python3 Arelle/arelleCmdLine.py --plugins=<path to iXBRLViewerPlugin> -f ixbrl-report.html --save-viewer ixbrl-report-viewer.html --viewer-url https://cdn.jsdelivr.net/npm/ixbrl-viewer@<version>/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js
```

Notes:

* "Arelle/arelleCmdLine.py" should be the path to your installation of Arelle
* The plugin path needs to an absolute file path to the ixbrl-viewer plugin
* The viewer url can be one of the following:

  1. `https://cdn.jsdelivr.net/npm/ixbrl-viewer@<version>/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js`
  2. A relative url to the downloaded ixviewer.js from github
  3. A relative url to the locally built ixviewer.js

### Preparing an iXBRL document set

The iXBRL Viewer supports Inline XBRL document sets.  This requires the `inlineXbrlDocumentSet` plugin.
The input is specified using JSON in the following form:

```json
[
  {
    "ixds": [
      { "file": "file1.html" },
      { "file": "file2.html" },
    ]
  }
]
```

The output must be specified as a directory.  For example:

```shell
python3 Arelle/arelleCmdLine.py --plugins '/path/to/iXBRLViewerPlugin|inlineXbrlDocumentSet' -f '[{"ixds":[{"file":"document1.html"},{"file":"document2.html"}]}]'  --save-viewer out-dir --viewer-url https://cdn.jsdelivr.net/npm/ixbrl-viewer@<version>/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js
```

Notes:

* The first file specified is the "primary" file, and should be opened in a
  browser to use the viewer.  The other files will be loaded in separate tabs
  within the viewer.
* "Arelle/arelleCmdLine.py" should be the path to your installation of Arelle
* The plugin path needs to an absolute file path to the ixbrl-viewer plugin
* The viewer url can be one of the following:

  1. `https://cdn.jsdelivr.net/npm/ixbrl-viewer@<version>/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js`
  2. A relative url to the downloaded ixviewer.js from github
  3. A relative url to the locally built ixviewer.js

### Using build-viewer.py

As an alternative to the standard Arelle command line, the
`samples/build-viewer.py` script can also be used.  To use the script, both the
Arelle source code and the iXBRLViewerPlugin must be on the Python path. e.g.:

```shell
PYTHONPATH=/path/to/Arelle:/path/to/ixbrl-viewer ./samples/build-viewer.py --help
```

A document set can be processed by passing a directory as input.  All `.html`
and `.xhtml` in the directory will be combined into a document set.  The
generated files will be saved into the directory specified by the `--out`
option.  

Taxonomy packages can be specified using `--package-dir`.  All ZIP files in the
specified directories will be loaded as taxonomy packages.

e.g.

```shell
PYTHONPATH=/path/to/Arelle:/path/to/ixbrl-viewer ./samples/build-viewer.py --out out-dir --package-dir /my/packages/ ixds-dir
```
# Optional Features
Some features are disabled by default but can be enabled at generation time or with query parameters.

To enable features:
- Via CLI: `--viewer-feature-{feature name}`
- Via query parameter:`?{feature name}=true`

Features enabled by CLI/JSON can be disabled by query parameter via `?{feature name}=false`.
Note that *any other value* besides "false" (case-sensitive) will *enable* the feature.
This will override any enabling query parameters, so `?review=true&review=false&review=true` would result in the 'review' feature being disabled.

This table uses the 'review' feature as an example to demonstrate how these options interact:

| CLI/JSON | Query Param | Result     |
|----------|-------------|------------|
| `unset`  | `unset`     | `disabled` |
| `unset`  | `true`      | `enabled`  |
| `unset`  | `false`     | `disabled` |
| `review` | `unset`     | `enabled`  |
| `review` | `true`      | `enabled`  |
| `review` | `false`     | `disabled` |

## Feature: Review Mode
![ixbrl-viewer](https://raw.githubusercontent.com/Arelle/ixbrl-viewer/master/examples/review-mode.png)

A review mode is available that is intended to assist in reviewing partially tagged or incomplete documents.
This mode replaces the namespace-based highlighting with optional highlighting based on untagged numbers and/or dates.

| CLI/JSON                  | Query Param    |
|---------------------------|----------------|
| `--viewer-feature-review` | `?review=true` |


## Running tests

### Running unit tests

In order to run the javascript unit tests make sure that you have installed all of the npm requirements.

Run the following command to run javascript unit tests: `npm run test`

In order to run the python unit tests make sure that you have pip installed requirements-dev.txt.

Run the following command to run python unit tests: `nose2`

### Running Puppeteer tests

All commands should be run from repository root

1. Install the npm requirements(instructions under [Building the javascript locally](#building-the-javascript-locally)).
2. Install Arelle

    ```shell
    pip install arelle-release .
    ```

3. [Terminal 1] Start the puppeteer serve

    ```shell
    npm run puppeteerServe 
    ```

    * This command generates the `ixbrlviewer.js`, uses Arelle to generate several test files, then serves the files via a nodejs http-server.
    * Currently changes to application code require restarting this step to take effect.
4. Start the puppeteer tests
    * [Terminal 2]:

       ```shell
       npm run test:puppeteer
       ```

    * IDE:
      * Many of the IDE's on the market can run tests via the UI.  The following is an example configuration for intellij.  Once set you can right-click on the test name or file and select the run option.
      ![ixbrl-viewer](https://raw.githubusercontent.com/Arelle/ixbrl-viewer/master/tests/puppeteer/puppeteer_test_run_via_intellij.jpg)
      * Debug runs with breakpoints are also typically supported.
