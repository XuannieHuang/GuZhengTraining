/* book-photo.js — 課本封面：縮圖、上傳、取得可顯示的網址
 *
 * bucket 是 private（repo 公開，封面不放在任何人都猜得到的網址上），
 * 所以顯示要用簽名網址；簽名有期限，進畫面時一次批次產生、存在 BOOK_URL 裡。
 */

const BOOK_BUCKET = 'books';
let BOOK_URL = {};        // photo_path -> 簽名網址

/* 手機原圖動輒 3–5MB，直接傳很慢、免費額度也撐不久。
   上傳前先在前端縮到長邊 1000px、JPEG 0.8，一張約 150KB。 */
function shrinkImage(file, maxSide, quality){
  maxSide = maxSide || 1000; quality = quality || 0.8;
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width  = Math.max(1, Math.round(img.width  * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('轉檔失敗')), 'image/jpeg', quality);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('讀不到這張圖')); };
    img.src = url;
  });
}

/* 上傳一張封面，回傳它在 bucket 裡的路徑（存進 books.photo_path）。
   檔名用隨機值 —— 課本可以換封面，舊檔留著不覆蓋，也不會撞名。 */
async function uploadBookPhoto(file){
  const blob = await shrinkImage(file);
  const name = (crypto.randomUUID ? crypto.randomUUID()
                                  : String(Date.now()) + Math.random().toString(16).slice(2)) + '.jpg';
  const { error } = await sb.storage.from(BOOK_BUCKET)
    .upload(name, blob, { contentType:'image/jpeg', upsert:false });
  if(error) throw error;
  return name;
}

/* 一次把目前還沒有簽名網址的封面都簽好。進設定頁或盤點前呼叫一次就夠。 */
async function loadBookPhotos(paths){
  const want = (paths || DB.books.map(b=>b.photo))
    .filter(p => p && !BOOK_URL[p]);
  if(!want.length) return;
  const { data, error } = await sb.storage.from(BOOK_BUCKET).createSignedUrls(want, 3600);
  if(error) return;                       // 簽不到就顯示沒有封面，不要擋住整頁
  (data||[]).forEach(d=>{ if(d && d.path && d.signedUrl) BOOK_URL[d.path] = d.signedUrl; });
}

/* 清單／盤點用的縮圖；沒有封面就給一個灰底的佔位。 */
function bookThumb(b, cls){
  const url = b.photo && BOOK_URL[b.photo];
  return url
    ? `<img class="bthumb ${cls||''}" src="${url}" alt="">`
    : `<div class="bthumb ph ${cls||''}">📕</div>`;
}
