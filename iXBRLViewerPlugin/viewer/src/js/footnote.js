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

export function Footnote(report, footnoteId, title) {
    this.id = footnoteId;
    this.facts = [];
    this.title = title;
    this._ixNode = report.getIXNodeForItemId(footnoteId);
}

Footnote.prototype.addFact = function (f) {
    this.facts.push(f); 
}

Footnote.prototype.textContent = function () {
    return this._ixNode.textContent();
}
