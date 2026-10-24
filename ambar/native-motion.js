/* peli-gop.js — la pelicula de scroll como VIDEO POR GRUPOS, decodificada por hardware (WebCodecs).
   Ascenta, 4-oct-2026. Se carga DENTRO de un worker (importScripts) y no toca el DOM.

   Por que: una imagen por fotograma pesaba 245 MB (Bastida a 2560) o 314 MB (Solenne) y en una conexion
   normal la pelicula se congelaba. Fotogramas seguidos son casi iguales; como video H.264 con una clave
   cada G fotogramas pesan 2,5-4x menos y el telefono los decodifica con el chip de video, no con la CPU.

   Como funciona:
   · bytes: se bajan grupos enteros (g_0000.h264...) por delante del cursor, en la direccion del scroll,
     y una rejilla gruesa de toda la pelicula para que un salto lejano encuentre algo cerca.
   · fotogramas: se decodifica el GRUPO entero que hace falta (de su clave en adelante) en uno de dos
     decodificadores, y cada fotograma queda como ImageBitmap en una ventana con presupuesto de memoria.
   · quien pinta pregunta `cerca(i)`: el exacto si esta; si no, el mas cercano SIN volver atras.
   Nunca hay dos resoluciones: lo que se ve moviendose es lo mismo que en reposo.

   Si el navegador no tiene VideoDecoder, o el codec no esta soportado, o falla: `ok` queda en false y la
   web usa su secuencia de imagenes de siempre. */
'use strict';
(function (G) {
  const AHORA = () => performance.now();

  class Bobina {
    /* base: URL absoluta de la carpeta (acaba en /). opts: {mbDecod, mbBytes, decoders, onListo} */
    constructor(base, idx, opts = {}) {
      this.base = base; this.idx = idx; this.n = idx.n; this.G = idx.G;
      this.w = idx.width; this.h = idx.height;
      this.fb = this.w * this.h * 4;                                   // bytes de un fotograma decodificado
      this.capDecod = Math.max(this.G * 2 + 2, Math.floor((opts.mbDecod || 400) * 1048576 / this.fb));
      this.capBytes = (opts.mbBytes || 160) * 1048576;
      this.nDec = opts.decoders || 2; this.renderWidth=opts.renderWidth||0; this.crop=opts.crop||null;
      const cw=this.crop?this.crop.sw:this.w,ch=this.crop?this.crop.sh:this.h,rw=this.renderWidth||cw;
      this.fb=rw*Math.ceil(ch*rw/cw)*4;
      this.capDecod=Math.max(this.G*2+2,Math.floor((opts.mbDecod||400)*1048576/this.fb));
      this.onListo = opts.onListo || (() => {});
      this.bytes = new Map(); this.bytesTot = 0; this.bajando = new Set(); this.fallos = new Map();
      this.bmp = new Map(); this.decod = new Set();                    // grupos en decodificacion
      this.objetivo = 0; this.dir = 1; this.vel = 0; this.pintado = -1;
      this.decMs = 0; this.netMs = 0; this.ok = false; this.muerto = false;
      this.stats = { gops: 0, frames: 0, errores: 0, bajados: 0 };
      this.rejilla = [];
      const paso = Math.max(1, Math.round(idx.gops.length / 24));
      for (let g = 0; g < idx.gops.length; g += paso) this.rejilla.push(g);
      this.rejilla.push(idx.gops.length - 1);
      this.decs = [];
    }

    static async soporta(idx) {
      if (typeof VideoDecoder === 'undefined' || typeof EncodedVideoChunk === 'undefined') return false;
      try {
        const r = await VideoDecoder.isConfigSupported({ codec: idx.codec, codedWidth: idx.width, codedHeight: idx.height,
                                                         hardwareAcceleration: 'no-preference' });
        return !!r.supported;
      } catch (_) { return false; }
    }

    async iniciar() {
      if (!(await Bobina.soporta(this.idx))) return false;
      for (let k = 0; k < this.nDec; k++) this.decs.push({ busy: false });
      // prueba real: decodificar el primer grupo. Si sale un fotograma, el camino vale.
      try {
        await this._bajar(0, 'high');
        await this._decodificar(0, this.decs[0]);
        this.ok = this.bmp.has(0);
      } catch (e) { this.ok = false; }
      if (this.ok) this.bomba();
      return this.ok;
    }

    fijar(i, vel) {
      i = Math.max(0, Math.min(this.n - 1, i | 0));
      if (i !== this.objetivo) this.dir = i > this.objetivo ? 1 : -1;
      this.objetivo = i; this.vel = Math.abs(vel || 0);
      this.bomba();
    }

    /* el mejor fotograma disponible para i: exacto, o el mas cercano que no deshaga camino */
    cerca(i) {
      const b = this.bmp.get(i);
      if (b) return [i, b];
      const desde = this.pintado;
      let mejor = -1, d0 = 1e9;
      const R = this.n;
      for (let d = 1; d <= R; d++) {
        for (const j of [i - this.dir * d, i + this.dir * d]) {
          if (j < 0 || j >= this.n || !this.bmp.has(j)) continue;
          // no volver hacia atras respecto a lo ya pintado en un scroll continuo
          if (desde >= 0 && (j - desde) * this.dir < 0 && Math.abs(i - desde) < Math.abs(i - j)) continue;
          if (d < d0) { d0 = d; mejor = j; }
        }
        if (mejor >= 0) break;
      }
      return mejor >= 0 ? [mejor, this.bmp.get(mejor)] : [-1, null];
    }

    marcarPintado(i) { this.pintado = i; }

    _g(i) { return Math.floor(i / this.G); }

    _completo(g) {
      const a = g * this.G, b = Math.min(this.n, a + this.G);
      for (let i = a; i < b; i++) if (!this.bmp.has(i)) return false;
      return true;
    }

    async _bajar(g, prio) {
      if (this.bytes.has(g) || this.bajando.has(g)) return;
      this.bajando.add(g);
      const t0 = AHORA();
      try {
        if(this.muerto)return;
        const r = await fetch(this.base + this.idx.gops[g].f, { priority: prio || 'auto' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = await r.arrayBuffer(); if(this.muerto)return;
        this.bytes.set(g, buf); this.bytesTot += buf.byteLength; this.stats.bajados++;
        this.netMs = this.netMs ? this.netMs * 0.8 + (AHORA() - t0) * 0.2 : AHORA() - t0;
        this._podarBytes();
      } catch (e) {
        this.fallos.set(g, (this.fallos.get(g) || 0) + 1); this.stats.errores++;
      } finally { this.bajando.delete(g); }
    }

    _podarBytes() {
      if (this.bytesTot <= this.capBytes) return;
      const go = this._g(this.objetivo);
      const orden = [...this.bytes.keys()].sort((a, b) => Math.abs(b - go) - Math.abs(a - go));
      for (const g of orden) {
        if (this.bytesTot <= this.capBytes) break;
        if (Math.abs(g - go) <= 2 || this.decod.has(g)) continue;
        this.bytesTot -= this.bytes.get(g).byteLength; this.bytes.delete(g);
      }
    }

    _podarDecod(sitio) {
      while (this.bmp.size + sitio > this.capDecod) {
        let peor = -1, dp = -1;
        for (const i of this.bmp.keys()) {
          if (i === this.pintado) continue;
          let d = Math.abs(i - this.objetivo);
          if ((i - this.objetivo) * this.dir < 0) d *= 2;               // lo que queda detras pesa doble
          if (d > dp) { dp = d; peor = i; }
        }
        if (peor < 0) break;
        const b = this.bmp.get(peor); this.bmp.delete(peor); try { b.close(); } catch (_) {}
      }
    }

    _decodificar(g, slot) {
      const gi = this.idx.gops[g], buf = this.bytes.get(g);
      if (!buf) return Promise.resolve();
      slot.busy = true; this.decod.add(g);
      const a = g * this.G, t0 = AHORA();
      this._podarDecod(gi.o.length);
      const pend = [];
      return new Promise((resolve, reject) => {
        let dec,finished=false;
        const fin = (err) => {
          if(finished)return;finished=true;
          Promise.all(pend).then(() => {
            slot.busy = false; this.decod.delete(g);
            try { if (dec && dec.state !== 'closed') dec.close(); } catch (_) {}
            if (err) { this.stats.errores++; reject(err); return; }
            const ms = AHORA() - t0; this.decMs = this.decMs ? this.decMs * 0.8 + ms * 0.2 : ms; this.stats.gops++;
            resolve();
          });
        };
        try {
          dec = new VideoDecoder({
            output: (fr) => {
              const i = Math.round(fr.timestamp / 1000);
              const crop=this.crop,options=this.renderWidth?{resizeWidth:this.renderWidth,resizeQuality:'high'}:{};
              const bitmap=crop?createImageBitmap(fr,crop.sx,crop.sy,crop.sw,crop.sh,options):createImageBitmap(fr,options);
              pend.push(bitmap.then((b) => {
                if (this.muerto) { b.close(); return; }
                const viejo = this.bmp.get(i); if (viejo) try { viejo.close(); } catch (_) {}
                this.bmp.set(i, b); this.stats.frames++;
                this.onListo(i);
              }).catch(() => { this.stats.errores++; }).finally(() => { try { fr.close(); } catch (_) {} }));
            },
            error: (e) => fin(e || new Error('decode')),
          });
          dec.configure({ codec: this.idx.codec, codedWidth: this.w, codedHeight: this.h,
                          optimizeForLatency: true, hardwareAcceleration: 'no-preference' });
          const u8 = new Uint8Array(buf);
          for (let k = 0; k < gi.o.length; k++) {
            const s = gi.o[k], e = k + 1 < gi.o.length ? gi.o[k + 1] : gi.b;
            dec.decode(new EncodedVideoChunk({ type: k === 0 ? 'key' : 'delta', timestamp: (a + k) * 1000,
                                               data: u8.subarray(s, e) }));
          }
          dec.flush().then(() => fin(null), (e) => fin(e));
        } catch (e) { fin(e); }
      });
    }

    bomba() {
      if (!this.ok || this.muerto) return;
      const go = this._g(this.objetivo), NG = this.idx.gops.length;
      // 1) bytes: el grupo del cursor, los de delante (mas cuanto mas rapido), dos de detras, la rejilla
      const lead = Math.min(16, 3 + Math.ceil(this.vel * 40));
      const quiero = [go];
      for (let k = 1; k <= lead; k++) quiero.push(go + this.dir * k);
      quiero.push(go - this.dir, go - this.dir * 2);
      for (const g of this.rejilla) quiero.push(g);
      for (let k = lead + 1; k < NG; k++) { quiero.push(go + this.dir * k); quiero.push(go - this.dir * k); }
      let enVuelo = this.bajando.size;
      for (const g of quiero) {
        if (enVuelo >= 4) break;
        if (g < 0 || g >= NG || this.bytes.has(g) || this.bajando.has(g) || (this.fallos.get(g) || 0) >= 3) continue;
        if (this.bytesTot > this.capBytes * 0.95 && Math.abs(g - go) > lead) break;
        enVuelo++;
        this._bajar(g, Math.abs(g - go) <= 2 ? 'high' : 'low').then(() => this.bomba());
      }
      // 2) decodificar: el grupo del cursor, luego por delante; cuantos caben en la ventana
      // la ventana cabe `caben` grupos: el del cursor y los de delante; el de detras solo si sobra sitio
      const caben = Math.max(2, Math.floor(this.capDecod / this.G));
      const dq = [go];
      for (let k = 1; k < caben; k++) dq.push(go + this.dir * k);
      if (caben >= 3) dq.splice(2, 0, go - this.dir);
      for (const g of dq) {
        const slot = this.decs.find((s) => !s.busy);
        if (!slot) break;
        if (g < 0 || g >= NG || this.decod.has(g) || this._completo(g) || !this.bytes.has(g)) continue;
        this._decodificar(g, slot).catch(() => {}).then(() => this.bomba());
      }
    }

    estado() {
      return { ok: this.ok, n: this.n, w: this.w, h: this.h, decod: this.bmp.size, cap: this.capDecod,
               bytesMB: Math.round(this.bytesTot / 1048576), decMs: Math.round(this.decMs), netMs: Math.round(this.netMs),
               ...this.stats };
    }

    cerrar() {
      this.muerto = true;
      for (const b of this.bmp.values()) try { b.close(); } catch (_) {}
      this.bmp.clear(); this.bytes.clear();
    }
  }

  /* lee index.json y decide si el camino de video vale aqui */
  async function abrirBobina(base, opts) {
    try {
      const r = await fetch(base + 'index.json');
      if (!r.ok) return null;
      const idx = await r.json();
      const b = new Bobina(base, idx, opts);
      return (await b.iniciar()) ? b : null;
    } catch (_) { return null; }
  }

  G.PeliGop = { Bobina, abrirBobina };
})(self);
