# Guía de Edición - RENT-A-SOFT-SA GitHub Pages

Esta guía explica cómo editar el contenido de la página web de la organización RENT-A-SOFT-SA alojada en GitHub Pages.

## Estructura del Sitio Web

El sitio web está compuesto por los siguientes archivos:

```
├── index.html          # Página principal
├── about.html          # Página "Sobre Nosotros"
├── services.html       # Página "Servicios"
├── contact.html        # Página "Contacto"
├── styles.css          # Estilos CSS
├── README.md           # Información del repositorio
└── EDITING_GUIDE.md    # Esta guía de edición
```

## Cómo Editar el Contenido

### 1. Acceder a los Archivos

1. Ve al repositorio en GitHub: `https://github.com/RENT-A-SOFT-SA/RENT-A-SOFT-SA.github.io`
2. Haz clic en el archivo que deseas editar
3. Haz clic en el ícono del lápiz (✏️) para editar

### 2. Editar Contenido de Texto

Para cambiar el texto de cualquier página:

1. Busca el contenido entre las etiquetas HTML
2. Modifica solo el texto, mantén las etiquetas HTML intactas
3. Ejemplo:
   ```html
   <!-- Antes -->
   <p>Texto anterior</p>
   
   <!-- Después -->
   <p>Nuevo texto</p>
   ```

### 3. Páginas Principales

#### Página Principal (index.html)
- **Título principal**: Busca `<h2>Bienvenido a RENT-A-SOFT-SA</h2>`
- **Descripción**: Busca la etiqueta `<p>` debajo del título
- **Tarjetas de sección**: Modifica los textos dentro de cada `<div class="card">`

#### Página Sobre Nosotros (about.html)
- **Misión**: Busca la sección `<h2>Misión</h2>`
- **Visión**: Busca la sección `<h2>Visión</h2>`
- **Valores**: Modifica los elementos `<li>` en la lista de valores

#### Página Servicios (services.html)
- **Servicios**: Cada servicio está en una sección con `<h2>`
- **Listas de características**: Modifica los elementos `<li>` de cada servicio

#### Página Contacto (contact.html)
- **Información de contacto**: Modifica las tarjetas dentro de `<div class="card">`
- **Horarios**: Actualiza la información en la lista de horarios

### 4. Cambiar Estilos y Colores

Para modificar la apariencia visual, edita el archivo `styles.css`:

#### Colores principales:
- **Color principal**: `#2c3e50` (azul oscuro)
- **Color secundario**: `#3498db` (azul)
- **Color de navegación**: `#333` (gris oscuro)
- **Color de fondo**: `#f4f4f4` (gris claro)

#### Cambiar colores:
```css
/* Ejemplo: cambiar color principal */
.hero {
    background-color: #nuevo-color;
}
```

### 5. Añadir Nuevas Páginas

Para agregar una nueva página:

1. Crea un nuevo archivo `.html` (por ejemplo: `nueva-pagina.html`)
2. Copia la estructura de una página existente
3. Modifica el contenido según necesites
4. Agrega el enlace en la navegación de todas las páginas:
   ```html
   <li><a href="nueva-pagina.html" class="nav-link">Nueva Página</a></li>
   ```

### 6. Configuración de GitHub Pages

GitHub Pages está configurado para publicar desde la rama `main`. Los cambios se reflejan automáticamente en:
`https://rent-a-soft-sa.github.io`

### 7. Consejos Importantes

- **Siempre haz una copia de seguridad** antes de hacer cambios importantes
- **Prueba los cambios** visualizando la página web después de cada modificación
- **Mantén la consistencia** usando el mismo formato y estilo en todas las páginas
- **No elimines las etiquetas HTML** - solo modifica el contenido de texto
- **Revisa la navegación** asegúrate de que todos los enlaces funcionen correctamente

### 8. Proceso de Edición Recomendado

1. Identifica qué contenido necesitas cambiar
2. Localiza el archivo correspondiente
3. Haz clic en "Edit" (✏️) en GitHub
4. Realiza los cambios
5. Agrega una descripción del cambio en "Commit changes"
6. Haz clic en "Commit changes"
7. Espera unos minutos y verifica los cambios en la página web

### 9. Solución de Problemas

**Si la página no se actualiza:**
- Espera 5-10 minutos (GitHub Pages puede tardar en actualizarse)
- Verifica que no hay errores en el HTML
- Revisa la configuración de GitHub Pages en Settings > Pages

**Si hay errores de formato:**
- Verifica que no hayas eliminado etiquetas HTML por accidente
- Asegúrate de que todas las etiquetas abran y cierren correctamente

### 10. Contacto para Soporte Técnico

Si necesitas ayuda adicional con la edición, contacta al equipo técnico a través de los issues del repositorio de GitHub.

---

*Esta guía se actualizará según sea necesario para incluir nuevas funcionalidades.*