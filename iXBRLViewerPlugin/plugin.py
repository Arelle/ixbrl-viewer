# See COPYRIGHT.md for copyright information

from arelle.utils.PluginData import PluginData

from .iXBRLViewer import IXBRLViewerBuilder


class IXBRLViewerPluginData(PluginData):

    builder: IXBRLViewerBuilder | None = None
