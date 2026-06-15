export function renderLightMarkdown(text: string): string {
  if (!text) {
    return '';
  }

  const lines = text.split('\n');
  const blocks: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const listClass = listType === 'ul' ? 'list-disc' : 'list-decimal';
      blocks.push(`<${listType} class="${listClass} pl-5 space-y-1 my-2">${listItems.join('')}</${listType}>`);
      listItems = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);

    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(`<li>${inlineFormat(escapeHtml(ulMatch[1]))}</li>`);
    } else if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(`<li>${inlineFormat(escapeHtml(olMatch[1]))}</li>`);
    } else if (trimmed === '') {
      flushList();
      blocks.push('<br />');
    } else {
      flushList();
      blocks.push(`<p class="my-1">${inlineFormat(escapeHtml(trimmed))}</p>`);
    }
  }

  flushList();

  return blocks.join('\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

