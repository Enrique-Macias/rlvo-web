# RLVO — Web Design Direction

## Objetivo

Construir una landing editorial, cálida, moderna y confiable.

Debe sentirse diseñada específicamente para RLVO.

No debe parecer una plantilla SaaS.

---

## Fuente de verdad

La identidad visual de la aplicación móvil es la principal referencia.

Los tokens de este documento no deben modificarse sin aprobación.

---

## Colors — Paleta 06 aprobada

```css
--brand-primary: #183D39;
--brand-deep: #23635C;
--brand-accent: #78CDB5;
--brand-tint: #DDF5ED;
--brand-mist: #F5FAF8;
--brand-white: #FFFFFF;
```

Se pueden crear tintes derivados mediante color-mix() cuando sea apropiado.
No introducir nuevos colores principales sin aprobación.

---

## Roles

Los componentes consumen los roles de `src/styles/tokens.css`, no colores
literales ni los nombres de la identidad anterior.

- `text-primary`: verde principal; `text-secondary`: verde profundo.
- `surface-page`: F5FAF8; `surface-card`: blanco; `surface-subtle`: DDF5ED.
- `surface-inverse`: verde principal; texto blanco o menta claro.
- `surface-accent`: menta; texto verde principal cuando exista texto encima.
- `action-primary`: verde principal; hover verde profundo, ambos con blanco.
- `link`: verde profundo; hover verde principal y feedback por subrayado.
- `border-subtle`: separadores; `border-strong`: límites de mayor jerarquía.
- `focus-ring`: verde sobre claro; menta en superficies inversas.

La menta no se utiliza como texto sobre fondos claros. El verde profundo
sobre menta tampoco alcanza 4.5:1; esa combinación usa verde principal.
F5FAF8 y DDF5ED son superficies distintas. Los SVG conservan sus colores
originales aunque su nombre use el término «menta-claro».

---
## Typography
Display:
Fraunces
Uso:
- headlines
- elementos editoriales destacados
Body/UI:
Inter
Pesos preferidos:
400 / 500 / 600
Evitar exceso de pesos.
Fuentes autoalojadas.

La marca se presenta mediante los SVG oficiales, sin reconstruir su wordmark
con Fraunces. Inter y Fraunces mantienen los WOFF2 locales existentes.

---

## Radius
Escala existente:
8px
12px
14px
16px
20px
pill
No crear una escala paralela sin necesidad.

---

## Visual direction
Buscar:
- layouts editoriales
- whitespace intencional
- tipografía protagonista
- screenshots reales del producto
- contraste entre superficies
- composición asimétrica cuando ayude
- jerarquía clara
- detalles gráficos sutiles
Evitar:
- card grids repetitivos
- exceso de bordes
- glassmorphism genérico
- gradientes morados
- ilustraciones tech genéricas
- mock dashboards
- exceso de badges
- exceso de pills

---

## Hero
El hero debe comunicar rápidamente:
1. qué es RLVO
2. para quién es
3. por qué la verificación universitaria importa
4. que la app llegará próximamente
Debe existir un CTA claro sin inventar disponibilidad.

---

## Product screenshots
Cuando existan screenshots reales en:
/public/screenshots
pueden presentarse mediante marcos de teléfono.
No recrear pantallas ficticias.
La composición alrededor del dispositivo puede ser creativa.

---

## Motion
Usar movimiento únicamente para reforzar jerarquía o interacción.
Ejemplos aceptables:
- entrance suave
- hover states
- pequeños desplazamientos
- reveal de screenshots
- transiciones de navegación
Evitar:
- scroll hijacking
- parallax agresivo
- animaciones largas
- elementos moviéndose constantemente sin propósito
Respetar prefers-reduced-motion.

---

## Accessibility
WCAG AA como objetivo mínimo.
No asumir que cualquier combinación de tokens cumple contraste. El build
comprueba los pares de texto aprobados y el foco sobre superficies claras.
La revisión en navegador verifica los usos reales, estados y responsive.

---

## AppLlama
AppLlama puede explorar libremente:
- layout
- composición
- jerarquía
- spacing
- storytelling
- ritmo
- responsive behavior
- microinteracciones
Pero debe mantener:
- tokens
- tipografía
- personalidad
- facts del producto
- restricciones de marca
Las propuestas de AppLlama son dirección creativa, no fuente de verdad del
producto.
