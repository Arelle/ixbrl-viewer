from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, repr=False, eq=False)
class FeatureConfig:
    key: str
    label: str
    description: str
    cliAction: str
    cliDefault: Any
    guiVisible: bool
    guiDefault: Any
