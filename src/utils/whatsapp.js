// Mengubah nomor ke format 62xxxxxxxxxx. Mengembalikan null bila bukan nomor telepon yang valid.
function normalizeWhatsapp(input) {
  if (typeof input !== 'string') return null;
  let n = input.replace(/[\s\-().]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return /^62[0-9]{8,13}$/.test(n) ? n : null;
}
function waLink(kontak, nama) {
  const n = normalizeWhatsapp(kontak || '');
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(`Halo, saya melihat ${nama} di website Desa Bendungan.`)}`;
}
module.exports = { normalizeWhatsapp, waLink };
