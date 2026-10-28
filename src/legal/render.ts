import { satteri } from '@astrojs/markdown-satteri';
import type { CanonicalDocument } from './canonical.ts';

// Procesador nativo de Astro, solo durante el build. No transforma puntuación.
const renderer = satteri({
  features: { gfm: false, smartPunctuation: false },
  hastPlugins: [{
    name: 'rlvo-legal-presentation',
    raw() { throw new Error('El contenido legal canónico no admite HTML sin procesar'); },
    element: {
      filter: ['h2', 'h3', 'p', 'a', 'img', 'pre', 'code', 'script'],
      visit(node, ctx) {
        if (['img', 'pre', 'code', 'script'].includes(node.tagName)) throw new Error('Elemento no admitido en Markdown legal');
        if (node.tagName === 'h2') {
          const match = ctx.textContent(node).match(/ \{#([a-z][a-z0-9-]*)\}$/);
          const last = node.children.at(-1);
          if (!match || last?.type !== 'text') throw new Error('Sección legal sin identificador explícito');
          ctx.replaceNode(last, { type: 'text', value: last.value.replace(/ \{#[a-z][a-z0-9-]*\}$/, '') });
          ctx.setProperty(node, 'id', `legal-heading-${match[1]}`);
        }
        if (node.tagName === 'h3') {
          const index = Number(ctx.data.legalSubheadingCounter ?? 0) + 1;
          ctx.data.legalSubheadingCounter = index;
          ctx.setProperty(node, 'id', `legal-subheading-${index}`);
        }
        if (node.tagName === 'a') {
          const href = node.properties.href;
          if (typeof href !== 'string' || !/^(?:https:\/\/|mailto:|\/(?!\/)|#)/.test(href)) throw new Error('Enlace no admitido en el documento canónico');
        }
        if (node.tagName !== 'p') return;
        if (/^\[\[POR CONFIRMAR: [\s\S]+\]\]$/.test(ctx.textContent(node))) ctx.setProperty(node, 'className', ['pending']);
        const link = node.children.length === 1 ? node.children[0] : undefined;
        if (link?.type === 'element' && link.tagName === 'a' && String(link.properties.href).startsWith('mailto:')) {
          ctx.setProperty(link, 'className', ['email-link']);
          ctx.appendChild(link, { type: 'element', tagName: 'span', properties: { ariaHidden: 'true' }, children: [{ type: 'text', value: '↗' }] });
        }
      },
    },
    after(root, ctx) {
      type Section = Extract<typeof root.children[number], { type: 'element' }>;
      const groups: Section[] = [];
      let section: Section | undefined;
      for (const child of root.children) {
        if (child.type !== 'text' && child.type !== 'element') throw new Error('Nodo no admitido en documentos legales');
        if (child.type === 'element' && child.tagName === 'h2') {
          const id = String(child.properties.id).replace(/^legal-heading-/, '');
          section = { type: 'element', tagName: 'section', properties: { id }, children: [child] };
          groups.push(section);
        } else if (section) section.children.push(child);
        else if (child.type !== 'text' || child.value.trim()) throw new Error('Contenido fuera de una sección legal');
      }
      ctx.replaceNode(root, { type: 'root', children: groups });
    },
  }],
}).createRenderer({ syntaxHighlight: false });

export async function renderLegalBody(document: CanonicalDocument): Promise<string> {
  return (await (await renderer).render(document.body)).code;
}
