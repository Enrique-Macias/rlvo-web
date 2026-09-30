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

## Colors

```css
--ink: #221F1C;
--ink-soft: #6B6660;
--paper: #F3F0EA;
--card: #FFFFFF;
--brick: #C1440E;
--forest: #2F6B4F;
--gold: #D9A441;
--slate: #5B6B78;
```

Se pueden crear tintes derivados mediante color-mix() cuando sea apropiado.
No introducir nuevos colores principales sin aprobación.

---

## Roles
ink
Texto principal y superficies oscuras.
ink-soft
Texto secundario.
paper
Fondo principal.
card
Superficies elevadas cuando realmente sean necesarias.
brick
Marca, acciones principales y acentos importantes.
forest
Confianza, verificación y estados positivos cuando corresponda.
gold / slate
Acentos secundarios y decorativos.
No competir visualmente con brick.

---
## Typography
Display:
Fraunces
Uso:
- headlines
- wordmark cuando corresponda
- elementos editoriales destacados
Body/UI:
Inter
Pesos preferidos:
400 / 500 / 600
Evitar exceso de pesos.
Fuentes autoalojadas.

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
Atención especial a:
--brick sobre --paper.
No asumir que cualquier combinación de tokens cumple contraste.
Verificar texto pequeño antes de usar brick como foreground.

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
