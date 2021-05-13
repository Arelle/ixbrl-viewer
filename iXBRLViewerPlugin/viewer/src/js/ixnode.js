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
 * The wrapperNode property is a jQuery object for the "containing" element
 * which will either be an inserted div or span wrapper, or the nearest
 * enclosing td or th.
 */

var docOrderindex = 0;

export function IXNode(id, wrapperNode, docIndex) {
    this.wrapperNode = wrapperNode;
    this.escaped = false;
    this.continuations = [];
    this.docIndex = docIndex;
    this.footnote = false;
    this.id = id;
    this.htmlHidden = false;
    this.docOrderindex = docOrderindex++;
}

IXNode.prototype.continuationIds = function () {
    return this.continuations.map(n => n.id);
}

IXNode.prototype.textContent = function () {
    return [this].concat(this.continuations)
        .map(n => n.wrapperNode.text())
        .join(" ");
}
