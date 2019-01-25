FROM python:3.6 as build

ARG PIP_INDEX_URL

# Build Environment Vars
WORKDIR /build/
ADD . /build/
ARG BUILD_ARTIFACTS_PYPI=/build/dist/*.tar.gz
RUN python setup.py sdist

RUN mkdir /audit/
ARG BUILD_ARTIFACTS_AUDIT=/audit/*

RUN pip freeze > /audit/pip.lock
FROM scratch
