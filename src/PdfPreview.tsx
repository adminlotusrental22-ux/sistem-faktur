import {useEffect,useRef,useState} from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;

export default function PdfPreview({url}:{url:string}) {
  const host=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let cancelled=false;
    const task=pdfjs.getDocument({url});
    setError('');setLoading(true);
    (async()=>{
      const pdf=await task.promise;
      for(let i=1;i<=pdf.numPages;i++) {
        if(cancelled)return;
        const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.5});
        const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
        canvas.style.cssText='width:100%;height:auto;max-width:850px;margin:0 auto 16px;display:block;box-shadow:0 2px 8px #0002';
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Invoice PDF halaman ${i} dari ${pdf.numPages}`);
        await page.render({canvas,viewport}).promise;
        if(cancelled)return;
        host.current?.appendChild(canvas);
      }
      if(!cancelled)setLoading(false);
    })().catch(e=>{if(!cancelled){setError('PDF tidak dapat ditampilkan. Gunakan tombol unduh untuk membuka file.');setLoading(false);console.error(e);}});
    return()=>{cancelled=true;void task.destroy();host.current?.replaceChildren();};
  },[url]);
  return <div className="overflow-y-auto bg-slate-200 p-3 flex-1 min-h-[40vh] sm:min-h-[55vh]" style={{maxHeight:'65vh'}}>{loading&&<p className="text-center text-sm p-6" role="status">Memuat PDF…</p>}{error&&<p role="alert" className="text-sm p-6 text-red-800">{error}</p>}<div ref={host}/></div>;
}
