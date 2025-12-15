# See COPYRIGHT.md for copyright information

from __future__ import annotations

import os
from tkinter import EW, NSEW, BooleanVar, E, Event, Misc, StringVar, Toplevel, W
from tkinter.ttk import Button, Checkbutton, Entry, Frame, Label
from typing import Any

from arelle.CntlrWinMain import CntlrWinMain
from arelle.typing import TypeGetText

from .constants import (
    CONFIG_COPY_SCRIPT,
    CONFIG_FEATURE_PREFIX,
    CONFIG_FILE_DIRECTORY,
    CONFIG_LAUNCH_ON_LOAD,
    CONFIG_OUTPUT_FILE,
    CONFIG_SCRIPT_URL,
    CONFIG_ZIP_OUTPUT,
    DEFAULT_COPY_SCRIPT,
    DEFAULT_LAUNCH_ON_LOAD,
    GUI_FEATURE_CONFIGS,
)

_: TypeGetText

UNSET_SCRIPT_URL = ''

class BaseViewerDialog(Toplevel):
    """
    Base class for shared dialog configuration between settings and save dialogs
    """
    def __init__(self, cntlr: CntlrWinMain) -> None:
        super().__init__(cntlr.parent)
        self.cntlr = cntlr
        self.parent = cntlr.parent

        self._features: dict[str, BooleanVar] = {}
        for featureConfig in GUI_FEATURE_CONFIGS:
            featureVar = BooleanVar()
            featureVar.set(self._cntlrConfig.setdefault(f'{CONFIG_FEATURE_PREFIX}{featureConfig.key}', featureConfig.guiDefault))
            self._features[featureConfig.key] = featureVar
        self._scriptUrl = StringVar()
        self._scriptUrl.set(self._cntlrConfig.setdefault(CONFIG_SCRIPT_URL, UNSET_SCRIPT_URL))
        self._copyScript = BooleanVar()
        self._copyScript.set(self._cntlrConfig.setdefault(CONFIG_COPY_SCRIPT, DEFAULT_COPY_SCRIPT))

    @property
    def _cntlrConfig(self) -> dict[str, Any]:
        assert self.cntlr.config is not None
        return self.cntlr.config

    def addButtons(self, frame: Frame, x: int, y: int) -> int:
        """
        Adds base buttons (OK, Cancel) to `frame` starting at column `x` on row `y`.
        Can be extended to add buttons before or after base buttons.
        :param frame: Frame to add buttons to
        :param x: Grid column to start at
        :param y: Grid row to add buttons on
        :return: Column `x` that the last button was added on
        """
        x += 1
        okButton = Button(frame, text=_("OK"), command=self.confirm)
        okButton.grid(row=y, column=x, sticky=E, pady=3, padx=3)
        x += 1
        cancelButton = Button(frame, text=_("Cancel"), command=self.close)
        cancelButton.grid(row=y, column=x, sticky=E, pady=3, padx=3)
        return x

    def addFields(self, frame: Frame, y: int) -> int:
        """
        Adds base fields to `frame` starting on row `y`.
        Can be extended to add fields before or after base fields.
        :param frame: Frame to add fields to
        :param y: Grid row to add buttons on
        :return: Row `y` that the last field was added on
        """
        y += 1
        scriptUrlLabel = Label(frame, text="Script URL (leave blank for default)")
        scriptUrlEntry = Entry(frame, textvariable=self._scriptUrl, width=80)
        scriptUrlLabel.grid(row=y, column=0, sticky=W, pady=3, padx=3)
        scriptUrlEntry.grid(row=y, column=1, columnspan=2, sticky=EW, pady=3, padx=3)

        y += 1
        copyScriptCheckbutton = Checkbutton(frame, text="Copy Script", variable=self._copyScript, onvalue=True, offvalue=False)
        copyScriptLabel = Label(frame, text="Copy the iXBRL Viewer script into the output directory.")
        copyScriptCheckbutton.grid(row=y, column=0, pady=3, padx=3, sticky=W)
        copyScriptLabel.grid(row=y, column=1, columnspan=3, pady=3, padx=3, sticky=W)

        y += 1
        featuresLabel = Label(frame, text="Generate with optional features:")
        featuresLabel.grid(row=y, column=0, columnspan=2, pady=3, padx=3, sticky=W)
        for featureConfig in GUI_FEATURE_CONFIGS:
            y += 1
            featureVar = self._features[featureConfig.key]
            featureCheckbutton = Checkbutton(frame, text=featureConfig.label, variable=featureVar, onvalue=True, offvalue=False)
            featureLabel = Label(frame, text=featureConfig.description)
            featureCheckbutton.grid(row=y, column=0, pady=3, padx=3, sticky=W)
            featureLabel.grid(row=y, column=1, columnspan=2, pady=3, padx=3, sticky=W)
        return y

    def close(self, event: Event[Misc] | None = None) -> None:
        """
        Closes the dialog.
        """
        self.parent.focus_set()
        self.destroy()

    def confirm(self, event: Event[Misc] | None = None) -> None:
        """
        Closes the dialog after calling `onConfirm`.
        """
        self.onConfirm()
        self.close(event)

    def getTitle(self) -> str:
        """
        :return: Title of dialog window
        """
        raise NotImplementedError

    def onConfirm(self) -> None:
        """
        Actions to confirm when "OK" button or "Enter" key are pressed.
        Window is closed immediately after.
        """
        pass

    def render(self) -> None:
        """
        Performs the arrangement and rendering if dialog fields and buttons.
        Process control is held here via `wait_window` until the dialog is closed.
        """
        self.title(self.getTitle())

        frame = Frame(self)

        y = 1
        y = self.addFields(frame, y)

        y += 1
        x = 0
        self.addButtons(frame, x, y)

        frame.grid(row=0, column=0, padx=10, pady=10, sticky=NSEW)
        frame.columnconfigure(1, weight=1)

        window = self.winfo_toplevel()
        window.columnconfigure(0, weight=1)

        self.bind("<Return>", self.confirm)
        self.bind("<Escape>", self.close)

        self.protocol("WM_DELETE_WINDOW", self.close)
        self.grab_set()
        self.wait_window(self)

    def copyScript(self) -> bool:
        return self._copyScript.get()

    def features(self) -> list[str]:
        # Return list of feature keys with corresponding BooleanVar is set to True
        return [feature for feature, value in self._features.items() if value.get()]

    def scriptUrl(self) -> str:
        return self._scriptUrl.get()


class SaveViewerDialog(BaseViewerDialog):
    """
    Dialog for saving a viewer instance.
    Initializes with (but doesn't overwrite) default settings configured in the settings dialog.
    """

    def __init__(self, cntlr: CntlrWinMain) -> None:
        super().__init__(cntlr)
        self.accepted = False
        self._filename = StringVar()
        self._filename.set(self._cntlrConfig.setdefault(CONFIG_OUTPUT_FILE, ""))
        self._zipViewerOutput = BooleanVar()
        self._zipViewerOutput.set(self._cntlrConfig.setdefault(CONFIG_ZIP_OUTPUT, False))

    def addFields(self, frame: Frame, y: int) -> int:
        """
        Adds filename and zip output fields before other settings.
        """
        y += 1
        filenameLabel = Label(frame, text="iXBRL file")
        filenameEntry = Entry(frame, textvariable=self._filename, width=80)
        filenameBrowse = Button(frame, text=_("Browse..."), command=self.browseForFile)
        filenameLabel.grid(row=y, column=0, sticky=W, pady=3, padx=3)
        filenameEntry.grid(row=y, column=1, sticky=EW, pady=3, padx=3)
        filenameBrowse.grid(row=y, column=2, sticky=EW, pady=3, padx=3)
        y += 1
        zipViewerOutputCheckbutton = Checkbutton(frame, text="Zip Viewer Output", variable=self._zipViewerOutput, onvalue=True, offvalue=False)
        zipViewerOutputCheckbutton.grid(row=y, column=0, pady=3, padx=3)
        return super().addFields(frame, y)

    def browseForFile(self) -> None:
        instanceFile = self.cntlr.uiFileDialog(  # type: ignore[no-untyped-call]
            "save",
            parent=self,
            title=_("arelle - Save iXBRL Viewer Instance"),
            initialdir=self._cntlrConfig.setdefault(CONFIG_FILE_DIRECTORY, "."),
            filetypes=[(_("iXBRL report .html"), "*.html")],
            defaultextension=".html")
        self._filename.set(instanceFile)

    def getTitle(self) -> str:
        return "Save iXBRL Viewer"

    def onConfirm(self) -> None:
        """
        Saves output-specific config values before triggering instance to be saved.
        """
        self._cntlrConfig[CONFIG_FILE_DIRECTORY] = os.path.dirname(self.filename())
        self._cntlrConfig[CONFIG_OUTPUT_FILE] = self.filename()
        self._cntlrConfig[CONFIG_ZIP_OUTPUT] = self.zipViewerOutput()
        self.cntlr.saveConfig()
        self.accepted = True

    def filename(self) -> str:
        return self._filename.get()

    def zipViewerOutput(self) -> bool:
        return self._zipViewerOutput.get()


class SettingsDialog(BaseViewerDialog):
    """
    Dialog for saving default viewer settings.
    """

    def __init__(self, cntlr: CntlrWinMain) -> None:
        super().__init__(cntlr)
        self._launchOnLoad = BooleanVar()
        self._launchOnLoad.set(self._cntlrConfig.setdefault(CONFIG_LAUNCH_ON_LOAD, DEFAULT_LAUNCH_ON_LOAD))

    def addButtons(self, frame: Frame, x: int, y: int) -> int:
        """
        Adds reset button before OK button
        """
        x += 1
        resetButton = Button(frame, text=_("Reset Defaults"), command=self.reset)
        resetButton.grid(row=y, column=x, sticky=E, pady=3, padx=30)
        return super().addButtons(frame, x, y)

    def addFields(self, frame: Frame, y: int) -> int:
        """
        Adds launch-on-load checkbox above other settings
        """
        y += 1
        launchOnLoadCheckbutton = Checkbutton(frame, text="Launch on Load", variable=self._launchOnLoad, onvalue=True, offvalue=False)
        launchOnLoadLabel = Label(frame, text="Launches an instance of the viewer in Stub Viewer Mode whenever a document is loaded.")
        launchOnLoadCheckbutton.grid(row=y, column=0, pady=3, padx=3, sticky=W)
        launchOnLoadLabel.grid(row=y, column=1, columnspan=3, pady=3, padx=3, sticky=W)
        return super().addFields(frame, y)

    def getTitle(self) -> str:
        return "iXBRL Viewer Settings"

    def onConfirm(self) -> None:
        """
        Saves configuration values for saving viewers as well as global viewer behavior settings
        """
        self._cntlrConfig[CONFIG_LAUNCH_ON_LOAD] = self._launchOnLoad.get()
        self._cntlrConfig[CONFIG_SCRIPT_URL] = self._scriptUrl.get()
        self._cntlrConfig[CONFIG_COPY_SCRIPT] = self._copyScript.get()
        for key, var in self._features.items():
            self._cntlrConfig[f'{CONFIG_FEATURE_PREFIX}{key}'] = var.get()
        self.cntlr.saveConfig()
        self.close()

    def reset(self, event: Event[Misc] | None = None) -> None:
        """
        Resets dialog variable values to default values
        """
        self._launchOnLoad.set(DEFAULT_LAUNCH_ON_LOAD)
        self._scriptUrl.set(UNSET_SCRIPT_URL)
        self._copyScript.set(DEFAULT_COPY_SCRIPT)
        for featureConfig in GUI_FEATURE_CONFIGS:
            self._features[featureConfig.key].set(featureConfig.guiDefault)
