// Membandingkan dua potret dari potret_gaya.mjs; mencetak 40 perbedaan pertama dan jumlahnya (butir 473).
import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
let beda = 0, cetak = 0;
const PROP = 'display,position,top,right,bottom,left,width,height,min-width,max-width,min-height,max-height,margin-top,margin-right,margin-bottom,margin-left,padding-top,padding-right,padding-bottom,padding-left,flex-direction,flex-wrap,flex-grow,flex-shrink,flex-basis,order,grid-template-columns,grid-template-rows,grid-template-areas,grid-row-start,grid-row-end,grid-column-start,grid-column-end,row-gap,column-gap,align-items,align-self,align-content,justify-content,justify-items,justify-self,font-family,font-size,font-weight,line-height,letter-spacing,color,background-color,background-image,border-top-width,border-top-color,border-bottom-width,border-bottom-color,border-left-width,border-right-width,border-top-left-radius,box-shadow,opacity,transform,visibility,overflow-x,overflow-y,white-space,z-index,text-align,text-decoration-line,cursor,transition-property,transition-duration,animation-name,view-transition-name,isolation,content,list-style-type,overflow-wrap,scroll-padding-top,scroll-padding-bottom'.split(',');
function selisih(x, y) { const p = (x || '').split('|'), q = (y || '').split('|'); return PROP.map((n, i) => p[i] !== q[i] ? n + ': ' + p[i] + ' → ' + q[i] : null).filter(Boolean).join('; '); }
for (const nama of Object.keys(a.potret)) {
  const pa = a.potret[nama], pb = b.potret[nama];
  if (!pb) { console.log('HILANG', nama); beda++; continue; }
  if (pa.lebar !== pb.lebar || pa.tinggi !== pb.tinggi) { beda++; if (cetak++ < 40) console.log('UKURAN', nama, pa.lebar + 'x' + pa.tinggi, '→', pb.lebar + 'x' + pb.tinggi); }
  const mb = new Map(pb.el.map((e) => [e[0], e]));
  for (const e of pa.el) {
    const f = mb.get(e[0]);
    if (!f) { beda++; if (cetak++ < 40) console.log('ELEMEN HILANG', nama, e[0]); continue; }
    for (let i = 1; i <= 5; i++) {
      if (e[i] !== f[i]) {
        beda++;
        if (cetak++ < 40) {
          const jenis = ['', 'kotak', 'gaya', '::before', '::after', 'teks'][i];
          console.log('BEDA', nama, e[0], jenis, i >= 2 && i <= 4 ? selisih(a.gaya[e[i]], b.gaya[f[i]]) : e[i] + ' → ' + f[i]);
        }
      }
    }
  }
  if (pb.el.length !== pa.el.length) { beda++; if (cetak++ < 40) console.log('JUMLAH ELEMEN', nama, pa.el.length, '→', pb.el.length); }
}
console.log(Object.keys(a.potret).length, 'potret dibandingkan;', beda, 'perbedaan');
