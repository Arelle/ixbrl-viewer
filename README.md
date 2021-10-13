# AMANA Fork of the Workiva iXBRL Viewer

The [Workiva](https://www.workiva.com) iXBRL Viewer allows [Inline XBRL](https://www.xbrl.org/ixbrl) (or iXBRL) reports to be viewed interactively in a web browser.  The viewer allows users to access the tagged XBRL data embedded in an iXBRL report.  Key features include:

* Full text search on taxonomy labels and references
* View full details of tagged facts
* Export tables to Excel
* Visualize and navigate calculation relationships
* Produce on-the-fly graphs using XBRL data

The AMANA Fork implements the additional features and improvements:
* Implemented tagging highlight of ix:nonFraction for non-HTML-tables (old viewer did expected &lt;td&gt;/&lt;th&gt;).
* Implemented displaying ESEF anchoring in the tag inspector.
* Implemented displaying validation results on tag inspector (injected by XBRL processor).
* Implemented tooltips over highlighted facts.
* Support CSS content-visibilty:auto by no longer using <iframe>, supports large PDF converted reports in Chrome.
* Enhanced embedding of the Viewer into existing HTML pages.
* Improved zooming and 'jump to next fact' compatibilty for Safari and Firefox.
* New click event for inline tags.

The viewer project consists of two components:

* A plugin for the [Arelle](https://www.arelle.org) XBRL tool
* The Javascript viewer application

In order to view an iXBRL report in the viewer, it must first be prepared using
the Arelle plugin.  The preparation process updates the iXBRL file to include:

1. A link to the Javascript viewer
2. A block of JSON data that contains the results of processing the XBRL data and associated taxonomy

Once prepared, the resulting file provides an entirely standalone viewer.  Once
prepared, the viewer is entirely standalone, and does not require access to the
taxonomy, or to any online services.  The only dependency is on the Javascript
viewer application, which is a single file which may be stored locally.

## Building the ixbrlviewer

The viewer works using a single Javascript file called ixbrlviewer.js. It
contains all of the javascript that runs the viewer functionality. In order to
successfully build an ixbrl-viewer you need to first build the ixbrlviewer
file.

1. Clone the [iXBRL Viewer git repository][ixbrlviewer-github].
2. Install npm. Instructions can be found here: https://www.npmjs.com/get-npm
3. Install the dependencies for javascript by running: `npm install`.  This
   command must be run from within the `ixbrl-viewer directory` (i.e. the root
   of your checkout of the repository).
4. Run `npm run prod`. This will create the ixbrlviewer.js in the
   iXBRLViewerPlugin/viewer/dist directory.

## Installing the Arelle plugin

1. Download and install [Arelle][arelle-download]
2. Open Arelle and select **Manage Plugins** from the **Help** menu.
3. Press **Browse** under "Find plug-in modules".  
4. Browse to the **iXBRLViewerPlugin** directory within your checkout of the iXBRL Viewer git repository and select the **\_\_init\_\_.py** file within it.
5. Press **Close** and then **Yes** when prompted to restart Arelle.
6. You should now have a **Save iXBRL Viewer instance** on the **Tools** menu.

[ixbrlviewer-github]: https://github.com/Workiva/ixbrl-viewer
[arelle-git]: https://github.com/Arelle/Arelle
[arelle-download]: http://arelle.org/pub

## Preparing an iXBRL file using the Arelle GUI

To prepare an iXBRL file to work with the viewer, open the iXBRL file in
Arelle, and then use the **Save iXBRL Viewer instance** option on the **Tools**
menu.

You will need to provide a URL to the **ixbrlviewer.js** file which can be
found in the **viewer/dist** directory within the repository.  This can be 
either an absolute URL, or a relative URL from the iXBRL viewer file to the 
ixbrlviewer.js file.  The easiest way to do this is to create a new directory, 
copy the **ixbrlviewer.js** file to that directory, and then specify the 
**script URL** as just "ixbrlviewer.js".

You should now save the viewer iXBRL file to a new file in the newly created
directory by selecting **Browse**, browsing to the directory, and providing a
file name.

You should now be able to open the created file in Chrome, and the iXBRL viewer
should load.

## Preparing an iXBRL document set using the Arelle GUI

To prepare an iXBRL document set, open the document set in Arelle.  The process
is as for a single file, except that a directory should be selected as the
output location, rather than a file.

## Preparing an iXBRL file using the Arelle command line

The plugin can also be used on the command line:

```
python3 Arelle/arelleCmdLine.py --plugins=/path/to/iXBRLViewerPlugin -f ixbrl-report.html --save-viewer ixbrl-report-viewer.html --viewer-url ixbrlviewer.js

```

Notes:

* "Arelle/arelleCmdLine.py" should be the path to your installation of Arelle
* The plugin path needs to an absolute file path

## Preparing an iXBRL document set using the Arelle command line

The iXBRL Viewer supports Inline XBRL document sets.  This requires the `inlineXbrlDocumentSet` plugin.  The input is specified using JSON in the following form:

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

```
python3 Arelle/arelleCmdLine.py --plugins '/path/to/iXBRLViewerPlugin|inlineXbrlDocumentSet' -f '[{"ixds":[{"file":"document1.html"},{"file":"document2.html"}]}]'  --save-viewer out-dir --viewer-url ixbrlviewer.js
```

The first file specified is the "primary" file, and should be opened in a
browser to use the viewer.  The other files will be loaded in separate tabs
within the viewer.

## Using build-viewer.py

As an alternative to the standard Arelle command line, the
`samples/build-viewer.py` script can also be used.  To use the script, both the
Arelle source code and the iXBRLViewerPlugin must be on the Python path. e.g.:

```
PYTHONPATH=/path/to/Arelle:/path/to/ixbrl-viewer ./samples/build-viewer.py --help
```

A document set can be processed by passing a directory as input.  All `.html`
and `.xhtml` in the directory will be combined into a document set.  The
generated files will be saved into the directory specified by the `--out`
option.  

Taxonomy packages can be specified using `--package-dir`.  All ZIP files in the
specified directories will be loaded as taxonomy packages.

e.g.

```
PYTHONPATH=/path/to/Arelle:/path/to/ixbrl-viewer ./samples/build-viewer.py --out out-dir --package-dir /my/packages/ ixds-dir
```

## Running Unit Tests

In order to run the javascript unit tests make sure that you have installed all of the npm requirements.

Run the following command to run javascript unit tests: `npm run test`

In order to run the python unit tests make sure that you have pip installed requirements-dev.txt.

Run the following command to run python unit tests: `nosetests`


