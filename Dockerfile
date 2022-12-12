FROM node:16-slim as node-build

# ARG NPM_CONFIG__AUTH
# ARG NPM_CONFIG_REGISTRY=https://workivaeast.jfrog.io/workivaeast/api/npm/npm-prod/
# ARG NPM_CONFIG_ALWAYS_AUTH=true
ARG GIT_TAG
ARG NPM_CONFIG_USERCONFIG

WORKDIR /build/
COPY . /build/ 
RUN echo `cat /build/$NPM_CONFIG_USERCONFIG`

# RUN echo $NPM_CONFIG_REGISTRY
# RUN echo $NPM_CONFIG__AUTH


COPY package.json /build/
RUN npm version
RUN npm update --location=global 
RUN npm version
RUN npm install --include=dev


# The following command replaces the version string in package.json
ARG VERSION=${GIT_TAG:-0.0.0}
RUN sed -i "s/\"version\": \"0\.0\.0\"/\"version\": \"$VERSION\"/" package.json

# lint check .less files
RUN npm run stylelint

# javascript tests
RUN npm run test

# build ixbrlviewer.js
RUN npm run prod
#MOVE AFTER WORKIDIR /build/
# Upload ixbrlviewer.js to github artifacts
ARG BUILD_ARTIFACTS_GITHUB_RELEASE_ASSETS=/build/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js

# Host ixviewer.js on CDN
RUN mkdir /static_release
RUN tar -czf /static_release/assets.tar.gz -C /build/iXBRLViewerPlugin/viewer/dist/ .
ARG BUILD_ARTIFACTS_CDN=/static_release/assets.tar.gz

# npm package creation
RUN npm pack
ARG BUILD_ARTIFACTS_NPM=/build/*.tgz

FROM python:3.9-slim as python-build

ARG PIP_INDEX_URL
ARG GIT_TAG

WORKDIR /build/

COPY requirements*.txt /build/
RUN pip install -U pip setuptools && \
    pip install -r requirements-dev.txt

COPY . /build/
COPY --from=node-build /build/iXBRLViewerPlugin/viewer/dist /build/iXBRLViewerPlugin/viewer/dist

# The following command replaces the version string in setup.py
ARG VERSION=${GIT_TAG:-0.0.0}
RUN sed -i "s/version='0\.0\.0'/version='$VERSION'/" setup.py

# python tests
ARG BUILD_ARTIFACTS_TEST=/test_reports/*.xml
RUN mkdir /test_reports
RUN nosetests --with-xunit --xunit-file=/test_reports/results.xml --cover-html tests.unit_tests

# pypi package creation
ARG BUILD_ARTIFACTS_PYPI=/build/dist/*.tar.gz
RUN python setup.py sdist

ARG BUILD_ARTIFACTS_AUDIT=/audit/*
RUN mkdir /audit/
RUN pip freeze > /audit/pip.lock

FROM scratch
