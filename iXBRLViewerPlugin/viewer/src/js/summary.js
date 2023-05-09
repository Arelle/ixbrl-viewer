// Copyright 2023 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export const DIMENSIONS_KEY = "dimensions";
export const MEMBERS_KEY = "members";
export const PRIMARY_ITEMS_KEY = "primaryItems";
export const TOTAL_KEY = "total";


class TagCounter {
    constructor() {
        this._dimensions = new Set();
        this._members = new Set();
        this._primaryItems = new Set();
    }

    addDimension(dimension) {
        this._dimensions.add(dimension);
    }

    addMember(member) {
        this._members.add(member);
    }

    addPrimaryItem(primaryItem) {
        this._primaryItems.add(primaryItem);
    }

    getCounts() {
        return {
            [DIMENSIONS_KEY]: this._dimensions.size,
            [MEMBERS_KEY]: this._members.size,
            [PRIMARY_ITEMS_KEY]: this._primaryItems.size,
            [TOTAL_KEY]: this._dimensions.size + this._members.size + this._primaryItems.size
        }
    }
}

export class DocumentSummary {
    constructor(report) {
        this._report = report;
    }

    _getTagCounter(tagCounts, element) {
        const colonIndex = element.indexOf(":");
        if (colonIndex === -1) {
            throw new Error(`Element ${element} is not a concept.`);
        }
        const prefix = element.substring(0, colonIndex);
        if (!tagCounts.has(prefix)) {
            tagCounts.set(prefix, new TagCounter());
        }
        return tagCounts.get(prefix);
    }

    _buildTagCounts() {
        const tagCounts = new Map();
        for (const fact of this._report.facts()) {
            let counter = this._getTagCounter(tagCounts, fact.conceptName());
            counter.addPrimaryItem(fact.conceptName());
            for (const [dimension, member] of Object.entries(fact.dimensions())) {
                counter = this._getTagCounter(tagCounts, dimension);
                counter.addDimension(dimension);

                const dimensionConcept = this._report.getConcept(dimension);
                if (dimensionConcept.isTypedDimension()) {
                    const typedDomainElement = dimensionConcept.typedDomainElement();
                    if (typedDomainElement) {
                        counter = this._getTagCounter(tagCounts, typedDomainElement);
                        counter.addMember(typedDomainElement);
                    }
                } else {
                    counter = this._getTagCounter(tagCounts, member);
                    counter.addMember(member);
                }
            }
        }
        this._tagCounts = new Map(
            [...tagCounts].map(([k, v]) => [k, v.getCounts()])
        );
    }

    totalFacts() {
        if (this._totalFacts === undefined) {
            this._totalFacts = this._report.facts().length;
        }
        return this._totalFacts;
    }

    tagCounts() {
        if (this._tagCounts === undefined) {
            this._buildTagCounts();
        }
        return this._tagCounts;
    }
}
