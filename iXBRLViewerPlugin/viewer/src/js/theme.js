// See COPYRIGHT.md for copyright information

import { IXBRL_VIEWER_DATASET_PREFIX, STORAGE_THEME } from "./util";

const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';
const APP_THEME_DATASET_NAME = `${IXBRL_VIEWER_DATASET_PREFIX}Theme`;

function getHtmlElement() {
    return document.querySelector('html');
}

export function getVariable(name) {
    const html = getHtmlElement();
    return getComputedStyle(html).getPropertyValue(name);
}

function setTheme(theme) {
    const html = getHtmlElement();
    html.dataset[APP_THEME_DATASET_NAME] = theme;
}

function getStoredTheme() {
    return localStorage.getItem(STORAGE_THEME);
}

function storeTheme(theme) {
    localStorage.setItem(STORAGE_THEME, theme);
}

export function getTheme() {
    const html = getHtmlElement();
    return html.dataset[APP_THEME_DATASET_NAME];
}

export function initializeTheme() {
    const storedTheme = getStoredTheme();
    if (storedTheme !== null) {
        setTheme(storedTheme);
    } else {
        setTheme(window.matchMedia(`(prefers-color-scheme: ${DARK_THEME})`).matches ? DARK_THEME : LIGHT_THEME);
    }
}

export function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
    setTheme(newTheme);
    storeTheme(newTheme);
}
