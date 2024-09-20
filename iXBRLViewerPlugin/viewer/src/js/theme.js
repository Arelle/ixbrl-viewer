// See COPYRIGHT.md for copyright information

function getHtmlElement() {
    return document.querySelector('html');
}

export function getVariable(name) {
    const html = getHtmlElement();
    return getComputedStyle(html).getPropertyValue(name);s
}

function setTheme(theme) {
    const html = getHtmlElement();
    html.dataset.theme = `theme-${theme}`;
    console.log('Set theme:', theme);
}

export function getTheme() {
    const html = getHtmlElement();
    return html.dataset.theme.replace('theme-','');
}

export function initializeTheme() {
    const initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    setTheme(initialTheme);
}

export function toggleTheme() {
    if (getTheme() === 'light') {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}
