# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "Arelle iXBRL Viewer"
copyright = "2019-present Workiva, Inc."
author = "support@arelle.org"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    "autodoc2",
    "myst_parser",
    "sphinx_copybutton",
]

exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

autodoc2_packages = [
    {
        "path": "../../iXBRLViewerPlugin",
        "exclude_dirs": ["dist"],
    }
]
autodoc2_render_plugin = "myst"

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "furo"
html_theme_options = {
    "light_css_variables": {
        "color-brand-primary": "#ac218e",
        "color-brand-content": "#ac218e",
    },
    "dark_css_variables": {
        "color-brand-primary": "#6ecacb",
        "color-brand-content": "#6ecacb",
    },
}
html_title = "iXBRL Viewer <release>"
html_favicon = "_images/favicon.svg"

myst_enable_extensions = [
    "colon_fence",
    "fieldlist",
]
myst_heading_anchors = 6

pygments_style = "xcode"
pygments_dark_style = "monokai"
