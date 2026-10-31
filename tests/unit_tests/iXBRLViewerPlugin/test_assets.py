import io
import os
import zipfile
from pathlib import Path
from unittest.mock import Mock

import pytest
from arelle.FileSource import FileNamedBytesIO, FileSource, openFileSource
from lxml import etree

from .mock_arelle import mock_arelle

mock_arelle()

from iXBRLViewerPlugin.assets import (
    ReportAsset,
    assetPath,
    cssReferences,
    documentReferences,
    isSafeAssetPath,
)
from iXBRLViewerPlugin.iXBRLViewer import IXBRLViewerBuilder

OUTPUT_MODES = ["directory", "file", "zip", "bytesio", "stub"]

PNG = b"\x89PNG\r\n\x1a\nnot really a png"


def xhtml(body="", head=""):
    return f'<html xmlns="http://www.w3.org/1999/xhtml"><head>{head}</head><body>{body}</body></html>'.encode()


def writeFiles(directory, files):
    for name, content in files.items():
        path = Path(directory, *name.split("/"))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def zipBytes(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as z:
        for name, content in files.items():
            z.writestr(name, content)
    return stream.getvalue()


def inlineDoc(filepath, content, uri=None):
    return Mock(
        filepath=filepath,
        uri=uri or filepath,
        xmlDocument=etree.ElementTree(etree.fromstring(content)),
    )


def buildViewer(fileSource, docs, useStubViewer=False):
    """Build a viewer from (filename, doc) pairs, returning it with the mock controller used for logging."""
    cntlr = Mock()
    builder = IXBRLViewerBuilder(cntlr, useStubViewer=useStubViewer)
    for filename, doc in docs:
        builder.addDocument(Mock(fileSource=fileSource), filename, doc)
    return builder.createViewer(showValidations=False), cntlr


def save(iv, mode, outDirectory):
    """Save the viewer in the given output mode and return the saved files, by path relative to the output."""
    outDirectory.mkdir(exist_ok=True)
    if mode in ("directory", "stub"):
        iv.save(str(outDirectory))
    elif mode == "file":
        iv.save(str(outDirectory / "viewer.html"))
    elif mode == "zip":
        iv.save(str(outDirectory / "viewer.zip"), zipOutput=True)
        with zipfile.ZipFile(outDirectory / "viewer.zip") as z:
            return {name: z.read(name) for name in z.namelist()}
    elif mode == "bytesio":
        stream = io.BytesIO()
        iv.save(stream)
        with zipfile.ZipFile(stream) as z:
            return {name: z.read(name) for name in z.namelist()}
    return {
        path.relative_to(outDirectory).as_posix(): path.read_bytes()
        for path in outDirectory.rglob("*")
        if path.is_file()
    }


def filesUnder(directory):
    return sorted(path.relative_to(directory).as_posix() for path in Path(directory).rglob("*"))


def loggedMessages(cntlr):
    return [call.args[0] for call in cntlr.addToLog.call_args_list]


def symlinkOrSkip(target, link):
    try:
        os.symlink(target, link, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("Symbolic links are not available")


class TestReferences:

    def test_documentReferences(self):
        doc = etree.ElementTree(etree.fromstring(xhtml(
            head='<link rel="stylesheet" href="css/a.css"/>'
                 '<style>/* url(commented.png) */ .x { background: url("style.png") }</style>',
            body='<img src="img.png" srcset="small.png 1x, big.png 2x"/>'
                 '<picture><source srcset="pic.webp"/></picture>'
                 '<object data="chart.svg"/>'
                 '<div style="background-image: url(attr.png)"/>'
                 '<a href="link.pdf">not followed</a>',
        )))
        assert list(documentReferences(doc)) == [
            "css/a.css", "style.png", "img.png", "small.png", "big.png", "pic.webp", "chart.svg", "attr.png",
        ]

    def test_cssReferences(self):
        css = """
            @import "a.css"; @import 'b.css'; @import url(c.css);
            .x { background: url( d.png ) } .y { background: URL('e f.png') }
            /* .z { background: url(ignored.png) } */
            @font-face { src: url("g.woff2") format("woff2") }
        """
        assert list(cssReferences(css)) == ["a.css", "b.css", "c.css", "d.png", "e f.png", "g.woff2"]

    @pytest.mark.parametrize("reference, expected", [
        ("logo.png", "logo.png"),
        ("./images/logo.png", "images/logo.png"),
        ("images/big%20one.png?v=1#x", "images/big one.png"),
        ("images\\logo.png", "images/logo.png"),
        ("https://example.com/logo.png", None),
        ("//example.com/logo.png", None),
        ("data:image/png;base64,AAAA", None),
        ("file:///etc/passwd", None),
        ("#fragment", None),
        ("", None),
    ])
    def test_assetPath(self, reference, expected):
        assert assetPath("", reference) == expected

    def test_assetPath_resolves_against_base_directory(self):
        assert assetPath("css", "../images/bg.png") == "images/bg.png"
        assert assetPath("css", "../../bg.png") == "../bg.png"

    @pytest.mark.parametrize("reference", [
        "../logo.png",
        "../../../../home/u/.bashrc",
        "images/../../logo.png",
        "%2e%2e/%2e%2e/logo.png",
        "..\\..\\logo.png",
        "/etc/passwd",
        "C:/Windows/win.ini",
        "C:logo.png",
        "C:\\logo.png",
        "..",
    ])
    def test_hostile_references_are_unsafe(self, reference):
        assert not isSafeAssetPath(assetPath("", reference))

    @pytest.mark.parametrize("path", ["", ".", "./a.png", "a//b.png", "a/", "a\\b.png", "a:b.png", "a\0.png"])
    def test_unnormalized_paths_are_unsafe(self, path):
        assert not isSafeAssetPath(path)


class TestCollection:

    def test_zip_report_package(self, tmp_path):
        report = xhtml(
            head='<link rel="stylesheet" href="css/a.css"/>',
            body='<img src="images/logo.png"/><img src="flat.png"/><img src="missing.png"/>'
                 '<img src="report.xsd"/><img src="../outside.png"/>',
        )
        zipPath = tmp_path / "package.zip"
        zipPath.write_bytes(zipBytes({
            "pkg/reports/report.xhtml": report,
            "pkg/reports/css/a.css": b'@import "b.css"; .x { background: url(../images/css-only.png) }',
            "pkg/reports/css/b.css": b'@import "a.css"; @font-face { src: url(../fonts/f.woff2) }',
            "pkg/reports/images/logo.png": PNG,
            "pkg/reports/images/css-only.png": PNG,
            "pkg/reports/images/unreferenced.png": PNG,
            "pkg/reports/fonts/f.woff2": b"font",
            "pkg/reports/flat.png": PNG,
            "pkg/reports/report.xsd": b"<schema/>",
            "pkg/outside.png": PNG,
        }))
        docPath = f"{zipPath}/pkg/reports/report.xhtml"
        fileSource = openFileSource(docPath, None)
        iv, cntlr = buildViewer(fileSource, [("report.xhtml", inlineDoc(docPath, report))])

        assert sorted(iv.assetsByPath) == [
            "css/a.css", "css/b.css", "flat.png", "fonts/f.woff2", "images/css-only.png", "images/logo.png",
        ]
        assert iv.assetsByPath["images/logo.png"] == ReportAsset("images/logo.png", str(zipPath), "pkg/reports/images/logo.png")
        messages = loggedMessages(cntlr)
        assert "Not copying missing.png, as there is no such file in the report's directory" in messages
        assert "Not copying ../outside.png, as it is outside the report's directory" in messages

    def test_directory_input_without_basefile(self, tmp_path):
        report = xhtml('<img src="logo.png"/><img src="images/a.png"/>')
        writeFiles(tmp_path / "src", {
            "report.htm": report,
            "logo.png": PNG,
            "images/a.png": PNG,
            "unreferenced.png": PNG,
        })
        docPath = str(tmp_path / "src" / "report.htm")
        fileSource = FileSource(docPath)
        assert not hasattr(fileSource, "basefile")
        iv, cntlr = buildViewer(fileSource, [("report.htm", inlineDoc(docPath, report))])

        assert iv.assetsByPath == {
            "logo.png": ReportAsset("logo.png", None, str(tmp_path / "src" / "logo.png")),
            "images/a.png": ReportAsset("images/a.png", None, str(tmp_path / "src" / "images" / "a.png")),
        }

    def test_remote_document_is_skipped(self):
        doc = inlineDoc("/cache/https/example.com/report.htm", xhtml('<img src="logo.png"/>'), uri="https://example.com/report.htm")
        iv, cntlr = buildViewer(FileSource("https://example.com/report.htm"), [("report.htm", doc)])
        assert iv.assetsByPath == {}
        assert "Not copying files referenced by https://example.com/report.htm, as it is not a local file or in a zip" in loggedMessages(cntlr)

    def test_symbolic_link_out_of_source_directory_is_not_followed(self, tmp_path):
        writeFiles(tmp_path, {"secret/key.png": PNG, "src/report.htm": b""})
        symlinkOrSkip(tmp_path / "secret", tmp_path / "src" / "images")
        docPath = str(tmp_path / "src" / "report.htm")
        iv, cntlr = buildViewer(FileSource(docPath), [("report.htm", inlineDoc(docPath, xhtml('<img src="images/key.png"/>')))])
        assert iv.assetsByPath == {}

    def test_documents_in_different_directories(self, tmp_path):
        writeFiles(tmp_path, {
            "a/img/shared.png": b"from a",
            "b/sub/img/shared.png": b"from b",
            "b/sub/img/only-b.png": PNG,
        })
        docA = inlineDoc(str(tmp_path / "a" / "doc-a.xhtml"), xhtml('<img src="img/shared.png"/>'))
        docB = inlineDoc(str(tmp_path / "b" / "sub" / "doc-b.xhtml"), xhtml('<img src="img/shared.png"/><img src="img/only-b.png"/>'))
        iv, cntlr = buildViewer(FileSource(docA.filepath), [("doc-a.xhtml", docA), ("doc-b.xhtml", docB)])

        files = save(iv, "directory", tmp_path / "out")
        assert sorted(files) == ["doc-a.xhtml", "doc-b.xhtml", "img/only-b.png", "img/shared.png"]
        # The first document to use a path decides which file is copied there.
        assert files["img/shared.png"] == b"from a"
        assert any(message.startswith("Not copying") and "img/shared.png" in message for message in loggedMessages(cntlr))

    def test_same_file_from_several_reports_is_saved_once(self, tmp_path):
        writeFiles(tmp_path / "src", {"logo.png": PNG})
        doc = inlineDoc(str(tmp_path / "src" / "report.htm"), xhtml('<img src="logo.png"/><img src="./logo.png"/>'))
        cntlr = Mock()
        builder = IXBRLViewerBuilder(cntlr)
        for _ in range(2):
            builder.addDocument(Mock(fileSource=FileSource(doc.filepath)), "report.htm", doc)
        iv = builder.createViewer(showValidations=False)

        stream = io.BytesIO()
        iv.save(stream)
        with zipfile.ZipFile(stream) as z:
            assert z.namelist() == ["xbrlviewer.html", "logo.png"]
        assert not any("Not copying" in message for message in loggedMessages(cntlr))


class TestSave:

    @pytest.fixture
    def zipReport(self, tmp_path):
        """A report in a zip, with a hostile entry name, whose file source is closed before saving."""
        zipPath = tmp_path / "src" / "report.zip"
        zipPath.parent.mkdir()
        zipPath.write_bytes(zipBytes({
            "x/reports/report.xhtml": b"",
            "x/reports/images/logo.png": PNG,
            "x/reports/flat.png": b"flat",
            "x/reports/../../../../evil.png": b"evil",
            "x/../evil.png": b"evil",
        }))
        docPath = f"{zipPath}/x/reports/report.xhtml"
        fileSource = openFileSource(docPath, None)
        doc = inlineDoc(docPath, xhtml(
            '<img src="images/logo.png"/><img src="flat.png"/>'
            '<img src="../../../../evil.png"/><img src="../evil.png"/><img src="/evil.png"/><img src="C:/evil.png"/>'
        ))
        return fileSource, doc

    @pytest.mark.parametrize("mode", OUTPUT_MODES)
    def test_zip_input_in_every_output_mode(self, tmp_path, zipReport, mode):
        fileSource, doc = zipReport
        iv, cntlr = buildViewer(fileSource, [("report.xhtml", doc)], useStubViewer=mode == "stub")
        fileSource.close()

        files = save(iv, mode, tmp_path / "out")
        if mode in ("zip", "bytesio"):
            assert list(files)[0] == "xbrlviewer.html"
        assert files["images/logo.png"] == PNG
        assert files["flat.png"] == b"flat"
        assert not any("evil" in name for name in files)
        assert [path for path in filesUnder(tmp_path) if not path.startswith("out")] == ["src", "src/report.zip"]

    @pytest.mark.parametrize("mode", OUTPUT_MODES)
    def test_in_memory_zip_input_in_every_output_mode(self, tmp_path, mode):
        upload = FileNamedBytesIO("upload.zip", zipBytes({
            "reports/report.xhtml": b"",
            "reports/images/logo.png": PNG,
        }))
        fileSource = openFileSource("reports/report.xhtml", None, sourceZipStream=upload)
        doc = inlineDoc(f"{fileSource.basefile}/reports/report.xhtml", xhtml('<img src="images/logo.png"/>'))
        iv, cntlr = buildViewer(fileSource, [("report.xhtml", doc)], useStubViewer=mode == "stub")
        fileSource.close()

        assert save(iv, mode, tmp_path / "out")["images/logo.png"] == PNG

    @pytest.mark.parametrize("mode", OUTPUT_MODES)
    def test_hostile_asset_paths_are_not_written_in_any_output_mode(self, tmp_path, mode):
        source = tmp_path / "src" / "asset.png"
        writeFiles(tmp_path / "src", {"asset.png": PNG, "report.htm": b""})
        iv, cntlr = buildViewer(FileSource(str(tmp_path / "src" / "report.htm")), [
            ("report.htm", inlineDoc(str(tmp_path / "src" / "report.htm"), xhtml())),
        ], useStubViewer=mode == "stub")
        hostilePaths = [
            "../evil.png", "../../evil.png", "a/../../evil.png", "/evil.png", str(tmp_path / "evil.png"),
            "C:/evil.png", "C:evil.png", "..\\evil.png", "", ".",
        ]
        viewerNames = ["xbrlviewer.html", "XBRLViewer.HTML", "viewer.html", "ixbrlviewer.html", "report.htm"]
        for path in hostilePaths + viewerNames + ["ok.png"]:
            iv.assetsByPath[path] = ReportAsset(path, None, str(source))

        files = save(iv, mode, tmp_path / "out")
        assert files["ok.png"] == PNG
        assert not any("evil" in name or name in ("", ".") for name in files)
        assert [path for path in filesUnder(tmp_path) if not path.startswith("out")] == ["src", "src/asset.png", "src/report.htm"]
        savedViewerNames = {"file": ["viewer.html"], "stub": ["ixbrlviewer.html", "report.htm"]}.get(mode, ["xbrlviewer.html"])
        assert all(files[name] != PNG for name in savedViewerNames)
        assert "XBRLViewer.HTML" not in files
        assert sum(message.startswith("Not writing asset") for message in loggedMessages(cntlr)) >= len(hostilePaths)

    @pytest.mark.parametrize("mode", ["directory", "file"])
    def test_symbolic_link_in_output_directory_is_not_followed(self, tmp_path, mode):
        writeFiles(tmp_path / "src", {"images/logo.png": PNG})
        (tmp_path / "elsewhere").mkdir()
        (tmp_path / "out").mkdir()
        symlinkOrSkip(tmp_path / "elsewhere", tmp_path / "out" / "images")
        doc = inlineDoc(str(tmp_path / "src" / "report.htm"), xhtml('<img src="images/logo.png"/>'))
        iv, cntlr = buildViewer(FileSource(doc.filepath), [("report.htm", doc)])

        save(iv, mode, tmp_path / "out")
        assert filesUnder(tmp_path / "elsewhere") == []

    @pytest.mark.parametrize("mode", ["directory", "file"])
    def test_saving_into_the_source_directory(self, tmp_path, mode):
        writeFiles(tmp_path / "src", {"logo.png": PNG, "images/a.png": b"nested"})
        doc = inlineDoc(str(tmp_path / "src" / "report.htm"), xhtml('<img src="logo.png"/><img src="images/a.png"/>'))
        iv, cntlr = buildViewer(FileSource(doc.filepath), [("report.htm", doc)])

        save(iv, mode, tmp_path / "src")
        assert (tmp_path / "src" / "logo.png").read_bytes() == PNG
        assert (tmp_path / "src" / "images" / "a.png").read_bytes() == b"nested"
        assert not any(call.kwargs.get("messageCode") == "viewer:error" for call in cntlr.addToLog.call_args_list)

    def test_append_to_existing_zip_stream(self, tmp_path):
        writeFiles(tmp_path / "src", {"logo.png": PNG, "new.png": PNG})
        doc = inlineDoc(str(tmp_path / "src" / "report.htm"), xhtml('<img src="logo.png"/><img src="new.png"/>'))
        iv, cntlr = buildViewer(FileSource(doc.filepath), [("report.htm", doc)])
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as z:
            z.writestr("other-plugin.txt", "x")
            z.writestr("logo.png", "written by another plugin")

        iv.save(stream)
        with zipfile.ZipFile(stream) as z:
            assert z.namelist() == ["other-plugin.txt", "logo.png", "xbrlviewer.html", "new.png"]
            assert z.read("logo.png") == b"written by another plugin"
