// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import i18next from 'i18next';
import jqueryI18next from 'jquery-i18next';
import {formatNumber, wrapLabel, truncateLabel, runGenerator, SHOW_FACT, HIGHLIGHT_COLORS, viewerUniqueId, GLOSSARY_URL, FEATURE_HOME_LINK_URL, FEATURE_HOME_LINK_LABEL, FEATURE_SEARCH_ON_STARTUP, FEATURE_HIGHLIGHT_FACTS_ON_STARTUP, STORAGE_APP_LANGUAGE, STORAGE_HIGHLIGHT_FACTS, STORAGE_HOME_LINK_QUERY, FEATURE_HIDE_CALCULATION_MODE_OPTION, ZOOM_LEVELS, FACTS_PER_GROUP} from "./util.js";
import { ReportSearch } from "./search.js";
import { IXBRLChart } from './chart.js';
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
import { Calculation } from "./calculation.js";
import { CalculationInspector } from './calculationInspector.js';
import { ReportSetOutline } from './outline.js';
import { DIMENSIONS_KEY, DocumentSummary, MEMBERS_KEY, PRIMARY_ITEMS_KEY, TOTAL_KEY } from './summary.js';
import { getTheme, darkModeTheme, lightModeTheme } from './theme.js';

const SEARCH_PAGE_SIZE = 100
const SEARCH_FILTER_MULTISELECTS = {
  visibilityFilter: "search-filter-visibility",
  conceptTypeFilter: "search-filter-concept-type",
  periodFilter: "search-filter-period",
  dimensionTypeFilter: "search-filter-dimension-type",
  namespacesFilter: "search-filter-namespaces",
  targetDocumentFilter: "search-filter-target-document",
  scalesFilter:"search-filter-scales",
  unitsFilter: "search-filter-units",
  calculationsFilter: "search-filter-calculations",
  dataTypesFilter: "search-filter-datatypes",
  factValueFilter: "search-filter-fact-value",
  mandatoryFactsFilter: "search-filter-mandatory-facts",
};

export class Inspector {
    constructor(iv) {
        this._iv = iv;
        this._viewerOptions = new ViewerOptions()
        this._currentItem = null;
        this._useCalc11 = true;
        this._curInspectorMode = undefined;
        this._prevInspectorMode = undefined;
    }

    i18nInit() {
        const langs = ["cy", "da", "de", "en", "es", "fr", "nl", "uk"];
        const bundles = [
          "translation",
          "referenceParts",
          "currencies",
          "dataTypes",
          "labelRoles",
          "scale",
          "balanceTypes",
          "tooltips"
        ];
        return i18next.init({
            lng: this.preferredLanguages()[0],
            reloadOnLanguageChange: true,
            // Do not apply translations that are present but with an empty string
            returnEmptyString: false,
            fallbackLng: 'en',
            debug: false,
            resources: 
                Object.fromEntries(
                  langs.map(l => [l, Object.fromEntries(
                    bundles.map(n => [n, require(`../i18n/${l}/${n.toLowerCase()}.json`)]))
                  ])
                )
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

    initialize(reportSet, viewer) {
        const inspector = this;
        this._viewer = viewer;
        return new Promise(function (resolve, reject) {
            inspector._chart = new IXBRLChart();
            inspector._reportSet = reportSet;
            inspector.i18nInit().then((t) => {
                
                // Bind to #ixv and filter as some collapsible sections get added dynamically.
                $("#ixv").on("click", ".collapsible-header button:first-of-type", function () { 
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
                $("#inspector-tabs button").on("click", function () {
                    inspector.inspectorMode($(this).data("mode"));
                });
                $("#settings-button").on("click", () => inspector.toggleSettingsMode());

                $(".nested-item-select select").change(e => inspector.switchItem($(e.currentTarget).val(), true));

                $(".popup-trigger").on("mouseenter", function () {
                    $(this).find(".popup-content").show()
                }).on("mouseleave", function () {
                    $(this).find(".popup-content").hide()
                });
                $(".radio-pills button").on("click", function () {
                    $(this).parent().find("button").removeClass("selected");
                    $(this).addClass("selected");
                });
                $("#summary-tag-count-number").on("click", () => $(".tag-summary").removeClass("show-percent"));
                $("#summary-tag-count-percent").on("click", () => $(".tag-summary").addClass("show-percent"));
                $("#inspector").on("click", ".clipboard-copy", function () {
                    navigator.clipboard.writeText($(this).data("cb-text"));
                });

                $('#dark-mode-off').on("click", () => lightModeTheme());
                $('#dark-mode-on').on("click", () => darkModeTheme());
                $("#setting-dark-mode button").filter((i, e) => $(e).data("theme") === getTheme()).addClass("selected");
                $('#print').on("click", () => inspector._viewer.currentDocument().get(0).contentWindow.print());
                $('#highlight-tags').on("click", () => inspector.toggleHighlightAllTags());
                if (inspector.highlightTagsOnStartup()) {
                  $('#highlight-tags').addClass("checked");
                }
                $('#zoom-in').on("click", () => inspector.zoomRelative(1));
                $('#zoom-out').on("click", () => inspector.zoomRelative(-1));
                $('#zoom').on("change", (e) => inspector.zoomAbsolute($(e.currentTarget).val()));

                inspector.initializeTooltips();

                inspector._toolbarMenu = new Menu($("#toolbar-highlight-menu"));
                inspector.buildToolbarHighlightMenu();

                inspector._optionsMenu = new Menu($("#display-options-menu"));
                inspector.buildDisplayOptionsMenu();

                inspector.buildHomeLink()

                $("#ixv").localize();

                // Listen to messages posted to this window
                $(window).on("message", (e) => inspector.handleMessage(e));
                reportSet.viewerOptions = inspector._viewerOptions;
                inspector.summary = new DocumentSummary(reportSet);
                inspector.createSummary()
                inspector.outline = new ReportSetOutline(reportSet);
                inspector.createOutline();
                inspector.initializeZoom();
                inspector._iv.setProgress(i18next.t("inspector.initializing")).then(() => {
                    inspector._search = new ReportSearch(reportSet);
                    inspector.handleFactDeepLink();
                    inspector.rebuildViewer();
                    inspector.setupValidationReportIcon();
                    inspector.initializeViewer();
                    inspector.buildFactListByGroup();
                    inspector.doInitialSelection();
                    resolve();
                });
            });
        });
    }

    initializeTooltips() {
        $("html").on("click", e => 
            this.hideTooltip()
        );
        $("#inspector .inspector-body").on("scroll", e => 
            this.hideTooltip()
        );
        $(document).on("keyup", (e) => {
            if (e.keyCode == 27) { 
                this.hideTooltip();
            }
        });
        $("#ixv").on("click", ".tooltip-icon", (e) => {
            this.toggleTooltip($(e.currentTarget));
            e.stopPropagation();
        });

        let tooltipHoverCount = 0;
        $("#ixv").on("mouseenter", ".tooltip-icon", e => {
            tooltipHoverCount++;
            setTimeout(t => {
                if (tooltipHoverCount > 0) {
                    this.showTooltip($(e.currentTarget), true);
                }
            }, 250);
        });
        $("#ixv").on("mouseenter", "#tooltip", e => tooltipHoverCount++);
        $("#ixv").on("mouseleave", "#tooltip, .tooltip-icon", e => {
            tooltipHoverCount--;
            setTimeout(e => {
                if (tooltipHoverCount == 0) {
                    this.hideTooltip(true);
                }
            }, 500);
        });
    }

    initializeViewer() {
        this._viewer.onSelect.add((vuid, eltSet, byClick) => this.selectItem(vuid, eltSet, byClick));
        this._viewer.onMouseEnter.add((id) => this.viewerMouseEnter(id));
        this._viewer.onMouseLeave.add(id => this.viewerMouseLeave(id));
        $('.tag-nav-all-facts .next-tag').on("click", () => this._viewer.selectNextTag(this._currentItem));
        $('.tag-nav-all-facts .prev-tag').on("click", () => this._viewer.selectPrevTag(this._currentItem));
    }

    initializeZoom() {
        $("#zoom").empty();
        for (const [n, zoom] of ZOOM_LEVELS.entries()) {
            const option = $("<option></option>")
                .attr("value", n)
                .text(`${zoom}%`)
                .appendTo("#zoom");
            // Keep drop-down short, but keep fine-grained control with zoom
            // in/out.
            if (n % 2 == 1) {
                option.attr("hidden", "hidden");
            }
            if (zoom == 100) {
                option.attr("selected", "selected");
                this._zoomLevel = n;
            }
        }
    }

    postLoadAsync() {
        runGenerator(this._search.buildSearchIndex(() => this.searchReady()));
    }

    /*
     * Check for fragment identifier pointing to a specific fact and select it if
     * present.
     *
     * Legacy format: #f-FACT_ID
     * New format: #fN-FACT_ID where N is report index
     * For N == 0, we use the legacy format.
     *
     */
    handleFactDeepLink() {
        const match = location.hash.match(/^#f([0-9]+)?-(.*)$/);
        if (match !== null) {
            const reportId = match[1] ?? 0;
            const id = viewerUniqueId(reportId, match[2]);
            if (this._reportSet.getItemById(id) !== undefined) {
                this.selectItem(id);
            }
        }
    }

    doInitialSelection() {
        if (!this._currentItem) {
            this.inspectorMode("fact-mode");
            if (this.outline.hasOutline()) {
                $("#inspector").addClass("show-facts-by-group");
            }
        }
    }

    addFactListByGroupFacts(container, next, last) {
        $(".show-more", container).remove();
        for (let i = next; i < last; i++) {
            if (i - next >= FACTS_PER_GROUP - 1) {
                $("<button></button>") 
                    .addClass("show-more")
                    .text(i18next.t("inspector.showMore"))
                    .on("click",  () => this.addFactListByGroupFacts(container, i, last))
                    .appendTo(container);
                break;
            }
            this.factListRow(this._reportSet.facts()[i]).appendTo(container);
        }

    }

    buildFactListByGroup() {
        const container = $("#inspector .facts-by-group");
        if (!this.outline.hasOutline()) {
            return;
        }


        const groups = this.outline.sortedSections();

        for (const group of groups) {
            const section = $("<div></div>")
                .addClass("collapsible-section")
                .appendTo(container);

            const header = $("<h3></h3>")
                .addClass("collapsible-header")
                .appendTo(section);

            $("<button></button>")
                .text(group.report.getRoleLabelOrURI(group.elr))
                .appendTo(header);

            const body = $("<div></div>")
                .addClass("collapsible-body")
                .addClass("fact-list")
                .appendTo(section);

            const first = this._reportSet.facts().indexOf(group.firstFact);
            const last = this._reportSet.facts().indexOf(group.lastFact);
            this.addFactListByGroupFacts(body, first, last);
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
        const task = data["task"];
        if (task === SHOW_FACT) {
            let docSetId = Number(data["docSetId"]);
            if (!docSetId) { // Handles NaN
                docSetId = 0;
            }
            const vuid = viewerUniqueId(docSetId, data['factId']);
            this.selectItem(vuid);
        }
        else {
            console.log("Not handling unsupported task message: " + jsonString);
        }
    }

    updateURLFragment() {
        if (this._currentItem) {
            // Don't include report number for first report for compatibility
            // with legacy fragments
            location.hash = "#f" + this._currentItem.vuid.replace(/^0-/,  "-");
        }
        else {
            location.hash = "";
        }
    }

    buildDisplayOptionsMenu() {
        this._optionsMenu.reset();
        if (this._reportSet) {
            // Doc language
            const defaultDocLang = this.selectDefaultLanguage();
            const docLangNames = new Intl.DisplayNames(this.preferredLanguages(), { "type": "language" });
            const docLangs = [...this._reportSet.availableLanguages()]
                .sort((a, b) => docLangNames.of(a).localeCompare(docLangNames.of(b)));

            this._optionsMenu.addLabel(i18next.t("menu.documentLanguage"));
            this._optionsMenu.addCheckboxGroup(
                docLangs,
                Object.fromEntries(docLangs.map((l) => [l, docLangNames.of(l)])),
                defaultDocLang,
                (lang) => { this.setDocumentLanguage(lang); this.createOutline(); this.update() },
                "select-language"
            );
            this.setDocumentLanguage(defaultDocLang);

            // Options
            if (this._reportSet.usesCalculations() && !this._iv.isFeatureEnabled(FEATURE_HIDE_CALCULATION_MODE_OPTION)) {
                this._optionsMenu.addLabel(i18next.t("menu.options"));
                this._optionsMenu.addCheckboxItem(i18next.t("calculation.useCalculations11"), (useCalc11) => this.setCalculationMode(useCalc11), "calculation-mode", "select-language", this._useCalc11);
            }
        }
        let helpLinks = {}
        let supportLinkUrl = this._iv.getSupportLinkUrl();
        if (supportLinkUrl) {
            helpLinks[i18next.t("menu.contactUs")] = supportLinkUrl;
        }
        let surveyLinkUrl = this._iv.getSurveyLinkUrl();
        if (surveyLinkUrl) {
            helpLinks[i18next.t("menu.survey")] = surveyLinkUrl;
        }
        if (Object.entries(helpLinks).length > 0) {
            this._optionsMenu.addLabel(i18next.t("menu.help"));
            for (const [label, value] of Object.entries(helpLinks)) {
                this._optionsMenu.addLink(label, value);
            }
        }
        this._iv.callPluginMethod("extendDisplayOptionsMenu", this._optionsMenu);
    }

    buildHomeLink() {
        $('#top-bar #home-link').remove();
        if (!this._iv.isStaticFeatureEnabled(FEATURE_HOME_LINK_URL)) {
            return;
        }
        $("#top-bar img.header").remove();
        let homeLinkUrl = this._iv.getStaticFeatureValue(FEATURE_HOME_LINK_URL);
        let homeLinkText;
        if (this._iv.isStaticFeatureEnabled(FEATURE_HOME_LINK_LABEL)) {
            homeLinkText = this._iv.getStaticFeatureValue(FEATURE_HOME_LINK_LABEL);
        } else {
            homeLinkText = i18next.t("toolbar.homePage");
        }
        const query = sessionStorage.getItem(STORAGE_HOME_LINK_QUERY);
        if (query) {
            if (!homeLinkUrl.includes("?")) {
                homeLinkUrl += "?";
            } else {
                homeLinkUrl += "&";
            }
            homeLinkUrl += query;
        }
        const homeLink = $('<a></a>')
                .attr('href', homeLinkUrl)
                .attr('id', 'home-link')
                .text(homeLinkText);
        $('#top-bar').prepend(homeLink);
    }

    highlightTagsOnStartup() {
        const pref = window.localStorage.getItem(STORAGE_HIGHLIGHT_FACTS);
        if (pref !== null) {
            return JSON.parse(pref);
        }
        return this._iv.isFeatureEnabled(FEATURE_HIGHLIGHT_FACTS_ON_STARTUP);
    }

    buildSettingsPage() {
        // Application language
        const defaultAppLang = i18next.language.substring(0, 2);
        const appLangNames = new Intl.DisplayNames(this.preferredLanguages(), { "type": "language" });
        const appLangs = Object.keys(i18next.options.resources)
            .sort((a, b) => appLangNames.of(a).localeCompare(appLangNames.of(b)));
        const appLangSetting = $("#setting-viewer-language")
            .empty()
            .off("change.setting")
            .on("change.setting", e => this.changeApplicationLanguage($(e.currentTarget).val()));

        for (const l of appLangs) {
            $("<option></option>")
                .text(appLangNames.of(l))
                .val(l)
                .appendTo(appLangSetting);
        }
        appLangSetting.val(defaultAppLang);
    }

    buildToolbarHighlightMenu() {
        const iv = this._iv;
        this._toolbarMenu.reset();
        this._toolbarMenu.addCheckboxItem(i18next.t("toolbar.xbrlElements"), (checked, explicitClick) => this.highlightAllTags(checked, explicitClick), "highlight-tags", null, this.highlightTagsOnStartup())
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
            key = this._reportSet.namespaceGroups().map(p => this._reportSet.preferredPrefix(p));
        }
        this._iv.callPluginMethod("extendHighlightKey", key);

        for (const [i, name] of key.entries()) {
            $("<div>")
                .addClass("item")
                .append($("<span></span>").addClass("sample").addClass("sample-" + (i % HIGHLIGHT_COLORS)))
                .append($("<span></span>").text(name))
                .appendTo($(".highlight-key .items"));
        }
    }

    buildUserGuideLink() {
        $('.top-bar-controls #user-guide-link').remove();
        const userGuideUrl = this._iv.getGuideLinkUrl();
        const userGuideLink = $('<a></a>')
                .attr('href', userGuideUrl)
                .attr('id', 'user-guide-link')
                .attr('target', '_blank')
                .text(i18next.t("menu.userGuide"));
        userGuideLink.insertBefore('#toggle-dark-mode');
    }

    changeApplicationLanguage(lang) {
        localStorage.setItem(STORAGE_APP_LANGUAGE, lang);
        i18next.changeLanguage(lang);
        this.rebuildViewer();
    }

    rebuildViewer() {
        $("#ixv").localize();
        $('html').attr('lang', i18next.resolvedLanguage);
        this.buildDisplayOptionsMenu();
        this.buildHomeLink()
        this.buildToolbarHighlightMenu();
        this.buildHighlightKey();
        this.buildUserGuideLink();
        this.buildSettingsPage();
        this.update();
        this.search();
    }

    inspectorMode(mode, focusInspector) {
        const allModes = ["fact-mode", "search-mode", "overview-mode", "settings-mode"];
        $("#inspector-tabs button")
            .removeClass("selected")
            .filter((i, e) => $(e).data("mode") === mode)
            .addClass("selected");
        $("#ixv").removeClass("show-filters");
        $("#ixv").removeClass(allModes.filter(m => m !== mode)).addClass(mode);
        if (focusInspector === true) {
            $("#inspector").removeClass("show-facts-by-group");
        }
        else if ((focusInspector === false || this._curInspectorMode === "fact-mode" && mode === "fact-mode") && this.outline.hasOutline()) {
            $("#inspector").addClass("show-facts-by-group");
        }
        this._curInspectorMode = mode;
    }

    toggleSettingsMode() {
        if (this._curInspectorMode !== "settings-mode") {
            this._prevInspectorMode = this._curInspectorMode;
            this.inspectorMode("settings-mode");
        }
        else {
            this.inspectorMode(this._prevInspectorMode);
        }
    }


    setCalculationMode(useCalc11) {
        this._useCalc11 = useCalc11;
        if (this._currentItem instanceof Fact) {
            this.updateCalculation(this._currentItem);
        }
    }

    highlightAllTags(checked, explicitClick) {
        if (explicitClick) {
            window.localStorage.setItem(STORAGE_HIGHLIGHT_FACTS, JSON.stringify(checked));
        }
        this._viewer.highlightAllTags(checked, this._reportSet.namespaceGroups());
    }

    toggleHighlightAllTags() {
        const control = $("#highlight-tags")
        control.toggleClass("checked");
        this.highlightAllTags(control.hasClass("checked"), true);
    }

    factListRow(f) {
        const row = $('<button class="fact-list-item"></button>')
            // soft focus - highlight the fact, but don't close the search results
            .on("click", () => this.selectItem(f.vuid, undefined, undefined, true))
            .on("dblclick", () => this.selectItem(f.vuid))
            .on("mousedown", (e) => { 
                /* Prevents text selection via double click without
                 * disabling click+drag text selection (which user-select:
                 * none would )
                 */
                if (e.detail > 1) { 
                    e.preventDefault() 
                } 
            })
            .on("mouseenter", () => this._viewer.linkedHighlightFact(f))
            .on("mouseleave", () => this._viewer.clearLinkedHighlightFact(f))
            .data('ivid', f.vuid);
      /*
        $('<button class="select-icon"></button>')
            .attr("title", i18next.t("search.viewFact"))
            .on("click", () => {
                this.selectItem(f.vuid);
            })
            .appendTo(row)
            */
        this._setLabelWithLang($('<div class="title"></div>'), f.getLabelOrNameAndLang("std"))
            .on("click", () => this.selectItem(f.vuid))
            .appendTo(row);
        const dt = f.concept().dataType();
        if (dt !== undefined) {
           $('<div class="datatype"></div>')
            .text(dt.label())
            .appendTo(row);
        }
        $('<div class="dimension"></div>')
            .text(f.period().toString())
            .appendTo(row);

        for (const aspect of f.aspects()) {
            if (aspect.isTaxonomyDefined() && !aspect.isNil()) {
                this._setLabelWithLang($('<div class="dimension"></div>'), aspect.valueLabelAndLang())
                    .appendTo(row);
            }
        }
        const tags = $("<div></div>").addClass("block-list-item-tags").appendTo(row);
        if (f.targetDocument() !== null) {
            $('<div class="hidden"></div>')
                .text(f.targetDocument())
                .appendTo(tags);
        }
        if (f.isHidden()) {
            $('<div class="hidden"></div>')
                .text(i18next.t("search.hiddenFact"))
                .appendTo(tags);
        }
        else if (f.isHTMLHidden()) {
            $('<div class="hidden"></div>')
                .text(i18next.t("search.concealedFact"))
                .appendTo(tags);
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
        for (const [key, name] of Object.entries(SEARCH_FILTER_MULTISELECTS)) {
            spec[key] = $(`#${name} input:checked`).map((i,e) => $(e).val()).get();
        }


        const selectedDataTypes = this._reportSet.getUsedConceptDataTypes().filter(d => spec.dataTypesFilter?.includes(d.dataType.name));
        if (
            //XXX 
            (spec.conceptTypeFilter == 'numeric' && selectedDataTypes.some(dt => !dt.isNumeric)) ||
            (spec.conceptTypeFilter == 'text' && selectedDataTypes.some(dt => dt.isNumeric))) {
            $("#search-filter-datatypes .datatype-conflict-warning").show();
        }
        else {
            $("#search-filter-datatypes .datatype-conflict-warning").hide();
        }
        return spec;
    }

    hasActiveSearchFilters(searchSpec) {
        return Object.keys(SEARCH_FILTER_MULTISELECTS).some(k => searchSpec[k].length > 0);
    }

    buildSearchSection(fieldId, titleKey, options) {
        const id = "search-filter-" + fieldId;
        const section = $("<div></div>")
            .attr("id", id)
            .addClass("filter-group");
        $("<h3></h3>")
            .text(i18next.t(titleKey))
            .appendTo(section);
        for (const [i, o] of options.entries()) {
            const row = $("<div></div>")
                .addClass("checkbox-row")
                .appendTo(section);
            const rowId = id + '-' + i;
            $("<input></input>")
                .val(o.value)
                .attr("id", rowId)
                .attr("type", "checkbox")
                .appendTo(row)
                .after(" ");
            $("<label></label>")
                .text(o.label)
                .attr("for", rowId)
                .appendTo(row);
        }

        return section; 
    }

    setupSearchControls(viewer) {
        const inspector = this;

        const visibilityOptions = [
            { value: "visible", label: i18next.t("inspector.visible") },
            { value: "hidden", label: i18next.t("inspector.hidden") },
        ];
        this.buildSearchSection("visibility", "inspector.visibility", visibilityOptions).appendTo(".search-filters-body");

        const conceptTypeOptions = [
            { value: "numeric", label: i18next.t("inspector.numericOption") },
            { value: "text", label: i18next.t("inspector.textOption") },
        ];
        this.buildSearchSection("concept-type", "inspector.conceptType", conceptTypeOptions).appendTo(".search-filters-body");

        const factValueOptions = [
            { value: "positive", label: i18next.t("inspector.positive") },
            { value: "negative", label: i18next.t("inspector.negative") },
        ];
        this.buildSearchSection("fact-value", "inspector.factValue", factValueOptions).appendTo(".search-filters-body");

        const periodOptions = Object.entries(this._search.periods).map(([k,v]) => ({ value: k, label: v}));
        this.buildSearchSection("period", "inspector.period", periodOptions).appendTo(".search-filters-body");

        const namespacesOptions = Array.from(this._reportSet.getUsedConceptPrefixes())
            .map(prefix => ({
                value: prefix, 
                label: `${this._reportSet.preferredPrefix(prefix)} (${this._reportSet.prefixMap()[prefix]})`
            }));
        this.buildSearchSection("namespaces", "inspector.namespaces", namespacesOptions).appendTo(".search-filters-body");

        const datatypesOptions = this._reportSet.getUsedConceptDataTypes()
            .map(dt => ({ 
                value: dt.dataType.name, 
                label: dt.dataType.label() 
            }));
        if (datatypesOptions.length > 0) {
            this.buildSearchSection("datatypes", "inspector.datatypes", datatypesOptions).appendTo(".search-filters-body");
        }

        const targetDocuments = Array.from(this._reportSet.getTargetDocuments());
        if (targetDocuments.length != 1 || targetDocuments[0] !== null) {
            const targetDocumentsOptions = targetDocuments
                .map(td => ({ 
                    value: td ?? ':default', 
                    label: td ?? `<${i18next.t("search.default")}>`
                }));
            this.buildSearchSection("target-document", "inspector.targetDocument", targetDocumentsOptions).appendTo(".search-filters-body");
        }

        const unitsOptions = Array.from(this._reportSet.getUsedUnits())
            .map(unit => ({
                value: unit,
                label: `${this._reportSet.getUnit(unit)?.label()} (${unit})`
            }));
        if (unitsOptions.length > 0) {
            this.buildSearchSection("units", "inspector.units", unitsOptions).appendTo(".search-filters-body");
        }

        const scalesOptions = this._getScalesOptions();
        if (scalesOptions.length > 0) {
            this.buildSearchSection("scales", "inspector.scales", scalesOptions).appendTo(".search-filters-body");
        }

        const dimensionTypeOptions = [
            { value: "none", label: i18next.t("inspector.noDimensions") },
            { value: "explicit", label: i18next.t("inspector.explicitDimension") },
            { value: "typed", label: i18next.t("inspector.typedDimensions") },
        ];
        this.buildSearchSection("dimension-type", "inspector.dimensions", dimensionTypeOptions).appendTo(".search-filters-body");

        const calculationOptions = [
            { value: "none", label: i18next.t("inspector.noCalculations") },
            { value: "contributor", label: i18next.t("inspector.contributor") },
            { value: "summation", label: i18next.t("inspector.summation") },
        ];
        this.buildSearchSection("calculations", "inspector.calculations", calculationOptions).appendTo(".search-filters-body");

        if (this.summary.mandatoryFactsCount() > 0) {
            const mandatoryFactsFilterOptions = [
                { value: "mandatory", label: i18next.t("inspector.mandatoryFacts") },
                { value: "other", label: i18next.t("inspector.otherFacts") },
            ];
            this.buildSearchSection("mandatory-facts", "inspector.mandatoryFacts", mandatoryFactsFilterOptions).appendTo(".search-filters-body");
        }

        $(".search-controls input, .search-filters input, .search-filters select").on("change", () => this.search());
        $(".search-controls button.filter-toggle").on("click", () => $("#ixv").addClass('show-filters'));
        $(".search-filters .close").on("click", () => $("#ixv").removeClass('show-filters'));
        $(".search-filters button.search-apply-filters").on("click", () => $("#ixv").removeClass('show-filters'));
        $(".search-filters button.search-reset-filters").on("click", () => this.resetSearchFilters());
        $(".search-controls .search-filters .reset-multiselect").on("click", function () {
            $(this).siblings().children('select option:selected').prop('selected', false);
            inspector.search();
        });
    }

    _getScalesOptions() {
        const scalesOptions = {}
        const usedScalesMap = this._reportSet.getUsedScalesMap();
        Object.keys(usedScalesMap).sort().forEach(scale => {
            const labels = Array.from(usedScalesMap[scale]).sort();
            if (labels.length > 0) {
                scalesOptions[scale] = labels.join(', ');
            }
            else {
                scalesOptions[scale] = scale.toString();
            }
        });
        return Object.entries(scalesOptions)
            .map(([k, v]) => ({ value: k, label: v }));

    }

    resetSearchFilters(defaults) {
        defaults = defaults ?? {};
        for (const [filter, name] of Object.entries(SEARCH_FILTER_MULTISELECTS)) {
            $(`#${name} input`).prop("checked", false);
            if (defaults[filter] !== undefined) {
                $(`#${name} input[value="${defaults[filter]}"]`).prop("checked", true); 
            }
        }
        this.search();
    }

    searchReady() {
        this.setupSearchControls();
        $('#inspector').addClass('search-ready');
        $('#ixbrl-search').prop('disabled', false);
        this.search();
    }

    search() {
        const spec = this.searchSpec();
        if (this.hasActiveSearchFilters(spec)) {
            $("#inspector .search-controls").addClass("active-filters");
        }
        else {
            $("#inspector .search-controls").removeClass("active-filters");
        }
        const results = this._search.search(spec);
        if (results === undefined) {
            return;
        }
        const container = $('#inspector .search-results .results');
        container.empty();
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
        const totalFacts = this._reportSet.facts().length;
        $("#matching-facts-summary").text(i18next.t("search.matchingFactsSummary", {nMatches: results.length, nTotal: totalFacts}));
        $("#search-filter-match-count").text(results.length);
        /* Don't highlight search results if there's no search string */
        if (spec.searchString != "") {
            this._viewer.highlightRelatedFacts(results.map(r => r.fact));
        }
        for (const name of Object.values(SEARCH_FILTER_MULTISELECTS)) {
          this.updateMultiSelectSubheader(name);
        }
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
        const section = $('.calculations').empty();

        const calc = new Calculation(fact, this._useCalc11);
        if (!calc.hasCalculations()) {
            return;
        }

        const tableFacts = this._viewer.factsInSameTable(fact);
        const selectedELR = calc.bestELRForFactSet(tableFacts);
        const report = fact.report;

        for (const rCalc of calc.resolvedCalculations()) {
            const container = $("<div></div>").addClass("bordered-section").appendTo(section);
            $("<h4></h4>")
                .text(report.getRoleLabelOrURI(rCalc.elr))
                .appendTo(container);

            const content = $("<div></div>").addClass("content").appendTo(container);

            for (const r of rCalc.rows) {
                const row = $("<div></div>")
                    .addClass("calculation-row")
                    .appendTo(content);
                const iconBox = $("<div></div>").addClass("icon-box").appendTo(row);
                $("<div></div>").addClass("icon-bar").appendTo(iconBox);
                const icon = $("<div></div>")
                    .addClass("icon")
                    .appendTo(iconBox);
                if (r.weight == 1) {
                    icon.addClass("plus");
                }
                if (r.weight == -1) {
                    icon.addClass("minus");
                }

                const details = $("<div></div>")
                    .addClass("calculation-details")
                    .addClass("item")
                    .appendTo(row);
                if (!r.facts.isEmpty()) {
                    const value = $("<div></div>")
                        .addClass("calculation-value")
                        .text(r.facts.mostPrecise().readableValue())
                        .appendTo(details);
                }
                else {
                    $("<div></div>")
                        .addClass("not-reported")
                        .text(i18next.t("calculation.notReported"))
                        .appendTo(details);
                }
                const conceptLabel = $("<div></div>")
                        .addClass("calculation-label")
                        .text(r.concept.label())
                        .appendTo(details);

                if (!r.facts.isEmpty()) {
                    conceptLabel.contents().wrap($("<button></button>")
                        .addClass("inline-button")
                        .addClass("underline")
                        .addClass("negate-padding"));
                    details
                        .addClass("calc-fact-link")
                        .data('ivids', r.facts.items().map(f => f.vuid));
                    row.on("click", () => this.selectItem(r.facts.items()[0].vuid));
                    row.on("mouseenter", () => r.facts.items().forEach(f => this._viewer.linkedHighlightFact(f)));
                    row.on("mouseleave", () => r.facts.items().forEach(f => this._viewer.clearLinkedHighlightFact(f)));
                    r.facts.items().forEach(f => this._viewer.highlightRelatedFact(f));
                }
            }

            const row = $("<div></div>").addClass("calculation-row").appendTo(content);
            const iconBox = $("<div></div>").addClass("icon-box").appendTo(row);
            $("<div></div>").addClass("icon-bar").appendTo(iconBox);
            const icon = $("<div></div>")
                .addClass("icon")
                .addClass("equals")
                .appendTo(iconBox);

            const details = $("<div></div>").addClass("calculation-details").appendTo(row);
            const value = $("<div></div>")
                .addClass("calculation-value")
                .text(fact.readableValue())
                .appendTo(details);

            const statusTable = $("<table></table>")
                .addClass("property-table")
                .addClass("narrow-header")
                .appendTo(content);

            let statusText = "";
            if (rCalc.binds()) {
                if (rCalc.isConsistent()) {
                    statusText = i18next.t('factDetails.calculationValuesMatch');
                }
                else {
                    statusText = i18next.t('factDetails.calculationValuesDoNotMatch');
                }
            }
            else if (rCalc.unchecked()) {
                if (rCalc.uncheckedDueToVersionMismatch()) {
                    statusText = i18next.t('factDetails.calculationUncheckedIncorrectVersion');
                }
                else {
                    statusText = i18next.t('factDetails.calculationUnchecked');
                }
            }

            const statusRow = $("<tr></tr>").appendTo(statusTable);
            $("<th></th>").text(i18next.t("calculation.status")).appendTo(statusRow);
            $("<td></td>").text(statusText).appendTo(statusRow);
            const detailsLinkRow = $("<tr></tr>").appendTo(statusTable);
            $("<th></th>").appendTo(detailsLinkRow);
            const detailsCell = $("<td></td>")
                .addClass("contains-button")
                .appendTo(detailsLinkRow);

            $("<button></button>")
                .addClass("inline-button")
                .addClass("link-icon")
                .addClass("negate-padding")
                .addClass("underline")
                .appendTo(detailsCell)
                .append($("<div></div>").text(i18next.t("calculation.showDetails")))

                .attr("title", i18next.t('factDetails.viewCalculationDetails'))
                .on("click", (e) => {
                    const dialog = new CalculationInspector();
                    dialog.displayCalculation(rCalc);
                    dialog.show();
                    e.stopPropagation();
                });

        }
    }

    createSummary() {
        const summaryDom = $("#inspector .overview-inspector .body");
        this._populateAboutSummary(summaryDom);
        this._populateFactSummary(summaryDom);
        this._populateTagSummary(summaryDom);
        this._populateNamespaceSummary(summaryDom);
        this._populateFileSummary(summaryDom);
        this._populateDownloadsSummary(summaryDom);
        this._populateReportCreation(summaryDom);
    }

    _populateAboutSummary(summaryDom) {
        const aboutTableBody = summaryDom.find("table.about tbody");
        if (this._viewer.documentCount() === 1) {
            const row = $("<tr></tr>").appendTo(aboutTableBody);
            $("<th></th>")
                .text(i18next.t("inspector.summary.about.title"))
                .appendTo(row);

            const cell = $("<td></td>")
                .appendTo(row)
                .text(this._viewer.getTitle(0));
        }
        const entityNames = Array.from(new Set(this.summary.entityNames().map(f => f.value())));
        if (entityNames.length > 0) {
            const row = $("<tr></tr>").appendTo(aboutTableBody);
            $("<th></th>")
                .text(i18next.t("inspector.summary.about.name"))
                .appendTo(row);

            const cell = $("<td></td>").appendTo(row);
            for (const entityName of entityNames) {
                $("<span></span>")
                    .text(entityName)
                    .appendTo(cell);
                $("<br />").appendTo(cell);
            }
        }
        for (const identifier of this.summary.identifiers()) {
            const identifierQName = this._reportSet.qname(identifier);
            const name = Identifiers.identifierName(identifierQName);
            const row = $("<tr></tr>").appendTo(aboutTableBody);
            $("<th></th>")
                .text(name ?? i18next.t("inspector.summary.about.entity"))
                .appendTo(row);
            const cell = $("<td></td>").appendTo(row);
            $("<span></span>")
                .text(identifierQName.localname)
                .appendTo(cell);
            const link = Identifiers.seeMoreLink(identifierQName);
            if (link !== undefined) {
                $("<br />").appendTo(cell);
                cell.append(this._externalLink(link.href, link.text));
            }
        }
    }

    _externalLink(url, text) {
        return $("<a></a>")
            .addClass("external-link")
            .attr("target", "_blank")
            .attr("href", url)
            .text(text);
    }

    _populateFactSummary(summaryDom) {
        const totalFacts = this.summary.totalFacts();
        $(".total-facts-value", summaryDom)
            .text(totalFacts)
            .on("click", () => {
                this.resetSearchFilters();
                this.inspectorMode("search-mode");
            });

        const hiddenFacts = this.summary.hiddenFacts();
        $(".hidden-facts-value", summaryDom)
            .text(hiddenFacts)
            .on("click", () => {
                this.resetSearchFilters({visibilityFilter: 'hidden'});
                this.inspectorMode("search-mode");
            });

        const mandatoryFacts = this.summary.mandatoryFactsCount();
        if (mandatoryFacts === 0) {
            $('#mandatory-facts-row').hide();
        } else {
            $('#mandatory-facts-row').show();
            $(".mandatory-facts-value", summaryDom)
                    .text(mandatoryFacts)
                    .on("click", () => {
                        this.resetSearchFilters({mandatoryFactsFilter: "mandatory"});
                        this.inspectorMode("search-mode");
                    });
        }
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
        }

        function insertTagCount(row, count, total) {
            let percent = 0;
            if (total > 0) {
                percent = count / total;
            }
            let formattedPercent = percent.toLocaleString(undefined, {
                style: "percent",
            });

            let cell = $("<td></td>")
                    .addClass("figure")
                    .appendTo(row);
            let div = $("<div></div>").appendTo(cell);
            $("<span></span>")
                .addClass("tag-count-number")
                .text(count)
                .appendTo(div);
            $("<span></span>")
                .addClass("tag-count-percent")
                .text(formattedPercent)
                .appendTo(div);
        }

        const sortedPrefixCounts = [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (const [prefix, counts] of sortedPrefixCounts) {
            const countRow = $("<tr></tr>").appendTo(summaryTagsTableBody);
            countRow.append($("<th></th>").attr("scope", "row").text(this._reportSet.preferredPrefix(prefix)));
            insertTagCount(countRow, counts[PRIMARY_ITEMS_KEY], totalPrimaryItemTags);
            insertTagCount(countRow, counts[DIMENSIONS_KEY], totalDimensionTags);
            insertTagCount(countRow, counts[MEMBERS_KEY], totalMemberTags);
        }

        const summaryTagsTableFooterRow = summaryDom.find(".tag-summary-table-footer-row");

        insertTagCount(summaryTagsTableFooterRow, totalPrimaryItemTags, totalPrimaryItemTags);
        insertTagCount(summaryTagsTableFooterRow, totalDimensionTags, totalDimensionTags);
        insertTagCount(summaryTagsTableFooterRow, totalMemberTags, totalMemberTags);
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
        let visibleItems = 0;

        function insertFileSummary(docs) {
            const ul = summaryFilesContent.find('ul.files-summary-list')
            visibleItems += 1;
            for (const doc of docs) {
                ul.append($("<li></li>").text(doc));
            }
        }

        insertFileSummary(inline);
        insertFileSummary(schema);
        insertFileSummary(presLinkbase);
        insertFileSummary(calcLinkbase);
        insertFileSummary(defLinkbase);
        insertFileSummary(labelLinkbase);
        insertFileSummary(refLinkbase);
        insertFileSummary(unrecognizedLinkbase);
        if (visibleItems == 0) {
            summaryFilesContent.hide();
        }
    };

    _colorIndexForNamespace(namespace) {
        const key = this._reportSet.namespaceGroups().map(p => this._reportSet.preferredPrefix(p));
        return key.indexOf(namespace) % HIGHLIGHT_COLORS;
    }

    _populateNamespaceSummary(summaryDom) {
        let key;
        if (this._iv.isReviewModeEnabled()) {
            key = [
                "XBRL Elements",
                "Untagged Numbers",
                "Untagged Dates",
            ]
        } else {
            key = this._reportSet.namespaceGroups().map(p => this._reportSet.preferredPrefix(p));
        }
        this._iv.callPluginMethod("extendHighlightKey", key);

        const tableBody = summaryDom.find("table.namespace-key tbody");
        
        for (const [i, name] of key.entries()) {
            const row = $("<tr></tr>").appendTo(tableBody);
            $("<th></th>")
                .append($("<span></span>").addClass("sample").addClass("sample-" + (i % HIGHLIGHT_COLORS)))
                .appendTo(row);
            $("<td></td>")
                .text(name)
                .appendTo(row);
        }

    }

    _populateDownloadsSummary(summaryDom) {
        // Actions
        if (this._reportSet.filingDocuments()) {
            summaryDom.find(".filing-documents .download-link").attr("href", this._reportSet.filingDocuments());
        }
        else {
            summaryDom.find(".filingDocuments").hide();
            summaryDom.find(".downloads-summary").hide();
        }
    }

    _populateReportCreation(summaryDom) {
        const softwareCredits = this.summary.getSoftwareCredits();

        const reportCreationContent = summaryDom.find(".report-creation");

        if (softwareCredits.length > 0) {
            const ul = reportCreationContent.find('ul');
            for (const softwareCredit of softwareCredits) {
                ul.append($("<li></li>").text(softwareCredit));
            }
        } else {
            reportCreationContent.hide();
        }
    };

    createOutline() {
        if (this.outline.hasOutline()) {
            $('.outline .no-outline-overlay').hide();
            $('.outline .body').empty();
            const container = $('<div class="fact-list"></div>').appendTo($('.outline .body'));
            for (const group of this.outline.sortedSections()) {
                $('<button class="fact-list-item"></button>')
                    .text(group.report.getRoleLabelOrURI(group.elr))
                    .on("click", () => this.selectItem(group.firstFact.vuid))
                    .on("dblclick", () => $('#inspector').removeClass("outline-mode"))
                    .on("mousedown", (e) => {
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
        for (const group of this.outline.groupsForFact(cf)) {
            $('<button class="fact-list-item"></button>')
                .text(cf.report.getRoleLabelOrURI(group.elr))
                .on("click", () => this.selectItem(group.fact.vuid))
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

    _updateAnchorList(fact, anchors, container) {
        container.empty();
        if (anchors.length > 0) {
            for (const c of anchors) {
                const otherFacts = fact.report.getAlignedFacts(fact, { "c": c });
                const labelLang = fact.report.getLabelAndLang(c, "std", true);
                this.factLinkHTML(labelLang, otherFacts)
                    .addClass("negate-indent")
                    .appendTo(container);
            }
        }
        else {
            $("<span></span>")
                .text(i18next.t("common.none"))
                .appendTo(container);
        }
    }

    updateAnchoring(fact) {
        if (!this._reportSet.usesAnchoring()) {
            $('.anchoring').hide();
        }
        else {
            $('.anchoring').show();
            this._updateAnchorList(fact, fact.widerConcepts(), $(".anchoring .anchors-wider"));
            this._updateAnchorList(fact, fact.narrowerConcepts(), $(".anchoring .anchors-narrower"));
        }

    }

    labelRoleSort([role1, roleLabel1, label1], [role2, roleLabel2, label2]) {
        // Sort built-ins before others. Reverse so that -1 (not found) sorts
        // after the last built-in.
        const builtIn = ['std', 'doc'].reverse();
        const p1 = builtIn.indexOf(role1);
        const p2 = builtIn.indexOf(role2);

        if (p1 != p2) {
            return p2 - p1;
        }
    
        return roleLabel1.localeCompare(roleLabel2);
    }

    updateLabels(fact) {
        const tbody = $("table.labels tbody").empty();  
        for (const [role, roleLabel, label] of 
            Object.entries(fact.concept().labels())
            .map(([role, label]) => [role, fact.report.getLabelRoleLabel(role), label])
            .sort(this.labelRoleSort)) {
            const row = $("<tr></tr>").appendTo(tbody);
            $("<th></th>")
                .text(roleLabel)
                .appendTo(row);
            $("<td></td>")
                .text(label)
                .appendTo(row);
        }
    }

    updateReferences(fact) {
        const container = $("div.references").empty();
        for (const [i, r] of fact.concept().references().entries()) {
            const div = $("<div></div>").addClass("bordered-section").appendTo(container);
            const title = $("<h4></h4>").text(r[0].value).appendTo(div);
            const content = $("<div></div>").addClass("content").appendTo(div);
            const table = $("<table></table>").addClass("property-table").appendTo(content);
            const tbody = $("<tbody></tbody>").appendTo(table);

            for (const p of r) {
                const row = $("<tr>")
                    .append($("<th></th>").text(i18next.t(`referenceParts:${p.part}`, {defaultValue: p.part})))
                    .appendTo(tbody);
                if (p.part != "URI") {
                    $("<td></td>").text(p.value).appendTo(row);
                }
                else {
                    row.addClass("uri");
                    $("<td></td>").append(
                        this._externalLink(p.value, i18next.t(`inspector.goToReference`))
                    ).appendTo(row);
                }
            }
        }
    }


    _footnotesHTML(fact) {
        const html = $("<div></div>").addClass("fact-list");
        for (const fn of fact.footnotes()) {
            if (fn instanceof Footnote) {
                $("<button></button>")
                    .addClass("block-list-item")
                    .text(truncateLabel(fn.textContent(), 120))
                    .on("mouseenter", () => this._viewer.linkedHighlightFact(fn))
                    .on("mouseleave", () => this._viewer.clearLinkedHighlightFact(fn))
                    .on("click", () => this.selectItem(fn.vuid))
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

    factLinkHTML(labelLang, factList) {
        const html = $("<button></button>")
            .addClass("inline-button")
            .addClass("underline");
        this._setLabelWithLang(html, labelLang);
        if (factList.length > 0) {
            html
            .addClass("fact-link")
            .on("click", () => this.selectItem(factList[0].vuid))
            .on("mouseenter", () => factList.forEach(f => this._viewer.linkedHighlightFact(f)))
            .on("mouseleave", () => factList.forEach(f => this._viewer.clearLinkedHighlightFact(f)));
        }
        return html;
    }

    getPeriodIncrease(fact) {
        let s = "";
        if (fact.isNumeric()) {
            const otherFacts = fact.report.getAlignedFacts(fact, {"p":null });
            var mostRecent;
            if (fact.periodTo()) {
                for (const other of otherFacts) {
                    if (other.periodTo() && other.periodTo() < fact.periodTo() && (!mostRecent || other.periodTo() > mostRecent.periodTo()) && fact.isEquivalentDuration(other)) {
                        mostRecent = other;
                    }
                }
            }
            if (mostRecent) {
                const allMostRecent = fact.report.getAlignedFacts(mostRecent);
                s = $("<span></span>")
                        .text(this.describeChange(mostRecent, fact))
                        .append(this.factLinkHTML({label: mostRecent.periodString()}, allMostRecent));

            }
            else {
                s = $("<i>").text(i18next.t('factDetails.noPriorFactInThisReport'));
            }
        }
        else {
            s = $("<i>").text("n/a").attr("title", i18next.t('factDetails.nonNumericFact'));
        }
        $(".fact-properties tr.change td").html(s);

    }

    _updateValue(item, showAll, context) {
        const valueHTML = item.readableValueHTML();
        const tr = $('tr.value', context);
        const valueSpan = tr.find('td .value').empty();
        if (!(item instanceof Fact && item.isNumeric()) && !showAll) {
            const vv = wrapLabel(valueHTML.textContent, 120);
            if (vv.length > 1) {
                tr.addClass("truncated");
                tr.find('.show-all')
                    .off('click')
                    .on('click', () => this._updateValue(item, true, context));
            }
            else {
                tr.removeClass('truncated');
            }
            valueSpan.text(vv[0]);
        }
        else {
            tr.removeClass('truncated');
            valueSpan.append(valueHTML);
        }

        // Only enable text block viewer for escaped, text block facts.  This
        // ensure that we're only rendering fragments of the main documents, rather
        // than potentially arbitrary strings.
        if (TextBlockViewerDialog.canRender(item)) {
            tr
                .addClass('text-block')
                .find('.expand-text-block')
                    .off().on("click", () => this.showTextBlock(item));
        }
        else {
            tr.removeClass('text-block');
        }

    }

    showTextBlock(item) {
        const tbd = new TextBlockViewerDialog(item);
        tbd.displayTextBlock();
        tbd.show();
    }

    _updateDataType(fact, context) {
        const dt = fact.concept()?.dataType();
        if (dt !== undefined) {
            $('tr.datatype td', context).text(dt.label());
        }
        else {
            $('tr.datatype', context).hide();
        }
    }

    _updateBalance(fact, context) {
        const b = fact.concept()?.balance();
        if (b !== undefined) {
            $('tr.balance td', context).text(b.label());
        }
        else {
            $('tr.balance', context).hide();
        }
    }

    _updateConcept(fact, context) {
        const localname = fact.conceptQName().localname;
        $('tr.concept td', context)
            .find('.text')
                .text(localname)
                .attr("title", localname)
            .end()
            .find('.clipboard-copy')
                .data('cb-text', localname)
            .end();
    }

    _updateNamespace(fact, context) {
        const prefix = fact.conceptTaxonomyName().prefix;
        $('tr.namespace td', context)
            .find(".text")
              .text(prefix)
            .end()
            .find(".key")
              .addClass("sample-" + (this._colorIndexForNamespace(prefix)))
            .end();
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

    _setLabelWithLang(elt, labelLang) {
        elt.removeAttr("lang");
        if (labelLang.label !== undefined) {
            elt.text(labelLang.label);
            if (labelLang.lang !== undefined) {
                elt.attr("lang", labelLang.lang);
            }
        }
        else {
            elt.text("");
        }
        return elt;
    }

    /* 
     * Build an accordian containing a summary of all nested facts/footnotes
     * corresponding to the current viewer selection.
     */
    _selectionSummaryAccordian() {
        const fact = this._currentItem;

        if (this._currentItemList.length > 1) {
            $("div.nested-item-select").show();
            const select = $("div.nested-item-select select").empty();
            const fs = new FactSet(this._currentItemList);
            for (const [i, item] of this._currentItemList.toReversed().entries()) {
                let factHTML;
                const title = fs.minimallyUniqueLabel(item);
                const option = $("<option></option>")
                    .text(title)
                    .val(item.vuid)
                    .appendTo(select);
                if (fact.vuid === item.vuid) {
                    option.prop("selected", "selected");
                    $("div.nested-item-select .description")
                        .text(i18next.t('factDetails.nestedFactSummary', {
                            current: i + 1,
                            total: this._currentItemList.length
                        }));
                }
            }
        }
        else {
            $("div.nested-item-select").hide();
        }
    
        let factHTML;
        if (fact instanceof Fact) {
            factHTML = $(require('../html/fact-details.html')); 
            this._setLabelWithLang($('.std-label', factHTML), fact.getLabelOrNameAndLang("std", true));
            this._updateConcept(fact, factHTML);
            this._updateNamespace(fact, factHTML);
            $('tr.period td', factHTML)
                .text(fact.periodString());
            if (fact.isNumeric()) {
                $('tr.period td', factHTML).append(
                    $("<button></button>") 
                        .addClass(["analyse", "inline-button"])
                        .attr("title", i18next.t("inspector.showAnalysisChart"))
                        .text("")
                        .on('click', () => this.analyseDimension(fact, ["p"]))
                );
            }
            this._updateDataType(fact, factHTML);
            this._updateBalance(fact, factHTML);
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
                $('.section.dimensions', factHTML).hide();
            }
            else {
                $('.section.dimensions', factHTML).show();
            }
            for (const aspect of taxonomyDefinedAspects) {
                const h = this._setLabelWithLang($('<div class="dimension"></div>'), aspect.labelOrNameAndLang())
                    .appendTo($('#dimensions', factHTML));
                if (fact.isNumeric()) {
                    h.append(
                        $("<button></button>") 
                            .addClass(["analyse", "inline-button"])
                            .attr("title", i18next.t("inspector.showAnalysisChart"))
                            .text("")
                            .on("click", () => this.analyseDimension(fact, [aspect.name()]))
                    )
                }
                const s = this._setLabelWithLang($('<div class="dimension-value"></div>'), aspect.valueLabelAndLang())
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
        return factHTML;
    }

    analyseDimension(fact, dimensions) {
        const chart = new IXBRLChart();
        chart.analyseDimension(fact, dimensions);
    }

    toggleTooltip(icon) {
        if ($("#tooltip").hasClass("show")) {
            this.hideTooltip();
        }
        else {
            this.showTooltip(icon);
        }
    }

    showTooltip(icon, hoverShow) {
        icon.closest(".has-tooltip").attr("aria-describedby", "tooltip");
        $("#tooltip .tooltip-text").text(i18next.t(`tooltips:${icon.data("tooltip-name")}`));
        $("#tooltip").addClass(hoverShow ? "hover-show" : "show");
        const glossaryLink = icon.data("tooltip-glossary-link");
        if (glossaryLink) {
            $("#tooltip").addClass("with-glossary-link");
            const url = new URL(GLOSSARY_URL);
            if (typeof glossaryLink === 'string' && glossaryLink.startsWith("#")) {
                url.hash = glossaryLink;
            }
            $("#tooltip .glossary-link a").attr("href", url.href);
        }
        else {
            $("#tooltip").removeClass("with-glossary-link");
        }
        this.positionTooltip(icon);
    }

    hideTooltip(hoverShow) {
        const t = $("#tooltip");
        t.removeClass(hoverShow ? "hover-show" : "show");
        if (!t.hasClass("hover-show") && !t.hasClass("show")) {
            $(".has-tooltip").removeAttr("aria-describedby");
        }
    }


    positionTooltip(e) {
        const iconPos = e.offset();
        const tooltipWidth = 300;
        const clientWidth = document.documentElement.clientWidth;
        const right = clientWidth - Math.min(clientWidth - 30, iconPos.left + tooltipWidth);
        const left = Math.min(clientWidth - tooltipWidth, iconPos.left);

        $("#tooltip")
            .css("inset","")
            .css("position", "fixed")
            .css("left",  left)
            .css("right",  right)
            .css("top", iconPos.top + 30);

        // In quirks mode, clientHeight of body is viewport height.  In standards
        // mode, clientHeight of html is viewport height.
        const quirksMode = document.compatMode != 'CSS1Compat';
        const de = quirksMode ? document.body : document.documentElement ;

        if ($("#tooltip").get(0).getBoundingClientRect().bottom > de.clientHeight) {
          $("#tooltip").css("top","").css("bottom", 30);
        }
    }

    update() {
        const cf = this._currentItem;
        if (!cf) {
            $('#inspector').removeClass('footnote-mode');
            $('#inspector').addClass('no-fact-selected');
            if (this.outline.hasOutline()) {
                $('#inspector').addClass('show-facts-by-group');
            }
        } 
        else { 
            $('#inspector').removeClass('no-fact-selected').removeClass("hidden-fact").removeClass("html-hidden-fact");
            $('#inspector .tags').show();

            $('#inspector .fact-inspector-body')
                .empty()
                .append(this._selectionSummaryAccordian());

            if (cf instanceof Fact) {
                $('#inspector').removeClass('footnote-mode');
                this._setLabelWithLang($('#inspector .concept-name-title'), cf.getLabelOrNameAndLang("std"));
                this.updateCalculation(cf);
                this.updateOutline(cf);
                this.updateFootnotes(cf);
                this.updateAnchoring(cf);
                this.updateReferences(cf);
                this.updateLabels(cf);
                $('#inspector .fact-list-item').removeClass('selected');
                $('#inspector .fact-list-item').filter((i, e) => $(e).data('ivid') == cf.vuid).addClass('selected');

                const duplicates = cf.duplicates();
                let n = 0;
                const ndup = duplicates.length;
                for (var i = 0; i < ndup; i++) {
                    if (cf.vuid == duplicates[i].vuid) {
                        n = i;
                    }
                }

                $('nav.tag-nav-all-facts .text').text(i18next.t('factDetails.factCount', { 
                    current: this._viewer.docOrderItemIndex.indexOf(cf.vuid) + 1, 
                    total: this._viewer.docOrderItemIndex.length()
                }));

                if (ndup > 1) {
                    $('.duplicates').show();
                    $('.tag-nav-duplicates .text').text(i18next.t('factDetails.duplicatesCount', { current: n + 1, total: ndup}));
                    $('.tag-nav-duplicates .prev-tag').off().on("click", () => { this.selectItem(duplicates[(n+ndup-1) % ndup].vuid); $('.tag-nav-duplicates .prev-tag').get(0).focus(); });
                    $('.tag-nav-duplicates .next-tag').off().on("click", () => { this.selectItem(duplicates[(n+1) % ndup].vuid); $('.tag-nav-duplicates .next-tag').get(0).focus(); });
                }
                else {
                    $('.duplicates').hide();
                }

                this.getPeriodIncrease(cf);
                if (cf.isHidden()) {
                    $('#inspector').addClass('hidden-fact');
                }
                else if (cf.isHTMLHidden()) {
                    $('#inspector').addClass('html-hidden-fact');
                }

                const target = cf.targetDocument();
                if (target !== null) {
                    $('#inspector .target-document-tag').text(target).show();
                }
                else {
                    $('#inspector .target-document-tag').hide();
                }

            }
            else if (cf instanceof Footnote) {
                $('#inspector').addClass('footnote-mode');
                $('#inspector .footnote-details .footnote-facts').empty().append(this._footnoteFactsHTML(cf));
                $('#inspector .concept-name-title').hide();
                $('#inspector .tags').hide();
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
     *
     * noInspectorReset selects the fact, but doesn't close
     * search/summary/outline mode in the inspector.
     */
    selectItem(vuid, itemIdList, noScroll, noInspectorReset) {
        if (itemIdList === undefined) {
            this._currentItemList = [ this._reportSet.getItemById(vuid) ];
        }
        else {
            this._currentItemList = [];
            for (const itemId of itemIdList) {
                this._currentItemList.push(this._reportSet.getItemById(itemId));
            }
        }
        this.switchItem(vuid, noScroll);
        if (!noInspectorReset) {
            this.inspectorMode("fact-mode", vuid !== null);
        }
    }

    /*
     * Switches the currently selected item.  Unlike selectItem, this does not
     * change the current list of "alternate" items.  
     *
     * For facts, the "id" must be in the current alternate fact list.
     *
     * For footnotes, we currently only support a single footnote being selected.
     */
    switchItem(vuid, noScroll) {
        if (vuid !== null) {
            this._currentItem = this._reportSet.getItemById(vuid);
            if (!noScroll) {
                this._viewer.showItemById(vuid);
            }
            this._viewer.highlightItem(vuid);
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
        const localStorageAppLang = localStorage.getItem(STORAGE_APP_LANGUAGE);
        if (localStorageAppLang) {
            return [ localStorageAppLang ];
        }
        const langs = window.navigator.languages || [ window.navigator.language || window.navigator.userLanguage ] ;
        if (langs.length == 0 || !langs[0]) {
            return ["en"];
        }
        return langs;
    }

    selectDefaultLanguage() {
        const al = this._reportSet.availableLanguages();
        for (const pl of this.preferredLanguages()) {
            for (const l of al) {
                if (l.toLowerCase() == pl.toLowerCase()) {
                    return l;
                }
            }
        }
        return this._reportSet.availableLanguages()[0];
    }

    setDocumentLanguage(lang) {
        this._viewerOptions.language = lang;
    }

    showValidationReport() {
        const vr = new ValidationReportDialog();
        vr.displayErrors(this._reportSet.validation());
        vr.show();
    }

    setupValidationReportIcon() {
        if (this._reportSet.hasValidationErrors()) {
            $("#ixv .validation-warning").show().on("click", () => this.showValidationReport());
        }
    }

    showValidationWarning() {
        if (this._reportSet.hasValidationErrors()) {
            const message = $("<div></div>").append("<p>This report contains <b>XBRL validation errors</b>.  These errors may prevent this document from opening correctly in other XBRL software.</p>");
            const mb = new MessageBox("Validation errors", message, "View Details", "Dismiss");
            mb.show(() => this.showValidationReport());
        }
    }

    zoomRelative(dir) {
        this._zoomLevel += dir;
        this._zoomLevel = Math.min(ZOOM_LEVELS.length -1, Math.max(0, this._zoomLevel));
        this._viewer.zoom(ZOOM_LEVELS[this._zoomLevel]);
        $("#zoom").val(this._zoomLevel);
    }

    zoomAbsolute(level) {
        this._zoomLevel = parseInt(level);
        this._viewer.zoom(ZOOM_LEVELS[this._zoomLevel]);
    }
}
