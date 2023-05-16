export async function getTextContent(elementHandle) {
    return (await elementHandle.getProperty('textContent')).jsonValue();
}
