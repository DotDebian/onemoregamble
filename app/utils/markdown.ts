// Minimal, XSS-safe markdown renderer for assistant messages.
// HTML is escaped FIRST, then a small subset of markdown is applied — so no
// untrusted HTML can ever reach the DOM. Supports: headings, bold/italic,
// inline code, fenced code blocks, bullet & ordered lists, blockquotes,
// GitHub-style tables, and safe http(s) links.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    // Links — only http(s) targets are allowed (javascript:/data: won't match).
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
}

const ROW_RE = /^\|(.+)\|$/
const SEP_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

export function renderMarkdown(input: string): string {
  const lines = escapeHtml(input).split(/\r?\n/)
  const html: string[] = []
  let i = 0
  let inList = false
  let listTag: 'ul' | 'ol' = 'ul'
  let inQuote = false

  const closeList = () => {
    if (inList) {
      html.push(`</${listTag}>`)
      inList = false
    }
  }
  const closeQuote = () => {
    if (inQuote) {
      html.push('</blockquote>')
      inQuote = false
    }
  }
  const openList = (tag: 'ul' | 'ol') => {
    if (inList && listTag !== tag) closeList()
    if (!inList) {
      html.push(`<${tag}>`)
      inList = true
      listTag = tag
    }
  }

  while (i < lines.length) {
    const line = lines[i]!.trim()

    // Fenced code block — content is taken verbatim (already escaped).
    if (/^```/.test(line)) {
      closeList()
      closeQuote()
      const body: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
        body.push(lines[i]!)
        i++
      }
      i++ // skip closing fence
      html.push(`<pre><code>${body.join('\n')}</code></pre>`)
      continue
    }

    // Table — a pipe row immediately followed by a separator row.
    const next = i + 1 < lines.length ? lines[i + 1]!.trim() : ''
    if (ROW_RE.test(line) && next.includes('|') && SEP_RE.test(next)) {
      closeList()
      closeQuote()
      const headers = splitCells(line)
      i += 2 // header + separator
      const rows: string[][] = []
      while (i < lines.length && ROW_RE.test(lines[i]!.trim())) {
        rows.push(splitCells(lines[i]!.trim()))
        i++
      }
      let t = '<table><thead><tr>'
      t += headers.map((h) => `<th>${inline(h)}</th>`).join('')
      t += '</tr></thead>'
      if (rows.length) {
        t += '<tbody>'
        t += rows
          .map(
            (r) =>
              '<tr>' + headers.map((_, ci) => `<td>${inline(r[ci] ?? '')}</td>`).join('') + '</tr>',
          )
          .join('')
        t += '</tbody>'
      }
      t += '</table>'
      html.push(t)
      continue
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const ordered = /^\d+\.\s+(.*)$/.exec(line)
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    const quote = /^&gt;\s?(.*)$/.exec(line) // `>` became `&gt;` after escaping

    if (bullet) {
      closeQuote()
      openList('ul')
      html.push(`<li>${inline(bullet[1]!)}</li>`)
    } else if (ordered) {
      closeQuote()
      openList('ol')
      html.push(`<li>${inline(ordered[1]!)}</li>`)
    } else if (quote) {
      closeList()
      if (!inQuote) {
        html.push('<blockquote>')
        inQuote = true
      }
      html.push(`<p>${inline(quote[1]!)}</p>`)
    } else if (heading) {
      closeList()
      closeQuote()
      const level = Math.min(heading[1]!.length, 4)
      html.push(`<h${level}>${inline(heading[2]!)}</h${level}>`)
    } else if (line === '') {
      closeList()
      closeQuote()
    } else {
      closeList()
      closeQuote()
      html.push(`<p>${inline(line)}</p>`)
    }
    i++
  }
  closeList()
  closeQuote()
  return html.join('')
}
