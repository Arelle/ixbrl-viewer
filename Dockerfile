FROM python:3.6 as build

ARG PIP_INDEX_URL

# Build Environment Vars
ARG BUILD_ID
ARG BUILD_NUMBER
ARG BUILD_URL
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG GIT_TAG
ARG GIT_COMMIT_RANGE
ARG GIT_HEAD_URL
ARG GIT_MERGE_HEAD
ARG GIT_MERGE_BRANCH
WORKDIR /build/
ADD . /build/
ARG BUILD_ARTIFACTS_PYPI=/build/dist/*.tar.gz
ARG BUILD_ARTIFACTS_RELEASE=/build/dist/*.tar.gz
RUN python setup.py sdist

RUN mkdir /audit/
ARG BUILD_ARTIFACTS_AUDIT=/audit/*

RUN pip freeze > /audit/pip.lock
FROM scratch
