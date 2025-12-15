# See COPYRIGHT.md for copyright information

from __future__ import annotations

from arelle.utils.PluginData import PluginData

from .iXBRLViewer import IXBRLViewerBuilder


class IXBRLViewerPluginData(PluginData):

    builder: IXBRLViewerBuilder | None = None
