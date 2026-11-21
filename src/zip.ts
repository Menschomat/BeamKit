function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Write the stored ZIP format shared by bundles and 3MF packages. */
export function storedZip(entries: readonly { name: string; data: Uint8Array }[]): ArrayBuffer {
  const text = new TextEncoder();
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    const name = text.encode(entry.name), crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length), view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(10, 0, true); view.setUint16(12, 33, true);
    view.setUint32(14, crc, true); view.setUint32(18, entry.data.length, true); view.setUint32(22, entry.data.length, true); view.setUint16(26, name.length, true);
    local.set(name, 30); local.set(entry.data, 30 + name.length); locals.push(local);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, entry.data.length, true); c.setUint32(24, entry.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.set(name, 46); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, entry) => sum + entry.length, 0);
  const buffer = new ArrayBuffer(offset + centralSize + 22), bytes = new Uint8Array(buffer); let cursor = 0;
  for (const part of [...locals, ...centrals]) { bytes.set(part, cursor); cursor += part.length; }
  const end = new DataView(buffer, cursor); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return buffer;
}
