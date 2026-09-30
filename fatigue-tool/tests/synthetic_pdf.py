"""Build small synthetic roster PDFs for tests (no private roster content).

The PDF is written by hand with the standard Helvetica font, so no extra
dependency is needed and pdfplumber reads it like an exported roster.
"""


def _escape(text):
    return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def build_pdf(texts, lines=(), size=(842, 595)):
    """``texts``: (x, y, str) from the bottom-left in points; ``lines``: (x1, y1, x2, y2)."""
    ops = [f'{x1} {y1} m {x2} {y2} l S' for x1, y1, x2, y2 in lines]
    ops += [f'BT /F1 7 Tf {x} {y} Td ({_escape(t)}) Tj ET' for x, y, t in texts]
    stream = '\n'.join(ops).encode('latin-1')
    width, height = size
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        (f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] '
         '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>').encode(),
        b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out = b'%PDF-1.4\n'
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b'%d 0 obj\n' % number + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1)
    out += b''.join(b'%010d 00000 n \n' % offset for offset in offsets)
    out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref)
    return out


def crewlink_pdf(header_id_line='ID :100001 (LGW FO-A320)', columns=None, value_line='VALUE 07:30 16:00'):
    """A one-page CrewLink-style grid: header lines, then date columns with stacked cells.

    ``columns``: list of (date header, [cell lines]). Times are UTC.
    """
    columns = columns if columns is not None else [
        ('05Oct Mon', ['RPT:06:00', '1001', 'LGW', '07:00', 'AMS', '08:15', '(320)',
                       '1002', 'AMS', '09:00', 'LGW', '10:15', '(320)']),
        ('06Oct Tue', []),
        ('07Oct Wed', ['RPT:12:00', '1003', 'LGW', '13:00', 'MAD', '15:30', '(320)']),
        ('08Oct Thu', ['RPT:15:30', '1004', 'MAD', '16:30', 'LGW', '19:00', '(320)']),
        ('09Oct Fri', []),
    ]
    header = ['Crew Schedule Report CrewLink', 'Name : TEST PILOT', header_id_line,
              'Period: 01-Oct-2026 - 31-Oct-2026 | Published', 'All times are in UTC']
    if value_line:
        header.append(value_line)
    texts = [(40, 560 - 10 * i, line) for i, line in enumerate(header) if line]
    left, width, top, split, bottom = 40, 80, 470, 450, 250
    lines = [(left, top, left + width * len(columns), top), (left, split, left + width * len(columns), split),
             (left, bottom, left + width * len(columns), bottom)]
    lines += [(left + width * i, top, left + width * i, bottom) for i in range(len(columns) + 1)]
    for i, (date_header, cell) in enumerate(columns):
        x = left + width * i + 4
        texts.append((x, top - 12, date_header))
        texts += [(x, split - 10 - 9 * j, text) for j, text in enumerate(cell)]
    return build_pdf(texts, lines)
