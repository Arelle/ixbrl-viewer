# Copyright 2019 Workiva Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

SRC_DIRS = $(wildcard src/*)
DIRS_CMD = $(foreach subdir, $(SRC_DIRS), make-rule/$(subdir))

make-rule/%: fetch-files
	cd $* && $(MAKE) -f ../../Makefile-src viewer

# fetch-sample-files may create new directories, so reinvoke make to get
# SRC_DIRS re-evaluated.
all: 
	./fetch-sample-files.py
	$(MAKE) allsamples

allsamples: $(DIRS_CMD)

.PHONY: fetch-files

