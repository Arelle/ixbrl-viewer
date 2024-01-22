# See COPYRIGHT.md for copyright information

import os

from .featureConfig import FeatureConfig

CONFIG_FEATURE_PREFIX = 'iXBRLViewerFeature_'
CONFIG_FILE_DIRECTORY = 'iXBRLViewerFileDir'
CONFIG_LAUNCH_ON_LOAD = 'iXBRLViewerLaunchOnLoad'
CONFIG_COPY_SCRIPT = 'iXBRLViewerCopyScript'
CONFIG_OUTPUT_FILE = 'iXBRLViewerOutputFile'
CONFIG_SCRIPT_URL = 'iXBRLViewerScriptURL'
CONFIG_ZIP_OUTPUT = 'iXBRLViewerZipOutput'

ERROR_MESSAGE_CODE = 'viewer:error'
EXCEPTION_MESSAGE_CODE = 'viewer:exception'
INFO_MESSAGE_CODE = 'viewer:info'

DEFAULT_LAUNCH_ON_LOAD = True
DEFAULT_COPY_SCRIPT = True
DEFAULT_OUTPUT_NAME = 'ixbrlviewer.html'
DEFAULT_JS_FILENAME = 'ixbrlviewer.js'
DEFAULT_VIEWER_PATH = os.path.join(os.path.dirname(__file__), "viewer", "dist", DEFAULT_JS_FILENAME)

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
