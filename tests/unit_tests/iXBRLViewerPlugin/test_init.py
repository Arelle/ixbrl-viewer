import subprocess
import sys
import textwrap


def test_import_without_tkinter() -> None:
    """Verify the module can be imported without tkinter available.

    This test ensures that the iXBRLViewerPlugin can be loaded on headless
    servers that don't have tkinter installed. tkinter is only needed when
    GUI hooks are actually called.
    """
    code = textwrap.dedent("""
        import sys
        sys.modules['tkinter'] = None  # Block tkinter imports
        import iXBRLViewerPlugin
        assert 'name' in iXBRLViewerPlugin.__pluginInfo__
    """)
    subprocess.run([sys.executable, '-c', code], check=True)
