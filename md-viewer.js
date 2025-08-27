// Visor de Markdown para RENT-A-SOFT-SA
// Utiliza la librería marked.js para renderizar archivos .md en HTML

// Obtiene el parámetro 'file' de la URL
function getMarkdownFileFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('file') || 'docs/mt_api_dev/index.md';
}

// Cargar y renderizar un archivo Markdown en un contenedor
function renderMarkdown(mdFilePath, containerId) {
    fetch(mdFilePath)
        .then(response => response.text())
        .then(md => {
            const html = marked.parse(md);
            document.getElementById(containerId).innerHTML = html;
        });
}

// Renderiza el archivo Markdown indicado por la URL
document.addEventListener('DOMContentLoaded', function() {
    const mdFile = getMarkdownFileFromURL();
    renderMarkdown(mdFile, 'md-content');
});
