# See COPYRIGHT.md for copyright information

import os

from .featureConfig import FeatureConfig

CONFIG_FEATURE_PREFIX = 'iXBRLViewerFeature_'
CONFIG_FILE_DIRECTORY = 'iXBRLViewerFileDir'
CONFIG_LAUNCH_ON_LOAD = 'iXBRLViewerLaunchOnLoad'
CONFIG_OUTPUT_FILE = 'iXBRLViewerOutputFile'
CONFIG_SCRIPT_URL = 'iXBRLViewerScriptURL'
CONFIG_ZIP_OUTPUT = 'iXBRLViewerZipOutput'

DEFAULT_LAUNCH_ON_LOAD = True
DEFAULT_OUTPUT_NAME = 'ixbrlviewer.html'
DEFAULT_VIEWER_PATH = os.path.join(os.path.dirname(__file__), "viewer", "dist", "ixbrlviewer.js")

FEATURE_CONFIGS = [
    FeatureConfig(
        key='review',
        label='Review Mode',
        description='Enables highlighting of untagged numbers and dates.',
        guiVisible=True,
        guiDefault=False
    )
]

GUI_FEATURE_CONFIGS = [c for c in FEATURE_CONFIGS if c.guiVisible]
