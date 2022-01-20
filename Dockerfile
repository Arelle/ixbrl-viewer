FROM python:3.9-buster as build

ARG PIP_INDEX_URL
ARG NPM_CONFIG__AUTH
ARG NPM_CONFIG_REGISTRY=https://workivaeast.jfrog.io/workivaeast/api/npm/npm-prod/
ARG NPM_CONFIG_ALWAYS_AUTH=true
ARG GIT_TAG

COPY requirements-dev.txt ./requirements-dev.txt
COPY requirements.txt ./requirements.txt
RUN pip install -r requirements-dev.txt

WORKDIR /build/
ADD . /build/

# The following command replaces the version string in setup.py and package.json
# with the tagged version number from GIT_TAG or `0.0.0` if GIT_TAG is not set
ARG VERSION=${GIT_TAG:-0.0.0}
RUN sed -i "s/version='0\.0\.0'/version='$VERSION'/" setup.py
RUN sed -i "s/\"version\": \"0\.0\.0\"/\"version\": \"$VERSION\"/" package.json

# build ixbrlviewer.js
RUN apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_10.x | bash && \
    apt-get install -y nodejs build-essential
RUN npm install
RUN make prod

# javascript tests
RUN npm run test

# lint check .less files
RUN npm run stylelint

# Upload ixbrlviewer.js to github artifacts
ARG BUILD_ARTIFACTS_GITHUB_RELEASE_ASSETS=/build/iXBRLViewerPlugin/viewer/dist/ixbrlviewer.js

# Host ixviewer.js on CDN
RUN mkdir /static_release
RUN tar -czf /static_release/assets.tar.gz -C /build/iXBRLViewerPlugin/viewer/dist/ .
ARG BUILD_ARTIFACTS_CDN=/static_release/assets.tar.gz

# python tests
ARG BUILD_ARTIFACTS_TEST=/test_reports/*.xml
RUN mkdir /test_reports
RUN nosetests --with-xunit --xunit-file=/test_reports/results.xml --cover-html tests.unit_tests

# pypi package creation
ARG BUILD_ARTIFACTS_PYPI=/build/dist/*.tar.gz
RUN python setup.py sdist

# npm package creation
RUN npm pack
ARG BUILD_ARTIFACTS_NPM=/build/*.tgz

ARG BUILD_ARTIFACTS_AUDIT=/audit/*
RUN mkdir /audit/
RUN pip freeze > /audit/pip.lock

FROM scratch
