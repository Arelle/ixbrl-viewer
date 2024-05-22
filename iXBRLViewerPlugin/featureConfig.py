from dataclasses import dataclass


@dataclass(frozen=True, repr=False, eq=False)
class FeatureConfig:
    key: str
    label: str
    description: str
    guiVisible: bool
    guiDefault: bool
