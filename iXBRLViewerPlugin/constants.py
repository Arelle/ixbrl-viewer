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
        key='home_link_label',
        label='Home Link (Label)',
        description='Customizes the label of the "Home" link enabled by "home_link_url".',
        cliAction='store',
        cliDefault=None,
        guiVisible=False,
        guiDefault=None,
    ),
    FeatureConfig(
        key='home_link_url',
        label='Home Link (URL)',
        description='Adds a "Home" link that directs to the specified URL. Label can be customized with "home_link_label".',
        cliAction='store',
        cliDefault=None,
        guiVisible=False,
        guiDefault=None,
    ),
    FeatureConfig(
        key='support_link',
        label='Support Link',
        description='Adds a "Support" link that directs to the specified URL.',
        cliAction='store',
        cliDefault=None,
        guiVisible=False,
        guiDefault=None,
    ),
    FeatureConfig(
        key='survey_link',
        label='Survey Link',
        description='Adds a "Survey" link that directs to the specified URL.',
        cliAction='store',
        cliDefault=None,
        guiVisible=False,
        guiDefault=None,
    ),
    FeatureConfig(
        key='review',
        label='Review Mode',
        description='Enables highlighting of untagged numbers and dates.',
        cliAction='store_true',
        cliDefault=False,
        guiVisible=True,
        guiDefault=False
    ),
    FeatureConfig(
        key='mandatory_facts',
        label='Mandatory Facts',
        description='Enables the display of mandatory facts for the selected taxonomy.',
        cliAction='store',
        cliDefault=None,
        guiVisible=False,
        guiDefault=None
    ),
    FeatureConfig(
        key='search_on_startup',
        label='Search on startup',
        description='Show the search pane by default on startup.',
        cliAction='store_true',
        cliDefault=None,
        guiVisible=True,
        guiDefault=False
    ),
    FeatureConfig(
        key='highlight_facts_on_startup',
        label='Highlight facts on startup',
        description='Default "Highlight all facts" to on.',
        cliAction='store_true',
        cliDefault=None,
        guiVisible=True,
        guiDefault=False
    )
]
GUI_FEATURE_CONFIGS = [c for c in FEATURE_CONFIGS if c.guiVisible]

MANDATORY_FACTS = {
    "companies-house": [
            "UKCompaniesHouseRegisteredNumber",
            "EntityCurrentLegalOrRegisteredName",
            "BalanceSheetDate",
            "DateAuthorisationFinancialStatementsForIssue",
            "DirectorSigningFinancialStatements",
            "EntityDormantTruefalse",
            "EntityTradingStatus",
            "AccountsStatusAuditedOrUnaudited",
            "AccountsTypeFullOrAbbreviated",
            "AccountingStandardsApplied",
            "LegalFormEntity",
            "StartDateForPeriodCoveredByReport",
            "EndDateForPeriodCoveredByReport",
            "CharityRegistrationNumberEnglandWales",
            "CharityRegistrationNumberScotland",
            "CharityRegistrationNumberNorthernIreland"
    ]
}
