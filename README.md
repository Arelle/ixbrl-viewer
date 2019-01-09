# Workiva iXBRL Viewer

The [Workiva](https://www.workiva.com) iXBRL Viewer allows [Inline XBRL](https://www.xbrl.org) reports to be viewed interactively in a web browser.  The viewer allows users to access the tagged XBRL data embedded in an iXBRL report.  Key features include:

* Full text search on taxonomy labels and references
* View full details of tagged facts
* Export tables to Excel
* Visualize and navigate calculation relationships
* Produce on-the-fly graphs using XBRL data

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

## Installing the Arelle plugin

1. Clone the [iXBRL Viewer git repository][ixbrlviewer-github].
2. Download [Arelle][arelle-git] and start the GUI.
3. Select **Manage Plugins** from the help menu.
4. Press **Browse** under "Find plug-in modules".  
5. Browse to the **iXBRLViewerPlugin** directory within your checkout of the iXBRL Viewer git repository and select the **__init.py__** file within it.
6. Press **Close** and then **Yes** when prompted to restart Arelle.
7. You should now have a **Save iXBRL Viewer instance** on the tools menu.

[ixbrlviewer-github]: https://github.com/Workiva/ixbrl-viewer
[arelle-git]: https://github.com/Arelle/Arelle

## Preparing an iXBRL file using the Arelle GUI

To prepare an iXBRL file to work with the viewer, open the iXBRL file in
Arelle, and then use the **Save iXBRL Viewer instance** option on the **Tools**
menu.

You will need to provide a URL to the **ixbrlviewer.js** file which can be
found in the **viewer/dist** directory within the repository.  The easiest way
to do this is to create a new directory, copy the **ixbrlviewer.js** file to
that directory, and then specify the **script URL** as "ixbrlviewer.js".

You should now save the viewer iXBRL file to a new file in the newly created
directory by selecting **Browse**, browsing to the directory, and providing a
file name.

You should now be able to open the created file in Chrome, and the iXBRL viewer
should load.

## Preparing an iXBRL file using the Arelle command line

The plugin can also be used on the command line:

```
python3 Arelle/arelleCmdLine.py --plugins=/path/to/iXBRLViewerPlugin -f ixbrl-report.html --save-viewer ixbrl-report-viewer.html --viewer-url ixbrlviewer.js

```

Note:

* "Arelle/arelleCmdLine.py" should be the path to your installation of Arelle
* The plugin path needs to an absolute file path


