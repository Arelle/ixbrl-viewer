# See COPYRIGHT.md for copyright information

from arelle.utils.PluginData import PluginData
from .iXBRLViewer import IXBRLViewerBuilder
from typing import Optional

class IXBRLViewerPluginData(PluginData):

    builder: Optional[IXBRLViewerBuilder] = None
