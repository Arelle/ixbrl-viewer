from arelle.utils.PluginData import PluginData
from .iXBRLViewer import IXBRLViewerBuilder
from typing import Optional

class IXBRLViewerPluginData(PluginData): # type: ignore[misc]

    builder: Optional[IXBRLViewerBuilder] = None
