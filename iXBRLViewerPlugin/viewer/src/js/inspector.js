// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { formatNumber, wrapLabel, truncateLabel, runGenerator } from "./util.js";
import { ReportSearch } from "./search.js";
import { Calculation } from "./calculations.js";
import { IXBRLChart } from './chart.js';
import i18next from 'i18next';
import jqueryI18next from 'jquery-i18next';
import { ViewerOptions } from './viewerOptions.js';
import { Identifiers } from './identifiers.js';
import { Menu } from './menu.js';
import { Accordian } from './accordian.js';
import { FactSet } from './factset.js';
import { Fact } from './fact.js';
import { Footnote } from './footnote.js';
import { ValidationReportDialog } from './validationreport.js';
import { TextBlockViewerDialog } from './textblockviewer.js';
import { MessageBox } from './messagebox.js';
import { DocumentOutline } from './outline.js';
import { DIMENSIONS_KEY, DocumentSummary, MEMBERS_KEY, PRIMARY_ITEMS_KEY, TOTAL_KEY } from './summary.js';

const SEARCH_PAGE_SIZE = 100

export class Inspector {
    constructor(iv) {
        this._iv = iv;
        this._viewerOptions = new ViewerOptions()
        this._currentItem = null;
    }

    i18nInit() {
        return i18next.init({
            lng: this.preferredLanguages()[0],
            // Do not apply translations that are present but with an empty string
            returnEmptyString: false,
            fallbackLng: 'en',
            debug: false,
            resources: {
                en: { 
                    translation: require('../i18n/en/translation.json'),
                    referenceParts: require('../i18n/en/referenceparts.json'),
                    currencies: require('../i18n/en/currencies.json')
                },
                es: { 
                    translation: require('../i18n/es/translation.json'),
                    referenceParts: require('../i18n/es/referenceparts.json'),
                    currencies: require('../i18n/es/currencies.json')
                }
            }
        }).then((t) => {
            jqueryI18next.init(i18next, $, {
                tName: 't', // --> appends $.t = i18next.t
                i18nName: 'i18n', // --> appends $.i18n = i18next
                handleName: 'localize', // --> appends $(selector).localize(opts);
                selectorAttr: 'data-i18n', // selector for translating elements
                targetAttr: 'i18n-target', // data-() attribute to grab target element to translate (if different than itself)
                useOptionsAttr: false, // see optionsAttr
                parseDefaultValueFromContent: true // parses default values from content ele.val or ele.text
            });
        });
    }

    initialize(report, viewer) {
        const inspector = this;
        this._viewer = viewer;
        return new Promise(function (resolve, reject) {
            inspector._chart = new IXBRLChart();
            inspector._report = report;
            inspector.i18nInit().then((t) => {
                
                $(".collapsible-header").on("click", function () { 
                    const d = $(this).closest(".collapsible-section");
                    d.toggleClass("collapsed"); 
                    if (d.hasClass("collapsed")) {
                        d.find(".collapsible-body").slideUp(250);
                    }
                    else {
                        d.find(".collapsible-body").slideDown(250);
                        if (d.hasClass("collapsible-only")) {
                            d.siblings('.collapsible-section:not(.collapsed)').each(function() {
                                const section = $(this);
                                section.addClass("collapsed");
                                section.find(".collapsible-body").slideUp(250);
                            });
                        }
                    }
                });
                $("#inspector .controls .search-button").on("click", function () {
                    $(this).closest("#inspector").removeClass(["summary-mode", "outline-mode"]).toggleClass("search-mode");
                });
                $("#inspector .controls .summary-button").on("click", function () {
                    $(this).closest("#inspector").removeClass(["outline-mode", "search-mode"]).toggleClass("summary-mode");
                });
                $("#inspector .controls .outline-button").on("click", function () {
                    $(this).closest("#inspector").removeClass(["summary-mode", "search-mode"]).toggleClass("outline-mode");
                });
                $("#inspector-head .back").on("click", function () {
                    $(this).closest("#inspector").removeClass(["summary-mode", "outline-mode", "search-mode"]);
                });
                $(".popup-trigger").hover(function () { $(this).find(".popup-content").show() }, function () { $(this).find(".popup-content").hide() });
                $("#inspector").on("click", ".clipboard-copy", function () {
                    navigator.clipboard.writeText($(this).data("cb-text"));
                });
                inspector._toolbarMenu = new Menu($("#toolbar-highlight-menu"));
                inspector.buildToolbarHighlightMenu();

                inspector._optionsMenu = new Menu($("#display-options-menu"));
                inspector.buildDisplayOptionsMenu();

                $("#ixv").localize();

                // Listen to messages posted to this window
                $(window).on("message", (e) => inspector.handleMessage(e));
                report.setViewerOptions(inspector._viewerOptions);
                inspector.summary = new DocumentSummary(report);
                inspector.createSummary()
                inspector.outline = new DocumentOutline(report);
                inspector.createOutline();
                inspector._iv.setProgress(i18next.t("inspector.initializing")).then(() => {
                    inspector._search = new ReportSearch(report);
                    inspector.buildDisplayOptionsMenu();
                    inspector.buildToolbarHighlightMenu();
                    inspector.buildHighlightKey();
                    inspector.setupValidationReportIcon();
                    inspector.initializeViewer();
                    resolve();
                });
            });
        });
    }

    initializeViewer() {
        this._viewer.onSelect.add((id, eltSet, byClick) => this.selectItem(id, eltSet, byClick));
        this._viewer.onMouseEnter.add((id) => this.viewerMouseEnter(id));
        this._viewer.onMouseLeave.add(id => this.viewerMouseLeave(id));
        $('.ixbrl-next-tag').click(() => this._viewer.selectNextTag(this._currentItem));
        $('.ixbrl-prev-tag').click(() => this._viewer.selectPrevTag(this._currentItem));
    }

    postLoadAsync() {
        runGenerator(this._search.buildSearchIndex(() => this.searchReady()));
    }

    /*
     * Check for fragment identifier pointing to a specific fact and select it if
     * present.
     */
    handleFactDeepLink() {
        if (location.hash.startsWith("#f-")) {
            this.selectItem(location.hash.slice(3));
        }
    }

    handleMessage(event) {
        const jsonString = event.originalEvent.data;
        let data;
        try {
            data = JSON.parse(jsonString);
        }
        catch (e) {
            // Silently ignore any non-JSON messages as write-excel-file sends
            // messages to itself when exporting files.
            return;
        }

        if (data.task == 'SHOW_FACT') {
            this.selectItem(data.factId);
        }
        else {
            console.log("Not handling unsupported task message: " + jsonString);
        }
    }

    updateURLFragment() {
        if (this._currentItem) {
            location.hash = "#f-" + this._currentItem.id;
        }
        else {
            location.hash = "";
        }
    }

    buildDisplayOptionsMenu() {
        this._optionsMenu.reset();
        if (this._report) {
            const dl = this.selectDefaultLanguage();
            this._optionsMenu.addCheckboxGroup(this._report.availableLanguages(), this._report.languageNames(), dl, (lang) => { this.setLanguage(lang); this.update() }, "select-language");
            this.setLanguage(dl);
            if (this._report.filingDocuments()) {
                this._optionsMenu.addDownloadButton("Download filing documents", this._report.filingDocuments())
            }
        }
        this._iv.callPluginMethod("extendDisplayOptionsMenu", this._optionsMenu);
    }

    buildToolbarHighlightMenu() {
        const iv = this._iv;
        this._toolbarMenu.reset();
        this._toolbarMenu.addCheckboxItem(i18next.t("toolbar.xbrlElements"), (checked) => this.highlightAllTags(checked), "highlight-tags", null, this._iv.options.highlightTagsOnStartup);
        if (iv.isReviewModeEnabled()) {
            this._toolbarMenu.addCheckboxItem("Untagged Numbers", function (checked) {
                const body = iv.viewer.contents().find("body");
                if (checked) {
                    body.addClass("review-highlight-untagged-numbers");
                }
                else {
                    body.removeClass("review-highlight-untagged-numbers");
                }
            }, "highlight-untagged-numbers", "highlight-tags");

            this._toolbarMenu.addCheckboxItem("Untagged Dates", function (checked) {
                const body = iv.viewer.contents().find("body");
                if (checked) {
                    body.addClass("review-highlight-untagged-dates");
                }
                else {
                    body.removeClass("review-highlight-untagged-dates");
                }
            }, "highlight-untagged-dates", "highlight-untagged-numbers");
        }
        this._iv.callPluginMethod("extendToolbarHighlightMenu", this._toolbarMenu);
    }

    buildHighlightKey() {
        $(".highlight-key .items").empty();
        let key;
        if (this._iv.isReviewModeEnabled()) {
            key = [
                "XBRL Elements",
                "Untagged Numbers",
                "Untagged Dates",
            ]
        } else {
            key = this._report.namespaceGroups();
        }
        this._iv.callPluginMethod("extendHighlightKey", key);

        for (const [i, name] of key.entries()) {
            $("<div>")
                .addClass("item")
                .append($("<span></span>").addClass("sample").addClass("sample-" + i))
                .append($("<span></span>").text(name))
                .appendTo($(".highlight-key .items"));
        }
    }

    highlightAllTags(checked) {
        this._viewer.highlightAllTags(checked, this._report.namespaceGroups());
    }

    factListRow(f) {
        const row = $('<div class="fact-list-item"></div>')
            .click(() => this.selectItem(f.id))
            .dblclick(() => $('#inspector').removeClass("search-mode"))
            .mousedown((e) => { 
                /* Prevents text selection via double click without
                 * disabling click+drag text selection (which user-select:
                 * none would )
                 */
                if (e.detail > 1) { 
                    e.preventDefault() 
                } 
            })
            .mouseenter(() => this._viewer.linkedHighlightFact(f))
            .mouseleave(() => this._viewer.clearLinkedHighlightFact(f))
            .data('ivid', f.id);
        $('<div class="select-icon"></div>')
            .click(() => {
                this.selectItem(f.id);
                $('#inspector').removeClass("search-mode");
            })
            .appendTo(row)
        $('<div class="title"></div>')
            .text(f.getLabelOrName("std"))
            .appendTo(row);
        $('<div class="dimension"></div>')
            .text(f.period().toString())
            .appendTo(row);

        for (const aspect of f.aspects()) {
            if (aspect.isTaxonomyDefined() && !aspect.isNil()) {
                $('<div class="dimension"></div>')
                    .text(aspect.valueLabel())
                    .appendTo(row);
            }
        }
        if (f.isHidden()) {
            $('<div class="hidden"></div>')
                .text(i18next.t("search.hiddenFact"))
                .appendTo(row);
        }
        else if (f.isHTMLHidden()) {
            $('<div class="hidden"></div>')
                .text(i18next.t("search.concealedFact"))
                .appendTo(row);
        }
        return row;
    }

    addResults(container, results, offset) {
        $('.more-results', container).remove();
        for (var i = offset; i < results.length; i++ ) {
            if (i - offset >= SEARCH_PAGE_SIZE) {
                $('<div class="more-results"></div>')
                    .text(i18next.t("search.showMoreResults"))
                    .on('click', () => this.addResults(container, results, i))
                    .appendTo(container);
                break;
            }
            this.factListRow(results[i].fact).appendTo(container);
        }
    }

    searchSpec() {
        const spec = {};
        spec.searchString = $('#ixbrl-search').val();
        spec.showVisibleFacts = $('#search-visible-fact-filter').prop('checked');
        spec.showHiddenFacts = $('#search-hidden-fact-filter').prop('checked');
        spec.namespacesFilter = $('#search-filter-namespaces select').val();
        spec.unitsFilter = $('#search-filter-units select').val();
        spec.scalesFilter = $('#search-filter-scales select').val();
        spec.periodFilter = $('#search-filter-period select').val();
        spec.conceptTypeFilter = $('#search-filter-concept-type').val();
        spec.factValueFilter = $('#search-filter-fact-value').val();
        spec.calculationsFilter = $('#search-filter-calculations select').val();
        spec.dimensionTypeFilter = $('#search-filter-dimension-type select').val();
        return spec;
    }

    setupSearchControls(viewer) {
        const inspector = this;
        $('.search-controls input, .search-controls select').change(() => this.search());
        $(".search-controls div.filter-toggle").click(() => $(".search-controls").toggleClass('show-filters'));
        $(".search-controls .search-filters .reset").click(() => this.resetSearchFilters());
        $(".search-controls .search-filters .reset-multiselect").on("click", function () {
            $(this).siblings().children('select option:selected').prop('selected', false);
            inspector.search();
        });
        for (const key of Object.keys(this._search.periods)) {
            $("<option>")
                .attr("value", key)
                .text(this._search.periods[key])
                .appendTo('#search-filter-period select');
        }
        for (const prefix of this._report.getUsedPrefixes()) {
            $("<option>")
                .attr("value", prefix)
                .text(`${prefix} (${this._report.prefixMap()[prefix]})`)
                .appendTo('#search-filter-namespaces select');
        }
        for (const unit of this._report.getUsedUnits()) {
            $("<option>")
                    .attr("value", unit)
                    .text(`${this._report.getUnit(unit)?.label()} (${unit})`)
                    .appendTo('#search-filter-units select');
        }
        const scalesOptions = this._getScalesOptions();
        for (const scale of Object.keys(scalesOptions).sort()) {
                $("<option>")
                        .attr("value", scale)
                        .text(scalesOptions[scale])
                        .appendTo('#search-filter-scales select');
        }
    }

    _getScalesOptions() {
        const scalesOptions = {}
        const usedScalesMap = this._report.getUsedScalesMap();
        Object.keys(usedScalesMap).sort().forEach(scale => {
            const labels = Array.from(usedScalesMap[scale]).sort();
            if (labels.length > 0) {
                scalesOptions[scale] = labels.join(', ');
            }
            else {
                scalesOptions[scale] = scale.toString();
            }
        });
        return scalesOptions;
    }

    resetSearchFilters() {
        $("#search-filter-period select option:selected").prop("selected", false);
        $("#search-filter-concept-type").val("*");
        $("#search-filter-fact-value").val("*");
        $("#search-filter-calculations select option:selected").prop("selected", false);
        $("#search-filter-dimension-type select option:selected").prop("selected", false);
        $("#search-hidden-fact-filter").prop("checked", true);
        $("#search-visible-fact-filter").prop("checked", true);
        $("#search-filter-namespaces select option:selected").prop("selected", false);
        $("#search-filter-units select option:selected").prop("selected", false);
        $("#search-filter-scales select option:selected").prop("selected", false);
        this.search();
    }

    searchReady() {
        this.setupSearchControls();
        $('#inspector').addClass('search-ready');
        $('#ixbrl-search').prop('disabled', false);
        this.search();
    }

    search () {
        const spec = this.searchSpec();
        const results = this._search.search(spec);
        if (results === undefined) {
            return;
        }
        const container = $('#inspector .search-results .results');
        $('div', container).remove();
        this._viewer.clearRelatedHighlighting();
        const overlay = $('#inspector .search-results .search-overlay');
        if (results.length > 0) {
            overlay.hide();
            this.addResults(container, results, 0);
        }
        else {
            $(".title", overlay).text(i18next.t("search.noMatchFound"));
            $(".text", overlay).text(i18next.t("search.tryAgainDifferentKeywords"));
            overlay.show();
        }
        $("#matching-concepts-count").text(results.length);
        /* Don't highlight search results if there's no search string */
        if (spec.searchString != "") {
            this._viewer.highlightRelatedFacts(results.map(r => r.fact));
        }
        this.updateMultiSelectSubheader('search-filter-scales');
        this.updateMultiSelectSubheader('search-filter-units');
        this.updateMultiSelectSubheader('search-filter-namespaces');
        this.updateMultiSelectSubheader('search-filter-dimension-type');
        this.updateMultiSelectSubheader('search-filter-calculations');
        this.updateMultiSelectSubheader('search-filter-period');
    }

    updateMultiSelectSubheader(id) {
        const subheader = $(`#${id} .collapsible-subheader`);
        const selectedOptions = $(`#${id} select option:selected`);
        if (selectedOptions.length === 1) {
            subheader.text(` ${selectedOptions.text()}`);
        }
        else if (selectedOptions.length > 0) {
            const totalOptions = $(`#${id} select option`).length;
            subheader.text(` (${selectedOptions.length}/${totalOptions} ${i18next.t("search.selected")})`)
        } else {
            subheader.empty();
        }
    }

    updateCalculation(fact, elr) {
        $('.calculations .tree').empty().append(this._calculationHTML(fact, elr));
    }

    createSummary() {
        const summaryDom = $("#inspector .summary .body");
        this._populateFactSummary(summaryDom);
        this._populateTagSummary(summaryDom);
        this._populateFileSummary(summaryDom);
    }

    _populateFactSummary(summaryDom) {
        const totalFacts = this.summary.totalFacts();
        $("<span></span>")
                .text(totalFacts)
                .appendTo(summaryDom.find(".total-facts-value"));
    }

    _populateTagSummary(summaryDom) {
        const summaryTagsTableBody = summaryDom.find(".tag-summary-table-body");

        const tagCounts = this.summary.tagCounts();

        let totalPrimaryItemTags = 0;
        let totalDimensionTags = 0;
        let totalMemberTags = 0;
        let totalTags = 0;
        for (const counts of tagCounts.values()) {
            totalPrimaryItemTags += counts[PRIMARY_ITEMS_KEY];
            totalDimensionTags += counts[DIMENSIONS_KEY];
            totalMemberTags += counts[MEMBERS_KEY];
            totalTags += counts[TOTAL_KEY];
        }

        function insertTagCount(row, count, total) {
            let percent = 0;
            if (total > 0) {
                percent = count / total;
            }
            let formattedPercent = percent.toLocaleString(undefined, {
                style: "percent",
            });
            formattedPercent = ` (${formattedPercent})`;

            $("<td></td>")
                    .text(count)
                    .addClass("figure")
                    .append($("<sup></sup>").text(formattedPercent))
                    .appendTo(row);
        }

        const sortedPrefixCounts = [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (const [prefix, counts] of sortedPrefixCounts) {
            const countRow = $("<tr></tr>").appendTo(summaryTagsTableBody);
            countRow.append($("<th></th>").attr("scope", "row").text(prefix));
            insertTagCount(countRow, counts[PRIMARY_ITEMS_KEY], totalPrimaryItemTags);
            insertTagCount(countRow, counts[DIMENSIONS_KEY], totalDimensionTags);
            insertTagCount(countRow, counts[MEMBERS_KEY], totalMemberTags);
            insertTagCount(countRow, counts[TOTAL_KEY], totalTags);
        }

        const summaryTagsTableFooterRow = summaryDom.find(".tag-summary-table-footer-row");

        insertTagCount(summaryTagsTableFooterRow, totalPrimaryItemTags, totalPrimaryItemTags);
        insertTagCount(summaryTagsTableFooterRow, totalDimensionTags, totalDimensionTags);
        insertTagCount(summaryTagsTableFooterRow, totalMemberTags, totalMemberTags);
        insertTagCount(summaryTagsTableFooterRow, totalTags, totalTags);
    }

    _populateFileSummary(summaryDom) {
        const {
            inline,
            schema,
            calcLinkbase,
            defLinkbase,
            labelLinkbase,
            presLinkbase,
            refLinkbase,
            unrecognizedLinkbase
        } = this.summary.getLocalDocuments();

        const summaryFilesContent = summaryDom.find(".files-summary");

        function insertFileSummary(docs, classSelector) {
            if (docs.length === 0) {
                summaryFilesContent.find(classSelector).hide();
            } else {
                const ul = summaryFilesContent.find(classSelector + ' ul')
                for (const doc of docs) {
                    ul.append($("<li></li>").text(doc));
                }
            }
        }

        insertFileSummary(inline, ".inline-docs");
        insertFileSummary(schema, ".schemas");
        insertFileSummary(presLinkbase, ".pres-links");
        insertFileSummary(calcLinkbase, ".calc-links");
        insertFileSummary(defLinkbase, ".def-links");
        insertFileSummary(labelLinkbase, ".label-links");
        insertFileSummary(refLinkbase, ".ref-links");
        insertFileSummary(unrecognizedLinkbase, ".other-links");
    };

    createOutline() {
        if (this.outline.hasOutline()) {
            $('.outline .no-outline-overlay').hide();
            const container = $('<div class="fact-list"></div>').appendTo($('.outline .body'));
            for (const elr of this.outline.sortedSections()) {
                $('<div class="fact-list-item"></div>')
                    .text(this._report.getRoleLabel(elr))
                    .click(() => this.selectItem(this.outline.sections[elr].id))
                    .dblclick(() => $('#inspector').removeClass("outline-mode"))
                    .mousedown((e) => {
                        // Prevent text selection by double click
                        if (e.detail > 1) { 
                            e.preventDefault() 
                        } 
                    })
                    .appendTo(container);
            }
        }
    }

    updateOutline(cf) {
        $('.fact-groups').empty();
        for (const elr of this.outline.groupsForFact(cf)) {
            $('<div class="fact-list-item"></div>')
                .text(this._report.getRoleLabel(elr))
                .click(() => this.selectItem(this.outline.sections[elr].id))
                .appendTo($('.fact-groups'));
        }

    }

    updateFootnotes(fact) {
        // Outbound fact->footnote and fact->fact links
        $('.footnotes').empty().append(this._footnotesHTML(fact));

        // Inbound fact->fact footnote links.  Not widely used, so only show the
        // section if we have some. 
        if (fact.linkedFacts.length > 0) {
            $('#inspector .footnote-facts-section')
                .show()
                .find('.footnote-facts')
                .empty()
                .append(this._footnoteFactsHTML(fact));
        }
        else {
            $('#inspector .footnote-facts-section').hide();
        }
    }

    _anchorList(fact, anchors) {
        const html = $("<ul></ul>");
        if (anchors.length > 0) {
            for (const c of anchors) {
                const otherFacts = this._report.getAlignedFacts(fact, { "c": c });
                const label = this._report.getLabel(c, "std", true);

                $("<li></li>")
                    .appendTo(html)
                    .append(this.factLinkHTML(label, otherFacts));
            }
        }
        else {
            $('<li></li>')
                .append($('<i></i>').text(i18next.t("common.none")))
                .appendTo(html);
        }
        return html;
    }

    updateAnchoring(fact) {
        if (!this._report.usesAnchoring()) {
            $('.anchoring').hide();
        }
        else {
            $('.anchoring').show();

            $('.anchoring .collapsible-body .anchors-wider')
                .empty()
                .append(this._anchorList(fact, fact.widerConcepts()));

            $('.anchoring .collapsible-body .anchors-narrower')
                .empty()
                .append(this._anchorList(fact, fact.narrowerConcepts()));
        }

    }

    _referencesHTML(fact) {
        const c = fact.concept();
        const a = new Accordian();
        for (const [i, r] of fact.concept().references().entries()) {
            const title = $("<span></span>").text(r[0].value);
            const body =  $('<table class="fact-properties"><tbody></tbody></table>')
            const tbody = body.find("tbody");
            for (const p of r) {
                const row = $("<tr>")
                    .append($("<th></th>").text(i18next.t(`referenceParts:${p.part}`, {defaultValue: p.part})))
                    .append($("<td></td>").text(p.value))
                    .appendTo(tbody);
                if (p.part == 'URI') {
                    row.addClass("uri");
                    row.find("td").wrapInner($("<a>").attr("href", p.value));
                }
            }
            a.addCard(title, body, i == 0);
        }
        return a.contents();
    }

    _calculationHTML(fact, elr) {
        const calc = new Calculation(fact);
        if (!calc.hasCalculations()) {
            return "";
        }
        const tableFacts = this._viewer.factsInSameTable(fact);
        if (!elr) {
            elr = calc.bestELRForFactSet(tableFacts);
        }
        const report = this._report;
        const inspector = this;
        const a = new Accordian();

        for (const [e, rolePrefix] of Object.entries(calc.elrs())) {
            const label = report.getRoleLabel(rolePrefix, inspector._viewerOptions);

            const rCalc = calc.resolvedCalculation(e);
            const calcBody = $('<div></div>');
            for (const [i, r] of rCalc.entries()) {
                const itemHTML = $("<div></div>")
                    .addClass("item")
                    .append($("<span></span>").addClass("weight").text(r.weightSign + " "))
                    .append($("<span></span>").addClass("concept-name").text(report.getLabelOrName(r.concept, "std")))
                    .appendTo(calcBody);

                // r.facts is a map of fact IDs to Fact objects
                if (r.facts) {
                    itemHTML.addClass("calc-fact-link");
                    itemHTML.data('ivids', Object.keys(r.facts));
                    itemHTML.click(() => inspector.selectItem(Object.values(r.facts)[0].id));
                    itemHTML.mouseenter(() => Object.values(r.facts).forEach(f => this._viewer.linkedHighlightFact(f)));
                    itemHTML.mouseleave(() => Object.values(r.facts).forEach(f => this._viewer.clearLinkedHighlightFact(f)));
                    Object.values(r.facts).forEach(f => this._viewer.highlightRelatedFact(f));
                }
            }
            $("<div></div>").addClass("item").addClass("total")
                .append($("<span></span>").addClass("weight"))
                .append($("<span></span>").addClass("concept-name").text(fact.getLabelOrName("std")))
                .appendTo(calcBody);

            a.addCard($("<span></span>").text(label), calcBody, e == elr);

        }
        return a.contents();
    }

    _footnotesHTML(fact) {
        const html = $("<div></div>").addClass("fact-list");
        for (const fn of fact.footnotes()) {
            if (fn instanceof Footnote) {
                $("<div></div>")
                    .addClass("block-list-item")
                    .text(truncateLabel(fn.textContent(), 120))
                    .mouseenter(() => this._viewer.linkedHighlightFact(fn))
                    .mouseleave(() => this._viewer.clearLinkedHighlightFact(fn))
                    .click(() => this.selectItem(fn.id))
                    .appendTo(html);
            }
            else if (fn instanceof Fact) {
                html.append(this.factListRow(fn));
            }
        }
        return html;
    }

    viewerMouseEnter(id) {
        $('.calculations .item')
            .filter((i, e) => ($(e).data('ivids') ?? []).includes(id))
            .addClass('linked-highlight');
        $('#inspector .search .results tr')
            .filter((i, e) => $(e).data('ivid') == id)
            .addClass('linked-highlight');
    }

    viewerMouseLeave(id) {
        $('.calculations .item').removeClass('linked-highlight');
        $('#inspector .search .results tr').removeClass('linked-highlight');
    }

    describeChange(oldFact, newFact) {
        if (newFact.value() > 0 == oldFact.value() > 0 && Math.abs(oldFact.value()) + Math.abs(newFact.value()) > 0) {
            const x = (newFact.value() - oldFact.value()) * 100 / oldFact.value();
            let t = 0;
            if (x >= 0) {
                t = i18next.t('factDetails.changePercentageIncrease', { increase: formatNumber(x,1)});
            }
            else {
                t = i18next.t('factDetails.changePercentageDecrease', { decrease: formatNumber(-1 * x,1)});
            }
            return t;
        }
        else {
            return i18next.t('factDetails.changeFromIn', { from: oldFact.readableValue()}); 
        }
    }

    factLinkHTML(label, factList) {
        const html = $("<span></span>").text(label);
        if (factList.length > 0) {
            html
            .addClass("fact-link")
            .click(() => this.selectItem(factList[0].id))
            .mouseenter(() => factList.forEach(f => this._viewer.linkedHighlightFact(f)))
            .mouseleave(() => factList.forEach(f => this._viewer.clearLinkedHighlightFact(f)));
        }
        return html;
    }

    getPeriodIncrease(fact) {
        let s = "";
        if (fact.isNumeric()) {
            const otherFacts = this._report.getAlignedFacts(fact, {"p":null });
            var mostRecent;
            if (fact.periodTo()) {
                for (const other of otherFacts) {
                    if (other.periodTo() && other.periodTo() < fact.periodTo() && (!mostRecent || other.periodTo() > mostRecent.periodTo()) && fact.isEquivalentDuration(other)) {
                        mostRecent = other;
                    }
                }
            }
            if (mostRecent) {
                const allMostRecent = this._report.getAlignedFacts(mostRecent);
                s = $("<span></span>")
                        .text(this.describeChange(mostRecent, fact))
                        .append(this.factLinkHTML(mostRecent.periodString(), allMostRecent));

            }
            else {
                s = $("<i>").text(i18next.t('factDetails.noPriorFactInThisReport'));
            }
        }
        else {
            s = $("<i>").text("n/a").attr("title", "non-numeric fact");
        }
        $(".fact-properties tr.change td").html(s);

    }

    _updateValue(item, showAll, context) {
        const text = item.readableValue();
        const tr = $('tr.value', context);
        let v = text;
        if (!showAll) {
            const vv = wrapLabel(text, 120);
            if (vv.length > 1) {
                tr.addClass("truncated");
                tr.find('.show-all')
                    .off('click')
                    .on('click', () => this._updateValue(item, true, context));
            }
            else {
                tr.removeClass('truncated');
            }
            v = vv[0];
        }
        else {
            tr.removeClass('truncated');
        }

        // Only enable text block viewer for escaped, text block facts.  This
        // ensure that we're only rendering fragments of the main documents, rather
        // than potentially arbitrary strings.
        if (TextBlockViewerDialog.canRender(item)) {
            tr
                .addClass('text-block')
                .find('.expand-text-block')
                    .off().click(() => this.showTextBlock(item));
        }
        else {
            tr.removeClass('text-block');
        }

        const valueSpan = tr.find('td .value').empty().text(v);
        if (item instanceof Fact && (item.isNil() || item.isInvalidIXValue())) {
            valueSpan.wrapInner("<i></i>");
        }

    }

    showTextBlock(item) {
        const tbd = new TextBlockViewerDialog(item);
        tbd.displayTextBlock();
        tbd.show();
    }

    _updateEntityIdentifier(fact, context) {
        $('tr.entity-identifier td', context)
            .empty()
            .append(Identifiers.readableNameHTML(fact.identifier()));
    }

    _footnoteFactsHTML(fact) {
        const html = $('<div></div>');
        fact.linkedFacts.forEach((linkedFact) => {
            html.append(this.factListRow(linkedFact));
        });
        return html;
    }

    /* 
     * Build an accordian containing a summary of all nested facts/footnotes
     * corresponding to the current viewer selection.
     */
    _selectionSummaryAccordian() {
        const cf = this._currentItem;

        // dissolveSingle => title not shown if only one item in accordian
        const a = new Accordian({
            onSelect: (id) => this.switchItem(id),
            alwaysOpen: true,
            dissolveSingle: true,
        });

        const fs = new FactSet(this._currentItemList);
        for (const fact of this._currentItemList) {
            let factHTML;
            const title = fs.minimallyUniqueLabel(fact);
            if (fact instanceof Fact) {
                factHTML = $(require('../html/fact-details.html')); 
                $('.std-label', factHTML).text(fact.getLabelOrName("std", true));
                $('.documentation', factHTML).text(fact.getLabel("doc") || "");
                $('tr.concept td', factHTML)
                    .find('.text')
                        .text(fact.conceptName())
                        .attr("title", fact.conceptName())
                    .end()
                    .find('.clipboard-copy')
                        .data('cb-text', fact.conceptName())
                    .end();
                $('tr.period td', factHTML)
                    .text(fact.periodString());
                if (fact.isNumeric()) {
                    $('tr.period td', factHTML).append(
                        $("<span></span>") 
                            .addClass("analyse")
                            .text("")
                            .click(() => this.analyseDimension(fact, ["p"]))
                    );
                }
                this._updateEntityIdentifier(fact, factHTML);
                this._updateValue(fact, false, factHTML);

                const accuracyTD = $('tr.accuracy td', factHTML).empty().append(fact.readableAccuracy());
                if (!fact.isNumeric() || fact.isNil()) {
                    accuracyTD.wrapInner("<i></i>");
                }

                const scaleTD = $('tr.scale td', factHTML).empty().append(fact.readableScale());
                if (!fact.isNumeric() || fact.isNil()) {
                    scaleTD.wrapInner("<i></i>");
                }

                $('#dimensions', factHTML).empty();
                const taxonomyDefinedAspects = fact.aspects().filter(a => a.isTaxonomyDefined());
                if (taxonomyDefinedAspects.length === 0) {
                    $('#dimensions-label', factHTML).hide();
                }
                for (const aspect of taxonomyDefinedAspects) {
                    const h = $('<div class="dimension"></div>')
                        .text(aspect.label() || aspect.name())
                        .appendTo($('#dimensions', factHTML));
                    if (fact.isNumeric()) {
                        h.append(
                            $("<span></span>") 
                                .addClass("analyse")
                                .text("")
                                .on("click", () => this.analyseDimension(fact, [aspect.name()]))
                        )
                    }
                    const s = $('<div class="dimension-value"></div>')
                        .text(aspect.valueLabel())
                        .appendTo(h);
                    if (aspect.isNil()) {
                        s.wrapInner("<i></i>");
                    }
                }
            }
            else if (fact instanceof Footnote) {
                factHTML = $(require('../html/footnote-details.html')); 
                this._updateValue(fact, false, factHTML);
            }
            a.addCard(
                title,
                factHTML, 
                fact.id == cf.id,
                fact.id
            );
        }
        return a;
    }

    analyseDimension(fact, dimensions) {
        const chart = new IXBRLChart();
        chart.analyseDimension(fact, dimensions);
    }

    update() {
        const cf = this._currentItem;
        if (!cf) {
            $('#inspector').removeClass('footnote-mode');
            $('#inspector').addClass('no-fact-selected');
        } 
        else { 
            $('#inspector').removeClass('no-fact-selected').removeClass("hidden-fact").removeClass("html-hidden-fact");

            $('#inspector .fact-inspector')
                .empty()
                .append(this._selectionSummaryAccordian().contents());

            if (cf instanceof Fact) {
                $('#inspector').removeClass('footnote-mode');

                this.updateCalculation(cf);
                this.updateOutline(cf);
                this.updateFootnotes(cf);
                this.updateAnchoring(cf);
                $('div.references').empty().append(this._referencesHTML(cf));
                $('#inspector .search-results .fact-list-item').removeClass('selected');
                $('#inspector .search-results .fact-list-item').filter((i, e) => $(e).data('ivid') == cf.id).addClass('selected');

                const duplicates = cf.duplicates();
                let n = 0;
                const ndup = duplicates.length;
                for (var i = 0; i < ndup; i++) {
                    if (cf.id == duplicates[i].id) {
                        n = i;
                    }
                }
                $('.duplicates .text').text(i18next.t('factDetails.duplicatesCount', { current: n + 1, total: ndup}));
                $('.duplicates .prev').off().click(() => this.selectItem(duplicates[(n+ndup-1) % ndup].id));
                $('.duplicates .next').off().click(() => this.selectItem(duplicates[(n+1) % ndup].id));

                this.getPeriodIncrease(cf);
                if (cf.isHidden()) {
                    $('#inspector').addClass('hidden-fact');
                }
                else if (cf.isHTMLHidden()) {
                    $('#inspector').addClass('html-hidden-fact');
                }

            }
            else if (cf instanceof Footnote) {
                $('#inspector').addClass('footnote-mode');
                $('#inspector .footnote-details .footnote-facts').empty().append(this._footnoteFactsHTML(cf));
            }
            $('.fact-details').localize();
        }
        this.updateURLFragment();
    }

    /*
     * Select a fact or footnote from the report.
     *
     * Takes an ID of the item to select.  An optional list of "alternate"
     * fact/footnotes may be specified, which will be presented in an accordian.
     * This is used when the user clicks on a nested fact/footnote in the viewer,
     * so that all items corresponding to the area clicked are shown.
     *
     * If itemIdList is omitted, the currently selected item list is reset to just
     * the primary item.
     */
    selectItem(id, itemIdList, noScroll) {
        if (itemIdList === undefined) {
            this._currentItemList = [ this._report.getItemById(id) ];
        }
        else {
            this._currentItemList = [];
            for (const itemId of itemIdList) {
                this._currentItemList.push(this._report.getItemById(itemId));
            }
        }
        this.switchItem(id, noScroll);
    }

    /*
     * Switches the currently selected item.  Unlike selectItem, this does not
     * change the current list of "alternate" items.  
     *
     * For facts, the "id" must be in the current alternate fact list.
     *
     * For footnotes, we currently only support a single footnote being selected.
     */
    switchItem(id, noScroll) {
        if (id !== null) {
            this._currentItem = this._report.getItemById(id);
            if (!noScroll) {
                this._viewer.showItemById(id);
            }
            this._viewer.highlightItem(id);
        }
        else {
            this._currentItem = null;
            this._viewer.clearHighlighting();
        }
        this.update();
    }

    preferredLanguages() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("lang")) {
            return [ urlParams.get("lang") ];
        }
        const langs = window.navigator.languages || [ window.navigator.language || window.navigator.userLanguage ] ;
        if (langs.length == 0 || !langs[0]) {
            return ["en"];
        }
        return langs;
    }

    selectDefaultLanguage() {
        const al = this._report.availableLanguages();
        for (const pl of this.preferredLanguages()) {
            for (const l of al) {
                if (l.toLowerCase() == pl.toLowerCase()) {
                    return l;
                }
            }
        }
        return this._report.availableLanguages()[0];
    }

    setLanguage(lang) {
        this._viewerOptions.language = lang;
    }

    showValidationReport() {
        const vr = new ValidationReportDialog();
        vr.displayErrors(this._report.data.validation);
        vr.show();
    }

    setupValidationReportIcon() {
        if (this._report.hasValidationErrors()) {
            $("#ixv .validation-warning").show().on("click", () => this.showValidationReport());
        }
    }

    showValidationWarning() {
        if (this._report.hasValidationErrors()) {
            const message = $("<div></div>").append("<p>This report contains <b>XBRL validation errors</b>.  These errors may prevent this document from opening correctly in other XBRL software.</p>");
            const mb = new MessageBox("Validation errors", message, "View Details", "Dismiss");
            mb.show(() => this.showValidationReport());
        }
    }
}
