FROM node:19-slim as node-build

ARG NPM_CONFIG__AUTH
ARG NPM_CONFIG_REGISTRY=https://workivaeast.jfrog.io/workivaeast/api/npm/npm-prod/
ARG NPM_CONFIG_ALWAYS_AUTH=true
ARG GIT_TAG

RUN reg=$(echo "$NPM_CONFIG_REGISTRY" | cut -d ":" -f 2) && \
    echo "$reg:_auth = $NPM_CONFIG__AUTH" > /.npmrc && \
    echo "registry = $NPM_CONFIG_REGISTRY" >> /.npmrc && \
    echo "always-auth = true" >> /.npmrc
ARG NPM_CONFIG_USERCONFIG=/.npmrc


WORKDIR /build/

COPY package.json /build/
RUN npm install --include=dev

COPY . /build/

# The following command replaces the version string in package.json
ARG VERSION=${GIT_TAG:-0.0.0}
RUN sed -i "s/\"version\": \"0\.0\.0\"/\"version\": \"$VERSION\"/" package.json

# lint check .less files
RUN npm run stylelint

# javascript tests
RUN npm run test

# build ixbrlviewer.js
RUN npm run prod

# Upload ixbrlviewer.js to github artifacts
ARG BUILD_ARTIFACTS_GITHUB_RELEASE_ASSETS=/build/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js

# Host ixviewer.js on CDN
RUN mkdir /static_release
RUN tar -czf /static_release/assets.tar.gz -C /build/iXBRLViewerPlugin/viewer/dist/ .
ARG BUILD_ARTIFACTS_CDN=/static_release/assets.tar.gz

# npm package creation
RUN npm pack
ARG BUILD_ARTIFACTS_NPM=/build/*.tgz

FROM python:3.9-slim-bullseye as python-build

ARG PIP_INDEX_URL

WORKDIR /build/

RUN apt update -y
RUN apt-get install git -y

COPY . /build/
RUN pip install -U pip setuptools && \
    pip install .[dev]

COPY --from=node-build /build/iXBRLViewerPlugin/viewer/dist /build/iXBRLViewerPlugin/viewer/dist

# python tests
ARG BUILD_ARTIFACTS_TEST=/test_reports/*.xml
RUN mkdir /test_reports
RUN nose2 --plugin nose2.plugins.junitxml --junit-xml-path ../test_reports/results.xml

# pypi package creation
ARG BUILD_ARTIFACTS_PYPI=/build/dist/*.tar.gz
RUN pip install build && python -m build

ARG BUILD_ARTIFACTS_AUDIT=/audit/*
RUN mkdir /audit/
RUN pip freeze > /audit/pip.lock

FROM scratch
