// Copyright 2019 Workiva Inc.
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


/*
 * Object to hold information related to iXBRL nodes in the HTML document.
 * May correspond to either a nonNumeric/nonFraction element, or a continuation
 * element.
 * 
 * The wrapperNodes property is a jQuery object for the "containing" elements
 * which will be a node list containng an inserted div or span wrapper, any
 * absolutely positioned elements or the nearest enclosing td or th.
 */

var docOrderindex = 0;

export class IXNode {
    constructor (id, wrapperNodes, docIndex, name) {
        this.wrapperNodes = wrapperNodes;
        this.escaped = false;
        this.continuations = [];
        this.docIndex = docIndex;
        this.footnote = false;
        this.id = id;
        this.isHidden = false;
        this.docOrderindex = docOrderindex++;
        this.name = name;
    }

    continuationIds() {
        return this.continuations.map(n => n.id);
    }

    // Return IX IDs for all IX elements in the continuation chain, including the
    // head.
    chainIXIds() { 
        return [this.id].concat(this.continuationIds());
    }

    textContent() { 
        return [this].concat(this.continuations)
            // The first wrapperNode is always the wrapper for the actual IX node,
            // so will give the full text content.
            .map(n => n.wrapperNodes.first().text())
            .join(" ");
    }

    htmlHidden() {
        return this.wrapperNodes.is(':hidden');
    }
}
