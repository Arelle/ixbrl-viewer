import os
from setuptools import setup, find_packages

setup(
    name='ixbrl_viewer',
    version='0.0.0',
    description='The Workiva iXBRL Viewer allows iXBRL reports to be viewed interactively in a web browser',
    long_description=open('README.md').read(),
    url='https://github.com/workiva/ixbrl-viewer',
    author='Workiva',
    author_email='dave.casleton@workiva.com',
    include_package_data=True,
    packages=find_packages(),
    classifiers=[
        'License :: OSI Approved :: Apache License, Version 2.0 (Apache-2.0)',
        'Copyright :: Workiva Inc. :: 2019'
        'Programming Language :: Python :: 3.6',
    ],
    install_requires=[
        'isodate==0.6.0',
        'numpy==1.19.0',
        'pycountry==19.8.18'
    ],
)
