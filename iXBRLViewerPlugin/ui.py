# See COPYRIGHT.md for copyright information

from tkinter import Toplevel, N, E, S, W, EW, StringVar, BooleanVar
try:
    from tkinter.ttk import Frame, Button, Label, Entry, Checkbutton
except ImportError:
    from ttk import Frame, Button, Label, Entry, Checkbutton

import os

from .constants import CONFIG_COPY_SCRIPT, CONFIG_FEATURE_PREFIX, CONFIG_FILE_DIRECTORY, \
    CONFIG_LAUNCH_ON_LOAD, CONFIG_OUTPUT_FILE, CONFIG_SCRIPT_URL, CONFIG_ZIP_OUTPUT, \
    DEFAULT_COPY_SCRIPT, DEFAULT_LAUNCH_ON_LOAD, GUI_FEATURE_CONFIGS

UNSET_SCRIPT_URL = ''

class BaseViewerDialog(Toplevel):
    """
    Base class for shared dialog configuration between settings and save dialogs
    """
    def __init__(self, cntlr):
        super(BaseViewerDialog, self).__init__(cntlr.parent)
        self.cntlr = cntlr
        self.parent = cntlr.parent

        self._features = {}
        for featureConfig in GUI_FEATURE_CONFIGS:
            featureVar = BooleanVar()
            featureVar.set(self.cntlr.config.setdefault(f'{CONFIG_FEATURE_PREFIX}{featureConfig.key}', featureConfig.guiDefault))
            self._features[featureConfig.key] = featureVar
        self._scriptUrl = StringVar()
        self._scriptUrl.set(self.cntlr.config.setdefault(CONFIG_SCRIPT_URL, UNSET_SCRIPT_URL))
        self._copyScript = BooleanVar()
        self._copyScript.set(self.cntlr.config.setdefault(CONFIG_COPY_SCRIPT, DEFAULT_COPY_SCRIPT))

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

    def close(self, event=None):
        """
        Closes the dialog.
        """
        self.parent.focus_set()
        self.destroy()

    def confirm(self, event=None):
        """
        Closes the dialog after calling `onConfirm`.
        """
        self.onConfirm()
        self.close(event)

    def getTitle(self) -> str:
        """
        :return: Title of dialog window
        """
        pass

    def onConfirm(self):
        """
        Actions to confirm when "OK" button or "Enter" key are pressed.
        Window is closed immediately after.
        """
        pass

    def render(self):
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

        frame.grid(row=0, column=0, padx=10, pady=10, sticky=(N,E,S,W))
        frame.columnconfigure(1, weight=1)

        window = self.winfo_toplevel()
        window.columnconfigure(0, weight=1)

        self.bind("<Return>", self.confirm)
        self.bind("<Escape>", self.close)

        self.protocol("WM_DELETE_WINDOW", self.close)
        self.grab_set()
        self.wait_window(self)

    def copyScript(self):
        return self._copyScript.get()

    def features(self):
        # Return list of feature keys with corresponding BooleanVar is set to True
        return [feature for feature, value in self._features.items() if value.get()]

    def scriptUrl(self):
        return self._scriptUrl.get()


class SaveViewerDialog(BaseViewerDialog):
    """
    Dialog for saving a viewer instance.
    Initializes with (but doesn't overwrite) default settings configured in the settings dialog.
    """

    def __init__(self, cntlr):
        super(SaveViewerDialog, self).__init__(cntlr)
        self.accepted = False
        self._filename = StringVar()
        self._filename.set(self.cntlr.config.setdefault(CONFIG_OUTPUT_FILE, ""))
        self._zipViewerOutput = BooleanVar()
        self._zipViewerOutput.set(self.cntlr.config.setdefault(CONFIG_ZIP_OUTPUT, False))

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
        return super(SaveViewerDialog, self).addFields(frame, y)

    def browseForFile(self):
        instanceFile = self.cntlr.uiFileDialog(
            "save",
            parent=self,
            title=_("arelle - Save iXBRL Viewer Instance"),
            initialdir=self.cntlr.config.setdefault(CONFIG_FILE_DIRECTORY, "."),
            filetypes=[(_("iXBRL report .html"), "*.html")],
            defaultextension=".html")
        self._filename.set(instanceFile)
        pass

    def getTitle(self) -> str:
        return "Save iXBRL Viewer"

    def onConfirm(self):
        """
        Saves output-specific config values before triggering instance to be saved.
        """
        self.cntlr.config[CONFIG_FILE_DIRECTORY] = os.path.dirname(self.filename())
        self.cntlr.config[CONFIG_OUTPUT_FILE] = self.filename()
        self.cntlr.config[CONFIG_ZIP_OUTPUT] = self.zipViewerOutput()
        self.cntlr.saveConfig()
        self.accepted = True

    def filename(self):
        return self._filename.get()

    def zipViewerOutput(self):
        return self._zipViewerOutput.get()


class SettingsDialog(BaseViewerDialog):
    """
    Dialog for saving default viewer settings.
    """

    def __init__(self, cntlr):
        super(SettingsDialog, self).__init__(cntlr)
        self._launchOnLoad = BooleanVar()
        self._launchOnLoad.set(self.cntlr.config.setdefault(CONFIG_LAUNCH_ON_LOAD, DEFAULT_LAUNCH_ON_LOAD))

    def addButtons(self, frame: Frame, x: int, y: int) -> int:
        """
        Adds reset button before OK button
        """
        x += 1
        resetButton = Button(frame, text=_("Reset Defaults"), command=self.reset)
        resetButton.grid(row=y, column=x, sticky=E, pady=3, padx=30)
        return super(SettingsDialog, self).addButtons(frame, x, y)

    def addFields(self, frame: Frame, y: int) -> int:
        """
        Adds launch-on-load checkbox above other settings
        """
        y += 1
        launchOnLoadCheckbutton = Checkbutton(frame, text="Launch on Load", variable=self._launchOnLoad, onvalue=True, offvalue=False)
        launchOnLoadLabel = Label(frame, text="Launches an instance of the viewer in Stub Viewer Mode whenever a document is loaded.")
        launchOnLoadCheckbutton.grid(row=y, column=0, pady=3, padx=3, sticky=W)
        launchOnLoadLabel.grid(row=y, column=1, columnspan=3, pady=3, padx=3, sticky=W)
        return super(SettingsDialog, self).addFields(frame, y)

    def getTitle(self) -> str:
        return "iXBRL Viewer Settings"

    def onConfirm(self):
        """
        Saves configuration values for saving viewers as well as global viewer behavior settings
        """
        self.cntlr.config[CONFIG_LAUNCH_ON_LOAD] = self._launchOnLoad.get()
        self.cntlr.config[CONFIG_SCRIPT_URL] = self._scriptUrl.get()
        self.cntlr.config[CONFIG_COPY_SCRIPT] = self._copyScript.get()
        for key, var in self._features.items():
            self.cntlr.config[f'{CONFIG_FEATURE_PREFIX}{key}'] = var.get()
        self.cntlr.saveConfig()
        self.close()

    def reset(self, event=None):
        """
        Resets dialog variable values to default values
        """
        self._launchOnLoad.set(DEFAULT_LAUNCH_ON_LOAD)
        self._scriptUrl.set(UNSET_SCRIPT_URL)
        self._copyScript.set(DEFAULT_COPY_SCRIPT)
        for featureConfig in GUI_FEATURE_CONFIGS:
            self._features[featureConfig.key].set(featureConfig.guiDefault)
