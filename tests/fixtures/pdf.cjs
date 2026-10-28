// Small generated PDF, not third-party copyrighted material.
exports.makePdf = function (
  texts = ['Opening range hypothesis', 'Check slippage before testing'],
) {
  const objects = [
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const kids = [];
  for (const text of texts) {
    const pageId = objects.length,
      streamId = pageId + 1;
    const escaped = text.replace(/([\\()])/g, '\\$1');
    const stream = `BT /F1 12 Tf 50 700 Td (${escaped}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
    kids.push(`${pageId} 0 R`);
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${texts.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
};
