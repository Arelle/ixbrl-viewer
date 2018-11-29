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

In order to view an iXBRL report in the viewer, it must first be prepared using the Arelle plugin.  The preparation process updates the iXBRL file to include:

1. A link to the Javascript viewer
2. A block of JSON data that contains the results of processing the XBRL data and associated taxonomy

Once prepared, the resulting file provides an entirely standalone viewer.  Once prepared, the viewer is entirely standalone, and does not require access to the taxonomy, or to any online services. 
The only dependency is on the Javascript viewer application, which is a single file which may be stored locally.

## Installing the Arelle plugin



## Preparing an iXBRL file using the Arelle GUI


## Preparing an iXBRL file using the Arelle command line