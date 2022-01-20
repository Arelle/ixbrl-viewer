import os
from setuptools import setup, find_packages


def get_requirements():
    """
    Get the requirements from a file.

    :return: A list of requirements.
    :rtype: list
    """
    with open('requirements.txt') as f:
        requirements = f.read().splitlines()
        return requirements


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
        'Programming Language :: Python :: 3.9',
    ],
    install_requires=get_requirements(),
)
