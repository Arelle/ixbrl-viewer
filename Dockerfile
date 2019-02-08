FROM python:3.6 as build

ARG PIP_INDEX_URL
ARG BUILD_ARTIFACTS_TEST=/test_reports/*.xml

COPY requirements-dev.txt ./requirements-dev.txt
COPY requirements.txt ./requirements.txt
RUN pip install -r requirements-dev.txt

# Build Environment Vars
WORKDIR /build/
ADD . /build/

# python tests
RUN mkdir /test_reports
RUN nosetests --with-xunit --xunit-file=/test_reports/results.xml --cover-html tests.unit_tests

# pypi package creation
ARG BUILD_ARTIFACTS_PYPI=/build/dist/*.tar.gz
RUN python setup.py sdist

RUN mkdir /audit/
ARG BUILD_ARTIFACTS_AUDIT=/audit/*

RUN pip freeze > /audit/pip.lock
FROM scratch
