"""REQ-053: loopback-only, warmed local GPT-SoVITS worker (docs/local_voice_design.md).

Input: external engine/assets directories, POST JSON text/speed. Output: WAV.
No model downloads, training UI, paid calls or prompt logging. Startup errors
exit nonzero; per-request invalid/busy/inference failures return 400/503/502.
Tune MAX_TEXT/MAX_AUDIO and model paths together with Java/browser contracts.
"""
import argparse
import io
import json
import math
import os
import re
from pathlib import Path
import shutil
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_TEXT=80
MAX_AUDIO=4*1024*1024


def spoken_text(text):
    """Chinese-only pronunciation: AI -> 人工智能, other ASCII letters spelled in Chinese.

    Avoid upstream mixed-language detection/downloads (including Unicode-path
    fasttext failures on Windows). Displayed text/history remain unchanged.
    See docs/local_voice_design.md; TEST-053 covers the inherited AI greeting.
    """
    text=re.sub(r'(?<![A-Za-z])AI(?![A-Za-z])','人工智能',text,flags=re.I)
    names=['诶','比','西','迪','伊','艾弗','吉','艾尺','艾','杰','开','艾勒','艾姆','恩','欧','皮','丘','阿尔','艾斯','提','优','维','达布流','艾克斯','外','泽德']
    text=re.sub(r'[A-Za-z]',lambda match:names[ord(match.group().upper())-65],text)
    if len(text)>160:raise ValueError('Pronunciation expansion too long')
    return text


def validate(raw):
    """Validate untrusted JSON; return (trimmed text, finite speed), else ValueError."""
    if not isinstance(raw,dict) or set(raw)-{'text','speed'}:
        raise ValueError('Invalid request')
    text=raw.get('text');speed=raw.get('speed',1)
    if not isinstance(text,str) or not 1<=len(text.strip())<=MAX_TEXT:
        raise ValueError('Invalid text')
    if any((ord(c)<32 and c not in '\n\t') or ord(c)==127 or 0xd800<=ord(c)<=0xdfff for c in text):
        raise ValueError('Invalid text')
    if isinstance(speed,bool) or not isinstance(speed,(int,float)) or not math.isfinite(speed) or not .5<=speed<=2:
        raise ValueError('Invalid speed')
    return text.strip(),float(speed)


class State:
    """Own one model: at most one inference and one queued request; no history."""
    def __init__(self,synthesize):
        self.synthesize=synthesize
        self.slots=threading.BoundedSemaphore(2)
        self.lock=threading.Lock()


def make_server(port,state):
    """Bind only IPv4 loopback; HTTP errors never expose model paths or prompts."""
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def setup(self):
            super().setup();self.connection.settimeout(5)
        def send_body(self,status,data,kind='application/json'):
            self.send_response(status)
            self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store');self.end_headers()
            try:self.wfile.write(data)
            except (BrokenPipeError,ConnectionResetError,TimeoutError):pass
        def do_GET(self):
            self.send_body(200,b'{"ready":true}') if self.path=='/health' else self.send_body(404,b'{"error":"not-found"}')
        def do_POST(self):
            if self.path!='/synthesize':return self.send_body(404,b'{"error":"not-found"}')
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=16384 or self.headers.get_content_type()!='application/json':raise ValueError()
                text,speed=validate(json.loads(self.rfile.read(length)))
            except (ValueError,UnicodeError,TimeoutError):return self.send_body(400,b'{"error":"invalid-request"}')
            if not state.slots.acquire(blocking=False):return self.send_body(503,b'{"error":"busy"}')
            try:
                with state.lock:audio=state.synthesize(text,speed)
                if not 44<=len(audio)<=MAX_AUDIO or audio[:4]!=b'RIFF' or audio[8:12]!=b'WAVE':raise ValueError('Invalid audio')
                self.send_body(200,audio,'audio/wav')
            except Exception:
                self.send_body(502,b'{"error":"synthesis-failed"}')
            finally:state.slots.release()
    return ThreadingHTTPServer(('127.0.0.1',port),Handler)


def load_engine(engine,assets):
    """Load external CUDA weights with restricted pickle and warm once; no downloads.

    Returns callable(text,speed)->WAV bytes; raises on invalid install/CUDA/model.
    See docs/local_voice_design.md. Change voice paths here for another local voice.
    """
    engine=engine.resolve();assets=assets.resolve()
    if not (engine/'GPT_SoVITS').is_dir():raise ValueError('Invalid engine directory')
    required=['models/tomori-gpt.ckpt','models/tomori-sovits.pth','references/tomori.mp3']
    if any(not (assets/p).is_file() for p in required):raise ValueError('Missing external voice assets')
    os.chdir(engine);sys.path[:0]=[str(engine),str(engine/'GPT_SoVITS')]
    os.environ.update(HF_HUB_OFFLINE='1',TOKENIZERS_PARALLELISM='false',TORCH_FORCE_WEIGHTS_ONLY_LOAD='1')
    import socket
    def offline(*args,**kwargs):raise RuntimeError('Outbound network disabled for local voice')
    socket.socket.connect=offline;socket.socket.connect_ex=offline
    import imageio_ffmpeg
    binary=assets/'bin/ffmpeg.exe' if os.name=='nt' else Path(imageio_ffmpeg.get_ffmpeg_exe())
    if os.name=='nt' and not binary.exists():
        binary.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(imageio_ffmpeg.get_ffmpeg_exe(),binary)
    os.environ['PATH']=str(binary.parent)+os.pathsep+os.environ['PATH']
    import torch
    import jieba,jieba.posseg
    import numpy as np
    import soundfile as sf
    if not torch.cuda.is_available():raise RuntimeError('CUDA PyTorch required')
    torch.set_num_threads(4)
    sys.modules['jieba_fast']=jieba;sys.modules['jieba_fast.posseg']=jieba.posseg
    from utils import HParams
    torch.serialization.add_safe_globals([HParams])
    from TTS_infer_pack.TTS import TTS
    import contextlib
    with open(os.devnull,'w') as quiet,contextlib.redirect_stdout(quiet),contextlib.redirect_stderr(quiet):
        tts=TTS({'version':'v2','custom':{'version':'v2','device':'cuda','is_half':True,
            't2s_weights_path':str(assets/required[0]),'vits_weights_path':str(assets/required[1]),
            'bert_base_path':str(engine/'GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large'),
            'cnhuhbert_base_path':str(engine/'GPT_SoVITS/pretrained_models/chinese-hubert-base')}})

    def synthesize(text,speed):
        text=spoken_text(text)
        # Upstream prints normalized prompts/progress; suppress per-request logs.
        with open(os.devnull,'w') as quiet,contextlib.redirect_stdout(quiet),contextlib.redirect_stderr(quiet):
            chunks=list(tts.run({'text':text,'text_lang':'all_zh','ref_audio_path':str(assets/required[2]),
                'prompt_text':'','prompt_lang':'all_ja','top_k':15,'top_p':1.,'temperature':.8,
                'text_split_method':'cut0','batch_size':1,'speed_factor':speed,'split_bucket':False,
                'return_fragment':False,'seed':42,'parallel_infer':True,'repetition_penalty':1.35}))
        if not chunks or len({sr for sr,_ in chunks})!=1:raise ValueError('Invalid chunks')
        audio=np.concatenate([part for _,part in chunks]);sr=chunks[0][0]
        if not len(audio) or not np.isfinite(audio).all() or np.max(np.abs(audio.astype(float)))<10:raise ValueError('Silent audio')
        output=io.BytesIO();sf.write(output,audio,sr,format='WAV',subtype='PCM_16');return output.getvalue()
    synthesize('你好，欢迎来到景区。',1.)
    return synthesize


def main():
    """CLI: required install paths, optional loopback port9880; Ctrl-C shuts down."""
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine-dir',type=Path,required=True)
    parser.add_argument('--assets-dir',type=Path,required=True)
    parser.add_argument('--port',type=int,default=9880)
    args=parser.parse_args()
    if not 1<=args.port<=65535:parser.error('invalid port')
    state=State(load_engine(args.engine_dir,args.assets_dir))
    server=make_server(args.port,state)
    print('Local voice ready on 127.0.0.1:'+str(args.port),flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()


if __name__=='__main__':main()
