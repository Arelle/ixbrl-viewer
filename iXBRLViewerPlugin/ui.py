# Copyright 2019 Workiva Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from tkinter import Toplevel, N, E, S, W, EW, StringVar
try:
    from tkinter.ttk import Frame, Button, Label, Entry
except ImportError:
    from ttk import Frame, Button, Label, Entry

import os


class SaveViewerDialog(Toplevel):
    def __init__(self, cntlr):

        super(SaveViewerDialog, self).__init__(cntlr.parent)

        self.cntlr = cntlr
        self.parent = cntlr.parent
        self.accepted = False

        self.title("Save iXBRL Viewer")

        frame = Frame(self)
        self._scriptUrl = StringVar()
        self._scriptUrl.set(self.cntlr.config.setdefault('iXBRLViewerScriptURL', 'dist/js'))
        self._filename = StringVar()
        self._filename.set(self.cntlr.config.setdefault("iXBRLViewerOutputFile",""))

        y = 1

        scriptUrlLabel = Label(frame, text = "Script URL");
        scriptUrlEntry = Entry(frame, textvariable = self._scriptUrl, width=80);

        scriptUrlLabel.grid(row=y, column=0, sticky=W, pady=3, padx=3)
        scriptUrlEntry.grid(row=y, column=1, columnspan=2, sticky=EW, pady=3, padx=3)

        y += 1

        filenameLabel = Label(frame, text = "iXBRL file")
        filenameEntry = Entry(frame, textvariable = self._filename, width=80)
        filenameBrowse = Button(frame, text=_("Browse..."), command=self.browseForFile)

        filenameLabel.grid(row=y, column=0, sticky=W, pady=3, padx=3)
        filenameEntry.grid(row=y, column=1, sticky=EW, pady=3, padx=3)
        filenameBrowse.grid(row=y, column=2, sticky=EW, pady=3, padx=3)

        y += 1

        okButton = Button(frame, text=_("OK"), command=self.ok)
        cancelButton = Button(frame, text=_("Cancel"), command=self.close)
        okButton.grid(row=y, column=1, sticky=E, pady=3)
        cancelButton.grid(row=y, column=2, columnspan=1, sticky=E, pady=3, padx=3)

        frame.grid(row=0, column=0, sticky=(N,E,S,W))
        frame.columnconfigure(1, weight=1)

        window = self.winfo_toplevel()
        window.columnconfigure(0, weight=1)
        #self.geometry("+{0}+{1}".format(dialogX+50,dialogY+100))

        self.bind("<Return>", self.ok)
        self.bind("<Escape>", self.close)

        self.protocol("WM_DELETE_WINDOW", self.close)
        self.grab_set()
        self.wait_window(self)

   
    def close(self, event=None):
        self.parent.focus_set()
        self.destroy()


    def ok(self, event=None):
        self.cntlr.config['iXBRLViewerOutputFile'] = self._filename.get()
        self.cntlr.config['iXBRLViewerScriptURL'] = self._scriptUrl.get()
        self.cntlr.config["iXBRLViewerFileDir"] = os.path.dirname(self._filename.get())
        self.cntlr.saveConfig()
        self.accepted = True
        self.close()

    def cancel(self, event=None):
        self.close()

    def browseForFile(self, event=None):
        instanceFile = self.cntlr.uiFileDialog("save",
                parent=self,
                title=_("arelle - Save iXBRL Viewer Instance"),
                initialdir=self.cntlr.config.setdefault("iXBRLViewerFileDir","."),
                filetypes=[(_("iXBRL report .html"), "*.html")],
                defaultextension=".html")
        self._filename.set(instanceFile)
        pass

    def scriptUrl(self):
        return self._scriptUrl.get()

    def filename(self):
        return self._filename.get()



