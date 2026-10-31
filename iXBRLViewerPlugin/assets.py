# See COPYRIGHT.md for copyright information

from __future__ import annotations

import io
import os
import posixpath
import re
import urllib.parse
import zipfile
from collections.abc import Iterator
from types import TracebackType
from typing import IO, TYPE_CHECKING, NamedTuple

from arelle.UrlUtil import isHttpUrl
from lxml import etree

if TYPE_CHECKING:
    from arelle.FileSource import FileSource

XHTML_NAMESPACE = "{http://www.w3.org/1999/xhtml}"

# Attributes holding the URL of a file that the browser loads to render the element.
ASSET_ATTRIBUTES = {
    f"{XHTML_NAMESPACE}img": ("src", "srcset"),
    f"{XHTML_NAMESPACE}source": ("src", "srcset"),
    f"{XHTML_NAMESPACE}object": ("data",),
    f"{XHTML_NAMESPACE}link": ("href",),
}

# Report and taxonomy documents are read by Arelle rather than the browser,
# and scripts are never loaded through the references we follow.
NON_ASSET_EXTENSIONS = (".htm", ".html", ".xhtml", ".xbrl", ".json", ".xml", ".xsd", ".js")

CSS_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
CSS_REFERENCE = re.compile(
    r"""url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s"')]*))\s*\)"""
    r"""|@import\s*(?:"([^"]*)"|'([^']*)')""",
    re.IGNORECASE,
)


class ReportAsset(NamedTuple):
    """A file referenced by a report document that is copied into the viewer output."""
    # Path relative to the viewer documents, with "/" separators.
    path: str
    # Zip containing the file, or None for a file on disk.  A zip that Arelle
    # read into memory is kept as its stream, as there is no path to reopen.
    archive: str | IO[bytes] | None
    # Member name in the zip, or path on disk.
    source: str


def cssReferences(css: str) -> Iterator[str]:
    """Yield the URLs referenced by url() and @import in a stylesheet."""
    for match in CSS_REFERENCE.finditer(CSS_COMMENT.sub("", css)):
        yield "".join(group for group in match.groups() if group is not None)


def documentReferences(xmlDocument: etree._ElementTree[etree._Element]) -> Iterator[str]:
    """Yield the URLs of the files that the browser loads to render an XHTML document."""
    for element in xmlDocument.getroot().iter(tag=etree.Element):
        if (style := element.get("style")) is not None:
            yield from cssReferences(style)
        if element.tag == f"{XHTML_NAMESPACE}style" and element.text is not None:
            yield from cssReferences(element.text)
        for attribute in ASSET_ATTRIBUTES.get(str(element.tag), ()):
            value = element.get(attribute)
            if value is None:
                continue
            if attribute == "srcset":
                # Each comma separated candidate is a URL, optionally followed by a size.
                yield from (candidate.split()[0] for candidate in value.split(",") if candidate.strip())
            else:
                yield value


def assetPath(baseDirectory: str, reference: str) -> str | None:
    """
    Resolve a reference against a "/" separated directory relative to the document.
    Returns None for references that aren't to local files, such as URLs with a
    host or scheme, data URIs and fragments.  The result may point outside the
    document's directory, so check it with isSafeAssetPath before use.
    """
    # Browsers treat backslashes in URLs as path separators.
    reference = reference.strip().replace("\\", "/")
    try:
        url = urllib.parse.urlsplit(reference)
    except ValueError:
        return None
    if url.netloc or len(url.scheme) > 1 or url.path == "":
        return None
    # A one letter scheme is a Windows drive, so keep it for isSafeAssetPath to reject.
    path = reference if url.scheme else urllib.parse.unquote(url.path)
    return posixpath.normpath(posixpath.join(baseDirectory, path))


def isSafeAssetPath(path: str) -> bool:
    """True if path is a normalized relative path that stays inside the directory it is written to."""
    return (
        path not in ("", ".", "..")
        and posixpath.normpath(path) == path
        and not path.startswith(("/", "../"))
        and not any(character in path for character in ("\\", ":", "\0"))
    )


def isInsideDirectory(path: str, directory: str) -> bool:
    """True if path is inside directory once symbolic links are resolved."""
    realDirectory = os.path.realpath(directory)
    try:
        return os.path.commonpath([os.path.realpath(path), realDirectory]) == realDirectory
    except ValueError:
        # Paths on different Windows drives
        return False


class DirectoryAssetSource:
    """Finds the files referenced by a document stored on disk."""

    def __init__(self, directory: str) -> None:
        self.directory = directory

    def find(self, path: str) -> ReportAsset | None:
        filepath = os.path.join(self.directory, *path.split("/"))
        # A symbolic link could otherwise expose files from elsewhere on disk.
        if not os.path.isfile(filepath) or not isInsideDirectory(filepath, self.directory):
            return None
        return ReportAsset(path, None, filepath)


class ZipAssetSource:
    """Finds the files referenced by a document stored in a zip."""

    def __init__(self, archive: str | IO[bytes], directory: str, memberNames: list[str]) -> None:
        self.archive = archive
        self.directory = directory
        # Zips written on Windows may use backslashes as separators.
        self.members = {name.replace("\\", "/"): name for name in memberNames}

    def find(self, path: str) -> ReportAsset | None:
        member = self.members.get(posixpath.normpath(posixpath.join(self.directory, path)))
        if member is None:
            return None
        return ReportAsset(path, self.archive, member)


AssetSource = DirectoryAssetSource | ZipAssetSource


def assetSource(fileSource: FileSource, docFilepath: str, docUri: str) -> AssetSource | None:
    """
    Where to find the files referenced by a document, or None if they can't be copied.
    Remote documents aren't supported, as fetching every reference would let a
    report make requests from the machine generating the viewer.
    """
    archiveFileSource = fileSource.fileSourceContainingFilepath(docFilepath)
    if archiveFileSource is None:
        if isHttpUrl(docUri):
            return None
        return DirectoryAssetSource(os.path.dirname(docFilepath))
    zipFile = archiveFileSource.fs
    if not isinstance(zipFile, zipfile.ZipFile) or zipFile.fp is None:
        return None
    archive: str | IO[bytes]
    # Arelle closes its zip before the viewer is saved, so keep something that can be reopened.
    if isinstance(zipFile.fp, io.BytesIO):
        archive = zipFile.fp
    elif zipFile.filename is not None and os.path.isfile(zipFile.filename):
        archive = zipFile.filename
    else:
        return None
    # Documents in a remote zip have paths starting with its URL rather than its cached file.
    for base in (archiveFileSource.basefile, archiveFileSource.baseurl):
        if isinstance(base, str) and docFilepath.startswith(base):
            member = docFilepath[len(base) + 1:].replace("\\", "/")
            return ZipAssetSource(archive, posixpath.dirname(member), zipFile.namelist())
    return None


class AssetReader:
    """Opens report assets for reading, keeping each zip open until the reader is closed."""

    def __init__(self) -> None:
        self.zipFiles: dict[str | IO[bytes], zipfile.ZipFile] = {}

    def open(self, asset: ReportAsset) -> IO[bytes]:
        if asset.archive is None:
            return open(asset.source, "rb")
        zipFile = self.zipFiles.get(asset.archive)
        if zipFile is None:
            zipFile = self.zipFiles[asset.archive] = zipfile.ZipFile(asset.archive)
        return zipFile.open(asset.source)

    def close(self) -> None:
        for zipFile in self.zipFiles.values():
            zipFile.close()
        self.zipFiles.clear()

    def __enter__(self) -> AssetReader:
        return self

    def __exit__(
        self,
        excType: type[BaseException] | None,
        excValue: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()
